'use client'

import Link from 'next/link'
import { useState, useEffect } from 'react'
import { auth } from '@/lib/firebaseClient'
import { onAuthStateChanged, User } from 'firebase/auth'
import styles from './Footer.module.css'

export default function Footer() {
  const [user, setUser] = useState<User | null>(null)

  // Listen for auth state changes
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, u => setUser(u))
    return () => unsubscribe()
  }, [])

  // Build hrefs like navbar does
  const accountHref = user ? `/account/${user.uid}` : '/login'
  const investmentHref = user ? `/investment/${user.uid}` : '/login'
  return (
    <footer className={styles.footer}>
      <div className={styles.footerContainer}>
        <div className={styles.footerBrand}>
          <Link href="/" className={styles.footerLogo}>
            <span className={styles.logoPart1}>Diamond</span>
            <span className={styles.logoPart2}>Insights</span>
          </Link>
          <p>AI-powered roster predictions for MLB The Show.</p>
          <p> </p>
          <p>Not affiliated with San Diego Studios or Major League Baseball.</p>
        </div>

        <div className={styles.footerLinks}>
          <div className={styles.linkGroup}>
            <h4>Navigation</h4>
            <Link href="/">Home</Link>
            <Link href="/predictions">Predictions</Link>
            <Link href={investmentHref}>Investment Sheet</Link>
          </div>
          <div className={styles.linkGroup}>
            <h4>Account</h4>
            <Link href="/signup">Sign Up</Link>
            <Link href="/login">Login</Link>
            <Link href={accountHref}>My Account</Link>
          </div>
          <div className={styles.linkGroup}>
            <h4>Community</h4>
            <a href="https://www.instagram.com/diamondinsights.app/">Instagram</a>
            <a href="https://x.com/DiamondIns58780">X</a>
            <a href="https://www.tiktok.com/@diamondinsights.app">TikTok</a>
          </div>
        </div>
      </div>

      <div className={styles.footerBottom}>
        <p>&copy; 2025 DiamondInsights. All rights reserved.</p>
      </div>
    </footer>
  )
}