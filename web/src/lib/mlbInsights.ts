// lib/mlbInsights.ts
import { ItemsIndex } from './itemsCache'
import {
  AggregateResponse, AggInsights, AggPlayers, AggYourStats, BoxSide, GameRow, InsightsResponse,
  ModeParam, Platform, RawGameHistory, SplitBundle, SplitPA, Subset
} from './mlbInsights.types'

const BASE = 'https://mlb25.theshow.com'

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))
function pLimit(n: number) {
  let a = 0; const q: Array<() => void> = []
  const next = () => { a--; q.shift()?.() }
  return async function <T>(fn: () => Promise<T>): Promise<T> {
    if (a >= n) await new Promise<void>(res => q.push(res))
    a++; try { return await fn() } finally { next() }
  }
}

function stripCodes(s: string) {
  return s
    .replace(/\^c\d+\^/g, '')
    .replace(/\^b\d+\^/g, '')
    .replace(/\^n\^/g, '\n')
    .replace(/\^e\^/g, '')
    .replace(/\^\w+\^/g, '')
    .trim()
}
function normalizeName(s: string) { return stripCodes(String(s || '')).replace(/\^[^\^]*\^/g, '').trim().toLowerCase() }
function parseIntSafe(s: unknown) { const n = Number(String(s ?? '').replace(/[^\d.-]/g, '')); return Number.isFinite(n) ? n : 0 }
function toISO(displayDate: string | null) {
  if (!displayDate) return null
  const m = displayDate.match(/^(\d{2})\/(\d{2})\/(\d{4})\s+(\d{2}):(\d{2}):(\d{2})/)
  if (!m) return null
  const [_, MM, DD, YYYY, hh, mm, ss] = m
  const d = new Date(`${YYYY}-${MM}-${DD}T${hh}:${mm}:${ss}Z`)
  return isNaN(d.getTime()) ? null : d.toISOString()
}
function ipToNum(ip: number | string) {
  const s = String(ip)
  if (!s.includes('.')) return Number(s)
  const [a, b] = s.split('.')
  const base = Number(a) || 0
  const frac = b === '1' ? 1/3 : b === '2' ? 2/3 : 0
  return base + frac
}
const CLEAN_PREFIX_RE = /^(?:[ab]-|\d-)\s*/i
const cleanBatterName = (raw: string) => String(raw || '').replace(CLEAN_PREFIX_RE, '').trim().split(',')[0].trim().replace(/\s+/g, ' ')
const cleanPitcherName = (raw: string) => String(raw || '').replace(/\s*\((W|L|S).*?\)\s*$/i, '').trim()
const last = (s: string) => s.trim().split(/\s+/).slice(-1)[0].toLowerCase()

export async function fetchGameHistoryAllPages(username: string, platform: Platform, mode: ModeParam) {
  const firstURL = new URL(`${BASE}/apis/game_history.json`)
  firstURL.searchParams.set('page', '1')
  firstURL.searchParams.set('username', username)
  firstURL.searchParams.set('platform', platform)
  firstURL.searchParams.set('mode', mode)

  const firstRes = await fetch(firstURL.toString(), { headers: { accept: 'application/json' }, cache: 'no-store' })
  if (!firstRes.ok) throw new Error(`game_history 1 ${firstRes.status}`)
  const first: RawGameHistory = await firstRes.json()
  const total = Number(first.total_pages || 1)
  const rest = Array.from({ length: Math.max(0, total - 1) }, (_, i) => i + 2)

  if (!rest.length) return first.game_history || []

  const run = pLimit(14)
  const more = await Promise.all(rest.map(p =>
    run(async () => {
      const u = new URL(`${BASE}/apis/game_history.json`)
      u.searchParams.set('page', String(p))
      u.searchParams.set('username', username)
      u.searchParams.set('platform', platform)
      u.searchParams.set('mode', mode)
      for (let a = 0; a < 2; a++) {
        const r = await fetch(u.toString(), { headers: { accept: 'application/json' }, cache: 'no-store' })
        if (r.ok) { const j: RawGameHistory = await r.json(); return j.game_history || [] }
        await sleep(120 + a * 200)
      }
      throw new Error(`game_history ${p} failed`)
    })
  ))

  return [...(first.game_history || []), ...more.flat()]
}

function toRow(item: RawGameHistory['game_history'][number], username: string): GameRow {
  const home = { name: item.home_full_name, runs: parseIntSafe(item.home_runs), hits: parseIntSafe(item.home_hits), errors: parseIntSafe(item.home_errors), result: item.home_display_result }
  const away = { name: item.away_full_name, runs: parseIntSafe(item.away_runs), hits: parseIntSafe(item.away_hits), errors: parseIntSafe(item.away_errors), result: item.away_display_result }

  const homeName = normalizeName(item.home_name)
  const awayName = normalizeName(item.away_name)
  const homeIsCPU = homeName === 'cpu'
  const awayIsCPU = awayName === 'cpu'

  const isCPU = homeIsCPU && awayIsCPU
  const isOnline = !isCPU

  let youAre: 'home' | 'away' | null = null
  if (homeIsCPU && !awayIsCPU) youAre = 'home'
  else if (awayIsCPU && !homeIsCPU) youAre = 'away'
  else {
    const userInHome = normalizeName(item.home_name).includes(normalizeName(username))
    const userInAway = normalizeName(item.away_name).includes(normalizeName(username))
    youAre = userInHome ? 'home' : userInAway ? 'away' : null
  }

  const youRuns = youAre ? (youAre === 'home' ? home.runs : away.runs) : null
  const oppRuns = youAre ? (youAre === 'home' ? away.runs : home.runs) : null

  return {
    id: item.id,
    dateISO: toISO(item.display_date),
    mode: item.game_mode,
    home, away, youAre,
    isCPU, isOnline,
    youRuns, oppRuns,
    pitcherInfo: item.display_pitcher_info,
    displayDate: item.display_date
  }
}

