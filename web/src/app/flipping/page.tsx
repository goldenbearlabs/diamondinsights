'use client'

import { useEffect, useState } from 'react'
import styles from './page.module.css'

// Stubs currency icon component
const StubsIcon = ({ className = "" }: { className?: string }) => (
  <img 
    src="/assets/stubs.webp" 
    alt="Stubs" 
    className={`inline-block ${className}`}
    style={{ 
      width: '0.8em', 
      height: '0.8em', 
      verticalAlign: 'baseline',
      marginRight: '0.1em',
      marginTop: '-0.1em'
    }}
  />
)

type Item = {
  id: number | string | null
  name: string | null

  // optional meta (local filters)
  rarity?: string | null
  team?: string | null
  display_position?: string | null
  rank?: number | string | null

  best_buy_price: number | null
  best_sell_price: number | null
  image?: string | null

  buys_5m?: number
  sells_5m?: number
  volume_5m?: number
  net_profit?: number | null

  // now percentages
  delta_buy_1h?: number | null
  delta_buy_1d?: number | null
  delta_buy_1w?: number | null
  delta_buy_1m?: number | null
}

type ApiResp = { items?: Item[] }

type SortKey =
  | 'name'
  | 'best_buy_price'
  | 'best_sell_price'
  | '_spread'
  | 'net_profit'
  | 'buys_5m'
  | 'sells_5m'
  | 'volume_5m'
  | 'profit_per_min'
  | 'delta_buy_1h'
  | 'delta_buy_1d'
  | 'delta_buy_1w'
  | 'delta_buy_1m'

const PAGE_SIZE = 25
const REFRESH_MS = 5 * 60 * 1000

