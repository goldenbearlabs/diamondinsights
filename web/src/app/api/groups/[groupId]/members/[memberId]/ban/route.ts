// src/app/api/groups/[groupId]/members/[memberId]/ban/route.ts
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
        throw new Error('Only the group owner can ban members')
      }

      // Check if trying to ban themselves
      if (memberId === userId) {
        throw new Error('Group owners cannot ban themselves')
      }

      // Check if member exists in group
      const memberRef = firestore
        .collection('groups')
        .doc(groupId)
        .collection('members')
        .doc(memberId)
      const memberDoc = await transaction.get(memberRef)

      if (!memberDoc.exists) {
        throw new Error('Member not found in group')
      }

      const memberData = memberDoc.data()!
      
      // Cannot ban other owners (though there should only be one)
      if (memberData.role === 'owner') {
        throw new Error('Cannot ban group owners')
      }

      // Check if user is already banned
      const currentBannedUsers = groupData.bannedUsers || []
      if (currentBannedUsers.includes(memberId)) {
        throw new Error('User is already banned from this group')
      }

      // Remove member from members subcollection
      transaction.delete(memberRef)

      // Update group: remove from memberIds, add to bannedUsers, update counts
      const updatedMemberIds = (groupData.memberIds || []).filter((id: string) => id !== memberId)
      const updatedBannedUsers = [...currentBannedUsers, memberId]
      
      transaction.update(groupRef, {
        memberIds: updatedMemberIds,
        bannedUsers: updatedBannedUsers,
        memberCount: updatedMemberIds.length,
        lastActivity: Date.now()
      })

      // Create notification for the banned member
      const notificationRef = firestore.collection('notifications').doc()
      transaction.set(notificationRef, {
        recipientId: memberId,
        senderId: userId,
        type: 'banned_from_group',
        title: 'Banned from Group',
        message: `You have been banned from the group "${groupData.name}" and cannot rejoin`,
        data: {
          groupId: groupId,
          groupName: groupData.name
        },
        read: false,
        createdAt: Date.now()
      })

      return {
        bannedUserId: memberId,
        groupName: groupData.name,
        newMemberCount: updatedMemberIds.length,
        totalBannedUsers: updatedBannedUsers.length
      }
    })

    return NextResponse.json({
      success: true,
      message: `Member has been banned from the group and cannot rejoin`,
      data: result
    })

  } catch (error) {
    console.error('Error banning group member:', error)
    
    if (error instanceof Error) {
      if (error.message.includes('auth')) {
        return NextResponse.json({ error: 'Authentication failed' }, { status: 401 })
      }
      
      if (error.message.includes('Group not found')) {
        return NextResponse.json({ error: error.message }, { status: 404 })
      }
      
      if (error.message.includes('Only the group owner') || 
          error.message.includes('Cannot ban') ||
          error.message.includes('Group owners cannot ban themselves')) {
        return NextResponse.json({ error: error.message }, { status: 403 })
      }
      
      if (error.message.includes('Member not found') || 
          error.message.includes('already banned')) {
        return NextResponse.json({ error: error.message }, { status: 400 })
      }
    }
    
    return NextResponse.json(
      { error: 'Failed to ban member from group' },
      { status: 500 }
    )
  }
}