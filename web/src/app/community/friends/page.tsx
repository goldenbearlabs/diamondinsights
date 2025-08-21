// src/app/community/friends/page.tsx
// Friends page - full friends functionality with tabs and real data
// Features: friends list, friend requests management, user search
'use client'

import React, { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import styles from '../page.module.css'
import { getAuth, onAuthStateChanged, type User } from 'firebase/auth'

// Icon imports for friends features
import {
  FaUsers,
  FaBars,
  FaTimes,
  FaUserPlus,
  FaHeart,
  FaComments,
  FaCheck,
  FaClock,
  FaUserCheck,
  FaSpinner,
  FaSync,
  FaSearch
} from 'react-icons/fa'

// User search result structure for user lookup functionality
interface UserSearchResult {
  uid: string
  username: string
  profilePic: string
}

// Friend data interfaces from our APIs
interface FriendData {
  userId: string
  username: string
  profilePic: string
  friendsSince: number
  isOnline?: boolean
}

interface FriendRequestData {
  requestId: string
  userId: string
  username: string
  profilePic: string
  message?: string
  timestamp: number
  direction: 'incoming' | 'outgoing'
}

interface RecommendedUser {
  userId: string
  username: string
  profilePic: string
  joinedDate: number
  friendsCount?: number
}

/**
 * Friends page component - full friends functionality
 * Features: friends list, friend requests, user search
 */
export default function FriendsPage() {
  const auth = getAuth()

  // Authentication and user state
  const [user, setUser] = useState<User | null>(null)
  
  // Tab and navigation state
  const [activeTab, setActiveTab] = useState<'friends' | 'requests' | 'search'>('friends')
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false)

  // Friends data state
  const [friends, setFriends] = useState<FriendData[]>([])
  const [friendRequests, setFriendRequests] = useState<{
    incoming: FriendRequestData[]
    outgoing: FriendRequestData[]
  }>({ incoming: [], outgoing: [] })
  const [recommendedUsers, setRecommendedUsers] = useState<RecommendedUser[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingRecommendations, setLoadingRecommendations] = useState(false)
  const [processingRequests, setProcessingRequests] = useState<Set<string>>(new Set())

  // User search functionality state (sidebar)
  const [userSearch, setUserSearch] = useState('')
  const [userMatches, setUserMatches] = useState<UserSearchResult[]>([])
  const [userSearchOpen, setUserSearchOpen] = useState(false)

  // Top search functionality state (Find Friends tab)
  const [topSearch, setTopSearch] = useState('')
  const [topMatches, setTopMatches] = useState<UserSearchResult[]>([])
  const [topSearchOpen, setTopSearchOpen] = useState(false)

  // DOM references for click outside detection
  const userSearchRef = useRef<HTMLDivElement>(null)
  const topSearchRef = useRef<HTMLDivElement>(null)

  // Set up authentication state listener
  useEffect(() => {
    return onAuthStateChanged(auth, u => {
      setUser(u)
      if (u) {
        loadFriendsData(u)
        loadRecommendedUsers(u)
      } else {
        setLoading(false)
      }
    })
  }, [auth])

  // Load friends and friend requests data
  const loadFriendsData = async (currentUser: User) => {
    if (!currentUser) return

    try {
      const token = await currentUser.getIdToken()
      
      // Load friends list and friend requests in parallel
      const [friendsResponse, requestsResponse] = await Promise.all([
        fetch(`/api/friends/list/${currentUser.uid}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        }),
        fetch('/api/friends/requests', {
          headers: { 'Authorization': `Bearer ${token}` }
        })
      ])

      if (friendsResponse.ok) {
        const friendsData = await friendsResponse.json()
        setFriends(friendsData.friends || [])
      }

      if (requestsResponse.ok) {
        const requestsData = await requestsResponse.json()
        setFriendRequests({
          incoming: requestsData.incoming || [],
          outgoing: requestsData.outgoing || []
        })
      }
    } catch (error) {
      console.error('Error loading friends data:', error)
    } finally {
      setLoading(false)
    }
  }

  // Load recommended users
  const loadRecommendedUsers = async (currentUser: User) => {
    if (!currentUser) return

    setLoadingRecommendations(true)
    try {
      const token = await currentUser.getIdToken()
      const response = await fetch('/api/users/recommendations', {
        headers: { 'Authorization': `Bearer ${token}` }
      })

      if (response.ok) {
        const data = await response.json()
        setRecommendedUsers(data.recommendations || [])
      }
    } catch (error) {
      console.error('Error loading recommended users:', error)
    } finally {
      setLoadingRecommendations(false)
    }
  }

  // Refresh recommended users
  const refreshRecommendations = () => {
    if (user) {
      loadRecommendedUsers(user)
    }
  }

  // Handle accepting/declining friend requests
  const handleFriendRequest = async (requestId: string, action: 'accept' | 'decline') => {
    if (!user) return

    setProcessingRequests(prev => new Set(prev).add(requestId))

    try {
      const token = await user.getIdToken()
      const response = await fetch('/api/friends/respond', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ requestId, action })
      })

      if (response.ok) {
        // Refresh friends data to get updated lists
        await loadFriendsData(user)
      } else {
        const error = await response.json()
        alert(error.error || `Failed to ${action} friend request`)
      }
    } catch (error) {
      console.error(`Error ${action}ing friend request:`, error)
      alert(`Failed to ${action} friend request`)
    } finally {
      setProcessingRequests(prev => {
        const newSet = new Set(prev)
        newSet.delete(requestId)
        return newSet
      })
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

  // Top search functionality with debounced API calls
  useEffect(() => {
    const searchTopUsers = async () => {
      const val = topSearch.trim()
      if (val.length < 2) {
        setTopMatches([])
        setTopSearchOpen(false)
        return
      }

      try {
        const res = await fetch(`/api/users/search?q=${encodeURIComponent(val)}`)
        const data = await res.json()
        setTopMatches(data)
        setTopSearchOpen(true)
      } catch {
        setTopMatches([])
      }
    }

    // Debounce search to avoid excessive API calls
    const timeoutId = setTimeout(searchTopUsers, 300)
    return () => clearTimeout(timeoutId)
  }, [topSearch])

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

  // Close top search dropdown when clicking outside
  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (topSearchRef.current && !topSearchRef.current.contains(e.target as Node)) {
        setTopSearchOpen(false)
      }
    }
    if (topSearchOpen) {
      document.addEventListener('click', onClick)
      return () => document.removeEventListener('click', onClick)
    }
  }, [topSearchOpen])

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
          <h2 className={styles.mobileTitle}>Friends</h2>
          <div className={styles.mobileRoomInfo}>
            <span className={styles.roomIcon}>
              <FaUsers />
            </span>
            <span className={styles.roomName}>
              Friends
            </span>
          </div>
        </div>

        {/* Navigation sidebar with user search */}
        <aside className={`${styles.sidebar} ${mobileSidebarOpen ? styles.sidebarOpen : ''}`}>
          <div className={styles.sidebarHeader}>
            <h2 className={styles.head}>Friends</h2>
          </div>

          {/* User search functionality with dropdown results */}
          <div className={styles.userSearchContainer} ref={userSearchRef}>
            <div className={styles.searchInputWrapper}>
              <FaSearch className={styles.searchIcon} />
              <input
                type="text"
                className={styles.userSearchInput}
                placeholder="Search users..."
                value={userSearch}
                onChange={e => setUserSearch(e.target.value)}
              />
            </div>
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
                      src={user.profilePic || '/default_profile.jpg'}
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
            <button
              className={`${styles.tab} ${activeTab === 'friends' ? styles.active : ''}`}
              onClick={() => setActiveTab('friends')}
            >
              <span className={styles.tabIcon}><FaUsers /></span>
              <span className={styles.tabLabel}>My Friends ({friends.length})</span>
            </button>
            <button
              className={`${styles.tab} ${activeTab === 'requests' ? styles.active : ''}`}
              onClick={() => setActiveTab('requests')}
            >
              <span className={styles.tabIcon}><FaUserPlus /></span>
              <span className={styles.tabLabel}>Requests ({friendRequests.incoming.length + friendRequests.outgoing.length})</span>
            </button>
            <button
              className={`${styles.tab} ${activeTab === 'search' ? styles.active : ''}`}
              onClick={() => setActiveTab('search')}
            >
              <span className={styles.tabIcon}><FaUserPlus /></span>
              <span className={styles.tabLabel}>Find Friends</span>
            </button>
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
                    Log in to connect
                  </a>
                </div>
              )
            }
          </div>
        </aside>

        {/* FRIENDS AREA */}
        <section className={styles.chatArea}>
          <div className={styles.messagesContainer}>
            {loading ? (
              <div className={styles.loadingContainer}>
                <FaSpinner className={styles.spinner} />
                <p>Loading friends...</p>
              </div>
            ) : !user ? (
              <div className={styles.loginPromptContainer}>
                <FaUsers size={48} />
                <h3>Please log in to view your friends</h3>
                <Link href="/login" className="btn btn-primary">
                  Log In
                </Link>
              </div>
            ) : (
              <>
                {/* Friends List Tab */}
                {activeTab === 'friends' && (
                  <div className={styles.friendsListContainer}>
                    <div className={styles.tabHeader}>
                      <h3>My Friends ({friends.length})</h3>
                    </div>
                    {friends.length === 0 ? (
                      <div className={styles.emptyState}>
                        <FaUsers size={48} />
                        <h4>No friends yet</h4>
                        <p>Start connecting with other traders by searching for users or accepting friend requests!</p>
                      </div>
                    ) : (
                      <div className={styles.friendsList}>
                        {friends.map(friend => (
                          <div key={friend.userId} className={styles.friendItem}>
                            <Link href={`/account/${friend.userId}`} className={styles.friendLink}>
                              <img
                                src={friend.profilePic || '/default_profile.jpg'}
                                alt={friend.username}
                                className={styles.friendAvatar}
                                onError={e => {
                                  (e.currentTarget as HTMLImageElement).src = '/default_profile.jpg'
                                }}
                              />
                              <div className={styles.friendInfo}>
                                <div className={styles.friendName}>{friend.username}</div>
                                <div className={styles.friendMeta}>
                                  Friends since {new Date(friend.friendsSince).toLocaleDateString()}
                                </div>
                              </div>
                              {friend.isOnline && (
                                <div className={styles.onlineIndicator} title="Online">
                                  <div className={styles.onlineDot}></div>
                                </div>
                              )}
                            </Link>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Friend Requests Tab */}
                {activeTab === 'requests' && (
                  <div className={styles.requestsContainer}>
                    <div className={styles.tabHeader}>
                      <h3>Friend Requests</h3>
                    </div>
                    
                    {/* Incoming Requests */}
                    {friendRequests.incoming.length > 0 && (
                      <div className={styles.requestSection}>
                        <h4>Incoming Requests ({friendRequests.incoming.length})</h4>
                        <div className={styles.requestsList}>
                          {friendRequests.incoming.map(request => (
                            <div key={request.requestId} className={styles.requestItem}>
                              <Link href={`/account/${request.userId}`} className={styles.requestUserLink}>
                                <img
                                  src={request.profilePic || '/default_profile.jpg'}
                                  alt={request.username}
                                  className={styles.requestAvatar}
                                  onError={e => {
                                    (e.currentTarget as HTMLImageElement).src = '/default_profile.jpg'
                                  }}
                                />
                                <div className={styles.requestInfo}>
                                  <div className={styles.requestName}>{request.username}</div>
                                  <div className={styles.requestTime}>
                                    {new Date(request.timestamp).toLocaleDateString()}
                                  </div>
                                  {request.message && (
                                    <div className={styles.requestMessage}>"{request.message}"</div>
                                  )}
                                </div>
                              </Link>
                              <div className={styles.requestActions}>
                                <button
                                  className="btn btn-primary btn-sm"
                                  onClick={() => handleFriendRequest(request.requestId, 'accept')}
                                  disabled={processingRequests.has(request.requestId)}
                                >
                                  {processingRequests.has(request.requestId) ? (
                                    <FaSpinner className={styles.spinner} />
                                  ) : (
                                    <FaCheck />
                                  )}
                                  Accept
                                </button>
                                <button
                                  className="btn btn-secondary btn-sm"
                                  onClick={() => handleFriendRequest(request.requestId, 'decline')}
                                  disabled={processingRequests.has(request.requestId)}
                                >
                                  <FaTimes />
                                  Decline
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Outgoing Requests */}
                    {friendRequests.outgoing.length > 0 && (
                      <div className={styles.requestSection}>
                        <h4>Sent Requests ({friendRequests.outgoing.length})</h4>
                        <div className={styles.requestsList}>
                          {friendRequests.outgoing.map(request => (
                            <div key={request.requestId} className={styles.requestItem}>
                              <Link href={`/account/${request.userId}`} className={styles.requestUserLink}>
                                <img
                                  src={request.profilePic || '/default_profile.jpg'}
                                  alt={request.username}
                                  className={styles.requestAvatar}
                                  onError={e => {
                                    (e.currentTarget as HTMLImageElement).src = '/default_profile.jpg'
                                  }}
                                />
                                <div className={styles.requestInfo}>
                                  <div className={styles.requestName}>{request.username}</div>
                                  <div className={styles.requestTime}>
                                    Sent {new Date(request.timestamp).toLocaleDateString()}
                                  </div>
                                </div>
                              </Link>
                              <div className={styles.requestStatus}>
                                <FaClock />
                                Pending
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* No Requests */}
                    {friendRequests.incoming.length === 0 && friendRequests.outgoing.length === 0 && (
                      <div className={styles.emptyState}>
                        <FaUserPlus size={48} />
                        <h4>No pending requests</h4>
                        <p>You don't have any pending friend requests at the moment.</p>
                      </div>
                    )}
                  </div>
                )}

                {/* Find Friends Tab */}
                {activeTab === 'search' && (
                  <div className={styles.searchContainer}>
                    <div className={styles.tabHeader}>
                      <h3>Find Friends</h3>
                      <button
                        className="btn btn-secondary btn-sm"
                        onClick={refreshRecommendations}
                        disabled={loadingRecommendations}
                        style={{ marginLeft: 'auto' }}
                      >
                        {loadingRecommendations ? (
                          <FaSpinner className={styles.spinner} />
                        ) : (
                          <FaSync />
                        )}
                        Refresh
                      </button>
                    </div>

                    {/* Top Search Section */}
                    <div className={styles.topSearchSection}>
                      <div className={styles.topSearchContainer} ref={topSearchRef}>
                        <h4 className={styles.topSearchTitle}>Search Users</h4>
                        <div className={styles.topSearchWrapper}>
                          <FaSearch className={styles.topSearchIcon} />
                          <input
                            type="text"
                            className={styles.topSearchInput}
                            placeholder="Search for users to add as friends..."
                            value={topSearch}
                            onChange={e => setTopSearch(e.target.value)}
                          />
                        </div>
                        {/* Top Search Results Dropdown */}
                        {topSearchOpen && topMatches.length > 0 && (
                          <div className={styles.topSearchResults}>
                            {topMatches.map(user => (
                              <div
                                key={user.uid}
                                className={styles.topSearchResult}
                                onClick={() => {
                                  window.location.href = `/account/${user.uid}`
                                  setTopSearch('')
                                  setTopSearchOpen(false)
                                }}
                              >
                                <img
                                  src={user.profilePic || '/default_profile.jpg'}
                                  alt={user.username}
                                  className={styles.topSearchAvatar}
                                />
                                <span className={styles.topSearchName}>{user.username}</span>
                              </div>
                            ))}
                          </div>
                        )}
                        {/* No results message */}
                        {topSearchOpen && topSearch.length >= 2 && topMatches.length === 0 && (
                          <div className={styles.topSearchResults}>
                            <div className={styles.topSearchNoResults}>No users found</div>
                          </div>
                        )}
                      </div>
                    </div>
                    
                    {/* Recommended Users Section */}
                    <div className={styles.recommendationsSection}>
                      <h4>Suggested Users</h4>
                      {loadingRecommendations ? (
                        <div className={styles.loadingRecommendations}>
                          <FaSpinner className={styles.spinner} />
                          <p>Loading recommendations...</p>
                        </div>
                      ) : recommendedUsers.length > 0 ? (
                        <div className={styles.recommendationsList}>
                          {recommendedUsers.map(user => (
                            <div key={user.userId} className={styles.recommendationItem}>
                              <img
                                src={user.profilePic || '/default_profile.jpg'}
                                alt={user.username}
                                className={styles.recommendationAvatar}
                                onError={e => {
                                  (e.currentTarget as HTMLImageElement).src = '/default_profile.jpg'
                                }}
                              />
                              <div className={styles.recommendationInfo}>
                                <Link href={`/account/${user.userId}`} className={styles.recommendationName}>
                                  {user.username}
                                </Link>
                                <div className={styles.recommendationMeta}>
                                  {user.friendsCount || 0} friends
                                </div>
                              </div>
                              <Link
                                href={`/account/${user.userId}`}
                                className="btn btn-primary btn-sm"
                              >
                                <FaUserPlus style={{ marginRight: '4px' }} />
                                Add
                              </Link>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className={styles.emptyRecommendations}>
                          <FaUsers size={32} />
                          <p>No recommendations available at the moment.</p>
                          <button className="btn btn-secondary" onClick={refreshRecommendations}>
                            <FaSync style={{ marginRight: '8px' }} />
                            Try Again
                          </button>
                        </div>
                      )}
                    </div>

                  </div>
                )}
              </>
            )}
          </div>
        </section>
      </div>
    </main>
  )
}