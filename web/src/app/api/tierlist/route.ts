import { NextRequest, NextResponse } from 'next/server'

type Metric = 'ovr' | 'true_ovr' | 'meta_ovr'

type RawCard = {
  id: string | number | null
  name: string | null
  team?: string | null
  display_position?: string | null
  primary_position?: string | null
  ovr: number | null
  true_ovr?: number | null
  meta_ovr?: number | null
  series?: string | null
  image?: string | null
  attributes?: Record<string, any> | null
  tags?: string[] | null
  // a lot of feeds stuff extra metadata here too:
  meta?: Record<string, any> | null
}

type AggCard = {
  id: string | number | null
  name: string | null
  team?: string | null
  primary_position?: string | null
  positions: string[]
  series?: string | null
  image?: string | null
  ovr: number | null
  true_ovr?: number | null
  meta_ovr?: number | null
  _score: number
}

const POS_TOKENS = ['C','1B','2B','3B','SS','LF','CF','RF','DH','SP','RP','CP'] as const
const POS_REGEX = new RegExp(POS_TOKENS.join('|'), 'g')
const VALID_POS = new Set(POS_TOKENS)

const baseId = (id: string | number | null) => String(id ?? '').split('|')[0]
const n = (v: any, d = 0) => (typeof v === 'number' && Number.isFinite(v) ? v : d)

const metricScore = (c: RawCard, metric: Metric) => {
  switch (metric) {
    case 'ovr':      return n(c.ovr, -1)
    case 'true_ovr': return n(c.true_ovr ?? c.ovr, -1)
    case 'meta_ovr': return n(c.meta_ovr, -1)
    default:         return n(c.meta_ovr, -1)
  }
}

/* ---------- positions parsing (fixes "1B2B" → "1B, 2B") ---------- */
function parsePositions(rawDisp?: string | null, rawPrim?: string | null): string[] {
  const s = `${String(rawDisp ?? '')} ${String(rawPrim ?? '')}`.toUpperCase()
  const matches = s.match(POS_REGEX) ?? []
  const uniq = Array.from(new Set(matches)).filter(p => VALID_POS.has(p))
  const order = [...POS_TOKENS]
  return uniq.sort((a, b) => order.indexOf(a as any) - order.indexOf(b as any))
}

/* ---------- robust series extraction ---------- */
const KNOWN_SERIES = [
  // common MLBTS programs/series – add as you discover more in your data
  'Live Series','Signature Series','Awards','Milestone','Prime','Prospects','Future Stars',
  'Monthly Awards','Topps Now','Face of the Franchise','Faces of the Franchise','Finest','Retro Finest',
  'All-Star','All-Star Game','Postseason','Veteran','Rookie','Breakout','Second Half','2nd Half',
  'Incognito','Charisma','Kaiju','Takashi','WBC','World Baseball Classic',
  'Pipeline Past','Record Breakers','Cover Athletes','Team Affinity','Team Heroes'
]

function norm(s: string | null | undefined): string {
  return String(s ?? '').trim()
}

function firstNonEmpty(...vals: Array<any>): string | null {
  for (const v of vals) {
    const s = norm(typeof v === 'function' ? v() : v)
    if (s) return s
  }
  return null
}

function fromObj(obj: any, keys: string[]): string | null {
  for (const k of keys) {
    if (obj && obj[k] != null) {
      const s = norm(obj[k])
      if (s) return s
    }
  }
  return null
}

function guessFromName(name?: string | null): string | null {
  const s = String(name ?? '').toLowerCase()
  for (const k of KNOWN_SERIES) {
    if (s.includes(k.toLowerCase())) return k
  }
  return null
}

function guessFromTags(tags?: string[] | null): string | null {
  if (!Array.isArray(tags)) return null
  for (const t of tags) {
    const s = norm(t)
    if (!s) continue
    // prefer known ones first
    for (const k of KNOWN_SERIES) if (s.toLowerCase() === k.toLowerCase()) return k
    // generic “* Series”
    if (/series$/i.test(s)) return s
  }
  // second pass: includes
  for (const t of tags) {
    const lower = String(t ?? '').toLowerCase()
    for (const k of KNOWN_SERIES) if (lower.includes(k.toLowerCase())) return k
  }
  return null
}

function titleFromSlug(slug: string): string {
  const s = slug.replace(/[-_]+/g, ' ').replace(/\s+/g, ' ').trim()
  return s.split(' ').map(w => w ? (w[0].toUpperCase()+w.slice(1)) : '').join(' ')
}

function guessFromImage(url?: string | null): string | null {
  const u = String(url ?? '')
  if (!u) return null
  try {
    const path = new URL(u, 'https://x/').pathname // safe base
    const parts = path.split('/').filter(Boolean)
    // look for a segment that looks like a program folder
    // e.g. ".../cards/series/pipeline-past/..." or ".../programs/incognito/..."
    const candidates: string[] = []
    for (let i = 0; i < parts.length; i++) {
      const p = parts[i]
      if (/series|program|set|collection/i.test(p) && i+1 < parts.length) {
        candidates.push(parts[i+1])
      }
    }
    // fallback: try any segment that matches a known series
    const lowerParts = parts.map(p => p.toLowerCase())
    for (const k of KNOWN_SERIES) {
      const slug = k.toLowerCase().replace(/\s+/g, '-')
      if (lowerParts.includes(slug)) return k
    }
    if (candidates.length) return titleFromSlug(candidates[0])
  } catch { /* ignore */ }
  return null
}

