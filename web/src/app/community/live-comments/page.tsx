// src/app/community/live-comments/page.tsx
// Live comments page - real-time comments on player cards
// Features: player-specific comments with thumbnails, card links, user search
'use client'

import React, { useState, useEffect, useRef } from 'react'
import styles from '../page.module.css'
import { getAuth, onAuthStateChanged, type User } from 'firebase/auth'
import {
  getFirestore,
  collection,
  query,
  orderBy,
  onSnapshot,
  doc,
  getDoc
} from 'firebase/firestore'
import { FaSpinner } from 'react-icons/fa'

// Icon imports for live comments features
import {
  FaBroadcastTower,
  FaBars,
  FaTimes
} from 'react-icons/fa'

// Message structure for display in the UI with user and player data
interface Message {
  id: string
  parentId: string | null
  userId: string
  username: string
  profilePicUrl?: string
  text: string
  timestamp: number
  playerId?: string        // For live comments on specific players
  playerName?: string
  likes: number
  liked: boolean          // Whether current user has liked this message
  editedAt?: number
  editHistory?: {text: string; editedAt: number}[]
}

// User search result structure for user lookup functionality
interface UserSearchResult {
  uid: string
  username: string
  profilePic: string
}

// Raw chat message data structure as stored in Firestore
interface ChatMessageData {
  parentId: string | null
  userId: string
  text: string
  timestamp: number
  playerId?: string        // For live comments on specific players
  likedBy: string[]       // Array of user IDs who liked this message
  editedAt?: number
  editHistory?: {text: string; editedAt: number}[]
}

// User profile data structure from Firestore users collection
interface UserData {
  username: string
  profilePic: string
}

// Player card data structure for live comments thumbnails
interface CardData {
  baked_img: string
  name: string
}

/**
 * Live Comments page component - real-time player card comments
 * Features player thumbnails, card links, and real-time updates
 */
