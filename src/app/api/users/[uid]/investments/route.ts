import { NextResponse } from 'next/server'
import admin           from 'firebase-admin'
import { firestore }   from '@/lib/firebaseAdmin'

// no auth guard here—this is a public, read‐only endpoint
export async function GET(
  _req: Request,
  { params }: { params: { uid: string } }
) {
  const uid = params.uid
  // check that they’ve actually allowed public viewing:
  const userDoc = await firestore.doc(`users/${uid}`).get()
  if (!userDoc.exists || !userDoc.data()?.investmentsPublic) {
    return NextResponse.json({ error: 'Not public' }, { status: 403 })
  }
  const snap = await firestore
    .collection('users').doc(uid)
    .collection('investments')
    .orderBy('createdAt', 'desc')
    .get()

  const investments = snap.docs.map(d => ({ id: d.id, ...d.data() }))
  return NextResponse.json(investments)
}
