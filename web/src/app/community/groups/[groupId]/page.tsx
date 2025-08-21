'use client'
import React, { useState, useEffect, useRef, use } from 'react'
import { useRouter } from 'next/navigation'
import styles from '../../page.module.css'
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
import { FaSpinner, FaUsers, FaCrown, FaSignOutAlt, FaTrash, FaArrowLeft, FaBars, FaTimes, FaHeart, FaReply, FaCog, FaCopy } from 'react-icons/fa'

interface Group {
  id: string
  name: string
  description?: string
  isPrivate: boolean
  inviteCode: string
  ownerId: string
  memberIds: string[]
  memberCount: number
  lastActivity: number
  createdAt: number
}

interface Member {
  userId: string
  username: string
  profilePic: string
  role: 'owner' | 'member'
  joinedAt: number
}

interface Message {
  id: string
  parentId: string | null
  userId: string
  username: string
  profilePicUrl?: string
  text: string
  timestamp: number
  likes: number
  liked: boolean
  editedAt?: number
  editHistory?: {text: string; editedAt: number}[]
}

interface ChatMessageData {
  parentId: string | null
  userId: string
  text: string
  timestamp: number
  likedBy: string[]
  editedAt?: number
  editHistory?: {text: string; editedAt: number}[]
}

interface UserData {
  username: string
  profilePic: string
}

type MessageTree = Message & { replies: MessageTree[] }

