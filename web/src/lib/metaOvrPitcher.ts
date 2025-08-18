// src/lib/metaOvrPitcher.ts

const SCALE_99_TO_125 = 125 / 99

const toNum = (v: unknown): number => {
  if (v == null) return 0
  if (typeof v === 'number') return Number.isFinite(v) ? v : 0
  const n = Number(String(v).replace(/[^0-9.-]/g, '')); return Number.isFinite(n) ? n : 0
}
const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n))
const posU = (raw: any) => String(raw?.display_position || '').toUpperCase()
const isSP = (raw: any) => posU(raw) === 'SP'
const isBullpen = (raw: any) => { const p = posU(raw); return p === 'RP' || p === 'CP' }
const hand = (raw: any): 'L'|'R'|null => {
  const h = String(raw?.throw_hand || '').toUpperCase()
  return h === 'L' || h === 'R' ? h : null
}

/* ---------- base weights ---------- */

const W_SP = {
  h_per_bf: 0.22,
  k_per_bf: 0.19,
  bb_per_bf: 0.19,
  clutch: 0.12,
  control: 0.10,
  velocity: 0.10,
  movement: 0.05,
  stamina: 0.03,
} as const

const W_BP = {
  h_per_bf: 0.25,
  k_per_bf: 0.22,
  bb_per_bf: 0.17,
  clutch: 0.18,
  control: 0.07,
  velocity: 0.12,
  movement: 0.03,
  stamina: 0.01,
} as const

const MIX_SHARE_SP = 0.60
const MIX_SHARE_BP = 0.55

type Pitch = { name?: string; speed?: number; control?: number; movement?: number }
type PType =
  | 'FF' | 'FT' | 'SI' | 'FC' | 'SL' | 'SWP' | 'CB' | 'KC' | 'SV' | 'SC'
  | 'SPL' | 'FRK' | 'CH' | 'CCH' | 'VCH' | 'PAL' | 'KN' | 'OTHER'

