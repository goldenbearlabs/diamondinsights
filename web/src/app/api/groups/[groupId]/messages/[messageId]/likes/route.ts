// src/app/api/groups/[groupId]/messages/[messageId]/likes/route.ts
import { NextResponse } from 'next/server'
import admin from 'firebase-admin'
import { firestore } from '@/lib/firebaseAdmin'
import { headers } from 'next/headers'

if (!admin.apps.length) admin.initializeApp()

async function getUserId() {
  const h = await headers()
  const authHeader = h.get('authorization') || ''
  const match = authHeader.match(/^Bearer (.+)$/)
  if (!match) throw new Error('Missing or malformed Authorization header')
  const token = match[1]
  const decoded = await admin.auth().verifyIdToken(token)
  return decoded.uid
}

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

export async function POST(
  request: Request,
  context: { params: Promise<{ groupId: string; messageId: string }> }
) {
  try {
    const userId = await getUserId()
    const { groupId, messageId } = await context.params
    
    // Verify user is a group member
    await verifyGroupMembership(groupId, userId)
    
    // Get the message document
    const messageRef = firestore.collection(`chat_group_${groupId}`).doc(messageId)
    const messageDoc = await messageRef.get()
    
    if (!messageDoc.exists) {
      return NextResponse.json(
        { error: 'Message not found' },
        { status: 404 }
      )
    }
    
    const messageData = messageDoc.data()!
    const currentLikes = messageData.likedBy || []
    
    let newLikes: string[]
    let toggled: boolean
    
    if (currentLikes.includes(userId)) {
      // User already liked - remove like
      newLikes = currentLikes.filter((id: string) => id !== userId)
      toggled = false
    } else {
      // User hasn't liked - add like
      newLikes = [...currentLikes, userId]
      toggled = true
    }
    
    // Update the message with new likes
    await messageRef.update({
      likedBy: newLikes
    })
    
    return NextResponse.json({
      success: true,
      toggled,
      likes: newLikes.length
    })
    
  } catch (error) {
    console.error('Error toggling message like:', error)
    
    if (error instanceof Error) {
      if (error.message.includes('auth')) {
        return NextResponse.json({ error: 'Authentication failed' }, { status: 401 })
      }
      
      if (error.message.includes('Group not found')) {
        return NextResponse.json({ error: error.message }, { status: 404 })
      }
      
      if (error.message.includes('not a member')) {
        return NextResponse.json({ error: error.message }, { status: 403 })
      }
    }
    
    return NextResponse.json(
      { error: 'Failed to toggle like' },
      { status: 500 }
    )
  }
}