'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import styles from './page.module.css'

/* ---------------- shared types ---------------- */

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

  // hitter fields
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

  // pitcher-only
  pitch_velocity?: number | null
  pitch_control?: number | null
  pitch_movement?: number | null
  hits_per_bf?: number | null
  k_per_bf?: number | null
  bb_per_bf?: number | null
  pitching_clutch?: number | null
  pitches?: { name?: string; speed?: number; control?: number; movement?: number }[]

  role?: 'Closer' // server labels closer
}

type LineItem = {
  slot: number
  position: string
  id: string | number
  name: string
  team?: string | null
  bat_hand?: 'L'|'R'|'S'|null
  image?: string | null
  primary_position?: string | null
  display_position?: string | null
}

type Bench = {
  pinch_runner?: Card | null
  platoon_vs_left?: Card | null
  platoon_vs_right?: Card | null
  defensive_sub?: Card | null
}

type ApiResp = {
  metric: Metric
  lineup: LineItem[]
  starters: Record<string, Card>
  dh: Card | null
  bench: Bench
  rotation: Card[]
  bullpen: Card[]
  error?: string
}

/* ---------------- utils ---------------- */

const FIELD_POS: Array<'C'|'1B'|'2B'|'3B'|'SS'|'LF'|'CF'|'RF'> = ['C','1B','2B','3B','SS','LF','CF','RF']
const IF_SET = new Set(['C','1B','2B','3B','SS'])
const OF_SET = new Set(['LF','CF','RF'])

const baseId = (id: string|number|null) => String(id ?? '').split('|')[0]
const isPitcherPos = (p?: string | null) => {
  const s = String(p ?? '').toUpperCase()
  return s === 'SP' || s === 'RP' || s === 'CP'
}
const n = (v: any, d = 0) => (typeof v === 'number' && Number.isFinite(v) ? v : d)

const avg = (xs: number[]) => xs.length ? xs.reduce((a,b)=>a+b,0)/xs.length : 0
const contactAvg = (c: Card) => avg([c.contact_left, c.contact_right, c.contact].map(v => n(v)))
const powerAvg   = (c: Card) => avg([c.power_left, c.power_right, c.power].map(v => n(v)))
const speed01    = (c: Card) => Math.max(0, Math.min(1, (0.7*n(c.speed) + 0.3*n(c.baserunning_ability)) / 125))
const vsBalance  = (c: Card) => {
  const vl = n(c.vs_left), vr = n(c.vs_right)
  if (!vl && !vr) return 0
  const diff = Math.abs(vl - vr)
  return 125 * (1 - Math.min(1, diff / 125))
}
const overallHit = (c: Card) => 0.6*contactAvg(c) + 0.4*powerAvg(c)

