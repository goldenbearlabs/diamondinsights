// src/components/Navbar.tsx
// Main navigation component with comprehensive features: search autocomplete, mobile menu, user authentication
// Features: player search with API integration, responsive design, authentication-aware routing, dropdown menus
'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState, useEffect, useRef } from 'react'
import { auth } from '@/lib/firebaseClient'
import { onAuthStateChanged, signOut, User } from 'firebase/auth'
import styles from './Navbar.module.css'
import { FaBars, FaTimes, FaCaretDown, FaUser, FaSignOutAlt } from 'react-icons/fa'

interface Player { 
  uuid: string 
  name: string 
  baked_img?: string 
}

/**
 * Navbar component - provides primary site navigation with advanced features
 * Includes: player search autocomplete, mobile-responsive menu, user authentication integration
 * Features dynamic routing based on auth state and comprehensive dropdown functionality
 */
export default function Navbar() {
  const pathname = usePathname()
  const [search, setSearch] = useState('')
  const [matches, setMatches] = useState<Player[]>([])
  const [user, setUser] = useState<User | null>(null)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [userDropdownOpen, setUserDropdownOpen] = useState(false)
  const listRef = useRef<HTMLDivElement>(null)
  const userDropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const q = search.trim().toLowerCase()
    if (!q) {
      setMatches([])
      return
    }
    fetch(`/api/cards/suggestions?q=${encodeURIComponent(q)}`)
      .then(r => r.json())
      .then((data: Array<{ id: string; name: string; baked_img: string|null }>) => {
        setMatches(
          data.map(c => ({
            uuid:       c.id,
            name:       c.name,
            baked_img:  c.baked_img ?? undefined,
          }))
        )
      })
  }, [search])

  // 2) close dropdowns on outside click

  useEffect(() => {
    function onClick(e: MouseEvent) {
      // Close search autocomplete if clicking outside the results
      if (listRef.current && !listRef.current.contains(e.target as Node)) {
        setMatches([])
      }
      // Close user profile dropdown if clicking outside
      if (userDropdownRef.current && !userDropdownRef.current.contains(e.target as Node)) {
        setUserDropdownOpen(false)
      }
    }
    document.addEventListener('click', onClick)
    return () => document.removeEventListener('click', onClick)
  }, [])

  // 3) listen for auth state
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, u => setUser(u))
    return () => unsub()
  }, [])

  const accountHref    = user ? `/account/${user.uid}` : '/login'

  const investmentHref = user ? `/investment/${user.uid}` : '/login'

  return (
    <div className={styles.navbarContainer}>
      <nav className={styles.navbar}>
        <div className={styles.navContainer}>
          {/* DiamondInsights brand logo with homepage link */}
          <Link href="/" className={styles.navLogo}>
            <span className={styles.logoPart1}>Diamond</span>
            <span className={styles.logoPart2}>Insights</span>
          </Link>

          {/* Mobile hamburger menu toggle button */}
          <button
            className={styles.mobileMenuButton}
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          >
            {mobileMenuOpen ? <FaTimes /> : <FaBars />}
          </button>

          {/* Main navigation content - responsive container for mobile/desktop */}
          <div className={`${styles.navMain} ${mobileMenuOpen ? styles.mobileMenuOpen : ''}`}>
            {/* Primary navigation links with active state highlighting */}
            <div className={styles.navLinks}>
              <Link
                href="/"
                className={`${styles.navLink} ${pathname === '/' ? styles.active : ''}`}
                onClick={() => setMobileMenuOpen(false)}
              >
                Home
              </Link>
              <Link
                href="/predictions"
                className={`${styles.navLink} ${pathname.startsWith('/predictions') ? styles.active : ''}`}
                onClick={() => setMobileMenuOpen(false)}
              >
                Predictions
              </Link>
              {/* Dynamic investment tracker link - auth-aware routing */}
              <Link
                href={investmentHref}
                className={`${styles.navLink} ${pathname.startsWith('/investment') ? styles.active : ''}`}
                onClick={() => setMobileMenuOpen(false)}
              >
                Investment Tracker
              </Link>
              <Link
                href="/community"
                className={`${styles.navLink} ${pathname.startsWith('/community') ? styles.active : ''}`}
                onClick={() => setMobileMenuOpen(false)}
              >
                Community
              </Link>

              {/* Mobile-only account management links - conditional based on auth state */}
              <div className={styles.mobileAccountLinks}>
                {user ? (
                  /* Authenticated user mobile options */
                  <>
                    <Link
                      href={accountHref}
                      className={styles.mobileAccountLink}
                      onClick={() => setMobileMenuOpen(false)}
                    >
                      <FaUser /> My Account
                    </Link>
                    <button
                      onClick={() => signOut(auth)}
                      className={styles.mobileAccountLink}
                    >
                      <FaSignOutAlt /> Logout
                    </button>
                  </>
                ) : (
                  /* Unauthenticated user mobile options */
                  <>
                    <Link
                      href="/login"
                      className={styles.mobileAccountLink}
                      onClick={() => setMobileMenuOpen(false)}
                    >
                      <FaUser /> Login
                    </Link>
                    <Link
                      href="/signup"
                      className={styles.mobileSignUpLink}
                      onClick={() => setMobileMenuOpen(false)}
                    >
                      Sign Up
                    </Link>
                  </>
                )}
              </div>
            </div>

            {/* Player search autocomplete functionality */}
            <div className={styles.autocompleteContainer}>
              <input
                type="text"
                className={styles.autocompleteInput}
                placeholder="Search player…"
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
              {/* Search results dropdown with click navigation */}
              <div ref={listRef} className={styles.autocompleteItems}>
                {matches.map(p => (
                  <div
                    key={p.uuid}
                    className={styles.autocompleteItem}
                    onClick={() => {
                      window.location.href = `/player/${p.uuid}`;
                      setMobileMenuOpen(false);
                    }}
                  >
                    {p.name}
                  </div>
                ))}
              </div>
            </div>

            {/* Desktop user authentication section with profile dropdown */}
            <div className={styles.userDropdown} ref={userDropdownRef}>
              {user ? (
                /* Authenticated user profile section with dropdown menu */
                <div
                  className={styles.userProfile}
                  onClick={() => setUserDropdownOpen(!userDropdownOpen)}
                >
                  {/* User profile picture with fallback to default image */}
                  <img
                    src={user.photoURL && user.photoURL.trim() !== '' ? user.photoURL : '/default_profile.jpg'}
                    alt={user.displayName || 'Profile'}
                    className={styles.profilePic}
                    onError={e => { (e.currentTarget as HTMLImageElement).src = '/default_profile.jpg'; }}
                  />
                  <span>{user.displayName || 'Account'}</span>
                  <FaCaretDown className={styles.dropdownIcon} />

                  {/* Dropdown menu with account management options */}
                  {userDropdownOpen && (
                    <div className={styles.dropdownMenu}>
                      <Link href={accountHref} className={styles.dropdownItem}>
                        <FaUser /> My Account
                      </Link>
                      <button
                        onClick={() => signOut(auth)}
                        className={styles.dropdownItem}
                      >
                        <FaSignOutAlt /> Logout
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                /* Unauthenticated user authentication links */
                <div className={styles.authLinks}>
                  <Link href="/login" className={styles.navLink}>Login</Link>
                  <Link href="/signup" className="btn btn-primary">Sign Up</Link>
                </div>
              )}
            </div>
          </div>
        </div>
      </nav>
    
    </div>
  )
}