export default function LiveCommentsPage() {
  const auth = getAuth()
  const db   = getFirestore()

  // Authentication and user state
  const [user, setUser] = useState<User | null>(null)
  
  // Tab and navigation state
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false)
  
  // Message and chat state
  const [msgs, setMsgs] = useState<Message[]>([])
  const [loading, setLoading] = useState(true)
  
  // Player card data for live comments
  const [cardThumbs, setCardThumbs] = useState<Record<string, string>>({})
  const [cardNames, setCardNames]   = useState<Record<string, string>>({})

  // User search functionality state
  const [userSearch, setUserSearch] = useState('')
  const [userMatches, setUserMatches] = useState<UserSearchResult[]>([])
  const [userSearchOpen, setUserSearchOpen] = useState(false)

  // DOM references for click outside detection
  const userSearchRef  = useRef<HTMLDivElement>(null)

  // Set up authentication state listener
  useEffect(() => {
    return onAuthStateChanged(auth, u => setUser(u))
  }, [auth])

  // User search functionality with debounced API calls
  useEffect(() => {
    const searchUsers = async () => {
      const val = userSearch.trim()
      if (val.length < 2) {
        setUserMatches([])
        setUserSearchOpen(false)
        return
      }

      try {
        const res = await fetch(`/api/users/search?q=${encodeURIComponent(val)}`)
        const data = await res.json()
        setUserMatches(data)
        setUserSearchOpen(true)
      } catch {
        setUserMatches([])
      }
    }

    // Debounce search to avoid excessive API calls
    const timeoutId = setTimeout(searchUsers, 300)
    return () => clearTimeout(timeoutId)
  }, [userSearch])

  // Close user search dropdown when clicking outside
  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (userSearchRef.current && !userSearchRef.current.contains(e.target as Node)) {
        setUserSearchOpen(false)
      }
    }
    if (userSearchOpen) {
      document.addEventListener('click', onClick)
      return () => document.removeEventListener('click', onClick)
    }
  }, [userSearchOpen])

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

  // Real-time message listener for live comments
  useEffect(() => {
    setLoading(true)
    setMsgs([])
    setCardThumbs({})
    setCardNames({})

    // Create Firestore query for real-time updates on comments collection
    const q = query(
      collection(db, 'comments'),
      orderBy('timestamp', 'desc') // Most recent messages first
    )

    // Subscribe to real-time Firestore updates
    const unsubscribe = onSnapshot(q, async snap => {
      // Transform Firestore documents to message objects
      const raw = snap.docs.map(d => {
        const data = d.data() as ChatMessageData
        return {
          id:          d.id,
          parentId:    data.parentId || null,
          userId:      data.userId,
          text:        data.text,
          timestamp:   data.timestamp,
          playerId:    data.playerId,
          likes:       (data.likedBy || []).length,
          liked:       user ? (data.likedBy || []).includes(user.uid) : false,
          editedAt:    data.editedAt,
          editHistory: data.editHistory,
          // username & profilePicUrl will be merged in below
        }
      }) as Array<Omit<Message, 'username' | 'profilePicUrl'>>

      // Bulk-fetch user profiles to avoid N+1 queries
      const uids = Array.from(new Set(raw.map(m => m.userId)))
      const userDocs = await Promise.all(
        uids.map(uid => getDoc(doc(db, 'users', uid)))
      )
      const userMap = userDocs.reduce<Record<string,{username:string,profilePicUrl:string}>>((acc, ds) => {
        if (ds.exists()) {
          const d = ds.data() as UserData
          acc[ds.id] = {
            username:      d.username    || 'Unknown',
            profilePicUrl: d.profilePic  || '/placeholder-user.png'
          }
        }
        return acc
      }, {})

      // Merge user profile data into message objects
      const withNames = raw.map(m => ({
        ...m,
        username:      userMap[m.userId]?.username      || 'Unknown',
        profilePicUrl: userMap[m.userId]?.profilePicUrl || '/placeholder-user.png'
      }))

      setMsgs(withNames)
      setLoading(false)

      // Fetch player card data for live comments
      const playerIds = Array.from(new Set(withNames.map(m => m.playerId!).filter(Boolean)))
      const thumbs: Record<string,string> = {}
      const names:  Record<string,string> = {}
      
      // Fetch card thumbnails and names for all referenced players
      await Promise.all(playerIds.map(async id => {
        const snap = await getDoc(doc(db, 'cards', id))
        if (!snap.exists()) return
        const card = snap.data() as CardData
        if (card.baked_img) thumbs[id] = card.baked_img
        if (card.name)      names[id]  = card.name
      }))
      setCardThumbs(thumbs)
      setCardNames(names)
    })

    // Cleanup listener when component unmounts or dependencies change
    return () => {
      unsubscribe()
    }
  }, [user])

  // Helper function to render text with @mentions highlighted
  const renderMessageText = (text: string) => {
    const mentionRegex = /@(\w+)/g
    const parts = text.split(mentionRegex)
    
    return parts.map((part, index) => {
      // Every odd index is a username from the regex capture group
      if (index % 2 === 1) {
        return (
          <span key={index} className={styles.mention}>
            @{part}
          </span>
        )
      }
      return part
    })
  }

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
          <h2 className={styles.mobileTitle}>Live Comments</h2>
          <div className={styles.mobileRoomInfo}>
            <span className={styles.roomIcon}>
              <FaBroadcastTower />
            </span>
            <span className={styles.roomName}>
              Live Comments
            </span>
          </div>
        </div>

        {/* Navigation sidebar with user search */}
        <aside className={`${styles.sidebar} ${mobileSidebarOpen ? styles.sidebarOpen : ''}`}>
          <div className={styles.sidebarHeader}>
            <h2 className={styles.head}>Live Comments</h2>
          </div>

          {/* User search functionality with dropdown results */}
          <div className={styles.userSearchContainer} ref={userSearchRef}>
            <input
              type="text"
              className={styles.userSearchInput}
              placeholder="Search users..."
              value={userSearch}
              onChange={e => setUserSearch(e.target.value)}
            />
            {/* Search results dropdown */}
            {userSearchOpen && userMatches.length > 0 && (
              <div className={styles.userSearchResults}>
                {userMatches.map(user => (
                  <div
                    key={user.uid}
                    className={styles.userResult}
                    onClick={() => {
                      window.location.href = `/account/${user.uid}`
                      setUserSearch('')
                      setUserSearchOpen(false)
                    }}
                  >
                    <img
                      src={user.profilePic || '/placeholder-user.png'}
                      alt={user.username}
                      className={styles.userResultAvatar}
                    />
                    <span className={styles.userResultName}>{user.username}</span>
                  </div>
                ))}
              </div>
            )}
            {/* No results message */}
            {userSearchOpen && userSearch.length >= 2 && userMatches.length === 0 && (
              <div className={styles.userSearchResults}>
                <div className={styles.noResults}>No users found</div>
              </div>
            )}
          </div>

          <nav className={styles.tabs}>
            {/* Live Comments Info */}
            <div className={styles.sectionHeader}>Player Comments</div>
            <div className={styles.infoText}>
              Real-time comments from all player pages appear here. Click on player cards to view full details.
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

        {/* COMMENTS AREA */}
        <section className={styles.chatArea}>
          <header className={styles.chatHeader}>
            <div className={styles.roomInfo}>
              <span className={styles.roomIcon}>
                <FaBroadcastTower />
              </span>
              <h3 className={styles.roomName}>
                Live Comments
              </h3>
            </div>
          </header>

          <div className={styles.messagesContainer}>
            {loading
              ? <div className="spinner-container">
                  <FaSpinner className="spinner" />
                </div>
              : msgs.length===0
                ? <div className={styles.emptyState}>
                    <div className={styles.emptyIcon}>💬</div>
                    <h4>No live comments yet</h4>
                    <p>Comments from player pages will appear here in real-time!</p>
                  </div>
                : <ul className={styles.messages}>
                    {msgs.map(m => (
                      <LiveCommentItem
                        key={m.id}
                        msg={m}
                        thumb={cardThumbs[m.playerId!]||''}
                        cardName={cardNames[m.playerId!]||''}
                        renderMessageText={renderMessageText}
                      />
                    ))}
                  </ul>
            }
          </div>
        </section>
      </div>
    </main>
  )
}

