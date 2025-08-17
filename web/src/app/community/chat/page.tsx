// src/app/community/chat/page.tsx
// Chat rooms page - real-time chat in multiple rooms (main, investing, flipping, stub making)
// Features: threaded messages, user search, likes, edit/delete functionality
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

// Icon imports for various chat features
import {
  FaComments,
  FaChartLine,
  FaSyncAlt,
  FaDollarSign,
  FaHeart,
  FaReply,
  FaBars,
  FaTimes,
  FaTrash
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
  likedBy: string[]       // Array of user IDs who liked this message
  editedAt?: number
  editHistory?: {text: string; editedAt: number}[]
}

// User profile data structure from Firestore users collection
interface UserData {
  username: string
  profilePic: string
}

// Message payload structure for API requests
interface MessagePayload {
  text: string
  userId: string
  parentId?: string       // For replies in chat rooms
}

// Recursive message tree structure for threaded conversations
type MessageTree = Message & { replies: MessageTree[] }

// Tab configuration for different chat rooms
const CHAT_TABS = [
  { key: 'main',     label: 'Main Chat',     icon: <FaComments       /> }, // General discussion
  { key: 'invest',   label: 'Investing',     icon: <FaChartLine      /> }, // Investment strategies  
  { key: 'flip',     label: 'Flipping',      icon: <FaSyncAlt        /> }, // Card flipping tips
  { key: 'stub',     label: 'Stub Making',   icon: <FaDollarSign     /> }, // Stub profit methods
] as const

/**
 * Chat page component - real-time chat in multiple dedicated rooms
 * Features threaded conversations, user search, likes, and message management
 */
