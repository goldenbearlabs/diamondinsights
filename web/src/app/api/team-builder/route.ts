import { NextRequest, NextResponse } from 'next/server'

type Metric =
  | 'true_ovr' | 'meta_ovr'
  | 'power' | 'contact' | 'bunting' | 'defense' | 'baserunning'
  | 'vs_left' | 'vs_right'

type Card = {
  id: string | number | null
  name: string | null
  team?: string | null
  display_position?: string | null
  primary_position?: string | null
  ovr: number | null
  true_ovr?: number | null
  meta_ovr?: number | null
  vs_left?: number | null
  vs_right?: number | null
  power?: number | null
  contact?: number | null
  bunting?: number | null
  baserunning?: number | null
  defense?: number | null
  bat_hand?: 'L' | 'R' | 'S' | null
  throw_hand?: 'L' | 'R' | null
  contact_left?: number | null
  contact_right?: number | null
  power_left?: number | null
  power_right?: number | null
  speed?: number | null
  baserunning_ability?: number | null
  image?: string | null

  // pitcher-only fields (exposed by /api/player-rankings)
  pitch_velocity?: number | null
  pitch_control?: number | null
  pitch_movement?: number | null
  hits_per_bf?: number | null
  k_per_bf?: number | null
  bb_per_bf?: number | null
  pitching_clutch?: number | null
  pitches?: { name?: string; speed?: number; control?: number; movement?: number }[]
}

const FIELD_POS: Array<'C'|'1B'|'2B'|'3B'|'SS'|'LF'|'CF'|'RF'> = ['C','1B','2B','3B','SS','LF','CF','RF']
const IF_SET = new Set(['C','1B','2B','3B','SS'])
const OF_SET = new Set(['LF','CF','RF'])
const SCARCITY_ORDER: Array<'C'|'SS'|'CF'|'3B'|'2B'|'RF'|'LF'|'1B'> = ['C','SS','CF','3B','2B','RF','LF','1B']

const isPitcherPos = (p?: string|null) => {
  const s = String(p ?? '').toUpperCase()
  return s === 'SP' || s === 'RP' || s === 'CP'
}
const baseId = (id: string|number|null) => String(id ?? '').split('|')[0]
const n = (v: any, d = 0) => (typeof v === 'number' && Number.isFinite(v) ? v : d)

/* ---------------- metric helpers ---------------- */
function scoreByMetric(c: Card, metric: Metric): number {
  switch (metric) {
    case 'meta_ovr':   return n(c.meta_ovr, -1)
    case 'true_ovr':   return n(c.true_ovr ?? c.ovr, -1)
    case 'power':      return n(c.power, -1)
    case 'contact':    return n(c.contact, -1)
    case 'bunting':    return n(c.bunting, -1)
    case 'defense':    return n(c.defense, -1)
    case 'baserunning':return n(c.baserunning, -1)
    case 'vs_left':    return n(c.vs_left, -1)
    case 'vs_right':   return n(c.vs_right, -1)
    default:           return n(c.meta_ovr ?? c.true_ovr ?? c.ovr, -1)
  }
}

// For pitchers: honor only true_ovr / vs_left / vs_right; otherwise meta_ovr
function pitcherScore(c: Card, metric: Metric): number {
  switch (metric) {
    case 'true_ovr':  return n(c.true_ovr ?? c.meta_ovr, -1)
    case 'vs_left':   return n(c.vs_left ?? c.meta_ovr, -1)
    case 'vs_right':  return n(c.vs_right ?? c.meta_ovr, -1)
    default:          return n(c.meta_ovr, -1)
  }
}