/* metric scoring */
const scoreByMetric = (c: Card, metric: Metric): number => {
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
const pitcherScore = (c: Card, metric: Metric): number => {
  switch (metric) {
    case 'true_ovr':  return n(c.true_ovr ?? c.meta_ovr, -1)
    case 'vs_left':   return n(c.vs_left ?? c.meta_ovr, -1)
    case 'vs_right':  return n(c.vs_right ?? c.meta_ovr, -1)
    default:          return n(c.meta_ovr, -1)
  }
}

/* role scorers (for tips / lineup fit) */
const scoreLeadoff = (c: Card) =>
  0.50*contactAvg(c) + 0.30*(speed01(c)*125) + 0.15*powerAvg(c) + 0.05*avg([n(c.vs_left,0), n(c.vs_right,0)])
const scoreTwoHole = (c: Card) => 0.45*overallHit(c) + 0.20*(speed01(c)*125) + 0.25*vsBalance(c) + (c.bat_hand === 'S' ? 8 : 0)
const scoreThreeHole = (c: Card) => 0.75*powerAvg(c) + 0.25*contactAvg(c)

/* ---------------- component ---------------- */

export default function TeamBuilderPage() {
  const [metric, setMetric] = useState<Metric>('meta_ovr')
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  // server data
  const [data, setData] = useState<ApiResp | null>(null)

  // full catalog for candidates
  const [catalog, setCatalog] = useState<Card[]>([])
  const byId = useMemo(() => {
    const m = new Map<string, Card>()
    for (const c of catalog) m.set(String(c.id), c)
    return m
  }, [catalog])

  // working copies (editable client-side)
  const [lineupOrder, setLineupOrder] = useState<Card[]>([])
  const [lineupPosFor, setLineupPosFor] = useState<Record<string, string>>({})
  const [starters, setStarters] = useState<Record<string, Card>>({})
  const [dh, setDH] = useState<Card | null>(null)
  const [bench, setBench] = useState<Bench>({})
  const [rotation, setRotation] = useState<Card[]>([])
  const [bullpen, setBullpen] = useState<Card[]>([])

  // modal state
  type ReplaceCtx =
    | { kind: 'lineup', atIndex: number, current: Card, position: string }
    | { kind: 'bench', benchKey: keyof Bench, current: Card | null }
    | { kind: 'rotation', atIndex: number, current: Card }
    | { kind: 'bullpen', atIndex: number, current: Card, carryCloser: boolean }
  const [modal, setModal] = useState<{ open: boolean, ctx: ReplaceCtx | null }>({ open: false, ctx: null })
  const [search, setSearch] = useState('')

  // drag and drop for batting order
  const dragIndex = useRef<number | null>(null)
  const onDragStart = (idx: number) => (e: React.DragEvent) => { dragIndex.current = idx; e.dataTransfer.effectAllowed = 'move' }
  const onDragOver = (idx: number) => (e: React.DragEvent) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move' }
  const onDrop = (idx: number) => (e: React.DragEvent) => {
    e.preventDefault()
    const from = dragIndex.current
    dragIndex.current = null
    if (from == null || from === idx) return
    setLineupOrder(prev => {
      const a = prev.slice()
      const [moved] = a.splice(from, 1)
      a.splice(idx, 0, moved)
      return a
    })
  }

  /* ---------------- fetchers ---------------- */

  const build = useCallback(async (optMetric = metric) => {
    setLoading(true); setErr(null)
    try {
      const [teamRes, catRes] = await Promise.all([
        fetch(`/api/team-builder?metric=${optMetric}`, { cache: 'no-store' }),
        fetch(`/api/player-rankings?allow_secondaries=1`, { cache: 'no-store' }),
      ])
      if (!teamRes.ok) throw new Error(`API ${teamRes.status}`)
      if (!catRes.ok) throw new Error(`Catalog ${catRes.status}`)

      const team: ApiResp = await teamRes.json()
      const catalogJson = await catRes.json()
      const items: Card[] = Array.isArray(catalogJson?.items) ? catalogJson.items : []

      if ((team as any).error) throw new Error((team as any).error)

      setData(team)
      setCatalog(items)

      // seed working copies
      const idToPos: Record<string, string> = {}
      for (const li of team.lineup) {
        idToPos[String(li.id)] = li.position
      }
      setLineupPosFor(idToPos)

      const order = team.lineup.map(li => byId.get(String(li.id)) || items.find(p => String(p.id) === String(li.id)) || {
        id: li.id, name: li.name, team: li.team, bat_hand: li.bat_hand,
        display_position: li.display_position, primary_position: li.primary_position, image: li.image
      })
      setLineupOrder(order as Card[])

      setStarters(team.starters)
      setDH(team.dh)
      setBench(team.bench)
      setRotation(team.rotation)
      setBullpen(team.bullpen)
    } catch (e: any) {
      setErr(e?.message ?? 'Error'); setData(null)
    } finally {
      setLoading(false)
    }
  }, [metric, byId])

  useEffect(() => { build('meta_ovr') }, []) // initial build
  useEffect(() => { if (data) build(metric) }, [metric]) // rebuild on metric change

  /* ---------------- KPI row (includes Meta Overall) ---------------- */

  const squadKpis = useMemo(() => {
    if (!lineupOrder.length) return null

    const meta = avg(lineupOrder.map(p => n(p.meta_ovr, 0)))
    const contact = avg(lineupOrder.map(p => n(p.contact, 0)))
    const power   = avg(lineupOrder.map(p => n(p.power, 0)))
    const speed   = avg(lineupOrder.map(p => n(p.speed, 0)))
    const defense = avg(lineupOrder.map(p => n(p.defense, 0)))

    const startersAvg = rotation.length ? avg(rotation.map(p => pitcherScore(p, metric))) : 0
    const bullpenAvg  = bullpen.length  ? avg(bullpen.map(p  => pitcherScore(p, metric))) : 0

    return { meta, contact, power, speed, defense, starters: startersAvg, bullpen: bullpenAvg }
  }, [lineupOrder, rotation, bullpen, metric])

  /* ---------------- modal candidates ---------------- */

  const usedLineupRoots = useMemo(() => new Set(lineupOrder.map(p => baseId(p.id))), [lineupOrder])
  const usedBenchRoots = useMemo(() => {
    const bs = [bench.pinch_runner, bench.platoon_vs_left, bench.platoon_vs_right, bench.defensive_sub].filter(Boolean) as Card[]
    return new Set(bs.map(p => baseId(p.id)))
  }, [bench])
  const usedRotationRoots = useMemo(() => new Set(rotation.map(p => baseId(p.id))), [rotation])
  const usedBullpenRoots = useMemo(() => new Set(bullpen.map(p => baseId(p.id))), [bullpen])

  function candidatePool(ctx: ReplaceCtx): Card[] {
    const excludeIds = new Set<string>()
    if (ctx.current) excludeIds.add(String(ctx.current.id))

    // Start with full catalog
    let pool = catalog.filter(p => !excludeIds.has(String(p.id)))

    // Filter by context & prevent duplicates across roster
    if (ctx.kind === 'lineup') {
      // hitters only
      pool = pool.filter(p => !isPitcherPos(p.display_position))
      // Exclude lineup duplicates, but allow picking from bench (so you can promote bench to lineup)
      pool = pool.filter(p =>
        !usedLineupRoots.has(baseId(p.id)) &&
        !usedRotationRoots.has(baseId(p.id)) &&
        !usedBullpenRoots.has(baseId(p.id))
      )
      // Position scope (DH can be any bat)
      if (ctx.position !== 'DH') {
        const pos = ctx.position.toUpperCase()
        pool = pool.filter(p => String(p.display_position).toUpperCase() === pos)
      }
      // Add bench players explicitly (so they appear in recs too)
      const benchCards = [bench.pinch_runner, bench.platoon_vs_left, bench.platoon_vs_right, bench.defensive_sub].filter(Boolean) as Card[]
      for (const b of benchCards) {
        if (!b) continue
        if (ctx.position !== 'DH') {
          if (String(b.display_position).toUpperCase() !== ctx.position.toUpperCase()) continue
        }
        if (!pool.find(x => String(x.id) === String(b.id))) pool.unshift(b)
      }
    } else if (ctx.kind === 'bench') {
      // bench: hitters only, exclude lineup roots (to avoid duplicates in lineup)
      pool = pool.filter(p => !isPitcherPos(p.display_position))
      pool = pool.filter(p =>
        !usedLineupRoots.has(baseId(p.id)) &&
        !usedBenchRoots.has(baseId(p.id)) &&
        !usedRotationRoots.has(baseId(p.id)) &&
        !usedBullpenRoots.has(baseId(p.id))
      )
    } else if (ctx.kind === 'rotation') {
      pool = pool.filter(p => String(p.display_position).toUpperCase() === 'SP')
      pool = pool.filter(p =>
        !usedRotationRoots.has(baseId(p.id)) &&
        !usedBullpenRoots.has(baseId(p.id)) &&
        !usedLineupRoots.has(baseId(p.id)) &&
        !usedBenchRoots.has(baseId(p.id))
      )
    } else if (ctx.kind === 'bullpen') {
      const isRP = (p: Card) => {
        const pos = String(p.display_position).toUpperCase()
        return pos === 'RP' || pos === 'CP'
      }
      pool = pool.filter(isRP)
      pool = pool.filter(p =>
        !usedBullpenRoots.has(baseId(p.id)) &&
        !usedRotationRoots.has(baseId(p.id)) &&
        !usedLineupRoots.has(baseId(p.id)) &&
        !usedBenchRoots.has(baseId(p.id))
      )
    }

    return pool
  }

  const sortCandidates = (ctx: ReplaceCtx, pool: Card[]): Card[] => {
    // search filter
    const q = search.trim().toLowerCase()
    let arr = q ? pool.filter(p => String(p.name ?? '').toLowerCase().includes(q)) : pool.slice()

    if (ctx.kind === 'rotation' || ctx.kind === 'bullpen') {
      return arr.sort((a,b)=> pitcherScore(b, metric) - pitcherScore(a, metric))
    }
    if (ctx.kind === 'bench') {
      // role-aware sort
      if (ctx.benchKey === 'pinch_runner') {
        return arr.sort((a,b) =>
          (0.75*(speed01(b)*125)+0.25*n(b.baserunning_ability,0)) -
          (0.75*(speed01(a)*125)+0.25*n(a.baserunning_ability,0)) ||
          (OF_SET.has(String(b.display_position).toUpperCase()) ? 1 : 0) -
          (OF_SET.has(String(a.display_position).toUpperCase()) ? 1 : 0)
        )
      }
      if (ctx.benchKey === 'defensive_sub') {
        return arr.sort((a,b) =>
          (n(b.defense,0) - n(a.defense,0)) ||
          (OF_SET.has(String(b.display_position).toUpperCase()) ? 1 : 0) -
          (OF_SET.has(String(a.display_position).toUpperCase()) ? 1 : 0)
        )
      }
      if (ctx.benchKey === 'platoon_vs_left') {
        return arr.sort((a,b) => n(b.vs_left,0) - n(a.vs_left,0))
      }
      if (ctx.benchKey === 'platoon_vs_right') {
        return arr.sort((a,b) => n(b.vs_right,0) - n(a.vs_right,0))
      }
    }
    // lineup / DH: generic metric sort
    return arr.sort((a,b)=> scoreByMetric(b, metric) - scoreByMetric(a, metric))
  }

  const modalCandidates = useMemo(() => {
    if (!modal.open || !modal.ctx) return []
    return sortCandidates(modal.ctx, candidatePool(modal.ctx)).slice(0, 150)
  }, [modal, search, catalog, lineupOrder, bench, rotation, bullpen, metric])

  const recommendedId = modalCandidates[0]?.id

  /* ---------------- apply replacement ---------------- */

  function backfillBench(gapKey: keyof Bench) {
    const pool = candidatePool({ kind: 'bench', benchKey: gapKey, current: null })
      .filter(p => !usedBenchRoots.has(baseId(p.id)))
    const sorted = sortCandidates({ kind: 'bench', benchKey: gapKey, current: null }, pool)
    const pick = sorted[0] ?? null
    setBench(prev => ({ ...prev, [gapKey]: pick }))
  }

  function applyReplacement(pick: Card) {
    if (!modal.ctx) return

    if (modal.ctx.kind === 'lineup') {
      // if pick came from bench, clear that bench slot and backfill it
      const fromBenchKey = (Object.keys(bench) as (keyof Bench)[])
        .find(k => bench[k]?.id && String(bench[k]?.id) === String(pick.id))

      setLineupOrder(prev => prev.map((p, i) => i === modal.ctx.atIndex ? pick : p))
      setLineupPosFor(prev => {
        const copy = { ...prev }
        delete copy[String(modal.ctx.current.id)]
        copy[String(pick.id)] = modal.ctx.position
        return copy
      })

      if (fromBenchKey) {
        setBench(prev => ({ ...prev, [fromBenchKey]: null }))
        setTimeout(() => backfillBench(fromBenchKey), 0)
      }
    }

    if (modal.ctx.kind === 'bench') {
      const key = modal.ctx.benchKey
      setBench(prev => ({ ...prev, [key]: pick }))
    }

    if (modal.ctx.kind === 'rotation') {
      setRotation(prev => prev.map((p, i) => i === modal.ctx.atIndex ? pick : p))
    }

    if (modal.ctx.kind === 'bullpen') {
      setBullpen(prev => prev.map((p, i) => {
        if (i !== modal.ctx.atIndex) return p
        // keep the 'Closer' label if we replaced the closer slot
        const carryRole = modal.ctx.carryCloser ? 'Closer' : undefined
        return carryRole ? { ...pick, role: 'Closer' } as Card : pick
      }))
    }

    setModal({ open: false, ctx: null })
  }

  /* ---------------- tips (same advanced set as last build) ---------------- */

  const tips = useMemo(() => {
    if (!lineupOrder.length) return []

    const out: string[] = []
    const L = lineupOrder
    const name = (c?: Card|null) => c?.name ?? '—'
    const idEq = (a?: Card|null, b?: Card|null) => a && b && String(a.id) === String(b.id)
    const hand = (c?: Card|null) => c?.bat_hand ?? 'R'
    const sameHand = (a?: Card|null, b?: Card|null) => {
      if (!a || !b) return false
      const ha = hand(a), hb = hand(b)
      return ha !== 'S' && hb !== 'S' && ha === hb
    }

    const scoreCleanup = (c: Card) => 0.70*powerAvg(c) + 0.30*overallHit(c)
    const twoNow = L[1], leadNow = L[0], threeNow = L[2], fourNow = L[3]
    const bestLead = [...L].sort((a,b)=> (scoreLeadoff(b)-scoreLeadoff(a)))[0]
    const bestTwo = [...L].sort((a,b)=> (scoreTwoHole(b)-scoreTwoHole(a)))[0]
    const byPow = [...L].sort((a,b)=> powerAvg(b)-powerAvg(a))
    const p1 = byPow[0], p2 = byPow[1]

    if (leadNow && bestLead && !idEq(leadNow, bestLead) && (scoreLeadoff(bestLead) - scoreLeadoff(leadNow)) > 4) {
      out.push(`Lead-off optimization: ${name(bestLead)} grades best there. Consider batting them 1st.`)
    }
    if (twoNow && bestTwo && !idEq(twoNow, bestTwo) && (scoreTwoHole(bestTwo)-scoreTwoHole(twoNow)) > 4) {
      out.push(`#2 hitter upgrade: ${name(bestTwo)} fits the all-around 2-hole best.`)
    }
    if (p1 && !idEq(p1, threeNow)) out.push(`${name(p1)} has your top raw power; consider batting them 3rd.`)
    if (p2 && !idEq(p2, fourNow)) out.push(`${name(p2)} is your next thump; 4th is ideal.`)

    // pockets of same-handedness
    for (let i = 0; i <= 6; i++) {
      if (sameHand(L[i], L[i+1]) && sameHand(L[i+1], L[i+2])) {
        out.push(`Slots ${i+1}–${i+3} are same-handed. Insert an opposite-sided bat to avoid specialist traps.`)
        break
      }
    }

    // second leadoff at 9
    const nine = L[8]
    const bestSpeed = [...L].sort((a,b)=> (n(b.speed,0)-n(a.speed,0)) || ((0.75*contactAvg(b)+0.25*n(b.baserunning_ability,0)) - (0.75*contactAvg(a)+0.25*n(a.baserunning_ability,0))))[0]
    if (nine && bestSpeed && n(bestSpeed.speed,0) > 90 && !idEq(nine, bestSpeed)) {
      out.push(`Try ${name(bestSpeed)} in the 9-spot as a 'second lead-off' to turn the lineup.`)
    }

    // bench coverage
    const benchCards = [bench.pinch_runner, bench.platoon_vs_left, bench.platoon_vs_right, bench.defensive_sub].filter(Boolean) as Card[]
    if (!benchCards.some(b => String(b.display_position).toUpperCase() === 'C')) {
      out.push('No backup catcher on the bench—add one to avoid burning your starter late.')
    }
    const benchSpeed = Math.max(0, ...benchCards.map(b => n(b.speed,0)))
    if (benchSpeed < 90) out.push('Bench lacks a true burner. Carry an elite runner for late-game leverage.')

    // up-the-middle defense check
    const startersByPos: Record<string, Card|undefined> = {}
    FIELD_POS.forEach(p => startersByPos[p] = Object.values(starters).find(s => String(s.display_position).toUpperCase() === p))
    const mid = ['C','SS','CF'].map(p => n(startersByPos[p]?.defense, 0)).filter(Boolean)
    if (mid.length && avg(mid) < 82) {
      out.push('Up-the-middle defense (C/SS/CF) is soft. A defensive upgrade at one spot would help run prevention.')
    }

    return out.slice(0, 8)
  }, [lineupOrder, starters, bench])

  /* ---------------- UI bits ---------------- */

  const handShort = (c?: Card) => c?.bat_hand ? `(${c.bat_hand})` : ''
  const posLabelFor = (c: Card) => lineupPosFor[String(c.id)] || c.display_position || c.primary_position || '—'

  const LineRow = ({ c, idx }: { c: Card, idx: number }) => (
    <div
      className={styles.lineRow}
      draggable
      onDragStart={onDragStart(idx)}
      onDragOver={onDragOver(idx)}
      onDrop={onDrop(idx)}
    >
      <div className={styles.spot}>
        <div className={styles.num}>{idx + 1}</div>
        <div className={styles.posTag}>{posLabelFor(c)}</div>
      </div>
      <div className={styles.cardInfo}>
        {c.image && <img src={c.image} alt="" className={styles.thumb} />}
        <div className={styles.nameBlock}>
          <div className={styles.playerName}>
            {c.name} <span className={styles.hand}>{handShort(c)}</span>
          </div>
          <div className={styles.subtitle}>{c.team ?? '—'}</div>
        </div>
      </div>
      <button
        className={styles.replaceBtn}
        onClick={() => setModal({ open: true, ctx: { kind: 'lineup', atIndex: idx, current: c, position: posLabelFor(c) } })}
        title="Replace"
      >
        Replace
      </button>
    </div>
  )

  const BenchCard = ({ title, c, benchKey }: { title: string, c: Card | null | undefined, benchKey: keyof Bench }) => (
    <div className={styles.benchCard}>
      <div className={styles.benchTitle}>{title}</div>
      <div className={styles.benchBody}>
        {c?.image && <img src={c.image} alt="" className={styles.benchThumb} />}
        <div className={styles.benchInfoWrap}>
          <div className={styles.playerNameSmall}>{c?.name ?? '—'}</div>
          <div className={styles.subtitleSmall}>
            {(c?.display_position ?? c?.primary_position ?? '—')} • {c?.team ?? '—'}
          </div>
        </div>
        <button
          className={styles.replaceMini}
          onClick={() => setModal({ open: true, ctx: { kind: 'bench', benchKey, current: c ?? null } })}
          title="Replace"
        >
          Replace
        </button>
      </div>
    </div>
  )

  const PitchRow = ({ p, idx, isBullpen }: { p: Card, idx: number, isBullpen?: boolean }) => (
    <li className={styles.listItem}>
      {p.image && <img src={p.image} alt="" className={styles.dotThumb} />}
      <span>{p.name}</span>
      <span className={styles.mono}>
        • {isBullpen ? String(p.display_position ?? '').toUpperCase() : 'SP'}
        {isBullpen && p.role === 'Closer' ? ' (Closer)' : ''}
      </span>
      <button
        className={styles.replaceMini}
        onClick={() => {
          if (isBullpen) {
            setModal({ open: true, ctx: { kind: 'bullpen', atIndex: idx, current: p, carryCloser: p.role === 'Closer' } })
          } else {
            setModal({ open: true, ctx: { kind: 'rotation', atIndex: idx, current: p } })
          }
        }}
        title="Replace"
      >
        Replace
      </button>
    </li>
  )

  /* ---------------- render ---------------- */

  return (
    <div className={styles.wrap}>
      <header className={styles.header}>
        <h1 className={styles.title}>Team Builder</h1>
        <div className={styles.controls}>
          <label className={styles.label}>Optimize for</label>
          <select className={styles.select} value={metric} onChange={e => setMetric(e.target.value as Metric)}>
            <option value="meta_ovr">Meta OVR</option>
            <option value="true_ovr">True OVR</option>
            <option value="power">Power</option>
            <option value="contact">Contact</option>
            <option value="bunting">Bunting</option>
            <option value="defense">Defense</option>
            <option value="baserunning">Baserunning</option>
            <option value="vs_left">VS Left</option>
            <option value="vs_right">VS Right</option>
          </select>
          <button className="btn btn-primary" onClick={() => build(metric)} disabled={loading}>
            {loading ? 'Building…' : 'Rebuild'}
          </button>
        </div>
      </header>

      {/* KPI bar */}
      {squadKpis && (
        <div className={styles.kpisBar}>
          <div className={styles.kpi}><span>Meta Overall</span><b>{squadKpis.meta.toFixed(1)}</b></div>
          <div className={styles.kpi}><span>Contact</span><b>{squadKpis.contact.toFixed(1)}</b></div>
          <div className={styles.kpi}><span>Power</span><b>{squadKpis.power.toFixed(1)}</b></div>
          <div className={styles.kpi}><span>Speed</span><b>{squadKpis.speed.toFixed(1)}</b></div>
          <div className={styles.kpi}><span>Defense</span><b>{squadKpis.defense.toFixed(1)}</b></div>
          <div className={styles.kpi}><span>Starters</span><b>{squadKpis.starters.toFixed(1)}</b></div>
          <div className={styles.kpi}><span>Bullpen</span><b>{squadKpis.bullpen.toFixed(1)}</b></div>
        </div>
      )}

      {/* Tips */}
      {tips.length > 0 && (
        <div className={styles.tipsBox}>
          <div className={styles.tipsTitle}>Lineup & Roster Tips</div>
          <ul className={styles.tipsList}>
            {tips.map((t, i) => <li key={i}>{t}</li>)}
          </ul>
        </div>
      )}

      {err && <div className={styles.error}>Error: {err}</div>}

      {loading && (
        <div className={styles.loading}>
          <div className={styles.spinner} />
          <div>Optimizing lineup…</div>
        </div>
      )}

      {!loading && data && (
        <>
          <section className={styles.lineupSection}>
            <h2 className={styles.sectionTitle}>Optimized Batting Order <span className={styles.subtle}>(drag to reorder)</span></h2>
            <div className={styles.lineupCard}>
              {lineupOrder.map((c, i) => <LineRow key={`${c.id}-${i}`} c={c} idx={i} />)}
            </div>
          </section>

          <section className={styles.benchSection}>
            <h2 className={styles.sectionTitle}>Bench (Purpose-Built)</h2>
            <div className={styles.benchGrid}>
              <BenchCard title="Pinch Runner"  c={bench.pinch_runner}      benchKey="pinch_runner" />
              <BenchCard title="Platoon vs L"   c={bench.platoon_vs_left}   benchKey="platoon_vs_left" />
              <BenchCard title="Platoon vs R"   c={bench.platoon_vs_right}  benchKey="platoon_vs_right" />
              <BenchCard title="Defensive Sub"  c={bench.defensive_sub}     benchKey="defensive_sub" />
            </div>
          </section>

          <section className={styles.pitchingSection}>
            <h2 className={styles.sectionTitle}>Pitching Staff</h2>
            <div className={styles.pitchCols}>
              <div>
                <h3 className={styles.subhead}>Rotation (5)</h3>
                <ul className={styles.list}>
                  {rotation.map((p, i) => (
                    <PitchRow key={p.id ?? i} p={p} idx={i} />
                  ))}
                </ul>
              </div>
              <div>
                <h3 className={styles.subhead}>Bullpen (8)</h3>
                <ul className={styles.list}>
                  {bullpen.map((p, i) => (
                    <PitchRow key={p.id ?? i} p={p} idx={i} isBullpen />
                  ))}
                </ul>
              </div>
            </div>
          </section>
        </>
      )}

      {/* Replacement modal */}
      {modal.open && modal.ctx && (
        <div className={styles.modalOverlay} onClick={() => setModal({ open: false, ctx: null })}>
          <div className={styles.modal} onClick={e => e.stopPropagation()}>
            <div className={styles.modalHead}>
              <div className={styles.modalTitle}>
                {modal.ctx.kind === 'lineup' && <>Replace {modal.ctx.current.name} at {modal.ctx.position}</>}
                {modal.ctx.kind === 'bench'   && <>Replace {String(modal.ctx.benchKey).replace(/_/g,' ')}</>}
                {modal.ctx.kind === 'rotation'&& <>Replace SP: {modal.ctx.current.name}</>}
                {modal.ctx.kind === 'bullpen' && <>Replace RP: {modal.ctx.current.name}{modal.ctx.carryCloser ? ' (Closer)' : ''}</>}
              </div>
              <input
                className={styles.search}
                placeholder="Search name…"
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>

            <div className={styles.candList}>
              {modalCandidates.map(c => (
                <button
                  key={String(c.id)}
                  className={`${styles.candRow} ${String(c.id) === String(recommendedId) ? styles.recommended : ''}`}
                  onClick={() => applyReplacement(c)}
                  title={String(c.id) === String(recommendedId) ? 'Recommended' : 'Pick'}
                >
                  {c.image && <img src={c.image} alt="" className={styles.candThumb} />}
                  <div className={styles.candInfo}>
                    <div className={styles.candName}>
                      {c.name} {c.bat_hand ? <span className={styles.hand}>({c.bat_hand})</span> : null}
                    </div>
                    <div className={styles.candMeta}>
                      {(c.display_position ?? c.primary_position ?? '—')} • {c.team ?? '—'}
                    </div>
                  </div>
                  <div className={styles.candScore}>
                    {(modal.ctx.kind === 'rotation' || modal.ctx.kind === 'bullpen')
                      ? pitcherScore(c, metric).toFixed(1)
                      : scoreByMetric(c, metric).toFixed(1)
                    }
                  </div>
                </button>
              ))}
              {modalCandidates.length === 0 && (
                <div className={styles.empty}>No candidates match.</div>
              )}
            </div>

            <div className={styles.modalFoot}>
              <button className="btn" onClick={() => setModal({ open: false, ctx: null })}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
