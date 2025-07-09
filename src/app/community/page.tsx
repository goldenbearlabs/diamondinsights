// src/app/community/page.tsx
// Community hub - main interface for real-time chat, live comments, and trending cards
// Features: multiple chat rooms, user search, threaded messages, likes, and trending player cards
'use client'

import React, { useState, useEffect, useRef } from 'react'
import styles from './page.module.css'
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

// Icon imports for various community features
import {
  FaBroadcastTower,
  FaComments,
  FaChartLine,
  FaSyncAlt,
  FaDollarSign,
  FaHeart,
  FaReply,
  FaFire,
  FaSync,
  FaBars,
  FaTimes
} from 'react-icons/fa'

// Message structure for display in the UI with user and interaction data
interface Message {
  id: string
  parentId: string | null  // For threaded replies
  userId: string
  username: string
  profilePicUrl?: string
  text: string
  timestamp: number
  playerId?: string        // For live comments on specific players
  playerName?: string
  likes: number
  liked: boolean          // Whether current user has liked this message
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

// Message payload structure for API requests
interface MessagePayload {
  text: string
  userId: string
  parentId?: string       // For replies in chat rooms
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

// Recursive message tree structure for threaded conversations
type MessageTree = Message & { replies: MessageTree[] }

// Tab configuration for different community sections
const TABS = [
  { key: 'live',     label: 'Live Comments', icon: <FaBroadcastTower /> }, // Player card comments
  { key: 'trending', label: 'Trending',      icon: <FaFire           /> }, // Popular player cards
  { key: 'main',     label: 'Main Chat',     icon: <FaComments       /> }, // General discussion
  { key: 'invest',   label: 'Investing',     icon: <FaChartLine      /> }, // Investment strategies  
  { key: 'flip',     label: 'Flipping',      icon: <FaSyncAlt        /> }, // Card flipping tips
  { key: 'stub',     label: 'Stub Making',   icon: <FaDollarSign     /> }, // Stub profit methods
] as const

/**
 * Community page component - central hub for all community interactions
 * Features real-time chat, live player comments, trending cards, and user search
 * Supports multiple chat rooms with threaded conversations and message reactions
 */
export default function CommunityPage() {
  const auth = getAuth()
  const db   = getFirestore()

  // Authentication and user state
  const [user, setUser] = useState<User | null>(null)
  
  // Tab and navigation state
  const [activeTab, setActive] = useState<typeof TABS[number]['key']>('live')
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false)
  
  // Message and chat state
  const [msgs, setMsgs] = useState<Message[]>([])
  const [loading, setLoading] = useState(true)
  const [newText, setNewText] = useState('')
  const [replyTo, setReplyTo] = useState<string | null>(null)
  
  // Player card data for live comments
  const [cardThumbs, setCardThumbs] = useState<Record<string, string>>({})
  const [cardNames, setCardNames]   = useState<Record<string, string>>({})
  
  // Trending cards state
  const [trendingCards, setTrendingCards] = useState<TrendingCard[]>([])
  const [trendingLoading, setTrendingLoading] = useState(false)

  // User search functionality state
  const [userSearch, setUserSearch] = useState('')
  const [userMatches, setUserMatches] = useState<UserSearchResult[]>([])
  const [userSearchOpen, setUserSearchOpen] = useState(false)

  // DOM references for auto-scrolling and click outside detection
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const textareaRef    = useRef<HTMLTextAreaElement>(null)
  const userSearchRef  = useRef<HTMLDivElement>(null)

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

  // Auto-refresh trending data when user returns to tab/window
  useEffect(() => {
    const handleFocus = () => {
      if (activeTab === 'trending') {
        fetchTrendingCards()
      }
    }
    window.addEventListener('focus', handleFocus)
    return () => window.removeEventListener('focus', handleFocus)
  }, [activeTab])

