'use client'

import React, { useState, useEffect, useRef } from 'react'
import styles from './page.module.css'
import { getAuth, onAuthStateChanged, type User } from 'firebase/auth'

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

interface Message {
  id: string
  parentId: string | null
  userId: string
  username: string
  profilePicUrl?: string
  text: string
  timestamp: number
  playerId?: string
  playerName?: string
  likes: number
  liked: boolean
}

interface UserSearchResult {
  uid: string
  username: string
  profilePic: string
}

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

// Recursive message type with replies
type MessageTree = Message & { replies: MessageTree[] }

const TABS = [
  { key: 'live',     label: 'Live Comments', icon: <FaBroadcastTower /> },
  { key: 'trending', label: 'Trending',      icon: <FaFire           /> },
  { key: 'main',     label: 'Main Chat',     icon: <FaComments       /> },
  { key: 'invest',   label: 'Investing',     icon: <FaChartLine      /> },
  { key: 'flip',     label: 'Flipping',      icon: <FaSyncAlt        /> },
  { key: 'stub',     label: 'Stub Making',   icon: <FaDollarSign     /> },
] as const

export default function CommunityPage() {
  const auth = getAuth()
  const [user, setUser] = useState<User | null>(null)
  const [activeTab, setActive] = useState<typeof TABS[number]['key']>('live')
  const [msgs, setLoadingMsgs] = useState<Message[]>([])
  const [loading, setLoading] = useState(true)
  const [newText, setNewText] = useState('')
  const [replyTo, setReplyTo] = useState<string | null>(null)
  const [cardThumbs, setCardThumbs] = useState<Record<string, string>>({})
  const [cardNames, setCardNames]   = useState<Record<string, string>>({})
  const [trendingCards, setTrendingCards] = useState<TrendingCard[]>([])
  const [trendingLoading, setTrendingLoading] = useState(false)
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false)
  
  // User search state
  const [userSearch, setUserSearch] = useState('')
  const [userMatches, setUserMatches] = useState<UserSearchResult[]>([])
  const [userSearchOpen, setUserSearchOpen] = useState(false)

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const textareaRef    = useRef<HTMLTextAreaElement>(null)
  const userSearchRef  = useRef<HTMLDivElement>(null)

  useEffect(() => onAuthStateChanged(auth, u => setUser(u)), [auth])

  // Function to fetch trending cards
  const fetchTrendingCards = async () => {
    setTrendingLoading(true)
    try {
      const response = await fetch('/api/trending/cards', {
        cache: 'no-store'
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

  // User search effect
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
      } catch (error) {
        console.error('User search failed:', error)
        setUserMatches([])
      }
    }

    const timeoutId = setTimeout(searchUsers, 300)
    return () => clearTimeout(timeoutId)
  }, [userSearch])

  // Close user search on outside click
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

  // Close sidebar when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      const sidebar = document.querySelector(`.${styles.sidebar}`)
      if (mobileSidebarOpen && sidebar && !sidebar.contains(event.target as Node)) {
        setMobileSidebarOpen(false)
      }
    }
    
    if (mobileSidebarOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [mobileSidebarOpen])

  // Auto-refresh trending data on window focus
  useEffect(() => {
    const handleFocus = () => {
      if (activeTab === 'trending') {
        fetchTrendingCards()
      }
    }

    window.addEventListener('focus', handleFocus)
    return () => window.removeEventListener('focus', handleFocus)
  }, [activeTab])

  useEffect(() => {
    if (activeTab === 'trending') {
      fetchTrendingCards()
      return
    }

    setLoading(true)
    setLoadingMsgs([])
    setReplyTo(null)
    setCardThumbs({})
    setCardNames({})

    const endpoint =
      activeTab === 'live'
        ? '/api/comments/all'
        : `/api/chat/${activeTab === 'invest' ? 'investing' : activeTab}`

    fetch(endpoint)
      .then(r => r.json())
      .then(async (data: Message[]) => {
        data.forEach(m => { if (m.likes == null) m.likes = 0 })
        setLoadingMsgs(data)

        if (activeTab === 'live') {
          // filter out undefined and narrow type to string
          const ids = Array.from(new Set(
            data
              .map(m => m.playerId)
              .filter((x): x is string => Boolean(x))
          ))

          const thumbs: Record<string, string> = {}
          const names:  Record<string, string> = {}

          await Promise.all(ids.map(async id => {
            const res = await fetch(`/api/cards/${id}`)
            if (!res.ok) return
            const c = await res.json() as { baked_img?: string, name?: string }
            if (c.baked_img) thumbs[id] = c.baked_img
            if (c.name)       names[id]  = c.name
          }))

          setCardThumbs(thumbs)
          setCardNames(names)
        }
      })
      .finally(() => setLoading(false))
  }, [activeTab])

  useEffect(() => {
    if (!textareaRef.current) return
    textareaRef.current.style.height = 'auto'
    textareaRef.current.style.height =
      Math.min(textareaRef.current.scrollHeight, 150) + 'px'
  }, [newText])

  // Build a tree of messages with replies
  const buildTree = (list: Message[]): MessageTree[] => {
    const byId: Record<string, MessageTree> = {}
    list.forEach(m => byId[m.id] = { ...m, replies: [] })
    const roots: MessageTree[] = []
    Object.values(byId).forEach(m => {
      if (m.parentId && byId[m.parentId]) {
        byId[m.parentId].replies.push(m)
      } else {
        roots.push(m)
      }
    })
    return roots
  }

  async function send(text: string, parentId?: string) {
    if (!user) return
    const token = await user.getIdToken()
    const endpoint =
      activeTab === 'live'
        ? `/api/cards/${replyTo ? msgs.find(m=>m.id===replyTo)?.playerId : ''}/comments`
        : `/api/chat/${activeTab === 'invest' ? 'investing' : activeTab}`

    const payload: any = { text, userId: user.uid }
    if (parentId && activeTab !== 'live') payload.parentId = parentId

    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type':'application/json',
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify(payload)
    })
    if (!res.ok) {
      console.error(await res.json())
      return alert('Failed to send')
    }
    setNewText('')
    setReplyTo(null)
    const r2 = await fetch(endpoint)
    const data = await r2.json()
    data.forEach((m:Message)=>{ if (m.likes==null) m.likes=0 })
    setLoadingMsgs(data)
  }

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
    setLoadingMsgs(ms => ms.map(m =>
        m.id===id
            ? {
                ...m,
                liked: toggled,
                likes: m.likes + (toggled ? +1 : -1)
            }
            : m
        ))
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      if (newText.trim()) send(newText, replyTo!)
    }
  }

  return (
    <main className={styles.page}>
      <div className={styles.container}>
        {/* Mobile header */}
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

        {/* SIDEBAR */}
        <aside className={`${styles.sidebar} ${mobileSidebarOpen ? styles.sidebarOpen : ''}`}>
          <div className={styles.sidebarHeader}>
            <h2 className={styles.head}>Community</h2>
          </div>

          {/* User Search */}
          <div className={styles.userSearchContainer} ref={userSearchRef}>
            <input
              type="text"
              className={styles.userSearchInput}
              placeholder="Search users..."
              value={userSearch}
              onChange={e => setUserSearch(e.target.value)}
            />
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
                <div className={styles.loadingContainer}>
                  <div className={styles.loadingSpinner}></div>
                  <p>Loading trending cards…</p>
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
                ? <div className={styles.loadingContainer}>
                    <div className={styles.loadingSpinner}></div>
                    <p>Loading messages…</p>
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

function MessageItem({
  msg, depth, isLive, thumb, cardName, userLoggedIn, onReply, onLike
}: {
  msg: MessageTree,
  depth: number,
  isLive: boolean,
  thumb: string,
  cardName: string,
  userLoggedIn: boolean,
  onReply: (id: string) => void,
  onLike: (id: string) => void
}) {
  const [showTime, setShowTime]   = useState(false)
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
          {showTime && (
            <span className={styles.time}>
              {new Date(msg.timestamp).toLocaleString([], {
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
              })}
            </span>
          )}
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