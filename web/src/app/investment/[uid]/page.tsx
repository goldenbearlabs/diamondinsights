// src/app/investment/[uid]/page.tsx
// Investment portfolio tracker - displays user investments with profit/loss calculations
// Features: public/private portfolios, real-time editing, AI vs user projections, quick-sell calculations
'use client'

import React, { useState, useEffect } from 'react'
import { useParams, useRouter }      from 'next/navigation'
import Link                          from 'next/link'
import styles                        from './page.module.css'
import { getAuth, onAuthStateChanged, type User } from 'firebase/auth'
import { doc, getDoc }               from 'firebase/firestore'
import { db }                        from '@/lib/firebaseClient'
import { FaSpinner } from 'react-icons/fa'

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

// Investment record structure stored in user's subcollection
interface Investment {
  id: string
  playerUUID: string         // Reference to player card
  playerName: string         // Cached player name
  quantity: number           // Number of cards owned
  avgBuyPrice: number        // Average purchase price per card
  userProjectedOvr: number   // User's OVR prediction for profit calculation
  createdAt: string
}

// Player card data structure from cards API
interface Card {
  id: string
  name: string
  ovr: number | string               // Current overall rating
  market_price: number | string     // Current market price
  predicted_rank: number | string   // AI predicted overall rating
  confidence_percentage: number | string  // AI prediction confidence
  qs_pred: number | string          // AI predicted quick-sell value
  baked_img?: string                // Player card image URL
}

// User profile data structure from Firestore users collection
interface UserProfileData {
  username: string
  profilePic: string
  investmentsPublic: boolean        // Privacy setting for portfolio visibility
}

// Processed profile data for display
interface Profile {
  username: string
  profilePic: string
  investmentsPublic: boolean
}

/**
 * Investment portfolio tracker component - displays and manages user investment portfolios
 * Supports both private (owner-only) and public portfolio viewing with real-time editing
 * Features profit/loss calculations comparing AI predictions vs user projections
 */
