// src/components/Footer.tsx
// Application footer component with authentication-aware navigation and social media links
// Features: dynamic link generation based on auth state, brand information, external social links
'use client'

import Link from 'next/link'
import { useState, useEffect } from 'react'
import { auth } from '@/lib/firebaseClient'
import { onAuthStateChanged, User } from 'firebase/auth'
import styles from './Footer.module.css'

/**
 * Footer component - provides site-wide navigation links and brand information
 * Dynamically generates authentication-aware links (account/investment pages)
 * Features social media integration and legal disclaimers
 */
export default function Footer() {
  // User authentication state for dynamic link generation
  const [user, setUser] = useState<User | null>(null)

  // Authentication listener - monitors Firebase auth state changes for link generation
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, u => setUser(u))
    return () => unsubscribe()
  }, [])

  // Dynamic href generation based on authentication status
  // Authenticated users get direct links to their account/investment pages
  // Unauthenticated users are directed to login page
  const accountHref = user ? `/account/${user.uid}` : '/login'
  const investmentHref = user ? `/investment/${user.uid}` : '/login'
  return (
    <footer className={styles.footer}>
      <div className={styles.footerContainer}>
        {/* Brand section with logo, tagline, and legal disclaimers */}
        <div className={styles.footerBrand}>
          <Link href="/" className={styles.footerLogo}>
            <span className={styles.logoPart1}>Diamond</span>
            <span className={styles.logoPart2}>Insights</span>
          </Link>
          {/* Platform description and value proposition */}
          <p>AI-powered roster predictions for MLB The Show.</p>
          <p> </p>
          {/* Legal disclaimer to avoid trademark/affiliation confusion */}
          <p>Not affiliated with San Diego Studios or Major League Baseball.</p>
        </div>

        {/* Footer navigation links organized by category */}
        <div className={styles.footerLinks}>
          {/* Primary navigation section */}
          <div className={styles.linkGroup}>
            <h4>Navigation</h4>
            <Link href="/">Home</Link>
            <Link href="/predictions">Predictions</Link>
            {/* Dynamic investment link - directs to user's page or login */}
            <Link href={investmentHref}>Investment Sheet</Link>
          </div>
          {/* User account management section */}
          <div className={styles.linkGroup}>
            <h4>Account</h4>
            <Link href="/signup">Sign Up</Link>
            <Link href="/login">Login</Link>
            {/* Dynamic account link - directs to user's profile or login */}
            <Link href={accountHref}>My Account</Link>
          </div>
          {/* External social media links for community engagement */}
          <div className={styles.linkGroup}>
            <h4>Community</h4>
            <a href="https://www.instagram.com/diamondinsights.app/">Instagram</a>
            <a href="https://x.com/DiamondIns58780">X</a>
            <a href="https://www.tiktok.com/@diamondinsights.app">TikTok</a>
          </div>
        </div>
      </div>

      {/* Copyright and legal information */}
      <div className={styles.footerBottom}>
        <p>&copy; 2025 DiamondInsights. All rights reserved.</p>
      </div>
    </footer>
  )
}