function getSeries(r: RawCard): string | null {
  // direct & alias keys (top-level)
  const direct = firstNonEmpty(
    (r as any).series, (r as any).Series,
    (r as any).series_name, (r as any).SeriesName,
    (r as any).program, (r as any).Program,
    (r as any).set, (r as any).set_name, (r as any).collection, (r as any).collection_name
  )
  if (direct) return direct

  // nested common bags
  const fromAttr = r.attributes && fromObj(r.attributes, [
    'series','Series','series_name','SeriesName','program','Program','set','set_name','collection','collection_name'
  ])
  if (fromAttr) return fromAttr

  const fromMeta = r.meta && fromObj(r.meta, [
    'series','program','set_name','collection','series_name'
  ])
  if (fromMeta) return fromMeta

  // tags arrays
  const fromTags = guessFromTags(r.tags)
  if (fromTags) return fromTags

  // name / image heuristics
  const fromName = guessFromName(r.name)
  if (fromName) return fromName

  const fromImg = guessFromImage(r.image)
  if (fromImg) return fromImg

  return null
}

/* ---------- aggregate & dedupe by root ---------- */
function aggregateByRoot(items: RawCard[], metric: Metric): AggCard[] {
  const map = new Map<string, AggCard>()

  for (const r of items) {
    const root = baseId(r.id)
    if (!root) continue

    const tokens = parsePositions(r.display_position, r.primary_position)
    const score = metricScore(r, metric)
    const series = getSeries(r)

    if (!map.has(root)) {
      map.set(root, {
        id: r.id,
        name: r.name ?? null,
        team: r.team ?? null,
        primary_position: r.primary_position ?? null,
        positions: tokens.slice(),
        series,
        image: r.image ?? null,
        ovr: r.ovr ?? null,
        true_ovr: r.true_ovr ?? null,
        meta_ovr: r.meta_ovr ?? null,
        _score: score,
      })
    } else {
      const prev = map.get(root)!
      for (const t of tokens) if (!prev.positions.includes(t)) prev.positions.push(t)
      prev.positions = parsePositions(prev.positions.join(' '), prev.primary_position)

      if (score > prev._score) {
        prev._score = score
        prev.team = r.team ?? prev.team
        prev.image = r.image ?? prev.image
        prev.ovr = r.ovr ?? prev.ovr
        prev.true_ovr = r.true_ovr ?? prev.true_ovr
        prev.meta_ovr = r.meta_ovr ?? prev.meta_ovr
        prev.primary_position = r.primary_position ?? prev.primary_position
        if (series) prev.series = series
      } else if (!prev.series && series) {
        prev.series = series
      }
    }
  }

  for (const c of map.values()) {
    c.positions = parsePositions(c.positions.join(' '), c.primary_position)
  }
  return Array.from(map.values())
}

/* ---------- GET ---------- */
export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url)
    const q = (url.searchParams.get('q') || '').toLowerCase().trim()
    const position = (url.searchParams.get('position') || 'ALL').toUpperCase().trim()
    const metric = (url.searchParams.get('metric') as Metric) || 'true_ovr'
    const min = Number(url.searchParams.get('min') || '')
    const max = Number(url.searchParams.get('max') || '')
    const limit = Math.min(Math.max(Number(url.searchParams.get('limit') || 200), 1), 500)

    const wantSeriesList = url.searchParams.has('series_list')
    const seriesParam = url.searchParams.get('series') || ''
    const seriesList = seriesParam.split(',').map(s => s.trim()).filter(Boolean).map(s => s.toLowerCase())

    // Always fetch WITH secondaries/OOP so we dedupe once.
    const upstream = await fetch(`${url.origin}/api/player-rankings?allow_secondaries=1`, { cache: 'no-store' })
    if (!upstream.ok) return NextResponse.json({ error: `Upstream ${upstream.status}` }, { status: 502 })
    const data = await upstream.json()
    const all: RawCard[] = Array.isArray(data?.items) ? data.items : []

    // Series master list
    if (wantSeriesList) {
      const set = new Set<string>()
      for (const c of all) {
        const s = getSeries(c)
        if (s) set.add(s)
      }
      return NextResponse.json({ series: Array.from(set).sort((a,b)=> a.localeCompare(b)) })
    }

    // Aggregate & filter
    const agg = aggregateByRoot(all, metric)

    let items = agg.filter(c => {
      if (q && !String(c.name ?? '').toLowerCase().includes(q)) return false
      if (position !== 'ALL' && !c.positions.includes(position)) return false

      if (seriesList.length > 0) {
        const cs = String(c.series ?? '').toLowerCase().trim()
        if (!cs || !seriesList.includes(cs)) return false
      }

      const score =
        metric === 'ovr' ? n(c.ovr, -1)
        : metric === 'true_ovr' ? n(c.true_ovr ?? c.ovr, -1)
        : n(c.meta_ovr, -1)

      if (Number.isFinite(min) && min > 0 && score < min) return false
      if (Number.isFinite(max) && max > 0 && score > max) return false
      return true
    })

    // Sort
    items.sort((a,b) => {
      const sa = metric === 'ovr' ? n(a.ovr, -1) : metric === 'true_ovr' ? n(a.true_ovr ?? a.ovr, -1) : n(a.meta_ovr, -1)
      const sb = metric === 'ovr' ? n(b.ovr, -1) : metric === 'true_ovr' ? n(b.true_ovr ?? b.ovr, -1) : n(b.meta_ovr, -1)
      const d = sb - sa
      if (d !== 0) return d
      return String(a.name ?? '').localeCompare(String(b.name ?? ''))
    })

    const total = items.length
    const trimmed = items.slice(0, limit)

    return NextResponse.json({ total, items: trimmed })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? 'unknown error' }, { status: 500 })
  }
}
