// app/api/insights/route.ts
import { NextResponse } from 'next/server'
import { buildInsights, fetchGameLog, aggregateInsights } from '@/lib/mlbInsights'
import { getItemsIndex } from '@/lib/itemsCache'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function GET(req: Request) {
  try {
    const url = new URL(req.url)
    const username = (url.searchParams.get('username') || '').trim()
    const platform = (url.searchParams.get('platform') || 'psn') as 'psn'|'xbl'|'mlbts'|'nsw'
    const mode = (url.searchParams.get('mode') || 'arena') as 'all'|'arena'|'exhibition'

    if (!username) return NextResponse.json({ error: 'username required' }, { status: 400 })

    // 1) Expand a single game drawer
    const id = url.searchParams.get('id')
    if (id) {
      const youAre = (url.searchParams.get('youAre') || '') as 'home'|'away'|null
      const home = url.searchParams.get('home') || ''
      const away = url.searchParams.get('away') || ''
      const game = await fetchGameLog(username, id, youAre, home, away)
      return NextResponse.json(game)
    }

    // 2) Aggregate across games (with optional split bundle)
    const aggregate = url.searchParams.get('aggregate')
    if (aggregate) {
      const base = await buildInsights(username, platform, mode)

      const subset = (url.searchParams.get('subset') || 'online') as 'all'|'online'|'vsCPU'|'arena'|'exhibition'
      const limit = Math.max(1, Math.min(1000, Number(url.searchParams.get('limit') || '200')))
      const concurrency = Math.max(1, Math.min(24, Number(url.searchParams.get('concurrency') || '16')))

      const filters = {
        pThrow: (url.searchParams.get('pThrow') || 'all') as 'all'|'L'|'R',
        bBat: (url.searchParams.get('bBat') || 'all') as 'all'|'L'|'R'|'S',
        inning: url.searchParams.get('inning') || 'all',
        outs: url.searchParams.get('outs') || 'all',
        difficulty: (url.searchParams.get('difficulty') || 'all') as 'all'|'Rookie'|'Veteran'|'All-Star'|'Hall Of Fame'|'Legend'|'Goat',
        pitcherProfile: (url.searchParams.get('pitcherProfile') || 'all') as 'all'|'outlier'|'lowvelo',
        hitterHeight: (url.searchParams.get('hitterHeight') || 'all') as 'all'|'tall'|'small',
        situation: (url.searchParams.get('situation') || 'all') as 'all'|'winning'|'tied'|'behind',
        risp: (url.searchParams.get('risp') || 'all') as 'all'|'risp'|'norisp',
      }

      const includePAs = (url.searchParams.get('includePAs') || '1') === '1' // default: return split bundle
      const items = await getItemsIndex() // 3h cached

      const agg = await aggregateInsights(base, username, subset, limit, concurrency, {
        filters, items, includePAs
      })

      return NextResponse.json(agg)
    }

    // 3) Base list (paged + grouped ids)
    const out = await buildInsights(username, platform, mode)
    return NextResponse.json(out)
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'server error' }, { status: 500 })
  }
}
