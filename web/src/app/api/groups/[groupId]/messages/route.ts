// src/app/api/groups/[groupId]/messages/route.ts
import { NextResponse } from 'next/server'
import admin from 'firebase-admin'
import { firestore } from '@/lib/firebaseAdmin'
import { headers } from 'next/headers'

if (!admin.apps.length) admin.initializeApp()

interface ChatMessageData {
  userId: string
  text: string
  parentId: string | null
  timestamp: number
  likedBy: string[]
  editedAt?: number
  editHistory?: {text: string; editedAt: number}[]
}

interface UserData {
  username: string
  profilePic: string
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

async function verifyGroupMembership(groupId: string, userId: string) {
  const groupDoc = await firestore.collection('groups').doc(groupId).get()
  
  if (!groupDoc.exists) {
    throw new Error('Group not found')
  }
  
  const groupData = groupDoc.data()!
  if (!groupData.memberIds || !groupData.memberIds.includes(userId)) {
    throw new Error('You are not a member of this group')
  }
  
  return groupData
}

// simple word‐blocker
const BLACKLIST = [
  'nigger','nigga','faggot','fag','retard',
  'kike','chink','spic','dyke','tranny',
  'slut','whore','bitch','asshole'
]

function censor(text: string): string {
  return text
    .split(/\b/)
    .map(tok =>
      BLACKLIST.includes(tok.toLowerCase()) ? '****' : tok
    )
    .join('')
}

export async function GET(
  request: Request,
  context: { params: Promise<{ groupId: string }> }
) {
  try {
    const userId = await getUserId()
    const { groupId } = await context.params
    
    // Verify user is a group member
    await verifyGroupMembership(groupId, userId)
    
    // Get messages from group chat collection
    const messagesSnapshot = await firestore
      .collection(`chat_group_${groupId}`)
      .orderBy('timestamp', 'desc')
      .limit(200)
      .get()
    
    const raw = messagesSnapshot.docs.map(d => {
      const data = d.data() as ChatMessageData
      return {
        id: d.id,
        ...data,
        likedBy: data.likedBy || [] as string[]
      }
    })
    
    // Get unique user IDs for profile lookup
    const uids = Array.from(new Set(raw.map(m => m.userId)))
    const userDocs = await Promise.all(
      uids.map(uid => firestore.collection('users').doc(uid).get())
    )
    
    const userMap = userDocs.reduce<Record<string,{username:string,profilePic:string}>>((m,u)=>{
      if (u.exists) {
        const d = u.data() as UserData
        m[u.id] = {
          username: d.username || 'Unknown',
          profilePic: d.profilePic || '/default_profile.jpg'
        }
      }
      return m
    }, {})
    
    // Build response with user data
    const messages = raw.map(m => ({
      id: m.id,
      parentId: m.parentId || null,
      userId: m.userId,
      username: userMap[m.userId]?.username || 'Unknown',
      profilePicUrl: userMap[m.userId]?.profilePic || '/default_profile.jpg',
      text: m.text,
      timestamp: m.timestamp,
      likes: m.likedBy.length,
      liked: m.likedBy.includes(userId),
      editedAt: m.editedAt,
      editHistory: m.editHistory
    }))
    
    return NextResponse.json({ messages })
    
  } catch (error) {
    console.error('Error fetching group messages:', error)
    
    if (error instanceof Error) {
      if (error.message.includes('auth')) {
        return NextResponse.json({ error: 'Authentication failed' }, { status: 401 })
      }
      
      if (error.message.includes('Group not found')) {
        return NextResponse.json({ error: error.message }, { status: 404 })
      }
      
      if (error.message.includes('not a member')) {
        return NextResponse.json({ error: error.message }, { status: 403 })
      }
    }
    
    return NextResponse.json(
      { error: 'Failed to fetch messages' },
      { status: 500 }
    )
  }
}

export async function POST(
  request: Request,
  context: { params: Promise<{ groupId: string }> }
) {
  try {
    const userId = await getUserId()
    const { groupId } = await context.params
    
    // Verify user is a group member
    await verifyGroupMembership(groupId, userId)
    
    const { text: rawText, parentId } = await request.json()
    const cleaned = censor(rawText.trim())
    
    if (!cleaned.replace(/\*+/g, '').trim()) {
      return NextResponse.json(
        { error: 'Message is empty or contains disallowed language.' },
        { status: 400 }
      )
    }
    
    if (cleaned.length > 500) {
      return NextResponse.json(
        { error: 'Message too long (max 500 characters).' },
        { status: 400 }
      )
    }
    
    // Check for external links
    const urlPattern = /(https?:\/\/[^\s]+|www\.[^\s]+)/i
    if (urlPattern.test(cleaned)) {
      return NextResponse.json(
        { error: 'External links are not allowed in chat.' },
        { status: 400 }
      )
    }
    
    // Simple rate limiting - basic check to prevent spam
    // Note: More sophisticated rate limiting can be added later if needed
    const now = Date.now()
    
    const sanitized = cleaned.replace(/\n{3,}/g, '\n\n')
    
    // Add message to group chat collection
    await firestore.collection(`chat_group_${groupId}`).add({
      userId: userId,
      text: sanitized,
      parentId: parentId || null,
      timestamp: now,
      likedBy: [] as string[]
    })
    
    // Update group's last activity
    await firestore.collection('groups').doc(groupId).update({
      lastActivity: now
    })
    
    return NextResponse.json({ success: true }, { status: 201 })
    
  } catch (error) {
    console.error('Error sending group message:', error)
    
    if (error instanceof Error) {
      if (error.message.includes('auth')) {
        return NextResponse.json({ error: 'Authentication failed' }, { status: 401 })
      }
      
      if (error.message.includes('Group not found')) {
        return NextResponse.json({ error: error.message }, { status: 404 })
      }
      
      if (error.message.includes('not a member')) {
        return NextResponse.json({ error: error.message }, { status: 403 })
      }
    }
    
    return NextResponse.json(
      { error: 'Failed to send message' },
      { status: 500 }
    )
  }
}