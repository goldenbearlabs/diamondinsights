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

import styles from './page.module.css';

export default function LoginPage() {
  const router = useRouter();
  const db = getFirestore();

  const [email, setEmail]         = useState('');
  const [password, setPassword]   = useState('');
  const [remember, setRemember]   = useState(false);
  const [error, setError]         = useState('');
  const [loading, setLoading]     = useState(false);
  const [showPw, setShowPw]       = useState(false);
  const [identifier, setIdentifier] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // --- CLIENT-SIDE VALIDATION ---
    if (!identifier.trim()) {
      return setError('Email is required');
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    let emailToUse = identifier.trim();
    if (!emailRegex.test(identifier)) {
      try {
        const q = query(
          collection(db, 'users'),
          where('username', '==', identifier.trim())
        );
        const snap = await getDocs(q);
        if (snap.empty) {
          return setError('No account found with that username');
        }
        const userDoc = snap.docs[0].data() as any;
        if (!userDoc.email) {
          return setError('This user does not have a sign-in email');
        }
        emailToUse = userDoc.email;
      } catch (err) {
        console.error(err);
        return setError('Error with the server try again with your email or wait a little bit.')
      }
      
    }
    if (!password) {
      return setError('Password is required');
    }

    setLoading(true);

    try {
      await signInWithEmailAndPassword(auth, emailToUse, password);
      router.push('/');
    } catch (err: any) {
      console.error('Login error', err);
      // Map Firebase error codes to friendly messages
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
          setError('Invalid email address or password');
          break;
        case 'auth/too-many-requests':
          setError('Too many failed attempts. Try again later.');
          break;
        default:
          setError(err.message || 'Something went wrong');
      }
      setLoading(false);
    }
  };

  return (
    <main className={styles.authContainer}>
      <aside className={styles.brandPanel}>
        <div className={styles.brandOverlay}/>
        <div className={styles.brandContent}>
          <div className={styles.logo}>
            <div className={styles.logoIcon}><FaBaseballBall/></div>
            <div className={styles.logoText}>
              <span className={styles.logoPart1}>Diamond</span>
              <span className={styles.logoPart2}>Insights</span>
            </div>
          </div>
          <h1 className={styles.brandHeading}>
            Welcome Back to the <span>#1</span> MLB The Show Prediction Platform
          </h1>
          <ul className={styles.brandFeatures}>
            <li><FaChartLine className={styles.featureIcon}/> AI-powered roster predictions</li>
            <li><FaUsers      className={styles.featureIcon}/> Join 2,000+ investors</li>
            <li><FaBolt       className={styles.featureIcon}/> Real-time updates & alerts</li>
          </ul>
        </div>
      </aside>

      <section className={styles.formPanel}>
        <header className={styles.authHeader}>
          <h2>Welcome Back</h2>
          <p>Sign in to access your predictions & tools</p>
        </header>

        <form onSubmit={handleSubmit} className={styles.authForm}>
          {error && <div className={styles.authError}>{error}</div>}

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

          <button
            type="submit"
            className={styles.submitBtn}
            disabled={loading}
          >
            {loading ? 'Logging In…' : 'Log In'}
          </button>
        </form>

        <p className={styles.loginLink}>
          Don't have an account? <Link href="/signup">Sign Up</Link>
        </p>
      </section>
    </main>
  );
}