export function summarize(rows: GameRow[]) {
  let wins = 0, losses = 0, runDiff = 0, online = 0, cpu = 0, arena = 0, exhibition = 0
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

export function groupIds(rows: GameRow[]) {
  const all = rows.map(r => r.id)
  const online = rows.filter(r => r.isOnline).map(r => r.id)
  const vsCPU = rows.filter(r => r.isCPU).map(r => r.id)
  const arena = rows.filter(r => String(r.mode).toUpperCase() === 'ARENA').map(r => r.id)
  const exhibition = rows.filter(r => String(r.mode).toUpperCase() === 'EXHIBITION').map(r => r.id)
  return { all, online, vsCPU, arena, exhibition }
}

const DIFF_RE = /Hitting Difficulty is ([A-Za-z\s-]+)\.\s*Pitching Difficulty is ([A-Za-z\s-]+)\./i
function pickBallpark(text: string) {
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean)
  const direct = lines.find(l => /\b(Field|Park|Stadium|Arena)\b/i.test(l))
  if (direct) return direct.replace(/\s*\(.*?\)\s*$/, '')
  const wIdx = lines.findIndex(l => /^Weather:/i.test(l))
  if (wIdx > 0) return lines[wIdx - 1].replace(/\s*\(.*?\)\s*$/, '')
  return 'Unknown'
}

type PA = {
  offense: 'you'|'opp'
  inning: number
  outsBefore: 0|1|2
  batter: string
  pitcher: string
  result: '1B'|'2B'|'3B'|'HR'|'BB'|'SO'|'HBP'|'SF'|'SH'|'OUT'|'DP'|'ROE'
}

