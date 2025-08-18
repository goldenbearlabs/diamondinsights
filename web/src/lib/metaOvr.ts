// src/lib/metaOvr.ts
import { loadTrueOvrModel } from '@/lib/trueOvr'

type NumMap = Record<string, number>

function toNum(v: unknown): number | null {
  if (v == null) return null
  if (typeof v === 'number') return Number.isFinite(v) ? v : null
  const n = Number(String(v).replace(/[^0-9.-]/g, ''))
  return Number.isFinite(n) ? n : null
}
function clamp(n: number, lo: number, hi: number) { return Math.max(lo, Math.min(hi, n)) }
function parseHeightInches(h: unknown): number | null {
  const s = String(h ?? '').trim()
  const m = s.match(/^(\d+)\s*'\s*(\d+)?/); if (!m) return null
  const feet = Number(m[1] || 0), inches = Number(m[2] || 0)
  const total = feet * 12 + inches
  return Number.isFinite(total) ? total : null
}
function isPitcher(raw: any): boolean {
  if (typeof raw?.is_hitter === 'boolean') return !raw.is_hitter
  const pos = String(raw?.display_position || '').toUpperCase()
  return pos === 'SP' || pos === 'RP' || pos === 'CP'
}

/* scorer with feature gating + optional pos */
function scoreWithPerFeatureScales(
  raw: any,
  scales: Record<string, number>,
  handBonus = 0,
  opts?: { includePos?: boolean; onlyListed?: boolean }
): number | null {
  const includePos = opts?.includePos ?? true
  const onlyListed = opts?.onlyListed ?? false

  const model = loadTrueOvrModel()
  const role = isPitcher(raw) ? 'pitcher' : 'hitter'
  const rm = model.models[role]
  if (!rm || rm.winner !== 'linear' || !rm.linear) return null

  const { intercept, coefficients } = rm.linear
  const posStr = String(raw?.display_position || '').toUpperCase()

  let dot = 0, sumAbs = 0, sumAbsScaled = 0, anyIncluded = false

  for (const [feat, w] of Object.entries(coefficients)) {
    if (feat.startsWith('pos_')) {
      if (includePos) {
        const need = feat.slice(4).toUpperCase()
        dot += (posStr === need ? 1 : 0) * w
      }
      continue
    }
    const hasScale = Object.prototype.hasOwnProperty.call(scales, feat)
    const scale = hasScale ? scales[feat]! : (onlyListed ? 0 : 1)
    if (scale === 0) continue
    const present = raw?.[feat] != null
    const x = toNum(raw?.[feat]) ?? 0
    dot += (w * scale) * x
    if (present) {
      anyIncluded = true
      sumAbs += Math.abs(w)
      sumAbsScaled += Math.abs(w) * scale
    }
  }

  if (!anyIncluded || sumAbs === 0 || sumAbsScaled === 0) return null
  const norm = sumAbsScaled / sumAbs
  return intercept + (dot / norm) + handBonus
}

/* quirks */
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

/* attr helpers */
function addAttr(obj: any, key: string, delta: number) {
  const cur = toNum(obj?.[key]) ?? 0
  obj[key] = Math.max(0, cur + delta)
}
function addBothSides(obj: any, baseKeys: string[], delta: number) {
  for (const k of baseKeys) addAttr(obj, k, delta)
}

/* active boosts */
function applyQuirkAttributeBoosts(mut: any, raw: any) {
  const qnames = getQuirkNames(raw)
  const addContact = (d: number) => addBothSides(mut, ['contact_left','contact_right'], d)
  const addPower   = (d: number) => addBothSides(mut, ['power_left','power_right'], d)

  for (const q of qnames) {
    switch (q) {
      case 'dead red':
      case 'breaking ball hitter': addContact(4); addPower(4); break
      case 'bad ball hitter': addAttr(mut, 'plate_vision', 6); addContact(2); break
      case 'first pitch hitter': addContact(3); addPower(2); break
      case 'unfazed': addAttr(mut, 'plate_vision', 4); addContact(3); break
      case 'rally monkey': addAttr(mut, 'batting_clutch', 4); addContact(2); break
      case 'situational hitter': addAttr(mut, 'batting_clutch', 4); break
      case 'fighter': addAttr(mut, 'batting_clutch', 2); break
      case 'table setter': addContact(2); addAttr(mut, 'plate_discipline', 1); break
      case 'pinch hitter': addAttr(mut, 'batting_clutch', 4); addContact(3); break
      case 'day player':
      case 'night player':
      case 'homebody':
      case 'road warrior': addContact(1); break
      default: break
    }
  }
}

/* inactive taxes */
const QUIRK_INACTIVE_TAX: NumMap = {
  'first pitch hitter': 0.2, unfazed: 0.2, 'rally monkey': 0.1, 'situational hitter': 0.1,
  fighter: 0.1, 'table setter': 0.2, 'day player': 0.1, 'night player': 0.1, homebody: 0.1, 'road warrior': 0.1,
}
function applyQuirkInactiveAttributeTaxes(mut: any, raw: any) {
  const qnames = getQuirkNames(raw)
  const addContact = (d: number) => addBothSides(mut, ['contact_left','contact_right'], d)
  const addPower   = (d: number) => addBothSides(mut, ['power_left','power_right'], d)

  for (const q of qnames) {
    const t = QUIRK_INACTIVE_TAX[q]; if (!t) continue
    const cSmall = -(t * 5), pSmall = -(t * 4), vSmall = -(t * 5), dSmall = -(t * 3), clSmall = -(t * 5)
    switch (q) {
      case 'first pitch hitter': addContact(cSmall); addPower(pSmall); break
      case 'unfazed': addAttr(mut, 'plate_vision', vSmall); addContact(-(t * 3)); break
      case 'rally monkey': addAttr(mut, 'batting_clutch', clSmall); addContact(-(t * 3)); break
      case 'situational hitter': addAttr(mut, 'batting_clutch', clSmall); break
      case 'fighter': addAttr(mut, 'batting_clutch', -(t * 4)); break
      case 'table setter': addContact(cSmall); addAttr(mut, 'plate_discipline', dSmall); break
      case 'day player':
      case 'night player':
      case 'homebody':
      case 'road warrior': addContact(cSmall); break
      default: break
    }
  }
}

/* shared helpers */
function normalizeWeightsToSum1(weights: Record<string, number>) {
  const sum = Object.values(weights).reduce((a, b) => a + (b > 0 ? b : 0), 0)
  if (sum <= 0) return weights
  const out: Record<string, number> = {}
  for (const [k, v] of Object.entries(weights)) out[k] = v > 0 ? v / sum : 0
  return out
}
function defenseTierBonus(fieldingAbility: number | null | undefined): number {
  const f = toNum(fieldingAbility) ?? 0
  if (f >= 85) return 1.0
  if (f >= 80) return 0.7
  if (f >= 75) return 0.4
  if (f >= 65) return 0.2
  return 0
}

/* catcher meta */
const C_WEIGHTS = normalizeWeightsToSum1({
  blocking: 1.3, arm_strength: 1.1, fielding_ability: 0.7, arm_accuracy: 0.6, reaction_time: 0.7,
  speed: 0.7, baserunning_ability: 0.2,
  contact_left: 1.1, contact_right: 1.1, power_left: 1.3, power_right: 1.3,
  plate_vision: 0.9, plate_discipline: 0.2, batting_clutch: 1.2,
  bunting_ability: 0.05, drag_bunting_ability: 0.05,
  hitting_durability: 0.0, baserunning_aggression: 0.0,
})
function scoreCatcherCore(obj: any): number | null {
  return scoreWithPerFeatureScales(obj, C_WEIGHTS, 0, { includePos: false, onlyListed: true })
}
let C_MAX_REF_CACHE: number | null = null
function getCatcherMaxRef(): number {
  if (C_MAX_REF_CACHE != null) return C_MAX_REF_CACHE
  const maxObj: any = { display_position: 'C' }
  const set = (k: string, v: number) => { maxObj[k] = v }
  ;['contact_left','contact_right','power_left','power_right','plate_vision','plate_discipline','batting_clutch']
    .forEach(k => set(k, 125))
  ;['blocking','arm_strength','fielding_ability','arm_accuracy','reaction_time','speed','baserunning_ability',
    'bunting_ability','drag_bunting_ability'].forEach(k => set(k, 99))
  const ref = scoreCatcherCore(maxObj) ?? 125
  C_MAX_REF_CACHE = ref
  return ref
}

/* first base meta */
const FB_WEIGHTS = normalizeWeightsToSum1({
  power_left: 1.3, power_right: 1.3,
  contact_left: 1.2, contact_right: 1.2,
  batting_clutch: 1.1,
  plate_vision: 1.0, plate_discipline: 0.3,
  fielding_ability: 1.15, reaction_time: 1.05,
  arm_strength: 0.3, arm_accuracy: 0.3,
  speed: 1.0, baserunning_ability: 0.2, baserunning_aggression: 0.0,
  bunting_ability: 0.05, drag_bunting_ability: 0.05,
  blocking: 0.0,
  hitting_durability: 0.0, fielding_durability: 0.0,
})
function score1BCore(obj: any): number | null {
  return scoreWithPerFeatureScales(obj, FB_WEIGHTS, 0, { includePos: false, onlyListed: true })
}
let FB_MAX_REF_CACHE: number | null = null
function get1BMaxRef(): number {
  if (FB_MAX_REF_CACHE != null) return FB_MAX_REF_CACHE
  const maxObj: any = { display_position: '1B' }
  const set = (k: string, v: number) => { maxObj[k] = v }
  ;['contact_left','contact_right','power_left','power_right','plate_vision','plate_discipline','batting_clutch']
    .forEach(k => set(k, 125))
  ;['fielding_ability','reaction_time','arm_strength','arm_accuracy','speed','baserunning_ability']
    .forEach(k => set(k, 99))
  ;['baserunning_aggression'].forEach(k => set(k, 99))
  const ref = score1BCore(maxObj) ?? 125
  FB_MAX_REF_CACHE = ref
  return ref
}

/* second base meta */
const SB_WEIGHTS = normalizeWeightsToSum1({
  fielding_ability: 1.2, reaction_time: 1.3, arm_accuracy: 1.1, arm_strength: 0.6,
  speed: 1.1, baserunning_ability: 0.8, baserunning_aggression: 0.0,
  contact_left: 1.2, contact_right: 1.2, power_left: 1.1, power_right: 1.1,
  plate_vision: 1.1, plate_discipline: 0.5, batting_clutch: 1.0,
  bunting_ability: 0.05, drag_bunting_ability: 0.05,
  blocking: 0.0, hitting_durability: 0.0, fielding_durability: 0.0,
})
function score2BCore(obj: any): number | null {
  return scoreWithPerFeatureScales(obj, SB_WEIGHTS, 0, { includePos: false, onlyListed: true })
}
let SB_MAX_REF_CACHE: number | null = null
function get2BMaxRef(): number {
  if (SB_MAX_REF_CACHE != null) return SB_MAX_REF_CACHE
  const maxObj: any = { display_position: '2B' }
  const set = (k: string, v: number) => { maxObj[k] = v }
  ;['contact_left','contact_right','power_left','power_right','plate_vision','plate_discipline','batting_clutch']
    .forEach(k => set(k, 125))
  ;['fielding_ability','reaction_time','arm_accuracy','arm_strength','speed','baserunning_ability',
     'bunting_ability','drag_bunting_ability','baserunning_aggression']
    .forEach(k => set(k, 99))
  const ref = score2BCore(maxObj) ?? 125
  SB_MAX_REF_CACHE = ref
  return ref
}

/* third base meta */
const THIRD_WEIGHTS = normalizeWeightsToSum1({
  reaction_time: 1.4,
  fielding_ability: 1.2,
  arm_strength: 1.3,
  arm_accuracy: 1.0,
  power_left: 1.5, power_right: 1.5,
  contact_left: 1.1, contact_right: 1.1,
  plate_vision: 0.9, plate_discipline: 0.3, batting_clutch: 1.0,
  speed: 0.8, baserunning_ability: 0.3, baserunning_aggression: 0.0,
  bunting_ability: 0.05, drag_bunting_ability: 0.05,
  blocking: 0.0, hitting_durability: 0.0, fielding_durability: 0.0,
})
function score3BCore(obj: any): number | null {
  return scoreWithPerFeatureScales(obj, THIRD_WEIGHTS, 0, { includePos: false, onlyListed: true })
}
let B3_MAX_REF_CACHE: number | null = null
function get3BMaxRef(): number {
  if (B3_MAX_REF_CACHE != null) return B3_MAX_REF_CACHE
  const maxObj: any = { display_position: '3B' }
  const set = (k: string, v: number) => { maxObj[k] = v }
  ;['contact_left','contact_right','power_left','power_right','plate_vision','plate_discipline','batting_clutch']
    .forEach(k => set(k, 125))
  ;['reaction_time','fielding_ability','arm_strength','arm_accuracy','speed','baserunning_ability']
    .forEach(k => set(k, 99))
  ;['bunting_ability','drag_bunting_ability','baserunning_aggression'].forEach(k => set(k, 99))
  const ref = score3BCore(maxObj) ?? 125
  B3_MAX_REF_CACHE = ref
  return ref
}

/* shortstop meta */
const SS_WEIGHTS = normalizeWeightsToSum1({
  fielding_ability: 1.6,
  reaction_time: 1.6,
  arm_accuracy: 1.2,
  arm_strength: 1.1,
  speed: 1.2,
  baserunning_ability: 1.1,
  baserunning_aggression: 0.0,
  contact_left: 1.2, contact_right: 1.2,
  power_left: 1, power_right: 1,
  plate_vision: 1.0, plate_discipline: 0.5, batting_clutch: 1,
  bunting_ability: 0.05, drag_bunting_ability: 0.05,
  blocking: 0.0, hitting_durability: 0.0, fielding_durability: 0.0,
})
function scoreSSCore(obj: any): number | null {
  return scoreWithPerFeatureScales(obj, SS_WEIGHTS, 0, { includePos: false, onlyListed: true })
}
let SS_MAX_REF_CACHE: number | null = null
function getSSMaxRef(): number {
  if (SS_MAX_REF_CACHE != null) return SS_MAX_REF_CACHE
  const maxObj: any = { display_position: 'SS' }
  const set = (k: string, v: number) => { maxObj[k] = v }
  ;['contact_left','contact_right','power_left','power_right','plate_vision','plate_discipline','batting_clutch']
    .forEach(k => set(k, 125))
  ;['fielding_ability','reaction_time','arm_accuracy','arm_strength','speed','baserunning_ability']
    .forEach(k => set(k, 99))
  ;['bunting_ability','drag_bunting_ability','baserunning_aggression'].forEach(k => set(k, 99))
  const ref = scoreSSCore(maxObj) ?? 125
  SS_MAX_REF_CACHE = ref
  return ref
}

/* left field (LF) meta */
const LF_WEIGHTS = normalizeWeightsToSum1({
  power_left: 1.4, power_right: 1.4,
  contact_left: 1.25, contact_right: 1.25,
  batting_clutch: 1.5,
  plate_vision: 1.0, plate_discipline: 0.3,
  fielding_ability: 0.9, reaction_time: 1.0,
  arm_strength: 0.5, arm_accuracy: 0.6,
  speed: 0.8, baserunning_ability: 0.2, baserunning_aggression: 0.0,
  bunting_ability: 0.05, drag_bunting_ability: 0.05,
  blocking: 0.0, hitting_durability: 0.0, fielding_durability: 0.0,
})
function scoreLFCore(obj: any): number | null {
  return scoreWithPerFeatureScales(obj, LF_WEIGHTS, 0, { includePos: false, onlyListed: true })
}
let LF_MAX_REF_CACHE: number | null = null
function getLFMaxRef(): number {
  if (LF_MAX_REF_CACHE != null) return LF_MAX_REF_CACHE
  const maxObj: any = { display_position: 'LF' }
  const set = (k: string, v: number) => { maxObj[k] = v }
  ;['contact_left','contact_right','power_left','power_right','plate_vision','plate_discipline','batting_clutch']
    .forEach(k => set(k, 125))
  ;['fielding_ability','reaction_time','arm_strength','arm_accuracy','speed','baserunning_ability',
     'bunting_ability','drag_bunting_ability','baserunning_aggression']
    .forEach(k => set(k, 99))
  const ref = scoreLFCore(maxObj) ?? 125
  LF_MAX_REF_CACHE = ref
  return ref
}

/* center field (CF) meta */
const CF_WEIGHTS = normalizeWeightsToSum1({
  reaction_time: 1.5, fielding_ability: 1.4,
  arm_strength: 1.0, arm_accuracy: 1.0,
  speed: 1.6, baserunning_ability: 0.8, baserunning_aggression: 0.0,
  contact_left: 1.2, contact_right: 1.2,
  power_left: 1, power_right: 1,
  plate_vision: 1.1, plate_discipline: 0.5, batting_clutch: 1.0,
  bunting_ability: 0.05, drag_bunting_ability: 0.05,
  blocking: 0.0, hitting_durability: 0.0, fielding_durability: 0.0,
})
function scoreCFCore(obj: any): number | null {
  return scoreWithPerFeatureScales(obj, CF_WEIGHTS, 0, { includePos: false, onlyListed: true })
}
let CF_MAX_REF_CACHE: number | null = null
function getCFMaxRef(): number {
  if (CF_MAX_REF_CACHE != null) return CF_MAX_REF_CACHE
  const maxObj: any = { display_position: 'CF' }
  const set = (k: string, v: number) => { maxObj[k] = v }
  ;['contact_left','contact_right','power_left','power_right','plate_vision','plate_discipline','batting_clutch']
    .forEach(k => set(k, 125))
  ;['reaction_time','fielding_ability','arm_strength','arm_accuracy','speed','baserunning_ability',
     'bunting_ability','drag_bunting_ability','baserunning_aggression']
    .forEach(k => set(k, 99))
  const ref = scoreCFCore(maxObj) ?? 125
  CF_MAX_REF_CACHE = ref
  return ref
}

/* right field (RF) meta */
const RF_WEIGHTS = normalizeWeightsToSum1({
  arm_strength: 1.5, arm_accuracy: 1.3,
  fielding_ability: 1.0, reaction_time: 1.0,
  power_left: 1.5, power_right: 1.5,
  contact_left: 1.1, contact_right: 1.1,
  plate_vision: 1.0, plate_discipline: 0.5, batting_clutch: 1.2,
  speed: 0.8, baserunning_ability: 0.2, baserunning_aggression: 0.0,
  bunting_ability: 0.05, drag_bunting_ability: 0.05,
  blocking: 0.0, hitting_durability: 0.0, fielding_durability: 0.0,
})
function scoreRFCore(obj: any): number | null {
  return scoreWithPerFeatureScales(obj, RF_WEIGHTS, 0, { includePos: false, onlyListed: true })
}
let RF_MAX_REF_CACHE: number | null = null
function getRFMaxRef(): number {
  if (RF_MAX_REF_CACHE != null) return RF_MAX_REF_CACHE
  const maxObj: any = { display_position: 'RF' }
  const set = (k: string, v: number) => { maxObj[k] = v }
  ;['contact_left','contact_right','power_left','power_right','plate_vision','plate_discipline','batting_clutch']
    .forEach(k => set(k, 125))
  ;['fielding_ability','reaction_time','arm_strength','arm_accuracy','speed','baserunning_ability',
     'bunting_ability','drag_bunting_ability','baserunning_aggression']
    .forEach(k => set(k, 99))
  const ref = scoreRFCore(maxObj) ?? 125
  RF_MAX_REF_CACHE = ref
  return ref
}

/* public base meta */
export function computeMetaOvr(raw: any, trueOvr: number | null): number | null {
  if (isPitcher(raw)) return trueOvr

  const pos = String(raw?.display_position || '').toUpperCase()

  if (pos === 'C') {
    const core0 = scoreCatcherCore(raw); if (core0 == null) return trueOvr
    const scale = 125 / getCatcherMaxRef()
    let y = core0 * scale
    const mutQ: any = { ...raw }
    applyQuirkAttributeBoosts(mutQ, raw)
    applyQuirkInactiveAttributeTaxes(mutQ, raw)
    const coreQ = scoreCatcherCore(mutQ)
    if (coreQ != null) {
      const delta = (coreQ - core0) * scale
      y += delta * Math.max(0, 1 - (y / 125))
    }
    const tier = defenseTierBonus(mutQ?.fielding_ability)
    const hand = String(raw?.bat_hand || '').toUpperCase()
    const handBonus = hand === 'S' ? 0.85 : hand === 'L' ? -0.5 : 0
    const hIn = parseHeightInches(raw?.height)
    const heightBonus = hIn == null ? 0 : ((clamp(hIn,60,84) - 72) * (-0.75/12))
    const headroom = Math.max(0, 1 - (y / 125))
    y += (tier + handBonus + heightBonus) * headroom
    return y
  }

  if (pos === '1B') {
    const core0 = score1BCore(raw); if (core0 == null) return trueOvr
    const scale = 125 / get1BMaxRef()
    let y = core0 * scale
    const mutQ: any = { ...raw }
    applyQuirkAttributeBoosts(mutQ, raw)
    applyQuirkInactiveAttributeTaxes(mutQ, raw)
    const coreQ = score1BCore(mutQ)
    if (coreQ != null) {
      const delta = (coreQ - core0) * scale
      y += delta * Math.max(0, 1 - (y / 125))
    }
    const tier = defenseTierBonus(mutQ?.fielding_ability) * 0.6
    const hand = String(raw?.bat_hand || '').toUpperCase()
    const handBonus = hand === 'S' ? 0.85 : hand === 'L' ? -0.5 : 0
    const hIn = parseHeightInches(raw?.height)
    const heightBonus = hIn == null ? 0 : ((clamp(hIn,60,84) - 72) * (-0.75/12))
    const headroom = Math.max(0, 1 - (y / 125))
    y += (tier + handBonus + heightBonus) * headroom
    return y
  }

  if (pos === '2B') {
    const core0 = score2BCore(raw); if (core0 == null) return trueOvr
    const scale = 125 / get2BMaxRef()
    let y = core0 * scale
    const mutQ: any = { ...raw }
    applyQuirkAttributeBoosts(mutQ, raw)
    applyQuirkInactiveAttributeTaxes(mutQ, raw)
    const coreQ = score2BCore(mutQ)
    if (coreQ != null) {
      const delta = (coreQ - core0) * scale
      y += delta * Math.max(0, 1 - (y / 125))
    }
    const tier = defenseTierBonus(mutQ?.fielding_ability) * 0.9
    const hand = String(raw?.bat_hand || '').toUpperCase()
    const handBonus = hand === 'S' ? 0.85 : hand === 'L' ? -0.5 : 0
    const hIn = parseHeightInches(raw?.height)
    const heightBonus = hIn == null ? 0 : ((clamp(hIn,60,84) - 72) * (0.5/12))
    const headroom = Math.max(0, 1 - (y / 125))
    y += (tier + handBonus + heightBonus) * headroom
    return y
  }

  if (pos === '3B') {
    const core0 = score3BCore(raw); if (core0 == null) return trueOvr
    const scale = 125 / get3BMaxRef()
    let y = core0 * scale
    const mutQ: any = { ...raw }
    applyQuirkAttributeBoosts(mutQ, raw)
    applyQuirkInactiveAttributeTaxes(mutQ, raw)
    const coreQ = score3BCore(mutQ)
    if (coreQ != null) {
      const delta = (coreQ - core0) * scale
      y += delta * Math.max(0, 1 - (y / 125))
    }
    const tier = defenseTierBonus(mutQ?.fielding_ability) * 0.8
    const hand = String(raw?.bat_hand || '').toUpperCase()
    const handBonus = hand === 'S' ? 0.85 : hand === 'L' ? -0.5 : 0
    const hIn = parseHeightInches(raw?.height)
    const heightBonus = hIn == null ? 0 : ((clamp(hIn,60,84) - 72) * (-0.75/12))
    const headroom = Math.max(0, 1 - (y / 125))
    y += (tier + handBonus + heightBonus) * headroom
    return y
  }

  if (pos === 'SS') {
    const core0 = scoreSSCore(raw); if (core0 == null) return trueOvr
    const scale = 125 / getSSMaxRef()
    let y = core0 * scale
    const mutQ: any = { ...raw }
    applyQuirkAttributeBoosts(mutQ, raw)
    applyQuirkInactiveAttributeTaxes(mutQ, raw)
    const coreQ = scoreSSCore(mutQ)
    if (coreQ != null) {
      const delta = (coreQ - core0) * scale
      y += delta * Math.max(0, 1 - (y / 125))
    }
    const tier = defenseTierBonus(mutQ?.fielding_ability) * 1.2
    const hand = String(raw?.bat_hand || '').toUpperCase()
    const handBonus = hand === 'S' ? 0.85 : hand === 'L' ? -0.5 : 0
    const hIn = parseHeightInches(raw?.height)
    const heightBonus = hIn == null ? 0 : ((clamp(hIn,60,84) - 72) * (0.5/12))
    const headroom = Math.max(0, 1 - (y / 125))
    y += (tier + handBonus + heightBonus) * headroom
    return y
  }

  if (pos === 'LF') {
    const core0 = scoreLFCore(raw); if (core0 == null) return trueOvr
    const scale = 125 / getLFMaxRef()
    let y = core0 * scale
    const mutQ: any = { ...raw }
    applyQuirkAttributeBoosts(mutQ, raw)
    applyQuirkInactiveAttributeTaxes(mutQ, raw)
    const coreQ = scoreLFCore(mutQ)
    if (coreQ != null) {
      const delta = (coreQ - core0) * scale
      y += delta * Math.max(0, 1 - (y / 125))
    }
    const tier = defenseTierBonus(mutQ?.fielding_ability) * 0.7
    const hand = String(raw?.bat_hand || '').toUpperCase()
    const handBonus = hand === 'S' ? 0.85 : hand === 'L' ? -0.5 : 0
    const hIn = parseHeightInches(raw?.height)
    const heightBonus = hIn == null ? 0 : ((clamp(hIn,60,84) - 72) * (-0.75/12))
    const headroom = Math.max(0, 1 - (y / 125))
    y += (tier + handBonus + heightBonus) * headroom
    return y
  }

  if (pos === 'CF') {
    const core0 = scoreCFCore(raw); if (core0 == null) return trueOvr
    const scale = 125 / getCFMaxRef()
    let y = core0 * scale
    const mutQ: any = { ...raw }
    applyQuirkAttributeBoosts(mutQ, raw)
    applyQuirkInactiveAttributeTaxes(mutQ, raw)
    const coreQ = scoreCFCore(mutQ)
    if (coreQ != null) {
      const delta = (coreQ - core0) * scale
      y += delta * Math.max(0, 1 - (y / 125))
    }
    const tier = defenseTierBonus(mutQ?.fielding_ability) * 1.1
    const hand = String(raw?.bat_hand || '').toUpperCase()
    const handBonus = hand === 'S' ? 0.9 : hand === 'L' ? -0.5 : 0
    const hIn = parseHeightInches(raw?.height)
    const heightBonus = hIn == null ? 0 : ((clamp(hIn,60,84) - 72) * (-0.75/12))
    const headroom = Math.max(0, 1 - (y / 125))
    y += (tier + handBonus + heightBonus) * headroom
    return y
  }

  if (pos === 'RF') {
    const core0 = scoreRFCore(raw); if (core0 == null) return trueOvr
    const scale = 125 / getRFMaxRef()
    let y = core0 * scale
    const mutQ: any = { ...raw }
    applyQuirkAttributeBoosts(mutQ, raw)
    applyQuirkInactiveAttributeTaxes(mutQ, raw)
    const coreQ = scoreRFCore(mutQ)
    if (coreQ != null) {
      const delta = (coreQ - core0) * scale
      y += delta * Math.max(0, 1 - (y / 125))
    }
    const tier = defenseTierBonus(mutQ?.fielding_ability) * 0.9
    const hand = String(raw?.bat_hand || '').toUpperCase()
    const handBonus = hand === 'S' ? 0.85 : hand === 'L' ? -0.5 : 0
    const hIn = parseHeightInches(raw?.height)
    const heightBonus = hIn == null ? 0 : ((clamp(hIn,60,84) - 72) * (-0.75/12))
    const headroom = Math.max(0, 1 - (y / 125))
    y += (tier + handBonus + heightBonus) * headroom
    return y
  }

  // default hitter meta
  const mut: any = { ...raw }
  applyQuirkAttributeBoosts(mut, raw)
  applyQuirkInactiveAttributeTaxes(mut, raw)

  const zeroScales: Record<string, number> = {
    hitting_durability: 0, fielding_durability: 0, baserunning_aggression: 0,
  }
  let y = scoreWithPerFeatureScales(mut, zeroScales, 0)
  if (y == null) return trueOvr

  const hand = String(raw?.bat_hand || '').toUpperCase()
  if (hand === 'S') y += 1.0
  else if (hand === 'L') y += -0.5

  const hIn = parseHeightInches(raw?.height)
  if (hIn != null) {
    const clamped = clamp(hIn, 60, 84)
    const deltaFrom72 = clamped - 72
    y += deltaFrom72 * (-0.75 / 12)
  }

  return y
}

/* ---------------- Facet meta (same 0–125 scale) ---------------- */

type PosKey = 'C'|'1B'|'2B'|'3B'|'SS'|'LF'|'CF'|'RF'
export type MetaFacet = 'power'|'contact'|'vs_left'|'vs_right'|'bunting'|'baserunning'|'defense'

function getBasePosWeights(pos: PosKey): { weights: Record<string, number>, refMax: number } {
  switch (pos) {
    case 'C':  return { weights: { ...C_WEIGHTS },  refMax: getCatcherMaxRef() }
    case '1B': return { weights: { ...FB_WEIGHTS }, refMax: get1BMaxRef() }
    case '2B': return { weights: { ...SB_WEIGHTS }, refMax: get2BMaxRef() }
    case '3B': return { weights: { ...THIRD_WEIGHTS }, refMax: get3BMaxRef() }
    case 'SS': return { weights: { ...SS_WEIGHTS }, refMax: getSSMaxRef() }
    case 'LF': return { weights: { ...LF_WEIGHTS }, refMax: getLFMaxRef() }
    case 'CF': return { weights: { ...CF_WEIGHTS }, refMax: getCFMaxRef() }
    case 'RF': return { weights: { ...RF_WEIGHTS }, refMax: getRFMaxRef() }
  }
}
function boost(obj: Record<string, number>, k: string, mult: number) {
  if (obj[k] == null) obj[k] = 0
  obj[k] = obj[k] * mult
}

export function computeMetaFacet(raw: any, facet: MetaFacet): number | null {
  const pos = String(raw?.display_position || '').toUpperCase() as PosKey
  if (!['C','1B','2B','3B','SS','LF','CF','RF'].includes(pos)) return null

  const { weights, refMax } = getBasePosWeights(pos)
  if (!refMax || refMax <= 0) return null

  switch (facet) {
    case 'power':
      boost(weights,'power_left', 4.0); boost(weights,'power_right', 4.0)
      boost(weights,'contact_left', 1.0); boost(weights,'contact_right', 1.0)
      break
    case 'contact':
      boost(weights,'contact_left', 4.0); boost(weights,'contact_right', 4.0)
      boost(weights,'power_left', 1.00); boost(weights,'power_right', 1.00)
      break
    case 'vs_left': {
      const mut = { ...raw }
      if (mut.contact_left != null)  mut.contact_right = mut.contact_left
      if (mut.power_left != null)    mut.power_right   = mut.power_left
      const scale = 125 / refMax
      boost(weights,'contact_left', 2); boost(weights,'power_left', 2)
      boost(weights,'contact_right', 2); boost(weights,'power_right', 2)
      const y = scoreWithPerFeatureScales(mut, normalizeWeightsToSum1(weights), 0, { includePos:false, onlyListed:true })
      return y == null ? null : Math.min(y * scale, 125)
    }
    case 'vs_right': {
      const mut = { ...raw }
      if (mut.contact_right != null) mut.contact_left = mut.contact_right
      if (mut.power_right != null)   mut.power_left   = mut.power_right
      const scale = 125 / refMax
      boost(weights,'contact_right', 2); boost(weights,'power_right', 2)
      boost(weights,'contact_left', 2);  boost(weights,'power_left', 2)
      const y = scoreWithPerFeatureScales(mut, normalizeWeightsToSum1(weights), 0, { includePos:false, onlyListed:true })
      return y == null ? null : Math.min(y * scale, 125)
    }
    case 'bunting': {
        const bun = (toNum(raw?.bunting_ability) ?? 0)
        const drag = (toNum(raw?.drag_bunting_ability) ?? 0)
        const spd = (toNum(raw?.speed) ?? 0)
        const composite = 0.55 * drag + 0.35 * bun + 0.10 * spd
        return Math.min(composite, 125)
      }
    case 'baserunning':
      boost(weights,'speed', 15); boost(weights,'baserunning_ability', 15)
      weights['baserunning_aggression'] = (weights['baserunning_aggression'] ?? 0) + 1
      break
    case 'defense':
      boost(weights,'fielding_ability', 10); boost(weights,'reaction_time', 10)
      boost(weights,'arm_strength', 10); boost(weights,'arm_accuracy', 10)
      if (pos === 'C') boost(weights,'blocking', 10)
      break
  }

  const scale = 125 / refMax
  const y = scoreWithPerFeatureScales(raw, normalizeWeightsToSum1(weights), 0, { includePos:false, onlyListed:true })
  return y == null ? null : Math.min(y * scale, 125)
}
