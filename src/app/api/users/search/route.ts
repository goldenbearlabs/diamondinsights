// src/app/api/users/search/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { firestore } from '@/lib/firebaseAdmin'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const q = searchParams.get('q')?.trim()
    
    if (!q || q.length < 2) {
      return NextResponse.json([])
    }

    const queryLower = q.toLowerCase()
    const users: Array<{uid: string, username: string, profilePic: string}> = []

    // Get ALL users from the database (no limits, no complex queries)
    const allUsersSnapshot = await firestore
      .collection('users')
      .get()

    // Filter and search through all users on the server side
    allUsersSnapshot.docs.forEach(doc => {
      const data = doc.data()
      const username = data.username
      
      // Skip users without usernames
      if (!username) return
      
      const usernameLower = username.toLowerCase()
      
      // Check if username contains the query (supports partial matching)
      if (usernameLower.includes(queryLower)) {
        users.push({
          uid: doc.id,
          username: username,
          profilePic: data.profilePic || '/default_profile.jpg'
        })
      }
    })

    // Sort by relevance (exact matches first, then startsWith, then contains)
    users.sort((a, b) => {
      const aLower = a.username.toLowerCase()
      const bLower = b.username.toLowerCase()
      
      const aExact = aLower === queryLower
      const bExact = bLower === queryLower
      const aStarts = aLower.startsWith(queryLower)
      const bStarts = bLower.startsWith(queryLower)
      
      if (aExact && !bExact) return -1
      if (!aExact && bExact) return 1
      if (aStarts && !bStarts) return -1
      if (!aStarts && bStarts) return 1
      return a.username.localeCompare(b.username)
    })

    // Return top 10 results to keep response manageable
    return NextResponse.json(users.slice(0, 10))
  } catch (error) {
    console.error('User search error:', error)
    return NextResponse.json({ error: 'Search failed' }, { status: 500 })
  }
}