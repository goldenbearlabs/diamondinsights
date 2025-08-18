// src/app/api/friends/requests/route.ts
// Get pending friend requests (both incoming and outgoing)
// Demonstrates bidirectional data queries and user profile joining

import { NextResponse } from 'next/server'
import admin from 'firebase-admin'
import { firestore } from '@/lib/firebaseAdmin'
import { headers } from 'next/headers'

// Interface for request data returned to client
interface FriendRequestData {
  requestId: string
  userId: string
  username: string
  profilePic: string
  message?: string
  timestamp: number
  direction: 'incoming' | 'outgoing'
}

export async function GET(request: Request) {
  try {
    // Get current user from Firebase Auth token
    const headersList = await headers()
    const authorization = headersList.get('authorization')
    
    if (!authorization?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const token = authorization.split('Bearer ')[1]
    const decodedToken = await admin.auth().verifyIdToken(token)
    const currentUserId = decodedToken.uid

    // Query pending requests in both directions
    
    // Get incoming requests (sent TO current user)
    const incomingRequestsQuery = firestore
      .collection('friendRequests')
      .where('receiverId', '==', currentUserId)
      .where('status', '==', 'pending')
      .orderBy('timestamp', 'desc')

    // Get outgoing requests (sent BY current user)
    const outgoingRequestsQuery = firestore
      .collection('friendRequests')
      .where('senderId', '==', currentUserId)
      .where('status', '==', 'pending')
      .orderBy('timestamp', 'desc')

    // Execute both queries in parallel
    const [incomingSnap, outgoingSnap] = await Promise.all([
      incomingRequestsQuery.get(),
      outgoingRequestsQuery.get()
    ])

    // Process incoming requests
    const incomingRequests: {
      requestId: string,
      senderId: string,
      message?: string,
      timestamp: number
    }[] = []

    incomingSnap.forEach(doc => {
      const data = doc.data()
      incomingRequests.push({
        requestId: doc.id,
        senderId: data.senderId,
        message: data.message,
        timestamp: data.timestamp
      })
    })

    // Process outgoing requests
    const outgoingRequests: {
      requestId: string,
      receiverId: string,
      message?: string,
      timestamp: number
    }[] = []

    outgoingSnap.forEach(doc => {
      const data = doc.data()
      outgoingRequests.push({
        requestId: doc.id,
        receiverId: data.receiverId,
        message: data.message,
        timestamp: data.timestamp
      })
    })

    // Batch fetch user profiles for all relevant users
    const userIdsToFetch = [
      ...incomingRequests.map(req => req.senderId),
      ...outgoingRequests.map(req => req.receiverId)
    ]

    // Remove duplicates
    const uniqueUserIds = [...new Set(userIdsToFetch)]

    // Batch fetch user profiles
    const userProfilesPromises = uniqueUserIds.map(async (userId) => {
      try {
        const userDoc = await firestore.collection('users').doc(userId).get()
        if (userDoc.exists) {
          const userData = userDoc.data()
          return {
            userId,
            username: userData?.username || 'Unknown User',
            profilePic: userData?.profilePic || ''
          }
        }
        return {
          userId,
          username: 'Unknown User',
          profilePic: ''
        }
      } catch (error) {
        console.error(`Error fetching profile for user ${userId}:`, error)
        return {
          userId,
          username: 'Unknown User',
          profilePic: ''
        }
      }
    })

    const userProfiles = await Promise.all(userProfilesPromises)

    // Create a lookup map for easy profile access
    const profileMap = new Map(
      userProfiles.map(profile => [profile.userId, profile])
    )

    // Combine request data with user profiles
    const incomingWithProfiles: FriendRequestData[] = incomingRequests.map(req => {
      const profile = profileMap.get(req.senderId)
      return {
        requestId: req.requestId,
        userId: req.senderId,
        username: profile?.username || 'Unknown User',
        profilePic: profile?.profilePic || '',
        message: req.message,
        timestamp: req.timestamp,
        direction: 'incoming' as const
      }
    })

    const outgoingWithProfiles: FriendRequestData[] = outgoingRequests.map(req => {
      const profile = profileMap.get(req.receiverId)
      return {
        requestId: req.requestId,
        userId: req.receiverId,
        username: profile?.username || 'Unknown User',
        profilePic: profile?.profilePic || '',
        message: req.message,
        timestamp: req.timestamp,
        direction: 'outgoing' as const
      }
    })

    return NextResponse.json({
      incoming: incomingWithProfiles,
      outgoing: outgoingWithProfiles,
      totalIncoming: incomingWithProfiles.length,
      totalOutgoing: outgoingWithProfiles.length,
      userId: currentUserId
    })

  } catch (error) {
    console.error('Error fetching friend requests:', error)
    
    // Specific error handling
    if (error instanceof Error && error.message.includes('auth')) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 })
    }
    
    return NextResponse.json(
      { error: 'Failed to fetch friend requests' },
      { status: 500 }
    )
  }
}