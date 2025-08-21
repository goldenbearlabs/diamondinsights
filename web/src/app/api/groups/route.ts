// src/app/api/groups/route.ts
import { NextResponse } from 'next/server'
import admin from 'firebase-admin'
import { firestore } from '@/lib/firebaseAdmin'
import { headers } from 'next/headers'

if (!admin.apps.length) admin.initializeApp()

interface CreateGroupBody {
  name: string
  description?: string
  isPrivate: boolean
}

async function getUserId() {
  const h = await headers()
  const authHeader = h.get('authorization') || ''
  const match = authHeader.match(/^Bearer (.+)$/)
  if (!match) throw new Error('Missing or malformed Authorization header')
  const token = match[1]
  const decoded = await admin.auth().verifyIdToken(token)
  return decoded.uid
}

function generateInviteCode(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
  let result = ''
  for (let i = 0; i < 8; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return result
}

export async function POST(request: Request) {
  try {
    const userId = await getUserId()
    const body: CreateGroupBody = await request.json()
    const { name, description, isPrivate } = body

    if (!name || name.trim().length === 0) {
      return NextResponse.json(
        { error: 'Group name is required' },
        { status: 400 }
      )
    }

    if (name.length > 50) {
      return NextResponse.json(
        { error: 'Group name must be 50 characters or less' },
        { status: 400 }
      )
    }

    if (description && description.length > 200) {
      return NextResponse.json(
        { error: 'Description must be 200 characters or less' },
        { status: 400 }
      )
    }

    const result = await firestore.runTransaction(async (transaction) => {
      let inviteCode = ''
      let codeExists = true
      
      // Generate unique invite code for private groups
      if (isPrivate) {
        while (codeExists) {
          inviteCode = generateInviteCode()
          const existingGroup = await firestore
            .collection('groups')
            .where('inviteCode', '==', inviteCode)
            .limit(1)
            .get()
          codeExists = !existingGroup.empty
        }
      }

      const timestamp = Date.now()
      const groupRef = firestore.collection('groups').doc()
      
      const groupData = {
        name: name.trim(),
        description: description?.trim() || '',
        isPrivate,
        inviteCode,
        ownerId: userId,
        createdAt: timestamp,
        lastActivity: timestamp,
        memberIds: [userId],
        memberCount: 1
      }

      transaction.set(groupRef, groupData)

      // Add owner as first member
      const memberRef = groupRef.collection('members').doc(userId)
      transaction.set(memberRef, {
        userId,
        joinedAt: timestamp,
        role: 'owner'
      })

      return {
        groupId: groupRef.id,
        inviteCode,
        timestamp
      }
    })

    return NextResponse.json({
      success: true,
      groupId: result.groupId,
      inviteCode: result.inviteCode,
      message: 'Group created successfully'
    }, { status: 201 })

  } catch (error) {
    console.error('Error creating group:', error)
    
    if (error instanceof Error && error.message.includes('auth')) {
      return NextResponse.json({ error: 'Authentication failed' }, { status: 401 })
    }
    
    return NextResponse.json(
      { error: 'Failed to create group' },
      { status: 500 }
    )
  }
}

export async function GET() {
  try {
    const userId = await getUserId()
    
    // Get all groups (admin functionality - could be restricted later)
    const snapshot = await firestore
      .collection('groups')
      .orderBy('createdAt', 'desc')
      .get()

    const groups = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }))

    return NextResponse.json({ groups })

  } catch (error) {
    console.error('Error fetching groups:', error)
    
    if (error instanceof Error && error.message.includes('auth')) {
      return NextResponse.json({ error: 'Authentication failed' }, { status: 401 })
    }
    
    return NextResponse.json(
      { error: 'Failed to fetch groups' },
      { status: 500 }
    )
  }
}