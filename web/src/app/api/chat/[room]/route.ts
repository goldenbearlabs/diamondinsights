// src/app/api/chat/[room]/route.ts
import { NextResponse } from 'next/server'
import admin from 'firebase-admin'
import { firestore } from '@/lib/firebaseAdmin'
import { headers }   from 'next/headers'

// TypeScript interfaces for Firestore chat data
interface ChatMessageData {
  userId: string
  text: string
  parentId: string | null
  timestamp: number
  likedBy: string[]
  playerId?: string
  playerName?: string
  editedAt?: number
  editHistory?: {text: string; editedAt: number}[]
}

interface UserData {
  username: string
  profilePic: string
}

if (!admin.apps.length) admin.initializeApp()

// maximum allowed length for a chat message
const MAX_LENGTH = 500

// attempt to extract a uid, but don’t error if missing
async function tryGetUserId() {
  try {
    const h = await headers()
    const authHeader = h.get('authorization') || ''
    const match      = authHeader.match(/^Bearer (.+)$/)
    if (!match) return null
    const decoded = await admin.auth().verifyIdToken(match[1])
    return decoded.uid
  } catch {
    return null
  }
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
  _req: Request,
  context: { params: Promise<{ room: string }> }
) {
  const { room } = await context.params
  const col      = `chat_${room}`
  const snap = await firestore
    .collection(col)
    .orderBy('timestamp','desc')
    .limit(200)
    .get()

  const raw = snap.docs.map(d => {
    const data = d.data() as ChatMessageData
    return {
      id:      d.id,
      ...data,
      likedBy: data.likedBy || [] as string[]
    }
  })

  const uids = Array.from(new Set(raw.map(m => m.userId)))
  const userDocs = await Promise.all(
    uids.map(uid => firestore.collection('users').doc(uid).get())
  )
  const userMap = userDocs.reduce<Record<string,{username:string,profilePic:string}>>((m,u)=>{
    if (u.exists) {
      const d = u.data() as UserData
      m[u.id] = {
        username:   d.username    || 'Unknown',
        profilePic: d.profilePic  || '/default_profile.png'
      }
    }
    return m
  }, {})

  const me = await tryGetUserId()

  const msgs = raw.map(m => ({
    id:             m.id,
    parentId:       m.parentId  || null,
    userId:         m.userId,
    username:       userMap[m.userId]?.username      || 'Unknown',
    profilePicUrl:  userMap[m.userId]?.profilePic    || '/default_profile.jpg',
    text:           m.text,
    timestamp:      m.timestamp,
    likes:          m.likedBy.length,
    liked:          me ? m.likedBy.includes(me) : false,
    playerId:       m.playerId,
    playerName:     m.playerName,
    editedAt:       m.editedAt,
    editHistory:    m.editHistory
  }))

  return NextResponse.json(msgs)
}

export async function POST(
  req: Request,
  context: { params: Promise<{ room: string }> }
) {
  const { room } = await context.params
  const h        = await headers()
  const match    = (h.get('authorization')||'').match(/^Bearer (.+)$/)
  if (!match) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }
  const decoded = await admin.auth().verifyIdToken(match[1])
  const uid     = decoded.uid

  const { text: rawText, parentId } = await req.json()
  const cleaned = censor(rawText.trim())

  if (!cleaned.replace(/\*+/g, '').trim()) {
    return NextResponse.json(
      { error: 'Message is empty or contains disallowed language.' },
      { status: 400 }
    )
  }

  if (cleaned.length > MAX_LENGTH) {
    return NextResponse.json(
      { error: `Message too long (max ${MAX_LENGTH} characters).` },
      { status: 400 }
    )
  }
  const urlPattern = /(https?:\/\/[^\s]+|www\.[^\s]+)/i;
  if (urlPattern.test(cleaned)) {
    return NextResponse.json(
      { error: 'External links are not allowed in chat.' },
      { status: 400 }
    );
  }
  // ─── 1) RATE-LIMIT: fetch this user’s last message in this room ───────
  const colName = `chat_${room}`
  const now     = Date.now()
  const roomCol = firestore.collection(colName)
  const lastMsgSnap = await roomCol
    .where('userId', '==', uid)
    .orderBy('timestamp', 'desc')
    .limit(1)
    .get()

  if (!lastMsgSnap.empty) {
    const lastTs = lastMsgSnap.docs[0].data().timestamp as number
    if (now - lastTs < 15_000) {
      return NextResponse.json(
        { error: "You're sending messages too quickly—please wait a bit." },
        { status: 429 }
      )
    }
  }

  const sanitized = cleaned.replace(/\n{3,}/g, '\n\n')

  const col = `chat_${room}`
  await firestore.collection(col).add({
    userId:    uid,
    text:      sanitized,
    parentId:  parentId || null,
    timestamp: Date.now(),
    likedBy:   [] as string[]
  })

  return NextResponse.json({ ok: true }, { status: 201 })
}
