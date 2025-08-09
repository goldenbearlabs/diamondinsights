// src/lib/metaOvr.ts
import { loadTrueOvrModel } from '@/lib/trueOvr'

type NumMap = Record<string, number>

function toNum(v: unknown): number | null {
  if (v == null) return null
  if (typeof v === 'number') return Number.isFinite(v) ? v : null
  const n = Number(String(v).replace(/[^0-9.-]/g, ''))
  return Number.isFinite(n) ? n : null
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
function isPitcher(raw: any): boolean {
  if (typeof raw?.is_hitter === 'boolean') return !raw.is_hitter
  const pos = String(raw?.display_position || '').toUpperCase()
  return pos === 'SP' || pos === 'RP' || pos === 'CP'
}

/** Present-only, renormalized scorer with per-feature scales. */
function scoreWithPerFeatureScales(
  raw: any,
  scales: Record<string, number>,
  handBonus = 0
): number | null {
  const model = loadTrueOvrModel()
  const role = isPitcher(raw) ? 'pitcher' : 'hitter'
  const rm = model.models[role]
  if (!rm || rm.winner !== 'linear' || !rm.linear) return null

  const { intercept, coefficients } = rm.linear
  let dotNumScaled = 0, dotPos = 0, sumAbs = 0, sumAbsScaled = 0
  const posStr = String(raw?.display_position || '').toUpperCase()

  for (const [feat, w] of Object.entries(coefficients)) {
    if (feat.startsWith('pos_')) {
      const need = feat.slice(4).toUpperCase()
      dotPos += w * (posStr === need ? 1 : 0)
      continue
    }
    const xVal = toNum(raw?.[feat]) ?? 0
    const present = raw?.[feat] != null
    const scale = scales[feat] ?? 1
    dotNumScaled += (w * scale) * xVal
    if (present) {
      sumAbs += Math.abs(w)
      sumAbsScaled += Math.abs(w) * scale
    }
  }

  let y = intercept + dotPos + dotNumScaled
  if (sumAbs > 0 && sumAbsScaled > 0) {
    const norm = sumAbsScaled / sumAbs
    y = intercept + dotPos + (dotNumScaled / norm)
  }
  return y + handBonus
}

/* ---------- Quirks parsing ---------- */

function normalizeQuirkName(q: string): string {
  return q.toLowerCase().replace(/[^a-z0-9]+/g, ' ').replace(/\s+/g, ' ').trim()
}
function getQuirkNames(raw: any): string[] {
  const q = raw?.quirks
  if (!q) return []
  if (Array.isArray(q)) {
    return q.map((entry) => {
      if (typeof entry === 'string') return normalizeQuirkName(entry)
      if (entry && typeof entry === 'object' && entry.name) return normalizeQuirkName(String(entry.name))
      return null
    }).filter((s): s is string => !!s && s.length > 0)
  }
  return []
}

/* ---------- Attribute mutation helpers ---------- */

// No 125 cap; keep a floor at 0 so we don’t go negative.
function addAttr(obj: any, key: string, delta: number) {
  const cur = toNum(obj?.[key]) ?? 0
  const next = Math.max(0, cur + delta)
  obj[key] = next
}
function addBothSides(obj: any, baseKeys: string[], delta: number) {
  for (const k of baseKeys) addAttr(obj, k, delta)
}

/* ---------- Quirk → attribute boosts (ACTIVE) ---------- */

function applyQuirkAttributeBoosts(mut: any, raw: any) {
  const pos = String(raw?.display_position || '').toUpperCase()
  const isCatcher = pos === 'C'
  const qnames = getQuirkNames(raw)

  const addContact = (d: number) => addBothSides(mut, ['contact_left','contact_right'], d)
  const addPower   = (d: number) => addBothSides(mut, ['power_left','power_right'], d)

  for (const q of qnames) {
    switch (q) {
      case 'dead red':
        addContact(4); addPower(4)
        break
      case 'breaking ball hitter':
        addContact(4); addPower(4)
        break
      case 'bad ball hitter':
        addAttr(mut, 'plate_vision', 6)
        addContact(2)
        break
      case 'first pitch hitter':
        addContact(3); addPower(2)
        break
      case 'unfazed':
        addAttr(mut, 'plate_vision', 4)
        addContact(3)
        break
      case 'rally monkey':
        addAttr(mut, 'batting_clutch', 4)
        addContact(2)
        break
      case 'situational hitter':
        addAttr(mut, 'batting_clutch', 4)
        break
      case 'fighter':
        addAttr(mut, 'batting_clutch', 2)
        break
      case 'table setter':
        addContact(2); addAttr(mut, 'plate_discipline', 1)
        break
      case 'pinch hitter':
        addAttr(mut, 'batting_clutch', 4); addContact(3)
        break
      case 'catcher pop time':
        if (isCatcher) {
          addAttr(mut, 'arm_strength', 6)
          addAttr(mut, 'arm_accuracy', 6)
          addAttr(mut, 'reaction_time', 2)
          addAttr(mut, 'blocking', 2)
        }
        break
      // minor context quirks -> tiny contact bump
      case 'day player':
      case 'night player':
      case 'homebody':
      case 'road warrior':
        addContact(1)
        break
      // pitcher-focused or not mappable for hitters: ignore
      case 'stopper':
      case 'outlier i':
      case 'outlier ii':
      case 'break outlier':
      case 'pressure cooker':
      case 'pickoff artist':
        break
      default:
        break
    }
  }
}

/* ---------- Quirk → attribute taxes (INACTIVE) ----------
   Apply small negative deltas to attributes instead of subtracting from OVR.
   We mirror the “theme” of each quirk, using the same stats as the boost but smaller.
*/

const QUIRK_INACTIVE_TAX: NumMap = {
  'first pitch hitter': 0.2,
  unfazed: 0.2,
  'rally monkey': 0.1,
  'situational hitter': 0.1,
  fighter: 0.1,
  'table setter': 0.2,
  'day player': 0.1,
  'night player': 0.1,
  homebody: 0.1,
  'road warrior': 0.1,
}

function applyQuirkInactiveAttributeTaxes(mut: any, raw: any) {
  const qnames = getQuirkNames(raw)
  const addContact = (d: number) => addBothSides(mut, ['contact_left','contact_right'], d)
  const addPower   = (d: number) => addBothSides(mut, ['power_left','power_right'], d)

  for (const q of qnames) {
    const t = QUIRK_INACTIVE_TAX[q]
    if (!t) continue
    // Convert OVR-ish “t” into small attribute deltas (rough heuristic).
    // t=0.2 -> ~1 point to the key stat; 0.1 -> ~0.5
    const cSmall = -(t * 5)   // contact penalty
    const pSmall = -(t * 4)   // power penalty
    const vSmall = -(t * 5)   // vision penalty
    const dSmall = -(t * 3)   // discipline penalty
    const clSmall = -(t * 5)  // clutch penalty

    switch (q) {
      case 'first pitch hitter':
        addContact(cSmall); addPower(pSmall)
        break
      case 'unfazed':
        addAttr(mut, 'plate_vision', vSmall)
        addContact(-(t * 3))
        break
      case 'rally monkey':
        addAttr(mut, 'batting_clutch', clSmall)
        addContact(-(t * 3))
        break
      case 'situational hitter':
        addAttr(mut, 'batting_clutch', clSmall)
        break
      case 'fighter':
        addAttr(mut, 'batting_clutch', -(t * 4))
        break
      case 'table setter':
        addContact(cSmall); addAttr(mut, 'plate_discipline', dSmall)
        break
      case 'day player':
      case 'night player':
      case 'homebody':
      case 'road warrior':
        addContact(cSmall)
        break
      default:
        break
    }
  }
}

/* ---------- Public API ---------- */

export function computeMetaOvr(raw: any, trueOvr: number | null): number | null {
  // Pitchers: for now, meta == true
  if (isPitcher(raw)) return trueOvr

  // Clone: we mutate attributes on this copy
  const mut: any = { ...raw }

  // 1) Apply per-quirk ACTIVE boosts to attributes
  applyQuirkAttributeBoosts(mut, raw)

  // 2) Apply per-quirk INACTIVE taxes to attributes (small negatives)
  applyQuirkInactiveAttributeTaxes(mut, raw)

  // 3) Zero-weight durability and baserunning_aggression (renormalized)
  const zeroScales: Record<string, number> = {
    hitting_durability: 0,
    fielding_durability: 0,
    baserunning_aggression: 0,
  }
  let y = scoreWithPerFeatureScales(mut, zeroScales, 0)
  if (y == null) y = trueOvr
  if (y == null) return null

  // 4) Handedness bump: S +1.0, L −0.5, R 0
  const hand = String(raw?.bat_hand || '').toUpperCase()
  if (hand === 'S') y += 1.0
  else if (hand === 'L') y += -0.5

  // 5) Height meta: +0.75 @ 5'0", 0 @ 6'0", −0.75 @ 7'0"
  const hIn = parseHeightInches(raw?.height)
  if (hIn != null) {
    const clamped = clamp(hIn, 60, 84)   // 5'0" .. 7'0"
    const deltaFrom72 = clamped - 72     // inches from 6'0"
    const slope = -0.75 / 12             // per inch
    y += deltaFrom72 * slope
  }

  return y
}
