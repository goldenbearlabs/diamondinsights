// app/insights/page.tsx
'use client'

import { useEffect, useMemo, useState } from 'react'
import styles from './page.module.css'
import { auth, db } from '@/lib/firebaseClient'
import { onAuthStateChanged, User } from 'firebase/auth'
import { doc, getDoc, updateDoc } from 'firebase/firestore'

type Platform = 'psn' | 'xbl' | 'mlbts' | 'nsw'
type ModeParam = 'all' | 'arena' | 'exhibition'
type Subset = 'all' | 'online' | 'vsCPU' | 'arena' | 'exhibition'

type GameRow = {
  id: string; dateISO: string | null; mode: string
  home: { name: string; runs: number; hits: number; errors: number; result: string }
  away: { name: string; runs: number; hits: number; errors: number; result: string }
  youAre: 'home' | 'away' | null
  isCPU: boolean; isOnline: boolean
  youRuns: number | null; oppRuns: number | null
  pitcherInfo: string; displayDate: string
}
type InsightsSummary = {
  totalGames: number; onlineCount: number; cpuCount: number; arenaCount: number; exhibitionCount: number; wins: number; losses: number; runDiff: number
}
type InsightsResponse = {
  user: { username: string; platform: Platform; mode: ModeParam }
  summary: InsightsSummary
  groups: { all: string[]; online: string[]; vsCPU: string[]; arena: string[]; exhibition: string[] }
  gameLog: GameRow[]
  next: { hasMore: boolean; page: number; totalPages: number }
}
type GameLogParsed = {
  id: string; youTeam: string; oppTeam: string;
  runsByInningYou: number[]; runsByInningOpp: number[];
  goAheadEvents: number; perfectContactHitsYou: number; perfectContactHitsOpp: number;
  swingingKYou: number; lookingKYou: number; chaseKYou: number;
  swingingKOpp: number; lookingKOpp: number; chaseKOpp: number;
  ballpark?: string;
  batting: { strikeoutsByPitch: Record<string, number>; strikeoutsByLoc: Record<string, number>; homers: number; doublePlays: number }
  pitching: { strikeoutsByPitch: Record<string, number>; strikeoutsByLoc: Record<string, number>; homersAllowed: number }
}
type SplitPA = {
  inning: number
  outs: 0|1|2
  result: '1B'|'2B'|'3B'|'HR'|'BB'|'SO'|'HBP'|'SF'|'SH'|'OUT'|'DP'|'ROE'
  pThrow: 'L'|'R'|null
  pOutlier: boolean
  pMax: number|null
  bSide: 'L'|'R'|null
  bHeightIn: number|null
  diff: string | null
}
type SplitBundle = { games: Array<{ id: string; you: SplitPA[]; opp: SplitPA[] }> }

type AggregateResponse = {
  scope: { subset: Subset; limit: number; countedGames: number }
  yourStats: { games: number; batting: any; pitching: any }
  oppStats: { games: number; batting: any; pitching: any }
  yourInsights: {
    games: number; goAheadEvents: number; comebackWins: number; perfectContactYou: number; perfectContactOpp: number;
    runsByInningYou: number[]; runsByInningOpp: number[];
    KPitchYou: Record<string, number>; KLocYou: Record<string, number>;
    KPitchOpp: Record<string, number>; KLocOpp: Record<string, number>;
    swingingKYou: number; lookingKYou: number; chaseKYou: number;
    swingingKOpp: number; lookingKOpp: number; chaseKOpp: number;
    byBallpark: Record<string, { g: number; w: number; l: number; runsFor: number; runsAgainst: number; hrFor: number; hrAgainst: number; OPS: number }>
  }
  byPlayers: { hitters: Record<string, any>; pitchers: Record<string, any> }
  vsPitcher: Record<string, any>
  splitBundle?: SplitBundle
}

