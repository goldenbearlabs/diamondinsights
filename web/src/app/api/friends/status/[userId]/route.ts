// src/app/api/friends/status/[userId]/route.ts
// Get friendship status between current user and another user


import { NextResponse } from 'next/server'
import admin from 'firebase-admin'
import { firestore } from '@/lib/firebaseAdmin'
import { headers } from 'next/headers'

// TypeScript interfaces for our data structures
// These define the shape of our Firestore documents

interface FriendRequest {
  senderId: string      // User who sent the request
  receiverId: string    // User who received the request  
  status: 'pending' | 'accepted' | 'declined'
  timestamp: number     // When request was sent
  message?: string      // Optional message with request
}

interface Friendship {
  userId1: string       // Lexicographically smaller userId
  userId2: string       // Lexicographically larger userId
  createdAt: number     // When friendship was established
  status: 'active' | 'blocked'
}

// Possible friendship statuses we can return
type FriendshipStatus = 'none' | 'pending_sent' | 'pending_received' | 'friends' | 'blocked'

export async function GET(
  request: Request,
  context: { params: Promise<{ userId: string }> }
) {
  try {
    // Extract the userId from URL parameters
    const { userId: targetUserId } = await context.params
    
    // Get current user from Firebase Auth token
    const headersList = await headers()
    const authorization = headersList.get('authorization')
    
    if (!authorization?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const token = authorization.split('Bearer ')[1]
    const decodedToken = await admin.auth().verifyIdToken(token)
    const currentUserId = decodedToken.uid

    // Can't be friends with yourself!
    if (currentUserId === targetUserId) {
      return NextResponse.json({ 
        status: 'none',
        message: 'Cannot befriend yourself' 
      })
    }

    // Step 1: Check for existing friendship
    // We use consistent ordering to avoid duplicate friendship records
    const [userId1, userId2] = [currentUserId, targetUserId].sort()
    
    const friendshipQuery = await firestore
      .collection('friendships')
      .where('userId1', '==', userId1)
      .where('userId2', '==', userId2)
      .where('status', '==', 'active')
      .limit(1)
      .get()

    if (!friendshipQuery.empty) {
      return NextResponse.json({ 
        status: 'friends',
        since: friendshipQuery.docs[0].data().createdAt
      })
    }

    // Step 2: Check for pending friend requests
    // We need to check both directions (sent and received)
    
    // Check if current user sent a request to target user
    const sentRequestQuery = await firestore
      .collection('friendRequests')
      .where('senderId', '==', currentUserId)
      .where('receiverId', '==', targetUserId)
      .where('status', '==', 'pending')
      .limit(1)
      .get()

    if (!sentRequestQuery.empty) {
      return NextResponse.json({ 
        status: 'pending_sent',
        requestId: sentRequestQuery.docs[0].id,
        sentAt: sentRequestQuery.docs[0].data().timestamp
      })
    }

    // Check if target user sent a request to current user
    const receivedRequestQuery = await firestore
      .collection('friendRequests')
      .where('senderId', '==', targetUserId)
      .where('receiverId', '==', currentUserId)
      .where('status', '==', 'pending')
      .limit(1)
      .get()

    if (!receivedRequestQuery.empty) {
      return NextResponse.json({ 
        status: 'pending_received',
        requestId: receivedRequestQuery.docs[0].id,
        receivedAt: receivedRequestQuery.docs[0].data().timestamp
      })
    }

    // No relationship exists
    return NextResponse.json({ status: 'none' })

  } catch (error) {
    console.error('Error checking friendship status:', error)
    return NextResponse.json(
      { error: 'Failed to check friendship status' },
      { status: 500 }
    )
  }
}