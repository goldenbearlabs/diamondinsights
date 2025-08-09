// src/app/login/page.tsx
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { auth } from '@/lib/firebaseClient';
import {
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
} from 'firebase/auth';
import {
  FaEye,
  FaEyeSlash,
  FaBaseballBall,
  FaChartLine,
  FaUsers,
  FaBolt,
} from 'react-icons/fa';
import { getFirestore, collection, query, where, getDocs } from 'firebase/firestore';
import { FirebaseError } from 'firebase/app';

import styles from './page.module.css';

export default function LoginPage() {
  const router = useRouter();
  const db = getFirestore();

  // Form input states
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');

  // UI control states
  const [showPw, setShowPw] = useState(false);
  const [remember, setRemember] = useState(false);

  // Application states
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [resetEmailSent, setResetEmailSent] = useState<string | null>(null); // Track reset email status
  const [showResetForm, setShowResetForm] = useState(false); // Toggle reset password form

  // Handle login form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    if (!identifier.trim()) {
      setError('Email or username is required');
      setLoading(false);
      return;
    }

    if (!password) {
      setError('Password is required');
      setLoading(false);
      return;
    }

    // Resolve username to email if needed
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    let emailToUse = identifier.trim();

    if (!emailRegex.test(identifier)) {
      try {
        const q = query(collection(db, 'users'), where('username', '==', identifier.trim()));
        const snap = await getDocs(q);
        if (snap.empty) {
          setError('No account found with that username');
          setLoading(false);
          return;
        }
        const userDoc = snap.docs[0].data() as { email?: string };
        if (!userDoc.email) {
          setError('This user does not have an email associated.');
          setLoading(false);
          return;
        }
        emailToUse = userDoc.email;
      } catch (err) {
        console.error('Username lookup error:', err);
        setError('Error resolving username. Please try with your email.');
        setLoading(false);
        return;
      }
    }

    try {
      const userCredential = await signInWithEmailAndPassword(auth, emailToUse, password);
      router.push(`/account/${userCredential.user.uid}`);
    } catch (err: unknown) {
      console.error('Login error', err);
      if (err instanceof FirebaseError) {
        switch (err.code) {
          case 'auth/user-not-found':
            setError('No account found with this email');
            break;
          case 'auth/wrong-password':
            setError('Incorrect password');
            break;
          case 'auth/invalid-email':
            setError('Invalid email address');
            break;
          case 'auth/invalid-credential':
            setError('Invalid email or password');
            break;
          case 'auth/too-many-requests':
            setError('Too many attempts. Try again later.');
            break;
          default:
            setError(err.message || 'Something went wrong');
        }
      } else {
        setError('Something went wrong');
      }
    } finally {
      setLoading(false);
    }
  };

  // Handle password reset request
  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    const email = (e.target as typeof e.target & { email: { value: string } }).email.value.trim();

    if (!email) {
      alert('Please enter your email address.');
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      alert('Please enter a valid email address.');
      return;
    }

    try {
      await sendPasswordResetEmail(auth, email, {
        url: 'https://www.diamondinsights.app/reset-password'
      });
      setResetEmailSent(email);
      setIdentifier(email); // Pre-fill login field
      setShowResetForm(false); // Go back to login
    } catch (err: unknown) {
      let message = 'Failed to send reset email.';
      if (err instanceof FirebaseError) {
        switch (err.code) {
          case 'auth/user-not-found':
            message = 'No account found with this email.';
            break;
          case 'auth/invalid-email':
            message = 'Invalid email address.';
            break;
          case 'auth/missing-android-pkg-name':
          case 'auth/missing-continue-uri':
          case 'auth/missing-ios-bundle-id':
          case 'auth/invalid-continue-uri':
          case 'auth/unauthorized-continue-uri':
            message = 'Password reset is temporarily unavailable. Contact support.';
            break;
          default:
            message = err.message || message;
        }
      }
      alert(message);
    }
  };

  return (
    <main className={styles.authContainer}>
      {/* Brand marketing panel */}
      <aside className={styles.brandPanel}>
        <div className={styles.brandOverlay} />
        <div className={styles.brandContent}>
          <div className={styles.logo}>
            <div className={styles.logoIcon}>
              <FaBaseballBall />
            </div>
            <div className={styles.logoText}>
              <span className={styles.logoPart1}>Diamond</span>
              <span className={styles.logoPart2}>Insights</span>
            </div>
          </div>
          <h1 className={styles.brandHeading}>
            Welcome Back to the <span>#1</span> MLB The Show Prediction Platform
          </h1>
          <ul className={styles.brandFeatures}>
            <li>
              <FaChartLine className={styles.featureIcon} /> AI-powered roster predictions
            </li>
            <li>
              <FaUsers className={styles.featureIcon} /> Join 2,000+ investors
            </li>
            <li>
              <FaBolt className={styles.featureIcon} /> Real-time updates & alerts
            </li>
          </ul>
        </div>
      </aside>

      {/* Login / Reset Form Panel */}
      <section className={styles.formPanel}>
        {!showResetForm ? (
          // Login Form
          <>
            <header className={styles.authHeader}>
              <h2>Welcome Back</h2>
              <p>Sign in to access your predictions & tools</p>
            </header>

            {resetEmailSent && (
              <div className={styles.authSuccess}>
                Password reset email sent to <strong>{resetEmailSent}</strong>. Check your inbox!
              </div>
            )}

            <form onSubmit={handleSubmit} className={styles.authForm}>
              {error && <div className={styles.authError}>{error}</div>}

              <div className={styles.formGroup}>
                <label htmlFor="identifier">Email or Username</label>
                <input
                  id="identifier"
                  type="text"
                  className={styles.formInput}
                  value={identifier}
                  onChange={(e) => {
                    setError('');
                    setIdentifier(e.target.value);
                  }}
                  disabled={loading}
                  required
                />
              </div>

              <div className={styles.formGroup}>
                <label htmlFor="password">Password</label>
                <div className={styles.passwordContainer}>
                  <input
                    id="password"
                    type={showPw ? 'text' : 'password'}
                    className={styles.formInput}
                    value={password}
                    onChange={(e) => {
                      setError('');
                      setPassword(e.target.value);
                    }}
                    disabled={loading}
                    required
                  />
                  <button
                    type="button"
                    className={styles.togglePassword}
                    onClick={() => setShowPw((v) => !v)}
                    disabled={loading}
                  >
                    {showPw ? <FaEye /> : <FaEyeSlash />}
                  </button>
                </div>
              </div>

              <div className={styles.formOptions}>
                <label className={styles.rememberMe}>
                  <input
                    type="checkbox"
                    checked={remember}
                    onChange={(e) => setRemember(e.target.checked)}
                    disabled={loading}
                  />
                  Remember me
                </label>
                <button
                  type="button"
                  className={styles.forgotPassword}
                  onClick={() => setShowResetForm(true)}
                >
                  Forgot password?
                </button>
              </div>

              <button type="submit" className={styles.submitBtn} disabled={loading}>
                {loading ? 'Logging In…' : 'Log In'}
              </button>
            </form>

            <p className={styles.loginLink}>
              Don&apos;t have an account? <Link href="/signup">Sign Up</Link>
            </p>
          </>
        ) : (
          // Password Reset Form
          <div className={styles.resetForm}>
            <header className={styles.authHeader}>
              <h2>Reset Your Password</h2>
              <p>We'll send a link to reset your password</p>
            </header>

            <form onSubmit={handleResetPassword} className={styles.authForm}>
              <div className={styles.formGroup}>
                <label htmlFor="reset-email">Email Address</label>
                <input
                  id="reset-email"
                  name="email"
                  type="email"
                  className={styles.formInput}
                  placeholder="you@example.com"
                  required
                />
              </div>

              <button type="submit" className={styles.submitBtn}>
                Send Reset Link
              </button>

              <button
                type="button"
                className={styles.textButton}
                onClick={() => setShowResetForm(false)}
              >
                Back to Login
              </button>
            </form>
          </div>
        )}
      </section>
    </main>
  );
}