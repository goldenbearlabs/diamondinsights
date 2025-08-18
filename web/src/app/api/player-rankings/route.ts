// app/api/player-rankings/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { scoreTrueOvrFromRaw } from '@/lib/trueOvr'
import { computeMetaOvr, computeMetaFacet, type MetaFacet } from '@/lib/metaOvr'
import { computePitcherMetaOvr, computePitcherFacet } from '@/lib/metaOvrPitcher'

export const runtime = 'nodejs'

const BASE = 'https://mlb25.theshow.com/apis/items.json'
const TTL_MS = 60 * 60 * 1000
const CONCURRENCY = 10
const PRIMARY_LIMIT_PER_POS = 250

type CacheEntry<T = any> = { t: number; data: T }
const cache = new Map<string, CacheEntry>()

function toNum(v: unknown): number | null {
  if (v == null) return null
  if (typeof v === 'number') return Number.isFinite(v) ? v : null
  const n = Number(String(v).replace(/[^0-9.-]/g, ''))
  return Number.isFinite(n) ? n : null
}

function normalizePos(p: string): string | null {
  const s = p.trim().toUpperCase()
  const map: Record<string, string> = {
    'CATCHER': 'C', 'C': 'C',
    'FIRST BASE': '1B', '1B': '1B',
    'SECOND BASE': '2B', '2B': '2B',
    'THIRD BASE': '3B', '3B': '3B',
    'SHORTSTOP': 'SS', 'SS': 'SS',
    'LEFT FIELD': 'LF', 'LF': 'LF',
    'CENTER FIELD': 'CF', 'CF': 'CF',
    'RIGHT FIELD': 'RF', 'RF': 'RF',
    'DH': 'DH',
    'SP': 'SP', 'RP': 'RP', 'CP': 'CP'
  }
  return map[s] ?? null
}
function normalizePosStrict(p: unknown): string | null {
  const s = String(p ?? '').toUpperCase().trim()
  const first = s.split(/[\/,]/)[0]?.trim() || ''
  return normalizePos(first)
}
function getPrimaryKey(raw: any): string | null {
  return normalizePosStrict(raw?.primary_position) ?? normalizePosStrict(raw?.display_position)
}

function isPitcher(raw: any): boolean {
  if (typeof raw?.is_hitter === 'boolean') return !raw.is_hitter
  const pos = String(raw?.display_position || '').toUpperCase()
  return pos === 'SP' || pos === 'RP' || pos === 'CP'
}

