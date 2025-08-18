// src/app/api/friends/request/route.ts
// Send a friend request to another user


import { NextResponse } from 'next/server'
import admin from 'firebase-admin'
import { firestore } from '@/lib/firebaseAdmin'
import { headers } from 'next/headers'

// Request body interface for sending friend requests
interface SendFriendRequestBody {
  receiverId: string    // User to send request to
  message?: string      // Optional message with request
}

export async function POST(request: Request) {
  try {
    // Parse request body
    const body: SendFriendRequestBody = await request.json()
    const { receiverId, message } = body

    // Validate required fields
    if (!receiverId) {
      return NextResponse.json(
        { error: 'receiverId is required' },
        { status: 400 }
      )
    }

    // Get current user from Firebase Auth token
    const headersList = await headers()
    const authorization = headersList.get('authorization')
    
    if (!authorization?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const token = authorization.split('Bearer ')[1]
    const decodedToken = await admin.auth().verifyIdToken(token)
    const senderId = decodedToken.uid

    // Input validation
    if (senderId === receiverId) {
      return NextResponse.json(
        { error: 'Cannot send friend request to yourself' },
        { status: 400 }
      )
    }

    // Check if receiver exists and get their data
    const receiverDoc = await firestore.collection('users').doc(receiverId).get()
    if (!receiverDoc.exists) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      )
    }

    // Check current relationship status first
    // This prevents duplicate requests and provides better error messages
    const [userId1, userId2] = [senderId, receiverId].sort()
    
    // Check if already friends
    const existingFriendship = await firestore
      .collection('friendships')
      .where('userId1', '==', userId1)
      .where('userId2', '==', userId2)
      .where('status', '==', 'active')
      .limit(1)
      .get()

    if (!existingFriendship.empty) {
      return NextResponse.json(
        { error: 'Users are already friends' },
        { status: 400 }
      )
    }

    // Check if request already exists (either direction)
    const existingRequest = await firestore
      .collection('friendRequests')
      .where('senderId', 'in', [senderId, receiverId])
      .where('receiverId', 'in', [senderId, receiverId])
      .where('status', '==', 'pending')
      .limit(1)
      .get()

    if (!existingRequest.empty) {
      const requestData = existingRequest.docs[0].data()
      if (requestData.senderId === senderId) {
        return NextResponse.json(
          { error: 'Friend request already sent' },
          { status: 400 }
        )
      } else {
        return NextResponse.json(
          { error: 'This user has already sent you a friend request' },
          { status: 400 }
        )
      }
    }

    // Using Firestore transactions for data consistency
    // This ensures that all operations succeed or fail together
    const result = await firestore.runTransaction(async (transaction) => {
      const timestamp = Date.now()

      // Create the friend request document
      const requestRef = firestore.collection('friendRequests').doc()
      const requestData = {
        senderId,
        receiverId,
        status: 'pending' as const,
        timestamp,
        ...(message && { message }) // Only include message if provided
      }
      
      transaction.set(requestRef, requestData)

      // Create notification for the receiver
      // This is a side effect that should be part of the same transaction
      const notificationRef = firestore.collection('notifications').doc()
      const notificationData = {
        recipientId: receiverId,
        senderId: senderId,
        type: 'friend_request',
        title: 'New Friend Request',
        message: `You have received a friend request`,
        data: {
          requestId: requestRef.id,
          senderName: decodedToken.name || 'Unknown User'
        },
        read: false,
        createdAt: timestamp
      }
      
      transaction.set(notificationRef, notificationData)

      return {
        requestId: requestRef.id,
        timestamp,
        receiverName: receiverDoc.data()?.username || 'Unknown User'
      }
    })

    // Return success with useful information
    return NextResponse.json({
      success: true,
      message: `Friend request sent to ${result.receiverName}`,
      requestId: result.requestId,
      sentAt: result.timestamp
    })

  } catch (error) {
    console.error('Error sending friend request:', error)
    
    // Specific error handling
    if (error instanceof Error && error.message.includes('auth')) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 })
    }
    
    return NextResponse.json(
      { error: 'Failed to send friend request' },
      { status: 500 }
    )
  }
}