// src/app/api/friends/respond/route.ts
// Accept or decline a friend request


import { NextResponse } from 'next/server'
import admin from 'firebase-admin'
import { firestore } from '@/lib/firebaseAdmin'
import { headers } from 'next/headers'

// Request body interface for responding to friend requests
interface RespondToFriendRequestBody {
  requestId: string                    // ID of the friend request
  action: 'accept' | 'decline'        // What to do with the request
}

export async function POST(request: Request) {
  try {
    // Parse request body
    const body: RespondToFriendRequestBody = await request.json()
    const { requestId, action } = body

    // Validate required fields
    if (!requestId || !action) {
      return NextResponse.json(
        { error: 'requestId and action are required' },
        { status: 400 }
      )
    }

    if (!['accept', 'decline'].includes(action)) {
      return NextResponse.json(
        { error: 'action must be "accept" or "decline"' },
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
    const currentUserId = decodedToken.uid

    // Complex transaction for maintaining data consistency
    // This operation involves multiple collections and must be atomic
    const result = await firestore.runTransaction(async (transaction) => {
      // Step 1: Get the friend request document
      const requestRef = firestore.collection('friendRequests').doc(requestId)
      const requestDoc = await transaction.get(requestRef)

      if (!requestDoc.exists) {
        throw new Error('Friend request not found')
      }

      const requestData = requestDoc.data()!
      
      // Step 2: Validate that current user is the receiver
      if (requestData.receiverId !== currentUserId) {
        throw new Error('You can only respond to requests sent to you')
      }

      // Step 3: Check that request is still pending
      if (requestData.status !== 'pending') {
        throw new Error('This request has already been responded to')
      }

      const timestamp = Date.now()
      const senderId = requestData.senderId

      // Step 3: Get user documents for friend counts (MUST READ BEFORE ANY WRITES)
      const senderRef = firestore.collection('users').doc(senderId)
      const receiverRef = firestore.collection('users').doc(currentUserId)
      const senderDoc = await transaction.get(senderRef)
      const receiverDoc = await transaction.get(receiverRef)

      if (action === 'accept') {
        // Creating a friendship requires careful data handling
        
        // Create consistent friendship record (smaller userId first)
        const [userId1, userId2] = [senderId, currentUserId].sort()
        
        const friendshipRef = firestore.collection('friendships').doc()
        const friendshipData = {
          userId1,
          userId2,
          createdAt: timestamp,
          status: 'active'
        }
        
        transaction.set(friendshipRef, friendshipData)

        // Update friend counts for both users
        // This is critical for maintaining accurate statistics
        const senderFriendsCount = (senderDoc.data()?.friendsCount || 0) + 1
        const receiverFriendsCount = (receiverDoc.data()?.friendsCount || 0) + 1
        
        transaction.update(senderRef, { friendsCount: senderFriendsCount })
        transaction.update(receiverRef, { friendsCount: receiverFriendsCount })

        // Create notification for the sender (request was accepted)
        const notificationRef = firestore.collection('notifications').doc()
        const notificationData = {
          recipientId: senderId,
          senderId: currentUserId,
          type: 'friend_request_accepted',
          title: 'Friend Request Accepted',
          message: `${decodedToken.name || 'Someone'} accepted your friend request`,
          data: {
            friendshipId: friendshipRef.id
          },
          read: false,
          createdAt: timestamp
        }
        
        transaction.set(notificationRef, notificationData)
      }

      // Step 4: Update the friend request status (for both accept and decline)
      transaction.update(requestRef, {
        status: action === 'accept' ? 'accepted' : 'declined',
        respondedAt: timestamp
      })

      return {
        action,
        senderId,
        timestamp,
        senderName: 'User' // We could fetch this if needed
      }
    })

    // Return appropriate success response
    if (action === 'accept') {
      return NextResponse.json({
        success: true,
        message: 'Friend request accepted! You are now friends.',
        friendship: {
          createdAt: result.timestamp,
          friendId: result.senderId
        }
      })
    } else {
      return NextResponse.json({
        success: true,
        message: 'Friend request declined.',
        declined: {
          requestId,
          declinedAt: result.timestamp
        }
      })
    }

  } catch (error) {
    console.error('Error responding to friend request:', error)
    
    // Proper error handling with specific messages
    if (error instanceof Error) {
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      )
    }
    
    return NextResponse.json(
      { error: 'Failed to respond to friend request' },
      { status: 500 }
    )
  }
}