function summarize(rows: GameRow[]): InsightsSummary {
  let wins=0, losses=0, runDiff=0, online=0, cpu=0, arena=0, exhibition=0
  for (const r of rows) {
    if (r.isOnline) online++; else cpu++
    const m = String(r.mode).toUpperCase()
    if (m === 'ARENA') arena++
    if (m === 'EXHIBITION') exhibition++
    if (r.youRuns != null && r.oppRuns != null) {
      if (r.youRuns > r.oppRuns) wins++
      else if (r.youRuns < r.oppRuns) losses++
      runDiff += r.youRuns - r.oppRuns
    }
  }
  return { totalGames: rows.length, onlineCount: online, cpuCount: cpu, arenaCount: arena, exhibitionCount: exhibition, wins, losses, runDiff }
}

export default function InsightsPage() {
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<any>(null)
  const [loadingProfile, setLoadingProfile] = useState(true)

  const [username, setUsername] = useState('')
  const [platform, setPlatform] = useState<Platform>('psn')
  const [mode, setMode] = useState<ModeParam>('arena')
  const [subset, setSubset] = useState<Subset>('online')

  const [data, setData] = useState<InsightsResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  const [expanded, setExpanded] = useState<Record<string, GameLogParsed>>({})
  const [view, setView] = useState<'logs' | 'your-stats' | 'your-insights' | 'hitters' | 'pitchers'>('logs')

  // Aggregate (server base) + split bundle (client filtering)
  const [aggBase, setAggBase] = useState<AggregateResponse | null>(null)
  const [splitBundle, setSplitBundle] = useState<SplitBundle | null>(null)
  const [aggLoading, setAggLoading] = useState(false)

  // split filters
  const [pThrow, setPThrow] = useState<'all'|'L'|'R'>('all')
  const [bBat, setBBat] = useState<'all'|'L'|'R'|'S'>('all')
  const [innSel, setInnSel] = useState<'all'|'1'|'2'|'3'|'4'|'5'|'6'|'7'|'8'|'9'|'10+'>('all')
  const [outsSel, setOutsSel] = useState<'all'|'0'|'1'|'2'>('all')
  const [difficulty, setDifficulty] = useState<'all'|'Rookie'|'Veteran'|'All-Star'|'Hall Of Fame'|'Legend'|'Goat'>('all')
  const [pitcherProfile, setPitcherProfile] = useState<'all'|'outlier'|'lowvelo'>('all')
  const [hitterHeight, setHitterHeight] = useState<'all'|'tall'|'small'>('all')

  useEffect(() => onAuthStateChanged(auth, u => setUser(u)), [])

  useEffect(() => {
    const run = async () => {
      if (!user) { setProfile(null); setLoadingProfile(false); return }
      setLoadingProfile(true)
      const ref = doc(db, 'users', user.uid)
      const snap = await getDoc(ref)
      const p = snap.exists() ? snap.data() : null
      setProfile(p)
      if (p?.mlb_username) setUsername(p.mlb_username)
      if (p?.mlb_platform) setPlatform(p.mlb_platform)
      if (p?.mlb_default_mode) setMode(p.mlb_default_mode)
      setLoadingProfile(false)
    }
    run()
  }, [user])

  const canFetch = !!user && !!username.trim()

  async function saveProfile() {
    if (!user) return
    const ref = doc(db, 'users', user.uid)
    await updateDoc(ref, { mlb_username: username.trim(), mlb_platform: platform, mlb_default_mode: mode })
  }

  async function fetchInsights() {
    if (!canFetch) return
    setLoading(true); setErr(null)
    try {
      const q = new URLSearchParams({ username: username.trim(), platform, mode })
      const res = await fetch(`/api/insights?${q}`, { cache: 'no-store' })
      if (!res.ok) throw new Error(await res.text())
      const j: InsightsResponse = await res.json()
      setData(j); setExpanded({}); setAggBase(null); setSplitBundle(null)
    } catch (e: any) { setErr(e?.message || 'Failed') } finally { setLoading(false) }
  }

  async function expandRow(id: string, row: GameRow) {
    if (expanded[id]) return
    const q = new URLSearchParams({
      id, username: username.trim(), platform, mode,
      youAre: row.youAre || '', home: row.home.name, away: row.away.name
    })
    const res = await fetch(`/api/insights?${q}`, { cache: 'no-store' })
    if (!res.ok) return
    const j: GameLogParsed = await res.json()
    setExpanded(prev => ({ ...prev, [id]: j }))
  }

  // Fetch aggregate + split bundle when switching to non-logs, or when the base grouping changes
  useEffect(() => {
    const run = async () => {
      if (!data || view === 'logs') return
      setAggLoading(true)
      const q = new URLSearchParams({
        username: username.trim(), platform, mode, aggregate: '1', subset, limit: '200', concurrency: '16',
        pThrow, bBat, inning: innSel, outs: outsSel, difficulty, pitcherProfile, hitterHeight,
        includePAs: '1'
      })
      const res = await fetch(`/api/insights?${q}`, { cache: 'no-store' })
      if (res.ok) {
        const j: AggregateResponse = await res.json()
        setAggBase(j)
        setSplitBundle(j.splitBundle || null)
      }
      setAggLoading(false)
    }
    run()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, subset, mode, platform, username, data])

  // local split math (no re-fetch). Only HITTING changes with these filters.
  const aggView = useMemo(() => {
    if (!aggBase) return null
    if (!splitBundle) return aggBase // server numbers w/out local cache
    const filt = {
      pThrow, bBat, innSel, outsSel, difficulty, pitcherProfile, hitterHeight
    }

    const calc = (arr: SplitPA[]) => {
      const youB = { AB:0,R:0,H:0,_1B:0,_2B:0,_3B:0,HR:0,RBI:0,BB:0,SO:0,HBP:0,SF:0,SH:0,SB:0,CS:0,TB:0,AVG:0,OBP:0,SLG:0,OPS:0,ISO:0,BABIP:0,GIDP:0, PA:0 }
      const pass = (pa: SplitPA) => {
        if (filt.pThrow !== 'all' && pa.pThrow !== filt.pThrow) return false
        if (filt.pitcherProfile === 'outlier' && !pa.pOutlier) return false
        if (filt.pitcherProfile === 'lowvelo' && !(pa.pMax != null && pa.pMax <= 92)) return false
        if (filt.bBat !== 'all' && pa.bSide !== filt.bBat) return false
        if (filt.hitterHeight === 'tall' && !(pa.bHeightIn != null && pa.bHeightIn >= 76)) return false
        if (filt.hitterHeight === 'small' && !(pa.bHeightIn != null && pa.bHeightIn <= 70)) return false
        if (filt.innSel !== 'all') {
          if (filt.innSel === '10+') { if (!(pa.inning >= 10)) return false }
          else if (pa.inning !== Number(filt.innSel)) return false
        }
        if (filt.outsSel !== 'all' && pa.outs !== Number(filt.outsSel)) return false
        if (filt.difficulty !== 'all' && pa.diff !== filt.difficulty) return false
        return true
      }
      for (const pa of arr) {
        if (!pass(pa)) continue
        switch (pa.result) {
          case 'BB': youB.BB++; break
          case 'HBP': youB.HBP++; break
          case 'SF': youB.SF++; break
          case 'SH': youB.SH++; break
          case 'SO': youB.SO++; youB.AB++; break
          case '1B': youB.AB++; youB.H++; youB._1B++; break
          case '2B': youB.AB++; youB.H++; youB._2B++; break
          case '3B': youB.AB++; youB.H++; youB._3B++; break
          case 'HR': youB.AB++; youB.H++; youB.HR++; break
          case 'OUT': case 'DP': case 'ROE': youB.AB++; break
        }
      }
      youB.TB = youB._1B + 2*youB._2B + 3*youB._3B + 4*youB.HR
      const PA = youB.AB + youB.BB + youB.HBP + youB.SF
      youB.PA = PA
      youB.AVG = youB.AB ? youB.H/youB.AB : 0
      youB.OBP = PA ? (youB.H + youB.BB + youB.HBP)/PA : 0
      youB.SLG = youB.AB ? youB.TB/youB.AB : 0
      youB.OPS = youB.OBP + youB.SLG
      youB.ISO = youB.SLG - youB.AVG
      youB.BABIP = (youB.AB - youB.SO - youB.HR + youB.SF) ? (youB.H - youB.HR)/(youB.AB - youB.SO - youB.HR + youB.SF) : 0
      return youB
    }

    const youPAs: SplitPA[] = []
    const oppPAs: SplitPA[] = []
    for (const g of splitBundle.games) {
      youPAs.push(...g.you)
      oppPAs.push(...g.opp)
    }
    const youB = calc(youPAs)
    const oppB = calc(oppPAs)

    // merge back into base (only batting)
    return {
      ...aggBase,
      yourStats: { ...aggBase.yourStats, batting: { ...aggBase.yourStats.batting, ...youB } },
      oppStats:  { ...aggBase.oppStats,  batting: { ...aggBase.oppStats.batting,  ...oppB } },
    } as AggregateResponse
  }, [aggBase, splitBundle, pThrow, bBat, innSel, outsSel, difficulty, pitcherProfile, hitterHeight])

  useEffect(() => { if (canFetch) fetchInsights() }, [canFetch, platform, mode])
  // NOTE: we no longer refetch on every filter change — we compute locally via aggView useMemo above.

  const filteredRows = useMemo(() => {
    if (!data) return []
    const ids = data.groups[subset]
    const map = new Map(data.gameLog.map(r => [r.id, r]))
    return ids.map(id => map.get(id)!).filter(Boolean)
  }, [data, subset])

  const filteredSummary = useMemo(() => summarize(filteredRows), [filteredRows])

  if (!user) {
    if (loadingProfile) return <div className={styles.container}>Loading…</div>
    return (
      <div className={styles.container}>
        <div className={styles.header}><h1>Insights</h1></div>
        <p>You need to be signed in. <a href="/login">Go to login</a></p>
      </div>
    )
  }

  const agg = aggView // convenience alias for render

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1>Insights</h1>
      </div>

      {/* Username strip */}
      <div className={styles.row}>
        <input className={styles.input} placeholder="MLB The Show username" value={username} onChange={e => setUsername(e.target.value)} />
        <select className={styles.select} value={platform} onChange={e => setPlatform(e.target.value as Platform)}>
          <option value="psn">PSN</option><option value="xbl">Xbox</option><option value="mlbts">MLBTS</option><option value="nsw">Switch</option>
        </select>
        <select className={styles.select} value={mode} onChange={e => setMode(e.target.value as ModeParam)}>
          <option value="arena">Arena</option><option value="exhibition">Exhibition</option><option value="all">All</option>
        </select>
        <button className={`${styles.button} ${styles.saveBtn}`} onClick={saveProfile} disabled={!username.trim()}>Save Profile</button>
        <button className={`${styles.button} ${styles.fetchBtn}`} onClick={fetchInsights} disabled={loading}>{loading ? 'Loading...' : 'Get Insights'}</button>
      </div>

      {/* split filters (batting-focused) */}
      {view !== 'logs' && (
        <div className={styles.row}>
          <select className={styles.select} value={pThrow} onChange={e=>setPThrow(e.target.value as any)}>
            <option value="all">Pitcher Hand: All</option><option value="L">LHP</option><option value="R">RHP</option>
          </select>
          <select className={styles.select} value={bBat} onChange={e=>setBBat(e.target.value as any)}>
            <option value="all">Batter Side: All</option><option value="L">Left</option><option value="R">Right</option><option value="S">Switch</option>
          </select>
          <select className={styles.select} value={innSel} onChange={e=>setInnSel(e.target.value as any)}>
            <option value="all">Inning: All</option>{['1','2','3','4','5','6','7','8','9','10+'].map(x=> <option key={x} value={x}>{x}</option>)}
          </select>
          <select className={styles.select} value={outsSel} onChange={e=>setOutsSel(e.target.value as any)}>
            <option value="all">Outs: All</option><option value="0">0</option><option value="1">1</option><option value="2">2</option>
          </select>
          <select className={styles.select} value={difficulty} onChange={e=>setDifficulty(e.target.value as any)}>
            {['all','Rookie','Veteran','All-Star','Hall Of Fame','Legend','Goat'].map(x=><option key={x} value={x}>{x === 'all' ? 'Difficulty: All' : x}</option>)}
          </select>
          <select className={styles.select} value={pitcherProfile} onChange={e=>setPitcherProfile(e.target.value as any)}>
            <option value="all">Pitcher: All</option><option value="outlier">Outlier</option><option value="lowvelo">Low Velo (≤92)</option>
          </select>
          <select className={styles.select} value={hitterHeight} onChange={e=>setHitterHeight(e.target.value as any)}>
            <option value="all">Hitter Size: All</option><option value="tall">Tall (≥6'4")</option><option value="small">Small (≤5'10")</option>
          </select>
        </div>
      )}

      {err && <div className={styles.error}>Error: {err}</div>}

      {data && (
        <>
          <div className={styles.summaryCards}>
            <div className={styles.card}><div className={styles.cardTitle}>Games</div><div className={styles.cardValue}>{filteredSummary.totalGames}</div></div>
            <div className={styles.card}><div className={styles.cardTitle}>Record</div><div className={styles.cardValue}>{filteredSummary.wins}-{filteredSummary.losses}</div></div>
            <div className={styles.card}><div className={styles.cardTitle}>Run Diff</div><div className={styles.cardValue}>{filteredSummary.runDiff}</div></div>
            <div className={styles.card}><div className={styles.cardTitle}>Online</div><div className={styles.cardValue}>{filteredSummary.onlineCount}</div></div>
            <div className={styles.card}><div className={styles.cardTitle}>CPU</div><div className={styles.cardValue}>{filteredSummary.cpuCount}</div></div>
          </div>

          <div className={styles.filterTabs}>
            {(['online', 'all', 'vsCPU', 'arena', 'exhibition'] as const).map(t => (
              <button key={t} className={`${styles.filterTab} ${subset === t ? styles.filterTabActive : ''}`} onClick={() => setSubset(t)}>{t}</button>
            ))}
          </div>

          <div className={styles.viewTabs}>
            {(['logs','your-stats','your-insights','hitters','pitchers'] as const).map(v => (
              <button key={v} className={`${styles.viewTab} ${view === v ? styles.viewTabActive : ''}`} onClick={() => setView(v)}>{v.replace('-', ' ')}</button>
            ))}
          </div>

          {view === 'logs' && (
            <>
              <div className={styles.tableContainer}>
                <table className={styles.table}>
                  <thead>
                    <tr><th>Date</th><th>Mode</th><th>Home</th><th>Away</th><th>You</th><th>Score</th><th>Result</th><th></th></tr>
                  </thead>
                  <tbody>
                    {filteredRows.map(r => {
                      const youTeam = r.youAre === 'home' ? r.home.name : r.youAre === 'away' ? r.away.name : ''
                      const score = `${r.home.runs}-${r.away.runs}`
                      const youRes = r.youRuns == null || r.oppRuns == null ? '-' : r.youRuns > r.oppRuns ? 'W' : r.youRuns < r.oppRuns ? 'L' : 'T'
                      return (
                        <tr key={r.id} onClick={() => expandRow(r.id, r)}>
                          <td>{r.displayDate}</td><td>{r.mode}</td>
                          <td>{r.home.name} ({r.home.runs})</td><td>{r.away.name} ({r.away.runs})</td>
                          <td>{youTeam || '-'}</td><td>{score}</td>
                          <td><span className={youRes === 'W' ? styles.win : youRes === 'L' ? styles.loss : ''}>{youRes}</span></td>
                          <td><button className={styles.rowButton} onClick={() => expandRow(r.id, r)}>{expanded[r.id] ? '▲' : '▼'} Details</button></td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>

              {filteredRows.map(r => {
                const parsed = expanded[r.id]
                if (!parsed) return null
                return (
                  <div key={r.id + ':drawer'} className={styles.drawer}>
                    <div className={styles.drawerHeader}>
                      <h3>Game {r.id} — {(parsed.youTeam)} vs {(parsed.oppTeam)}{parsed.ballpark ? ` @ ${parsed.ballpark}` : ''}</h3>
                    </div>
                    <div className={styles.grid}>
                      <div className={styles.section}>
                        <h4 className={styles.sectionTitle}>Batting (You)</h4>
                        <div className={styles.kv}><span>HR</span><span>{parsed.batting.homers}</span></div>
                        <div className={styles.kv}><span>DP</span><span>{parsed.batting.doublePlays}</span></div>
                        <div className={styles.kv}><span>SO pitch</span><span>{Object.entries(parsed.batting.strikeoutsByPitch).map(([k,v]) => `${k}:${v}`).join(', ') || '-'}</span></div>
                        <div className={styles.kv}><span>SO loc</span><span>{Object.entries(parsed.batting.strikeoutsByLoc).map(([k,v]) => `${k}:${v}`).join(', ') || '-'}</span></div>
                        <div className={styles.kv}><span>SO (swing/looking/chase)</span><span>{parsed.swingingKYou}/{parsed.lookingKYou}/{parsed.chaseKYou}</span></div>
                        <div className={styles.kv}><span>Go-Ahead events</span><span>{parsed.goAheadEvents}</span></div>
                        <div className={styles.kv}><span>Perfect contact (You/Opp)</span><span>{parsed.perfectContactHitsYou}/{parsed.perfectContactHitsOpp}</span></div>
                      </div>
                      <div className={styles.section}>
                        <h4 className={styles.sectionTitle}>Pitching (You)</h4>
                        <div className={styles.kv}><span>HR allowed</span><span>{parsed.pitching.homersAllowed}</span></div>
                        <div className={styles.kv}><span>SO pitch</span><span>{Object.entries(parsed.pitching.strikeoutsByPitch).map(([k,v]) => `${k}:${v}`).join(', ') || '-'}</span></div>
                        <div className={styles.kv}><span>SO loc</span><span>{Object.entries(parsed.pitching.strikeoutsByLoc).map(([k,v]) => `${k}:${v}`).join(', ') || '-'}</span></div>
                        <div className={styles.kv}><span>SO (swing/looking/chase)</span><span>{parsed.swingingKOpp}/{parsed.lookingKOpp}/{parsed.chaseKOpp}</span></div>
                      </div>
                    </div>
                    <div className={styles.runsSection}>
                      <h4 className={styles.sectionTitle}>Runs by inning</h4>
                      <div className={styles.runsGrid}>
                        <div><div className={styles.runsLabel}>You:</div><div className={styles.runsValue}>{parsed.runsByInningYou.join(', ') || '-'}</div></div>
                        <div><div className={styles.runsLabel}>Opp:</div><div className={styles.runsValue}>{parsed.runsByInningOpp.join(', ') || '-'}</div></div>
                      </div>
                    </div>
                  </div>
                )
              })}
            </>
          )}

          {view !== 'logs' && (
            <>
              {aggLoading && (
                <div className={styles.loadingOverlay}><div className={styles.spinner}></div><div>Calculating advanced stats...</div></div>
              )}
              {!aggLoading && agg && (
                <>
                  {view === 'your-stats' && (
                    <div className={styles.grid}>
                      {/* YOU card */}
                      <div className={styles.section}>
                        <h3 className={styles.sectionHeader}>You</h3>
                        <div className={styles.insightsSection}>
                          <h4>Hitting</h4>
                          <div className={styles.statsGrid}>
                            <Stat label="PA" v={(agg.yourStats.batting as any).PA} />
                            <Stat label="AB" v={agg.yourStats.batting.AB} />
                            <Stat label="H / HR" v={`${agg.yourStats.batting.H} / ${agg.yourStats.batting.HR}`} />
                            <Stat label="BB / SO" v={`${agg.yourStats.batting.BB} / ${agg.yourStats.batting.SO}`} />
                            <Stat label="AVG / OBP / SLG / OPS" v={`${agg.yourStats.batting.AVG.toFixed(3)} / ${agg.yourStats.batting.OBP.toFixed(3)} / ${agg.yourStats.batting.SLG.toFixed(3)} / ${agg.yourStats.batting.OPS.toFixed(3)}`} />
                          </div>
                        </div>
                        <div className={styles.insightsSection}>
                          <h4>Pitching</h4>
                          <div className={styles.statsGrid}>
                            <Stat label="IP" v={agg.yourStats.pitching.IP.toFixed(1)} />
                            <Stat label="ERA / WHIP" v={`${agg.yourStats.pitching.ERA.toFixed(2)} / ${agg.yourStats.pitching.WHIP.toFixed(2)}`} />
                            <Stat label="K/9 / BB/9 / HR/9" v={`${agg.yourStats.pitching.K9.toFixed(2)} / ${agg.yourStats.pitching.BB9.toFixed(2)} / ${agg.yourStats.pitching.HR9.toFixed(2)}`} />
                            <Stat label="Opp OPS (vs you)" v={agg.yourStats.pitching.OppOPS.toFixed(3)} />
                          </div>
                        </div>
                        <div className={styles.insightsSection}>
                          <h4>Baserunning & Defense</h4>
                          <div className={styles.statsGrid}>
                            <Stat label="SB / CS (SB%)" v={`${agg.yourStats.batting.SB} / ${agg.yourStats.batting.CS} (${((agg.yourStats.batting.SBpct||0)*100).toFixed(1)}%)`} />
                            <Stat label="GIDP" v={agg.yourStats.batting.GIDP} />
                          </div>
                        </div>
                      </div>

                      {/* OPPONENT card */}
                      <div className={styles.section}>
                        <h3 className={styles.sectionHeader}>Opponent (vs You)</h3>
                        <div className={styles.insightsSection}>
                          <h4>Hitting</h4>
                          <div className={styles.statsGrid}>
                            <Stat label="PA" v={(agg.oppStats.batting as any).PA} />
                            <Stat label="AB" v={agg.oppStats.batting.AB} />
                            <Stat label="H / HR" v={`${agg.oppStats.batting.H} / ${agg.oppStats.batting.HR}`} />
                            <Stat label="BB / SO" v={`${agg.oppStats.batting.BB} / ${agg.oppStats.batting.SO}`} />
                            <Stat label="AVG / OBP / SLG / OPS" v={`${agg.oppStats.batting.AVG.toFixed(3)} / ${agg.oppStats.batting.OBP.toFixed(3)} / ${agg.oppStats.batting.SLG.toFixed(3)} / ${agg.oppStats.batting.OPS.toFixed(3)}`} />
                          </div>
                        </div>
                        <div className={styles.insightsSection}>
                          <h4>Pitching</h4>
                          <div className={styles.statsGrid}>
                            <Stat label="IP" v={agg.oppStats.pitching.IP.toFixed(1)} />
                            <Stat label="ERA / WHIP" v={`${agg.oppStats.pitching.ERA.toFixed(2)} / ${agg.oppStats.pitching.WHIP.toFixed(2)}`} />
                            <Stat label="K/9 / BB/9 / HR/9" v={`${agg.oppStats.pitching.K9.toFixed(2)} / ${agg.oppStats.pitching.BB9.toFixed(2)} / ${agg.oppStats.pitching.HR9.toFixed(2)}`} />
                          </div>
                        </div>
                        <div className={styles.insightsSection}>
                          <h4>Baserunning & Defense</h4>
                          <div className={styles.statsGrid}>
                            <Stat label="SB / CS (SB%)" v={`${agg.oppStats.batting.SB} / ${agg.oppStats.batting.CS} (${((agg.oppStats.batting.SBpct||0)*100).toFixed(1)}%)`} />
                            <Stat label="GIDP" v={agg.oppStats.batting.GIDP} />
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {view === 'your-insights' && (
                    <div className={styles.grid}>
                      <div className={styles.section}>
                        <h3 className={styles.sectionHeader}>Approach & Contact</h3>
                        <div className={styles.insightsGrid}>
                          <div className={styles.insightCard}><div className={styles.insightTitle}>Go-Ahead events</div><div className={styles.insightValue}>{agg.yourInsights.goAheadEvents}</div></div>
                          <div className={styles.insightCard}><div className={styles.insightTitle}>Comeback wins</div><div className={styles.insightValue}>{agg.yourInsights.comebackWins}</div></div>
                          <div className={styles.insightCard}><div className={styles.insightTitle}>Perfect contact (You/Opp)</div><div className={styles.insightValue}><span className={styles.positive}>{agg.yourInsights.perfectContactYou}</span> / <span className={styles.negative}>{agg.yourInsights.perfectContactOpp}</span></div></div>
                        </div>
                        <div className={styles.insightsSection}>
                          <h4>Strikeouts by Pitch Type (You)</h4>
                          <div className={styles.kTypeGrid}>
                            {Object.entries(agg.yourInsights.KPitchYou).sort((a,b)=>b[1]-a[1]).slice(0,5).map(([k,v]) => (
                              <div key={k} className={styles.kTypeItem}><div className={styles.kTypeName}>{k}</div><div className={styles.kTypeValue}>{v}</div></div>
                            ))}
                          </div>
                        </div>
                      </div>
                      <div className={styles.section}>
                        <h3 className={styles.sectionHeader}>Ballpark Performance</h3>
                        <div className={styles.ballparkGrid}>
                          {Object.entries(agg.yourInsights.byBallpark).map(([k,v]) => (
                            <div key={k} className={styles.ballparkItem}>
                              <div className={styles.ballparkName}>{k}</div>
                              <div className={styles.ballparkStats}><span>{v.g} g</span><span>{v.w}-{v.l}</span><span>OPS: {v.OPS.toFixed(3)}</span></div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}

                  {view === 'hitters' && (
                    <div className={styles.section}>
                      <h3 className={styles.sectionHeader}>Your Hitters (aggregate)</h3>
                      <div className={styles.tableContainer}>
                        <table className={styles.table}>
                          <thead>
                            <tr>
                              <th>Player</th><th>G</th><th>AB</th><th>H</th><th>2B</th><th>3B</th><th>HR</th>
                              <th>BB</th><th>SO</th><th>SB</th><th>CS</th><th>SB%</th><th>E</th><th>PB</th>
                              <th>AVG</th><th>OBP</th><th>SLG</th><th>OPS</th><th>GIDP</th>
                            </tr>
                          </thead>
                          <tbody>
                            {Object.entries(agg.byPlayers.hitters).sort((a,b)=>b[1].AB-a[1].AB).map(([name,h]: any) => (
                              <tr key={name}>
                                <td>{name}</td><td>{h.g}</td><td>{h.AB}</td><td>{h.H}</td><td>{h._2B}</td><td>{h._3B}</td><td>{h.HR}</td>
                                <td>{h.BB}</td><td>{h.SO}</td><td>{h.SB}</td><td>{h.CS}</td><td>{(h.SBpct*100).toFixed(1)}%</td>
                                <td>{h.E}</td><td>{h.PB}</td>
                                <td>{h.AVG.toFixed(3)}</td><td>{h.OBP.toFixed(3)}</td><td>{h.SLG.toFixed(3)}</td><td>{h.OPS.toFixed(3)}</td><td>{h.GIDP}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {view === 'pitchers' && (
                    <div className={styles.section}>
                      <h3 className={styles.sectionHeader}>Your Pitchers (aggregate)</h3>
                      <div className={styles.tableContainer}>
                        <table className={styles.table}>
                          <thead>
                            <tr>
                              <th>Player</th><th>G</th><th>IP</th><th>H</th><th>R</th><th>ER</th><th>BB</th><th>SO</th><th>HR</th>
                              <th>ERA</th><th>WHIP</th><th>K/9</th><th>BB/9</th><th>HR/9</th>
                            </tr>
                          </thead>
                          <tbody>
                            {Object.entries(agg.byPlayers.pitchers).sort((a,b)=>b[1].IP-a[1].IP).map(([name,p]: any) => (
                              <tr key={name}>
                                <td>{name}</td><td>{p.g}</td><td>{p.IP.toFixed(1)}</td><td>{p.H}</td><td>{p.R}</td><td>{p.ER}</td><td>{p.BB}</td><td>{p.SO}</td><td>{p.HR}</td>
                                <td>{p.ERA.toFixed(2)}</td><td>{p.WHIP.toFixed(2)}</td><td>{p.K9.toFixed(2)}</td><td>{p.BB9.toFixed(2)}</td><td>{p.HR9.toFixed(2)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </>
              )}
            </>
          )}

          {loading && (
            <div className={styles.loadingOverlay}>
              <div className={styles.spinner}></div>
              <div>Loading game data...</div>
            </div>
          )}
        </>
      )}
    </div>
  )
}

function Stat({ label, v }: { label: string; v: any }) {
  return (
    <div className={styles.statsCard}>
      <div className={styles.statsTitle}>{label}</div>
      <div className={styles.statsValue}>{v}</div>
    </div>
  )
}