  // Real-time message listener - handles chat rooms and live comments
  useEffect(() => {
    if (activeTab === 'trending') {
      fetchTrendingCards()
      return
    }

    // Reset state when switching tabs
    setLoading(true)
    setReplyTo(null)
    setMsgs([])
    setCardThumbs({})
    setCardNames({})

    // Map tab keys to Firestore collection names
    const room = activeTab === 'live'
    ? 'comments'              // Player card comments
    : activeTab === 'invest'
      ? 'chat_investing'      // Investment discussion
      : activeTab === 'flip'
        ? 'chat_flipping'     // Card flipping chat
        : `chat_${activeTab}` // Other chat rooms (main, stub)

    // Create Firestore query for real-time updates
    const q = query(
      collection(db, room),
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

      // Fetch player card data for live comments tab
      if (activeTab === "live") {
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
      }
    })

    // Cleanup listener when component unmounts or dependencies change
    return () => {
      unsubscribe()
    }
  }, [activeTab, user])

  // Auto-resize textarea based on content
  useEffect(() => {
    if (!textareaRef.current) return
    textareaRef.current.style.height = 'auto'
    textareaRef.current.style.height =
      Math.min(textareaRef.current.scrollHeight, 150) + 'px'  // Max height 150px
  }, [newText])

  // Build hierarchical message tree structure for threaded conversations
  const buildTree = (list: Message[]): MessageTree[] => {
    const byId: Record<string, MessageTree> = {}
    // Initialize all messages as tree nodes
    list.forEach(m => (byId[m.id] = { ...m, replies: [] }))
    const roots: MessageTree[] = []
    
    // Organize messages into parent-child relationships
    Object.values(byId).forEach(m => {
      if (m.parentId && byId[m.parentId]) {
        byId[m.parentId].replies.push(m)  // Add as reply to parent
      } else {
        roots.push(m)  // Top-level message
      }
    })
    return roots
  }

