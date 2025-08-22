// src/app/api/groups/[groupId]/members/[memberId]/route.ts
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

export async function DELETE(
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
        throw new Error('Only the group owner can remove members')
      }

      // Check if trying to remove themselves
      if (memberId === userId) {
        throw new Error('Group owners cannot remove themselves')
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
      
      // Cannot remove other owners (though there should only be one)
      if (memberData.role === 'owner') {
        throw new Error('Cannot remove group owners')
      }

      // Remove member from members subcollection
      transaction.delete(memberRef)

      // Update group memberIds and memberCount
      const updatedMemberIds = (groupData.memberIds || []).filter((id: string) => id !== memberId)
      transaction.update(groupRef, {
        memberIds: updatedMemberIds,
        memberCount: updatedMemberIds.length,
        lastActivity: Date.now()
      })

      // Create notification for the removed member
      const notificationRef = firestore.collection('notifications').doc()
      transaction.set(notificationRef, {
        recipientId: memberId,
        senderId: userId,
        type: 'removed_from_group',
        title: 'Removed from Group',
        message: `You have been removed from the group "${groupData.name}"`,
        data: {
          groupId: groupId,
          groupName: groupData.name
        },
        read: false,
        createdAt: Date.now()
      })

      return {
        removedUserId: memberId,
        groupName: groupData.name,
        newMemberCount: updatedMemberIds.length
      }
    })

    return NextResponse.json({
      success: true,
      message: `Member removed from group successfully`,
      data: result
    })

  } catch (error) {
    console.error('Error removing group member:', error)
    
    if (error instanceof Error) {
      if (error.message.includes('auth')) {
        return NextResponse.json({ error: 'Authentication failed' }, { status: 401 })
      }
      
      if (error.message.includes('Group not found')) {
        return NextResponse.json({ error: error.message }, { status: 404 })
      }
      
      if (error.message.includes('Only the group owner') || 
          error.message.includes('Cannot remove') ||
          error.message.includes('Group owners cannot remove themselves')) {
        return NextResponse.json({ error: error.message }, { status: 403 })
      }
      
      if (error.message.includes('Member not found')) {
        return NextResponse.json({ error: error.message }, { status: 404 })
      }
    }
    
    return NextResponse.json(
      { error: 'Failed to remove member from group' },
      { status: 500 }
    )
  }
}