/* ---------------- batting order heuristics ---------------- */
const avg = (...xs: Array<number | null | undefined>) => {
  const arr = xs.map(x => n(x)).filter(x => Number.isFinite(x))
  if (!arr.length) return 0
  return arr.reduce((a,b)=>a+b,0)/arr.length
}
const contactAvg = (c: Card) => avg(c.contact_left, c.contact_right, c.contact)
const powerAvg   = (c: Card) => avg(c.power_left, c.power_right, c.power)
const speed01    = (c: Card) => {
  const sp = n(c.speed), br = n(c.baserunning_ability)
  return Math.max(0, Math.min(1, (0.7*sp + 0.3*br) / 125))
}
const vsBalance  = (c: Card) => {
  const vl = n(c.vs_left), vr = n(c.vs_right)
  if (!vl && !vr) return 0
  const diff = Math.abs(vl - vr)
  return 125 * (1 - Math.min(1, diff / 125))
}
const overallHit = (c: Card) => 0.6*contactAvg(c) + 0.4*powerAvg(c)

const scoreLeadoff = (c: Card) =>
  0.50*contactAvg(c) + 0.30*(speed01(c)*125) + 0.15*powerAvg(c) + 0.05*avg(c.vs_left, c.vs_right)
const scoreTwoHole = (c: Card) => {
  const switchBonus = c.bat_hand === 'S' ? 8 : 0
  return 0.45*overallHit(c) + 0.20*(speed01(c)*125) + 0.25*vsBalance(c) + switchBonus
}
const scoreThreeHole = (c: Card) => 0.75*powerAvg(c) + 0.25*contactAvg(c)
const scoreCleanup   = (c: Card) => 0.70*powerAvg(c) + 0.30*overallHit(c)
const scoreDownOrder = (c: Card) => overallHit(c)

const handOf = (c: Card) => c.bat_hand ?? 'R'
const sameHandAdj = (a?: Card, b?: Card) => {
  const ha = a ? handOf(a) : null
  const hb = b ? handOf(b) : null
  if (!ha || !hb) return false
  if (ha === 'S' || hb === 'S') return false
  return ha === hb
}

function selectBest(
  pool: Card[],
  used: Set<string>,
  scorer: (c: Card)=>number,
  prev?: Card
): Card | null {
  const wantOpp = prev ? (handOf(prev) === 'L' ? 'R' : handOf(prev) === 'R' ? 'L' : null) : null
  const candidates = pool.filter(c => !used.has(baseId(c.id)))
  if (!candidates.length) return null

  let filtered = candidates.filter(c => {
    if (!prev || !wantOpp) return true
    const h = handOf(c)
    return h === 'S' || h === wantOpp
  })
  if (filtered.length === 0) filtered = candidates

  filtered.sort((a,b)=> scorer(b) - scorer(a))
  return filtered[0] ?? null
}

function buildBattingOrderStrict(starters: Record<string, Card>, dh: Card): Card[] {
  const pool = [...FIELD_POS.map(p => starters[p]), dh].filter(Boolean) as Card[]
  const used = new Set<string>()

  const take = (scorer: (c: Card)=>number, prev?: Card) => {
    const pick = selectBest(pool, used, scorer, prev)
    if (pick) used.add(baseId(pick.id))
    return pick
  }

  const one   = take(scoreLeadoff)
  const two   = take(scoreTwoHole,   one || undefined)
  const three = take(scoreThreeHole, two || one || undefined)
  const four  = take(scoreCleanup,   three || two || undefined)

  const rest: Card[] = []
  let prev = four || three || two || one || null
  for (let i = 0; i < 5; i++) {
    const pick = take(scoreDownOrder, prev || undefined)
    if (pick) { rest.push(pick); prev = pick }
  }
  const order = [one, two, three, four, ...rest].filter(Boolean) as Card[]

  // Repair pass if any accidental same-hand adjacency remains
  for (let i = 1; i < order.length; i++) {
    if (sameHandAdj(order[i-1], order[i])) {
      for (let j = i+1; j < order.length; j++) {
        if (!sameHandAdj(order[i-1], order[j])) {
          const tmp = order[i]; order[i] = order[j]; order[j] = tmp
          break
        }
      }
    }
  }
  return order
}

