'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState, useEffect, useRef } from 'react'
import { auth } from '@/lib/firebaseClient'
import { onAuthStateChanged, signOut, User } from 'firebase/auth'
import styles from './Navbar.module.css'
import { FaBars, FaTimes, FaCaretDown, FaUser, FaSignOutAlt, FaInbox } from 'react-icons/fa'
import InboxDropdown from '@/components/InboxDropdown'
import { collection, query, where, onSnapshot } from 'firebase/firestore'
import { db } from '@/lib/firebaseClient'

interface Player { name: string; uuid: string }

export default function Navbar() {
  const pathname = usePathname()

  const [search, setSearch] = useState('')
  const [allPlayers, setAll] = useState<Player[]>([])
  const [matches, setMatches] = useState<Player[]>([])

  const [user, setUser] = useState<User | null>(null)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [userDropdownOpen, setUserDropdownOpen] = useState(false)
  const [inboxOpen, setInboxOpen] = useState(false)
  const [stubsOpen, setStubsOpen] = useState(false)
  const [gameplayOpen, setGameplayOpen] = useState(false)
  const [unreadCount, setUnreadCount] = useState(0)

  const listRef = useRef<HTMLDivElement>(null)
  const userDropdownRef = useRef<HTMLDivElement>(null)
  const mobileInboxRef = useRef<HTMLDivElement>(null)
  const desktopInboxRef = useRef<HTMLDivElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const stubsRef = useRef<HTMLDivElement>(null)
  const gameplayRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    fetch('/api/cards/live')
      .then(r => r.json())
      .then((data: Array<{ name: string; id: string }>) => {
        setAll(data.map(item => ({ name: item.name, uuid: item.id })))
      })
  }, [])

  useEffect(() => {
    const val = search.trim().toLowerCase()
    if (!val) return setMatches([])
    setMatches(
      allPlayers.filter(p => p.name.toLowerCase().includes(val)).slice(0, 5)
    )
  }, [search, allPlayers])

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (
        listRef.current?.contains(e.target as Node) ||
        userDropdownRef.current?.contains(e.target as Node) ||
        mobileInboxRef.current?.contains(e.target as Node) ||
        desktopInboxRef.current?.contains(e.target as Node) ||
        dropdownRef.current?.contains(e.target as Node) ||
        stubsRef.current?.contains(e.target as Node) ||
        gameplayRef.current?.contains(e.target as Node)
      ) {
        return
      }
      setMatches([])
      setUserDropdownOpen(false)
      setInboxOpen(false)
      setStubsOpen(false)
      setGameplayOpen(false)
    }
    document.addEventListener('click', onClick)
    return () => document.removeEventListener('click', onClick)
  }, [])

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, u => setUser(u))
    return () => unsubscribe()
  }, [])

  useEffect(() => {
    if (!user) {
      setUnreadCount(0)
      return
    }
    const q = query(
      collection(db, 'notifications'),
      where('recipientId', '==', user.uid),
      where('read', '==', false)
    )
    const unsub = onSnapshot(q, snap => setUnreadCount(snap.size))
    return () => unsub()
  }, [user])

  const accountHref = user ? `/account/${user.uid}` : '/login'
  const investmentHref = user ? `/investment/${user.uid}` : '/login'
  
  // Active states
  const isStubsActive = 
    pathname.startsWith('/predictions') || 
    pathname.startsWith('/flipping') || 
    pathname.startsWith('/investment');

  const isGameplayActive = pathname.startsWith('/player-rankings')

  return (
    <div className={styles.navbarContainer}>
      <nav className={styles.navbar}>
        <div className={styles.navContainer}>
          <Link href="/" className={styles.navLogo}>
            <span className={styles.logoPart1}>Diamond</span>
            <span className={styles.logoPart2}>Insights</span>
          </Link>

          <div className={styles.navActions}>
            <div
              className={styles.mobileInboxIcon}
              ref={mobileInboxRef}
              onClick={() => setInboxOpen(o => !o)}
            >
              <FaInbox />
              {unreadCount > 0 && <span className={styles.mobileNotificationBadge}>{unreadCount}</span>}
              {inboxOpen && (
                <div ref={dropdownRef} onClick={e => e.stopPropagation()}>
                  <InboxDropdown onClose={() => setInboxOpen(false)} />
                </div>
              )}
            </div>

            <button
              className={styles.mobileMenuButton}
              onClick={() => setMobileMenuOpen(o => !o)}
            >
              {mobileMenuOpen ? <FaTimes /> : <FaBars />}
            </button>
          </div>

          <div className={`${styles.navMain} ${mobileMenuOpen ? styles.mobileMenuOpen : ''}`}>            
            <div className={styles.navLinks}>
              <Link href="/" className={`${styles.navLink} ${pathname === '/' ? styles.active : ''}`} onClick={() => setMobileMenuOpen(false)}>Home</Link>
              
              {/* Stubs dropdown */}
              <div className={styles.stubsDropdown} ref={stubsRef}>
                <button 
                  className={`${styles.navLink} ${isStubsActive ? styles.active : ''}`}
                  onClick={() => { setStubsOpen(o => !o); setGameplayOpen(false) }}
                >
                  Stubs <FaCaretDown className={styles.caretIcon} />
                </button>
                {stubsOpen && (
                  <div className={styles.stubsMenu}>
                    <Link 
                      href="/predictions" 
                      className={`${styles.stubsLink} ${pathname.startsWith('/predictions') ? styles.activeStubs : ''}`} 
                      onClick={() => {
                        setStubsOpen(false);
                        setMobileMenuOpen(false);
                      }}
                    >
                      Predictions
                    </Link>
                    <Link 
                      href="/flipping" 
                      className={`${styles.stubsLink} ${pathname.startsWith('/flipping') ? styles.activeStubs : ''}`} 
                      onClick={() => {
                        setStubsOpen(false);
                        setMobileMenuOpen(false);
                      }}
                    >
                      Flipping
                    </Link>
                    <Link 
                      href={investmentHref} 
                      className={`${styles.stubsLink} ${pathname.startsWith('/investment') ? styles.activeStubs : ''}`} 
                      onClick={() => {
                        setStubsOpen(false);
                        setMobileMenuOpen(false);
                      }}
                    >
                      Portfolio
                    </Link>
                  </div>
                )}
              </div>

              {/* Gameplay dropdown */}
              <div className={styles.stubsDropdown} ref={gameplayRef}>
                <button 
                  className={`${styles.navLink} ${isGameplayActive ? styles.active : ''}`}
                  onClick={() => { setGameplayOpen(o => !o); setStubsOpen(false) }}
                >
                  Gameplay <FaCaretDown className={styles.caretIcon} />
                </button>
                {gameplayOpen && (
                  <div className={styles.stubsMenu}>
                    <Link 
                      href="/insights"
                      className={`${styles.stubsLink} ${pathname.startsWith('/insights') ? styles.activeStubs : ''}`}
                      onClick={() => {
                        setGameplayOpen(false);
                        setMobileMenuOpen(false);
                      }}
                    >
                      Insights
                    </Link>
                    <Link 
                      href="/player-rankings"
                      className={`${styles.stubsLink} ${pathname.startsWith('/player-rankings') ? styles.activeStubs : ''}`}
                      onClick={() => {
                        setGameplayOpen(false);
                        setMobileMenuOpen(false);
                      }}
                    >
                      Player Rankings
                    </Link>
                    <Link 
                      href="/team-builder"
                      className={`${styles.stubsLink} ${pathname.startsWith('/team-builder') ? styles.activeStubs : ''}`}
                      onClick={() => {
                        setGameplayOpen(false);
                        setMobileMenuOpen(false);
                      }}
                    >
                      Team Builder
                    </Link>
                    <Link 
                      href="/tierlist"
                      className={`${styles.stubsLink} ${pathname.startsWith('/tierlist') ? styles.activeStubs : ''}`}
                      onClick={() => {
                        setGameplayOpen(false);
                        setMobileMenuOpen(false);
                      }}
                    >
                      Tierlist
                    </Link>

                  </div>
                )}
              </div>
              
              <Link href="/community" className={`${styles.navLink} ${pathname.startsWith('/community') ? styles.active : ''}`} onClick={() => setMobileMenuOpen(false)}>Community</Link>
              
              <div className={styles.autocompleteContainer} ref={listRef}>
                <input
                  type="text"
                  className={styles.autocompleteInput}
                  placeholder="Search player…"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                />
                <div className={styles.autocompleteItems}>
                  {matches.map(p => (
                    <div key={p.uuid} className={styles.autocompleteItem} onClick={() => { window.location.href = `/player/${p.uuid}`; setMobileMenuOpen(false); }}>{p.name}</div>
                  ))}
                </div>
              </div>

              <div className={styles.mobileAccountLinks}>
                {user ? (
                  <>
                    <Link href={accountHref} className={styles.mobileAccountLink} onClick={() => setMobileMenuOpen(false)}><FaUser /> My Account</Link>
                    <button onClick={() => { signOut(auth); setMobileMenuOpen(false) }} className={styles.mobileAccountLink}><FaSignOutAlt /> Logout</button>
                  </>
                ) : (
                  <>
                    <Link href="/login" className={styles.mobileAccountLink} onClick={() => setMobileMenuOpen(false)}><FaUser /> Login</Link>
                    <Link href="/signup" className={styles.mobileSignUpLink} onClick={() => setMobileMenuOpen(false)}>Sign Up</Link>
                  </>
                )}
              </div>
            </div>

            <div
              className={styles.inboxIcon}
              ref={desktopInboxRef}
              onClick={() => setInboxOpen(o => !o)}
            >
              <FaInbox size={20} />
              {unreadCount > 0 && <span className={styles.notificationBadge}>{unreadCount}</span>}
              {inboxOpen && (
                <div ref={dropdownRef} onClick={e => e.stopPropagation()}>
                  <InboxDropdown onClose={() => setInboxOpen(false)} />
                </div>
              )}
            </div>

            <div className={styles.userDropdown} ref={userDropdownRef}>
              {user ? (
                <div className={styles.userProfile} onClick={() => setUserDropdownOpen(o => !o)}>
                  <img src={user.photoURL?.trim() || '/default_profile.jpg'} alt={user.displayName || 'Profile'} className={styles.profilePic} onError={e => { (e.currentTarget as HTMLImageElement).src = '/default_profile.jpg' }} />
                  <span>{user.displayName || 'Account'}</span>
                  <FaCaretDown className={styles.dropdownIcon} />
                  {userDropdownOpen && (
                    <div className={styles.dropdownMenu}>
                      <Link href={accountHref} className={styles.dropdownItem}><FaUser /> My Account</Link>
                      <button onClick={() => signOut(auth)} className={styles.dropdownItem}><FaSignOutAlt /> Logout</button>
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
    </div>
  )
}
