// src/app/api/groups/[groupId]/leave/route.ts
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

export async function POST(
  request: Request,
  context: { params: Promise<{ groupId: string }> }
) {
  try {
    const userId = await getUserId()
    const { groupId } = await context.params

    const result = await firestore.runTransaction(async (transaction) => {
      const groupRef = firestore.collection('groups').doc(groupId)
      const groupDoc = await transaction.get(groupRef)
      
      if (!groupDoc.exists) {
        throw new Error('Group not found')
      }

      const groupData = groupDoc.data()!
      
      // Check if user is a member of the group
      if (!groupData.memberIds || !groupData.memberIds.includes(userId)) {
        throw new Error('You are not a member of this group')
      }

      // Owners cannot leave their own group - they must delete it or transfer ownership
      if (groupData.ownerId === userId) {
        throw new Error('Group owners cannot leave. You must delete the group or transfer ownership first.')
      }

      // Remove user from group
      const newMemberIds = groupData.memberIds.filter((id: string) => id !== userId)
      const timestamp = Date.now()

      // Update group data
      transaction.update(groupRef, {
        memberIds: newMemberIds,
        memberCount: newMemberIds.length,
        lastActivity: timestamp
      })

      // Remove member document
      const memberRef = groupRef.collection('members').doc(userId)
      transaction.delete(memberRef)

      // Create notification for group owner
      const notificationRef = firestore.collection('notifications').doc()
      transaction.set(notificationRef, {
        recipientId: groupData.ownerId,
        senderId: userId,
        type: 'group_leave',
        title: 'Member Left Group',
        message: `Someone left your group "${groupData.name}"`,
        data: {
          groupId: groupRef.id,
          groupName: groupData.name
        },
        read: false,
        createdAt: timestamp
      })

      return {
        groupName: groupData.name,
        remainingMembers: newMemberIds.length
      }
    })

    return NextResponse.json({
      success: true,
      message: `You have left "${result.groupName}"`
    })

  } catch (error) {
    console.error('Error leaving group:', error)
    
    if (error instanceof Error) {
      if (error.message.includes('auth')) {
        return NextResponse.json({ error: 'Authentication failed' }, { status: 401 })
      }
      
      if (error.message.includes('Group not found')) {
        return NextResponse.json({ error: error.message }, { status: 404 })
      }
      
      if (error.message.includes('not a member') || error.message.includes('Group owners cannot leave')) {
        return NextResponse.json({ error: error.message }, { status: 400 })
      }
    }
    
    return NextResponse.json(
      { error: 'Failed to leave group' },
      { status: 500 }
    )
  }
}