/* ---------------- bench roles (split & robust) ---------------- */
function pickBench(allHitters: Card[], startersRoots: Set<string>) {
  const pool = allHitters.filter(h => !startersRoots.has(baseId(h.id)))
  const isOF = (c: Card) => OF_SET.has(String(c.display_position ?? '').toUpperCase())
  const isIF = (c: Card) => IF_SET.has(String(c.display_position ?? '').toUpperCase())
  const speed01 = (c: Card) => Math.max(0, Math.min(1, (0.7*n(c.speed) + 0.3*n(c.baserunning_ability)) / 125))

  const used = new Set<string>()
  const take = (arr: Card[] | null | undefined) => {
    const c = (arr ?? []).find(x => !used.has(baseId(x.id)))
    if (!c) return null
    used.add(baseId(c.id)); return c
  }
  const bestBy = (score: (c: Card)=>number, filter?: (c: Card)=>boolean) =>
    pool.filter(c => !used.has(baseId(c.id)) && (!filter || filter(c)))
        .sort((a,b)=> score(b)-score(a))

  // Pinch runner (prefer OF), then fastest overall
  const prList = bestBy(c => 0.75*(speed01(c)*125) + 0.25*n(c.baserunning_ability,0), isOF)
               .concat(bestBy(c => 0.80*(speed01(c)*125) + 0.20*n(c.baserunning_ability,0)))
  const pinch_runner = take(prList) ?? take(pool)

  // Defensive sub (prefer OF), fallback IF, then any best defender
  const defList = bestBy(c => n(c.defense,0), isOF)
                .concat(bestBy(c => n(c.defense,0), isIF))
                .concat(bestBy(c => n(c.defense,0)))
  const defensive_sub = take(defList) ?? take(pool)

  // Platoon bats
  const vsLlist = bestBy(c => n(c.vs_left,0))
  const platoon_vs_left = take(vsLlist) ?? take(pool)

  const vsRlist = bestBy(c => n(c.vs_right,0))
  const platoon_vs_right = take(vsRlist) ?? take(pool)

  return { pinch_runner, platoon_vs_left, platoon_vs_right, defensive_sub }
}

/* ---------------- starters + DH (global optimizer) ---------------- */
type Cand = { c: Card, score: number }

function pickStartersByMetricOptimized(items: Card[], metric: Metric) {
  const hitters = items.filter(i => !isPitcherPos(i.display_position))
  const PER_POS_CAP = 14
  const byPos: Record<string, Cand[]> = { C:[], '1B':[], '2B':[], '3B':[], SS:[], LF:[], CF:[], RF:[] }
  for (const h of hitters) {
    const k = String(h.display_position ?? '').toUpperCase()
    if (!(k in byPos)) continue
    byPos[k].push({ c: h, score: scoreByMetric(h, metric) })
  }
  for (const k of Object.keys(byPos)) {
    byPos[k].sort((a,b)=> b.score - a.score)
    byPos[k] = byPos[k].slice(0, PER_POS_CAP)
  }

  const positions = SCARCITY_ORDER.slice().sort((a,b)=> byPos[a].length - byPos[b].length)
  const bestPerPos = positions.map(p => (byPos[p][0]?.score ?? 0))

  let bestScore = -Infinity
  let bestPick: Record<string, Card> = Object.create(null)
  const used = new Set<string>()

  function dfs(idx: number, running: number, chosen: Record<string, Card>) {
    if (idx >= positions.length) {
      if (running > bestScore) { bestScore = running; bestPick = { ...chosen } }
      return
    }
    const optimistic = running + bestPerPos.slice(idx).reduce((s,x)=>s+x,0)
    if (optimistic <= bestScore) return

    const pos = positions[idx]
    const cands = byPos[pos]
    for (let i = 0; i < cands.length; i++) {
      const root = baseId(cands[i].c.id)
      if (used.has(root)) continue
      used.add(root)
      chosen[pos] = cands[i].c
      dfs(idx+1, running + cands[i].score, chosen)
      used.delete(root)
      delete chosen[pos]
    }
  }
  dfs(0, 0, {})

  const takenRoots = new Set(Object.values(bestPick).map(x => baseId(x.id)))
  const dh = hitters
    .filter(h => !takenRoots.has(baseId(h.id)))
    .slice().sort((a,b)=> scoreByMetric(b, metric) - scoreByMetric(a, metric))[0] || null

  const order = dh ? buildBattingOrderStrict(bestPick, dh)
                   : buildBattingOrderStrict(bestPick, Object.values(bestPick)[0])

  const startersRoots = new Set<string>([...Object.values(bestPick), dh].filter(Boolean).map(x => baseId((x as Card).id)))
  const bench = pickBench(hitters, startersRoots)

  return { starters: bestPick, dh, order, bench }
}

