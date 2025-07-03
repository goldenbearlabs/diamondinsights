// src/app/api/comments/all/route.ts
import { NextResponse } from 'next/server'
import { firestore }    from '@/lib/firebaseAdmin'

// TypeScript interfaces for Firestore data
interface CommentData {
  parentId: string | null
  userId: string
  text: string
  timestamp: number
  playerId: string
  likes: string[]
}

interface UserData {
  username: string
  profilePic: string
}

export async function GET() {
  // 1) fetch all live comments
  const snap = await firestore
    .collection('comments')
    .orderBy('timestamp','desc')
    .limit(200)
    .get()

  const raw = snap.docs.map(d => {
    const data = d.data() as CommentData
    return {
      id:        d.id,
      parentId:  data.parentId || null,
      userId:    data.userId,
      text:      data.text,
      timestamp: data.timestamp,
      playerId:  data.playerId,
      likes:     data.likes?.length || 0
    }
  })

  // 2) batch‐fetch corresponding user docs
  const userIds   = Array.from(new Set(raw.map(c => c.userId)))
  const userDocs  = await Promise.all(
    userIds.map(uid => firestore.collection('users').doc(uid).get())
  )

  const userMap: Record<string,{ username:string; profilePicUrl:string }> = {}
  userDocs.forEach(docSnap => {
    if (docSnap.exists) {
      const u = docSnap.data() as UserData
      userMap[docSnap.id] = {
        username:     u.username || 'Unknown',
        profilePicUrl: u.profilePic || '/placeholder-user.png'
      }
    }
  })

  // 3) combine
  const comments = raw.map(c => ({
    ...c,
    username:       userMap[c.userId]?.username       || 'Unknown',
    profilePicUrl:  userMap[c.userId]?.profilePicUrl  || '/placeholder-user.png',
  }))

  return NextResponse.json(comments)
}
