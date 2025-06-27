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
  FaReply
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

const TABS = [
  { key: 'live',   label: 'Live Comments', icon: <FaBroadcastTower /> },
  { key: 'main',   label: 'Main Chat',     icon: <FaComments      /> },
  { key: 'invest', label: 'Investing',     icon: <FaChartLine     /> },
  { key: 'flip',   label: 'Flipping',      icon: <FaSyncAlt       /> },
  { key: 'stub',   label: 'Stub Making',   icon: <FaDollarSign    /> },
] as const

export default function CommunityPage() {
  const auth = getAuth()
  const [user, setUser] = useState<User | null>(null)
  const [activeTab, setActive] = useState<typeof TABS[number]['key']>('live')
  const [msgs, setMsgs] = useState<Message[]>([])
  const [loading, setLoading] = useState(true)
  const [newText, setNewText] = useState('')
  const [replyTo, setReplyTo] = useState<string | null>(null)
  const [cardThumbs, setCardThumbs] = useState<Record<string, string>>({})
  const [cardNames, setCardNames]   = useState<Record<string, string>>({})

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const textareaRef    = useRef<HTMLTextAreaElement>(null)

  useEffect(() => onAuthStateChanged(auth, u => setUser(u)), [auth])

  useEffect(() => {
    setLoading(true)
    setMsgs([])
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
        setMsgs(data)

        if (activeTab === 'live') {
          const ids = Array.from(new Set(
            data.map(m => m.playerId).filter(Boolean)
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

  const buildTree = (list: Message[]) => {
    const byId: Record<string, (Message & { replies: Message[] })> = {}
    list.forEach(m => byId[m.id] = { ...m, replies: [] })
    const roots: (Message & { replies: Message[] })[] = []
    Object.values(byId).forEach(m => {
      if (m.parentId && byId[m.parentId]) byId[m.parentId].replies.push(m)
      else roots.push(m)
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
    setMsgs(data)
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
    setMsgs(ms => ms.map(m =>
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
        {/* SIDEBAR */}
        <aside className={styles.sidebar}>
          <div className={styles.sidebarHeader}>
            <h2 className={styles.head}>Community</h2>
          </div>
          <nav className={styles.tabs}>
            {TABS.map(t => (
              <button
                key={t.key}
                className={`${styles.tab} ${activeTab===t.key?styles.active:''}`}
                onClick={()=>{
                  setActive(t.key)
                  setReplyTo(null)
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
                    src={user.photoURL||'/placeholder-user.png'}
                    className={styles.userAvatar}
                    alt={user.displayName||'You'}
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
              {activeTab==='live' && (
                <span className={styles.liveBadge}>LIVE</span>
              )}
            </div>
          </header>

          <div className={styles.messagesContainer}>
            {loading
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
            }
          </div>

          {activeTab !== 'live' && (
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
                    src={user.photoURL||'/placeholder-user.png'}
                    className={styles.inputAvatar}
                    alt="You"
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
}:{
  msg: Message & { replies: Message[] },
  depth: number,
  isLive: boolean,
  thumb: string,
  cardName: string,
  userLoggedIn: boolean,
  onReply: (id:string)=>void,
  onLike: (id:string)=>void
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
            src={msg.profilePicUrl||'/placeholder-user.png'}
            className={styles.avatar}
            alt={msg.username}
          />
          <a href={`/account/${msg.userId}`} className={styles.user}>{msg.username}</a>
          {showTime && (
            <span className={styles.time}>
              {new Date(msg.timestamp).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})}
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

      {msg.replies.length>0 && (
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
