// src/app/api/cards/[cardId]/route.ts
import { NextResponse } from 'next/server'
import { firestore }    from '@/lib/firebaseAdmin'

function qsValue(ovr: number): number {
  if (ovr < 65)   return 5
  if (ovr < 75)   return 25
  if (ovr === 75) return 50
  if (ovr === 76) return 75
  if (ovr === 77) return 100
  if (ovr === 78) return 125
  if (ovr === 79) return 150
  if (ovr === 80) return 400
  if (ovr === 81) return 600
  if (ovr === 82) return 900
  if (ovr === 83) return 1200
  if (ovr === 84) return 1500
  if (ovr === 85) return 3000
  if (ovr === 86) return 3750
  if (ovr === 87) return 4500
  if (ovr === 88) return 5500
  if (ovr === 89) return 7000
  if (ovr === 90) return 8000
  if (ovr === 91) return 9000
  return ovr >= 92 ? 10000 : 0
}

export async function GET(
  request: Request,
  context: { params: Promise<{ cardId: string }> }
) {
  const { cardId } = await context.params
  const doc = await firestore.collection('cards').doc(cardId).get()
  if (!doc.exists) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  interface FirestoreCard {
    ovr?: number | string
    latestMarket?: Record<string, unknown>
    latestPrediction?: Record<string, unknown>
    [key: string]: unknown
  }

  const raw     = doc.data() as FirestoreCard
  const market  = raw.latestMarket   ?? {}
  const predRaw = raw.latestPrediction ?? {}

  // 1) cast every predRaw[key] → number if possible
  const pred: Record<string, number | string> = {}
  Object.entries(predRaw).forEach(([k, v]) => {
    const n = Number(v as string)
    pred[k] = Number.isNaN(n) ? String(v) : n
  })

  // 2) confidence %
  const lowRank  = Number(pred.predicted_rank_low)  || 0
  const highRank = Number(pred.predicted_rank_high) || 0
  let confPct = 100 - (highRank - lowRank) * 5
  confPct = Math.max(0, Math.min(100, confPct))

  // 3) quick‐sell & predicted‐QS
  const ovr       = Number(raw.ovr) || 0
  const qs_actual = qsValue(ovr)

  const predictedRank = Number(pred.predicted_rank) ?? ovr
  const predictedRankLow = Number(pred.predicted_rank_low) ?? ovr
  const predictedRankHigh = Number(pred.predicted_rank_high) ?? ovr

  const qs_pred      = qsValue(Math.round(predictedRank))
  const qs_pred_low  = qsValue(Math.round(predictedRankLow))
  const qs_pred_high = qsValue(Math.round(predictedRankHigh))

  // 4) price/fallback
  const rawPrice = (market as Record<string,unknown>).buy
  const price = typeof rawPrice === 'number'
    ? rawPrice
    : Number(rawPrice) || qs_actual

  // 5) profit & %
  const profit      = qs_pred       - price
  const profit_low  = qs_pred_low   - price
  const profit_high = qs_pred_high  - price
  const pct = (p: number) => price > 0
    ? Math.round((p / price) * 10000) / 100
    : 0

  return NextResponse.json({
    id:                      doc.id,

    // raw but cast to numbers
    ...raw,
    ...market,
    ...predRaw,

    // now override the pred‐fields with actual numbers
    predicted_rank: pred.predicted_rank       || 0,
    predicted_rank_low:       pred.predicted_rank_low   || 0,
    predicted_rank_high:      pred.predicted_rank_high  || 0,
    delta_rank_pred:          pred.delta_rank_pred      || 0,
    delta_rank_low:           pred.delta_rank_low       || 0,
    delta_rank_high:          pred.delta_rank_high      || 0,

    // derived
    confidence_percentage:    Math.round(confPct * 10) / 10,

    qs_actual,
    qs_pred,
    qs_pred_low,
    qs_pred_high,

    market_price:             price,

    predicted_profit:         profit,
    predicted_profit_low:     profit_low,
    predicted_profit_high:    profit_high,

    predicted_profit_pct:     pct(profit),
    predicted_profit_pct_low: pct(profit_low),
    predicted_profit_pct_high:pct(profit_high),
  }, {
    status: 200,
    headers: { 'Cache-Control': 'public, max-age=300, s-maxage=300' }
  })
}