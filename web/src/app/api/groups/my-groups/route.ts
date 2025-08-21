// src/app/api/groups/my-groups/route.ts
import { NextResponse } from 'next/server'
import admin from 'firebase-admin'
import { firestore } from '@/lib/firebaseAdmin'
import { headers } from 'next/headers'

if (!admin.apps.length) admin.initializeApp()

async function getUserId() {
  const h = await headers()
  const authHeader = h.get('authorization') || ''
  const match = authHeader.match(/^Bearer (.+)$/)
  if (!match) throw new Error('Missing or malformed Authorization header')
  const token = match[1]
  const decoded = await admin.auth().verifyIdToken(token)
  return decoded.uid
}

export async function GET() {
  try {
    const userId = await getUserId()
    
    // Find all groups where the user is a member
    const groupsSnapshot = await firestore
      .collection('groups')
      .where('memberIds', 'array-contains', userId)
      .orderBy('lastActivity', 'desc')
      .get()

    const groups = groupsSnapshot.docs.map(doc => {
      const data = doc.data()
      return {
        id: doc.id,
        name: data.name,
        description: data.description || '',
        isPrivate: data.isPrivate,
        inviteCode: data.inviteCode,
        ownerId: data.ownerId,
        memberCount: data.memberCount || data.memberIds?.length || 0,
        lastActivity: data.lastActivity || data.createdAt
      }
    })

    return NextResponse.json({ groups })

  } catch (error) {
    console.error('Error fetching user groups:', error)
    
    if (error instanceof Error && error.message.includes('auth')) {
      return NextResponse.json({ error: 'Authentication failed' }, { status: 401 })
    }
    
    return NextResponse.json(
      { error: 'Failed to fetch groups' },
      { status: 500 }
    )
  }
}