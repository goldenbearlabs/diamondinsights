// src/app/community/friends/page.tsx
// Friends page - coming soon functionality for social features
// Features: placeholder for future friends system, user search for consistency
'use client'

import React, { useState, useEffect, useRef } from 'react'
import styles from '../page.module.css'
import { getAuth, onAuthStateChanged, type User } from 'firebase/auth'

// Icon imports for friends features
import {
  FaUsers,
  FaBars,
  FaTimes,
  FaUserPlus,
  FaHeart,
  FaComments
} from 'react-icons/fa'

// User search result structure for user lookup functionality
interface UserSearchResult {
  uid: string
  username: string
  profilePic: string
}

/**
 * Friends page component - placeholder for future social features
 * Features coming soon message with professional styling
 */
export default function FriendsPage() {
  const auth = getAuth()

  // Authentication and user state
  const [user, setUser] = useState<User | null>(null)
  
  // Tab and navigation state
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false)

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
            {/* Friends Info */}
            <div className={styles.sectionHeader}>Social Features</div>
            <div className={styles.infoText}>
              Connect with other traders, share insights, and build your community network. Coming soon!
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
                    Log in to connect
                  </a>
                </div>
              )
            }
          </div>
        </aside>

        {/* FRIENDS AREA */}
        <section className={styles.chatArea}>
          <header className={styles.chatHeader}>
            <div className={styles.roomInfo}>
              <span className={styles.roomIcon}>
                <FaUsers />
              </span>
              <h3 className={styles.roomName}>
                Friends
              </h3>
            </div>
          </header>

          <div className={styles.messagesContainer}>
            <div className={styles.comingSoonContainer}>
              <div className={styles.comingSoonIcon}>
                <FaUsers size={64} />
              </div>
              <h2 className={styles.comingSoonTitle}>Friends Feature Coming Soon!</h2>
              <p className={styles.comingSoonDescription}>
                We're working on exciting social features that will let you:
              </p>
              <div className={styles.featureList}>
                <div className={styles.featureItem}>
                  <FaUserPlus className={styles.featureIcon} />
                  <span>Add and manage friends</span>
                </div>
                <div className={styles.featureItem}>
                  <FaComments className={styles.featureIcon} />
                  <span>Private messaging</span>
                </div>
                <div className={styles.featureItem}>
                  <FaHeart className={styles.featureIcon} />
                  <span>Share favorite players</span>
                </div>
                <div className={styles.featureItem}>
                  <FaUsers className={styles.featureIcon} />
                  <span>Create trading groups</span>
                </div>
              </div>
              <p className={styles.comingSoonFooter}>
                Stay tuned for updates! In the meantime, you can connect with other traders in our chat rooms.
              </p>
            </div>
          </div>
        </section>
      </div>
    </main>
  )
}