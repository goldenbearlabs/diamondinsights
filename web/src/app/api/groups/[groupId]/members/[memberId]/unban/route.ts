// src/app/api/groups/[groupId]/members/[memberId]/unban/route.ts
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
  context: { params: Promise<{ groupId: string; memberId: string }> }
) {
  try {
    const userId = await getUserId()
    const { groupId, memberId } = await context.params

    // Run transaction to ensure data consistency
    const result = await firestore.runTransaction(async (transaction) => {
      // Get group document
      const groupRef = firestore.collection('groups').doc(groupId)
      const groupDoc = await transaction.get(groupRef)
      
      if (!groupDoc.exists) {
        throw new Error('Group not found')
      }

      const groupData = groupDoc.data()!
      
      // Check if current user is the group owner
      if (groupData.ownerId !== userId) {
        throw new Error('Only the group owner can unban members')
      }

      // Check if trying to unban themselves (shouldn't happen but safety check)
      if (memberId === userId) {
        throw new Error('Group owners cannot unban themselves')
      }

      // Check if user is actually banned
      const currentBannedUsers = groupData.bannedUsers || []
      if (!currentBannedUsers.includes(memberId)) {
        throw new Error('User is not banned from this group')
      }

      // Remove user from bannedUsers array
      const updatedBannedUsers = currentBannedUsers.filter((id: string) => id !== memberId)
      
      transaction.update(groupRef, {
        bannedUsers: updatedBannedUsers,
        lastActivity: Date.now()
      })

      // Create notification for the unbanned member
      const notificationRef = firestore.collection('notifications').doc()
      transaction.set(notificationRef, {
        recipientId: memberId,
        senderId: userId,
        type: 'unbanned_from_group',
        title: 'Unbanned from Group',
        message: `You have been unbanned from the group "${groupData.name}" and can now rejoin`,
        data: {
          groupId: groupId,
          groupName: groupData.name
        },
        read: false,
        createdAt: Date.now()
      })

      return {
        unbannedUserId: memberId,
        groupName: groupData.name,
        remainingBannedUsers: updatedBannedUsers.length
      }
    })

    return NextResponse.json({
      success: true,
      message: `User has been unbanned and can now rejoin the group`,
      data: result
    })

  } catch (error) {
    console.error('Error unbanning group member:', error)
    
    if (error instanceof Error) {
      if (error.message.includes('auth')) {
        return NextResponse.json({ error: 'Authentication failed' }, { status: 401 })
      }
      
      if (error.message.includes('Group not found')) {
        return NextResponse.json({ error: error.message }, { status: 404 })
      }
      
      if (error.message.includes('Only the group owner') || 
          error.message.includes('Group owners cannot unban themselves')) {
        return NextResponse.json({ error: error.message }, { status: 403 })
      }
      
      if (error.message.includes('not banned')) {
        return NextResponse.json({ error: error.message }, { status: 400 })
      }
    }
    
    return NextResponse.json(
      { error: 'Failed to unban member from group' },
      { status: 500 }
    )
  }
}