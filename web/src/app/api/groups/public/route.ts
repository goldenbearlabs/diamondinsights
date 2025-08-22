// src/app/api/groups/public/route.ts
import { NextResponse } from 'next/server'
import admin from 'firebase-admin'
import { firestore } from '@/lib/firebaseAdmin'
import { headers } from 'next/headers'

if (!admin.apps.length) admin.initializeApp()

async function getUserId() {
  try {
    const h = await headers()
    const authHeader = h.get('authorization') || ''
    const match = authHeader.match(/^Bearer (.+)$/)
    if (!match) return null
    const token = match[1]
    const decoded = await admin.auth().verifyIdToken(token)
    return decoded.uid
  } catch {
    return null
  }
}

export async function GET() {
  try {
    const userId = await getUserId()

    // Get all public groups, ordered by member count (most popular first)
    const snapshot = await firestore
      .collection('groups')
      .where('isPrivate', '==', false)
      .orderBy('memberCount', 'desc')
      .limit(50) // Limit to prevent excessive data transfer
      .get()

    const groups = await Promise.all(snapshot.docs.map(async doc => {
      const data = doc.data()
      
      // Check if user is a member (if user is authenticated)
      let userIsMember = false
      if (userId) {
        const memberDoc = await firestore
          .collection('groups')
          .doc(doc.id)
          .collection('members')
          .doc(userId)
          .get()
        userIsMember = memberDoc.exists
      }

      return {
        id: doc.id,
        name: data.name,
        description: data.description || '',
        isPrivate: data.isPrivate,
        ownerId: data.ownerId,
        memberCount: data.memberCount || data.memberIds?.length || 0,
        lastActivity: data.lastActivity || data.createdAt,
        userIsMember: userIsMember,
        userIsOwner: userId === data.ownerId
      }
    }))

    return NextResponse.json({ groups })

  } catch (error) {
    console.error('Error fetching public groups:', error)
    
    return NextResponse.json(
      { error: 'Failed to fetch public groups' },
      { status: 500 }
    )
  }
}