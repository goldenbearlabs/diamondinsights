// lib/mlbInsights.types.ts
export type Platform = 'psn' | 'xbl' | 'mlbts' | 'nsw'
export type ModeParam = 'all' | 'arena' | 'exhibition'
export type Subset = 'all' | 'online' | 'vsCPU' | 'arena' | 'exhibition'

export type RawGameHistory = {
  page: number
  per_page: number
  total_pages: number
  game_history: Array<{
    id: string
    game_mode: string
    home_full_name: string
    away_full_name: string
    home_display_result: string
    away_display_result: string
    home_runs: string
    away_runs: string
    home_hits: string
    away_hits: string
    home_errors: string
    away_errors: string
    display_pitcher_info: string
    home_name: string
    away_name: string
    display_date: string
  }>
}

export type GameRow = {
  id: string; dateISO: string | null; mode: string
  home: { name: string; runs: number; hits: number; errors: number; result: string }
  away: { name: string; runs: number; hits: number; errors: number; result: string }
  youAre: 'home' | 'away' | null
  isCPU: boolean; isOnline: boolean
  youRuns: number | null; oppRuns: number | null
  pitcherInfo: string; displayDate: string
}

export type BoxSide = {
  battingTotals: { ab: number; r: number; h: number; rbi: number; bb: number; so: number; hbp: number; sf: number; sh: number; sb: number; cs: number; e: number; pb: number }
  battingStats: Array<{
    player_name: string; ab: number; r: number; h: number; rbi: number; bb: number; so: number; doubles: number; triples: number; hr: number;
    hbp: number; sf: number; sh: number; gidp: number; sb: number; cs: number; e: number; pb: number
  }>
  pitchingTotals: { ip: number; h: number; r: number; er: number; bb: number; so: number }
  pitchingStats: Array<{ player_name: string; ip: number; h: number; r: number; er: number; bb: number; so: number; hr: number }>
}

export type InsightsResponse = {
  user: { username: string; platform: Platform; mode: ModeParam }
  summary: { totalGames: number; onlineCount: number; cpuCount: number; arenaCount: number; exhibitionCount: number; wins: number; losses: number; runDiff: number }
  groups: { all: string[]; online: string[]; vsCPU: string[]; arena: string[]; exhibition: string[] }
  gameLog: GameRow[]
  next: { hasMore: boolean; page: number; totalPages: number }
}

export type AggYourStats = {
  games: number
  batting: any
  pitching: any
}

export type AggInsights = {
  games: number
  goAheadEvents: number
  comebackWins: number
  perfectContactYou: number
  perfectContactOpp: number
  runsByInningYou: number[]
  runsByInningOpp: number[]
  KPitchYou: Record<string, number>
  KLocYou: Record<string, number>
  KPitchOpp: Record<string, number>
  KLocOpp: Record<string, number>
  swingingKYou: number
  lookingKYou: number
  chaseKYou: number
  swingingKOpp: number
  lookingKOpp: number
  chaseKOpp: number
  byBallpark: Record<string, { g: number; w: number; l: number; runsFor: number; runsAgainst: number; hrFor: number; hrAgainst: number; OPS: number }>
}

export type AggPlayers = {
  hitters: Record<string, any>
  pitchers: Record<string, any>
}

export type SplitPA = {
  inning: number
  outs: 0|1|2
  result: '1B'|'2B'|'3B'|'HR'|'BB'|'SO'|'HBP'|'SF'|'SH'|'OUT'|'DP'|'ROE'
  pThrow: 'L'|'R'|null
  pOutlier: boolean
  pMax: number|null
  bSide: 'L'|'R'|null          // switch resolved vs pitcher hand
  bHeightIn: number|null
  diff: string | null          // hitting difficulty text for the game
}

export type SplitBundle = {
  games: Array<{
    id: string
    you: SplitPA[]
    opp: SplitPA[]
  }>
}

export type AggregateResponse = {
  scope: { subset: Subset; limit: number; countedGames: number }
  yourStats: AggYourStats
  oppStats: AggYourStats
  yourInsights: AggInsights
  byPlayers: AggPlayers
  vsPitcher: Record<string, any>
  // New: raw split source for client-side filtering
  splitBundle?: SplitBundle
}
