import { NextRequest, NextResponse } from 'next/server'

const LISTINGS_BASE = 'https://mlb25.theshow.com/apis/listings.json'
const LISTING_BASE  = 'https://mlb25.theshow.com/apis/listing.json'
const TTL_MS = 5 * 60 * 1000
const DETAIL_TTL_MS = TTL_MS
const CONCURRENCY = 10

type CacheEntry<T=any> = { t: number; data: T }
const cache = new Map<string, CacheEntry>()
const detailCache = new Map<string, CacheEntry>()

const upstreamAllow = new Set([
  'min_best_sell_price','max_best_buy_price','min_best_buy_price','max_best_sell_price',
])

function toNum(v: unknown): number | null {
  if (v == null) return null
  if (typeof v === 'number') return Number.isFinite(v) ? v : null
  const s = String(v).trim()
  if (!s || s === '-') return null
  const n = Number(s.replace(/[^0-9.-]/g, ''))
  return Number.isFinite(n) ? n : null
}

function normalizeListing(l: any) {
  const it = l.item ?? {}
  return {
    id: it.uuid ?? null,
    name: it.name ?? l.listing_name ?? null,
    type: it.type ?? null,
    rarity: it.rarity ?? null,
    team: it.team_short_name ?? it.team ?? null,
    display_position: it.display_position ?? null,
    rank: it.ovr ?? it.new_rank ?? null,
    best_buy_price: toNum(l.best_buy_price),
    best_sell_price: toNum(l.best_sell_price),
    image: it.baked_img ?? it.img ?? null,
  }
}

function canonicalUpstreamQS(req: NextRequest) {
  const u = new URL(req.url)
  const qs = new URLSearchParams()
  const minSell = u.searchParams.get('min_best_sell_price') ?? '600'
  const maxBuy  = u.searchParams.get('max_best_buy_price')  ?? '75000'
  qs.set('min_best_sell_price', minSell)
  qs.set('max_best_buy_price', maxBuy)
  for (const [k, v] of u.searchParams.entries()) {
    if (upstreamAllow.has(k)) qs.set(k, v)
  }
  return qs
}

// "MM/DD/YYYY HH:mm:ss"
function parseCompletedAt(s: string): number | null {
  const m = s.match(/^(\d{2})\/(\d{2})\/(\d{4}) (\d{2}):(\d{2}):(\d{2})$/)
  if (!m) return null
  const [, MM, DD, YYYY, hh, mm, ss] = m
  const d = new Date(+YYYY, +MM - 1, +DD, +hh, +mm, +ss)
  return isNaN(d.getTime()) ? null : d.getTime()
}

function classify(price: number, bestBuy: number | null, bestSell: number | null): 'buy' | 'sell' | null {
  if (bestBuy == null && bestSell == null) return null
  if (bestBuy != null && price <= bestBuy) return 'sell'
  if (bestSell != null && price >= bestSell) return 'buy'
  if (bestBuy != null && bestSell != null) {
    const db = Math.abs(price - bestBuy)
    const ds = Math.abs(price - bestSell)
    return ds < db ? 'buy' : 'sell'
  }
  return bestSell != null ? (price >= bestSell ? 'buy' : null) : (price <= (bestBuy ?? 0) ? 'sell' : null)
}

async function fetchListingDetail(uuid: string) {
  const key = `detail:${uuid}`
  const now = Date.now()
  const hit = detailCache.get(key)
  if (hit && now - hit.t < DETAIL_TTL_MS) return hit.data

  const url = `${LISTING_BASE}?uuid=${encodeURIComponent(uuid)}`
  const r = await fetch(url, { headers: { accept: 'application/json' } })
  if (!r.ok) throw new Error(`detail ${r.status}`)
  const j = await r.json()
  detailCache.set(key, { t: now, data: j })
  return j
}

async function mapPool<T, U>(arr: T[], limit: number, fn: (t: T, i: number) => Promise<U>): Promise<U[]> {
  const out: U[] = new Array(arr.length)
  let i = 0
  const workers = Array.from({ length: Math.min(limit, arr.length) }, async () => {
    for (;;) {
      const idx = i++
      if (idx >= arr.length) return
      out[idx] = await fn(arr[idx], idx)
    }
  })
  await Promise.all(workers)
  return out
}

// percent helpers
function pctChange(current: number | null, past: number | null): number | null {
  if (current == null || past == null || past === 0) return null
  return ((current - past) / past) * 100
}
function pctFromHistory(currentBuy: number | null, history: any[], idx: number): number | null {
  if (currentBuy == null) return null
  if (!Array.isArray(history) || history.length <= idx) return null
  const past = toNum(history[idx]?.best_buy_price)
  return pctChange(currentBuy, past)
}

