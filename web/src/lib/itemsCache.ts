// lib/itemsCache.ts
type Item = {
    name: string
    is_hitter: boolean
    bat_hand?: 'L'|'R'|'S'
    throw_hand?: 'L'|'R'
    height?: string
    ovr: number
    pitches?: { name: string; speed?: number }[]
    quirks?: string[]
  }
  
  export type ItemsIndex = {
    hittersByLast: Record<string, { name: string; bat: 'L'|'R'|'S'; heightIn: number; ovr: number }>
    pitchersByLast: Record<string, { name: string; throw: 'L'|'R'; heightIn: number; maxVelo: number; outlier: boolean; ovr: number }>
  }
  
  const BASE = 'https://mlb25.theshow.com/apis/items.json'
  
  let CACHE: { at: number; data: ItemsIndex } | null = null
  const TTL = 3 * 60 * 60 * 1000
  
  const toInches = (s?: string) => {
    const m = String(s || '').match(/(\d+)'(\d+)/)
    if (!m) return 0
    return parseInt(m[1]) * 12 + parseInt(m[2])
  }
  const last = (s: string) => s.trim().split(/\s+/).slice(-1)[0].toLowerCase()
  
  export async function getItemsIndex(force = false): Promise<ItemsIndex> {
    if (!force && CACHE && Date.now() - CACHE.at < TTL) return CACHE.data
  
    const p1 = await fetch(`${BASE}?page=1`, { cache: 'no-store' })
    if (!p1.ok) throw new Error('items page 1 failed')
    const j1 = await p1.json()
    const total = Number(j1.total_pages || 1)
  
    const pages = Array.from({ length: total }, (_, i) => i + 1)
    const limiter = pLimit(12)
    const all: Item[] = (await Promise.all(pages.map(pg =>
      limiter(async () => {
        const r = pg === 1 ? j1 : await (await fetch(`${BASE}?page=${pg}`, { cache: 'no-store' })).json()
        return (r.items || []) as Item[]
      })
    ))).flat()
  
    const hitters: Record<string, Item> = {}
    const pitchers: Record<string, Item> = {}
  
    for (const it of all) {
      const key = it.name.trim()
      if (it.is_hitter) {
        if (!hitters[key] || it.ovr > (hitters[key].ovr || 0)) hitters[key] = it
      } else {
        if (!pitchers[key] || it.ovr > (pitchers[key].ovr || 0)) pitchers[key] = it
      }
    }
  
    const hittersByLast: ItemsIndex['hittersByLast'] = {}
    const pitchersByLast: ItemsIndex['pitchersByLast'] = {}
  
    for (const it of Object.values(hitters)) {
      const ln = last(it.name)
      const cur = hittersByLast[ln]
      const entry = { name: it.name, bat: (it.bat_hand || 'R') as any, heightIn: toInches(it.height), ovr: it.ovr || 0 }
      if (!cur || entry.ovr > cur.ovr) hittersByLast[ln] = entry
    }
    for (const it of Object.values(pitchers)) {
      const ln = last(it.name)
      const maxVelo = Math.max(0, ...(it.pitches || []).map(p => Number(p.speed || 0)))
      const entry = {
        name: it.name, throw: (it.throw_hand || 'R') as any,
        heightIn: toInches(it.height), maxVelo,
        outlier: (it.quirks || []).some(q => /outlier/i.test(q)), ovr: it.ovr || 0
      }
      const cur = pitchersByLast[ln]
      if (!cur || entry.ovr > cur.ovr) pitchersByLast[ln] = entry
    }
  
    const data: ItemsIndex = { hittersByLast, pitchersByLast }
    CACHE = { at: Date.now(), data }
    return data
  }
  
  function pLimit(n: number) {
    let a = 0; const q: Array<() => void> = []
    const next = () => { a--; q.shift()?.() }
    return async function <T>(fn: () => Promise<T>): Promise<T> {
      if (a >= n) await new Promise<void>(r => q.push(r))
      a++; try { return await fn() } finally { next() }
    }
  }
  