// src/app/api/investments/route.ts
import { NextResponse } from 'next/server'
import admin from 'firebase-admin'
import { firestore } from '@/lib/firebaseAdmin'
import { headers } from 'next/headers'

// (re-)initialize the Admin SDK if it hasn’t been already
if (!admin.apps.length) {
  admin.initializeApp({
    // your existing firebaseAdmin setup
    credential: admin.credential.applicationDefault()
  })
}

/**
 * Helper: extract & verify a Firebase ID token from
 *   Authorization: Bearer <token>
 */
async function getUserId() {
  // must await() here so you can safely call .get()
  const h = await headers()
  const authHeader = h.get('authorization') || ''
  const match = authHeader.match(/^Bearer (.+)$/)
  if (!match) throw new Error('Missing or malformed Authorization header')
  const token = match[1]
  const decoded = await admin.auth().verifyIdToken(token)
  return decoded.uid
}

// GET /api/investments → list this user’s investments
export async function GET() {
  try {
    const uid = await getUserId()
    const snap = await firestore
      .collection('users')
      .doc(uid)
      .collection('investments')
      .orderBy('createdAt', 'desc')
      .get()

    const investments = snap.docs.map(d => ({
      id: d.id,
      ...d.data()
    }))
    return NextResponse.json(investments)
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 401 })
  }
}

// POST /api/investments → add a new one
export async function POST(req: Request) {
  try {
    const uid = await getUserId()
    const { playerUUID, quantity, avgBuyPrice, userProjectedOvr } = await req.json()

    const ref = await firestore
      .collection('users')
      .doc(uid)
      .collection('investments')
      .add({
        playerUUID,
        quantity,
        avgBuyPrice,
        userProjectedOvr,
        createdAt: Date.now()
      })

    return NextResponse.json({ id: ref.id }, { status: 201 })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 401 })
  }
}

// DELETE /api/investments/:id → remove one
export async function DELETE(req: Request) {
  try {
    const uid = await getUserId()
    const url = new URL(req.url)
    const id = url.pathname.split('/').pop()
    if (!id) throw new Error('Missing investment ID')

    await firestore
      .collection('users')
      .doc(uid)
      .collection('investments')
      .doc(id)
      .delete()

    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 401 })
  }
}
