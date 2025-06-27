import { NextResponse } from 'next/server'
import { firestore }    from '@/lib/firebaseAdmin'

export async function GET() {
  const snap = await firestore.collection('cards').get()
  const cards = snap.docs.map(d => ({ id: d.id, ...d.data() }))
  return NextResponse.json(cards)
}
