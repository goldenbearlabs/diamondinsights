// src/app/api/cards/[cardId]/comments/[commentId]/route.ts
import { NextResponse } from 'next/server'
import { firestore } from '@/lib/firebaseAdmin'
import admin from 'firebase-admin'

export async function DELETE(
  request: Request,
  context: { params: Promise<{ cardId: string; commentId: string }> }
) {
  try {
    const { cardId, commentId } = await context.params
    
    // Get Authorization header
    const authHeader = request.headers.get('authorization')
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Missing or invalid authorization header' }, { status: 401 })
    }
    
    const token = authHeader.substring(7) // Remove 'Bearer ' prefix
    
    // Verify the token and get user ID
    let userId: string
    try {
      const decodedToken = await admin.auth().verifyIdToken(token)
      userId = decodedToken.uid
    } catch {
      return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401 })
    }
    
    // Get the comment to verify ownership
    const commentDoc = await firestore.collection('comments').doc(commentId).get()
    
    if (!commentDoc.exists) {
      return NextResponse.json({ error: 'Comment not found' }, { status: 404 })
    }
    
    const commentData = commentDoc.data()
    
    // Verify the comment belongs to this player/card
    if (commentData?.playerId !== cardId) {
      return NextResponse.json({ error: 'Comment does not belong to this player' }, { status: 400 })
    }
    
    // Verify the user owns this comment
    if (commentData?.userId !== userId) {
      return NextResponse.json({ error: 'You can only delete your own comments' }, { status: 403 })
    }
    
    // Delete the comment
    await firestore.collection('comments').doc(commentId).delete()
    
    // Also delete any replies to this comment (if it's a top-level comment)
    if (!commentData?.parentId) {
      const repliesQuery = await firestore
        .collection('comments')
        .where('parentId', '==', commentId)
        .get()
      
      const batch = firestore.batch()
      repliesQuery.docs.forEach(doc => {
        batch.delete(doc.ref)
      })
      
      if (!repliesQuery.empty) {
        await batch.commit()
      }
    }
    
    return NextResponse.json({ success: true }, { status: 200 })
    
  } catch (error) {
    console.error('Delete comment error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}