/* ---------------- pitchers: rotation + diverse bullpen (metric-aware) ---------------- */
function hand(c: Card): 'L'|'R'|'?' { return (c.throw_hand === 'L' || c.throw_hand === 'R') ? c.throw_hand : '?' }

type PType =
  | 'FF' | 'FT' | 'SI' | 'FC' | 'SL' | 'SWP' | 'CB' | 'KC' | 'SV' | 'SC'
  | 'SPL' | 'FRK' | 'CH' | 'CCH' | 'VCH' | 'PAL' | 'KN' | 'OTHER'
const pType = (name?: string): PType => {
  const s = String(name ?? '').toLowerCase().trim()
  if (/(4[-\s]?seam)/.test(s)) return 'FF'
  if (/(2[-\s]?seam)/.test(s)) return 'FT'
  if (/sinker/.test(s)) return 'SI'
  if (/cutter|cut fast|fc/.test(s)) return 'FC'
  if (/sweeper\b/.test(s)) return 'SWP'
  if (/slider|slutter/.test(s)) return 'SL'
  if (/sweeping curve/.test(s)) return 'CB'
  if (/12[-\s]?6|curveball\b|\bcurve\b/.test(s)) return 'CB'
  if (/knuckle-?curve/.test(s)) return 'KC'
  if (/slurve/.test(s)) return 'SV'
  if (/screwball/.test(s)) return 'SC'
  if (/splitter/.test(s)) return 'SPL'
  if (/forkball|fork/.test(s)) return 'FRK'
  if (/vulcan/.test(s)) return 'VCH'
  if (/circle/.test(s)) return 'CCH'
  if (/change/.test(s)) return 'CH'
  if (/palmball/.test(s)) return 'PAL'
  if (/knuckle$/.test(s)) return 'KN'
  return 'OTHER'
}
const mphOf = (c: Card, t: PType): number => {
  const arr = Array.isArray(c.pitches) ? c.pitches : []
  const found = arr.find(p => pType(p.name) === t)
  return typeof found?.speed === 'number' ? (found.speed as number) : 0
}
const has = (c: Card, t: PType) => mphOf(c,t) > 0
const tri = (x: number, a: number, b: number, c: number) => x<=a||x>=c ? 0 : (x<a ? (x-a)/(b-a) : (c-x)/(c-b))

