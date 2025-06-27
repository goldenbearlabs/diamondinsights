// src/app/api/chat/[room]/route.ts
import { NextResponse } from 'next/server'
import admin from 'firebase-admin'
import { firestore } from '@/lib/firebaseAdmin'
import { headers }   from 'next/headers'

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

  const raw = snap.docs.map(d => ({
    id:      d.id,
    ...(d.data() as any),
    likedBy: (d.data() as any).likedBy || [] as string[]
  }))

  const uids = Array.from(new Set(raw.map(m => m.userId)))
  const userDocs = await Promise.all(
    uids.map(uid => firestore.collection('users').doc(uid).get())
  )
  const userMap = userDocs.reduce<Record<string,{username:string,profilePic:string}>>((m,u)=>{
    if (u.exists) {
      const d = u.data() as any
      m[u.id] = {
        username:   d.username    || 'Unknown',
        profilePic: d.profilePic  || '/placeholder-user.png'
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
    profilePicUrl:  userMap[m.userId]?.profilePic    || '/placeholder-user.png',
    text:           m.text,
    timestamp:      m.timestamp,
    likes:          m.likedBy.length,
    liked:          me ? m.likedBy.includes(me) : false,
    playerId:       m.playerId,
    playerName:     m.playerName
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

  const col = `chat_${room}`
  await firestore.collection(col).add({
    userId:    uid,
    text:      cleaned,
    parentId:  parentId || null,
    timestamp: Date.now(),
    likedBy:   [] as string[]
  })

  return NextResponse.json({ ok: true }, { status: 201 })
}
