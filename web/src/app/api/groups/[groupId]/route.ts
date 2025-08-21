// src/app/api/groups/[groupId]/route.ts
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

export async function GET(
  request: Request,
  context: { params: Promise<{ groupId: string }> }
) {
  try {
    const userId = await getUserId()
    const { groupId } = await context.params

    const groupDoc = await firestore.collection('groups').doc(groupId).get()
    
    if (!groupDoc.exists) {
      return NextResponse.json(
        { error: 'Group not found' },
        { status: 404 }
      )
    }

    const groupData = groupDoc.data()!
    
    // Check if user is a member of the group
    if (!groupData.memberIds || !groupData.memberIds.includes(userId)) {
      return NextResponse.json(
        { error: 'You are not a member of this group' },
        { status: 403 }
      )
    }

    // Get member details from subcollection
    const membersSnapshot = await firestore
      .collection('groups')
      .doc(groupId)
      .collection('members')
      .get()

    // Get basic member data (role, joinedAt)
    const memberData = membersSnapshot.docs.map(doc => ({
      userId: doc.id,
      ...doc.data()
    }))

    // Fetch complete user profiles for all members
    const userIds = memberData.map(member => member.userId)
    const userProfiles = await Promise.all(
      userIds.map(uid => firestore.collection('users').doc(uid).get())
    )

    // Merge member data with user profiles
    const members = memberData.map(member => {
      const userProfile = userProfiles.find(profile => profile.id === member.userId)
      const userData = userProfile?.exists ? userProfile.data() : null
      
      return {
        userId: member.userId,
        username: userData?.username || 'Unknown',
        profilePic: userData?.profilePic || '/default_profile.jpg',
        role: member.role,
        joinedAt: member.joinedAt
      }
    })

    return NextResponse.json({
      id: groupDoc.id,
      ...groupData,
      members
    })

  } catch (error) {
    console.error('Error fetching group:', error)
    
    if (error instanceof Error && error.message.includes('auth')) {
      return NextResponse.json({ error: 'Authentication failed' }, { status: 401 })
    }
    
    return NextResponse.json(
      { error: 'Failed to fetch group' },
      { status: 500 }
    )
  }
}

export async function PUT(
  request: Request,
  context: { params: Promise<{ groupId: string }> }
) {
  try {
    const userId = await getUserId()
    const { groupId } = await context.params

    const groupDoc = await firestore.collection('groups').doc(groupId).get()
    
    if (!groupDoc.exists) {
      return NextResponse.json(
        { error: 'Group not found' },
        { status: 404 }
      )
    }

    const groupData = groupDoc.data()!
    
    // Check if user is the group owner
    if (groupData.ownerId !== userId) {
      return NextResponse.json(
        { error: 'Only the group owner can update settings' },
        { status: 403 }
      )
    }

    const { description, isPrivate } = await request.json()

    // Validate description length
    if (description && description.length > 200) {
      return NextResponse.json(
        { error: 'Description must be 200 characters or less' },
        { status: 400 }
      )
    }

    const updateData: any = {
      description: description || '',
      isPrivate: Boolean(isPrivate),
      lastActivity: Date.now()
    }

    // If changing from public to private, generate invite code if not exists
    if (isPrivate && !groupData.isPrivate && !groupData.inviteCode) {
      function generateInviteCode(): string {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
        let result = ''
        for (let i = 0; i < 8; i++) {
          result += chars.charAt(Math.floor(Math.random() * chars.length))
        }
        return result
      }

      let inviteCode = ''
      let codeExists = true
      
      // Generate unique invite code
      while (codeExists) {
        inviteCode = generateInviteCode()
        const existingGroup = await firestore
          .collection('groups')
          .where('inviteCode', '==', inviteCode)
          .limit(1)
          .get()
        codeExists = !existingGroup.empty
      }

      updateData.inviteCode = inviteCode
    }

    // Update the group
    await firestore.collection('groups').doc(groupId).update(updateData)

    // Get the updated group data to return
    const updatedGroupDoc = await firestore.collection('groups').doc(groupId).get()
    const updatedGroupData = updatedGroupDoc.data()

    return NextResponse.json({ 
      success: true,
      group: {
        id: updatedGroupDoc.id,
        ...updatedGroupData
      }
    }, { status: 200 })

  } catch (error) {
    console.error('Error updating group:', error)
    
    if (error instanceof Error && error.message.includes('auth')) {
      return NextResponse.json({ error: 'Authentication failed' }, { status: 401 })
    }
    
    return NextResponse.json(
      { error: 'Failed to update group' },
      { status: 500 }
    )
  }
}

export async function DELETE(
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
      
      // Only the owner can delete the group
      if (groupData.ownerId !== userId) {
        throw new Error('Only the group owner can delete the group')
      }

      // Get all members to notify them
      const membersSnapshot = await firestore
        .collection('groups')
        .doc(groupId)
        .collection('members')
        .get()

      const memberIds = membersSnapshot.docs
        .map(doc => doc.id)
        .filter(id => id !== userId) // Exclude owner from notifications

      // Delete the group
      transaction.delete(groupRef)

      // Delete all member subcollections
      membersSnapshot.docs.forEach(memberDoc => {
        transaction.delete(memberDoc.ref)
      })

      // Create notifications for all members
      const timestamp = Date.now()
      memberIds.forEach(memberId => {
        const notificationRef = firestore.collection('notifications').doc()
        transaction.set(notificationRef, {
          recipientId: memberId,
          senderId: userId,
          type: 'group_deleted',
          title: 'Group Deleted',
          message: `The group "${groupData.name}" has been deleted`,
          data: {
            groupName: groupData.name
          },
          read: false,
          createdAt: timestamp
        })
      })

      return {
        groupName: groupData.name,
        memberCount: memberIds.length
      }
    })

    return NextResponse.json({
      success: true,
      message: `Group "${result.groupName}" has been deleted`
    })

  } catch (error) {
    console.error('Error deleting group:', error)
    
    if (error instanceof Error) {
      if (error.message.includes('auth')) {
        return NextResponse.json({ error: 'Authentication failed' }, { status: 401 })
      }
      
      if (error.message.includes('Group not found')) {
        return NextResponse.json({ error: error.message }, { status: 404 })
      }
      
      if (error.message.includes('Only the group owner')) {
        return NextResponse.json({ error: error.message }, { status: 403 })
      }
    }
    
    return NextResponse.json(
      { error: 'Failed to delete group' },
      { status: 500 }
    )
  }
}