function mixSynergyScore(c: Card): number {
  const ff = mphOf(c,'FF') || 0
  const si = mphOf(c,'SI') || 0
  const fc = mphOf(c,'FC') || 0
  const chs = ['CH','CCH','VCH'] as const
  const splitters = ['SPL','FRK'] as const

  let s = 0
  if (si && fc) {
    const gap = Math.abs(si - fc)
    const closeness = Math.max(0, Math.min(1, (3 - gap)/3))
    s += 25 * closeness * (0.6 + 0.4*(n(c.pitch_control,0)/125))
  }

  const bestCH = Math.max(...chs.map(t => mphOf(c, t as unknown as PType)))
  const bestSPL = Math.max(...splitters.map(t => mphOf(c, t as unknown as PType)))
  const bestOff = Math.max(bestCH, bestSPL)
  if (ff && bestOff) {
    const gap = Math.max(ff - bestOff, 0)
    const w = Math.max(tri(gap,6,11,16), tri(gap,4,10,18)*0.7, tri(gap,9,13,20))
    s += 30 * w * (0.6 + 0.4*(n(c.pitch_control,0)/125))
  }

  const sl = mphOf(c,'SL')
  if (sl) s += sl >= 92 ? 12 : sl >= 88 ? 8 : 4

  const hasAS = has(c,'SI') || has(c,'FT') || has(c,'CH') || has(c,'CCH') || has(c,'VCH') || has(c,'SPL') || has(c,'FRK') || has(c,'SC')
  const hasGS = has(c,'FC') || has(c,'SL')
  if (hasAS && hasGS) s += 10

  const onlyVerticalish =
    (has(c,'FF') ? 1 : 0) +
    (has(c,'CB') || has(c,'KC') || has(c,'SV') || has(c,'SWP') ? 1 : 0)
  if (onlyVerticalish >= 2 && !hasGS) s -= 8

  s *= (0.8 + 0.2*(n(c.pitch_control,0)/125))
  return Math.max(0, Math.min(125, s))
}

function pickRotation(items: Card[], metric: Metric) {
  return items.filter(i => String(i.display_position).toUpperCase() === 'SP')
    .slice().sort((a,b) => pitcherScore(b, metric) - pitcherScore(a, metric)).slice(0,5)
}

