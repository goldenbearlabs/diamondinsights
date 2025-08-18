'use client'

import { useEffect, useMemo, useState } from 'react'
import styles from './page.module.css'

type Card = {
  id: string | number | null
  name: string | null
  team?: string | null
  display_position?: string | null
  primary_position?: string | null
  rarity?: string | null
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
  bunting_ability?: number | null
  drag_bunting_ability?: number | null
  speed?: number | null
  baserunning_ability?: number | null
  baserunning_aggression?: number | null
  fielding_ability?: number | null
  arm_strength?: number | null
  arm_accuracy?: number | null
  reaction_time?: number | null
  blocking?: number | null

  image?: string | null
}

type ApiResp = { items?: Card[] }

type ViewMode = 'overall' | 'position' | 'hand'
type RankingType =
  | 'true_ovr' | 'meta_ovr' | 'your_ovr'
  | 'vs_left' | 'vs_right'
  | 'bunting' | 'power' | 'contact'
  | 'baserunning' | 'defense'
type TopCount = 5 | 10 | 25

const LOCAL_TTL_MS = 60 * 60 * 1000

function isPitcherPos(pos?: string | null) {
  if (!pos) return false
  const p = pos.toUpperCase()
  return p === 'SP' || p === 'RP' || p === 'CP'
}
function toPosKey(pos?: string | null): string | null {
  if (!pos) return null
  const p = pos.toUpperCase()
  if (p === 'RP' || p === 'CP') return 'Bullpen'
  return p
}

