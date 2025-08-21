// src/app/api/groups/public/route.ts
import { NextResponse } from 'next/server'
import admin from 'firebase-admin'
import { firestore } from '@/lib/firebaseAdmin'

if (!admin.apps.length) admin.initializeApp()

export async function GET() {
  try {
    // Get all public groups, ordered by member count (most popular first)
    const snapshot = await firestore
      .collection('groups')
      .where('isPrivate', '==', false)
      .orderBy('memberCount', 'desc')
      .limit(50) // Limit to prevent excessive data transfer
      .get()

    const groups = snapshot.docs.map(doc => {
      const data = doc.data()
      return {
        id: doc.id,
        name: data.name,
        description: data.description || '',
        isPrivate: data.isPrivate,
        ownerId: data.ownerId,
        memberCount: data.memberCount || data.memberIds?.length || 0,
        lastActivity: data.lastActivity || data.createdAt
      }
    })

    return NextResponse.json({ groups })

  } catch (error) {
    console.error('Error fetching public groups:', error)
    
    return NextResponse.json(
      { error: 'Failed to fetch public groups' },
      { status: 500 }
    )
  }
}