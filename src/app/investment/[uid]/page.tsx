'use client'

import React, { useState, useEffect } from 'react'
import { useParams, useRouter }      from 'next/navigation'
import Link                          from 'next/link'
import styles                        from './page.module.css'
import { getAuth, onAuthStateChanged, type User } from 'firebase/auth'
import { doc, getDoc }               from 'firebase/firestore'
import { auth, db }                  from '@/lib/firebaseClient'

interface Investment {
  id: string
  playerUUID: string
  playerName: string
  quantity: number
  avgBuyPrice: number
  userProjectedOvr: number
  createdAt: string
}

interface Card {
  id: string
  name: string
  ovr: number | string
  market_price: number | string
  predicted_rank: number | string
  confidence_percentage: number | string
  qs_pred: number | string
  baked_img?: string
}

interface Profile {
  username: string
  profilePic: string
  investmentsPublic: boolean
}

export default function InvestmentPage() {
  const { uid }    = useParams() as { uid?: string }
  const router     = useRouter()
  const authClient = getAuth()

  // auth & ownership
  const [currentUser, setCurrentUser] = useState<User|null>(null)
  const [isOwner,      setIsOwner]    = useState(false)

  // profile & privacy
  const [profile,     setProfile]     = useState<Profile|null>(null)
  const [publicFlag,  setPublicFlag]  = useState(false)

  // investments & details
  const [inv,         setInv]         = useState<Investment[]>([])
  const [cardDetails, setCardDetails] = useState<Record<string,Card>>({})

  // loading state
  const [loading,     setLoading]     = useState(true)

  // — form state for adding —
  const [q,        setQ]        = useState('')
  const [matches,  setMatches]  = useState<Card[]>([])
  const [sel,      setSel]      = useState<Card|null>(null)
  const [qty,      setQty]      = useState('')
  const [avg,      setAvg]      = useState('')
  const [proj,     setProj]     = useState('')

  // — inline edit state —
  const [editingId,  setEditingId]  = useState<string|null>(null)
  const [deltaQty,   setDeltaQty]   = useState('0')
  const [unitPrice,  setUnitPrice]  = useState('')
  const [newOvr,     setNewOvr]     = useState('')

  // Quick‐sell mapping
  function qsValue(ovr: number): number {
    if (ovr < 65) return 5
    if (ovr < 75) return 25
    if (ovr === 75) return 50
    if (ovr === 76) return 75
    if (ovr === 77) return 100
    if (ovr === 78) return 125
    if (ovr === 79) return 150
    if (ovr === 80) return 400
    if (ovr === 81) return 600
    if (ovr === 82) return 900
    if (ovr === 83) return 1200
    if (ovr === 84) return 1500
    if (ovr === 85) return 3000
    if (ovr === 86) return 3750
    if (ovr === 87) return 4500
    if (ovr === 88) return 5500
    if (ovr === 89) return 7000
    if (ovr === 90) return 8000
    if (ovr === 91) return 9000
    return ovr >= 92 ? 10000 : 0
  }

  // 1) Listen for auth + determine ownership
  useEffect(() => {
    const unsub = onAuthStateChanged(authClient, u => {
      setCurrentUser(u)
      setIsOwner(u?.uid === uid)
    })
    return () => unsub()
  }, [authClient, uid])

  // 2) Load profile & privacy flag
  useEffect(() => {
    if (!uid) return
    getDoc(doc(db, 'users', uid)).then(snap => {
      if (!snap.exists()) {
        router.replace('/404')
        return
      }
      const data = snap.data() as any
      const pub  = data.investmentsPublic ?? false
      setProfile({
        username: data.username,
        profilePic: data.profilePic,
        investmentsPublic: pub
      })
      setPublicFlag(pub)
      if (!isOwner && !pub) {
        setLoading(false)
      }


    })
  }, [uid, router])

  // 3) Fetch investments (owner or public)
  useEffect(() => {
    if (profile === null) return
    // if this is someone else's private sheet, bail
    if (!isOwner && !publicFlag) {
      setLoading(false)
      return
    }
    async function loadInv() {
      let res: Response
      if (isOwner) {
        const token = await currentUser!.getIdToken()
        res = await fetch('/api/investments', {
          headers: { Authorization: `Bearer ${token}` }
        })
      } else {
        res = await fetch(`/api/users/${uid}/investments`)
      }
      if (res.ok) {
        setInv(await res.json())
      }
      setLoading(false)
    }
    loadInv()
  }, [profile, isOwner, publicFlag, currentUser, uid])

  // 4) Fetch card details for each investment
  useEffect(() => {
    if (inv.length === 0) return
    const ids = Array.from(new Set(inv.map(i => i.playerUUID)))
    Promise.all(
      ids.map(async id => {
        const res = await fetch(`/api/cards/${id}`)
        if (!res.ok) return null
        const data = (await res.json()) as Card
        return [id, data] as [string,Card]
      })
    ).then(pairs => {
      const m: Record<string,Card> = {}
      pairs.forEach(p => p && (m[p[0]] = p[1]))
      setCardDetails(m)
    })
  }, [inv])

  // 5) Autocomplete for the “Add” form
  useEffect(() => {
    if (sel) {
      setMatches([])
      return
    }
    if (!q) return setMatches([])
    fetch('/api/cards/live')
      .then(r => r.json())
      .then((all: Card[]) =>
        setMatches(
          all
            .filter(c => c.name.toLowerCase().includes(q.toLowerCase()))
            .slice(0, 5)
        )
      )
  }, [q])

  const canAdd = Boolean(sel && +qty > 0 && !isNaN(+avg) && !isNaN(+proj))

  // — Add new investment —
  async function add() {
    if (!sel || !currentUser) return
    const token = await currentUser.getIdToken()
    const res = await fetch('/api/investments', {
      method:'POST',
      headers:{
        'Content-Type':'application/json',
        Authorization:`Bearer ${token}`
      },
      body: JSON.stringify({
        playerUUID:       sel.id,
        playerName:       sel.name,
        quantity:         +qty,
        avgBuyPrice:      Math.round(+avg),
        userProjectedOvr: +proj
      })
    })
    if (!res.ok) {
      console.error('Add failed:', await res.json())
      return
    }
    // refresh
    const nxt = await fetch('/api/investments', {
      headers:{ Authorization:`Bearer ${await currentUser.getIdToken()}` }
    })
    setInv(await nxt.json())
    setQ(''); setSel(null); setQty(''); setAvg(''); setProj('')
  }

  // — Delete one —
  async function remove(id: string) {
    if (!currentUser) return
    const token = await currentUser.getIdToken()
    await fetch(`/api/investments/${id}`, {
      method:'DELETE',
      headers:{ Authorization:`Bearer ${token}` }
    })
    setInv(inv.filter(i=>i.id!==id))
    if (editingId === id) setEditingId(null)
  }

  // — Start inline edit —
  function startEdit(i:Investment) {
    setEditingId(i.id)
    setDeltaQty('0')
    setUnitPrice('')
    setNewOvr(String(i.userProjectedOvr))
  }

  // — Submit inline EDIT/PATCH —
  async function submitEdit(i:Investment) {
    if (!currentUser) return
    const dQ = parseInt(deltaQty)||0
    const uP = parseFloat(unitPrice)||0
    const oV = parseInt(newOvr)||i.userProjectedOvr
    let newQty = i.quantity + dQ
    let newAvg = i.avgBuyPrice
    if (newQty < 0) { alert("Cannot remove more than you own"); return }
    if (dQ > 0) {
      newAvg = ((i.quantity*i.avgBuyPrice)+(dQ*uP)) / newQty
    }
    const token = await currentUser.getIdToken()
    const res = await fetch(`/api/investments/${i.id}`, {
      method:'PATCH',
      headers:{
        'Content-Type':'application/json',
        Authorization:`Bearer ${token}`
      },
      body: JSON.stringify({
        quantity:         newQty,
        avgBuyPrice:      Math.round(newAvg),
        userProjectedOvr: oV
      })
    })
    if (!res.ok) {
      console.error("Update failed", await res.json())
      return
    }
    // refresh
    const nxt = await fetch('/api/investments',{
      headers:{ Authorization:`Bearer ${await currentUser.getIdToken()}` }
    })
    setInv(await nxt.json())
    setEditingId(null)
  }

  if (loading || profile === null) {
    return (
      <div className={styles.loadingContainer}>
        <div className={styles.loadingSpinner}></div>
        <p>Loading portfolio...</p>
      </div>
    )
  }

  if (!isOwner && !publicFlag) {
    return (
      <main className={styles.investmentContainer}>
        <div className={styles.privatePortfolio}>
          <div className={styles.lockIcon}>
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
              <path d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm3.1-9H8.9V6c0-1.71 1.39-3.1 3.1-3.1 1.71 0 3.1 1.39 3.1 3.1v2z" />
            </svg>
          </div>
          <h2>This portfolio is private</h2>
          <p>The owner has chosen to keep their investments private.</p>
          <Link href="/" className={styles.homeLink}>
            Return to Home
          </Link>
        </div>
      </main>
    )
  }

  // build portfolio summary
  const summary = inv.reduce((a,i)=>{
    const c = cardDetails[i.playerUUID]
    if (!c) return a
    const cost     = i.quantity * i.avgBuyPrice
    const aiPrice  = Number(c.qs_pred)||0
    const aiValue  = i.quantity * aiPrice
    const aiProfit = aiValue - cost
    const myQs     = qsValue(i.userProjectedOvr)
    const myValue  = i.quantity * myQs
    const myProfit = myValue - cost
    return {
      cost:    a.cost+cost,
      aiValue: a.aiValue+aiValue,
      aiProfit:a.aiProfit+aiProfit,
      myValue: a.myValue+myValue,
      myProfit:a.myProfit+myProfit
    }
  }, { cost:0, aiValue:0, aiProfit:0, myValue:0, myProfit:0 })

  return (
    <main className={styles.investmentContainer}>
      {/* Owner Header */}
      <section className={styles.ownerHeader}>
        <div className={styles.headerContent}>
          <Link href={`/account/${uid}`} className={styles.ownerLink}>
            <img
              src={
                profile.profilePic && profile.profilePic.trim() !== ''
                  ? profile.profilePic
                  : '/default_profile.jpg'
              }
              alt={profile.username}
              className={styles.ownerPic}
              onError={e => {
                ;(e.currentTarget as HTMLImageElement).src = '/default_profile.jpg'
              }}
            />
            <div className={styles.ownerInfo}>
              <span className={styles.ownerName}>
                {isOwner ? 'My Investments' : `${profile.username}'s Investments`}
              </span>
              {isOwner && (
                <div className={styles.publicStatus}>
                  {publicFlag ? 'Public' : 'Private'} Portfolio
                </div>
              )}
            </div>
          </Link>
        </div>
      </section>

      {/* Portfolio Summary */}
      <div className={styles.portfolioSummary}>
        <div className={styles.summaryCard}>
          <div className={styles.summaryIcon}>
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z" />
            </svg>
          </div>
          <div className={styles.summaryDetails}>
            <span className={styles.label}>Total Invested</span>
            <span className={styles.value}>${summary.cost.toLocaleString()}</span>
          </div>
        </div>
        
        <div className={styles.summaryCard}>
          <div className={styles.summaryIcon}>
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
              <path d="M16 11V5l4-4v4l-4 4zM6 7c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V9c0-1.1-.9-2-2-2H6zm10 8H8v-2h8v2zm0-4H8v-2h8v2z" />
            </svg>
          </div>
          <div className={styles.summaryDetails}>
            <span className={styles.label}>AI Value</span>
            <span className={styles.value}>${summary.aiValue.toLocaleString()}</span>
          </div>
        </div>
        
        <div className={`${styles.summaryCard} ${summary.aiProfit >= 0 ? styles.positiveCard : styles.negativeCard}`}>
          <div className={styles.summaryIcon}>
            {summary.aiProfit >= 0 ? (
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
                <path d="M7 14l5-5 5 5z" />
              </svg>
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
                <path d="M7 10l5 5 5-5z" />
              </svg>
            )}
          </div>
          <div className={styles.summaryDetails}>
            <span className={styles.label}>AI P/L</span>
            <span className={styles.value}>${summary.aiProfit.toLocaleString()}</span>
          </div>
        </div>
        
        <div className={styles.summaryCard}>
          <div className={styles.summaryIcon}>
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
            </svg>
          </div>
          <div className={styles.summaryDetails}>
            <span className={styles.label}>Your Value</span>
            <span className={styles.value}>${summary.myValue.toLocaleString()}</span>
          </div>
        </div>
        
        <div className={`${styles.summaryCard} ${summary.myProfit >= 0 ? styles.positiveCard : styles.negativeCard}`}>
          <div className={styles.summaryIcon}>
            {summary.myProfit >= 0 ? (
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
                <path d="M7 14l5-5 5 5z" />
              </svg>
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
                <path d="M7 10l5 5 5-5z" />
              </svg>
            )}
          </div>
          <div className={styles.summaryDetails}>
            <span className={styles.label}>Your P/L</span>
            <span className={styles.value}>${summary.myProfit.toLocaleString()}</span>
          </div>
        </div>
      </div>

      <section className={styles.investmentContent}>
        {/* Add Form */}
        {isOwner && (
          <div className={styles.investmentForm}>
            <h3 className={styles.formTitle}>Add New Investment</h3>
            <div className={styles.formGrid}>
              <div className={styles.autocompleteContainer}>
                <input
                  type="text"
                  placeholder="Search player..."
                  value={q}
                  onChange={e => { setQ(e.target.value); setSel(null) }}
                  className={styles.autocompleteInput}
                />
                {matches.length > 0 && (
                  <div className={styles.autocompleteItems}>
                    {matches.map(c => (
                      <div
                        key={c.id}
                        className={styles.autocompleteItem}
                        onMouseDown={(e) => {
                          e.preventDefault()
                          setSel(c)
                          setQ(c.name)
                          setMatches([])
                        }}
                      >
                        {c.baked_img && (
                          <img src={c.baked_img} alt={c.name} className={styles.itemImage} />
                        )}
                        <span>{c.name}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              
              <div className={styles.formGroup}>
                <label>Quantity</label>
                <input
                  type="number"
                  value={qty}
                  onChange={e => setQty(e.target.value)}
                />
              </div>
              
              <div className={styles.formGroup}>
                <label>Avg Buy Price</label>
                <div className={styles.inputWithPrefix}>
                  <span className={styles.inputPrefix}>$</span>
                  <input
                    type="number"
                    value={avg}
                    onChange={e => setAvg(e.target.value)}
                  />
                </div>
              </div>
              
              <div className={styles.formGroup}>
                <label>Projected OVR</label>
                <input
                  type="number"
                  value={proj}
                  onChange={e => setProj(e.target.value)}
                />
              </div>
              
              <button
                className={`${styles.addBtn} ${!canAdd ? styles.disabled : ''}`}
                disabled={!canAdd}
                onClick={add}
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z" />
                </svg>
                Add Investment
              </button>
            </div>
          </div>
        )}

        {/* Investments Table */}
        <div className={styles.tableContainer}>
          <div className={styles.tableHeader}>
            <h3>Your Investments</h3>
            <span className={styles.countBadge}>{inv.length}</span>
          </div>
          
          {inv.length === 0 ? (
            <div className={styles.emptyState}>
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
                <path d="M20 6h-4V4c0-1.11-.89-2-2-2h-4c-1.11 0-2 .89-2 2v2H4c-1.11 0-1.99.89-1.99 2L2 19c0 1.11.89 2 2 2h16c1.11 0 2-.89 2-2V8c0-1.11-.89-2-2-2zm-6 0h-4V4h4v2z" />
              </svg>
              <p>No investments yet</p>
              {isOwner && <p>Add your first investment above</p>}
            </div>
          ) : (
            <div className={styles.tableWrapper}>
              <table className={styles.investmentTable}>
                <thead>
                  <tr>
                    <th>Player</th>
                    <th>Details</th>
                    <th>Quantity</th>
                    <th>Investment</th>
                    <th>Projection</th>
                    <th>Value</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {inv.map(i => {
                    const c = cardDetails[i.playerUUID]
                    const ovr = Number(c?.ovr) || 0
                    const pred = Number(c?.predicted_rank) || 0
                    const delta = +(pred - ovr).toFixed(1)
                    const aiQs = Number(c?.qs_pred) || 0
                    const myQs = qsValue(i.userProjectedOvr)

                    return (
                      <React.Fragment key={i.id}>
                        <tr>
                          <td>
                            <div 
                              className={styles.playerCell}
                              onClick={() => router.push(`/player/${i.playerUUID}`)}
                              style={{ cursor: 'pointer' }}
                            >
                              {c?.baked_img ? (
                                <img src={c.baked_img} alt={c.name} className={styles.cardIcon} />
                              ) : (
                                <div className={styles.cardPlaceholder}></div>
                              )}
                              <div>
                                <div className={styles.playerName}>{c?.name || i.playerName}</div>
                                <div className={styles.playerMeta}>
                                  <span>OVR: {ovr}</span>
                                  <span>Pred: {pred.toFixed(1)}</span>
                                </div>
                              </div>
                            </div>
                          </td>
                          
                          <td>
                            <div className={styles.detailCell}>
                              <div>
                                <span className={styles.detailLabel}>Market:</span>
                                <span>${c ? Number(c.market_price).toLocaleString() : '–'}</span>
                              </div>
                              <div>
                                <span className={styles.detailLabel}>Confidence:</span>
                                <span>{c != null ? Number(c.confidence_percentage).toFixed(1) + '%' : '–'}</span>
                              </div>
                            </div>
                          </td>
                          
                          <td>
                            <div className={styles.quantityCell}>
                              <div className={styles.quantityValue}>{i.quantity}</div>
                              {editingId === i.id && (
                                <input
                                  type="number"
                                  value={deltaQty}
                                  onChange={e => setDeltaQty(e.target.value)}
                                  className={styles.quantityInput}
                                  placeholder="Δ Qty"
                                />
                              )}
                            </div>
                          </td>
                          
                          <td>
                            <div className={styles.investmentCell}>
                              <div className={styles.investmentValue}>
                                ${i.avgBuyPrice.toLocaleString()}
                              </div>
                              <div className={styles.investmentTotal}>
                                Total: ${(i.quantity * i.avgBuyPrice).toLocaleString()}
                              </div>
                              {editingId === i.id && (
                                <div className={styles.investmentEdit}>
                                  <div className={styles.inputWithPrefix}>
                                    <span className={styles.inputPrefix}>$</span>
                                    <input
                                      type="number"
                                      value={unitPrice}
                                      onChange={e => setUnitPrice(e.target.value)}
                                      placeholder="Unit price"
                                    />
                                  </div>
                                </div>
                              )}
                            </div>
                          </td>
                          
                          <td>
                            <div className={styles.projectionCell}>
                              <div className={styles.ovrComparison}>
                                <span className={styles.currentOvr}>{ovr}</span>
                                <span className={styles.arrowIcon}>
                                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
                                    <path d="M12 4l-1.41 1.41L16.17 11H4v2h12.17l-5.58 5.59L12 20l8-8z" />
                                  </svg>
                                </span>
                                {editingId === i.id ? (
                                  <input
                                    type="number"
                                    value={newOvr}
                                    onChange={e => setNewOvr(e.target.value)}
                                    className={styles.ovrInput}
                                  />
                                ) : (
                                  <span className={styles.projectedOvr}>{i.userProjectedOvr}</span>
                                )}
                              </div>
                              <div className={`${styles.delta} ${delta >= 0 ? styles.positive : styles.negative}`}>
                                {delta >= 0 ? '+' : ''}{delta} Δ
                              </div>
                            </div>
                          </td>
                          
                          <td>
                            <div className={styles.valueCell}>
                              <div className={styles.valueComparison}>
                                <div>
                                  <span className={styles.valueLabel}>AI:</span>
                                  <span>{aiQs}</span>
                                </div>
                                <div>
                                  <span className={styles.valueLabel}>You:</span>
                                  <span>{myQs}</span>
                                </div>
                              </div>
                              <div className={styles.valuePotential}>
                                Potential: ${(i.quantity * myQs).toLocaleString()}
                              </div>
                            </div>
                          </td>
                          
                          <td>
                            {isOwner && editingId !== i.id && (
                              <div className={styles.actionCell}>
                                <button
                                  className={styles.iconButton}
                                  onClick={() => startEdit(i)}
                                  title="Edit"
                                >
                                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
                                    <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z" />
                                  </svg>
                                </button>
                                <button
                                  className={`${styles.iconButton} ${styles.deleteButton}`}
                                  onClick={() => remove(i.id)}
                                  title="Delete"
                                >
                                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
                                    <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z" />
                                  </svg>
                                </button>
                              </div>
                            )}
                            {isOwner && editingId === i.id && (
                              <div className={styles.editActions}>
                                <button
                                  className={`${styles.iconButton} ${styles.saveButton}`}
                                  onClick={() => submitEdit(i)}
                                  title="Save"
                                >
                                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
                                    <path d="M9 16.2L4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4L9 16.2z" />
                                  </svg>
                                </button>
                                <button
                                  className={`${styles.iconButton} ${styles.cancelButton}`}
                                  onClick={() => setEditingId(null)}
                                  title="Cancel"
                                >
                                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
                                    <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
                                  </svg>
                                </button>
                              </div>
                            )}
                          </td>
                        </tr>
                      </React.Fragment>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>
    </main>
  )
}