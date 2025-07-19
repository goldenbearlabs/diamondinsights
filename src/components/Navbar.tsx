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

export default function Navbar() {
  const pathname = usePathname()
  const [search, setSearch] = useState('')
  const [matches, setMatches] = useState<Player[]>([])
  const [user, setUser] = useState<User | null>(null)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [userDropdownOpen, setUserDropdownOpen] = useState(false)
  const listRef = useRef<HTMLDivElement>(null)
  const userDropdownRef = useRef<HTMLDivElement>(null)

  // 1) fetch up to 5 suggestions on each change
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
      if (listRef.current && !listRef.current.contains(e.target as Node)) {
        setMatches([])
      }
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
    <nav className={styles.navbar}>
      <div className={styles.navContainer}>
        <Link href="/" className={styles.navLogo}>
          <span className={styles.logoPart1}>Diamond</span>
          <span className={styles.logoPart2}>Insights</span>
        </Link>

        {/* Mobile menu button */}
        <button
          className={styles.mobileMenuButton}
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
        >
          {mobileMenuOpen ? <FaTimes /> : <FaBars />}
        </button>

        <div className={`${styles.navMain} ${mobileMenuOpen ? styles.mobileMenuOpen : ''}`}>
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

            {/* Mobile-only account links */}
            <div className={styles.mobileAccountLinks}>
              {user ? (
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

          <div className={styles.autocompleteContainer}>
            <input
              type="text"
              className={styles.autocompleteInput}
              placeholder="Search player…"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
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

          {/* User dropdown for desktop */}
          <div className={styles.userDropdown} ref={userDropdownRef}>
            {user ? (
              <div
                className={styles.userProfile}
                onClick={() => setUserDropdownOpen(!userDropdownOpen)}
              >
                <img
                  src={user.photoURL && user.photoURL.trim() !== '' ? user.photoURL : '/default_profile.jpg'}
                  alt={user.displayName || 'Profile'}
                  className={styles.profilePic}
                  onError={e => { (e.currentTarget as HTMLImageElement).src = '/default_profile.jpg'; }}
                />
                <span>{user.displayName || 'Account'}</span>
                <FaCaretDown className={styles.dropdownIcon} />

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
              <div className={styles.authLinks}>
                <Link href="/login" className={styles.navLink}>Login</Link>
                <Link href="/signup" className="btn btn-primary">Sign Up</Link>
              </div>
            )}
          </div>
        </div>
      </div>
    </nav>
  )
}