function clamp(n: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, n))
}
function parseHeightInches(h: unknown): number | null {
  const s = String(h ?? '').trim()
  const m = s.match(/^(\d+)\s*'\s*(\d+)?/)
  if (!m) return null
  const feet = Number(m[1] || 0)
  const inches = Number(m[2] || 0)
  const total = feet * 12 + inches
  return Number.isFinite(total) ? total : null
}

function computeFacetSafe(rawAny: any, facet: MetaFacet): number | null {
  const raw = rawAny ?? {}
  const disp = normalizePosStrict(raw?.display_position)
  const v1 = computeMetaFacet({ ...raw, display_position: disp }, facet)
  if (v1 != null) return v1
  const prim = normalizePosStrict(raw?.primary_position)
  if (!prim) return null
  return computeMetaFacet({ ...raw, display_position: prim }, facet)
}

/* secondaries & OOP */
function parseSecondaryPositions(raw: any): string[] {
  const s = String(raw?.display_secondary_positions ?? '').trim()
  if (!s) return []
  const primary = normalizePosStrict(raw?.display_position)
  const allowed = new Set(['C', '1B', '2B', '3B', 'SS', 'LF', 'CF', 'RF'])
  return s
    .split(',')
    .flatMap(tok => tok.split('/'))
    .map(t => normalizePosStrict(t) ?? '')
    .filter(Boolean)
    .filter(p => p !== 'DH')
    .filter(p => allowed.has(p))
    .filter(p => p !== primary)
    .filter(p => !isPitcher({ display_position: p }))
}

const OOP_MAP: Record<string, Record<string, number>> = {
  C: { '1B': 0.85 },
  '1B': { '3B': 0.90 },
  '2B': { '1B': 0.85, 'SS': 0.90 },
  SS: { '1B': 0.85, '2B': 0.90, '3B': 0.85, 'LF': 0.85, 'CF': 0.85, 'RF': 0.85 },
  '3B': { '1B': 0.90 },
  CF: { 'LF': 0.90, 'RF': 0.90 },
  LF: { 'RF': 0.90 },
  RF: { 'LF': 0.90 },
}

/* normalize to common shape + compute metas */
function normalizeItem(i: any, overrides: Record<string, unknown> = {}) {
    const merged = { ...i, ...overrides }
  
    const base_ovr = toNum(merged.ovr ?? merged.new_rank)
  
    const true_ovr_raw = scoreTrueOvrFromRaw(merged)
    const true_ovr = Number.isFinite(true_ovr_raw as number)
      ? (true_ovr_raw as number)
      : (base_ovr ?? null)
  
    const pitcher = isPitcher(merged)
    const meta_ovr_raw = pitcher
      ? computePitcherMetaOvr(merged, typeof true_ovr === 'number' ? true_ovr : (base_ovr ?? null))
      : computeMetaOvr(merged, typeof true_ovr === 'number' ? true_ovr : (base_ovr ?? null))
    const meta_ovr = Number.isFinite(meta_ovr_raw as number)
      ? (meta_ovr_raw as number)
      : (typeof true_ovr === 'number' ? true_ovr : (base_ovr ?? null))
  
    // Facets...
    const meta_vs_left  = pitcher ? computePitcherFacet(merged, 'vs_left')  : computeFacetSafe(merged, 'vs_left')
    const meta_vs_right = pitcher ? computePitcherFacet(merged, 'vs_right') : computeFacetSafe(merged, 'vs_right')
    const otherFacetValue = pitcher ? meta_ovr : null
    const meta_power       = pitcher ? otherFacetValue : computeFacetSafe(merged, 'power')
    const meta_contact     = pitcher ? otherFacetValue : computeFacetSafe(merged, 'contact')
    const meta_bunting     = pitcher ? otherFacetValue : computeFacetSafe(merged, 'bunting')
    const meta_baserunning = pitcher ? otherFacetValue : computeFacetSafe(merged, 'baserunning')
    const meta_defense     = pitcher ? otherFacetValue : computeFacetSafe(merged, 'defense')
  
    const bat_hand = merged.bat_hand ?? null
    const throw_hand = merged.throw_hand ?? null
    const primary_position = String(merged.primary_position ?? merged.display_position ?? '').toUpperCase() || null
  
    // 👇 NEW: explicitly expose series (with light fallbacks)
    const series =
      (typeof merged.series === 'string' && merged.series.trim()) ? merged.series.trim()
      : (typeof merged.set_name === 'string' && merged.set_name.trim()) ? merged.set_name.trim()
      : (typeof merged.program === 'string' && merged.program.trim()) ? merged.program.trim()
      : null
  
    return {
      id: merged.uuid ?? merged.id ?? merged.name ?? null,
      name: merged.name ?? null,
      rarity: merged.rarity ?? null,
      team: merged.team_short_name ?? merged.team ?? null,
      display_position: merged.display_position ?? null,
      primary_position,
      ovr: base_ovr,
      image: merged.baked_img ?? merged.img ?? null,
      type: merged.type ?? null,
      is_hitter: !pitcher,
      bat_hand,
      throw_hand,
      height: merged.height ?? null,
      height_in: parseHeightInches(merged.height),
  
      // ✅ make series available to downstream routes
      series,
  
      true_ovr,
      meta_ovr,
  
      contact_left: toNum(merged.contact_left),
      contact_right: toNum(merged.contact_right),
      power_left: toNum(merged.power_left),
      power_right: toNum(merged.power_right),
      bunting_ability: toNum(merged.bunting_ability),
      drag_bunting_ability: toNum(merged.drag_bunting_ability),
      speed: toNum(merged.speed),
      baserunning_ability: toNum(merged.baserunning_ability),
      baserunning_aggression: toNum(merged.baserunning_aggression),
      fielding_ability: toNum(merged.fielding_ability),
      arm_strength: toNum(merged.arm_strength),
      arm_accuracy: toNum(merged.arm_accuracy),
      reaction_time: toNum(merged.reaction_time),
      blocking: toNum(merged.blocking),
  
      vs_left: meta_vs_left,
      vs_right: meta_vs_right,
      power: meta_power,
      contact: meta_contact,
      bunting: meta_bunting,
      baserunning: meta_baserunning,
      defense: meta_defense,
    }
  }

/* expand primaries + (optional) secondaries/OOP */
function expandPlayer(raw: any, allowSecondaries: boolean) {
  const primKey = getPrimaryKey(raw)
  const out = [normalizeItem(raw, { primary_position: primKey ?? null })]
  if (!allowSecondaries || isPitcher(raw)) return out

  const secArray = parseSecondaryPositions(raw)
  const secSet = new Set(secArray)
  const SECONDARY_FACTOR = 0.95

  for (const pos of secArray) {
    const overrides: Record<string, unknown> = {
      display_position: pos,
      primary_position: primKey ?? pos,
      uuid: `${raw.uuid ?? raw.id ?? raw.name}|${pos}`,
    }
    const f = toNum(raw.fielding_ability); if (f != null) overrides.fielding_ability = f * SECONDARY_FACTOR
    const r = toNum(raw.reaction_time);    if (r != null) overrides.reaction_time   = r * SECONDARY_FACTOR
    const aa = toNum(raw.arm_accuracy);    if (aa != null) overrides.arm_accuracy   = aa * SECONDARY_FACTOR
    out.push(normalizeItem(raw, overrides))
  }

  const oop = OOP_MAP[primKey ?? ''] || {}
  for (const [pos, factor] of Object.entries(oop)) {
    if (secSet.has(pos)) continue
    if (isPitcher({ display_position: pos })) continue
    const overrides: Record<string, unknown> = {
      display_position: pos,
      primary_position: primKey ?? pos,
      uuid: `${raw.uuid ?? raw.id ?? raw.name}|${pos}`,
    }
    const f = toNum(raw.fielding_ability); if (f != null) overrides.fielding_ability = f * factor
    const r = toNum(raw.reaction_time);    if (r != null) overrides.reaction_time   = r * factor
    const aa = toNum(raw.arm_accuracy);    if (aa != null) overrides.arm_accuracy   = aa * factor
    out.push(normalizeItem(raw, overrides))
  }

  return out
}

/* pick Top N by base OVR per primary position */
function pickTopByPrimary(raws: any[], perPos = PRIMARY_LIMIT_PER_POS): any[] {
  const groups: Record<string, any[]> = Object.create(null)
  for (const r of raws) {
    const pos = String(r?.display_position || '').toUpperCase()
    if (!pos) continue
    if (!groups[pos]) groups[pos] = []
    groups[pos].push(r)
  }
  const out: any[] = []
  for (const arr of Object.values(groups)) {
    arr.sort((a, b) => {
      const sb = toNum(b?.ovr ?? b?.new_rank) ?? -Infinity
      const sa = toNum(a?.ovr ?? a?.new_rank) ?? -Infinity
      return sb - sa
    })
    out.push(...arr.slice(0, perPos))
  }
  return out
}

/* pool helper */
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

/* GET */
export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url)
    const force = url.searchParams.get('force')
    const allowSecondaries = url.searchParams.has('allow_secondaries')

    const cacheKey = `items:mlb_card:meta+facets:${allowSecondaries ? 'withsec' : 'nosec'}:top${PRIMARY_LIMIT_PER_POS}`

    const now = Date.now()
    const hit = cache.get(cacheKey)
    if (!force && hit && now - hit.t < TTL_MS) {
      try {
        const cachedPitchNames = hit.data?.meta?.pitch_names
        if (Array.isArray(cachedPitchNames)) {
          console.log('[pitch names][cached]', cachedPitchNames)
        }
      } catch {}
      return NextResponse.json(
        { items: hit.data.items, meta: hit.data.meta },
        { headers: { 'Cache-Control': 's-maxage=3600, stale-while-revalidate=60' } }
      )
    }

    const r1 = await fetch(`${BASE}?type=mlb_card&page=1`, { headers: { accept: 'application/json' } })
    if (!r1.ok) return NextResponse.json({ error: `Upstream ${r1.status}` }, { status: 502 })
    const j1 = await r1.json()
    const totalPages = Number(j1.total_pages ?? 1) || 1

    const itemsPage1: any[] = Array.isArray(j1.items) ? j1.items : []
    const pages: number[] = []
    for (let p = 2; p <= totalPages; p++) pages.push(p)

    const rest = await mapPool(pages, CONCURRENCY, async (p) => {
      const r = await fetch(`${BASE}?type=mlb_card&page=${p}`, { headers: { accept: 'application/json' } })
      if (!r.ok) return []
      const j = await r.json()
      return Array.isArray(j.items) ? j.items : []
    })

    const rawDedup = new Map<string, any>()
    for (const it of [...itemsPage1, ...rest.flat()]) {
      const key = String(it?.uuid ?? it?.id ?? it?.name ?? '')
      if (!key) continue
      if (!rawDedup.has(key)) rawDedup.set(key, it)
    }
    const allRaw = Array.from(rawDedup.values())

    const primaryTop = pickTopByPrimary(allRaw, PRIMARY_LIMIT_PER_POS)
    const expanded = primaryTop.flatMap((raw) => expandPlayer(raw, allowSecondaries))

    const outMap = new Map<string, any>()
    for (const it of expanded) {
      const key = String(it?.id ?? it?.name ?? '')
      if (!key) continue
      if (!outMap.has(key)) outMap.set(key, it)
    }
    const items = Array.from(outMap.values())

    const pitchNameSet = new Set<string>()
    for (const it of allRaw) {
      if (!isPitcher(it)) continue
      const ps = Array.isArray(it?.pitches) ? it.pitches : []
      for (const p of ps) {
        const nm = String(p?.name ?? '').trim()
        if (nm) pitchNameSet.add(nm)
      }
    }
    const pitchNames = Array.from(pitchNameSet).sort()
    console.log('[pitch names]', pitchNames)

    const meta = {
      cached: false,
      fetched_at: now,
      pages: totalPages,
      total_raw: allRaw.length,
      primary_selected: primaryTop.length,
      expanded_count: items.length,
      allow_secondaries: !!allowSecondaries,
      per_pos_limit: PRIMARY_LIMIT_PER_POS,
      pitch_names: pitchNames,
    }

    cache.set(cacheKey, { t: now, data: { items, meta } })

    return NextResponse.json(
      { items, meta },
      { headers: { 'Cache-Control': 's-maxage=3600, stale-while-revalidate=60' } }
    )
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? 'unknown error' }, { status: 500 })
  }
}
