// src/app/api/cards/live/route.ts
import { NextResponse } from 'next/server'
import { firestore }     from '@/lib/firebaseAdmin'

function qsValue(ovr: number): number {
  if (ovr < 65)        return 5
  if (ovr < 75)        return 25
  if (ovr === 75)      return 50
  if (ovr === 76)      return 75
  if (ovr === 77)      return 100
  if (ovr === 78)      return 125
  if (ovr === 79)      return 150
  if (ovr === 80)      return 400
  if (ovr === 81)      return 600
  if (ovr === 82)      return 900
  if (ovr === 83)      return 1200
  if (ovr === 84)      return 1500
  if (ovr === 85)      return 3000
  if (ovr === 86)      return 3750
  if (ovr === 87)      return 4500
  if (ovr === 88)      return 5500
  if (ovr === 89)      return 7000
  if (ovr === 90)      return 8000
  if (ovr === 91)      return 9000
  return ovr >= 92 ? 10000 : 0
}

export interface CardPayload {
  id: string
  name: string
  ovr: number
  rarity: string
  is_hitter: boolean
  baked_img?: string

  // new fields
  team: string
  team_short_name: string
  display_position: string
  age: number

  delta_rank_low: number
  delta_rank_pred: number
  delta_rank_high: number

  predicted_rank_low: number
  predicted_rank: number
  predicted_rank_high: number

  confidence_percentage: number

  qs_actual: number
  qs_pred_low: number
  qs_pred: number
  qs_pred_high: number

  market_price: number

  predicted_profit_low: number
  predicted_profit: number
  predicted_profit_high: number
  predicted_ev_profit: number
  predicted_profit_pct: number
}

export async function GET() {
  const snap = await firestore
    .collection('cards')
    .where('latestPrediction', '!=', null)
    .select(
      'name',
      'ovr',
      'rarity',
      'is_hitter',
      'baked_img',
      // new fields
      'team',
      'team_short_name',
      'display_position',
      'age',
      'latestPrediction.predicted_rank',
      'latestPrediction.predicted_rank_low',
      'latestPrediction.predicted_rank_high',
      'latestMarket.sell'
    )
    .get()

  const merged: CardPayload[] = snap.docs.map(d => {
    const {
      name,
      ovr,
      rarity,
      is_hitter,
      baked_img,
      team,
      team_short_name,
      display_position,
      age,
      latestMarket,
      latestPrediction
    } = d.data() as any

    // compute confidence, qs, price, profit exactly as before…
    const lowRank = latestPrediction.predicted_rank_low
    const highRank = latestPrediction.predicted_rank_high
    let confPct = 100 - (highRank - lowRank) * 5
    confPct = Math.max(0, Math.min(100, confPct))

    const qs_actual   = qsValue(ovr)
    const midRank     = Math.round(latestPrediction.predicted_rank)
    const qs_pred     = qsValue(midRank)
    const qs_pred_low = qsValue(Math.round(lowRank))
    const qs_pred_high= qsValue(Math.round(highRank))

    const price       = typeof latestMarket?.sell === 'number'
                      ? latestMarket.sell
                      : qs_actual

    const profit      = qs_pred      - price
    const profit_low  = qs_pred_low  - price
    const profit_high = qs_pred_high - price

    const profitPct       = price > 0 ? Math.round((profit      / price) * 10000)/100 : 0
    const ev_profit       = Math.round((0.025*profit_low + 0.95*profit + 0.025*profit_high)*100)/100

    return {
      id:                     d.id,
      name,
      ovr,
      rarity,
      is_hitter: Boolean(is_hitter),
      baked_img,

      // **new team fields**
      team,
      team_short_name,
      display_position,
      age,

      // predictions
      delta_rank_low:  Number((lowRank  - ovr).toFixed(2)),
      delta_rank_pred: Number((latestPrediction.predicted_rank - ovr).toFixed(2)),
      delta_rank_high: Number((highRank - ovr).toFixed(2)),
      predicted_rank_low:     Math.round(lowRank),
      predicted_rank:         Math.round(latestPrediction.predicted_rank),
      predicted_rank_high:    Math.round(highRank),
      confidence_percentage:  Math.round(confPct * 10) / 10,

      // quick-sell values
      qs_actual,
      qs_pred_low,
      qs_pred,
      qs_pred_high,

      // market price
      market_price: price,

      // profit
      predicted_profit_low:   profit_low,
      predicted_profit:       profit,
      predicted_profit_high:  profit_high,
      predicted_ev_profit:    ev_profit,
      predicted_profit_pct:   profitPct,
    }
  })

  return NextResponse.json(merged, {
    status: 200,
    headers: {
      'Cache-Control': 'public, max-age=0, s-maxage=90, stale-while-revalidate=60'
    }
  })
}