  // Send message to appropriate API endpoint (chat room or player comments)
  async function send(text: string, parentId?: string) {
    if (!user) return
    const token = await user.getIdToken()
    
    // Determine API endpoint based on active tab
    const endpoint =
      activeTab === 'live'
        ? `/api/cards/${replyTo ? msgs.find(m=>m.id===replyTo)?.playerId : ''}/comments`
        : `/api/chat/${activeTab === 'invest' ? 'investing' : activeTab}`

    const payload: MessagePayload = { text, userId: user.uid }
    // Add parent ID for threaded replies (not used in live comments)
    if (parentId && activeTab !== 'live') payload.parentId = parentId

    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type':'application/json',
        Authorization: `Bearer ${token}`  // Firebase ID token for auth
      },
      body: JSON.stringify(payload)
    })
    if (!res.ok) {
      console.error(await res.json())
      return alert('Failed to send')
    }
    // Clear input after successful send
    setNewText('')
    setReplyTo(null)
  }

  // Toggle like status for a message (add/remove like)
  async function toggleLike(id: string) {
    if (!user) return alert('Log in to like')
    const token = await user.getIdToken()
    const res = await fetch(
      `/api/chat/${activeTab === 'invest' ? 'investing' : activeTab}/likes`,
      {
        method:'POST',
        headers:{
          'Content-Type':'application/json',
          Authorization:`Bearer ${token}`
        },
        body: JSON.stringify({ messageId: id })
      }
    )
    if (!res.ok) return console.error('Like failed', await res.json())
    const { toggled } = await res.json()
    
    // Update local state optimistically
    setMsgs(ms => ms.map(m =>
      m.id === id
        ? {...m, liked: toggled, likes: m.likes + (toggled ? 1 : -1) }
        : m
    ))
  }

  // Handle Enter key to send message (Shift+Enter for new line)
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      if (newText.trim()) send(newText, replyTo!)
    }
  }

  return (
    <main className={styles.page}>
      <div className={styles.container}>
        {/* Mobile header with hamburger menu and room info */}
        <div className={styles.mobileHeader}>
          <button 
            className={styles.mobileMenuButton}
            onClick={() => setMobileSidebarOpen(!mobileSidebarOpen)}
          >
            {mobileSidebarOpen ? <FaTimes /> : <FaBars />}
          </button>
          <h2 className={styles.mobileTitle}>Community</h2>
          <div className={styles.mobileRoomInfo}>
            <span className={styles.roomIcon}>
              {TABS.find(t=>t.key===activeTab)?.icon}
            </span>
            <span className={styles.roomName}>
              {TABS.find(t=>t.key===activeTab)?.label}
            </span>
          </div>
        </div>

        {/* Navigation sidebar with user search and tab switching */}
        <aside className={`${styles.sidebar} ${mobileSidebarOpen ? styles.sidebarOpen : ''}`}>
          <div className={styles.sidebarHeader}>
            <h2 className={styles.head}>Community</h2>
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
            {/* Live Comments */}
            <button
              key="live"
              className={`${styles.tab} ${activeTab==='live'?styles.active:''}`}
              onClick={()=>{
                setActive('live')
                setReplyTo(null)
                setMobileSidebarOpen(false)
              }}
            >
              <span className={styles.tabIcon}><FaBroadcastTower /></span>
              <span className={styles.tabLabel}>Live Comments</span>
            </button>

            {/* Trending */}
            <button
              key="trending"
              className={`${styles.tab} ${activeTab==='trending'?styles.active:''}`}
              onClick={()=>{
                setActive('trending')
                setReplyTo(null)
                setMobileSidebarOpen(false)
              }}
            >
              <span className={styles.tabIcon}><FaFire /></span>
              <span className={styles.tabLabel}>Trending</span>
            </button>

            {/* Chat Rooms Section */}
            <div className={styles.sectionHeader}>Chat Rooms</div>
            
            {/* Chat Room Tabs */}
            {TABS.slice(2).map(t => (
              <button
                key={t.key}
                className={`${styles.tab} ${activeTab===t.key?styles.active:''}`}
                onClick={()=>{
                  setActive(t.key)
                  setReplyTo(null)
                  setMobileSidebarOpen(false)
                }}
              >
                <span className={styles.tabIcon}>{t.icon}</span>
                <span className={styles.tabLabel}>{t.label}</span>
              </button>
            ))}
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
                    Log in to chat
                  </a>
                </div>
              )
            }
          </div>
        </aside>

        {/* CHAT AREA */}
        <section className={styles.chatArea}>
          <header className={styles.chatHeader}>
            <div className={styles.roomInfo}>
              <span className={styles.roomIcon}>
                {TABS.find(t=>t.key===activeTab)?.icon}
              </span>
              <h3 className={styles.roomName}>
                {TABS.find(t=>t.key===activeTab)?.label}
              </h3>
            </div>
            {activeTab === 'trending' && (
              <button 
                className={styles.refreshButton}
                onClick={fetchTrendingCards}
                disabled={trendingLoading}
                title="Refresh trending data"
              >
                <FaSync className={trendingLoading ? styles.spinning : ''} />
                Refresh
              </button>
            )}
          </header>

          <div className={styles.messagesContainer}>
            {activeTab === 'trending' ? (
              trendingLoading ? (
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
              )
            ) : (
              loading
                ? <div className="spinner-container">
                    <FaSpinner className="spinner" />
                  </div>
                : msgs.length===0
                  ? <div className={styles.emptyState}>
                      <div className={styles.emptyIcon}>💬</div>
                      <h4>No messages yet</h4>
                      <p>Be the first to start the conversation!</p>
                    </div>
                  : <ul className={styles.messages}>
                      {buildTree(msgs).map(m => (
                        <MessageItem
                          key={m.id}
                          msg={m}
                          depth={0}
                          isLive={activeTab==='live'}
                          thumb={cardThumbs[m.playerId!]||''}
                          cardName={cardNames[m.playerId!]||''}
                          userLoggedIn={!!user}
                          onReply={setReplyTo}
                          onLike={toggleLike}
                        />
                      ))}
                      <div ref={messagesEndRef}/>
                    </ul>
            )}
          </div>

          {activeTab !== 'live' && activeTab !== 'trending' && (
            <div className={styles.formWrap}>
              {replyTo && (
                <div className={styles.replyIndicator}>
                  Replying to @{ msgs.find(m=>m.id===replyTo)?.username }
                  <button
                    onClick={()=>{ setReplyTo(null); setNewText('') }}
                    className={styles.cancelReply}
                  >✕</button>
                </div>
              )}
              <div className={styles.inputContainer}>
                {user && (
                  <img
                  src={user.photoURL && user.photoURL.trim() !== '' ? user.photoURL : '/default_profile.jpg'}
                    className={styles.inputAvatar}
                    alt="You"
                    onError={e => { (e.currentTarget as HTMLImageElement).src = '/default_profile.jpg' }}
                  />
                )}
                <textarea
                  ref={textareaRef}
                  className={styles.textarea}
                  placeholder={user
                    ? (replyTo ? 'Reply…' : `Message #${TABS.find(t=>t.key===activeTab)?.label}`)
                    : 'Log in to chat'
                  }
                  value={newText}
                  onChange={e=>setNewText(e.target.value)}
                  onKeyDown={handleKeyDown}
                  disabled={!user}
                  rows={1}
                />
                <button
                  className={styles.sendBtn}
                  onClick={()=>send(newText, replyTo!)}
                  disabled={!user || !newText.trim()}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
                    <path d="M2 21l21-9L2 3v7l15 2-15 2z"/>
                  </svg>
                </button>
              </div>
            </div>
          )}
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
 * MessageItem component - renders individual messages with threading support
 * Handles replies, likes, player card links (for live comments), and collapse/expand functionality
 */
