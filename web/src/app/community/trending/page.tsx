// src/app/community/trending/page.tsx
// Trending page - displays popular player cards with voting data
// Features: card grid display, voting stats, refresh functionality
'use client'

import React, { useState, useEffect, useRef } from 'react'
import styles from '../page.module.css'
import { getAuth, onAuthStateChanged, type User } from 'firebase/auth'
import { FaSpinner } from 'react-icons/fa'

// Icon imports for trending features
import {
  FaFire,
  FaSync,
  FaBars,
  FaTimes
} from 'react-icons/fa'

// User search result structure for user lookup functionality
interface UserSearchResult {
  uid: string
  username: string
  profilePic: string
}

// Trending card structure with voting and prediction data
interface TrendingCard {
  id: string
  name: string
  team_short_name: string
  display_position: string
  baked_img: string
  ovr: number
  predicted_rank: number
  delta_rank_pred: number
  upvotes: number
  downvotes: number
  netVotes: number
  totalVotes: number
}

/**
 * Trending page component - displays popular player cards with voting metrics
 * Features refresh functionality and real-time voting data
 */
export default function TrendingPage() {
  const auth = getAuth()

  // Authentication and user state
  const [user, setUser] = useState<User | null>(null)
  
  // Tab and navigation state
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false)
  
  // Trending cards state
  const [trendingCards, setTrendingCards] = useState<TrendingCard[]>([])
  const [trendingLoading, setTrendingLoading] = useState(false)


  // DOM references for click outside detection

  // Set up authentication state listener
  useEffect(() => {
    return onAuthStateChanged(auth, u => setUser(u))
  }, [auth])

  // Function to fetch trending player cards from API
  const fetchTrendingCards = async () => {
    setTrendingLoading(true)
    try {
      const response = await fetch('/api/trending/cards', {
        cache: 'no-store'  // Always fetch fresh data
      })
      const data: TrendingCard[] = await response.json()
      setTrendingCards(data)
    } catch (error) {
      console.error('Error fetching trending cards:', error)
      setTrendingCards([])
    } finally {
      setTrendingLoading(false)
    }
  }

  // Load trending cards on component mount
  useEffect(() => {
    fetchTrendingCards()
  }, [])



  // Close mobile sidebar when clicking outside (mobile UX)
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      const sidebar = document.querySelector(`.${styles.sidebar}`)
      if (mobileSidebarOpen && sidebar && !sidebar.contains(event.target as Node)) {
        setMobileSidebarOpen(false)
      }
    }
    if (mobileSidebarOpen) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [mobileSidebarOpen])

  // Auto-refresh trending data when user returns to tab/window
  useEffect(() => {
    const handleFocus = () => {
      fetchTrendingCards()
    }
    window.addEventListener('focus', handleFocus)
    return () => window.removeEventListener('focus', handleFocus)
  }, [])

  return (
    <main className={styles.page}>
      <div className={styles.container}>
        {/* Mobile header with hamburger menu */}
        <div className={styles.mobileHeader}>
          <button 
            className={styles.mobileMenuButton}
            onClick={() => setMobileSidebarOpen(!mobileSidebarOpen)}
          >
            {mobileSidebarOpen ? <FaTimes /> : <FaBars />}
          </button>
          <h2 className={styles.mobileTitle}>Trending</h2>
          <div className={styles.mobileRoomInfo}>
            <span className={styles.roomIcon}>
              <FaFire />
            </span>
            <span className={styles.roomName}>
              Trending
            </span>
          </div>
        </div>

        {/* Navigation sidebar with user search */}
        <aside className={`${styles.sidebar} ${mobileSidebarOpen ? styles.sidebarOpen : ''}`}>
          <div className={styles.sidebarHeader}>
            <h2 className={styles.head}>Trending Cards</h2>
          </div>


          <nav className={styles.tabs}>
            {/* Trending Info */}
            <div className={styles.sectionHeader}>Popular Cards</div>
            <div className={styles.infoText}>
              Top 10 most voted player cards ranked by community interest. Cards with high voting activity appear here.
            </div>
          </nav>
          
          <div className={styles.userInfo}>
            {user
              ? <>
                  <img
                    src={user.photoURL && user.photoURL.trim() !== '' ? user.photoURL : '/default_profile.jpg'}
                    className={styles.userAvatar}
                    alt={user.displayName||'You'}
                    onError={e => { (e.currentTarget as HTMLImageElement).src = '/default_profile.jpg' }}
                  />
                  <div className={styles.userDetails}>
                    <div className={styles.userName}>
                    {user.displayName||'You'}
                    </div>
                    <div className={styles.userStatus}>Online</div>
                  </div>
                </>
              : (
                <div className={styles.loginPrompt}>
                  <a href="/login" className={styles.loginLink}>
                    Log in to view
                  </a>
                </div>
              )
            }
          </div>
        </aside>

        {/* TRENDING AREA */}
        <section className={styles.chatArea}>
          <header className={styles.chatHeader}>
            <div className={styles.roomInfo}>
              <span className={styles.roomIcon}>
                <FaFire />
              </span>
              <h3 className={styles.roomName}>
                Trending Cards
              </h3>
            </div>
            <button 
              className={styles.refreshButton}
              onClick={fetchTrendingCards}
              disabled={trendingLoading}
              title="Refresh trending data"
            >
              <FaSync className={trendingLoading ? styles.spinning : ''} />
              Refresh
            </button>
          </header>

          <div className={styles.messagesContainer}>
            {trendingLoading ? (
              <div className="spinner-container">
                <FaSpinner className="spinner" />
              </div>
            ) : trendingCards.length === 0 ? (
              <div className={styles.emptyState}>
                <div className={styles.emptyIcon}>🔥</div>
                <h4>No trending cards yet</h4>
                <p>Cards with votes will appear here!</p>
              </div>
            ) : (
              <div className={styles.trendingGrid}>
                {trendingCards.map((card, index) => (
                  <div key={card.id} className={styles.trendingCard}>
                    <div className={styles.trendingRank}>#{index + 1}</div>
                    <img 
                      src={card.baked_img} 
                      alt={card.name}
                      className={styles.trendingCardImage}
                      onClick={() => window.location.href = `/player/${card.id}`}
                    />
                    <div className={styles.trendingCardInfo}>
                      <h4 className={styles.trendingCardName}>{card.name}</h4>
                      <div className={styles.trendingCardMeta}>
                        {card.team_short_name} • {card.display_position} • {card.ovr} OVR
                      </div>
                      <div className={styles.trendingVotes}>
                        <span className={styles.upvotes}>↑ {card.upvotes}</span>
                        <span className={styles.downvotes}>↓ {card.downvotes}</span>
                        <span className={styles.netVotes}>Net: {card.netVotes > 0 ? '+' : ''}{card.netVotes}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      </div>
    </main>
  )
}