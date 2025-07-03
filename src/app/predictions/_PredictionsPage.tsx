// src/app/predictions/page.tsx
'use client'

import React, { useState, useEffect, useMemo } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import styles from './page.module.css'
import { FaSpinner } from 'react-icons/fa'
import Image from 'next/image'

interface Card {
  id: string
  name: string
  ovr: number
  rarity: string
  is_hitter: boolean | string
  baked_img?: string

  delta_rank_low: number
  delta_rank_pred: number
  delta_rank_high: number

  predicted_rank_low: number
  predicted_rank: number
  predicted_rank_high: number

  confidence_percentage: number

  market_price?: number

  qs_actual: number
  qs_pred_low: number
  qs_pred: number
  qs_pred_high: number

  predicted_profit_low: number
  predicted_profit: number
  predicted_profit_high: number
  predicted_ev_profit: number
  predicted_profit_pct: number

  [key: string]: string | number | boolean | undefined
}

const DEFAULT_KEYS = [
  'card',
  'name',
  'ovr',
  'delta_rank_pred',
  'confidence_percentage',
  'market_price',
  'qs_pred',
  'predicted_profit',
  'predicted_profit_pct',
]

// define your column groups
const COLUMN_GROUPS = [
  {
    group: 'details',
    label: 'Details',
    cols: [
      { key: 'card', label: 'Card' },
      { key: 'name', label: 'Name' },
      { key: 'team', label: 'Team' },
      { key: 'team_short_name', label: 'Team (abbr)' },
      { key: 'display_position', label: 'Pos' },
      { key: 'age', label: 'Age' },
      { key: 'ovr', label: 'Current Overall' },
    ]
  },
  {
    group: 'predictions',
    label: 'Predictions',
    cols: [
      { key: 'delta_rank_low',      label: 'Change In Rank Low' },
      { key: 'delta_rank_pred',     label: 'Change In Rank Predicted' },
      { key: 'delta_rank_high',     label: 'Change In Rank High' },
      { key: 'predicted_rank_low',  label: 'Predicted Rank Low' },
      { key: 'predicted_rank',      label: 'Predicted Rank' },
      { key: 'predicted_rank_high', label: 'Predicted Rank High' },
      { key: 'confidence_percentage', label: 'Confidence %' },
    ]
  },
  {
    group: 'market',
    label: 'Market',
    cols: [
      { key: 'qs_actual',            label: 'Current QS' },
      { key: 'qs_pred_low',          label: 'QS Predicted Low' },
      { key: 'qs_pred',              label: 'QS Predicted' },
      { key: 'qs_pred_high',         label: 'QS Predicted High' },
      { key: 'market_price',         label: 'Current Price' },
      { key: 'predicted_profit_low',  label: 'Predicted Profit Low' },
      { key: 'predicted_profit',      label: 'Predicted Profit' },
      { key: 'predicted_profit_high', label: 'Predicted Profit High' },
      { key: 'predicted_ev_profit',   label: 'Expected Profit' },
      { key: 'predicted_profit_pct',  label: 'Profit %' },
    ]
  }
]

// list of detail‐group keys
const DETAILS_KEYS = COLUMN_GROUPS
  .find(g => g.group === 'details')!
  .cols.map(c => c.key)

// human‐friendly labels
const LABELS: Record<string,string> = {}
COLUMN_GROUPS.forEach(g =>
  g.cols.forEach(c => { LABELS[c.key] = c.label })
)

// detailed descriptions for tooltip
const DESCRIPTIONS: Record<string,string> = {
  card:                   'Card image linking to the player detail page.',
  name:                   'Player’s full name.',
  team:                   'Full name of the player’s team.',
  team_short_name:        'Abbreviated team name.',
  display_position:       'Player’s primary position.',
  age:                    'Player’s age in years.',
  ovr:                    'Current overall rating of the player.',
  delta_rank_low:         'Lower bound of the predicted change in overall rank.',
  delta_rank_pred:        'Model’s predicted change in overall rank.',
  delta_rank_high:        'Upper bound of the predicted change in overall rank.',
  predicted_rank_low:     'Lower bound of the predicted overall rank.',
  predicted_rank:         'Model’s predicted overall rank.',
  predicted_rank_high:    'Upper bound of the predicted overall rank.',
  confidence_percentage:  'Confidence level based on prediction interval width.',
  qs_actual:              'Quick-sell value for the current overall rating.',
  qs_pred_low:            'Quick-sell value for the lower bound of predicted rank.',
  qs_pred:                'Quick-sell value for the predicted rank.',
  qs_pred_high:           'Quick-sell value for the upper bound of predicted rank.',
  market_price:           'Current market (sell) price of the card.',
  predicted_profit_low:   'Profit if the lower-bound QS value is realized.',
  predicted_profit:       'Profit based on the predicted QS value.',
  predicted_profit_high:  'Profit if the upper-bound QS value is realized.',
  predicted_ev_profit:    'Expected profit across the prediction distribution.',
  predicted_profit_pct:   'Profit percentage relative to current market price.',
}

