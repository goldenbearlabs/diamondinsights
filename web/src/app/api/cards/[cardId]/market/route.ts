// src/app/api/cards/[cardId]/market/route.ts
import { NextResponse, NextRequest } from 'next/server'
import { firestore } from '@/lib/firebaseAdmin'

export async function GET(request: NextRequest) {
  // Extract the cardId from the URL path
  const match = request.nextUrl.pathname.match(
    /^\/api\/cards\/([^\/]+)\/market\/?/
  )
  const cardId = match?.[1]
  if (!cardId) {
    return NextResponse.json(
      { error: 'Missing cardId in URL' },
      { status: 400 }
    )
  }

  // Check that this user’s investments are public
  const userDoc = await firestore.doc(`users/${cardId}`).get()
  if (!userDoc.exists || !userDoc.data()?.investmentsPublic) {
    return NextResponse.json({ error: 'Not public' }, { status: 403 })
  }

  // Load their investments
  const snap = await firestore
    .collection('users')
    .doc(cardId)
    .collection('investments')
    .orderBy('createdAt', 'desc')
    .get()

  const investments = snap.docs.map((d) => ({ id: d.id, ...d.data() }))
  return NextResponse.json(investments)
}