function MessageItem({
  msg, depth, isLive, thumb, cardName, userLoggedIn, onReply, onLike
}: {
  msg: MessageTree,
  depth: number,      // Nesting level for threaded replies
  isLive: boolean,    // Whether this is in live comments mode
  thumb: string,      // Player card thumbnail (live comments only)
  cardName: string,   // Player name (live comments only)
  userLoggedIn: boolean,
  onReply: (id: string) => void,
  onLike: (id: string) => void
}) {
  const [showTime, setShowTime]   = useState(true)
  const [collapsed, setCollapsed] = useState(true)

  return (
    <li className={`${styles.message} ${depth>0?styles.reply:''}`}>
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
          {isLive && msg.playerId && (
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
          <p className={styles.text}>{msg.text}</p>
          {!isLive && userLoggedIn && (
            <div className={styles.messageActions}>
              <button
                className={styles.actionBtn}
                onClick={()=>onReply(msg.id)}
              >
                <FaReply /> Reply
              </button>
              <button
                className={styles.actionBtn}
                onClick={()=>onLike(msg.id)}
              >
                <FaHeart className={ msg.liked ? styles.liked : '' }/> {msg.likes}
              </button>
            </div>
          )}
        </div>
      </div>

      {msg.replies.length > 0 && (
        <>
          <button
            className={styles.collapseBtn}
            onClick={()=>setCollapsed(c=>!c)}
          >
            {collapsed ? 'Show replies' : 'Hide replies'}
          </button>
          {!collapsed && (
            <ul className={styles.replies}>
              {msg.replies.map(r => (
                <MessageItem
                  key={r.id}
                  msg={r}
                  depth={depth+1}
                  isLive={isLive}
                  thumb={thumb}
                  cardName={cardName}
                  userLoggedIn={userLoggedIn}
                  onReply={onReply}
                  onLike={onLike}
                />
              ))}
            </ul>
          )}
        </>
      )}
    </li>
  )
}