// Helper functions for URL state management
const encodeColumns = (cols: string[]) => cols.join(',')
const decodeColumns = (str: string) => str ? str.split(',') : DEFAULT_KEYS

const updateURL = (router: ReturnType<typeof useRouter>, params: Record<string,string>) => {
  const url = new URL(window.location.href)
  Object.entries(params).forEach(([key, value]) => {
    if (value && value !== 'all' && value !== '0' && value !== '25') {
      url.searchParams.set(key, value)
    } else {
      url.searchParams.delete(key)
    }
  })
  router.replace(url.pathname + url.search, { scroll: false })
}

export default function PredictionsPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  
  const [cards, setCards] = useState<Card[]>([])
  const [loading, setLoading] = useState(true)

  // Initialize state from sessionStorage first, then URL parameters
  const getInitialState = () => {
    if (typeof window === 'undefined') return null
    try {
      const saved = sessionStorage.getItem('predictions-state')
      return saved ? JSON.parse(saved) : null
    } catch {
      return null
    }
  }

  const savedState = getInitialState()

  const paramRarity = searchParams.get('rarity')
  const initialRarity = savedState?.rarity || (paramRarity === "all" || paramRarity === "common" || paramRarity === 'bronze' || paramRarity === 'silver' || paramRarity === 'gold' || paramRarity === 'diamond' ?
    paramRarity : 'all')
  const [rarity, setRarity] = useState<typeof initialRarity>(initialRarity)

  const paramType = searchParams.get('type')
  const initialTypeFilter = savedState?.typeFilter || (paramType === 'all' || paramType === 'hitters' || paramType === 'pitchers' ?
    paramType : 'all')
  const [typeFilter, setTypeFilter] = useState<typeof initialTypeFilter>(initialTypeFilter)
  const [search, setSearch] = useState(savedState?.search || searchParams.get('search') || '')
  const [columns, setColumns] = useState<string[]>(
    savedState?.columns || decodeColumns(searchParams.get('columns') || '')
  )
  const [sortKey, setSortKey] = useState<string | null>(
    savedState?.sortKey || searchParams.get('sort') || null
  )
  const [sortDesc, setSortDesc] = useState(
    savedState?.sortDesc !== undefined ? savedState.sortDesc : searchParams.get('desc') === 'true'
  )
  const [pageSize, setPageSize] = useState(
    savedState?.pageSize || parseInt(searchParams.get('size') || '25')
  )
  const [pageIndex, setPageIndex] = useState(
    savedState?.pageIndex || parseInt(searchParams.get('page') || '0')
  )

  const [tooltipOpen, setTooltipOpen] = useState<string|null>(null)
  const [openDropdown, setOpenDropdown] = useState<string|null>(null)

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Element
      if (!target.closest(`.${styles.columnDropdown}`)) {
        setOpenDropdown(null)
      }
    }

    if (openDropdown) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [openDropdown])

  // reorder helper
  const moveColumn = (colKey: string, delta: number) => {
    setColumns(cols => {
      const idx = cols.indexOf(colKey)
      if (idx < 0) return cols
      const newIdx = idx + delta
      if (newIdx < 0 || newIdx >= cols.length) return cols
      const copy = [...cols]
      copy.splice(idx, 1)
      copy.splice(newIdx, 0, colKey)
      return copy
    })
  }

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch('/api/cards/live')
        const data: Card[] = await res.json()
        setCards(data.map(c => ({
          ...c,
          is_hitter:
            c.is_hitter === true ||
            c.is_hitter === 'true' ||
            c.is_hitter === 'True'
        })))
      } catch (err) {
        console.error(err)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  // Save state to sessionStorage and sync to URL
  useEffect(() => {
    // Save to sessionStorage for instant state restoration
    const state = {
      rarity,
      typeFilter,
      search,
      columns,
      sortKey,
      sortDesc,
      pageSize,
      pageIndex
    }
    sessionStorage.setItem('predictions-state', JSON.stringify(state))

    // Also update URL for shareability
    updateURL(router, {
      rarity: rarity !== 'all' ? rarity : '',
      type: typeFilter !== 'all' ? typeFilter : '',
      search: search,
      columns: columns.join(',') !== DEFAULT_KEYS.join(',') ? encodeColumns(columns) : '',
      sort: sortKey || '',
      desc: sortDesc ? 'true' : '',
      size: pageSize !== 25 ? pageSize.toString() : '',
      page: pageIndex !== 0 ? pageIndex.toString() : ''
    })
  }, [router, rarity, typeFilter, search, columns, sortKey, sortDesc, pageSize, pageIndex])

  // 1) filter
  const filtered = useMemo(() => {
    return cards
      .filter(c => rarity === 'all' || c.rarity.toLowerCase() === rarity)
      .filter(c =>
        typeFilter === 'all' ||
        (typeFilter === 'hitters'  && c.is_hitter) ||
        (typeFilter === 'pitchers' && !c.is_hitter)
      )
      .filter(c => c.name.toLowerCase().includes(search.toLowerCase()))
  }, [cards, rarity, typeFilter, search])

  // 2) sort
  const sorted = useMemo(() => {
    if (!sortKey) return filtered
    return [...filtered].sort((a,b) => {
      const aValRaw = (a as Record<string, unknown>)[sortKey]
      const bValRaw = (b as Record<string, unknown>)[sortKey]

      // then:
      const aNum = typeof aValRaw === 'number' ? aValRaw : Number(aValRaw)
      const bNum = typeof bValRaw === 'number' ? bValRaw : Number(bValRaw)
      if (!isNaN(aNum) && !isNaN(bNum)) {
        const cmp = aNum > bNum ? 1 : -1
        return sortDesc ? -cmp : cmp
      }
      
      // Fall back to string comparison
      const cmp = aNum > bNum ? 1 : -1
      return sortDesc ? -cmp : cmp
    })
  }, [filtered, sortKey, sortDesc])

  // 3) paginate
  const pageCount = Math.ceil(sorted.length / pageSize)
  const paged     = sorted.slice(pageIndex * pageSize, (pageIndex+1)*pageSize)


  useEffect(() => {
    if (openDropdown && window.innerWidth <= 768) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    
    return () => {
      document.body.style.overflow = '';
    };
  }, [openDropdown]);

  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth > 768 && openDropdown) {
        setOpenDropdown(null);
      }
    };
  
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [openDropdown]);
  

  if (loading) {
    return (
      <div className="spinner-container">
        <FaSpinner className="spinner" />
      </div>
    )
  }

  return (
    <main className={styles.predictionsContainer}>
      <section className={styles.predictionsHero}>
        <h1 className={styles.heroTitle}>Player Predictions</h1>
      </section>

      <section className={styles.predictionsTableSection}>
        <div className={styles.tableHeader}>
          <div className={styles.controls}>
            {/* filters */}
            <div className={styles.filterGroup}>
              <label>Rarity:</label>
              <select
                value={rarity}
                onChange={e => {
                  const v = e.target.value as 'all'|'common'|'bronze'|'silver'|'gold'|'diamond'
                  setRarity(v)
                  setPageIndex(0)
                }}
              >
                <option value="all">All</option>
                <option value="common">Common</option>
                <option value="bronze">Bronze</option>
                <option value="silver">Silver</option>
                <option value="gold">Gold</option>
                <option value="diamond">Diamond</option>
              </select>

              <label>Type:</label>
              <select
                value={typeFilter}
                onChange={e => {
                  const v = e.target.value as 'all'|'hitters'|'pitchers'
                  setTypeFilter(v)
                  setPageIndex(0)
                }}
              >
                <option value="all">All</option>
                <option value="hitters">Hitters</option>
                <option value="pitchers">Pitchers</option>
              </select>

              <label>Search:</label>
              <input
                type="text"
                value={search}
                onChange={e => { setSearch(e.target.value); setPageIndex(0) }}
                placeholder="Player name…"
              />
            </div>

            {/* column toggles */}
            <div className={styles.columnDropdowns}>
              {COLUMN_GROUPS.map(group => {
                const keys = group.cols.map(c => c.key)
                const defaultKeysForGroup = keys.filter(k => DEFAULT_KEYS.includes(k))
                const currentKeysForGroup = keys.filter(k => columns.includes(k))
                const active = JSON.stringify(defaultKeysForGroup.sort()) !== JSON.stringify(currentKeysForGroup.sort())
                const isOpen = openDropdown === group.group
                return (
                  <div
                    key={group.group}
                    className={`${styles.columnDropdown} ${isOpen ? styles.open : ''}`}
                  >
                    <button
                      type="button"
                      className={`${styles.dropdownSummary} ${active ? styles.filterActive : ''}`}
                      onClick={() => setOpenDropdown(isOpen ? null : group.group)}
                    >
                      {group.label}
                    </button>
                    {isOpen && (
                      <div className={styles.dropdownContent}>
                        <button 
                          className={styles.mobileCloseButton}
                          onClick={() => setOpenDropdown(null)}
                        >
                          ×
                        </button>
                      <button
                        type="button"
                        className={styles.clearFilters}
                        onClick={() =>
                          setColumns(cs => cs.filter(k => !keys.includes(k)))
                        }
                      >× Clear All</button>
                      <input
                        type="text"
                        className={styles.columnSearch}
                        placeholder={`Search ${group.label}…`}
                      />
                      <div className={styles.columnGroup}>
                        {group.cols.map(col => {
                          const checked = columns.includes(col.key)
                          return (
                            <label key={col.key}>
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={e =>
                                  e.target.checked
                                    ? setColumns(cs => [...cs, col.key])
                                    : setColumns(cs => cs.filter(k => k !== col.key))
                                }
                              />
                              {col.label}
                              {checked && (
                                <>
                                  <button
                                    type="button"
                                    className={styles.columnMoveButton}
                                    onClick={() => moveColumn(col.key, -1)}
                                  >◀</button>
                                  <button
                                    type="button"
                                    className={styles.columnMoveButton}
                                    onClick={() => moveColumn(col.key, 1)}
                                  >▶</button>
                                </>
                              )}
                            </label>
                          )
                        })}
                      </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>

            {/* page size */}
            <div className={styles.paginationControls}>
              <label>Show</label>
              <select
                value={pageSize}
                onChange={e => { setPageSize(+e.target.value); setPageIndex(0) }}
              >
                {[10,25,50].map(n => (
                  <option key={n} value={n}>{n}</option>
                ))}
              </select>
              <span>per page</span>
            </div>
          </div>
        </div>

        {/* table */}
        <div className={styles.tableContainer}>
          <table className={styles.predictionsTable}>
            <thead>
              <tr>
                {columns.map(key => (
                  <th
                    key={key}
                    onClick={() => {
                      if (sortKey === key) setSortDesc((prev: boolean) => !prev)
                      else { setSortKey(key); setSortDesc(false) }
                    }}
                    className={
                      sortKey === key
                        ? sortDesc ? styles.sortedDesc : styles.sortedAsc
                        : ''
                    }
                  >
                    <div style={{ display: 'inline-flex', alignItems: 'center', position: 'relative' }}>
                      <span>{LABELS[key] ?? key}</span>
                      {!DETAILS_KEYS.includes(key) && (
                        <button
                          className={styles.tooltipBtn}
                          onClick={e => {
                            e.stopPropagation()
                            setTooltipOpen(open => open === key ? null : key)
                          }}
                        >?</button>
                      )}
                      {tooltipOpen === key && (
                        <div className={styles.tooltipPopup} onClick={e => e.stopPropagation()}>
                          {DESCRIPTIONS[key] || 'No description available.'}
                        </div>
                      )}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {paged.map(c => (
                <tr key={c.id} data-rarity={c.rarity.toLowerCase()}>
                  {columns.map(col => {
                    const raw = (c as Record<string, unknown>)[col]
                    let cell: string | number | undefined                    
                    
                    if (col.endsWith('_pct') || col === 'confidence_percentage') {
                      const num = typeof raw === 'number' ? raw : Number(raw)
                      cell = `${num.toFixed(1)}%`
                    } else {
                      if (raw == null) {
                        cell = undefined
                      } else if (typeof raw === 'number' || typeof raw === 'string') {
                        cell = raw
                      } else {
                        cell = String(raw)
                      }
                    }
                    return (
                      <td key={col} data-key={col}>
                        {col === 'card' ? (
                          <a href={`/player/${c.id}`}>
                            <img src={c.baked_img!} alt={c.name} className={styles.cardIcon}/>
                          </a>
                        ) : (
                          cell ?? '-'
                        )}
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* pagination nav */}
        <div className={styles.paginationNav}>
          <button
            disabled={pageIndex === 0}
            onClick={() => setPageIndex((prev: number) => Math.max(prev - 1, 0))}
          >Prev</button>
          <span>
            Page {pageIndex + 1} of {pageCount}
          </span>
          <button
            disabled={pageIndex + 1 >= pageCount}
            onClick={() => setPageIndex((prev: number) => Math.min(prev + 1, pageCount - 1))}
          >Next</button>
        </div>
      </section>
    </main>
  )
}