export async function GET(req: NextRequest) {
  try {
    const u = new URL(req.url)
    const windowM = Math.max(1, Math.min(60, Number(u.searchParams.get('window_m') ?? '5')))

    const upstreamQS = canonicalUpstreamQS(req)
    const cacheKey = `${LISTINGS_BASE}?${upstreamQS.toString()}`
    const now = Date.now()

    // Return cached enriched dataset if fresh
    const hit = cache.get(cacheKey)
    if (hit && now - hit.t < TTL_MS) {
      return NextResponse.json(
        { items: hit.data.items, meta: { window_m: windowM, cached: true } },
        { headers: { 'Cache-Control': 's-maxage=300, stale-while-revalidate=60' } },
      )
    }

    // Fetch all listing pages
    const r1 = await fetch(`${LISTINGS_BASE}?${upstreamQS.toString()}&page=1`, { headers: { accept: 'application/json' } })
    if (!r1.ok) return NextResponse.json({ error: `Upstream ${r1.status}` }, { status: 502 })
    const j1 = await r1.json()
    const totalPages = Number(j1.total_pages ?? 1) || 1
    const items1 = Array.isArray(j1.listings) ? j1.listings.map(normalizeListing) : []

    const pages: number[] = []
    for (let p = 2; p <= totalPages; p++) pages.push(p)
    const results = await Promise.allSettled(
      pages.map(p =>
        fetch(`${LISTINGS_BASE}?${upstreamQS.toString()}&page=${p}`, { headers: { accept: 'application/json' } })
          .then(r => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
          .then(j => (Array.isArray(j.listings) ? j.listings.map(normalizeListing) : [])),
      ),
    )
    const rest = results.flatMap(res => (res.status === 'fulfilled' ? res.value : []))

    // dedup
    const dedup = new Map<string, any>()
    for (const it of [...items1, ...rest]) {
      const key = String(it.id ?? it.name)
      if (!dedup.has(key)) dedup.set(key, it)
    }
    const listings = Array.from(dedup.values())

    // Enrich each card with recent volume + percent deltas
    const withComputed = await mapPool(listings, CONCURRENCY, async (it) => {
      const uuid = it.id
      if (!uuid) {
        return {
          ...it,
          buys_5m: 0, sells_5m: 0, volume_5m: 0,
          net_profit: null,
          delta_buy_1h: null, delta_buy_1d: null, delta_buy_1w: null, delta_buy_1m: null
        }
      }

      try {
        const detail = await fetchListingDetail(String(uuid))
        const currBuy = toNum(detail?.best_buy_price) ?? it.best_buy_price
        const currSell = toNum(detail?.best_sell_price) ?? it.best_sell_price

        // Completed orders newest -> oldest
        const parsed = (Array.isArray(detail?.completed_orders) ? detail.completed_orders : [])
          .map((o: any) => ({ ts: typeof o.date === 'string' ? parseCompletedAt(o.date) : null, price: toNum(o.price) }))
          .filter(o => o.ts != null && o.price != null)
          .sort((a, b) => (b.ts! - a.ts!))

        // Rolling window relative to latest trade for 5m counts
        const latestTs = parsed[0]?.ts ?? null
        const windowStart = latestTs ? latestTs - windowM * 60 * 1000 : null

        let buys = 0, sells = 0
        for (const o of parsed) {
          if (windowStart != null && o.ts! < windowStart) break
          const side = classify(o.price!, currBuy ?? null, currSell ?? null)
          if (side === 'buy') buys++
          else if (side === 'sell') sells++
        }

        const net_profit = (currSell != null && currBuy != null) ? (currSell * 0.9 - currBuy) : null

        // Daily history deltas as PERCENT
        const history = Array.isArray(detail?.price_history) ? detail.price_history : []
        const delta_buy_1d = pctFromHistory(currBuy, history, 1)
        const delta_buy_1w = pctFromHistory(currBuy, history, 7)
        const delta_buy_1m = pctFromHistory(currBuy, history, 30)

        // 1H percent change:
        // If no order <= cutoff (because >200 within 1h), fallback to oldest of the 200
        let delta_buy_1h: number | null = null
        if (currBuy != null && latestTs != null && parsed.length > 0) {
          const cutoff = latestTs - 60 * 60 * 1000
          let base: number | null = null

          // Prefer a 'sell'-like price at/just before cutoff
          for (const o of parsed) {
            if (o.ts! <= cutoff) {
              const side = classify(o.price!, currBuy, currSell)
              if (side === 'sell') { base = o.price!; break }
            }
          }
          // Any order at/before cutoff
          if (base == null) {
            const any = parsed.find(o => o.ts! <= cutoff)
            if (any) base = any.price!
          }
          // Fallback: use oldest of the available (earliest in list)
          if (base == null) {
            base = parsed[parsed.length - 1].price!
          }

          delta_buy_1h = pctChange(currBuy, base)
        }

        return {
          ...it,
          best_buy_price: currBuy,
          best_sell_price: currSell,
          buys_5m: buys,
          sells_5m: sells,
          volume_5m: buys + sells,
          net_profit,
          delta_buy_1h, delta_buy_1d, delta_buy_1w, delta_buy_1m,
        }
      } catch {
        return {
          ...it,
          buys_5m: 0, sells_5m: 0, volume_5m: 0,
          net_profit: null,
          delta_buy_1h: null, delta_buy_1d: null, delta_buy_1w: null, delta_buy_1m: null,
        }
      }
    })

    cache.set(cacheKey, { t: now, data: { items: withComputed } })

    return NextResponse.json(
      { items: withComputed, meta: { window_m: windowM, cached: false } },
      { headers: { 'Cache-Control': 's-maxage=300, stale-while-revalidate=60' } },
    )
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? 'unknown error' }, { status: 500 })
  }
}
