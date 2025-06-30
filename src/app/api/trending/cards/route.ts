// src/app/api/trending/cards/route.ts
import { NextResponse } from 'next/server'
import { firestore } from '@/lib/firebaseAdmin'

export async function GET() {
  try {
    // Get all votes from cardVotes collection
    const votesSnapshot = await firestore
      .collection('cardVotes')
      .get()
    
    // Count votes per card
    const votesByCard: Record<string, { upvotes: number, downvotes: number }> = {}
    
    votesSnapshot.docs.forEach(doc => {
      const voteData = doc.data()
      const cardId = voteData.cardId
      
      if (!votesByCard[cardId]) {
        votesByCard[cardId] = { upvotes: 0, downvotes: 0 }
      }
      
      if (voteData.vote === 'up') {
        votesByCard[cardId].upvotes++
      } else if (voteData.vote === 'down') {
        votesByCard[cardId].downvotes++
      }
    })
    
    // Convert to array and calculate net scores
    const cardVoteArray = Object.entries(votesByCard).map(([cardId, votes]) => ({
      cardId,
      upvotes: votes.upvotes,
      downvotes: votes.downvotes,
      netVotes: votes.upvotes - votes.downvotes,
      totalVotes: votes.upvotes + votes.downvotes
    }))
    
    // Sort by net votes (upvotes - downvotes), then by total votes, then by cardId for consistency
    cardVoteArray.sort((a, b) => {
      if (a.netVotes !== b.netVotes) return b.netVotes - a.netVotes // Higher net votes first
      if (a.totalVotes !== b.totalVotes) return b.totalVotes - a.totalVotes // More total engagement
      return a.cardId.localeCompare(b.cardId) // Consistent tie-breaking
    })
    
    // Get top 10 cards
    const top10Cards = cardVoteArray.slice(0, 10)
    
    // Fetch card details for these cards
    const cardDetails = await Promise.all(
      top10Cards.map(async (cardVote) => {
        try {
          const cardDoc = await firestore
            .collection('cards')
            .doc(cardVote.cardId)
            .get()
          
          if (!cardDoc.exists) {
            return null
          }
          
          const cardData = cardDoc.data()
          const rawPred = cardData?.latestPrediction || {}
          
          // Calculate basic prediction info
          const currentOvr = Number(cardData?.ovr) || 0
          const predictedRank = Number(rawPred.predicted_rank) || currentOvr
          const deltaRank = Number(rawPred.delta_rank_pred) || 0
          
          return {
            id: cardDoc.id,
            name: cardData?.name || 'Unknown Player',
            team_short_name: cardData?.team_short_name || '',
            display_position: cardData?.display_position || '',
            baked_img: cardData?.baked_img || '',
            ovr: currentOvr,
            predicted_rank: predictedRank,
            delta_rank_pred: deltaRank,
            upvotes: cardVote.upvotes,
            downvotes: cardVote.downvotes,
            netVotes: cardVote.netVotes,
            totalVotes: cardVote.totalVotes
          }
        } catch (error) {
          console.error(`Error fetching card ${cardVote.cardId}:`, error)
          return null
        }
      })
    )
    
    // Filter out null results and return
    const validCards = cardDetails.filter(card => card !== null)
    
    return NextResponse.json(validCards, {
      headers: {
        'Cache-Control': 'public, max-age=30, s-maxage=30' // Cache for 30 seconds
      }
    })
    
  } catch (error) {
    console.error('Error fetching trending cards:', error)
    return NextResponse.json(
      { error: 'Failed to fetch trending cards' },
      { status: 500 }
    )
  }
}