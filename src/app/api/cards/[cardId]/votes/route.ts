// src/app/api/cards/[cardId]/votes/route.ts
import { NextResponse } from 'next/server'
import { firestore } from '@/lib/firebaseAdmin'
import admin from 'firebase-admin'

export async function GET(
  request: Request,
  context: { params: Promise<{ cardId: string }> }
) {
  const { cardId } = await context.params
  
  try {
    // Get all votes for this card
    const votesSnapshot = await firestore
      .collection('cardVotes')
      .where('cardId', '==', cardId)
      .get()
    
    let upvotes = 0
    let downvotes = 0
    
    votesSnapshot.docs.forEach(doc => {
      const voteData = doc.data()
      if (voteData.vote === 'up') {
        upvotes++
      } else if (voteData.vote === 'down') {
        downvotes++
      }
    })
    
    return NextResponse.json({
      upvotes,
      downvotes,
      total: upvotes + downvotes
    })
    
  } catch (error) {
    console.error('Error fetching votes:', error)
    return NextResponse.json({ error: 'Failed to fetch votes' }, { status: 500 })
  }
}

export async function POST(
  request: Request,
  context: { params: Promise<{ cardId: string }> }
) {
  const { cardId } = await context.params
  
  try {
    // Get Authorization header
    const authHeader = request.headers.get('authorization')
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Missing or invalid authorization header' }, { status: 401 })
    }
    
    const token = authHeader.substring(7)
    
    // Verify the token and get user ID
    let userId: string
    try {
      const decodedToken = await admin.auth().verifyIdToken(token)
      userId = decodedToken.uid
    } catch {
      return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401 })
    }
    
    const { vote } = await request.json()
    
    // Validate vote type
    if (vote !== 'up' && vote !== 'down') {
      return NextResponse.json({ error: 'Vote must be "up" or "down"' }, { status: 400 })
    }
    
    // Check if user has already voted on this card
    const existingVoteQuery = await firestore
      .collection('cardVotes')
      .where('cardId', '==', cardId)
      .where('userId', '==', userId)
      .get()
    
    // Create vote document ID for this user/card combination
    const voteDocId = `${cardId}_${userId}`
    
    if (!existingVoteQuery.empty) {
      // Update existing vote
      await firestore
        .collection('cardVotes')
        .doc(voteDocId)
        .update({
          vote,
          timestamp: Date.now()
        })
    } else {
      // Create new vote
      await firestore
        .collection('cardVotes')
        .doc(voteDocId)
        .set({
          cardId,
          userId,
          vote,
          timestamp: Date.now()
        })
    }
    
    // Get updated vote counts
    const votesSnapshot = await firestore
      .collection('cardVotes')
      .where('cardId', '==', cardId)
      .get()
    
    let upvotes = 0
    let downvotes = 0
    
    votesSnapshot.docs.forEach(doc => {
      const voteData = doc.data()
      if (voteData.vote === 'up') {
        upvotes++
      } else if (voteData.vote === 'down') {
        downvotes++
      }
    })
    
    return NextResponse.json({
      success: true,
      userVote: vote,
      upvotes,
      downvotes,
      total: upvotes + downvotes
    })
    
  } catch (error) {
    console.error('Error processing vote:', error)
    return NextResponse.json({ error: 'Failed to process vote' }, { status: 500 })
  }
}

export async function DELETE(
  request: Request,
  context: { params: Promise<{ cardId: string }> }
) {
  const { cardId } = await context.params
  
  try {
    // Get Authorization header
    const authHeader = request.headers.get('authorization')
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Missing or invalid authorization header' }, { status: 401 })
    }
    
    const token = authHeader.substring(7)
    
    // Verify the token and get user ID
    let userId: string
    try {
      const decodedToken = await admin.auth().verifyIdToken(token)
      userId = decodedToken.uid
    } catch {
      return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401 })
    }
    
    // Delete user's vote
    const voteDocId = `${cardId}_${userId}`
    await firestore
      .collection('cardVotes')
      .doc(voteDocId)
      .delete()
    
    // Get updated vote counts
    const votesSnapshot = await firestore
      .collection('cardVotes')
      .where('cardId', '==', cardId)
      .get()
    
    let upvotes = 0
    let downvotes = 0
    
    votesSnapshot.docs.forEach(doc => {
      const voteData = doc.data()
      if (voteData.vote === 'up') {
        upvotes++
      } else if (voteData.vote === 'down') {
        downvotes++
      }
    })
    
    return NextResponse.json({
      success: true,
      userVote: null,
      upvotes,
      downvotes,
      total: upvotes + downvotes
    })
    
  } catch (error) {
    console.error('Error removing vote:', error)
    return NextResponse.json({ error: 'Failed to remove vote' }, { status: 500 })
  }
}