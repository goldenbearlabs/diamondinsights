'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState, useEffect, useRef } from 'react'
import { auth } from '@/lib/firebaseClient'
import { onAuthStateChanged, signOut, User } from 'firebase/auth'
import styles from './Navbar.module.css'

interface Player { name: string; uuid: string }

export default function Navbar() {
  const pathname = usePathname()
  const [search, setSearch]     = useState('')
  const [allPlayers, setAll]    = useState<Player[]>([])
  const [matches, setMatches]   = useState<Player[]>([])
  const [user, setUser]         = useState<User | null>(null)
  const listRef = useRef<HTMLDivElement>(null)

  // fetch all players for autocomplete
  useEffect(() => {
    fetch('/api/cards/live')
      .then(r => r.json())
      .then((data: any[]) => {
        setAll(data.map(item => ({ name: item.name, uuid: item.id })))
      })
  }, [])

  // autocomplete filtering
  useEffect(() => {
    const val = search.trim().toLowerCase()
    if (!val) return setMatches([])
    setMatches(
      allPlayers
        .filter(p => p.name.toLowerCase().includes(val))
        .slice(0, 5)
    )
  }, [search, allPlayers])

  // close dropdown on outside click
  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (listRef.current && !listRef.current.contains(e.target as Node)) {
        setMatches([])
      }
    }
    document.addEventListener('click', onClick)
    return () => document.removeEventListener('click', onClick)
  }, [])

  // listen for auth state
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, u => setUser(u))
    return () => unsubscribe()
  }, [])

  // build your account & investment hrefs
  const accountHref    = user ? `/account/${user.uid}`    : '/login'
  const investmentHref = user ? `/investment/${user.uid}` : '/login'

  return (
    <nav className={styles.navbar}>
      <div className={styles.navContainer}>
        <Link href="/" className={styles.navLogo}>
          <span className={styles.logoPart1}>Diamond</span>
          <span className={styles.logoPart2}>Insights</span>
        </Link>

        <div className={styles.navLinks}>
          <Link
            href="/"
            className={`${styles.navLink} ${pathname === '/' ? styles.active : ''}`}
          >
            Home
          </Link>
          <Link
            href="/predictions"
            className={`${styles.navLink} ${pathname.startsWith('/predictions') ? styles.active : ''}`}
          >
            Predictions
          </Link>
          <Link
            href={investmentHref}
            className={`${styles.navLink} ${pathname.startsWith('/investment') ? styles.active : ''}`}
          >
            Investment Tracker
          </Link>
          <Link
            href="/community"
            className={`${styles.navLink} ${pathname.startsWith('/community') ? styles.active : ''}`}
          >
            Community
          </Link>
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
                onClick={() => window.location.href = `/player/${p.uuid}`}
              >
                {p.name}
              </div>
            ))}
          </div>
        </div>

        <div className={styles.navAuthLinks}>
          {user ? (
            <>
              <Link href={accountHref} className={styles.navLink}>
                Account
              </Link>
              <button onClick={() => signOut(auth)} className="btn btn-secondary">
                Logout
              </button>
            </>
          ) : (
            <>
              <Link href="/login"  className={styles.navLink}>Login</Link>
              <Link href="/signup" className="btn btn-primary">Sign Up</Link>
            </>
          )}
        </div>

        {/* Mobile fallback */}
        <div className={styles.authButtonsMobile}>
          {user ? (
            <>
              <Link href={accountHref} className="btn btn-secondary">Account</Link>
              <button onClick={() => signOut(auth)} className="btn btn-secondary">Logout</button>
            </>
          ) : (
            <>
              <Link href="/signup" className="btn btn-primary">Sign Up</Link>
              <Link href="/login"  className="btn btn-secondary">Login</Link>
            </>
          )}
        </div>
      </div>
    </nav>
  )
}