export default function GroupPage({ params }: { params: Promise<{ groupId: string }> }) {
  const { groupId } = use(params)
  const router = useRouter()
  const auth = getAuth()
  const db = getFirestore()
  
  const [user, setUser] = useState<User | null>(null)
  const [group, setGroup] = useState<Group | null>(null)
  const [members, setMembers] = useState<Member[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  
  // Chat state
  const [msgs, setMsgs] = useState<Message[]>([])
  const [chatLoading, setChatLoading] = useState(true)
  const [newText, setNewText] = useState('')
  const [replyTo, setReplyTo] = useState<string | null>(null)
  const [lastMessageTime, setLastMessageTime] = useState<number>(0)
  const [sendingMessage, setSendingMessage] = useState(false)
  
  // Edit message functionality state
  const [editingMessage, setEditingMessage] = useState<string | null>(null)
  const [editText, setEditText] = useState('')
  const [showEditHistory, setShowEditHistory] = useState<Record<string, boolean>>({})
  
  // Group settings editing state
  const [editingSettings, setEditingSettings] = useState(false)
  const [editDescription, setEditDescription] = useState('')
  const [editIsPrivate, setEditIsPrivate] = useState(false)
  const [savingSettings, setSavingSettings] = useState(false)
  
  // User profile cache to avoid refetching on every snapshot
  const [userCache, setUserCache] = useState<Record<string, {username: string, profilePicUrl: string}>>({})
  const userCacheRef = useRef<Record<string, {username: string, profilePicUrl: string}>>({})
  
  // UI state
  const [activeTab, setActiveTab] = useState<'chat' | 'members' | 'settings'>('chat')
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false)
  
  // Refs
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    return onAuthStateChanged(auth, u => {
      setUser(u)
      if (!u) {
        router.push('/login')
      }
    })
  }, [auth, router])

  // Load group data
  useEffect(() => {
    console.log('🔥 GROUP LOADING: user exists:', !!user)
    if (!user) return
    
    const loadGroup = async () => {
      try {
        const token = await user.getIdToken()
        const response = await fetch(`/api/groups/${groupId}`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        })
        
        if (!response.ok) {
          const errorData = await response.json()
          throw new Error(errorData.error || 'Failed to load group')
        }
        
        const groupData = await response.json()
        setGroup(groupData)
        console.log('🔥 GROUP LOADING: Group data loaded successfully')
        
        // Transform members data
        const membersData = groupData.members?.map((member: any) => ({
          userId: member.userId,
          username: member.username || 'Unknown',
          profilePic: member.profilePic || '/default_profile.jpg',
          role: member.role,
          joinedAt: member.joinedAt
        })) || []
        
        setMembers(membersData)
        setLoading(false)
        console.log('🔥 GROUP LOADING: Loading complete')
      } catch (error) {
        console.error('🔥 GROUP LOADING: Error loading group:', error)
        setError(error instanceof Error ? error.message : 'Failed to load group')
        setLoading(false)
      }
    }
    
    loadGroup()
  }, [user, groupId])

  // Real-time message listener for group chat
  useEffect(() => {
    console.log('🔥 EFFECT CHECK: user?.uid =', user?.uid, 'group =', !!group, 'groupId =', groupId)
    
    if (!user?.uid || !group) {
      console.log('🔥 EFFECT SKIPPED: Missing user or group. user?.uid:', user?.uid, 'group exists:', !!group)
      return
    }
    
    console.log('🔥 REAL-TIME LISTENER: Starting onSnapshot listener for group', groupId)
    setChatLoading(true)
    setMsgs([])
    setError('') // Clear any previous errors
    
    // Create Firestore query for real-time updates
    const q = query(
      collection(db, `chat_group_${groupId}`),
      orderBy('timestamp', 'desc')
    )
    
    // Subscribe to real-time Firestore updates
    const unsubscribe = onSnapshot(q, async snap => {
      console.log('🔥 REAL-TIME LISTENER: onSnapshot fired with', snap.docs.length, 'messages')
      
      try {
        // Transform Firestore documents to message objects
        const raw = snap.docs.map(d => {
          const data = d.data() as ChatMessageData
          return {
            id: d.id,
            parentId: data.parentId || null,
            userId: data.userId,
            text: data.text,
            timestamp: data.timestamp,
            likes: (data.likedBy || []).length,
            liked: user ? (data.likedBy || []).includes(user.uid) : false,
            editedAt: data.editedAt,
            editHistory: data.editHistory,
          }
        }) as Array<Omit<Message, 'username' | 'profilePicUrl'>>
        
        console.log('🔥 REAL-TIME LISTENER: Processed', raw.length, 'raw messages')
        
        // Handle empty collection case
        if (raw.length === 0) {
          console.log('🔥 REAL-TIME LISTENER: No messages found, setting empty state')
          setMsgs([])
          setChatLoading(false)
          return
        }
        
        // Get unique user IDs and check which ones we need to fetch
        const uids = Array.from(new Set(raw.map(m => m.userId)))
        const currentCache = userCacheRef.current
        const newUids = uids.filter(uid => !currentCache[uid])
        
        console.log('🔥 REAL-TIME LISTENER: Need to fetch profiles for', newUids.length, 'users out of', uids.length, 'total')
        
        // Only fetch user profiles for users not in cache
        let newUserData: Record<string, {username: string, profilePicUrl: string}> = {}
        if (newUids.length > 0) {
          console.log('🔥 REAL-TIME LISTENER: Starting user profile fetch for:', newUids)
          
          try {
            const userDocs = await Promise.all(
              newUids.map(uid => getDoc(doc(db, 'users', uid)))
            )
            console.log('🔥 REAL-TIME LISTENER: User profile fetch completed')
            
            newUserData = userDocs.reduce<Record<string,{username:string,profilePicUrl:string}>>((acc, ds) => {
              if (ds.exists()) {
                const d = ds.data() as UserData
                acc[ds.id] = {
                  username: d.username || 'Unknown',
                  profilePicUrl: d.profilePic || '/default_profile.jpg'
                }
              }
              return acc
            }, {})
            
            console.log('🔥 REAL-TIME LISTENER: Processed user data for', Object.keys(newUserData).length, 'users')
            
            // Update user cache with new data
            const updatedCache = { ...currentCache, ...newUserData }
            userCacheRef.current = updatedCache
            setUserCache(updatedCache)
          } catch (userFetchError) {
            console.error('🔥 REAL-TIME LISTENER: Error fetching user profiles:', userFetchError)
            // Continue with cached data only
          }
        }
        
        // Combine cached and new user data
        const allUserData = { ...currentCache, ...newUserData }
        
        // Merge user profile data into message objects
        const withNames = raw.map(m => ({
          ...m,
          username: allUserData[m.userId]?.username || 'Unknown',
          profilePicUrl: allUserData[m.userId]?.profilePicUrl || '/default_profile.jpg'
        }))
        
        console.log('🔥 REAL-TIME LISTENER: Final message processing complete, setting', withNames.length, 'messages')
        setMsgs(withNames)
        setChatLoading(false)
        
      } catch (error) {
        console.error('🔥 REAL-TIME LISTENER: Error in onSnapshot callback:', error)
        setError('Failed to load chat messages. Please refresh the page.')
        setChatLoading(false)
      }
    }, error => {
      // Handle Firestore listener errors (like permission denied)
      console.error('🔥 REAL-TIME LISTENER: Firestore listener error:', error)
      
      if (error.code === 'permission-denied') {
        setError('You do not have permission to access this group chat. Please make sure you are a member of this group.')
      } else if (error.code === 'failed-precondition') {
        setError('Chat is temporarily unavailable. Please try again later.')
      } else {
        setError('Unable to connect to chat. Please check your internet connection and try again.')
      }
      
      setChatLoading(false)
      setMsgs([])
    })
    
    // Cleanup listener when component unmounts or dependencies change
    return () => {
      console.log('🔥 REAL-TIME LISTENER: Cleaning up onSnapshot listener')
      unsubscribe()
    }
  }, [user?.uid, group, groupId, db])

  // Auto-resize textarea
  useEffect(() => {
    if (!textareaRef.current) return
    textareaRef.current.style.height = 'auto'
    textareaRef.current.style.height =
      Math.min(textareaRef.current.scrollHeight, 150) + 'px'
  }, [newText])

  const buildTree = (list: Message[]): MessageTree[] => {
    const byId: Record<string, MessageTree> = {}
    list.forEach(m => (byId[m.id] = { ...m, replies: [] }))
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

  const send = async (text: string, parentId?: string) => {
    if (!user || !group) return
    
    // Client-side rate limiting
    const now = Date.now()
    if (now - lastMessageTime < 2000 && lastMessageTime > 0) {
      alert("Please wait a moment before sending another message.")
      return
    }
    
    setSendingMessage(true)
    
    try {
      const token = await user.getIdToken()
      
      const payload = { text, parentId: parentId || null }
      
      const res = await fetch(`/api/groups/${groupId}/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      })
      
      if (!res.ok) {
        const error = await res.json()
        alert(error.error || 'Failed to send message')
        return
      }
      
      setNewText('')
      setReplyTo(null)
      setLastMessageTime(now)
      
      // No need to manually refresh - real-time listener will handle updates
    } catch (error) {
      console.error('Error sending message:', error)
      alert('Failed to send message. Please try again.')
    } finally {
      setSendingMessage(false)
    }
  }

  const toggleLike = async (id: string) => {
    if (!user) return alert('Log in to like')
    const token = await user.getIdToken()
    
    const res = await fetch(`/api/groups/${groupId}/messages/${id}/likes`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      }
    })
    
    if (!res.ok) return console.error('Like failed', await res.json())
    
    // No need to manually update state - real-time listener will handle updates
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
      const endpoint = `/api/groups/${groupId}/messages/${messageId}`
      
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
      const endpoint = `/api/groups/${groupId}/messages/${messageId}`
      
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

  // Start editing group settings
  const startEditingSettings = () => {
    if (!group) return
    setEditingSettings(true)
    setEditDescription(group.description || '')
    setEditIsPrivate(group.isPrivate || false)
  }

  // Cancel editing settings
  const cancelEditingSettings = () => {
    setEditingSettings(false)
    setEditDescription('')
    setEditIsPrivate(false)
  }

  // Save group settings
  const saveGroupSettings = async () => {
    if (!user || !group) return
    
    setSavingSettings(true)
    
    try {
      const token = await user.getIdToken()
      const response = await fetch(`/api/groups/${groupId}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          description: editDescription.trim(),
          isPrivate: editIsPrivate
        })
      })
      
      if (!response.ok) {
        const error = await response.json()
        alert(error.error || 'Failed to update group settings')
        return
      }
      
      // Get the updated group data from API response
      const responseData = await response.json()
      
      // Update local group state with the returned data
      if (responseData.group) {
        setGroup(responseData.group)
      }
      
      setEditingSettings(false)
      setSuccess('Group settings updated successfully')
      
    } catch (error) {
      console.error('Save settings error:', error)
      alert('Failed to save settings. Please try again.')
    } finally {
      setSavingSettings(false)
    }
  }

  // Copy invite code to clipboard
  const copyInviteCode = async () => {
    if (!group?.inviteCode) return
    
    try {
      await navigator.clipboard.writeText(group.inviteCode)
      setSuccess('Invite code copied to clipboard!')
    } catch (error) {
      console.error('Failed to copy invite code:', error)
      alert('Failed to copy invite code. Please copy it manually.')
    }
  }

  const handleLeaveGroup = async () => {
    if (!user || !group || !confirm('Are you sure you want to leave this group?')) return
    
    try {
      const token = await user.getIdToken()
      const response = await fetch(`/api/groups/${groupId}/leave`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })
      
      if (response.ok) {
        setSuccess('Left group successfully')
        setTimeout(() => router.push('/community/groups'), 1500)
      } else {
        const data = await response.json()
        setError(data.error || 'Failed to leave group')
      }
    } catch (error) {
      setError('Failed to leave group. Please try again.')
    }
  }

  const handleDeleteGroup = async () => {
    if (!user || !group || !confirm('Are you sure you want to delete this group? This action cannot be undone.')) return
    
    try {
      const token = await user.getIdToken()
      const response = await fetch(`/api/groups/${groupId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })
      
      if (response.ok) {
        setSuccess('Group deleted successfully')
        setTimeout(() => router.push('/community/groups'), 1500)
      } else {
        const data = await response.json()
        setError(data.error || 'Failed to delete group')
      }
    } catch (error) {
      setError('Failed to delete group. Please try again.')
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      if (newText.trim()) send(newText, replyTo!)
    }
  }

  const renderMessageText = (text: string) => {
    const mentionRegex = /@(\w+)/g
    const parts = text.split(mentionRegex)
    
    return parts.map((part, index) => {
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

  if (loading) {
    return (
      <main className={styles.page}>
        <div className="spinner-container">
          <FaSpinner className="spinner" />
        </div>
      </main>
    )
  }

  if (error || !group) {
    return (
      <main className={styles.page}>
        <div className={styles.container}>
          <div className={styles.errorMessage}>
            {error || 'Group not found'}
          </div>
          <button 
            onClick={() => router.push('/community/groups')}
            className={styles.enterGroupBtn}
          >
            <FaArrowLeft /> Back to Groups
          </button>
        </div>
      </main>
    )
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
          <button 
            onClick={() => router.push('/community/groups')}
            className={styles.mobileMenuButton}
          >
            <FaArrowLeft />
          </button>
          <h2 className={styles.mobileTitle}>{group.name}</h2>
        </div>

        {/* Sidebar */}
        <aside className={`${styles.sidebar} ${mobileSidebarOpen ? styles.sidebarOpen : ''}`}>
          <div className={styles.sidebarHeader}>
            <button 
              onClick={() => router.push('/community/groups')}
              className={styles.backBtn}
            >
              <FaArrowLeft /> Back
            </button>
            <h2 className={styles.head}>{group.name}</h2>
            {group.description && (
              <p className={styles.groupDescription}>{group.description}</p>
            )}
          </div>

          <nav className={styles.tabs}>
            <button
              className={`${styles.tab} ${activeTab === 'chat' ? styles.active : ''}`}
              onClick={() => {
                setActiveTab('chat')
                setMobileSidebarOpen(false)
              }}
            >
              <span className={styles.tabIcon}>💬</span>
              <span className={styles.tabLabel}>Chat</span>
            </button>
            <button
              className={`${styles.tab} ${activeTab === 'members' ? styles.active : ''}`}
              onClick={() => {
                setActiveTab('members')
                setMobileSidebarOpen(false)
              }}
            >
              <span className={styles.tabIcon}><FaUsers /></span>
              <span className={styles.tabLabel}>Members ({group.memberCount})</span>
            </button>
            {group.ownerId === user?.uid && (
              <button
                className={`${styles.tab} ${activeTab === 'settings' ? styles.active : ''}`}
                onClick={() => {
                  setActiveTab('settings')
                  setMobileSidebarOpen(false)
                }}
              >
                <span className={styles.tabIcon}><FaCog /></span>
                <span className={styles.tabLabel}>Settings</span>
              </button>
            )}
          </nav>

          {group.ownerId !== user?.uid && (
            <div className={styles.groupActions}>
              <button
                className={styles.leaveGroupBtn}
                onClick={handleLeaveGroup}
              >
                <FaSignOutAlt /> Leave Group
              </button>
            </div>
          )}

          <div className={styles.userInfo}>
            {user && (
              <>
                <img
                  src={user.photoURL && user.photoURL.trim() !== '' ? user.photoURL : '/default_profile.jpg'}
                  className={styles.userAvatar}
                  alt={user.displayName || 'You'}
                  onError={e => { (e.currentTarget as HTMLImageElement).src = '/default_profile.jpg' }}
                />
                <div className={styles.userDetails}>
                  <div className={styles.userName}>
                    {user.displayName || 'You'}
                  </div>
                  <div className={styles.userStatus}>Online</div>
                </div>
              </>
            )}
          </div>
        </aside>

        {/* Main content area */}
        <section className={styles.chatArea}>
          {error && (
            <div className={styles.errorMessage}>
              {error}
            </div>
          )}
          
          {success && (
            <div className={styles.successMessage}>
              {success}
            </div>
          )}

          {activeTab === 'chat' && (
            <>
              <header className={styles.chatHeader}>
                <div className={styles.roomInfo}>
                  <span className={styles.roomIcon}>💬</span>
                  <h3 className={styles.roomName}>
                    {group.name} Chat
                  </h3>
                </div>
              </header>

              <div className={styles.messagesContainer}>
                {chatLoading ? (
                  <div className="spinner-container">
                    <FaSpinner className="spinner" />
                  </div>
                ) : msgs.length === 0 ? (
                  <div className={styles.emptyState}>
                    <div className={styles.emptyIcon}>💬</div>
                    <h4>No messages yet</h4>
                    <p>Be the first to start the conversation!</p>
                  </div>
                ) : (
                  <ul className={styles.messages}>
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
                )}
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
                      ? (replyTo ? 'Reply…' : `Message ${group.name}`)
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
                    disabled={!user || !newText.trim() || sendingMessage}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
                      <path d="M2 21l21-9L2 3v7l15 2-15 2z"/>
                    </svg>
                  </button>
                </div>
              </div>
            </>
          )}

          {activeTab === 'members' && (
            <div className={styles.tabContent}>
              <div className={styles.tabHeader}>
                <h3>Group Members</h3>
                <p>{group.memberCount} member{group.memberCount !== 1 ? 's' : ''}</p>
              </div>
              
              <div className={styles.membersList}>
                {members.map(member => (
                  <div key={member.userId} className={styles.memberCard}>
                    <img
                      src={member.profilePic}
                      className={styles.memberAvatar}
                      alt={member.username}
                      onError={e => { (e.currentTarget as HTMLImageElement).src = '/default_profile.jpg' }}
                    />
                    <div className={styles.memberInfo}>
                      <div className={styles.memberName}>
                        <a href={`/account/${member.userId}`}>
                          {member.username}
                        </a>
                        {member.role === 'owner' && (
                          <span className={styles.ownerBadge}>
                            <FaCrown /> Owner
                          </span>
                        )}
                      </div>
                      <div className={styles.memberMeta}>
                        Joined {new Date(member.joinedAt).toLocaleDateString()}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'settings' && (
            <div className={styles.tabContent}>
              <div className={styles.tabHeader}>
                <h3>Group Settings</h3>
                <p>Manage your group settings</p>
              </div>
              
              <div className={styles.settingsContainer}>
                {editingSettings ? (
                  <div className={styles.settingsForm}>
                    <div className={styles.formGroup}>
                      <label className={styles.formLabel}>Group Description</label>
                      <textarea
                        className={styles.formTextarea}
                        value={editDescription}
                        onChange={e => setEditDescription(e.target.value)}
                        placeholder="Enter a description for your group..."
                        rows={4}
                        maxLength={200}
                      />
                      <div className={styles.characterCount}>
                        {editDescription.length}/200 characters
                      </div>
                    </div>

                    <div className={styles.formGroup}>
                      <label className={styles.formLabel}>Privacy Setting</label>
                      <div className={styles.privacyToggle}>
                        <label className={styles.radioOption}>
                          <input
                            type="radio"
                            name="privacy"
                            checked={!editIsPrivate}
                            onChange={() => setEditIsPrivate(false)}
                          />
                          <span className={styles.radioLabel}>
                            <strong>Public</strong> - Anyone can find and join this group
                          </span>
                        </label>
                        <label className={styles.radioOption}>
                          <input
                            type="radio"
                            name="privacy"
                            checked={editIsPrivate}
                            onChange={() => setEditIsPrivate(true)}
                          />
                          <span className={styles.radioLabel}>
                            <strong>Private</strong> - Only people with invite code can join
                          </span>
                        </label>
                      </div>
                    </div>

                    <div className={styles.formActions}>
                      <button
                        className={styles.saveButton}
                        onClick={saveGroupSettings}
                        disabled={savingSettings}
                      >
                        {savingSettings ? <FaSpinner className="spinner" /> : 'Save Changes'}
                      </button>
                      <button
                        className={styles.cancelButton}
                        onClick={cancelEditingSettings}
                        disabled={savingSettings}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className={styles.settingsDisplay}>
                    <div className={styles.settingItem}>
                      <h4>Description</h4>
                      <p className={styles.settingValue}>
                        {group.description || 'No description set'}
                      </p>
                    </div>

                    <div className={styles.settingItem}>
                      <h4>Privacy</h4>
                      <p className={styles.settingValue}>
                        {group.isPrivate ? 'Private Group' : 'Public Group'}
                      </p>
                      <p className={styles.settingDescription}>
                        {group.isPrivate 
                          ? 'Only people with the invite code can join this group'
                          : 'Anyone can find and join this group'
                        }
                      </p>
                    </div>

                    {group.isPrivate && (
                      <div className={styles.settingItem}>
                        <h4>Invite Code</h4>
                        <div className={styles.inviteCodeContainer}>
                          <code className={styles.inviteCode}>{group.inviteCode}</code>
                          <button
                            className={styles.copyButton}
                            onClick={copyInviteCode}
                            title="Copy invite code"
                          >
                            <FaCopy />
                          </button>
                        </div>
                        <p className={styles.settingDescription}>
                          Share this code with people you want to invite
                        </p>
                      </div>
                    )}

                    <button
                      className={styles.editButton}
                      onClick={startEditingSettings}
                    >
                      <FaCog /> Edit Settings
                    </button>

                    <div className={styles.dangerZone}>
                      <p>Permanently delete this group and all its messages.</p>
                      <button
                        className={styles.deleteGroupBtn}
                        onClick={handleDeleteGroup}
                      >
                        <FaTrash /> Delete Group
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </section>
      </div>
    </main>
  )
}

function MessageItem({
  msg, depth, userLoggedIn, onReply, onLike,
  editingMessage, editText, setEditText, onStartEdit, onCancelEdit, onSaveEdit,
  showEditHistory, onToggleEditHistory, renderMessageText, currentUserId, onDelete
}: {
  msg: MessageTree,
  depth: number,
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
  const [showTime, setShowTime] = useState(false)
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

function MessageTime({ timestamp }: { timestamp: number }) {
  const [label, setLabel] = useState<string | null>(null)

  useEffect(() => {
    function fmt() {
      const diff = Date.now() - timestamp
      if (diff < 2*60_000)       return 'just now'
      if (diff < 60*60_000)      return `${Math.floor(diff/60_000)}m ago`
      if (diff < 24*60*60_000)   return `${Math.floor(diff/3_600_000)}h ago`
      return `${Math.floor(diff/86_400_000)}d ago`
    }

    setLabel(fmt())
    const nextIn = 60_000 - (Date.now() - timestamp) % 60_000
    const timer = setTimeout(() => setLabel(fmt()), nextIn)
    return () => clearTimeout(timer)
  }, [timestamp])

  if (label === null) return <></>
  return <span className={styles.time}>{label}</span>
}