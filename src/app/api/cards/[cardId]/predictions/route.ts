// src/app/api/cards/[cardId]/predictions/route.ts
import { NextResponse } from 'next/server'
import { firestore }    from '@/lib/firebaseAdmin'

interface RawPrediction {
  predicted_rank_low: string
  predicted_rank_high: string
  [key: string]: unknown
}

export async function GET(
  request: Request,
  context: { params: Promise<{ cardId: string }> }
) {
  const { cardId } = await context.params

  const latestRef = firestore
    .collection('cards')
    .doc(cardId)
    .collection('predictions')
    .doc('latest')

  const snap = await latestRef.get()
  if (!snap.exists) {
    return NextResponse.json(
      { error: 'No latest prediction found for this player' },
      { status: 404 }
    )
  }

  const data = snap.data() as RawPrediction

  // parse the low/high into floats
  const lowVal  = parseFloat(data.predicted_rank_low)
  const highVal = parseFloat(data.predicted_rank_high)

  if (!isNaN(lowVal) && !isNaN(highVal)) {
    const range = highVal - lowVal
    let perc = 100 - range * 5
    if (perc < 0)   perc = 0
    if (perc > 100) perc = 100

    data.confidence_range      = Math.round(range * 100) / 100
    data.confidence_percentage = Math.round(perc  * 100) / 100
  } else {
    data.confidence_range      = null
    data.confidence_percentage = null
  }

  return NextResponse.json({
    date: snap.id,
    ...data
  })
}
