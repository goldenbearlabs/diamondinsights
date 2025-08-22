// src/app/api/groups/join/route.ts
import { NextResponse } from 'next/server'
import admin from 'firebase-admin'
import { firestore } from '@/lib/firebaseAdmin'
import { headers } from 'next/headers'

if (!admin.apps.length) admin.initializeApp()

interface JoinGroupBody {
  groupId?: string
  inviteCode?: string
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

export async function POST(request: Request) {
  try {
    const userId = await getUserId()
    const body: JoinGroupBody = await request.json()
    const { groupId, inviteCode } = body

    if (!groupId && !inviteCode) {
      return NextResponse.json(
        { error: 'Either groupId or inviteCode is required' },
        { status: 400 }
      )
    }

    const result = await firestore.runTransaction(async (transaction) => {
      let groupRef
      let groupDoc

      if (groupId) {
        // Join by group ID (public groups)
        groupRef = firestore.collection('groups').doc(groupId)
        groupDoc = await transaction.get(groupRef)
        
        if (!groupDoc.exists) {
          throw new Error('Group not found')
        }

        const groupData = groupDoc.data()!
        if (groupData.isPrivate) {
          throw new Error('Cannot join private group without invite code')
        }
      } else {
        // Join by invite code (private groups)
        const groupQuery = await firestore
          .collection('groups')
          .where('inviteCode', '==', inviteCode)
          .limit(1)
          .get()

        if (groupQuery.empty) {
          throw new Error('Invalid invite code')
        }

        groupRef = groupQuery.docs[0].ref
        groupDoc = groupQuery.docs[0]
      }

      const groupData = groupDoc.data()!

      // Check if user is already a member
      if (groupData.memberIds && groupData.memberIds.includes(userId)) {
        throw new Error('You are already a member of this group')
      }

      // Check if user is banned from this group
      if (groupData.bannedUsers && groupData.bannedUsers.includes(userId)) {
        throw new Error('You are banned from this group and cannot join')
      }

      const timestamp = Date.now()

      // Add user to group members
      const memberRef = groupRef.collection('members').doc(userId)
      transaction.set(memberRef, {
        userId,
        joinedAt: timestamp,
        role: 'member'
      })

      // Update group data
      const newMemberIds = [...(groupData.memberIds || []), userId]
      transaction.update(groupRef, {
        memberIds: newMemberIds,
        memberCount: newMemberIds.length,
        lastActivity: timestamp
      })

      // Create notification for group owner
      const notificationRef = firestore.collection('notifications').doc()
      transaction.set(notificationRef, {
        recipientId: groupData.ownerId,
        senderId: userId,
        type: 'group_join',
        title: 'New Group Member',
        message: `Someone joined your group "${groupData.name}"`,
        data: {
          groupId: groupRef.id,
          groupName: groupData.name
        },
        read: false,
        createdAt: timestamp
      })

      return {
        groupId: groupRef.id,
        groupName: groupData.name
      }
    })

    return NextResponse.json({
      success: true,
      message: `Successfully joined "${result.groupName}"`,
      groupId: result.groupId
    })

  } catch (error) {
    console.error('Error joining group:', error)
    
    if (error instanceof Error) {
      if (error.message.includes('auth')) {
        return NextResponse.json({ error: 'Authentication failed' }, { status: 401 })
      }
      
      if (error.message.includes('Group not found') || error.message.includes('Invalid invite code')) {
        return NextResponse.json({ error: error.message }, { status: 404 })
      }
      
      if (error.message.includes('already a member') || 
          error.message.includes('Cannot join private group') ||
          error.message.includes('banned from this group')) {
        return NextResponse.json({ error: error.message }, { status: 403 })
      }
    }
    
    return NextResponse.json(
      { error: 'Failed to join group' },
      { status: 500 }
    )
  }
}