// src/app/api/users/search/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { firestore } from '@/lib/firebaseAdmin'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const q = searchParams.get('q')?.trim().toLowerCase()
    
    if (!q || q.length < 2) {
      return NextResponse.json([])
    }

    // Query users collection for username matches using Admin SDK
    // Temporarily simplified for debugging
    const snapshot = await firestore
      .collection('users')
      .limit(50) // Get more users to search through
      .get()

    console.log(`Found ${snapshot.docs.length} total users in database`)

    const users: Array<{uid: string, username: string, profilePic: string}> = []

    snapshot.docs.forEach(doc => {
      const data = doc.data()
      const username = data.username?.toLowerCase() || ''
      
      console.log(`User ${doc.id}: username="${data.username}", searchable=${data.searchable}`)
      
      // For debugging: include users even if searchable field is missing
      const isSearchable = data.searchable !== false // Default to true if undefined
      
      // Filter client-side for contains match (Firestore doesn't support it directly)
      if (isSearchable && username.includes(q)) {
        console.log(`Match found: ${data.username}`)
        users.push({
          uid: doc.id,
          username: data.username || doc.id,
          profilePic: data.profilePic || ''
        })
      }
    })

    console.log(`Returning ${users.length} users for query "${q}"`)

    // Sort by relevance (exact matches first, then contains)
    users.sort((a, b) => {
      const aExact = a.username.toLowerCase().startsWith(q)
      const bExact = b.username.toLowerCase().startsWith(q)
      
      if (aExact && !bExact) return -1
      if (!aExact && bExact) return 1
      return a.username.localeCompare(b.username)
    })

    return NextResponse.json(users.slice(0, 5))
  } catch (error) {
    console.error('User search error:', error)
    return NextResponse.json({ error: 'Search failed' }, { status: 500 })
  }
}