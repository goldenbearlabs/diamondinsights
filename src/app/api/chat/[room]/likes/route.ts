// src/app/api/chat/[room]/likes/route.ts
import { NextResponse } from 'next/server'
import admin from 'firebase-admin'
import { firestore } from '@/lib/firebaseAdmin'
import { headers } from 'next/headers'

// TypeScript interfaces for Firestore chat data
interface ChatMessageData {
  likedBy: string[]
  userId: string
  text: string
  parentId: string | null
  timestamp: number
}

if (!admin.apps.length) admin.initializeApp()

async function getUserId() {
  const h = await headers()
  const match = (h.get('authorization')||'').match(/^Bearer (.+)$/)
  if (!match) throw new Error('Missing auth token')
  const decoded = await admin.auth().verifyIdToken(match[1])
  return decoded.uid
}

export async function POST(
    req: Request,
    context: { params: Promise<{ room: string }> }
  ) {
    try {
      const { room } = await context.params    
      const uid      = await getUserId()
      const { messageId } = await req.json()
      const col      = `chat_${room}`
      const msgRef   = firestore.collection(col).doc(messageId)
      const msgSnap  = await msgRef.get()
      if (!msgSnap.exists) throw new Error('Not found')
  
      const msgData = msgSnap.data() as ChatMessageData
      const likedBy = msgData.likedBy || []
      const already = (likedBy as string[]).includes(uid)
  
      await msgRef.update({
        likedBy: admin.firestore.FieldValue[already ? 'arrayRemove' : 'arrayUnion'](uid)
      })
  
      return NextResponse.json({ toggled: !already })
    } catch {
      return NextResponse.json({ error: err.message }, { status: 401 })
    }
  }
  
