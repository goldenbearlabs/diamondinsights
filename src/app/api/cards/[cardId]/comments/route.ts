// src/app/api/cards/[cardId]/comments/route.ts
import { NextResponse } from 'next/server'
import { firestore }    from '@/lib/firebaseAdmin'

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

  const raw = snap.docs.map(d => ({
    id:        d.id,
    ...(d.data() as any),
    likes:     (d.data() as any).likes || []
  }))

  const userIds = Array.from(new Set(raw.map(c => c.userId)))
  const usersSnap = await Promise.all(
    userIds.map(uid => firestore.collection('users').doc(uid).get())
  )
  const userMap = usersSnap.reduce<Record<string, any>>((m, docSnap) => {
    m[docSnap.id] = docSnap.data()
    return m
  }, {})

  const comments = raw.map(c => ({
    id:            c.id,
    parentId:      c.parentId,
    userId:        c.userId,
    text:          c.text,
    timestamp:     c.timestamp,
    likes:         c.likes,
    username:      userMap[c.userId]?.username      || 'Unknown',
    profilePicUrl: userMap[c.userId]?.profilePic    || '/avatar.png',
  }))

  return NextResponse.json(comments)
}

export async function POST(
  request: Request,
  context: { params: Promise<{ cardId: string }> }
) {
  const { cardId } = await context.params
  const { text: rawText, parentId, userId } = await request.json()

  if (!userId) {
    return NextResponse.json({ error: 'Not signed in' }, { status: 401 })
  }

  // trim + censor
  const cleaned = censor(rawText.trim())

  // reject empty or all-censored
  if (!cleaned.replace(/\*+/g, '').trim()) {
    return NextResponse.json(
      { error: 'Your comment contains disallowed language.' },
      { status: 400 }
    )
  }

  // enforce maximum length
  if (cleaned.length > MAX_LENGTH) {
    return NextResponse.json(
      { error: `Comment too long (max ${MAX_LENGTH} characters).` },
      { status: 400 }
    )
  }

  await firestore.collection('comments').add({
    playerId:  cardId,
    userId,
    text:      cleaned,
    parentId:  parentId || null,
    likes:     [],           
    timestamp: Date.now()
  })

  return NextResponse.json({ success: true }, { status: 201 })
}