export default function PlayerRankingsPage() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [items, setItems] = useState<Card[]>([])
  const [lastUpdated, setLastUpdated] = useState<number | null>(null)
  const [view, setView] = useState<ViewMode>('overall')
  const [rankingType, setRankingType] = useState<RankingType>('true_ovr')
  const [topCount, setTopCount] = useState<TopCount>(5)
  const [allowSecondaries, setAllowSecondaries] = useState(false)

  const cacheKey = (allowSec: boolean) => `players_cache:${allowSec ? 'withsec' : 'nosec'}`

  function loadFromLocal(allowSec = allowSecondaries): Card[] | null {
    try {
      const raw = localStorage.getItem(cacheKey(allowSec))
      if (!raw) return null
      const { t, items } = JSON.parse(raw)
      if (!t || !Array.isArray(items)) return null
      if (Date.now() - t > LOCAL_TTL_MS) return null
      setLastUpdated(t)
      return items
    } catch {
      return null
    }
  }

  function saveToLocal(items: Card[], allowSec = allowSecondaries) {
    const payload = JSON.stringify({ t: Date.now(), items })
    try { localStorage.setItem(cacheKey(allowSec), payload) } catch {}
  }

  async function fetchData(force = false, allowSec = allowSecondaries) {
    setLoading(true)
    setError(null)
    try {
      if (!force) {
        const cached = loadFromLocal(allowSec)
        if (cached) {
          setItems(cached)
          setLoading(false)
          return
        }
      }
      const params = new URLSearchParams()
      if (force) params.set('force', '1')
      if (allowSec) params.set('allow_secondaries', '1')
      const url = `/api/player-rankings${params.toString() ? `?${params.toString()}` : ''}`

      const res = await fetch(url, { cache: 'no-store' })
      if (!res.ok) throw new Error(`API ${res.status}`)
      const data: ApiResp = await res.json()
      const itemsNext = data.items ?? []
      setItems(itemsNext)
      setLastUpdated(Date.now())
      saveToLocal(itemsNext, allowSec)
    } catch (e: any) {
      setError(e?.message ?? 'Error'); setItems([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    const cached = loadFromLocal()
    if (cached) setItems(cached)
    else fetchData(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allowSecondaries])

  const rankingLabel = useMemo(() => {
    switch (rankingType) {
      case 'true_ovr':   return 'True OVR'
      case 'meta_ovr':   return 'Meta OVR'
      case 'your_ovr':   return 'Your OVR'
      case 'vs_left':    return 'VS Left'
      case 'vs_right':   return 'VS Right'
      case 'bunting':    return 'Bunting'
      case 'power':      return 'Power'
      case 'contact':    return 'Contact'
      case 'baserunning':return 'Baserunning'
      case 'defense':    return 'Defense'
      default:           return 'True OVR'
    }
  }, [rankingType])

  const rawScore = (c: Card): number => {
    switch (rankingType) {
      case 'true_ovr':
        return typeof c.true_ovr === 'number' ? c.true_ovr : (typeof c.ovr === 'number' ? c.ovr : -Infinity)
      case 'meta_ovr':
        return typeof c.meta_ovr === 'number' ? c.meta_ovr : -Infinity
      case 'your_ovr':
        return -Infinity
      case 'vs_left':
        return typeof c.vs_left === 'number' ? c.vs_left : -Infinity
      case 'vs_right':
        return typeof c.vs_right === 'number' ? c.vs_right : -Infinity
      case 'bunting':
        return typeof c.bunting === 'number' ? c.bunting : -Infinity
      case 'power':
        return typeof c.power === 'number' ? c.power : -Infinity
      case 'contact':
        return typeof c.contact === 'number' ? c.contact : -Infinity
      case 'baserunning':
        return typeof c.baserunning === 'number' ? c.baserunning : -Infinity
      case 'defense':
        return typeof c.defense === 'number' ? c.defense : -Infinity
      default:
        return -Infinity
    }
  }

  const displayScore = (c: Card): number | null => {
    const s = rawScore(c)
    if (!Number.isFinite(s)) return null
    return Math.min(s as number, 150)
  }

  const hittersTop = useMemo(() => {
    return (items || [])
      .filter(i => !isPitcherPos(i.display_position))
      .sort((a, b) => rawScore(b) - rawScore(a))
      .slice(0, topCount)
  }, [items, rankingType, topCount])

  const pitchersTop = useMemo(() => {
    return (items || [])
      .filter(i => isPitcherPos(i.display_position))
      .sort((a, b) => rawScore(b) - rawScore(a))   // ← use rawScore
      .slice(0, topCount)
  }, [items, rankingType, topCount])    

  const byPosition = useMemo(() => {
    const order = ['C','1B','2B','3B','SS','LF','CF','RF','SP','Bullpen'] as const
    const groups: Record<string, Card[]> = Object.create(null)
    for (const key of order) groups[key] = []
    for (const c of items) {
      const key = toPosKey(c.display_position)
      if (!key || !(key in groups)) continue
      groups[key].push(c)
    }
    for (const k of Object.keys(groups)) {
        const sorter = (a: Card, b: Card) => rawScore(b) - rawScore(a)
        groups[k] = groups[k].sort(sorter).slice(0, topCount)
      }
    return { order, groups }
  }, [items, rankingType, topCount])

  const byHand = useMemo(() => {
    const sections = [
      { key: 'LH Hitters',    filter: (c: Card) => !isPitcherPos(c.display_position) && c.bat_hand === 'L' },
      { key: 'RH Hitters',    filter: (c: Card) => !isPitcherPos(c.display_position) && c.bat_hand === 'R' },
      { key: 'Switch Hitters',filter: (c: Card) => !isPitcherPos(c.display_position) && c.bat_hand === 'S' },
      { key: 'RH Starters',   filter: (c: Card) => c.display_position?.toUpperCase() === 'SP' && c.throw_hand === 'R' },
      { key: 'LH Starters',   filter: (c: Card) => c.display_position?.toUpperCase() === 'SP' && c.throw_hand === 'L' },
      { key: 'RH Relievers',  filter: (c: Card) => (c.display_position?.toUpperCase() === 'RP' || c.display_position?.toUpperCase() === 'CP') && c.throw_hand === 'R' },
      { key: 'LH Relievers',  filter: (c: Card) => (c.display_position?.toUpperCase() === 'RP' || c.display_position?.toUpperCase() === 'CP') && c.throw_hand === 'L' },
    ] as const

    return sections.map(s => ({
      title: s.key,
      rows: items
        .filter(s.filter)
        .sort((a, b) => rawScore(b) - rawScore(a))
    }))
  }, [items, rankingType, topCount])

  const fmt = (v: number | string | null | undefined, digits = 1) => {
    if (v == null || v === '') return '—'
    if (typeof v === 'number') return v.toLocaleString(undefined, { maximumFractionDigits: digits, minimumFractionDigits: digits })
    const num = Number(v)
    return Number.isFinite(num)
      ? num.toLocaleString(undefined, { maximumFractionDigits: digits, minimumFractionDigits: digits })
      : '—'
  }

  const ListTable = ({ rows, title }: { rows: Card[], title: string }) => (
    <div className={styles.tableWrap}>
      <h3 className={styles.sectionTitle}>{title}</h3>
      <table className={styles.table}>
        <thead>
          <tr>
            <th className={styles.th}>#</th>
            <th className={styles.thLeft}>Player</th>
            <th className={styles.th}>Team</th>
            <th className={styles.th}>Pos</th>
            <th className={styles.th}>{rankingLabel}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((c, idx) => {
            const disp = displayScore(c)
            return (
              <tr key={`${c.id ?? c.name}-${idx}`} className={styles.tr}>
                <td className={styles.tdCenter}>{idx + 1}</td>
                <td className={styles.nameCell}>
                  {c.image && <img src={c.image} alt="" className={styles.thumb} />}
                  <span>{c.name ?? '—'}</span>
                </td>
                <td className={styles.tdCenter}>{c.team ?? '—'}</td>
                <td className={styles.tdCenter}>{c.primary_position ?? c.display_position ?? '—'}</td>
                <td className={styles.tdCenter}><strong>{fmt(disp, 1)}</strong></td>
              </tr>
            )
          })}
        </tbody>
      </table>
      {rows.length === 0 && <div className={styles.empty}>No cards found.</div>}
    </div>
  )

  return (
    <div className={styles.wrap}>
      <div className={styles.headerRow}>
        <h1 className={styles.title}>Player Rankings</h1>
        <div className={styles.actions}>
          <div className={styles.toggle}>
            <button className={`${styles.toggleBtn} ${view === 'overall' ? styles.activeToggle : ''}`} onClick={() => setView('overall')} disabled={loading}>Overall</button>
            <button className={`${styles.toggleBtn} ${view === 'position' ? styles.activeToggle : ''}`} onClick={() => setView('position')} disabled={loading}>By Position</button>
            <button className={`${styles.toggleBtn} ${view === 'hand' ? styles.activeToggle : ''}`} onClick={() => setView('hand')} disabled={loading}>By Hand</button>
          </div>
          <button className={`btn btn-secondary ${styles.refreshBtn}`} onClick={() => fetchData(true)} disabled={loading}>
            {loading ? 'Refreshing…' : 'Force Refresh'}
          </button>
          {lastUpdated && <span className={styles.meta}>Last updated: {new Date(lastUpdated).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>}
        </div>
      </div>

      {error && <div className={styles.error}>Error: {error}</div>}
      {loading && (
        <div className={styles.loadingOverlay}>
          <div>
            <div className={styles.spinner} />
            <div className={styles.loadingText}>Loading…</div>
          </div>
        </div>
      )}

      <div className={styles.controlsRow}>
        <div className={styles.toggleRow}>
          <label className={styles.checkboxLabel}>
            <input
              type="checkbox"
              checked={allowSecondaries}
              onChange={(e) => {
                const checked = e.target.checked
                setAllowSecondaries(checked)
                fetchData(false, checked)
              }}
            />
            Allow secondaries & OOP
          </label>
        </div>

        <div className={styles.rankingType}>
          <label>Ranking Type:</label>
          <select
            value={rankingType}
            onChange={(e) => setRankingType(e.target.value as RankingType)}
            className={styles.select}
          >
            <option value="true_ovr">True OVR</option>
            <option value="meta_ovr">Meta OVR</option>
            <option value="your_ovr">Your OVR (Coming Soon)</option>
            <option value="vs_left">VS Left</option>
            <option value="vs_right">VS Right</option>
            <option value="bunting">Bunting</option>
            <option value="power">Power</option>
            <option value="contact">Contact</option>
            <option value="baserunning">Baserunning</option>
            <option value="defense">Defense</option>
          </select>
        </div>

        <div className={styles.topCount}>
          <label>Show Top:</label>
          <div className={styles.countToggle}>
            <button className={`${styles.countBtn} ${topCount === 5 ? styles.activeCount : ''}`} onClick={() => setTopCount(5)}>5</button>
            <button className={`${styles.countBtn} ${topCount === 10 ? styles.activeCount : ''}`} onClick={() => setTopCount(10)}>10</button>
            <button className={`${styles.countBtn} ${topCount === 25 ? styles.activeCount : ''}`} onClick={() => setTopCount(25)}>25</button>
          </div>
        </div>
      </div>

      {rankingType === 'your_ovr' && (
        <div className={styles.comingSoon}>
          ⚠️ Your OVR rankings are coming soon! Currently other types are fully supported.
        </div>
      )}

      {view === 'overall' ? (
        <div className={styles.columns}>
          <section className={styles.section}>
            <ListTable rows={hittersTop} title={`Top ${topCount} Hitters (${rankingLabel})`} />
          </section>
          <section className={styles.section}>
            <ListTable
              rows={pitchersTop}
              title={`Top ${topCount} Pitchers (${rankingLabel})`}
            />
          </section>
        </div>
      ) : view === 'position' ? (
        <div className={styles.posGrid}>
          {byPosition.order.map((pos) => (
            <section key={pos} className={styles.section}>
              <ListTable
                rows={byPosition.groups[pos]}
                title={`Top ${topCount} ${pos} (${rankingLabel})`}
              />
            </section>
          ))}
        </div>
      ) : (
        <div className={styles.posGrid}>
          {byHand.map(({ title, rows }) => (
            <section key={title} className={styles.section}>
              <ListTable
                rows={rows}
                title={`Top ${topCount} ${title} (${rankingLabel})`}
              />
            </section>
          ))}
        </div>
      )}
    </div>
  )
}
