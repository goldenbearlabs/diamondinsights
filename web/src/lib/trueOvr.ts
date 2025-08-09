// lib/trueOvr.ts
import fs from 'fs'
import path from 'path'

type LinearWinner = {
  r2_train: number
  r2_valid: number
  intercept: number
  coefficients: Record<string, number>
}
type RoleModel = {
  winner: 'linear' | 'xgboost' | 'none'
  linear: LinearWinner | null
  xgboost: any
}
type TrueOvrModel = {
  features: {
    hitter_numeric: string[]
    pitcher_numeric: string[]
    hitter_positions: string[]
    pitcher_positions: string[]
  }
  models: {
    hitter: RoleModel
    pitcher: RoleModel
  }
}

let MODEL: TrueOvrModel | null = null

export function loadTrueOvrModel(): TrueOvrModel {
  if (MODEL) return MODEL
  // NOTE: file lives at src/data/true_ovr_model.json
  const p = path.join(process.cwd(), 'src', 'data', 'true_ovr_model.json')
  let raw = fs.readFileSync(p, 'utf8')
  // sanitize invalid JSON tokens
  raw = raw
    .replace(/\bNaN\b/g, 'null')
    .replace(/\bInfinity\b/g, 'null')
    .replace(/\b-Infinity\b/g, 'null')
  MODEL = JSON.parse(raw)
  return MODEL!
}

function isPitcher(raw: any): boolean {
  if (typeof raw?.is_hitter === 'boolean') return !raw.is_hitter
  const pos = String(raw?.display_position || '').toUpperCase()
  return pos === 'SP' || pos === 'RP' || pos === 'CP'
}

function toNum(v: any): number | null {
  if (v == null) return null
  if (typeof v === 'number') return Number.isFinite(v) ? v : null
  const n = Number(String(v).replace(/[^0-9.-]/g, ''))
  return Number.isFinite(n) ? n : null
}

export function scoreTrueOvrFromRaw(raw: any): number | null {
  const model = loadTrueOvrModel()
  const role = isPitcher(raw) ? 'pitcher' : 'hitter'
  const rm = model.models[role]
  if (!rm || rm.winner === 'none' || !rm.linear) return null

  const { intercept, coefficients } = rm.linear
  let y = intercept

  for (const [feat, w] of Object.entries(coefficients)) {
    if (feat.startsWith('pos_')) continue
    const x = toNum(raw?.[feat]) ?? 0
    y += x * (Number.isFinite(w) ? w : 0)
  }

  const pos = String(raw?.display_position || '').toUpperCase()
  for (const [feat, w] of Object.entries(coefficients)) {
    if (!feat.startsWith('pos_')) continue
    const need = feat.slice(4).toUpperCase()
    y += (pos === need ? 1 : 0) * (Number.isFinite(w) ? w : 0)
  }

  return y
}
