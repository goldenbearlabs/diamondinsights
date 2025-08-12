// src/app/api/cards/[cardId]/comments/[commentId]/route.ts
import { NextResponse } from 'next/server'
import { firestore } from '@/lib/firebaseAdmin'
import admin from 'firebase-admin'

// maximum allowed length for a comment
const MAX_LENGTH = 500

// simple word‐blocker
const BLACKLIST = [
  'nigger','nigga','faggot','fag','retard',
  'kike','chink','spic','dyke','tranny',
  'slut','whore','bitch','asshole'
]
function censor(text: string): string {
  return text
    .split(/\b/)
    .map(tok =>
      BLACKLIST.includes(tok.toLowerCase()) ? '****' : tok
    )
    .join('')
}

async function requireAuth(request: Request) {
  const authHeader = request.headers.get('authorization')
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new Error('Missing or invalid authorization header')
  }
  
  const token = authHeader.substring(7) // Remove 'Bearer ' prefix
  
  try {
    const decodedToken = await admin.auth().verifyIdToken(token)
    return decodedToken.uid
  } catch {
    throw new Error('Invalid or expired token')
  }
}

export async function PUT(
  request: Request,
  context: { params: Promise<{ cardId: string; commentId: string }> }
) {
  try {
    const { cardId, commentId } = await context.params
    
    // Authenticate user
    let userId: string
    try {
      userId = await requireAuth(request)
    } catch {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
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
      return NextResponse.json({ error: 'You can only edit your own comments' }, { status: 403 })
    }
    
    // Get the new text from request body
    const { text: rawText } = await request.json()
    
    // Apply content validation (same as POST endpoint)
    const cleaned = censor(rawText.trim())
    
    // Reject empty or all-censored
    if (!cleaned.replace(/\*+/g, '').trim()) {
      return NextResponse.json(
        { error: 'Your comment contains disallowed language.' },
        { status: 400 }
      )
    }
    
    // Enforce maximum length
    if (cleaned.length > MAX_LENGTH) {
      return NextResponse.json(
        { error: `Comment too long (max ${MAX_LENGTH} characters).` },
        { status: 400 }
      )
    }
    
    // Block external URLs
    const urlPattern = /(https?:\/\/[^\s]+|www\.[^\s]+)/i
    if (urlPattern.test(cleaned)) {
      return NextResponse.json(
        { error: 'External links are not allowed.' },
        { status: 400 }
      )
    }
    
    // Collapse blank‐line floods
    const sanitized = cleaned.replace(/\n{3,}/g, '\n\n')
    
    // Store current text in edit history before updating
    const now = Date.now()
    const currentEditHistory = commentData?.editHistory || []
    
    // Add current text to edit history
    const newEditHistory = [
      ...currentEditHistory,
      {
        text: commentData?.text || '',
        editedAt: commentData?.timestamp || now
      }
    ]
    
    // Update the comment
    await firestore.collection('comments').doc(commentId).update({
      text: sanitized,
      editedAt: now,
      editHistory: newEditHistory
    })
    
    return NextResponse.json({ success: true }, { status: 200 })
    
  } catch (error) {
    console.error('Edit comment error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

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