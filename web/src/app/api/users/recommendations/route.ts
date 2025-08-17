// src/app/api/users/recommendations/route.ts
// Get random user recommendations for friend suggestions
// Demonstrates server-side user filtering and randomization

import { NextResponse } from 'next/server'
import admin from 'firebase-admin'
import { firestore } from '@/lib/firebaseAdmin'
import { headers } from 'next/headers'

// Interface for recommended user data
interface RecommendedUser {
  userId: string
  username: string
  profilePic: string
  joinedDate: number
  friendsCount?: number
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

    // Educational: Get users to exclude (current user + existing friends + pending requests)
    
    // Get current user's existing friends
    const friendsQuery1 = firestore
      .collection('friendships')
      .where('userId1', '==', currentUserId)
      .where('status', '==', 'active')

    const friendsQuery2 = firestore
      .collection('friendships')
      .where('userId2', '==', currentUserId)
      .where('status', '==', 'active')

    // Get pending friend requests (both directions)
    const pendingQuery1 = firestore
      .collection('friendRequests')
      .where('senderId', '==', currentUserId)
      .where('status', '==', 'pending')

    const pendingQuery2 = firestore
      .collection('friendRequests')
      .where('receiverId', '==', currentUserId)
      .where('status', '==', 'pending')

    // Execute all exclusion queries in parallel
    const [friendsSnap1, friendsSnap2, pendingSnap1, pendingSnap2] = await Promise.all([
      friendsQuery1.get(),
      friendsQuery2.get(),
      pendingQuery1.get(),
      pendingQuery2.get()
    ])

    // Collect user IDs to exclude
    const excludeUserIds = new Set<string>([currentUserId])

    // Add existing friends
    friendsSnap1.forEach(doc => excludeUserIds.add(doc.data().userId2))
    friendsSnap2.forEach(doc => excludeUserIds.add(doc.data().userId1))

    // Add users with pending requests
    pendingSnap1.forEach(doc => excludeUserIds.add(doc.data().receiverId))
    pendingSnap2.forEach(doc => excludeUserIds.add(doc.data().senderId))

    // Educational: Get all users and filter randomly
    // Note: In a large production app, you'd want to implement proper pagination
    // and server-side randomization for better performance
    
    const usersSnapshot = await firestore
      .collection('users')
      .limit(100) // Limit to avoid too much data transfer
      .get()

    const availableUsers: RecommendedUser[] = []

    usersSnapshot.forEach(doc => {
      const userData = doc.data()
      const userId = doc.id

      // Skip excluded users
      if (excludeUserIds.has(userId)) {
        return
      }

      // Skip users without proper profile data
      if (!userData.username) {
        return
      }

      availableUsers.push({
        userId,
        username: userData.username,
        profilePic: userData.profilePic || '',
        joinedDate: userData.createdAt?.seconds ? userData.createdAt.seconds * 1000 : Date.now(),
        friendsCount: userData.friendsCount || 0
      })
    })

    // Educational: Randomize and select 15 users
    // Fisher-Yates shuffle algorithm for true randomization
    for (let i = availableUsers.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [availableUsers[i], availableUsers[j]] = [availableUsers[j], availableUsers[i]]
    }

    // Take first 15 users from shuffled array
    const recommendations = availableUsers.slice(0, 15)

    return NextResponse.json({
      recommendations,
      totalAvailable: availableUsers.length,
      excludedCount: excludeUserIds.size,
      timestamp: Date.now()
    })

  } catch (error) {
    console.error('Error getting user recommendations:', error)
    
    // Educational: Specific error handling
    if (error instanceof admin.auth.DecodedIdToken) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 })
    }
    
    return NextResponse.json(
      { error: 'Failed to get user recommendations' },
      { status: 500 }
    )
  }
}