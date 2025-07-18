// src/app/api/cards/live/route.ts
import { NextResponse } from 'next/server'
import { firestore }     from '@/lib/firebaseAdmin'

// ——— Types ——————————————————————————————————————————————————————————————————

interface LatestMarket {
  sell?: number
}

interface LatestPrediction {
  predicted_rank:      number
  predicted_rank_low:  number
  predicted_rank_high: number
}

interface CardData {
  ovr:               number
  latestMarket?:     LatestMarket
  latestPrediction?: LatestPrediction
  [key: string]:     unknown
}

// ——— Quick-sell lookup ———————————————————————————————————————————————————————

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

// ——— Route handler ————————————————————————————————————————————————————————

export async function GET() {
  try {
    console.log('Fetching cards...')
    // First get all cards with predictions
    const snap = await firestore
      .collection('cards')
      .where('latestPrediction', '!=', null)
      .get()
    
    console.log(`Found ${snap.docs.length} total cards with predictions`)
    
    // Filter for Live series cards in memory for now (until Firestore index is ready)
    const liveSeriesDocs = snap.docs.filter(doc => {
      const data = doc.data();
      return data.series === 'Live';
    });
    
    console.log(`Found ${liveSeriesDocs.length} Live series cards`)
    
    const merged = liveSeriesDocs.map(d => {
    const data   = d.data() as CardData
    const market = data.latestMarket   || {}
    // **Here we assert** that latestPrediction really is our typed object:
    const pred   = data.latestPrediction as LatestPrediction

    // 1) confidence %
    const lowRank  = pred.predicted_rank_low
    const highRank = pred.predicted_rank_high
    let confPct    = 100 - (highRank - lowRank) * 5
    confPct        = Math.max(0, Math.min(100, confPct))

    // 2) Calculate rating changes (delta rank)
    const delta_rank_pred = pred.predicted_rank - data.ovr
    const delta_rank_low = pred.predicted_rank_low - data.ovr  
    const delta_rank_high = pred.predicted_rank_high - data.ovr

    // 3) quick-sell & predicted-QS
    const ovr          = data.ovr
    const qs_actual    = qsValue(ovr)

    const midRank      = Math.round(pred.predicted_rank)
    const qs_pred      = qsValue(midRank)

    const lowRnd       = Math.round(lowRank)
    const qs_pred_low  = qsValue(lowRnd)

    const highRnd      = Math.round(highRank)
    const qs_pred_high = qsValue(highRnd)

    // 3) price/fallback — *force it to a number* so TS knows it’s safe to subtract
    const rawPrice = market.sell
    const price    = typeof rawPrice === 'number' 
      ? rawPrice 
      : qs_actual

    // 4) profit & % profit
    const profit         = qs_pred       - price
    const profit_low     = qs_pred_low   - price
    const profit_high    = qs_pred_high  - price

    const profitPct      = price > 0
      ? Math.round((profit      / price) * 10000) / 100
      : 0
    const profitPct_low  = price > 0
      ? Math.round((profit_low  / price) * 10000) / 100
      : 0
    const profitPct_high = price > 0
      ? Math.round((profit_high / price) * 10000) / 100
      : 0

    // 5) expected-value profit
    const ev_profit = Math.round((
        0.025 * profit_low +
        0.95  * profit +
        0.025 * profit_high
      ) * 100) / 100

    return {
      id:                     d.id,
      ...data,
      ...pred,
      ...market,

      // Delta rank calculations (rating changes)
      delta_rank_pred,
      delta_rank_low,
      delta_rank_high,

      market_price:           price,
      qs_actual,
      qs_pred,
      qs_pred_low,
      qs_pred_high,

      predicted_profit:       profit,
      predicted_profit_low:   profit_low,
      predicted_profit_high:  profit_high,
      predicted_ev_profit:    ev_profit,

      predicted_profit_pct:      profitPct,
      predicted_profit_pct_low:  profitPct_low,
      predicted_profit_pct_high: profitPct_high,

      confidence_percentage: Math.round(confPct * 10) / 10,
    }
  })

    return NextResponse.json(merged, {
      status: 200,
      headers: {
        'Cache-Control': 'public, max-age=900, s-maxage=900, stale-while-revalidate=600'
      }
    })
  } catch (error) {
    console.error('Error in /api/cards/live:', error)
    return NextResponse.json(
      { error: 'Failed to fetch cards', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