export default function ChatPage() {
  const auth = getAuth()
  const db   = getFirestore()

  // Authentication and user state
  const [user, setUser] = useState<User | null>(null)
  
  // Tab and navigation state
  const [activeTab, setActive] = useState<typeof CHAT_TABS[number]['key']>('main')
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false)
  
  // Message and chat state
  const [msgs, setMsgs] = useState<Message[]>([])
  const [loading, setLoading] = useState(true)
  const [newText, setNewText] = useState('')
  const [replyTo, setReplyTo] = useState<string | null>(null)

  // Edit message functionality state
  const [editingMessage, setEditingMessage] = useState<string | null>(null)
  const [editText, setEditText] = useState('')
  const [showEditHistory, setShowEditHistory] = useState<Record<string, boolean>>({})

  // DOM references for auto-scrolling and click outside detection
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const textareaRef    = useRef<HTMLTextAreaElement>(null)

  // Set up authentication state listener
  useEffect(() => {
    return onAuthStateChanged(auth, u => setUser(u))
  }, [auth])



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

  // Real-time message listener for chat rooms
  useEffect(() => {
    // Reset state when switching tabs
    setLoading(true)
    setReplyTo(null)
    setMsgs([])

    // Map tab keys to Firestore collection names
    const room = activeTab === 'invest'
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
            profilePicUrl: d.profilePic  || '/default_profile.jpg'
          }
        }
        return acc
      }, {})

      // Merge user profile data into message objects
      const withNames = raw.map(m => ({
        ...m,
        username:      userMap[m.userId]?.username      || 'Unknown',
        profilePicUrl: userMap[m.userId]?.profilePicUrl || '/default_profile.jpg'
      }))

      setMsgs(withNames)
      setLoading(false)
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

  // Send message to appropriate API endpoint
  async function send(text: string, parentId?: string) {
    if (!user) return
    const token = await user.getIdToken()
    
    // Determine API endpoint based on active tab
    const endpoint = `/api/chat/${activeTab === 'invest' ? 'investing' : activeTab}`

    const payload: MessagePayload = { text, userId: user.uid }
    // Add parent ID for threaded replies
    if (parentId) payload.parentId = parentId

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

  // Start editing a message
  const startEditing = (message: Message) => {
    setEditingMessage(message.id)
    setEditText(message.text)
  }

  // Cancel editing
  const cancelEditing = () => {
    setEditingMessage(null)
    setEditText('')
  }

  // Edit message function
  const editMessage = async (messageId: string) => {
    if (!user) return
    if (!editText.trim()) return
    
    try {
      const token = await user.getIdToken()
      const endpoint = `/api/chat/${activeTab === 'invest' ? 'investing' : activeTab}/messages/${messageId}`
      
      const response = await fetch(endpoint, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ text: editText })
      })
      
      if (!response.ok) {
        const error = await response.json()
        alert(error.error || 'Failed to edit message')
        return
      }
      
      // Reset edit state
      setEditingMessage(null)
      setEditText('')
      
      // Messages will be updated via real-time listener
      
    } catch (error) {
      console.error('Edit message error:', error)
      alert('Failed to edit message. Please try again.')
    }
  }

  // Delete message function
  const deleteMessage = async (messageId: string) => {
    if (!user) return
    
    // Confirmation dialog
    if (!window.confirm('Are you sure you want to delete this message? This action cannot be undone.')) {
      return
    }
    
    try {
      const token = await user.getIdToken()
      const endpoint = `/api/chat/${activeTab === 'invest' ? 'investing' : activeTab}/messages/${messageId}`
      
      const response = await fetch(endpoint, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      })
      
      if (!response.ok) {
        const error = await response.json()
        alert(error.error || 'Failed to delete message')
        return
      }
      
      // Messages will be updated via real-time listener
      
    } catch (error) {
      console.error('Delete message error:', error)
      alert('Failed to delete message. Please try again.')
    }
  }

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
          <h2 className={styles.mobileTitle}>Chat</h2>
          <div className={styles.mobileRoomInfo}>
            <span className={styles.roomIcon}>
              {CHAT_TABS.find(t=>t.key===activeTab)?.icon}
            </span>
            <span className={styles.roomName}>
              {CHAT_TABS.find(t=>t.key===activeTab)?.label}
            </span>
          </div>
        </div>

        {/* Navigation sidebar with user search and tab switching */}
        <aside className={`${styles.sidebar} ${mobileSidebarOpen ? styles.sidebarOpen : ''}`}>
          <div className={styles.sidebarHeader}>
            <h2 className={styles.head}>Chat Rooms</h2>
          </div>


          <nav className={styles.tabs}>
            {/* Chat Room Tabs */}
            {CHAT_TABS.map(t => (
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
                {CHAT_TABS.find(t=>t.key===activeTab)?.icon}
              </span>
              <h3 className={styles.roomName}>
                {CHAT_TABS.find(t=>t.key===activeTab)?.label}
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
                    <h4>No messages yet</h4>
                    <p>Be the first to start the conversation!</p>
                  </div>
                : <ul className={styles.messages}>
                    {buildTree(msgs).map(m => (
                      <MessageItem
                        key={m.id}
                        msg={m}
                        depth={0}
                        userLoggedIn={!!user}
                        onReply={setReplyTo}
                        onLike={toggleLike}
                        editingMessage={editingMessage}
                        editText={editText}
                        setEditText={setEditText}
                        onStartEdit={startEditing}
                        onCancelEdit={cancelEditing}
                        onSaveEdit={editMessage}
                        showEditHistory={showEditHistory}
                        onToggleEditHistory={(messageId: string) =>
                          setShowEditHistory(prev => ({
                            ...prev,
                            [messageId]: !prev[messageId]
                          }))
                        }
                        renderMessageText={renderMessageText}
                        currentUserId={user?.uid || null}
                        onDelete={deleteMessage}
                      />
                    ))}
                    <div ref={messagesEndRef}/>
                  </ul>
            }
          </div>

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
                  ? (replyTo ? 'Reply…' : `Message #${CHAT_TABS.find(t=>t.key===activeTab)?.label}`)
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
 * Handles replies, likes, and collapse/expand functionality
 */
function MessageItem({
  msg, depth, userLoggedIn, onReply, onLike,
  editingMessage, editText, setEditText, onStartEdit, onCancelEdit, onSaveEdit,
  showEditHistory, onToggleEditHistory, renderMessageText, currentUserId, onDelete
}: {
  msg: MessageTree,
  depth: number,      // Nesting level for threaded replies
  userLoggedIn: boolean,
  onReply: (id: string) => void,
  onLike: (id: string) => void,
  editingMessage: string | null,
  editText: string,
  setEditText: (text: string) => void,
  onStartEdit: (message: Message) => void,
  onCancelEdit: () => void,
  onSaveEdit: (messageId: string) => void,
  showEditHistory: Record<string, boolean>,
  onToggleEditHistory: (messageId: string) => void,
  renderMessageText: (text: string) => React.ReactNode,
  currentUserId: string | null,
  onDelete: (messageId: string) => void
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
        </div>

        <div className={styles.messageContent}>
          {editingMessage === msg.id ? (
            <div className={styles.editForm}>
              <textarea
                value={editText}
                onChange={e => setEditText(e.target.value)}
                className={styles.editTextarea}
                autoFocus
              />
              <div className={styles.editActions}>
                <button
                  onClick={() => onSaveEdit(msg.id)}
                  disabled={!editText.trim()}
                  className={styles.saveButton}
                >
                  Save
                </button>
                <button
                  onClick={onCancelEdit}
                  className={styles.cancelButton}
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <>
              <p className={styles.text}>
                {renderMessageText(msg.text)}
                {msg.editedAt && (
                  <span className={styles.editedIndicator}>
                    (edited at {new Date(msg.editedAt).toLocaleString([], { hour: '2-digit', minute: '2-digit', month: 'short', day: 'numeric' })})
                    {msg.editHistory && msg.editHistory.length > 0 && (
                      <>
                        {' • '}
                        <button
                          className={styles.showHistoryButton}
                          onClick={() => onToggleEditHistory(msg.id)}
                        >
                          {showEditHistory[msg.id] ? 'Hide' : 'Show'} edit history
                        </button>
                      </>
                    )}
                  </span>
                )}
              </p>
              {msg.editHistory && msg.editHistory.length > 0 && showEditHistory[msg.id] && (
                <div className={styles.editHistoryContainer}>
                  <div className={styles.editHistory}>
                    <h4 className={styles.editHistoryTitle}>Edit History:</h4>
                    {msg.editHistory.map((edit, index) => (
                      <div key={index} className={styles.editHistoryItem}>
                        <div className={styles.editHistoryMeta}>
                          Version {index + 1} - {new Date(edit.editedAt).toLocaleString([], { hour: '2-digit', minute: '2-digit', month: 'short', day: 'numeric' })}
                        </div>
                        <div className={styles.editHistoryText}>
                          {renderMessageText(edit.text)}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
          {userLoggedIn && (
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
              {currentUserId === msg.userId && (
                <>
                  <button
                    className={styles.actionBtn}
                    onClick={() => onStartEdit(msg)}
                    disabled={editingMessage === msg.id}
                  >
                    Edit
                  </button>
                  <button
                    className={styles.deleteButton}
                    onClick={() => onDelete(msg.id)}
                  >
                    <FaTrash /> Delete
                  </button>
                </>
              )}
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
                  userLoggedIn={userLoggedIn}
                  onReply={onReply}
                  onLike={onLike}
                  editingMessage={editingMessage}
                  editText={editText}
                  setEditText={setEditText}
                  onStartEdit={onStartEdit}
                  onCancelEdit={onCancelEdit}
                  onSaveEdit={onSaveEdit}
                  showEditHistory={showEditHistory}
                  onToggleEditHistory={onToggleEditHistory}
                  renderMessageText={renderMessageText}
                  currentUserId={currentUserId}
                  onDelete={onDelete}
                />
              ))}
            </ul>
          )}
        </>
      )}
    </li>
  )
}