function pType(name: string): PType {
  const s = name.toLowerCase().trim()
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

const BAD = new Set<PType>(['CB','KC','SV','SWP'])
const BEST = new Set<PType>(['SI','FC','SL','FF','SPL','FRK'])
const ARMSIDE = new Set<PType>(['SI','FT','CH','CCH','VCH','SPL','FRK','SC'])
const GLOVESIDE = new Set<PType>(['FC','SL'])
const VERTICAL = new Set<PType>(['FF','CB','KC','SV','SWP'])

/* ---------- quirks ---------- */

const qname = (q: any) => String(typeof q === 'string' ? q : q?.name ?? '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
function applyQuirksAdjust(pitches: Pitch[], quirks: any[]): Pitch[] {
  const names = Array.isArray(quirks) ? quirks.map(qname) : []
  const out = pitches.map(p => ({ ...p }))
  if (out[0] && names.includes('outlier 1')) out[0].speed = (toNum(out[0].speed) + 3)
  if (out[1] && names.includes('outlier 2')) out[1].speed = (toNum(out[1].speed) + 2)
  if (names.includes('break outlier')) {
    for (const p of out) {
      const t = pType(String(p.name ?? ''))
      if (['SL','CB','KC','SV','SWP','SC'].includes(t)) p.movement = Math.min(99, toNum(p.movement) + 5)
    }
  }
  return out
}

/* ---------- helpers ---------- */

function mph01(mph: number) { return clamp((mph - 70) / 33, 0, 1) } // normalize ~70–103+
function n01(x?: number) { return clamp((toNum(x) / 99), 0, 1) }
const tri = (x: number, a: number, b: number, c: number) => x<=a||x>=c ? 0 : (x<a? (x-a)/(b-a) : (c-x)/(c-b))

type Style = 'velo'|'control'|'balanced'
function detectStyle(raw: any): Style {
  const v = n01(raw?.pitch_velocity), c = n01(raw?.pitch_control)
  if (v - c >= 0.15) return 'velo'
  if (c - v >= 0.15) return 'control'
  return 'balanced'
}

function gradeSingle(p: Pitch, fbAvg: number, style: Style, role: 'sp' | 'bp'): number {
  const t = pType(String(p.name ?? ''))
  const v = mph01(toNum(p.speed)), ctl = n01(p.control), mov = n01(p.movement)

  let base: number
  if (role === 'bp') {
    switch (t) {
      case 'FF': base = 0.72*v + 0.28*ctl; break
      case 'FC': base = 0.62*v + 0.38*ctl; break
      case 'SI': base = 0.55*v + 0.45*mov; break
      case 'SL': base = 0.40*v + 0.45*mov + 0.15*ctl; break
      case 'SPL':
      case 'FRK': { const sep = clamp((fbAvg - toNum(p.speed)),0,20)/20; base = 0.50*sep + 0.50*ctl; break }
      case 'CH':
      case 'CCH':
      case 'VCH':
      case 'PAL': { const sep = clamp((fbAvg - toNum(p.speed)),0,18)/18; base = 0.45*sep + 0.55*ctl; break }
      case 'SC': { const sep = clamp((fbAvg - toNum(p.speed)),0,18)/18; base = 0.40*sep + 0.40*mov + 0.20*ctl; break }
      default: base = 0.35*ctl + 0.65*mov
    }
  } else {
    switch (t) {
      case 'FF': base = 0.65*v + 0.35*ctl; break
      case 'FC': base = 0.55*v + 0.45*ctl; break
      case 'FT': base = 0.45*v + 0.55*mov; break
      case 'SI': base = 0.50*v + 0.50*mov; break
      case 'SL': base = 0.30*v + 0.50*mov + 0.20*ctl; break
      case 'SPL':
      case 'FRK': { const sep = clamp((fbAvg - toNum(p.speed)),0,20)/20; base = 0.55*sep + 0.45*ctl; break }
      case 'CH':
      case 'CCH':
      case 'VCH':
      case 'PAL': { const sep = clamp((fbAvg - toNum(p.speed)),0,18)/18; base = 0.50*sep + 0.50*ctl; break }
      case 'SC': { const sep = clamp((fbAvg - toNum(p.speed)),0,18)/18; base = 0.45*sep + 0.35*mov + 0.20*ctl; break }
      default: base = 0.35*ctl + 0.65*mov
    }
  }

  let mult = 1
  if (BEST.has(t)) mult *= 1.10
  if (BAD.has(t)) mult *= 0.75
  if (t === 'SL' && toNum(p.speed) >= 92) mult *= 1.05
  if (role === 'bp' && t === 'SWP') mult *= 0.70
  if (style === 'velo' && (t === 'FF' || t === 'SL' || t === 'FC')) mult *= 1.04
  if (style === 'control' && (t === 'CH' || t === 'CCH' || t === 'VCH' || t === 'SPL' || t === 'FRK')) mult *= 1.04

  return clamp(base * mult * 125, 0, 125)
}

/* ---------- core base (per-BF attributes) ---------- */

function baseScore(raw: any, W: typeof W_SP | typeof W_BP): number {
  const h = toNum(raw?.hits_per_bf)
  const k = toNum(raw?.k_per_bf)
  const bb = toNum(raw?.bb_per_bf)
  const stamina = toNum(raw?.stamina)
  const clutch = toNum(raw?.pitching_clutch)
  const control = toNum(raw?.pitch_control) * SCALE_99_TO_125
  const velocity = toNum(raw?.pitch_velocity) * SCALE_99_TO_125
  const movement = toNum(raw?.pitch_movement) * SCALE_99_TO_125

  return clamp(
    W.h_per_bf*h + W.k_per_bf*k + W.bb_per_bf*bb + W.clutch*clutch +
    W.control*control + W.velocity*velocity + W.movement*movement + W.stamina*stamina,
    0, 125
  )
}

/* ---------- advanced mix (overall SP/BP) ---------- */

function mixQualityOverall(raw: any): number {
  const role: 'sp'|'bp' = isBullpen(raw) ? 'bp' : 'sp'
  const style = detectStyle(raw)
  const rawP: Pitch[] = Array.isArray(raw?.pitches) ? raw.pitches : []
  if (!rawP.length) return 0

  const withQuirks = applyQuirksAdjust(rawP, Array.isArray(raw?.quirks) ? raw.quirks : [])
  const types = withQuirks.map(p => pType(String(p.name ?? '')))
  const fbSpeeds = withQuirks.filter(p => ['FF','FC','SI','FT'].includes(pType(String(p.name ?? '')))).map(p => toNum(p.speed))
  const fbAvg = fbSpeeds.length ? fbSpeeds.reduce((a,b)=>a+b,0)/fbSpeeds.length : Math.max(...withQuirks.map(p=>toNum(p.speed)),0)

  const graded = withQuirks.map(p => ({
    t: pType(String(p.name ?? '')), name: String(p.name ?? ''),
    g: gradeSingle(p, fbAvg, style, role),
    mph: toNum(p.speed),
    ctl: n01(p.control),
    mov: n01(p.movement),
  }))
  graded.sort((a,b)=>b.g-a.g)

  // role-specific decay (BP cares more about the top two)
  const decays = role === 'sp' ? [0.30,0.22,0.17,0.13,0.09,0.06,0.03]
                               : [0.60,0.28,0.08,0.04]
  let baseAll = 0, wsum = 0
  for (let i=0;i<graded.length && i<decays.length;i++){ baseAll += graded[i].g*decays[i]; wsum += decays[i] }
  if (wsum>0) baseAll/=wsum

  const has = (t: PType) => types.includes(t)
  const mphOf = (t: PType) => graded.find(x => x.t===t)?.mph ?? 0
  const ctlOf = (t: PType) => graded.find(x => x.t===t)?.ctl ?? 0
  const gOf   = (t: PType) => graded.find(x => x.t===t)?.g ?? 0

  let bonus = 0

  // sinker + cutter tunnel (opposite horizontal)
  if (has('SI') && has('FC')) {
    const gap = Math.abs(mphOf('SI') - mphOf('FC'))
    const closeness = clamp((3 - gap)/3, 0, 1)
    const pairCtl = Math.min(ctlOf('SI'), ctlOf('FC'))
    bonus += 12 * closeness * (0.75 + 0.25 * pairCtl)
  }

  // 4S + splitter/fork/change — choose best velocity gap window
  if (has('FF') && (has('SPL') || has('FRK') || has('CH') || has('CCH') || has('VCH'))) {
    const fb = mphOf('FF') || fbAvg
    let best = 0
    for (const t of ['SPL','FRK','CH','CCH','VCH'] as PType[]) {
      if (!has(t)) continue
      const gap = fb - mphOf(t)
      const score = Math.max(tri(gap,6,11,16), tri(gap,9,13,20), tri(gap,4,10,18)*0.7)
      const pairCtl = Math.min(ctlOf('FF'), ctlOf(t))
      best = Math.max(best, score * (0.6 + 0.4 * pairCtl))
    }
    bonus += 11 * best
  }

  // slider presence (faster better)
  if (has('SL')) {
    const s = mphOf('SL')
    if (s >= 92) bonus += 5
    else if (s >= 88) bonus += 3
    else bonus += 1
  }

  // FF + FC same-speed penalty (unless SI)
  if (!has('SI') && has('FF') && has('FC')) {
    const gap = Math.abs(mphOf('FF') - mphOf('FC'))
    if (gap <= 1.5) bonus -= 6
    else if (gap <= 2.5) bonus -= 3
  }

  // directional coverage: arm-side & glove-side threats
  const hasAS = types.some(t => ARMSIDE.has(t))
  const hasGS = types.some(t => GLOVESIDE.has(t))
  if (hasAS && hasGS) {
    const topAS = Math.max(gOf('SI'), gOf('CH'), gOf('SPL'), gOf('FRK'))
    const topGS = Math.max(gOf('SL'), gOf('FC'))
    bonus += (topAS >= 80 && topGS >= 80) ? 6 : 3
  }

  // vertical presence (ride/down) small bump
  if (types.some(t => VERTICAL.has(t))) bonus += 1

  // penalize heavy curve reliance among top 3
  const curvesInTop3 = graded.slice(0, 3).filter(x => BAD.has(x.t)).length
  if (curvesInTop3 >= 2) bonus -= 8
  else if (curvesInTop3 === 1) bonus -= 4

  // arsenal depth of *good* pitches
  const effective = graded.filter(x => x.g >= 75).length
  if (effective >= 4) bonus += 6
  else if (effective === 3) bonus += 3

  // global velo spread
  const mphs = graded.map(x => x.mph).filter(Boolean)
  if (mphs.length >= 2) {
    const mx = Math.max(...mphs), mn = Math.min(...mphs), spread = mx - mn
    if (spread >= 10 && spread <= 18) bonus += 3
    else if (spread >= 7 && spread < 10) bonus += 2
  }

  // command gating on synergy (avg control over top 3)
  const ctlAvgTop = graded.slice(0, 3).reduce((s, x) => s + x.ctl, 0) / Math.max(1, Math.min(3, graded.length))
  bonus *= (0.8 + 0.2 * ctlAvgTop)

  const capped = clamp(bonus, -12, 28)
  const mix = clamp(0.78 * baseAll + 0.22 * (capped / 28) * 125, 0, 125)
  return mix
}

/* ---------- public overall ---------- */

export function computePitcherMetaOvr(raw: any, trueOvr: number | null): number | null {
  const W = isSP(raw) ? W_SP : isBullpen(raw) ? W_BP : null
  if (!W) return trueOvr
  const base = baseScore(raw, W)
  const mix = mixQualityOverall(raw)
  const share = isSP(raw) ? MIX_SHARE_SP : MIX_SHARE_BP
  return clamp(share * mix + (1 - share) * base, 0, 125)
}

/* ---------- matchup facets: vs_left / vs_right ---------- */

function matchupMix(raw: any, batter: 'L'|'R'): number {
  const role: 'sp' | 'bp' = isBullpen(raw) ? 'bp' : 'sp'
  const style = detectStyle(raw)
  const pitches: Pitch[] = Array.isArray(raw?.pitches) ? raw.pitches : []
  if (!pitches.length) return 0

  const withQuirks = applyQuirksAdjust(pitches, Array.isArray(raw?.quirks) ? raw.quirks : [])
  const types = withQuirks.map(p => pType(String(p.name ?? '')))
  const fbSpeeds = withQuirks.filter(p => ['FF','FC','SI','FT'].includes(pType(String(p.name ?? '')))).map(p => toNum(p.speed))
  const fbAvg = fbSpeeds.length ? fbSpeeds.reduce((a,b)=>a+b,0)/fbSpeeds.length : Math.max(...withQuirks.map(p=>toNum(p.speed)),0)

  const graded = withQuirks.map(p => ({
    t: pType(String(p.name ?? '')),
    g: gradeSingle(p, fbAvg, style, role),
    mph: toNum(p.speed),
    ctl: n01(p.control),
    mov: n01(p.movement),
  })).sort((a,b)=>b.g-a.g)

  // role-weighted base of arsenal (matchup view)
  const decays = role === 'sp' ? [0.32,0.24,0.18,0.14,0.08,0.04] : [0.62,0.26,0.08,0.04]
  let baseAll = 0, wsum = 0
  for (let i=0;i<graded.length && i<decays.length;i++){ baseAll += graded[i].g*decays[i]; wsum += decays[i] }
  if (wsum>0) baseAll/=wsum

  const H = hand(raw)
  const has = (t: PType) => types.includes(t)
  const mphOf = (t: PType) => graded.find(x=>x.t===t)?.mph ?? 0
  const ctlOf = (t: PType) => graded.find(x=>x.t===t)?.ctl ?? 0
  const gOf   = (t: PType) => graded.find(x=>x.t===t)?.g ?? 0

  let syn = 0
  const sameHand = H && H === batter
  const oppHand = H && H !== batter

  // same-handed: glove-side breaker dominance; FF+SL tunneling
  if (sameHand) {
    const topGS = Math.max(gOf('SL'), gOf('FC'))
    syn += (topGS / 125) * 14
    if (has('FF') && has('SL')) {
      const gap = Math.abs(mphOf('FF') - mphOf('SL'))
      const fastSL = mphOf('SL') >= 90 ? 1.08 : 1.0
      syn += 8 * Math.max(tri(gap,3,6,10), tri(gap,2,4,7)*0.6) * (0.65 + 0.35*Math.min(ctlOf('FF'), ctlOf('SL'))) * fastSL
    }
    if (batter === 'L' && H === 'L') syn += 4
    const okAS = graded.some(x => ARMSIDE.has(x.t) && x.g >= 75)
    const okGS = graded.some(x => GLOVESIDE.has(x.t) && x.g >= 75)
    if (okAS && okGS) syn += 3
  }

  // opposite-handed: SI+FC inside + CH/SPL/FRK away off FF tunnel
  if (oppHand) {
    if (has('SI') && has('FC')) {
      const gap = Math.abs(mphOf('SI') - mphOf('FC'))
      const closeness = clamp((3 - gap)/3, 0, 1)
      syn += 10 * closeness * (0.7 + 0.3*Math.min(ctlOf('SI'), ctlOf('FC')))
    }
    if (has('FF') && (has('CH') || has('CCH') || has('VCH') || has('SPL') || has('FRK'))) {
      const fb = mphOf('FF') || fbAvg
      let best = 0
      for (const t of ['CH','CCH','VCH','SPL','FRK'] as PType[]) {
        if (!has(t)) continue
        const gap = fb - mphOf(t)
        const score = Math.max(tri(gap,5,10,17), tri(gap,7,12,20))
        best = Math.max(best, score * (0.6 + 0.4*Math.min(ctlOf('FF'), ctlOf(t))))
      }
      syn += 10 * best
    }
  }

  // coverage & penalties
  const hasGS = graded.some(x => GLOVESIDE.has(x.t))
  const hasAS = graded.some(x => ARMSIDE.has(x.t))
  const top3DownOnly = graded.slice(0,3).every(x => VERTICAL.has(x.t) || ['SPL','FRK','CH','CCH','VCH','PAL'].includes(x.t))
  if (!hasGS) syn -= 6
  if (!hasAS) syn -= 3
  if (top3DownOnly) syn -= 6

  const badTop2 = graded.slice(0,2).filter(x => BAD.has(x.t)).length
  if (badTop2 === 1) syn -= 5
  else if (badTop2 >= 2) syn -= 9

  // entropy (avoid 1-trick)
  const nE = Math.min(3, graded.length)
  if (nE >= 2) {
    const topE = graded.slice(0, nE)
    const sumG = topE.reduce((s,x)=>s+x.g,0)
    if (sumG > 0) {
      const Hn = -topE.reduce((s,x)=>{ const p=x.g/sumG; return s + (p>0? p*Math.log(p) : 0) },0) / Math.log(nE)
      syn += 1.5 * Hn
    }
  }

  const ctlTop = graded.slice(0, 3).reduce((s,x)=>s+x.ctl,0) / Math.max(1, Math.min(3, graded.length))
  syn *= (0.85 + 0.15*ctlTop)

  if (batter === 'L' && H === 'L') syn += 6
  if (batter === 'R' && H === 'R') syn += 3

  const cap = 32
  return clamp(0.68 * baseAll + 0.32 * (clamp(syn, -14, cap) / cap) * 125, 0, 125)
}

export function computePitcherFacet(
  raw: any,
  facet: 'vs_left' | 'vs_right'
): number | null {
  const W = isSP(raw) ? W_SP : isBullpen(raw) ? W_BP : null
  if (!W) return null
  const base = baseScore(raw, W)
  const mix = facet === 'vs_left' ? matchupMix(raw, 'L') : matchupMix(raw, 'R')
  const share = 0.70 // facets lean harder on matchup mix
  return clamp(share * mix + (1 - share) * base, 0, 125)
}