function pickBullpen(items: Card[], metric: Metric) {
  const rawPool = items.filter(i => {
    const p = String(i.display_position).toUpperCase()
    return p === 'RP' || p === 'CP'
  })
  const pool = rawPool.slice().sort((a,b)=> pitcherScore(b, metric) - pitcherScore(a, metric)).slice(0, 50)

  const picked: Array<Card & { role?: 'Closer' }> = []
  const used = new Set<string>()
  const take = (cand: (Card & { role?: 'Closer' }) | null) => {
    if (!cand) return null
    const root = baseId(cand.id)
    if (used.has(root)) return null
    used.add(root); picked.push(cand); return cand
  }
  const left = (c: Card) => (c.throw_hand === 'L')
  const right = (c: Card) => (c.throw_hand === 'R')
  const ffmph = (c: Card) => mphOf(c,'FF') || Math.max(mphOf(c,'FC'), mphOf(c,'SI'), mphOf(c,'FT'))
  const veloScore = (c: Card) => 0.6*ffmph(c) + 0.4*n(c.pitch_velocity,0)

  const pickBest = (scorer: (c: Card)=>number, filter?: (c: Card)=>boolean) => {
    const arr = pool.filter(c => !used.has(baseId(c.id)) && (!filter || filter(c)))
    if (!arr.length) return null
    arr.sort((a,b)=> scorer(b) - scorer(a))
    return arr[0] ?? null
  }

  // Role scorers (metric-aware via pitcherScore)
  const closerScore = (c: Card) =>
    0.45*pitcherScore(c, metric) + 0.25*n(c.k_per_bf) + 0.20*veloScore(c) + 0.10*n(c.pitching_clutch)

  const setupScore = (c: Card) =>
    0.40*pitcherScore(c, metric) + 0.25*n(c.k_per_bf) + 0.20*veloScore(c) + 0.15*n(c.pitching_clutch)

  const outlierRScore = (c: Card) =>
    right(c) ? (0.55*veloScore(c) + 0.25*n(c.k_per_bf) + 0.20*pitcherScore(c, metric)) : -1

  const outlierLScore = (c: Card) =>
    left(c) ? (0.55*veloScore(c) + 0.25*n(c.k_per_bf) + 0.20*pitcherScore(c, metric)) : -1

  const controlRScore = (c: Card) =>
    right(c) ? (0.45*n(c.pitch_control) + 0.25*(125 - n(c.bb_per_bf)) + 0.15*n(c.pitch_movement) + 0.15*pitcherScore(c, metric)) : -1

  const controlLScore = (c: Card) =>
    left(c) ? (0.45*n(c.pitch_control) + 0.25*(125 - n(c.bb_per_bf)) + 0.15*n(c.pitch_movement) + 0.15*pitcherScore(c, metric)) : -1

  const mixScore = (c: Card) =>
    0.55*mixSynergyScore(c) + 0.25*pitcherScore(c, metric) + 0.20*n(c.pitch_control)

  const junkScore = (c: Card) => {
    const hasJunk = (has(c,'PAL') || has(c,'SC') || has(c,'KN') || has(c,'KC')) ? 1 : 0
    return hasJunk ? (0.40*pitcherScore(c, metric) + 0.30*n(c.pitch_movement) + 0.20*n(c.pitch_control) + 0.10*n(c.k_per_bf)) : -1
  }

  // 1) Closer (label this one only)
  const closer = pickBest(closerScore)
  take(closer ? { ...closer, role: 'Closer' } : null)

  // 2) Setup man
  take(pickBest(setupScore) as any)

  // 3) Righty outlier
  take(pickBest(outlierRScore, right) as any)

  // 4) Left outlier
  take(pickBest(outlierLScore, left) as any)

  // 5) Righty control
  take(pickBest(controlRScore, right) as any)

  // 6) Left control
  take(pickBest(controlLScore, left) as any)

  // 7) Best pitch mix / tunneling
  take(pickBest(mixScore) as any)

  // 8) Junk look OR best remaining (metric)
  const junkPick = pickBest(junkScore)
  take((junkPick ?? pickBest((c)=> pitcherScore(c, metric))) as any)

  // Ensure at least two LHP
  const lefties = picked.filter(p => left(p)).length
  if (lefties < 2) {
    const bestLhp = pickBest((c)=> pitcherScore(c, metric), left)
    if (bestLhp) {
      let worstIdx = -1, worstScore = Infinity
      for (let i = 0; i < picked.length; i++) {
        if (left(picked[i])) continue
        const s = pitcherScore(picked[i], metric)
        if (s < worstScore) { worstScore = s; worstIdx = i }
      }
      if (worstIdx >= 0 && !new Set(picked.map(x => baseId(x.id))).has(baseId(bestLhp.id))) {
        picked[worstIdx] = bestLhp as any
      }
    }
  }

  while (picked.length < 8) {
    const pad = pickBest((c)=> pitcherScore(c, metric))
    if (!pad) break
    take(pad as any)
  }

  return picked
}

/* ---------------- GET ---------------- */
export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url)
    const metric = (url.searchParams.get('metric') as Metric) || 'meta_ovr'

    // always fetch with secondaries enabled
    const res = await fetch(`${url.origin}/api/player-rankings?allow_secondaries=1`, { cache: 'no-store' })
    if (!res.ok) return NextResponse.json({ error: `Upstream ${res.status}` }, { status: 502 })
    const data = await res.json()
    const items: Card[] = Array.isArray(data?.items) ? data.items : []

    // Starters + DH + Bench (metric-aware)
    const { starters, dh, order, bench } = pickStartersByMetricOptimized(items, metric)

    // Pitchers (metric-aware)
    const rotation = pickRotation(items, metric)
    const bullpen  = pickBullpen(items, metric)

    return NextResponse.json({
      metric,
      lineup: order.map((c, i) => ({
        slot: i+1,
        position:
          (dh && c.id === dh.id) ? 'DH'
          : (Object.entries(starters).find(([,v]) => v.id === c.id)?.[0] || (c.display_position ?? '')),
        id: c.id, name: c.name, team: c.team, bat_hand: c.bat_hand,
        image: c.image, primary_position: c.primary_position, display_position: c.display_position,
      })),
      starters, dh, bench, rotation, bullpen,
    })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? 'unknown error' }, { status: 500 })
  }
}
