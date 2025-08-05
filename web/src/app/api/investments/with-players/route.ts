// GET /api/investments/with-players - Optimized endpoint for portfolio loading
import { NextResponse } from 'next/server'
import admin from 'firebase-admin'
import { firestore } from '@/lib/firebaseAdmin'
import { headers } from 'next/headers'

if (!admin.apps.length) admin.initializeApp()

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

// Helper to get authenticated user ID
async function getUserId() {
  try {
    const headersList = await headers()
    const authHeader = headersList.get('authorization')
    
    if (!authHeader?.startsWith('Bearer ')) {
      return null
    }
    
    const token = authHeader.substring(7)
    const decodedToken = await admin.auth().verifyIdToken(token)
    return decodedToken.uid
  } catch (error) {
    console.error('Auth error:', error)
    return null
  }
}

export async function GET() {
  try {
    // Get authenticated user
    const userId = await getUserId()
    if (!userId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    // Fetch user's investments from the correct subcollection
    const investmentsSnapshot = await firestore
      .collection('users')
      .doc(userId)
      .collection('investments')
      .orderBy('createdAt', 'desc')
      .get()

    if (investmentsSnapshot.empty) {
      return NextResponse.json([])
    }

    // Extract player UUIDs from investments
    const playerUUIDs = new Set<string>()
    const investments = investmentsSnapshot.docs.map(doc => {
      const data = doc.data()
      console.log('Investment data:', { id: doc.id, playerUUID: data.playerUUID, playerName: data.playerName })
      playerUUIDs.add(data.playerUUID)
      return {
        id: doc.id,
        playerUUID: data.playerUUID,
        playerName: data.playerName || null, // May not exist in all records
        quantity: data.quantity,
        avgBuyPrice: data.avgBuyPrice,
        userProjectedOvr: data.userProjectedOvr,
        createdAt: data.createdAt
      }
    })

    console.log('Player UUIDs to fetch:', Array.from(playerUUIDs))

    // Fetch only the player cards we need (batch get for better performance)
    const playerCardPromises = Array.from(playerUUIDs).map(uuid =>
      firestore.collection('cards').doc(uuid).get()
    )

    const playerCardSnapshots = await Promise.all(playerCardPromises)
    
    // Create player cards map with AI prediction processing (same as working endpoint)
    const playerCardsMap = new Map()
    playerCardSnapshots.forEach(doc => {
      console.log('Player card doc:', { id: doc.id, exists: doc.exists })
      if (doc.exists) {
        const raw = doc.data()
        const market = raw.latestMarket ?? {}
        const predRaw = raw.latestPrediction ?? {}

        // Cast prediction fields to numbers (same as working endpoint)
        const pred: Record<string, number | string> = {}
        Object.entries(predRaw).forEach(([k, v]) => {
          const n = Number(v as string)
          pred[k] = Number.isNaN(n) ? String(v) : n
        })

        // Calculate confidence percentage
        const lowRank = Number(pred.predicted_rank_low) || 0
        const highRank = Number(pred.predicted_rank_high) || 0
        let confPct = 100 - (highRank - lowRank) * 5
        confPct = Math.max(0, Math.min(100, confPct))

        // Calculate quick-sell values
        const ovr = Number(raw.ovr) || 0
        const qs_actual = qsValue(ovr)

        const predictedRank = Number(pred.predicted_rank) ?? ovr
        const predictedRankLow = Number(pred.predicted_rank_low) ?? ovr
        const predictedRankHigh = Number(pred.predicted_rank_high) ?? ovr

        const qs_pred = qsValue(Math.round(predictedRank))
        const qs_pred_low = qsValue(Math.round(predictedRankLow))
        const qs_pred_high = qsValue(Math.round(predictedRankHigh))

        // Market price calculation
        const rawPrice = (market as Record<string, unknown>).sell
        const market_price = typeof rawPrice === 'number'
          ? rawPrice
          : Number(rawPrice) || qs_actual

        // Profit calculations
        const predicted_profit = qs_pred - market_price
        const predicted_profit_low = qs_pred_low - market_price
        const predicted_profit_high = qs_pred_high - market_price
        
        const pct = (p: number) => market_price > 0
          ? Math.round((p / market_price) * 10000) / 100
          : 0

        console.log('Processed player card:', { 
          id: doc.id, 
          name: raw?.name, 
          ovr, 
          predicted_rank: predictedRank,
          qs_pred,
          confidence_percentage: Math.round(confPct * 10) / 10
        })

        playerCardsMap.set(doc.id, {
          id: doc.id,
          name: raw?.name || 'Unknown Player',
          team: raw?.team_short_name || 'UNK',
          position: raw?.display_position || 'N/A',
          ovr,
          predicted_rank: predictedRank,
          predicted_rank_low: predictedRankLow,
          predicted_rank_high: predictedRankHigh,
          delta_rank_pred: Number(pred.delta_rank_pred) || 0,
          delta_rank_low: Number(pred.delta_rank_low) || 0,
          delta_rank_high: Number(pred.delta_rank_high) || 0,
          confidence_percentage: Math.round(confPct * 10) / 10,
          qs_actual,
          qs_pred,
          qs_pred_low,
          qs_pred_high,
          market_price,
          predicted_profit,
          predicted_profit_low,
          predicted_profit_high,
          predicted_profit_pct: pct(predicted_profit),
          predicted_profit_pct_low: pct(predicted_profit_low),
          predicted_profit_pct_high: pct(predicted_profit_high),
          baked_img: raw?.baked_img || null,
          // Include all raw data as well
          ...raw,
          ...market,
          ...predRaw
        })
      } else {
        console.log('Player card not found for UUID:', doc.id)
      }
    })

    console.log('Player cards map size:', playerCardsMap.size)

    // Combine investments with their player data
    const enrichedInvestments = investments.map(investment => {
      const playerCard = playerCardsMap.get(investment.playerUUID) || {
        id: investment.playerUUID,
        name: investment.playerName || 'Unknown Player',
        team: 'UNK',
        position: 'N/A',
        ovr: 0,
        predicted_rank: 0,
        predicted_rank_low: 0,
        predicted_rank_high: 0,
        confidence_percentage: 0,
        qs_pred: 0,
        baked_img: null,
        delta_rank_pred: 0
      }
      
      console.log('Enriched investment:', { 
        investmentId: investment.id, 
        playerUUID: investment.playerUUID,
        playerCardFound: playerCardsMap.has(investment.playerUUID),
        playerCardName: playerCard.name 
      })
      
      return {
        ...investment,
        playerCard
      }
    })

    console.log('Returning enriched investments count:', enrichedInvestments.length)
    return NextResponse.json(enrichedInvestments)

  } catch (error) {
    console.error('Get investments with players error:', error)
    
    // Log more detailed error information
    if (error instanceof Error) {
      console.error('Error message:', error.message)
      console.error('Error stack:', error.stack)
    }
    
    return NextResponse.json({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}