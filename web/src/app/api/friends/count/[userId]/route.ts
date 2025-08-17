// src/app/api/friends/count/[userId]/route.ts
// Get friends count for a specific user
// Demonstrates server-side data aggregation and security patterns

import { NextResponse } from 'next/server'
import { firestore } from '@/lib/firebaseAdmin'

export async function GET(
  request: Request,
  context: { params: Promise<{ userId: string }> }
) {
  try {
    // Extract the userId from URL parameters
    const { userId } = await context.params
    
    // Validate userId parameter
    if (!userId) {
      return NextResponse.json(
        { error: 'userId parameter is required' },
        { status: 400 }
      )
    }

    // Server-side queries have admin access and bypass security rules
    // This is why we can query friendships here but not from the client

    // Query friendships where user is userId1 (smaller ID in our consistent ordering)
    const friendshipsQ1 = firestore
      .collection('friendships')
      .where('userId1', '==', userId)
      .where('status', '==', 'active')

    // Query friendships where user is userId2 (larger ID in our consistent ordering)  
    const friendshipsQ2 = firestore
      .collection('friendships')
      .where('userId2', '==', userId)
      .where('status', '==', 'active')

    // Use Promise.all for parallel queries (performance optimization)
    const [friendsSnap1, friendsSnap2] = await Promise.all([
      friendshipsQ1.get(),
      friendshipsQ2.get()
    ])

    // Calculate total friends count
    const friendsCount = friendsSnap1.size + friendsSnap2.size

    // Return structured data with metadata
    return NextResponse.json({
      userId,
      friendsCount,
      timestamp: Date.now()
    })

  } catch (error) {
    console.error('Error fetching friends count:', error)
    return NextResponse.json(
      { error: 'Failed to fetch friends count' },
      { status: 500 }
    )
  }
}