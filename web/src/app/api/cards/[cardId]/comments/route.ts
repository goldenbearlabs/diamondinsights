// src/app/api/cards/[cardId]/comments/route.ts
import { NextResponse } from 'next/server'
import admin from 'firebase-admin'
import { firestore } from '@/lib/firebaseAdmin'
import { headers } from 'next/headers'

// TypeScript interfaces for Firestore data
interface CommentData {
  playerId: string
  userId: string
  text: string
  parentId: string | null
  likes: string[]
  timestamp: number
  editedAt?: number
  editHistory?: {text: string; editedAt: number}[]
}

if (!admin.apps.length) admin.initializeApp()

// maximum allowed length for a comment
const MAX_LENGTH = 500

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

async function requireAuth() {
  const h = await headers()
  const authH = h.get('authorization') || ''
  const match = authH.match(/^Bearer (.+)$/)
  if (!match) throw new Error('Not authenticated')
  const decoded = await admin.auth().verifyIdToken(match[1])
  return decoded.uid
}

export async function GET(
  request: Request,
  context: { params: Promise<{ cardId: string }> }
) {
  const { cardId } = await context.params
  const snap = await firestore
    .collection('comments')
    .where('playerId', '==', cardId)
    .orderBy('timestamp', 'desc')
    .get()

  // 1) Cast d.data() to CommentData
  const raw = snap.docs.map(d => {
    const data = d.data() as CommentData

    // 2) Explicitly pick the fields
    return {
      id:         d.id,
      playerId:   data.playerId,
      userId:     data.userId,
      text:       data.text,
      parentId:   data.parentId,
      timestamp:  data.timestamp,
      likes:      data.likes || [],
      editedAt:   data.editedAt,
      editHistory: data.editHistory
    }
  })

  const userIds = Array.from(new Set(raw.map(c => c.userId)))
  const usersSnap = await Promise.all(
    userIds.map(uid => firestore.collection('users').doc(uid).get())
  )
  const userMap = usersSnap.reduce<Record<string,{username:string,profilePic:string}>>((m, ds) => {
    if (ds.exists) {
      const u = ds.data()!
      m[ds.id] = {
        username:   u.username || 'Unknown',
        profilePic: u.profilePic || '/default_profile.jpg'
      }
    }
    return m
  }, {})

  const comments = raw.map(c => ({
    id:            c.id,
    parentId:      c.parentId,
    userId:        c.userId,
    text:          c.text,
    timestamp:     c.timestamp,
    likes:         c.likes,
    editedAt:      c.editedAt,
    editHistory:    c.editHistory,
    username:      userMap[c.userId]?.username      || 'Unknown',
    profilePicUrl: userMap[c.userId]?.profilePic    || '/default_profile.jpg',
  }))

  return NextResponse.json(comments)
}

export async function POST(
  request: Request,
  context: { params: Promise<{ cardId: string }> }
) {
  let uid: string
  try {
    uid = await requireAuth()
  } catch {
    return NextResponse.json({ error: 'Not signed in' }, { status: 401 })
  }

  const { cardId } = await context.params
  const { text: rawText, parentId } = await request.json()

  // 1) trim + censor
  const cleaned = censor(rawText.trim())

  // 2) reject empty or all-censored
  if (!cleaned.replace(/\*+/g, '').trim()) {
    return NextResponse.json(
      { error: 'Your comment contains disallowed language.' },
      { status: 400 }
    )
  }

  // 3) enforce maximum length
  if (cleaned.length > MAX_LENGTH) {
    return NextResponse.json(
      { error: `Comment too long (max ${MAX_LENGTH} characters).` },
      { status: 400 }
    )
  }

  // 4) block external URLs
  const urlPattern = /(https?:\/\/[^\s]+|www\.[^\s]+)/i
  if (urlPattern.test(cleaned)) {
    return NextResponse.json(
      { error: 'External links are not allowed.' },
      { status: 400 }
    )
  }

  // 5) rate-limit per user per card (15s)
  const now = Date.now()
  const col = firestore.collection('comments')
  const lastSnap = await col
    .where('playerId', '==', cardId)
    .where('userId', '==', uid)
    .orderBy('timestamp', 'desc')
    .limit(1)
    .get()

  if (!lastSnap.empty) {
    const lastTs = lastSnap.docs[0].data().timestamp as number
    if (now - lastTs < 15_000) {
      return NextResponse.json(
        { error: "You're commenting too quickly. Please wait a bit." },
        { status: 429 }
      )
    }
  }

  // 6) collapse blank‐line floods
  const sanitized = cleaned.replace(/\n{3,}/g, '\n\n')

  // 7) write
  await col.add({
    playerId:  cardId,
    userId:    uid,
    text:      sanitized,
    parentId:  parentId || null,
    likes:     [],
    timestamp: now
  })

  return NextResponse.json({ success: true }, { status: 201 })
}
