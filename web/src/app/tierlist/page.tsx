'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import styles from './page.module.css'

type Metric = 'ovr' | 'true_ovr' | 'meta_ovr'

type Card = {
  id: string | number | null
  name: string | null
  team?: string | null
  primary_position?: string | null
  positions: string[]
  ovr: number | null
  true_ovr?: number | null
  meta_ovr?: number | null
  series?: string | null
  image?: string | null
}

type Tier = {
  id: string
  name: string
  color: string
  cards: Card[]
}

const POSITIONS = ['ALL','C','1B','2B','3B','SS','LF','CF','RF','DH','SP','RP','CP'] as const
const n = (v: any, d = 0) => (typeof v === 'number' && Number.isFinite(v) ? v : d)
const scoreByMetric = (c: Card, metric: Metric) =>
  metric === 'ovr' ? n(c.ovr, -1) : metric === 'true_ovr' ? n(c.true_ovr ?? c.ovr, -1) : n(c.meta_ovr, -1)

export default function TierlistPage() {
  const [listName, setListName] = useState('My Tier List')
  const [tiers, setTiers] = useState<Tier[]>([
    { id: 'S', name: 'S Tier', color: '#db2777', cards: [] },
    { id: 'A', name: 'A Tier', color: '#ef4444', cards: [] },
    { id: 'B', name: 'B Tier', color: '#f59e0b', cards: [] },
    { id: 'C', name: 'C Tier', color: '#22c55e', cards: [] },
    { id: 'D', name: 'D Tier', color: '#3b82f6', cards: [] },
  ])
  const [pool, setPool] = useState<Card[]>([])

  // modal
  const [modalOpen, setModalOpen] = useState(false)

  // filters (realtime)
  const [metric, setMetric] = useState<Metric>('true_ovr')
  const [q, setQ] = useState('')
  const [position, setPosition] = useState<string>('ALL')
  const [min, setMin] = useState<string>('')     // empty = no lower bound
  const [max, setMax] = useState<string>('1000') // broad upper bound
  const [seriesOptions, setSeriesOptions] = useState<string[]>([])
  const [seriesSel, setSeriesSel] = useState<string[]>([])

  // results
  const [results, setResults] = useState<Card[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // drag state
  const dragCard = useRef<{ id: string, from: 'pool' | { tierId: string, index: number } } | null>(null)
  const dragOverTier = useRef<string | null>(null)
  const dragOverIndex = useRef<number | null>(null)

  const inPoolIds = useMemo(() => new Set(pool.map(c => String(c.id))), [pool])
  const inTiersIds = useMemo(() => {
    const ids = new Set<string>()
    for (const t of tiers) for (const c of t.cards) ids.add(String(c.id))
    return ids
  }, [tiers])

  /* ---------- series list ---------- */
  useEffect(() => {
    (async () => {
      try {
        const r = await fetch('/api/tierlist?series_list=1', { cache: 'no-store' })
        const j = await r.json()
        if (Array.isArray(j?.series)) setSeriesOptions(j.series)
      } catch {
        setSeriesOptions([])
      }
    })()
  }, [])

  /* ---------- realtime search ---------- */
  const debRef = useRef<NodeJS.Timeout | null>(null)
  async function runSearch(limit = 30) {
    setLoading(true); setError(null)
    try {
      const params = new URLSearchParams()
      if (q.trim()) params.set('q', q.trim())
      if (position && position !== 'ALL') params.set('position', position)
      if (seriesSel.length > 0) params.set('series', seriesSel.join(','))
      if (min.trim()) params.set('min', min.trim())
      if (max.trim()) params.set('max', max.trim())
      params.set('metric', metric)
      params.set('limit', String(limit))

      const res = await fetch(`/api/tierlist?${params.toString()}`, { cache: 'no-store' })
      if (!res.ok) throw new Error(`API ${res.status}`)
      const j = await res.json()
      setResults(Array.isArray(j?.items) ? j.items : [])
      setTotal(Number(j?.total || 0))
    } catch (e: any) {
      setError(e?.message ?? 'Error'); setResults([]); setTotal(0)
    } finally {
      setLoading(false)
    }
  }
  useEffect(() => {
    if (!modalOpen) return
    if (debRef.current) clearTimeout(debRef.current)
    debRef.current = setTimeout(() => runSearch(30), q ? 250 : 0)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modalOpen, q, position, metric, min, max, seriesSel])

  /* ---------- pool helpers ---------- */
  function addToPool(c: Card) {
    const id = String(c.id)
    if (inPoolIds.has(id) || inTiersIds.has(id)) return
    setPool(prev => [c, ...prev])
  }
  async function addAllFromFilter() {
    if (total > 50) return
    const params = new URLSearchParams()
    if (q.trim()) params.set('q', q.trim())
    if (position && position !== 'ALL') params.set('position', position)
    if (seriesSel.length > 0) params.set('series', seriesSel.join(','))
    if (min.trim()) params.set('min', min.trim())
    if (max.trim()) params.set('max', max.trim())
    params.set('metric', metric)
    params.set('limit', '500')

    try {
      const res = await fetch(`/api/tierlist?${params.toString()}`, { cache: 'no-store' })
      const j = await res.json()
      const all: Card[] = Array.isArray(j?.items) ? j.items : []
      if (all.length > 50) { alert('More than 50 results. Narrow filters.'); return }
      const fresh = all.filter(c => !inPoolIds.has(String(c.id)) && !inTiersIds.has(String(c.id)))
      setPool(prev => [...fresh, ...prev])
    } catch {}
  }

  function moveToPool(card: Card) {
    const id = String(card.id)
    if (inPoolIds.has(id)) return
    setTiers(prev => prev.map(t => ({ ...t, cards: t.cards.filter(c => String(c.id) !== id) })))
    setPool(prev => [card, ...prev])
  }
  
  function moveToTier(card: Card, tierId: string, insertIndex?: number) {
    const id = String(card.id)
    setPool(prev => prev.filter(c => String(c.id) !== id))
    setTiers(prev => prev.map(t => {
      // Remove from any tier
      const filteredCards = t.cards.filter(c => String(c.id) !== id)
      
      if (t.id === tierId) {
        // Insert at specific position if provided
        if (insertIndex !== undefined) {
          const newCards = [...filteredCards]
          newCards.splice(insertIndex, 0, card)
          return { ...t, cards: newCards }
        }
        // Otherwise add to end
        return { ...t, cards: [card, ...filteredCards] }
      }
      return { ...t, cards: filteredCards }
    }))
  }

  /* ---------- DnD ---------- */
  function onDragStartFromPool(card: Card) { 
    dragCard.current = { id: String(card.id), from: 'pool' } 
  }
  
  function onDragStartFromTier(card: Card, tierId: string, index: number) { 
    dragCard.current = { id: String(card.id), from: { tierId, index } } 
  }
  
  function onDragEnd() { 
    dragCard.current = null 
    dragOverTier.current = null
    dragOverIndex.current = null
  }
  
  function allowDrop(e: React.DragEvent) { e.preventDefault() }
  
  function dropOnPool() {
    const d = dragCard.current; if (!d) return
    const id = d.id
    const card = tiers.flatMap(t => t.cards).concat(pool).find(c => String(c.id) === id)
    if (!card) return
    moveToPool(card); dragCard.current = null
  }
  
  function dropOnTier(tierId: string) {
    const d = dragCard.current; if (!d) return
    const id = d.id
    const card = tiers.flatMap(t => t.cards).concat(pool).find(c => String(c.id) === id)
    if (!card) return
    
    // Handle within-tier reordering
    if (d.from !== 'pool' && d.from.tierId === tierId) {
      if (dragOverIndex.current !== null) {
        setTiers(prev => prev.map(t => {
          if (t.id !== tierId) return t
          
          // Remove from original position
          const filtered = t.cards.filter(c => String(c.id) !== id)
          
          // Insert at new position
          const newCards = [...filtered]
          newCards.splice(dragOverIndex.current!, 0, card)
          return { ...t, cards: newCards }
        }))
      }
    } 
    // Handle move between tiers
    else {
      moveToTier(card, tierId, dragOverIndex.current ?? undefined)
    }
    
    dragCard.current = null
    dragOverTier.current = null
    dragOverIndex.current = null
  }
  
  function onDragOverTier(tierId: string, index: number) {
    dragOverTier.current = tierId
    dragOverIndex.current = index
  }

  /* ---------- tier editing ---------- */
  function addTier() {
    const id = `T${Math.random().toString(36).slice(2,7)}`
    const palette = ['#be123c','#dc2626','#ea580c','#ca8a04','#16a34a','#0ea5e9','#7c3aed','#0891b2']
    setTiers(prev => [...prev, { id, name: 'New Tier', color: palette[Math.floor(Math.random()*palette.length)], cards: [] }])
  }
  
  function removeTier(id: string) {
    if (tiers.length <= 1) return
    const tier = tiers.find(t => t.id === id)
    if (!tier) return
    
    if (confirm(`Are you sure you want to delete the "${tier.name}" tier?`)) {
      setPool(prev => [...tier.cards, ...prev])
      setTiers(prev => prev.filter(t => t.id !== id))
    }
  }
  
  function renameTier(id: string, name: string) { 
    setTiers(prev => prev.map(t => t.id === id ? { ...t, name } : t)) 
  }
  
  function recolorTier(id: string, color: string) { 
    setTiers(prev => prev.map(t => t.id === id ? { ...t, color } : t)) 
  }

  const eligibleToAddAll = total > 0 && total <= 50
  const showingLabel = `Showing ${Math.min(results.length, 30)} of ${total} results`

  return (
    <div className={styles.wrap}>
      <header className={styles.header}>
        <div className={styles.titleBlock}>
          <h1 className={styles.title}>Tierlist Maker</h1>
          <input
            className={styles.listName}
            value={listName}
            onChange={e => setListName(e.target.value)}
            placeholder="Tierlist name"
          />
        </div>
        <div className={styles.topActions}>
          <button className={styles.addTierBtn} onClick={addTier}>+ Add Tier</button>
          <button className={styles.addPlayersBtn} onClick={() => setModalOpen(true)}>+ Add Players</button>
        </div>
      </header>

      {/* Pool moved to top */}
      <section className={styles.poolSection}>
        <div className={styles.poolHeader}>
          <h2 className={styles.sectionTitle}>Card Pool</h2>
          <div className={styles.poolMeta}>Drag a card into a tier • {pool.length} in pool</div>
        </div>

        <div
          className={styles.poolDrop}
          onDragOver={allowDrop}
          onDrop={dropOnPool}
          title="Drop here to return to pool"
        >
          <div className={styles.poolGrid}>
            {pool.map(c => (
              <div
                key={String(c.id)}
                className={styles.cardThumb}
                draggable
                onDragStart={() => onDragStartFromPool(c)}
                onDragEnd={onDragEnd}
                title={c.name ?? ''}
              >
                {c.image ? <img src={c.image} alt="" /> : <div className={styles.noImg}>No Image</div>}
                <div className={styles.tagRow}>
                  {(c.positions || []).slice(0,3).map(p => <span key={p} className={styles.posTag}>{p}</span>)}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Tiers section */}
      <section className={styles.tiersSection}>
        {tiers.map(tier => (
          <div
            key={tier.id}
            className={styles.tierRow}
            onDragOver={allowDrop}
            onDrop={() => dropOnTier(tier.id)}
          >
            <div className={styles.tierLabel} style={{ background: tier.color }}>
              <div className={styles.tierLabelContent}>
                <input
                  className={styles.tierName}
                  value={tier.name}
                  onChange={e => renameTier(tier.id, e.target.value)}
                />
                <div className={styles.tierActions}>
                  <label className={styles.colorSwatch} style={{ background: tier.color }} title="Change color">
                    <input
                      className={styles.colorInput}
                      type="color"
                      value={tier.color}
                      onChange={e => recolorTier(tier.id, e.target.value)}
                    />
                  </label>
                  <button className={styles.removeTier} onClick={() => removeTier(tier.id)} title="Delete tier">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M3 6h18"></path>
                      <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"></path>
                      <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path>
                      <line x1="10" y1="11" x2="10" y2="17"></line>
                      <line x1="14" y1="11" x2="14" y2="17"></line>
                    </svg>
                  </button>
                </div>
              </div>
            </div>

            <div className={styles.dropArea}>
              {tier.cards.map((c, index) => (
                <div
                  key={String(c.id)}
                  className={styles.cardThumb}
                  draggable
                  onDragStart={() => onDragStartFromTier(c, tier.id, index)}
                  onDragOver={(e) => {
                    e.preventDefault();
                    onDragOverTier(tier.id, index);
                  }}
                  onDragEnd={onDragEnd}
                  title={c.name ?? ''}
                >
                  {c.image ? <img src={c.image} alt="" /> : <div className={styles.noImg}>No Image</div>}
                  <div className={styles.tagRow}>
                    {(c.positions || []).slice(0,3).map(p => <span key={p} className={styles.posTag}>{p}</span>)}
                  </div>
                  <button className={styles.toPoolBtn} onClick={() => moveToPool(c)} title="Send back to pool">↩</button>
                </div>
              ))}
            </div>
          </div>
        ))}
      </section>

      {/* Modal */}
      {modalOpen && (
        <div className={styles.overlay} onClick={() => setModalOpen(false)}>
          <div className={styles.modal} onClick={e => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h3 className={styles.modalTitle}>Add Players</h3>
              <button className={styles.modalClose} onClick={() => setModalOpen(false)}>×</button>
            </div>

            <div className={styles.filtersRow}>
              <input
                className={styles.input}
                placeholder="Search name…"
                value={q}
                onChange={e => setQ(e.target.value)}
              />
              <select className={styles.select} value={position} onChange={e => setPosition(e.target.value)}>
                {POSITIONS.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
              <div className={styles.metricWrap}>
                <label>OVR:</label>
                <select className={styles.select} value={metric} onChange={e => setMetric(e.target.value as Metric)}>
                  <option value="ovr">OVR</option>
                  <option value="true_ovr">True OVR</option>
                  <option value="meta_ovr">Meta OVR</option>
                </select>
              </div>
              <input
                className={styles.numInput}
                type="number"
                placeholder="Min"
                value={min}
                onChange={e => setMin(e.target.value)}
                min={0}
              />
              <input
                className={styles.numInput}
                type="number"
                placeholder="Max"
                value={max}
                onChange={e => setMax(e.target.value)}
                min={0}
              />
            </div>

            <div className={styles.seriesBox}>
              <div className={styles.seriesHeader}>
                <div className={styles.seriesTitle}>Series</div>
                <div className={styles.seriesActions}>
                  <button className={styles.seriesActionBtn} onClick={() => setSeriesSel(seriesOptions.slice(0))}>Select All</button>
                  <button className={styles.seriesActionBtn} onClick={() => setSeriesSel([])}>Clear</button>
                </div>
              </div>
              <div className={styles.seriesList}>
                {seriesOptions.length === 0 ? (
                  <div className={styles.empty}>No series found.</div>
                ) : seriesOptions.map(s => (
                  <label key={s} className={styles.seriesItem}>
                    <input
                      type="checkbox"
                      checked={seriesSel.includes(s)}
                      onChange={(e) => {
                        if (e.target.checked) setSeriesSel(prev => prev.includes(s) ? prev : [...prev, s])
                        else setSeriesSel(prev => prev.filter(x => x !== s))
                      }}
                    />
                    <span>{s}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className={styles.resultsHeader}>
              <div className={styles.resultsMeta}>{showingLabel}</div>
              <div className={styles.resultsBtns}>
                <button className={styles.addAllBtn} onClick={addAllFromFilter} disabled={!eligibleToAddAll}>
                  Add All ({total})
                </button>
              </div>
            </div>

            <div className={styles.resultsWrap}>
              {loading ? (
                <div className={styles.loadingRow}><div className={styles.spinner} /> Loading…</div>
              ) : error ? (
                <div className={styles.error}>Error: {error}</div>
              ) : results.length > 0 ? (
                <table className={styles.resultsTable}>
                  <thead>
                    <tr>
                      <th>Card</th>
                      <th>Name</th>
                      <th>Team</th>
                      <th>Positions</th>
                      <th>Series</th>
                      <th className={styles.right}>Score</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {results.map(r => {
                      const id = String(r.id)
                      const disabled = inPoolIds.has(id) || inTiersIds.has(id)
                      return (
                        <tr key={id}>
                          <td className={styles.cellImg}>
                            {r.image ? <img src={r.image} alt="" /> : <div className={styles.noImgSmall}>No Image</div>}
                          </td>
                          <td>{r.name}</td>
                          <td className={styles.center}>{r.team ?? '—'}</td>
                          <td>
                            <div className={styles.posChipRow}>
                              {(r.positions || []).slice(0, 8).map(p => <span className={styles.posChip} key={p}>{p}</span>)}
                            </div>
                          </td>
                          <td className={styles.center}>{r.series ?? '—'}</td>
                          <td className={styles.right}>
                            <b>{scoreByMetric(r, metric).toFixed(1)}</b>
                          </td>
                          <td className={styles.right}>
                            <button className={styles.addBtn} onClick={() => addToPool(r)} disabled={disabled}>
                              {disabled ? 'Added' : 'Add'}
                            </button>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              ) : (
                <div className={styles.empty}>No results. Adjust filters.</div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}