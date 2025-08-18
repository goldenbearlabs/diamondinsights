// src/app/api/friends/list/[userId]/route.ts
// Get a user's friends list with profile data
// Demonstrates server-side data aggregation and joining collections

import { NextResponse } from 'next/server'
import admin from 'firebase-admin'
import { firestore } from '@/lib/firebaseAdmin'
import { headers } from 'next/headers'

// Interface for friend data returned to client
interface FriendData {
  userId: string
  username: string
  profilePic: string
  friendsSince: number
  isOnline?: boolean  // Future feature for real time status
}

export async function GET(
  request: Request,
  context: { params: Promise<{ userId: string }> }
) {
  try {
    // Extract the userId from URL parameters
    const { userId } = await context.params
    
    // Get current user from Firebase Auth token for security
    const headersList = await headers()
    const authorization = headersList.get('authorization')
    
    if (!authorization?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const token = authorization.split('Bearer ')[1]
    const decodedToken = await admin.auth().verifyIdToken(token)
    const currentUserId = decodedToken.uid

    // Security: Users can only view their own friends list for now
    // Later we might allow viewing friends' friend lists if both users agree
    if (currentUserId !== userId) {
      return NextResponse.json({ 
        error: 'You can only view your own friends list' 
      }, { status: 403 })
    }

    // Query friendships in both directions since we use consistent ordering
    // Remember: friendship documents have userId1 < userId2 lexicographically
    
    // Query where current user is userId1 (smaller ID)
    const friendshipsQuery1 = firestore
      .collection('friendships')
      .where('userId1', '==', userId)
      .where('status', '==', 'active')

    // Query where current user is userId2 (larger ID)  
    const friendshipsQuery2 = firestore
      .collection('friendships')
      .where('userId2', '==', userId)
      .where('status', '==', 'active')

    // Execute both queries in parallel for performance
    const [friendsSnap1, friendsSnap2] = await Promise.all([
      friendshipsQuery1.get(),
      friendshipsQuery2.get()
    ])

    // Collect all friend user IDs and friendship timestamps
    const friendsData: { friendId: string, friendsSince: number }[] = []

    // Process friendships where current user is userId1
    friendsSnap1.forEach(doc => {
      const data = doc.data()
      friendsData.push({
        friendId: data.userId2, // The other user is userId2
        friendsSince: data.createdAt
      })
    })

    // Process friendships where current user is userId2
    friendsSnap2.forEach(doc => {
      const data = doc.data()
      friendsData.push({
        friendId: data.userId1, // The other user is userId1
        friendsSince: data.createdAt
      })
    })

    // If no friends, return empty array
    if (friendsData.length === 0) {
      return NextResponse.json({
        friends: [],
        totalCount: 0
      })
    }

    // Batch fetch friend profile data
    // Get all friend user IDs for profile lookup
    const friendIds = friendsData.map(f => f.friendId)
    
    // Batch get user profiles - more efficient than individual queries
    const userProfilesPromises = friendIds.map(async (friendId) => {
      try {
        const userDoc = await firestore.collection('users').doc(friendId).get()
        if (userDoc.exists) {
          const userData = userDoc.data()
          return {
            userId: friendId,
            username: userData?.username || 'Unknown User',
            profilePic: userData?.profilePic || '',
            email: userData?.email || '' // We won't return email, just for internal use
          }
        }
        return null
      } catch (error) {
        console.error(`Error fetching profile for user ${friendId}:`, error)
        return null
      }
    })

    const userProfiles = await Promise.all(userProfilesPromises)

    // Combine friendship data with profile data
    const friendsWithProfiles: FriendData[] = friendsData
      .map(friendshipData => {
        const profile = userProfiles.find(p => p && p.userId === friendshipData.friendId)
        
        if (!profile) {
          // Handle case where user profile wasn't found
          return {
            userId: friendshipData.friendId,
            username: 'Unknown User',
            profilePic: '',
            friendsSince: friendshipData.friendsSince,
            isOnline: false
          }
        }

        return {
          userId: profile.userId,
          username: profile.username,
          profilePic: profile.profilePic,
          friendsSince: friendshipData.friendsSince,
          isOnline: false // TODO: Implement real-time online status
        }
      })
      .filter(friend => friend !== null) // Remove any null entries
      .sort((a, b) => a.username.localeCompare(b.username)) // Sort alphabetically

    return NextResponse.json({
      friends: friendsWithProfiles,
      totalCount: friendsWithProfiles.length,
      userId: userId
    })

  } catch (error) {
    console.error('Error fetching friends list:', error)
    
    // Specific error handling
    if (error instanceof Error && error.message.includes('auth')) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 })
    }
    
    return NextResponse.json(
      { error: 'Failed to fetch friends list' },
      { status: 500 }
    )
  }
}