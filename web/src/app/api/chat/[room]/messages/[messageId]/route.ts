// DELETE /api/chat/[room]/messages/[messageId] - Delete a chat message
import { NextResponse } from 'next/server'
import admin from 'firebase-admin'
import { firestore } from '@/lib/firebaseAdmin'
import { headers } from 'next/headers'

if (!admin.apps.length) admin.initializeApp()

// Helper to get authenticated user ID
async function getUserId() {
  try {
    const headersList = await headers()
    const authHeader = headersList.get('authorization')
    
    if (!authHeader?.startsWith('Bearer ')) {
      return null
    }
    
    const token = authHeader.substring(7)
    const decodedToken = await admin.auth().verifyIdToken(token)
    return decodedToken.uid
  } catch (error) {
    console.error('Auth error:', error)
    return null
  }
}

export async function DELETE(
  request: Request,
  context: { params: Promise<{ room: string; messageId: string }> }
) {
  try {
    const { room, messageId } = await context.params
    
    // Validate room parameter
    const validRooms = ['main', 'investing', 'flipping', 'stub']
    if (!validRooms.includes(room)) {
      return NextResponse.json({ error: 'Invalid chat room' }, { status: 400 })
    }
    
    // Get authenticated user
    const userId = await getUserId()
    if (!userId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }
    
    // Get the message from Firestore
    const collectionName = `chat_${room}`
    const messageDoc = await firestore.collection(collectionName).doc(messageId).get()
    
    if (!messageDoc.exists) {
      return NextResponse.json({ error: 'Message not found' }, { status: 404 })
    }
    
    const messageData = messageDoc.data()
    
    // Verify the user owns this message
    if (messageData?.userId !== userId) {
      return NextResponse.json({ error: 'You can only delete your own messages' }, { status: 403 })
    }
    
    // Delete the message
    await firestore.collection(collectionName).doc(messageId).delete()
    
    // Also delete any replies to this message (if it's a top-level message)
    if (!messageData?.parentId) {
      const repliesQuery = await firestore
        .collection(collectionName)
        .where('parentId', '==', messageId)
        .get()
      
      // Delete all replies in a batch
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
    console.error('Delete message error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}