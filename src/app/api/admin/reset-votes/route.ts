// src/app/api/admin/reset-votes/route.ts
import { NextResponse } from 'next/server'
import { firestore } from '@/lib/firebaseAdmin'
import admin from 'firebase-admin'

export async function POST(request: Request) {
  try {
    // Check for admin authentication
    const authHeader = request.headers.get('authorization')
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Missing or invalid authorization header' }, { status: 401 })
    }

    const token = authHeader.substring(7)
    
    // Verify the token and get user ID
    let userId: string
    let userEmail: string
    try {
      const decodedToken = await admin.auth().verifyIdToken(token)
      userId = decodedToken.uid
      userEmail = decodedToken.email || ''
    } catch {
      return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401 })
    }

    // Get request body for confirmation
    const body = await request.json()
    const { confirm } = body

    if (confirm !== 'RESET_ALL_VOTES') {
      return NextResponse.json({ 
        error: 'Missing confirmation. Send { "confirm": "RESET_ALL_VOTES" } to proceed.' 
      }, { status: 400 })
    }

    console.log(`Admin vote reset initiated by user ${userId} (${userEmail}) at ${new Date().toISOString()}`)

    // Get all vote documents
    const votesSnapshot = await firestore
      .collection('cardVotes')
      .get()

    const totalVotes = votesSnapshot.docs.length
    
    if (totalVotes === 0) {
      return NextResponse.json({
        success: true,
        message: 'No votes found to delete',
        deletedCount: 0,
        operation: 'reset-votes',
        timestamp: new Date().toISOString(),
        adminUser: userEmail
      })
    }

    // Batch delete all vote documents
    const batch = firestore.batch()
    
    votesSnapshot.docs.forEach(doc => {
      batch.delete(doc.ref)
    })

    // Execute the batch deletion
    await batch.commit()

    console.log(`Successfully deleted ${totalVotes} votes by admin ${userEmail}`)

    return NextResponse.json({
      success: true,
      message: `Successfully deleted all card votes`,
      deletedCount: totalVotes,
      operation: 'reset-votes',
      timestamp: new Date().toISOString(),
      adminUser: userEmail
    })

  } catch (error) {
    console.error('Error resetting votes:', error)
    return NextResponse.json({ 
      error: 'Failed to reset votes',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

export async function GET(request: Request) {
  try {
    // Check for admin authentication
    const authHeader = request.headers.get('authorization')
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Missing or invalid authorization header' }, { status: 401 })
    }

    const token = authHeader.substring(7)
    
    // Verify the token
    try {
      await admin.auth().verifyIdToken(token)
    } catch {
      return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401 })
    }

    // Get current vote statistics
    const votesSnapshot = await firestore
      .collection('cardVotes')
      .get()

    const totalVotes = votesSnapshot.docs.length
    let upvotes = 0
    let downvotes = 0
    const cardVotesCounts: Record<string, { up: number, down: number }> = {}

    votesSnapshot.docs.forEach(doc => {
      const voteData = doc.data()
      const cardId = voteData.cardId
      const vote = voteData.vote

      if (vote === 'up') {
        upvotes++
      } else if (vote === 'down') {
        downvotes++
      }

      if (!cardVotesCounts[cardId]) {
        cardVotesCounts[cardId] = { up: 0, down: 0 }
      }
      
      if (vote === 'up') {
        cardVotesCounts[cardId].up++
      } else if (vote === 'down') {
        cardVotesCounts[cardId].down++
      }
    })

    const uniqueCards = Object.keys(cardVotesCounts).length

    return NextResponse.json({
      success: true,
      statistics: {
        totalVotes,
        upvotes,
        downvotes,
        uniqueCards,
        averageVotesPerCard: uniqueCards > 0 ? Math.round(totalVotes / uniqueCards * 100) / 100 : 0
      },
      topVotedCards: Object.entries(cardVotesCounts)
        .map(([cardId, votes]) => ({
          cardId,
          upvotes: votes.up,
          downvotes: votes.down,
          netVotes: votes.up - votes.down,
          totalVotes: votes.up + votes.down
        }))
        .sort((a, b) => b.totalVotes - a.totalVotes)
        .slice(0, 10),
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('Error getting vote statistics:', error)
    return NextResponse.json({ 
      error: 'Failed to get vote statistics',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}