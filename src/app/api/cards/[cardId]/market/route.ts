import { NextResponse } from 'next/server'
import { firestore }    from '@/lib/firebaseAdmin'

export async function GET(request: Request, { params }: { params: { cardId: string } }) {
  const marketDoc = await firestore
    .collection('cards')
    .doc(params.cardId)
    .collection('market')
    .doc('latest')
    .get()

  if (!marketDoc.exists) return NextResponse.json({ error: 'No market data' }, { status: 404 })
  return NextResponse.json(marketDoc.data())
}
