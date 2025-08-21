// PUT /api/groups/[groupId]/messages/[messageId] - Edit a group chat message
// DELETE /api/groups/[groupId]/messages/[messageId] - Delete a group chat message
import { NextResponse } from 'next/server'
import admin from 'firebase-admin'
import { firestore } from '@/lib/firebaseAdmin'
import { headers } from 'next/headers'

if (!admin.apps.length) admin.initializeApp()

// maximum allowed length for a chat message
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

// Helper to verify group membership
async function verifyGroupMembership(groupId: string, userId: string) {
  const groupDoc = await firestore.collection('groups').doc(groupId).get()
  
  if (!groupDoc.exists) {
    throw new Error('Group not found')
  }
  
  const groupData = groupDoc.data()!
  if (!groupData.memberIds || !groupData.memberIds.includes(userId)) {
    throw new Error('You are not a member of this group')
  }
  
  return groupData
}

export async function PUT(
  request: Request,
  context: { params: Promise<{ groupId: string; messageId: string }> }
) {
  try {
    const { groupId, messageId } = await context.params
    
    // Get authenticated user
    const userId = await getUserId()
    if (!userId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }
    
    // Verify user is a group member
    await verifyGroupMembership(groupId, userId)
    
    // Get the message from Firestore
    const collectionName = `chat_group_${groupId}`
    const messageDoc = await firestore.collection(collectionName).doc(messageId).get()
    
    if (!messageDoc.exists) {
      return NextResponse.json({ error: 'Message not found' }, { status: 404 })
    }
    
    const messageData = messageDoc.data()
    
    // Verify the user owns this message
    if (messageData?.userId !== userId) {
      return NextResponse.json({ error: 'You can only edit your own messages' }, { status: 403 })
    }
    
    // Get the new text from request body
    const { text: rawText } = await request.json()
    
    // Apply content validation (same as POST endpoint)
    const cleaned = censor(rawText.trim())
    
    // Reject empty or all-censored
    if (!cleaned.replace(/\*+/g, '').trim()) {
      return NextResponse.json(
        { error: 'Your message contains disallowed language.' },
        { status: 400 }
      )
    }
    
    // Enforce maximum length
    if (cleaned.length > MAX_LENGTH) {
      return NextResponse.json(
        { error: `Message too long (max ${MAX_LENGTH} characters).` },
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
    const currentEditHistory = messageData?.editHistory || []
    
    // Add current text to edit history
    const newEditHistory = [
      ...currentEditHistory,
      {
        text: messageData?.text || '',
        editedAt: messageData?.timestamp || now
      }
    ]
    
    // Update the message
    await firestore.collection(collectionName).doc(messageId).update({
      text: sanitized,
      editedAt: now,
      editHistory: newEditHistory
    })
    
    return NextResponse.json({ success: true }, { status: 200 })
    
  } catch (error) {
    console.error('Edit group message error:', error)
    
    if (error instanceof Error) {
      if (error.message.includes('Group not found')) {
        return NextResponse.json({ error: error.message }, { status: 404 })
      }
      
      if (error.message.includes('not a member')) {
        return NextResponse.json({ error: error.message }, { status: 403 })
      }
    }
    
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(
  request: Request,
  context: { params: Promise<{ groupId: string; messageId: string }> }
) {
  try {
    const { groupId, messageId } = await context.params
    
    // Get authenticated user
    const userId = await getUserId()
    if (!userId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }
    
    // Verify user is a group member
    await verifyGroupMembership(groupId, userId)
    
    // Get the message from Firestore
    const collectionName = `chat_group_${groupId}`
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
    console.error('Delete group message error:', error)
    
    if (error instanceof Error) {
      if (error.message.includes('Group not found')) {
        return NextResponse.json({ error: error.message }, { status: 404 })
      }
      
      if (error.message.includes('not a member')) {
        return NextResponse.json({ error: error.message }, { status: 403 })
      }
    }
    
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}