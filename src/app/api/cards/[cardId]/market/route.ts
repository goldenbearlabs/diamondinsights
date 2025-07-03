// src/app/api/cards/[cardId]/market/route.ts
import { NextResponse } from 'next/server'
import { firestore } from '@/lib/firebaseAdmin'

export async function GET(
  request: Request,
  { params }: { params: { cardId: string } }
) {
  const uid = params.cardId

  // Ensure the user’s investments are public
  const userDoc = await firestore.doc(`users/${uid}`).get()
  if (!userDoc.exists || !userDoc.data()?.investmentsPublic) {
    return NextResponse.json({ error: 'Not public' }, { status: 403 })
  }

  // Fetch the investments sub‐collection
  const snap = await firestore
    .collection('users')
    .doc(uid)
    .collection('investments')
    .orderBy('createdAt', 'desc')
    .get()

  const investments = snap.docs.map(d => ({ id: d.id, ...d.data() }))
  return NextResponse.json(investments)
}