export default function InvestmentPage() {
  const { uid }    = useParams() as { uid?: string }
  const router     = useRouter()
  const authClient = getAuth()

  // Authentication and ownership state
  const [currentUser, setCurrentUser] = useState<User|null>(null)
  const [isOwner,      setIsOwner]    = useState(false)

  // User profile and privacy settings
  const [profile,     setProfile]     = useState<Profile|null>(null)
  const [publicFlag,  setPublicFlag]  = useState(false)

  // Investment data and player card details
  const [inv,         setInv]         = useState<Investment[]>([])
  const [cardDetails, setCardDetails] = useState<Record<string,Card>>({})

  // Loading state for async operations
  const [loading,     setLoading]     = useState(true)

  // Add new investment form state
  const [q,        setQ]        = useState('')           // Player search query
  const [matches,  setMatches]  = useState<Card[]>([])   // Search results
  const [sel,      setSel]      = useState<Card|null>(null)  // Selected player
  const [qty,      setQty]      = useState('')           // Quantity input
  const [avg,      setAvg]      = useState('')           // Average price input
  const [proj,     setProj]     = useState('')           // Projected OVR input

  // Inline editing state for existing investments
  const [editingId,     setEditingId]     = useState<string|null>(null)
  const [newQuantity,   setNewQuantity]   = useState('')  // Edit quantity
  const [unitPrice,     setUnitPrice]     = useState('')  // Edit unit price
  const [newOvr,        setNewOvr]        = useState('')  // Edit projected OVR

  // MLB The Show quick-sell value mapping based on player overall rating
  // Used to calculate potential profit from user's projected OVR improvements
  function qsValue(ovr: number): number {
    if (ovr < 65) return 5        // Bronze cards
    if (ovr < 75) return 25       // Silver cards
    if (ovr === 75) return 50     // Gold tier entry
    if (ovr === 76) return 75
    if (ovr === 77) return 100
    if (ovr === 78) return 125
    if (ovr === 79) return 150
    if (ovr === 80) return 400    // Diamond tier entry - significant jump
    if (ovr === 81) return 600
    if (ovr === 82) return 900
    if (ovr === 83) return 1200
    if (ovr === 84) return 1500
    if (ovr === 85) return 3000   // High diamond tier - major value increase
    if (ovr === 86) return 3750
    if (ovr === 87) return 4500
    if (ovr === 88) return 5500
    if (ovr === 89) return 7000
    if (ovr === 90) return 8000   // Elite tier
    if (ovr === 91) return 9000
    return ovr >= 92 ? 10000 : 0  // Max tier cards
  }

  // Set up authentication listener and determine portfolio ownership
  useEffect(() => {
    const unsub = onAuthStateChanged(authClient, u => {
      setCurrentUser(u)
      setIsOwner(u?.uid === uid)  // Check if viewing own portfolio
    })
    return () => unsub()
  }, [authClient, uid])

  // Load user profile and check privacy settings
  useEffect(() => {
    if (!uid) return
    getDoc(doc(db, 'users', uid)).then(snap => {
      if (!snap.exists()) {
        router.replace('/404')
        return
      }
      const data = snap.data() as UserProfileData
      const pub  = data.investmentsPublic ?? false
      setProfile({
        username: data.username,
        profilePic: data.profilePic,
        investmentsPublic: pub
      })
      setPublicFlag(pub)
      // Stop loading if viewing private portfolio as non-owner
      if (!isOwner && !pub) {
        setLoading(false)
      }
    })
  }, [uid, router])

  // Fetch investment data based on ownership and privacy settings
  useEffect(() => {
    if (profile === null) return
    // Skip fetching if viewing someone else's private portfolio
    if (!isOwner && !publicFlag) {
      setLoading(false)
      return
    }
    async function loadInv() {
      let res: Response
      if (isOwner) {
        // Owner uses authenticated endpoint for full access
        const token = await currentUser!.getIdToken()
        res = await fetch('/api/investments', {
          headers: { Authorization: `Bearer ${token}` }
        })
      } else {
        // Public viewing uses unauthenticated endpoint
        res = await fetch(`/api/users/${uid}/investments`)
      }
      if (res.ok) {
        setInv(await res.json())
      }
      setLoading(false)
    }
    loadInv()
  }, [profile, isOwner, publicFlag, currentUser, uid])

  // Fetch player card details for all investments to display current stats
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
      // Build lookup map for quick access during rendering
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

  // Validation check for add investment form completeness
  const canAdd = Boolean(sel && +qty > 0 && !isNaN(+avg) && !isNaN(+proj))

  // Add new investment to user's portfolio
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
    // Refresh investment list after successful add
    const nxt = await fetch('/api/investments', {
      headers:{ Authorization:`Bearer ${await currentUser.getIdToken()}` }
    })
    setInv(await nxt.json())
    // Clear form inputs
    setQ(''); setSel(null); setQty(''); setAvg(''); setProj('')
  }

  // Remove investment from portfolio
  async function remove(id: string) {
    if (!currentUser) return
    const token = await currentUser.getIdToken()
    await fetch(`/api/investments/${id}`, {
      method:'DELETE',
      headers:{ Authorization:`Bearer ${token}` }
    })
    // Update local state immediately for responsive UI
    setInv(inv.filter(i=>i.id!==id))
    if (editingId === id) setEditingId(null)
  }

  // Initialize inline editing mode for an investment
  function startEdit(i:Investment) {
    setEditingId(i.id)
    setNewQuantity(String(i.quantity))  // Start with current quantity
    setUnitPrice('')                    // Leave blank to avoid accidental price updates
    setNewOvr(String(i.userProjectedOvr))
  }

  // Submit inline edits with complex average price recalculation
  async function submitEdit(i:Investment) {
    if (!currentUser) return
    const newQty = parseInt(newQuantity) || i.quantity
    const uP = parseFloat(unitPrice)||0
    const oV = parseInt(newOvr)||i.userProjectedOvr
    const dQ = newQty - i.quantity  // Calculate quantity change delta
    let newAvg = i.avgBuyPrice
    if (newQty < 0) { alert("Cannot have negative quantity"); return }
    
    // Complex average price calculation based on quantity and price changes
    if (dQ > 0 && uP > 0) {
      // Adding quantity with new unit price - weighted average calculation
      newAvg = ((i.quantity*i.avgBuyPrice)+(dQ*uP)) / newQty
    } else if (dQ === 0 && uP > 0) {
      // Just updating the unit price without changing quantity
      newAvg = uP
    } else if (dQ < 0) {
      // Reducing quantity - keep current average price (selling at market)
      newAvg = i.avgBuyPrice
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
    // Refresh investment list after successful update
    const nxt = await fetch('/api/investments',{
      headers:{ Authorization:`Bearer ${await currentUser.getIdToken()}` }
    })
    setInv(await nxt.json())
    setEditingId(null)  // Exit edit mode
  }

  // Show loading spinner while fetching data
  if (loading) {
    return (
      <div className="spinner-container">
        <FaSpinner className="spinner" />
      </div>
    )
  }

  // Handle case where profile failed to load
  if (!profile) {
    return null
  }
  
  // Show privacy message for private portfolios viewed by non-owners
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

  // Calculate comprehensive portfolio summary with AI vs user projections
  const summary = inv.reduce((a,i)=>{
    const c = cardDetails[i.playerUUID]
    if (!c) return a
    const cost     = i.quantity * i.avgBuyPrice         // Total investment cost
    const aiPrice  = Number(c.qs_pred)||0              // AI predicted quick-sell value
    const aiValue  = i.quantity * aiPrice              // AI projected portfolio value
    const aiProfit = aiValue - cost                    // AI projected profit/loss
    const myQs     = qsValue(i.userProjectedOvr)       // User projected quick-sell value
    const myValue  = i.quantity * myQs                 // User projected portfolio value  
    const myProfit = myValue - cost                    // User projected profit/loss
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
                profile?.profilePic?.trim()
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
            <span className={styles.value}><StubsIcon />{summary.cost.toLocaleString()}</span>
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
            <span className={styles.value}><StubsIcon />{summary.aiValue.toLocaleString()}</span>
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
            <span className={styles.value}><StubsIcon />{summary.aiProfit.toLocaleString()}</span>
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
            <span className={styles.value}><StubsIcon />{summary.myValue.toLocaleString()}</span>
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
            <span className={styles.value}><StubsIcon />{summary.myProfit.toLocaleString()}</span>
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
                  <span className={styles.inputPrefix}><StubsIcon /></span>
                  <input
                    type="number"
                    value={avg}
                    onChange={e => setAvg(e.target.value)}
                  />
                </div>
              </div>
              
              <div className={styles.formGroup}>
                <label>Your Projected OVR</label>
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
                                <span>{c ? <><StubsIcon />{Number(c.market_price).toLocaleString()}</> : '–'}</span>
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
                                  value={newQuantity}
                                  onChange={e => setNewQuantity(e.target.value)}
                                  className={styles.quantityInput}
                                  placeholder="New Qty"
                                />
                              )}
                            </div>
                          </td>
                          
                          <td>
                            <div className={styles.investmentCell}>
                              <div className={styles.investmentValue}>
                                <StubsIcon />{i.avgBuyPrice.toLocaleString()}
                              </div>
                              <div className={styles.investmentTotal}>
                                Total: <StubsIcon />{(i.quantity * i.avgBuyPrice).toLocaleString()}
                              </div>
                              {editingId === i.id && (
                                <div className={styles.investmentEdit}>
                                  <div className={styles.inputWithPrefix}>
                                    <span className={styles.inputPrefix}><StubsIcon /></span>
                                    <input
                                      type="number"
                                      value={unitPrice}
                                      onChange={e => setUnitPrice(e.target.value)}
                                      placeholder="Unit"
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
                                  <span><StubsIcon />{aiQs}</span>
                                </div>
                                <div>
                                  <span className={styles.valueLabel}>You:</span>
                                  <span><StubsIcon />{myQs}</span>
                                </div>
                              </div>
                              <div className={styles.valuePotential}>
                                Potential: <StubsIcon />{(i.quantity * myQs).toLocaleString()}
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