export default function FlippingPage() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [rows, setRows] = useState<Item[]>([])
  const [lastUpdated, setLastUpdated] = useState<number | null>(null)

  const [page, setPage] = useState(1)
  const [filtersCollapsed, setFiltersCollapsed] = useState(false)

  // local filters only
  const [rarity, setRarity] = useState('')
  const [name, setName] = useState('')
  const [team, setTeam] = useState('')
  const [position, setPosition] = useState('')
  const [minRank, setMinRank] = useState('')
  const [maxRank, setMaxRank] = useState('')

  const [minSell, setMinSell] = useState('600')
  const [maxSell, setMaxSell] = useState('')
  const [minBuy, setMinBuy] = useState('')
  const [maxBuy, setMaxBuy] = useState('75000')

  const [col, setCol] = useState<SortKey>('profit_per_min')
  const [dir, setDir] = useState<'asc' | 'desc'>('desc')
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  async function fetchData() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/flipping`, { cache: 'no-store' })
      if (!res.ok) throw new Error(`API ${res.status}`)
      const data: ApiResp = await res.json()
      setRows(data.items ?? [])
      setLastUpdated(Date.now())
      setPage(1)
    } catch (e: any) {
      setError(e?.message ?? 'Error')
      setRows([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
    const id = setInterval(fetchData, REFRESH_MS)
    return () => clearInterval(id)
  }, [])

  const computed = rows.map(r => {
    const buy = r.best_buy_price
    const sell = r.best_sell_price
    const spread = buy != null && sell != null ? sell - buy : null
    const net = r.net_profit ?? (buy != null && sell != null ? (sell * 0.9 - buy) : null)
    const buysPerMin  = (r.buys_5m ?? 0) / 5
    const sellsPerMin = (r.sells_5m ?? 0) / 5
    const rate = Math.min(buysPerMin, sellsPerMin)
    const profit_per_min = net != null ? net * rate : null
    return { ...r, _buy: buy, _sell: sell, _spread: spread, net_profit: net, profit_per_min }
  })

  const filtered = computed.filter(r => {
    if (r._sell == null) return false
    const ci = (s?: string | null) => (s ?? '').toLowerCase()
    if (name && !ci(r.name).includes(name.toLowerCase())) return false
    if (rarity && ci(r.rarity) !== rarity.toLowerCase()) return false
    if (team && !ci(r.team).includes(team.toLowerCase())) return false
    if (position && ci(r.display_position) !== position.toLowerCase()) return false
    const rankNum = typeof r.rank === 'number' ? r.rank : (r.rank != null ? Number(r.rank) : null)
    if (minRank && rankNum != null && rankNum < Number(minRank)) return false
    if (maxRank && rankNum != null && rankNum > Number(maxRank)) return false
    if (minSell && r._sell != null && r._sell < Number(minSell)) return false
    if (maxSell && r._sell != null && r._sell > Number(maxSell)) return false
    if (minBuy  && r._buy  != null && r._buy  < Number(minBuy))  return false
    if (maxBuy  && r._buy  != null && r._buy  > Number(maxBuy))  return false
    return true
  })

  function numOrNull(v: any) {
    if (v == null || v === '') return null
    if (typeof v === 'number') return v
    const n = Number(v)
    return Number.isFinite(n) ? n : null
  }

  function val(x: any, k: SortKey): number | string | null {
    const v = x[k]
    const n = numOrNull(v)
    return n !== null ? n : (typeof v === 'string' ? v : null)
  }

  function compare(a: any, b: any): number {
    const av = val(a, col)
    const bv = val(b, col)
    const m = dir === 'asc' ? 1 : -1
    if (av == null && bv == null) return 0
    if (av == null) return 1
    if (bv == null) return -1
    if (typeof av === 'number' && typeof bv === 'number') return m * (av - bv)
    return m * String(av).localeCompare(String(bv), undefined, { sensitivity: 'base' })
  }

  const sorted = filtered.slice().sort(compare)

  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE))
  const start = (page - 1) * PAGE_SIZE
  const pageRows = sorted.slice(start, start + PAGE_SIZE)

  function fmt(n: number | string | null | undefined, opts?: { digits?: number }) {
    if (n === null || n === undefined || n === '') return '—'
    const digits = opts?.digits ?? 0
    if (typeof n === 'number') return n.toLocaleString(undefined, { maximumFractionDigits: digits })
    const num = Number(n)
    return Number.isFinite(num) ? num.toLocaleString(undefined, { maximumFractionDigits: digits }) : '—'
  }

  function fmtPct(n: number | null | undefined, digits = 2) {
    if (n == null) return '—'
    return `${n.toLocaleString(undefined, { 
      maximumFractionDigits: digits, 
      minimumFractionDigits: digits,
      signDisplay: 'exceptZero'
    })}%`
  }

  function onSort(k: SortKey) {
    if (col === k) setDir(d => (d === 'asc' ? 'desc' : 'asc'))
    else {
      setCol(k)
      const numeric: SortKey[] = [
        'best_buy_price','best_sell_price','_spread','net_profit',
        'buys_5m','sells_5m','volume_5m','profit_per_min',
        'delta_buy_1h','delta_buy_1d','delta_buy_1w','delta_buy_1m'
      ]
      setDir(numeric.includes(k) ? 'desc' : 'asc')
    }
  }

  function H(label: string, k: SortKey) {
    const arrow = col === k ? (dir === 'asc' ? ' ▲' : ' ▼') : ''
    return (
      <th onClick={() => onSort(k)} style={{ cursor: 'pointer' }}>
        {label}{arrow}
      </th>
    )
  }

  const deltaClass = (v: number | null | undefined) =>
    v == null ? styles.zero : v > 0 ? styles.pos : v < 0 ? styles.neg : styles.zero

  return (
    <div className={styles.wrap}>
      <div className={styles.headerContainer}>
        <h1 className={styles.title}>Market Flipping</h1>
        <div className={styles.headerControls}>
          <button className={styles.refreshButton} onClick={fetchData} disabled={loading}>
            {loading ? 'Refreshing...' : 'Refresh Now'}
          </button>
          {!!lastUpdated && (
            <span className={styles.status}>
              Updated: {new Date(lastUpdated).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
          )}
        </div>
      </div>
  
      <div className={styles.filtersContainer}>
        <div className={styles.filtersHeader} onClick={() => setFiltersCollapsed(!filtersCollapsed)}>
          <h2 className={styles.filtersTitle}>
            <span>Filters</span>
            <span className={styles.collapseIcon}>{filtersCollapsed ? '+' : '-'}</span>
          </h2>
        </div>
  
        <div className={`${styles.filters} ${filtersCollapsed ? styles.collapsed : ''}`}>
          <div className={styles.filterGrid}>
            <div className={styles.filterGroup}>
              <label>Name</label>
              <input value={name} onChange={e => { setName(e.target.value); setPage(1) }} placeholder="Search" />
            </div>
            
            <div className={styles.filterGroup}>
              <label>Rarity</label>
              <select value={rarity} onChange={e => { setRarity(e.target.value); setPage(1) }}>
                <option value="">Any</option>
                <option value="diamond">Diamond</option>
                <option value="gold">Gold</option>
                <option value="silver">Silver</option>
                <option value="bronze">Bronze</option>
                <option value="common">Common</option>
              </select>
            </div>
            
            <div className={styles.filterGroup}>
              <label>Team</label>
              <input value={team} onChange={e => { setTeam(e.target.value); setPage(1) }} placeholder="Team" />
            </div>
            
            <div className={styles.filterGroup}>
              <label>Position</label>
              <input value={position} onChange={e => { setPosition(e.target.value); setPage(1) }} placeholder="Position" />
            </div>
            
            <div className={styles.filterGroup}>
              <label>Rank Range</label>
              <div className={styles.rangeInputs}>
                <input type="number" value={minRank} onChange={e => { setMinRank(e.target.value); setPage(1) }} placeholder="Min" />
                <span>to</span>
                <input type="number" value={maxRank} onChange={e => { setMaxRank(e.target.value); setPage(1) }} placeholder="Max" />
              </div>
            </div>
            
            <div className={styles.filterGroup}>
              <label>Sell Price Range</label>
              <div className={styles.rangeInputs}>
                <div style={{ position: 'relative', display: 'inline-block' }}>
                  <span style={{ position: 'absolute', left: '8px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}>
                    <StubsIcon />
                  </span>
                  <input type="number" value={minSell} onChange={e => { setMinSell(e.target.value); setPage(1) }} placeholder="Min" style={{ paddingLeft: '24px' }} />
                </div>
                <span>to</span>
                <div style={{ position: 'relative', display: 'inline-block' }}>
                  <span style={{ position: 'absolute', left: '8px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}>
                    <StubsIcon />
                  </span>
                  <input type="number" value={maxSell} onChange={e => { setMaxSell(e.target.value); setPage(1) }} placeholder="Max" style={{ paddingLeft: '24px' }} />
                </div>
              </div>
            </div>
            
            <div className={styles.filterGroup}>
              <label>Buy Price Range</label>
              <div className={styles.rangeInputs}>
                <div style={{ position: 'relative', display: 'inline-block' }}>
                  <span style={{ position: 'absolute', left: '8px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}>
                    <StubsIcon />
                  </span>
                  <input type="number" value={minBuy} onChange={e => { setMinBuy(e.target.value); setPage(1) }} placeholder="Min" style={{ paddingLeft: '24px' }} />
                </div>
                <span>to</span>
                <div style={{ position: 'relative', display: 'inline-block' }}>
                  <span style={{ position: 'absolute', left: '8px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}>
                    <StubsIcon />
                  </span>
                  <input type="number" value={maxBuy} onChange={e => { setMaxBuy(e.target.value); setPage(1) }} placeholder="Max" style={{ paddingLeft: '24px' }} />
                </div>
              </div>
            </div>
          </div>
          
          <div className={styles.filterActions}>
            <button className={styles.applyButton} onClick={() => setPage(1)}>
              Apply Filters
            </button>
            <button className={styles.resetButton} onClick={() => {
              setName('')
              setRarity('')
              setTeam('')
              setPosition('')
              setMinRank('')
              setMaxRank('')
              setMinSell('600')
              setMaxSell('')
              setMinBuy('')
              setMaxBuy('75000')
              setPage(1)
            }}>
              Reset
            </button>
          </div>
        </div>
      </div>
  
      <div className={styles.topbar}>
        <div className={styles.pagination}>
          <button disabled={page <= 1} onClick={() => setPage(p => Math.max(1, p - 1))}>Prev</button>
          <span>Page {page} of {totalPages}</span>
          <button disabled={page >= totalPages} onClick={() => setPage(p => Math.min(totalPages, p + 1))}>Next</button>
        </div>
        <div className={styles.resultInfo}>
          Showing {Math.min(PAGE_SIZE, pageRows.length)} of {filtered.length} items
        </div>
      </div>
  
      <div className={styles.tableContainer}>
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                {H('Item','name')}
                {H('Buy','best_buy_price')}
                {H('Sell','best_sell_price')}
                {!isMobile && H('Spread','_spread')}
                {!isMobile && H('Profit','net_profit')}
                {H('Trend','delta_buy_1h')}
                {!isMobile && H('Buys','buys_5m')}
                {!isMobile && H('Sells','sells_5m')}
                {!isMobile && H('Vol','volume_5m')}
                {H('Profit/Min','profit_per_min')}
              </tr>
            </thead>
            <tbody>
              {pageRows.map((r, i) => (
                <tr key={`${r.id ?? r.name}-${i}`}>
                  <td className={styles.nameCell}>
                    {r.image && <img className={styles.thumb} src={r.image} alt="" />}
                    <div className={styles.itemInfo}>
                      <div className={styles.itemName}>{r.name ?? '—'}</div>
                      {isMobile && (
                        <div className={styles.mobileMeta}>
                          <span className={styles.mobileRarity}>{r.rarity}</span>
                          <span>{r.team}</span>
                          <span>{r.display_position}</span>
                        </div>
                      )}
                    </div>
                  </td>
                  <td className={styles.priceCell}><StubsIcon />{fmt((r as any)._buy)}</td>
                  <td className={styles.priceCell}><StubsIcon />{fmt((r as any)._sell)}</td>
                  
                  {!isMobile && (
                    <td className={styles.spreadCell}>
                      <StubsIcon />{fmt((r as any)._spread)}
                    </td>
                  )}
                  
                  {!isMobile && (
                    <td className={styles.profitCell}>
                      <StubsIcon />{fmt(r.net_profit, { digits: 0 })}
                    </td>
                  )}
                  
                  <td className={styles.trendCell}>
                    <div className={styles.trendGrid}>
                      <div>
                        <span>1H:</span>
                        <span className={deltaClass(r.delta_buy_1h)}>{fmtPct(r.delta_buy_1h)}</span>
                      </div>
                      <div>
                        <span>1D:</span>
                        <span className={deltaClass(r.delta_buy_1d)}>{fmtPct(r.delta_buy_1d)}</span>
                      </div>
                      <div>
                        <span>1W:</span>
                        <span className={deltaClass(r.delta_buy_1w)}>{fmtPct(r.delta_buy_1w)}</span>
                      </div>
                      <div>
                        <span>1M:</span>
                        <span className={deltaClass(r.delta_buy_1m)}>{fmtPct(r.delta_buy_1m)}</span>
                      </div>
                    </div>
                  </td>
                  
                  {!isMobile && <td>{fmt(r.buys_5m ?? null)}</td>}
                  {!isMobile && <td>{fmt(r.sells_5m ?? null)}</td>}
                  {!isMobile && <td>{fmt(r.volume_5m ?? null)}</td>}
                  
                  <td className={styles.profitPerMinCell}>
                    <StubsIcon />{fmt((r as any).profit_per_min ?? null, { digits: 2 })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          
          {!loading && !error && pageRows.length === 0 && (
            <div className={styles.empty}>
              <div>No results found</div>
              <div>Try adjusting your filters</div>
            </div>
          )}
        </div>
      </div>
  
      <div className={styles.paginationBottom}>
        <button disabled={page <= 1} onClick={() => setPage(p => Math.max(1, p - 1))}>Prev</button>
        <span>Page {page} of {totalPages}</span>
        <button disabled={page >= totalPages} onClick={() => setPage(p => Math.min(totalPages, p + 1))}>Next</button>
      </div>
  
      <div className={styles.infoSection}>
        <h2 className={styles.infoTitle}>
          <span>Market Flipping Guide</span>
        </h2>
        <div className={styles.infoContent}>
          <div className={styles.infoColumn}>
            <h3>How It Works</h3>
            <ul className={styles.infoList}>
              <li><strong>Buy Price</strong> - Lowest selling price</li>
              <li><strong>Sell Price</strong> - Highest buying price</li>
              <li><strong>Spread</strong> - Profit potential before fees</li>
              <li><strong>Net Profit</strong> - Profit after 10% transaction fee</li>
              <li><strong>Volume (5m)</strong> - Recent transaction activity</li>
            </ul>
          </div>
          
          <div className={styles.infoColumn}>
            <h3>Strategy Tips</h3>
            <ul className={styles.infoList}>
              <li>Focus on high <strong>Profit/Min</strong> items</li>
              <li>Look for positive price trends (<span className={styles.pos}>↑</span>)</li>
              <li>Avoid items with negative spreads</li>
              <li>Check volume to ensure liquidity</li>
              <li>Refresh data regularly for updates</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  )
}