function parseHalfToPAs(seg: string): { pas: PA[]; Ks: {pitch: Record<string,number>; loc: Record<string,number>; swing: number; look: number; chase: number}; hrByPitcherLN: Record<string,number> } {
  const lines = seg.split(/\.\s+/)
  const pas: PA[] = []
  let outs: 0|1|2 = 0
  let curPitcher = ''
  const Ks = { pitch: {} as Record<string,number>, loc: {} as Record<string,number>, swing: 0, look: 0, chase: 0 }
  const hrByPitcherLN: Record<string,number> = {}

  for (const ln of lines) {
    const pm = ln.match(/([A-Za-z.'\-\s]+?) pitching\.$/i)
    if (pm) { curPitcher = cleanPitcherName(pm[1]); continue }

    const batter = cleanBatterName((ln.split(':')[0] || '').split(' was ')[0].split(' grounded ')[0].split(' struck ')[0].split(' flied ')[0].split(' popped ')[0].split(' lined ')[0].split(' walked')[0])
    if (!batter || !curPitcher) {
      if (/struck out|called out on strikes/i.test(ln)) {
        const pitch = (ln.match(/\b(fastball|sinker|slider|splitter|curveball|curve|cutter|changeup|knuckle|sweeper|slurve)\b/i)?.[0]?.toLowerCase() || 'unknown')
        const loc = (ln.match(/\b(high and away|low and away|high and in|low and in|high and inside|low and inside|high and outside|low and outside|high|low|inside|outside)\b/i)?.[0]?.toLowerCase() || 'unknown')
        Ks.pitch[pitch] = (Ks.pitch[pitch]||0)+1
        Ks.loc[loc] = (Ks.loc[loc]||0)+1
        if (/called out on strikes/i.test(ln)) Ks.look++
        else Ks.swing++
        if (/chasing/i.test(ln)) Ks.chase++
      }
      continue
    }

    let result: PA['result'] | null = null
    if (/homered\b/i.test(ln)) { result = 'HR'; const lnPitch = last(curPitcher); hrByPitcherLN[lnPitch] = (hrByPitcherLN[lnPitch]||0)+1 }
    else if (/tripled\b/i.test(ln)) result = '3B'
    else if (/doubled\b/i.test(ln)) result = '2B'
    else if (/grounded into a double play/i.test(ln)) { result = 'DP' }
    else if (/walked\b/i.test(ln)) result = 'BB'
    else if (/hit by pitch/i.test(ln)) result = 'HBP'
    else if (/sacrifice fly|sf\)/i.test(ln)) result = 'SF'
    else if (/sacrifice bunt|sh\)/i.test(ln)) result = 'SH'
    else if (/singled\b|grounded to .* for a single/i.test(ln)) result = '1B'
    else if (/lined to|lined out|flied out|popped out|grounded out|batted out|reached on error/i.test(ln)) { result = 'OUT' }

    if (result) pas.push({ offense: 'you', inning: 0, outsBefore: outs, batter, pitcher: curPitcher, result })
    if (/flied out|popped out|struck out|called out on strikes|grounded out|batted out/i.test(ln)) {
      outs = (Math.min(2, outs + 1) as 0|1|2)
    }
    if (/double play/i.test(ln)) outs = 2

    if (/struck out|called out on strikes/i.test(ln)) {
      const pitch = (ln.match(/\b(fastball|sinker|slider|splitter|curveball|curve|cutter|changeup|knuckle|sweeper|slurve)\b/i)?.[0]?.toLowerCase() || 'unknown')
      const loc = (ln.match(/\b(high and away|low and away|high and in|low and in|high and inside|low and inside|high and outside|low and outside|high|low|inside|outside)\b/i)?.[0]?.toLowerCase() || 'unknown')
      Ks.pitch[pitch] = (Ks.pitch[pitch]||0)+1
      Ks.loc[loc] = (Ks.loc[loc]||0)+1
      if (/called out on strikes/i.test(ln)) Ks.look++
      else Ks.swing++
      if (/chasing/i.test(ln)) Ks.chase++
    }
  }
  return { pas, Ks, hrByPitcherLN }
}

export async function fetchGameLog(username: string, id: string, youAre: 'home'|'away'|null, homeTeam: string, awayTeam: string) {
  const r = await fetchGameLogRich(username, id, youAre, homeTeam, awayTeam)
  return r.parsed
}

export async function fetchGameLogRich(username: string, id: string, youAre: 'home'|'away'|null, homeTeam: string, awayTeam: string) {
  const u = new URL(`${BASE}/apis/game_log.json`)
  u.searchParams.set('username', username)
  u.searchParams.set('id', id)
  const res = await fetch(u.toString(), { headers: { accept: 'application/json' }, cache: 'no-store' })
  if (!res.ok) throw new Error(`game_log ${res.status}`)
  const j = await res.json()

  const lineScore = j?.game?.find?.((g: any) => g[0] === 'line_score')?.[1]
  const rawLog = j?.game?.find?.((g: any) => g[0] === 'game_log')?.[1] || ''
  const box = j?.game?.find?.((g: any) => g[0] === 'box_score')?.[1]

  const youTeam = youAre === 'home' ? homeTeam : youAre === 'away' ? awayTeam : homeTeam
  const oppTeam = youAre === 'home' ? awayTeam : youAre === 'away' ? homeTeam : awayTeam

  const text = stripCodes(rawLog)
  const ballpark = pickBallpark(text)
  const diffMatch = text.match(DIFF_RE)
  const hittingDifficulty = diffMatch?.[1] || null
  const pitchingDifficulty = diffMatch?.[2] || null

  const re = /(^|\n)([^\n.]+?) batting\.\s*([^]*?)(?=\n[^.\n]+ batting\.|\nInning |\nGame Log Legend|\Z)/gi
  const youSegments: string[] = []
  const oppSegments: string[] = []
  let m: RegExpExecArray | null
  while ((m = re.exec(text))) {
    const team = m[2].trim()
    const seg = m[3].trim()
    if (normalizeName(team) === normalizeName(youTeam)) youSegments.push(seg)
    else if (normalizeName(team) === normalizeName(oppTeam)) oppSegments.push(seg)
  }

  const youHalf = youSegments.map(s => parseHalfToPAs(s))
  const oppHalf = oppSegments.map(s => parseHalfToPAs(s))

  const youPAs: PA[] = []
  const oppPAs: PA[] = []
  let inningCounter = 1
  for (const h of youHalf) {
    for (const pa of h.pas) youPAs.push({ ...pa, offense: 'you', inning: inningCounter as any })
    inningCounter++
  }
  inningCounter = 1
  for (const h of oppHalf) {
    for (const pa of h.pas) oppPAs.push({ ...pa, offense: 'opp', inning: inningCounter as any })
    inningCounter++
  }

  let perfectYou = 0, perfectOpp = 0
  {
    const lines = text.split('\n')
    const idx = lines.findIndex(l => /Perfect Contact Hits/i.test(l))
    if (idx >= 0) {
      const section = lines.slice(idx + 1)
      const stop = section.findIndex(l => /^\s*$/.test(l) || /^(Weather:|Hitting Difficulty|Pitching Difficulty|20\d{2})/i.test(l))
      const seg = stop >= 0 ? section.slice(0, stop) : section
      const homeBox = box?.[0], awayBox = box?.[1]
      const homeId = Object.keys(homeBox || {}).find(k => /^\d+$/.test(k))
      const awayId = Object.keys(awayBox || {}).find(k => /^\d+$/.test(k))
      const ySide = youAre === 'home' ? homeBox?.[homeId!] : awayBox?.[awayId!]
      const oSide = youAre === 'home' ? awayBox?.[awayId!] : homeBox?.[homeId!]
      const yPlayers = new Set<string>((ySide?.batting_stats || []).map((p: any) => cleanBatterName(p.player_name)))
      const oPlayers = new Set<string>((oSide?.batting_stats || []).map((p: any) => cleanBatterName(p.player_name)))
      for (const l of seg) {
        const name = cleanBatterName((l.split(':')[0] || '').trim())
        if (!name) continue
        if (yPlayers.has(name)) perfectYou++
        else if (oPlayers.has(name)) perfectOpp++
      }
    }
  }

  const mkSide = (obj: any): BoxSide => {
    const bstats = (obj?.batting_stats || []).map((p: any) => ({
      player_name: cleanBatterName(p.player_name),
      ab: parseIntSafe(p.ab), r: parseIntSafe(p.r), h: parseIntSafe(p.h), rbi: parseIntSafe(p.rbi),
      bb: parseIntSafe(p.bb), so: parseIntSafe(p.so), doubles: parseIntSafe(p.doubles), triples: parseIntSafe(p.triples), hr: parseIntSafe(p.hr),
      hbp: parseIntSafe(p.hbp), sf: parseIntSafe(p.sf), sh: parseIntSafe(p.sh), gidp: parseIntSafe(p.gidp),
      sb: parseIntSafe(p.sb), cs: parseIntSafe(p.cs), e: parseIntSafe(p.e), pb: parseIntSafe(p.pb),
    }))
    const bt = {
      ab: bstats.reduce((s,r)=>s+r.ab,0), r: bstats.reduce((s,r)=>s+r.r,0), h: bstats.reduce((s,r)=>s+r.h,0),
      rbi: bstats.reduce((s,r)=>s+r.rbi,0), bb: bstats.reduce((s,r)=>s+r.bb,0), so: bstats.reduce((s,r)=>s+r.so,0),
      hbp: bstats.reduce((s,r)=>s+r.hbp,0), sf: bstats.reduce((s,r)=>s+r.sf,0), sh: bstats.reduce((s,r)=>s+r.sh,0),
      sb: bstats.reduce((s,r)=>s+r.sb,0), cs: bstats.reduce((s,r)=>s+r.cs,0), e: bstats.reduce((s,r)=>s+r.e,0), pb: bstats.reduce((s,r)=>s+r.pb,0)
    }
    const pstats = (obj?.pitching_stats || []).map((p: any) => ({
      player_name: cleanPitcherName(p.player_name),
      ip: ipToNum(p.ip), h: parseIntSafe(p.h), r: parseIntSafe(p.r), er: parseIntSafe(p.er),
      bb: parseIntSafe(p.bb), so: parseIntSafe(p.so), hr: parseIntSafe(p.hr ?? 0)
    }))
    const ptRaw = obj?.pitching_totals || {}
    const pt = { ip: ipToNum(ptRaw.ip), h: parseIntSafe(ptRaw.h), r: parseIntSafe(ptRaw.r), er: parseIntSafe(ptRaw.er), bb: parseIntSafe(ptRaw.bb), so: parseIntSafe(ptRaw.so) }
    return { battingTotals: bt, battingStats: bstats, pitchingTotals: pt, pitchingStats: pstats }
  }

  const teamA = box?.[0]; const idA = Object.keys(teamA || {}).find(k => /^\d+$/.test(k))
  const teamB = box?.[1]; const idB = Object.keys(teamB || {}).find(k => /^\d+$/.test(k))
  const homeSide = mkSide(idA ? teamA?.[idA] : null)
  const awaySide = mkSide(idB ? teamB?.[idB] : null)
  const youSide = youAre === 'home' ? homeSide : awaySide
  const oppSide = youAre === 'home' ? awaySide : homeSide

  const runsByInningHome = String(teamA?.r || '').split(',').map(v => v === 'X' ? 0 : parseIntSafe(v))
  const runsByInningAway = String(teamB?.r || '').split(',').map(v => v === 'X' ? 0 : parseIntSafe(v))
  const runsByInningYou = youAre === 'home' ? runsByInningHome : runsByInningAway
  const runsByInningOpp = youAre === 'home' ? runsByInningAway : runsByInningHome

  const youKs = youHalf.reduce((acc, h) => {
    for (const [k,v] of Object.entries(h.Ks.pitch)) acc.pitch[k]=(acc.pitch[k]||0)+v
    for (const [k,v] of Object.entries(h.Ks.loc)) acc.loc[k]=(acc.loc[k]||0)+v
    acc.swing+=h.Ks.swing; acc.look+=h.Ks.look; acc.chase+=h.Ks.chase
    return acc
  }, { pitch:{}, loc:{}, swing:0, look:0, chase:0 } as any)
  const oppKs = oppHalf.reduce((acc, h) => {
    for (const [k,v] of Object.entries(h.Ks.pitch)) acc.pitch[k]=(acc.pitch[k]||0)+v
    for (const [k,v] of Object.entries(h.Ks.loc)) acc.loc[k]=(acc.loc[k]||0)+v
    acc.swing+=h.Ks.swing; acc.look+=h.Ks.look; acc.chase+=h.Ks.chase
    return acc
  }, { pitch:{}, loc:{}, swing:0, look:0, chase:0 } as any)

  const hrAllowedByYourPitcherLN = oppHalf.reduce((m, h) => {
    for (const [ln,v] of Object.entries(h.hrByPitcherLN)) m[ln] = (m[ln]||0)+v
    return m
  }, {} as Record<string,number>)
  const hrAllowedByOppPitcherLN = youHalf.reduce((m, h) => {
    for (const [ln,v] of Object.entries(h.hrByPitcherLN)) m[ln] = (m[ln]||0)+v
    return m
  }, {} as Record<string,number>)

  const parsed = {
    id, youTeam, oppTeam, ballpark, hittingDifficulty, pitchingDifficulty,
    runsByInningYou, runsByInningOpp,
    goAheadEvents: (text.match(/\* Go-Ahead Play/g) || []).length,
    perfectContactHitsYou: perfectYou, perfectContactHitsOpp: perfectOpp,
    swingingKYou: youKs.swing, lookingKYou: youKs.look, chaseKYou: youKs.chase,
    swingingKOpp: oppKs.swing, lookingKOpp: oppKs.look, chaseKOpp: oppKs.chase,
    batting: { strikeoutsByPitch: youKs.pitch, strikeoutsByLoc: youKs.loc, homers: (youSide.battingStats||[]).reduce((s,r)=>s+r.hr,0), doublePlays: (youSide.battingStats||[]).reduce((s,r)=>s+r.gidp,0) },
    pitching: { strikeoutsByPitch: oppKs.pitch, strikeoutsByLoc: oppKs.loc, homersAllowed: (oppSide.battingStats||[]).reduce((s,r)=>s+r.hr,0) },
    hrAllowedByYourPitcherLN, hrAllowedByOppPitcherLN,
    PAs: { you: youPAs, opp: oppPAs }
  }

  return { meta: { id, ballpark, hittingDifficulty, pitchingDifficulty }, you: youSide, opp: oppSide, parsed }
}

export async function buildInsights(username: string, platform: Platform, mode: ModeParam): Promise<InsightsResponse> {
  const raw = await fetchGameHistoryAllPages(username, platform, mode)
  const rows = raw.map(g => toRow(g, username)).sort((a, b) => (b.dateISO || '').localeCompare(a.dateISO || ''))
  const summary = summarize(rows)
  const groups = groupIds(rows)

  if (process.env.NODE_ENV !== 'production') {
    const sample = rows.slice(0, 5).map(r => ({
      id: r.id, mode: r.mode, home: r.home.name, away: r.away.name,
      youAre: r.youAre, isOnline: r.isOnline, isCPU: r.isCPU
    }))
    console.log('[insights.build] counts', {
      total: rows.length,
      online: groups.online.length,
      vsCPU: groups.vsCPU.length,
      arena: groups.arena.length,
      exhibition: groups.exhibition.length,
    })
    console.log('[insights.build] sample', sample)
  }

  return { user: { username, platform, mode }, summary, groups, gameLog: rows, next: { hasMore: false, page: 1, totalPages: 1 } }
}

function pickSubsetIds(resp: InsightsResponse, subset: Subset): string[] {
  return resp.groups[subset]
}

type Filters = {
  pThrow: 'all'|'L'|'R'
  bBat: 'all'|'L'|'R'|'S'
  inning: 'all'|string
  outs: 'all'|string
  difficulty: 'all'|'Rookie'|'Veteran'|'All-Star'|'Hall Of Fame'|'Legend'|'Goat'
  pitcherProfile: 'all'|'outlier'|'lowvelo'
  hitterHeight: 'all'|'tall'|'small'
  situation?: 'all'|'winning'|'tied'|'behind'
  risp?: 'all'|'risp'|'norisp'
}

export async function aggregateInsights(
  base: InsightsResponse,
  username: string,
  subset: Subset,
  limit = 200,
  concurrency = 12,
  opts?: { filters?: Filters; items?: ItemsIndex; includePAs?: boolean }
): Promise<AggregateResponse> {
  const ids = pickSubsetIds(base, subset).slice(0, limit)
  const idToRow = new Map(base.gameLog.map(r => [r.id, r]))
  const run = pLimit(concurrency)

  if (process.env.NODE_ENV !== 'production') {
    console.log('[insights.aggregate] subset', subset, 'ids', ids.length)
  }

  const rich = await Promise.all(ids.map(id => run(async () => {
    const r = idToRow.get(id)!; return await fetchGameLogRich(username, id, r.youAre, r.home.name, r.away.name)
  })))

  const yourStats: AggYourStats = {
    games: rich.length,
    batting: { AB: 0, R: 0, H: 0, _1B: 0, _2B: 0, _3B: 0, HR: 0, RBI: 0, BB: 0, SO: 0, HBP: 0, SF: 0, SH: 0, SB: 0, CS: 0, TB: 0, AVG: 0, OBP: 0, SLG: 0, OPS: 0, ISO: 0, BABIP: 0, GIDP: 0 },
    pitching: { IP: 0, H: 0, R: 0, ER: 0, BB: 0, SO: 0, HR: 0, WHIP: 0, ERA: 0, K9: 0, BB9: 0, HR9: 0, FIP_raw: 0, OppAB: 0, OppOBP: 0, OppSLG: 0, OppOPS: 0 }
  }
  const oppStats: AggYourStats = structuredClone(yourStats)

  const yourInsights: AggInsights = {
    games: rich.length, goAheadEvents: 0, comebackWins: 0, perfectContactYou: 0, perfectContactOpp: 0,
    runsByInningYou: [], runsByInningOpp: [],
    KPitchYou: {}, KLocYou: {}, KPitchOpp: {}, KLocOpp: {},
    swingingKYou: 0, lookingKYou: 0, chaseKYou: 0, swingingKOpp: 0, lookingKOpp: 0, chaseKOpp: 0,
    byBallpark: {}
  }

  const byPlayers: AggPlayers = { hitters: {}, pitchers: {} }
  const vsPitcher: AggregateResponse['vsPitcher'] = {}

  for (const g of rich) {
    const you = g.you, opp = g.opp, p = g.parsed

    yourInsights.goAheadEvents += p.goAheadEvents
    yourInsights.perfectContactYou += p.perfectContactHitsYou
    yourInsights.perfectContactOpp += p.perfectContactHitsOpp
    p.runsByInningYou.forEach((v, i) => yourInsights.runsByInningYou[i] = (yourInsights.runsByInningYou[i] || 0) + v)
    p.runsByInningOpp.forEach((v, i) => yourInsights.runsByInningOpp[i] = (yourInsights.runsByInningOpp[i] || 0) + v)
    for (const [k, v] of Object.entries(p.batting.strikeoutsByPitch)) yourInsights.KPitchYou[k]=(yourInsights.KPitchYou[k]||0)+v
    for (const [k, v] of Object.entries(p.batting.strikeoutsByLoc)) yourInsights.KLocYou[k]=(yourInsights.KLocYou[k]||0)+v
    for (const [k, v] of Object.entries(p.pitching.strikeoutsByPitch)) yourInsights.KPitchOpp[k]=(yourInsights.KPitchOpp[k]||0)+v
    for (const [k, v] of Object.entries(p.pitching.strikeoutsByLoc)) yourInsights.KLocOpp[k]=(yourInsights.KLocOpp[k]||0)+v
    yourInsights.swingingKYou += p.swingingKYou; yourInsights.lookingKYou += p.lookingKYou; yourInsights.chaseKYou += p.chaseKYou
    yourInsights.swingingKOpp += p.swingingKOpp; yourInsights.lookingKOpp += p.lookingKOpp; yourInsights.chaseKOpp += p.chaseKOpp

    const ySum7 = p.runsByInningYou.slice(0,7).reduce((a,b)=>a+b,0)
    const oSum7 = p.runsByInningOpp.slice(0,7).reduce((a,b)=>a+b,0)
    const yFinal = p.runsByInningYou.reduce((a,b)=>a+b,0)
    const oFinal = p.runsByInningOpp.reduce((a,b)=>a+b,0)
    if (ySum7 <= oSum7 && yFinal > oFinal) yourInsights.comebackWins++

    const bpKey = p.ballpark || 'Unknown'
    const rec = (yourInsights.byBallpark[bpKey] ||= { g:0, w:0, l:0, runsFor:0, runsAgainst:0, hrFor:0, hrAgainst:0, OPS:0 } as any)
    rec.g++
    if (you.battingTotals.r > opp.battingTotals.r) rec.w++; else if (you.battingTotals.r < opp.battingTotals.r) rec.l++
    rec.runsFor += you.battingTotals.r
    rec.runsAgainst += opp.battingTotals.r
    const y2B = you.battingStats.reduce((s,r)=>s+r.doubles,0)
    const y3B = you.battingStats.reduce((s,r)=>s+r.triples,0)
    const yHR = you.battingStats.reduce((s,r)=>s+r.hr,0)
    const y1B = Math.max(0, you.battingTotals.h - y2B - y3B - yHR)
    rec.hrFor += yHR
    rec.hrAgainst += opp.battingStats.reduce((s,r)=>s+r.hr,0)
    rec._ab = (rec._ab||0) + you.battingTotals.ab
    rec._bb = (rec._bb||0) + you.battingTotals.bb
    rec._hbp = (rec._hbp||0) + you.battingTotals.hbp
    rec._sf = (rec._sf||0) + you.battingTotals.sf
    rec._tb = (rec._tb||0) + (y1B + 2*y2B + 3*y3B + 4*yHR)
    rec._h = (rec._h||0) + you.battingTotals.h

    // team totals (you)
    yourStats.batting.AB += you.battingTotals.ab
    yourStats.batting.R  += you.battingTotals.r
    yourStats.batting.H  += you.battingTotals.h
    yourStats.batting.RBI+= you.battingTotals.rbi
    yourStats.batting.BB += you.battingTotals.bb
    yourStats.batting.SO += you.battingTotals.so
    yourStats.batting.HBP+= you.battingTotals.hbp
    yourStats.batting.SF += you.battingTotals.sf
    yourStats.batting.SH += you.battingTotals.sh
    yourStats.batting.SB += you.battingTotals.sb
    yourStats.batting.CS += you.battingTotals.cs
    const yD2 = you.battingStats.reduce((s,r)=>s+r.doubles,0)
    const yD3 = you.battingStats.reduce((s,r)=>s+r.triples,0)
    yourStats.batting._2B += yD2; yourStats.batting._3B += yD3
    yourStats.batting.HR  += yHR
    yourStats.batting.GIDP+= you.battingStats.reduce((s,r)=>s+r.gidp,0)
    yourStats.batting._1B += Math.max(0, you.battingTotals.h - yD2 - yD3 - yHR)

    // team totals (opp vs you)
    oppStats.batting.AB += opp.battingTotals.ab
    oppStats.batting.R  += opp.battingTotals.r
    oppStats.batting.H  += opp.battingTotals.h
    oppStats.batting.RBI+= opp.battingTotals.rbi
    oppStats.batting.BB += opp.battingTotals.bb
    oppStats.batting.SO += opp.battingTotals.so
    oppStats.batting.HBP+= opp.battingTotals.hbp
    oppStats.batting.SF += opp.battingTotals.sf
    oppStats.batting.SH += opp.battingTotals.sh
    oppStats.batting.SB += opp.battingTotals.sb
    oppStats.batting.CS += opp.battingTotals.cs
    const oD2 = opp.battingStats.reduce((s,r)=>s+r.doubles,0)
    const oD3 = opp.battingStats.reduce((s,r)=>s+r.triples,0)
    const oHR = opp.battingStats.reduce((s,r)=>s+r.hr,0)
    oppStats.batting._2B += oD2; oppStats.batting._3B += oD3; oppStats.batting.HR += oHR
    oppStats.batting._1B += Math.max(0, opp.battingTotals.h - oD2 - oD3 - oHR)

    // pitching team totals
    yourStats.pitching.IP += you.pitchingTotals.ip
    yourStats.pitching.H  += you.pitchingTotals.h
    yourStats.pitching.R  += you.pitchingTotals.r
    yourStats.pitching.ER += you.pitchingTotals.er
    yourStats.pitching.BB += you.pitchingTotals.bb
    yourStats.pitching.SO += you.pitchingTotals.so
    yourStats.pitching.HR += oHR
    yourStats.pitching.OppAB += opp.battingTotals.ab

    oppStats.pitching.IP += opp.pitchingTotals.ip
    oppStats.pitching.H  += opp.pitchingTotals.h
    oppStats.pitching.R  += opp.pitchingTotals.r
    oppStats.pitching.ER += opp.pitchingTotals.er
    oppStats.pitching.BB += opp.pitchingTotals.bb
    oppStats.pitching.SO += opp.pitchingTotals.so
    oppStats.pitching.HR += yHR
    oppStats.pitching.OppAB += you.battingTotals.ab

    // per hitter
    for (const r of you.battingStats) {
      const name = cleanBatterName(r.player_name)
      const ph = byPlayers.hitters[name] ||= { g:0, AB:0, H:0, _2B:0, _3B:0, HR:0, BB:0, SO:0, HBP:0, SF:0, SH:0, TB:0, AVG:0, OBP:0, SLG:0, OPS:0, GIDP:0, SB:0, CS:0, E:0, PB:0, SBpct:0 }
      ph.g++; ph.AB+=r.ab; ph.H+=r.h; ph._2B+=r.doubles; ph._3B+=r.triples; ph.HR+=r.hr; ph.BB+=r.bb; ph.SO+=r.so; ph.HBP+=r.hbp; ph.SF+=r.sf; ph.SH+=r.sh; ph.GIDP+=r.gidp; ph.SB+=r.sb; ph.CS+=r.cs; ph.E+=r.e; ph.PB+=r.pb
    }
    // per pitcher (YOU) — track HR incl. LN attribution
    for (const r of you.pitchingStats) {
      const name = cleanPitcherName(r.player_name)
      const ln = last(name)
      const pp = byPlayers.pitchers[name] ||= { g:0, IP:0, H:0, R:0, ER:0, BB:0, SO:0, HR:0, ERA:0, WHIP:0, K9:0, BB9:0, HR9:0 }
      pp.g++; pp.IP+=r.ip; pp.H+=r.h; pp.R+=r.r; pp.ER+=r.er; pp.BB+=r.bb; pp.SO+=r.so
      pp.HR += (r.hr ?? 0) + (p.hrAllowedByYourPitcherLN[ln] || 0)
    }
    // vsPitcher (how you hit vs THEIR pitchers)
    for (const r of opp.pitchingStats) {
      const name = cleanPitcherName(r.player_name)
      const ln = last(name)
      const vp = vsPitcher[name] ||= { g:0, ip:0, h:0, r:0, er:0, bb:0, so:0, hr:0, era:0, whip:0, k9:0, bb9:0, hr9:0 }
      vp.g++; vp.ip+=r.ip; vp.h+=r.h; vp.r+=r.r; vp.er+=r.er; vp.bb+=r.bb; vp.so+=r.so
      vp.hr += (r.hr ?? 0) + (p.hrAllowedByOppPitcherLN[ln] || 0)
    }
  }

  const adv = (obj: any) => {
    const H = obj.H, AB = obj.AB, BB = obj.BB, HBP = obj.HBP, SF = obj.SF
    const TB = obj._1B + 2*obj._2B + 3*obj._3B + 4*obj.HR
    obj.TB = TB
    const PA = AB + BB + HBP + SF
    obj.AVG = AB ? H/AB : 0
    obj.OBP = PA ? (H+BB+HBP)/PA : 0
    obj.SLG = AB ? TB/AB : 0
    obj.OPS = obj.OBP + obj.SLG
    obj.ISO = obj.SLG - obj.AVG
    obj.BABIP = (AB - obj.SO - obj.HR + SF) ? (H - obj.HR) / (AB - obj.SO - obj.HR + SF) : 0
    obj.PA = PA
    obj.SBpct = (obj.SB + obj.CS) ? obj.SB / (obj.SB + obj.CS) : 0
    obj.Kpct = PA ? obj.SO / PA : 0
    obj.BBpct = PA ? obj.BB / PA : 0
    obj.XBHpct = PA ? (obj._2B + obj._3B + obj.HR)/PA : 0
  }
  adv(yourStats.batting); adv(oppStats.batting)

  const doPitch = (obj:any) => {
    const IP = obj.IP
    obj.WHIP = IP ? (obj.BB + obj.H) / IP : 0
    obj.ERA  = IP ? (obj.ER * 9) / IP : 0
    obj.K9   = IP ? (obj.SO * 9) / IP : 0
    obj.BB9  = IP ? (obj.BB * 9) / IP : 0
    obj.HR9  = IP ? (obj.HR * 9) / IP : 0
    obj.FIP_raw = IP ? ((13*obj.HR + 3*obj.BB - 2*obj.SO) / IP) : 0
  }
  doPitch(yourStats.pitching); doPitch(oppStats.pitching)

  {
    const oppAB = yourStats.pitching.OppAB
    const oppH  = oppStats.batting.H
    const oppBB = oppStats.batting.BB
    const oppHBP = oppStats.batting.HBP
    const oppSF = oppStats.batting.SF
    const oppTB = oppStats.batting.TB
    yourStats.pitching.OppOBP = (oppAB + oppBB + oppHBP + oppSF) ? (oppH + oppBB + oppHBP)/(oppAB + oppBB + oppHBP + oppSF) : 0
    yourStats.pitching.OppSLG = oppAB ? oppTB/oppAB : 0
    yourStats.pitching.OppOPS = yourStats.pitching.OppOBP + yourStats.pitching.OppSLG
  }

  for (const h of Object.values(byPlayers.hitters)) {
    h.TB = h.H - h._2B - h._3B - h.HR + 2*h._2B + 3*h._3B + 4*h.HR
    h.AVG = h.AB ? h.H / h.AB : 0
    const PAh = h.AB + h.BB + h.HBP + h.SF
    const obp = PAh ? (h.H + h.BB + h.HBP) / PAh : 0
    const slg = h.AB ? h.TB / h.AB : 0
    h.OBP = obp; h.SLG = slg; h.OPS = obp + slg
    h.SBpct = (h.SB + h.CS) ? h.SB / (h.SB + h.CS) : 0
  }
  for (const p of Object.values(byPlayers.pitchers)) {
    p.WHIP = p.IP ? (p.BB + p.H) / p.IP : 0
    p.ERA  = p.IP ? (p.ER * 9) / p.IP : 0
    p.K9   = p.IP ? (p.SO * 9) / p.IP : 0
    p.BB9  = p.IP ? (p.BB * 9) / p.IP : 0
    p.HR9  = p.IP ? (p.HR * 9) / p.IP : 0
  }

  for (const rec of Object.values(yourInsights.byBallpark) as any[]) {
    const obp = (rec._ab + rec._bb + rec._hbp + rec._sf) ? (rec._h + rec._bb + rec._hbp) / (rec._ab + rec._bb + rec._hbp + rec._sf) : 0
    const slg = rec._ab ? rec._tb / rec._ab : 0
    rec.OPS = obp + slg
    delete rec._ab; delete rec._bb; delete rec._hbp; delete rec._sf; delete rec._tb; delete rec._h
  }

  // === Optional: include compact split bundle so the client can filter locally ===
  let splitBundle: SplitBundle | undefined
  if (opts?.includePAs) {
    const annotate = (pa: { inning: number; outsBefore: 0|1|2; batter: string; pitcher: string; result: SplitPA['result'] }, diff: string|null, items?: ItemsIndex): SplitPA => {
      const pit = items?.pitchersByLast[last(pa.pitcher)]
      const hit = items?.hittersByLast[last(pa.batter)]
      const pThrow = pit?.throw ?? null
      const pOutlier = !!pit?.outlier
      const pMax = pit?.maxVelo ?? null
      const rawBat = hit?.bat ?? null
      const actualSide = rawBat === 'S'
        ? (pThrow === 'R' ? 'L' : pThrow === 'L' ? 'R' : null)
        : (rawBat ?? null)
      return {
        inning: pa.inning,
        outs: pa.outsBefore,
        result: pa.result,
        pThrow, pOutlier, pMax,
        bSide: actualSide,
        bHeightIn: hit?.heightIn ?? null,
        diff
      }
    }

    splitBundle = {
      games: rich.map(g => ({
        id: g.meta.id,
        you: g.parsed.PAs.you.map(pa => annotate(pa, g.parsed.hittingDifficulty, opts.items)),
        opp: g.parsed.PAs.opp.map(pa => annotate(pa, g.parsed.hittingDifficulty, opts.items)),
      }))
    }
  }

  return { scope: { subset, limit, countedGames: rich.length }, yourStats, oppStats, yourInsights, byPlayers, vsPitcher, splitBundle }
}
