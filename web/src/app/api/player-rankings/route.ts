// app/api/player-rankings/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { scoreTrueOvrFromRaw, loadTrueOvrModel } from '@/lib/trueOvr'
import { computeMetaOvr } from '@/lib/metaOvr'

export const runtime = 'nodejs' // reads local JSON model

const BASE = 'https://mlb25.theshow.com/apis/items.json'
const TTL_MS = 60 * 60 * 1000 // 1 hour
const CONCURRENCY = 10

type CacheEntry<T = any> = { t: number; data: T }
const cache = new Map<string, CacheEntry>()

function toNum(v: unknown): number | null {
  if (v == null) return null
  if (typeof v === 'number') return Number.isFinite(v) ? v : null
  const n = Number(String(v).replace(/[^0-9.-]/g, ''))
  return Number.isFinite(n) ? n : null
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

/**
 * Uniform-boost scaler:
 * - Only numeric features (non pos_*) are considered for normalization.
 * - We renormalize using ONLY features that are actually present on the item,
 *   so items with missing attributes aren’t penalized.
 */
function scoreWithScaledWeights(
  raw: any,
  boostKeys: Set<string>,
  handBonus: number = 0,
  boostFactor: number = 10
): number | null {
  const model = loadTrueOvrModel()
  const role = isPitcher(raw) ? 'pitcher' : 'hitter'
  const rm = model.models[role]
  if (!rm || rm.winner !== 'linear' || !rm.linear) return null

  const { intercept, coefficients } = rm.linear
  const posStr = String(raw?.display_position || '').toUpperCase()

  let dotNumScaled = 0
  let dotPos = 0
  let sumAbsPresent = 0
  let sumAbsScaledPresent = 0

  for (const [feat, w] of Object.entries(coefficients)) {
    if (feat.startsWith('pos_')) {
      const need = feat.slice(4).toUpperCase()
      dotPos += w * (posStr === need ? 1 : 0)
      continue
    }
    const present = (raw as any)[feat] != null
    const xVal = toNum((raw as any)[feat]) ?? 0
    const scale = boostKeys.has(feat) ? boostFactor : 1

    dotNumScaled += (w * scale) * xVal
    if (present) {
      sumAbsPresent += Math.abs(w)
      sumAbsScaledPresent += Math.abs(w) * scale
    }
  }

  let y = intercept + dotPos + dotNumScaled
  if (sumAbsPresent > 0 && sumAbsScaledPresent > 0) {
    const norm = sumAbsScaledPresent / sumAbsPresent
    y = intercept + dotPos + (dotNumScaled / norm)
  }
  return y + handBonus
}

/** Per-feature scales with present-only renormalization. */
function scoreWithPerFeatureScales(
  raw: any,
  scales: Record<string, number>,
  handBonus: number = 0
): number | null {
  const model = loadTrueOvrModel()
  const role = isPitcher(raw) ? 'pitcher' : 'hitter'
  const rm = model.models[role]
  if (!rm || rm.winner !== 'linear' || !rm.linear) return null

  const { intercept, coefficients } = rm.linear
  const posStr = String(raw?.display_position || '').toUpperCase()

  let dotNumScaled = 0
  let dotPos = 0
  let sumAbsPresent = 0
  let sumAbsScaledPresent = 0

  for (const [feat, w] of Object.entries(coefficients)) {
    if (feat.startsWith('pos_')) {
      const need = feat.slice(4).toUpperCase()
      dotPos += w * (posStr === need ? 1 : 0)
      continue
    }
    const present = (raw as any)[feat] != null
    const xVal = toNum((raw as any)[feat]) ?? 0
    const scale = scales[feat] ?? 1

    dotNumScaled += (w * scale) * xVal
    if (present) {
      sumAbsPresent += Math.abs(w)
      sumAbsScaledPresent += Math.abs(w) * scale
    }
  }

  let y = intercept + dotPos + dotNumScaled
  if (sumAbsPresent > 0 && sumAbsScaledPresent > 0) {
    const norm = sumAbsScaledPresent / sumAbsPresent
    y = intercept + dotPos + (dotNumScaled / norm)
  }
  return y + handBonus
}

/** Override some raw attrs (used for vsL / vsR) then apply uniform-boost scaler. */
function scoreWithOverridesAndScaling(
  raw: any,
  overrides: Record<string, unknown>,
  boostKeys: Set<string>,
  handBonus = 0,
  boostFactor: number = 5
): number | null {
  const merged = { ...raw, ...overrides }
  return scoreWithScaledWeights(merged, boostKeys, handBonus, boostFactor)
}

function normalizeItem(i: any) {
  // Base scores
  const true_ovr = scoreTrueOvrFromRaw(i)
  const meta_ovr = computeMetaOvr(i, typeof true_ovr === 'number' ? true_ovr : null)

  const bat_hand = i.bat_hand ?? null
  const throw_hand = i.throw_hand ?? null
  const isHitter = !isPitcher(i)

  // ---- facet key sets ----
  const POWER_KEYS   = new Set(['power_left', 'power_right'])
  const CONTACT_KEYS = new Set(['contact_left', 'contact_right'])
  const BASERUN_KEYS = new Set(['speed', 'baserunning_ability', 'baserunning_aggression'])
  const DEFENSE_KEYS = new Set(['speed', 'fielding_ability', 'arm_strength', 'arm_accuracy', 'reaction_time', 'blocking'])

  // Platoon bonuses (small flat bump)
  const vsLBonus = bat_hand === 'R' || bat_hand === 'S' ? 2 : 0
  const vsRBonus = bat_hand === 'L' || bat_hand === 'S' ? 2 : 0

  // VS LEFT / VS RIGHT duplication so the off-side doesn’t matter; then 5x boost on all side stats
  const cl = toNum(i.contact_left)
  const pl = toNum(i.power_left)
  const cr = toNum(i.contact_right)
  const pr = toNum(i.power_right)

  const vsLeftOverrides: Record<string, unknown> = {}
  if (cl != null) vsLeftOverrides['contact_right'] = cl
  if (pl != null) vsLeftOverrides['power_right']   = pl
  const VS_LEFT_ALL_KEYS = new Set(['contact_left','contact_right','power_left','power_right'])

  const vsRightOverrides: Record<string, unknown> = {}
  if (cr != null) vsRightOverrides['contact_left'] = cr
  if (pr != null) vsRightOverrides['power_left']   = pr
  const VS_RIGHT_ALL_KEYS = new Set(['contact_left','contact_right','power_left','power_right'])

  const vs_left  = isHitter ? scoreWithOverridesAndScaling(i, vsLeftOverrides,  VS_LEFT_ALL_KEYS,  vsLBonus, 5) : null
  const vs_right = isHitter ? scoreWithOverridesAndScaling(i, vsRightOverrides, VS_RIGHT_ALL_KEYS, vsRBonus, 5) : null

  // Power / Contact facets (10x)
  const power    = isHitter ? scoreWithScaledWeights(i, POWER_KEYS,   0, 10) : null
  const contact  = isHitter ? scoreWithScaledWeights(i, CONTACT_KEYS, 0, 10) : null

  // Bunting facet — stronger emphasis on bunting stats than speed, with present-only renorm
  // (These scales are intentionally big to overcome the base model’s small bunting weights.)
  const buntingScales = {
    bunting_ability: 300,
    drag_bunting_ability: 300,
    speed: 25,
  }
  const bunting  = isHitter ? scoreWithPerFeatureScales(i, buntingScales, 0) : null

  // Baserunning & Defense facets (heavy boosts)
  let  baserun   = isHitter ? scoreWithScaledWeights(i, BASERUN_KEYS, 0, 75) : null
  const defense  =           scoreWithScaledWeights(i, DEFENSE_KEYS,  0, 75)

  // Height tweak for baserunning: map 5'0" -> -5, 6'0" -> 0, 7'0" -> +5 (clamped)
  if (isHitter && baserun != null) {
    const hIn = parseHeightInches(i.height)
    if (hIn != null) {
      const clamped = clamp(hIn, 60, 84)   // 5'0" .. 7'0"
      const deltaFrom72 = clamped - 72     // inches from 6'0"
      const slope = 5 / 12                 // points per foot
      baserun += deltaFrom72 * slope
    }
  }

  return {
    id: i.uuid ?? null,
    name: i.name ?? null,
    rarity: i.rarity ?? null,
    team: i.team_short_name ?? i.team ?? null,
    display_position: i.display_position ?? null,
    ovr: toNum(i.ovr ?? i.new_rank),
    image: i.baked_img ?? i.img ?? null,
    type: i.type ?? null,
    is_hitter: isHitter,
    bat_hand,
    throw_hand,
    height: i.height ?? null,
    height_in: parseHeightInches(i.height),

    // core scores
    true_ovr: Number.isFinite(true_ovr as number) ? (true_ovr as number) : null,
    meta_ovr: Number.isFinite(meta_ovr as number) ? (meta_ovr as number) : null,

    // expose raw attrs (optional UI/tooltips)
    contact_left: toNum(i.contact_left),
    contact_right: toNum(i.contact_right),
    power_left: toNum(i.power_left),
    power_right: toNum(i.power_right),
    bunting_ability: toNum(i.bunting_ability),
    drag_bunting_ability: toNum(i.drag_bunting_ability),
    speed: toNum(i.speed),
    baserunning_ability: toNum(i.baserunning_ability),
    baserunning_aggression: toNum(i.baserunning_aggression),
    fielding_ability: toNum(i.fielding_ability),
    arm_strength: toNum(i.arm_strength),
    arm_accuracy: toNum(i.arm_accuracy),
    reaction_time: toNum(i.reaction_time),
    blocking: toNum(i.blocking),

    // derived facets (raw floats; UI caps to 125.0/1dp)
    vs_left,
    vs_right,
    power,
    contact,
    bunting,
    baserunning: baserun,
    defense,
  }
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

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url)
    const force = url.searchParams.get('force') // ?force=1 to bust cache manually
    const cacheKey = 'items:mlb_card:trueovr+derived+meta'

    const now = Date.now()
    const hit = cache.get(cacheKey)
    if (!force && hit && now - hit.t < TTL_MS) {
      return NextResponse.json(
        { items: hit.data.items, meta: { cached: true, cached_at: hit.t } },
        { headers: { 'Cache-Control': 's-maxage=3600, stale-while-revalidate=60' } }
      )
    }

    // page 1 to get total_pages
    const r1 = await fetch(`${BASE}?type=mlb_card&page=1`, { headers: { accept: 'application/json' } })
    if (!r1.ok) return NextResponse.json({ error: `Upstream ${r1.status}` }, { status: 502 })
    const j1 = await r1.json()
    const totalPages = Number(j1.total_pages ?? 1) || 1
    const items1 = Array.isArray(j1.items) ? j1.items.map(normalizeItem) : []

    // fetch remaining pages concurrently
    const pages: number[] = []
    for (let p = 2; p <= totalPages; p++) pages.push(p)

    const results = await mapPool(pages, CONCURRENCY, async (p) => {
      const r = await fetch(`${BASE}?type=mlb_card&page=${p}`, { headers: { accept: 'application/json' } })
      if (!r.ok) return []
      const j = await r.json()
      return Array.isArray(j.items) ? j.items.map(normalizeItem) : []
    })

    // dedupe by id (or fallback to name)
    const dedup = new Map<string, any>()
    for (const it of [...items1, ...results.flat()]) {
      const key = String(it.id ?? it.name)
      if (!dedup.has(key)) dedup.set(key, it)
    }
    const items = Array.from(dedup.values())

    cache.set(cacheKey, { t: now, data: { items } })

    return NextResponse.json(
      { items, meta: { cached: false, fetched_at: now, pages: totalPages, count: items.length } },
      { headers: { 'Cache-Control': 's-maxage=3600, stale-while-revalidate=60' } }
    )
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? 'unknown error' }, { status: 500 })
  }
}