/**
 * MessageTime component - displays relative time since message was posted
 * Updates automatically every minute for accurate "time ago" display
 */
function MessageTime({ timestamp }: { timestamp: number }) {
  const [label, setLabel] = useState<string | null>(null)

  useEffect(() => {
    // Format time difference as human-readable relative time
    function fmt() {
      const diff = Date.now() - timestamp
      if (diff < 2*60_000)       return 'just now'
      if (diff < 60*60_000)      return `${Math.floor(diff/60_000)}m ago`
      if (diff < 24*60*60_000)   return `${Math.floor(diff/3_600_000)}h ago`
      return `${Math.floor(diff/86_400_000)}d ago`
    }

    setLabel(fmt())
    // Schedule next update to keep time accurate (updates every minute)
    const nextIn = 60_000 - (Date.now() - timestamp) % 60_000
    const timer = setTimeout(() => setLabel(fmt()), nextIn)
    return () => clearTimeout(timer)
  }, [timestamp])

  // Don't render anything during SSR or initial mount
  if (label === null) return <></>
  return <span className={styles.time}>{label}</span>
}

/**
 * LiveCommentItem component - renders individual live comments with player card links
 * Features player thumbnails and links to player pages
 */
function LiveCommentItem({
  msg, thumb, cardName, renderMessageText
}: {
  msg: Message,
  thumb: string,      // Player card thumbnail
  cardName: string,   // Player name
  renderMessageText: (text: string) => React.ReactNode
}) {
  const [showTime, setShowTime] = useState(true)

  return (
    <li className={styles.message}>
      <div
        className={styles.messageContainer}
        onMouseEnter={()=>setShowTime(true)}
        onMouseLeave={()=>setShowTime(false)}
      >
        <div className={styles.messageHeader}>
          <img
            src={msg.profilePicUrl && msg.profilePicUrl.trim() !== '' ? msg.profilePicUrl : '/default_profile.jpg'}
            className={styles.avatar}
            alt={msg.username}
            onError={e => { (e.currentTarget as HTMLImageElement).src = '/default_profile.jpg' }}
          />
          <a href={`/account/${msg.userId}`} className={styles.user}>{msg.username}</a>
          {showTime && <MessageTime timestamp={msg.timestamp} />}
          {msg.playerId && (
            <a
              href={`/player/${msg.playerId}`}
              className={styles.cardLink}
            >
              {thumb && <img
                src={thumb}
                className={styles.cardThumb}
                alt={cardName}
              />}
              <span className={styles.cardName}>{cardName}</span>
            </a>
          )}
        </div>

        <div className={styles.messageContent}>
          <p className={styles.text}>
            {renderMessageText(msg.text)}
            {msg.editedAt && (
              <span className={styles.editedIndicator}>
                (edited at {new Date(msg.editedAt).toLocaleString([], { hour: '2-digit', minute: '2-digit', month: 'short', day: 'numeric' })})
              </span>
            )}
          </p>
        </div>
      </div>
    </li>
  )
}