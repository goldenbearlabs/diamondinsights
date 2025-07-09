// src/app/login/page.tsx
// User authentication login page with email/username support and comprehensive error handling
// Features: Firebase authentication, username-to-email lookup, password visibility toggle, form validation
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { auth } from '@/lib/firebaseClient';
import { signInWithEmailAndPassword } from 'firebase/auth';
import {
  FaEye,
  FaEyeSlash,
  FaBaseballBall,
  FaChartLine,
  FaUsers,
  FaBolt,
} from 'react-icons/fa';
import { getFirestore, collection, query, where, getDocs } from 'firebase/firestore';
import { FirebaseError } from 'firebase/app'

import styles from './page.module.css';

/**
 * Login page component - handles user authentication with Firebase
 * Supports both email and username login with automatic email resolution
 * Features comprehensive error handling and user-friendly feedback
 */
export default function LoginPage() {
  const router = useRouter();
  const db = getFirestore();

  // Form input states
  const [identifier, setIdentifier] = useState('');  // Email or username input
  const [password, setPassword]     = useState('');  // Password input
  
  // UI control states
  const [showPw, setShowPw]         = useState(false);  // Password visibility toggle
  const [remember, setRemember]     = useState(false);  // Remember me checkbox
  
  // Application states
  const [loading, setLoading]       = useState(false);  // Form submission loading
  const [error, setError]           = useState('');     // Error message display

  // Handle form submission with comprehensive validation and authentication
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // Client-side form validation
    if (!identifier.trim()) {
      return setError('Email is required');
    }
    
    // Email format validation and username-to-email resolution
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    let emailToUse = identifier.trim();
    
    if (!emailRegex.test(identifier)) {
      // If not an email format, treat as username and lookup email in Firestore
      try {
        const q = query(
          collection(db, 'users'),
          where('username', '==', identifier.trim())
        );
        const snap = await getDocs(q);
        if (snap.empty) {
          return setError('No account found with that username');
        }
        const userDoc = snap.docs[0].data() as { email?: string };
        if (!userDoc.email) {
          return setError('This user does not have a sign-in email');
        }
        emailToUse = userDoc.email;  // Use resolved email for authentication
      } catch (err: unknown) {
        console.error(err);
        return setError('Error with the server try again with your email or wait a little bit.')
      }
    }
    
    if (!password) {
      return setError('Password is required');
    }

    setLoading(true);

    try {
      // Attempt Firebase authentication with resolved email
      const userCredential = await signInWithEmailAndPassword(auth, emailToUse, password)
      // Redirect to user's account page on successful login
      router.push(`/account/${userCredential.user.uid}`)
    } catch (err: unknown) {
      console.error('Login error', err)
    
      // Comprehensive error handling with user-friendly messages
      if (err instanceof FirebaseError) {
        // Map Firebase authentication error codes to readable messages
        switch (err.code) {
          case 'auth/user-not-found':
            setError('No account found with this email')
            break
          case 'auth/wrong-password':
            setError('Incorrect password')
            break
          case 'auth/invalid-email':
            setError('Invalid email address')
            break
          case 'auth/invalid-credential':
            setError('Invalid email address or password')
            break
          case 'auth/too-many-requests':
            setError('Too many failed attempts. Try again later.')
            break
          default:
            setError(err.message || 'Something went wrong')
        }
      } else if (err instanceof Error) {
        // Handle any other JavaScript errors
        setError(err.message)
      } else {
        setError('Something went wrong')
      }
    
      setLoading(false)  // Re-enable form after error
    }
  }

  return (
    <main className={styles.authContainer}>
      {/* Brand marketing panel with platform features and value proposition */}
      <aside className={styles.brandPanel}>
        <div className={styles.brandOverlay}/>
        <div className={styles.brandContent}>
          {/* DiamondInsights logo and branding */}
          <div className={styles.logo}>
            <div className={styles.logoIcon}><FaBaseballBall/></div>
            <div className={styles.logoText}>
              <span className={styles.logoPart1}>Diamond</span>
              <span className={styles.logoPart2}>Insights</span>
            </div>
          </div>
          {/* Welcome message and platform positioning */}
          <h1 className={styles.brandHeading}>
            Welcome Back to the <span>#1</span> MLB The Show Prediction Platform
          </h1>
          {/* Key platform features to encourage login */}
          <ul className={styles.brandFeatures}>
            <li><FaChartLine className={styles.featureIcon}/> AI-powered roster predictions</li>
            <li><FaUsers      className={styles.featureIcon}/> Join 2,000+ investors</li>
            <li><FaBolt       className={styles.featureIcon}/> Real-time updates & alerts</li>
          </ul>
        </div>
      </aside>

      {/* Login form panel with user input fields and validation */}
      <section className={styles.formPanel}>
        <header className={styles.authHeader}>
          <h2>Welcome Back</h2>
          <p>Sign in to access your predictions & tools</p>
        </header>

        <form onSubmit={handleSubmit} className={styles.authForm}>
          {/* Error message display for authentication failures */}
          {error && <div className={styles.authError}>{error}</div>}

          {/* Email or username input field with flexible authentication */}
          <div className={styles.formGroup}>
            <label htmlFor="identifier">Email or Username</label>
            <input
              id="identifier"
              type="text"
              className={styles.formInput}
              value={identifier}
              onChange={e => { setError(''); setIdentifier(e.target.value); }}
              disabled={loading}
              required
            />
          </div>

          {/* Password input field with visibility toggle for user convenience */}
          <div className={styles.formGroup}>
            <label htmlFor="password">Password</label>
            <div className={styles.passwordContainer}>
              <input
                id="password"
                type={showPw ? 'text' : 'password'}
                className={styles.formInput}
                value={password}
                onChange={e => { setError(''); setPassword(e.target.value); }}
                disabled={loading}
                required
              />
              {/* Show/hide password toggle button for better UX */}
              <button
                type="button"
                className={styles.togglePassword}
                onClick={() => setShowPw(v => !v)}
                disabled={loading}
              >
                {showPw ? <FaEye/> : <FaEyeSlash/>}
              </button>
            </div>
          </div>

          {/* Form options: remember me and forgot password link */}
          <div className={styles.formOptions}>
            <label className={styles.rememberMe}>
              <input
                type="checkbox"
                checked={remember}
                onChange={e => setRemember(e.target.checked)}
                disabled={loading}
              />
              Remember me
            </label>
            <Link href="/reset-password" className={styles.forgotPassword}>
              Forgot password?
            </Link>
          </div>

          {/* Submit button with loading state feedback */}
          <button
            type="submit"
            className={styles.submitBtn}
            disabled={loading}
          >
            {loading ? 'Logging In…' : 'Log In'}
          </button>
        </form>

        {/* Navigation link to signup page for new users */}
        <p className={styles.loginLink}>
          Don&apos;t have an account? <Link href="/signup">Sign Up</Link>
        </p>
      </section>
    </main>
  );
}
