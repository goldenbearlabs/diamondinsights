import { NextResponse } from 'next/server'
import { firestore }  from '@/lib/firebaseAdmin'

// no explicit type on context – let Next infer it
export async function GET(
  _req: Request,
  context: any
) {
  const uid = context.params.uid

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
