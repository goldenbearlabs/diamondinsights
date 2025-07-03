'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

import { auth, db, storage } from '@/lib/firebaseClient';
import {
  createUserWithEmailAndPassword,
  updateProfile
} from 'firebase/auth';
import {
  doc,
  setDoc,
  serverTimestamp,
  collection,
  query,
  where,
  getDocs
} from 'firebase/firestore';
import {
  ref as storageRef,
  uploadBytes,
  getDownloadURL
} from 'firebase/storage';

import {
  FaCloudUploadAlt,
  FaEye,
  FaEyeSlash,
  FaBaseballBall,
  FaChartLine,
  FaUsers,
  FaBolt
} from 'react-icons/fa';

import styles from './page.module.css';

export default function SignupPage() {
  const router = useRouter();

  const [username, setUsername] = useState('');
  const [email, setEmail]       = useState('');
  const [rating, setRating]     = useState<number>(0);
  const [file, setFile]         = useState<File|null>(null);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm]   = useState('');
  const [showPw, setShowPw]     = useState(false);
  const [showCf, setShowCf]     = useState(false);

  const [error, setError]     = useState('');
  const [loading, setLoading] = useState(false);

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setError('');
    const chosen = e.target.files?.[0] ?? null;
    if (chosen && chosen.size > 5_000_000) {
      setError('Profile picture must be under 5 MB');
      setFile(null);
    } else {
      setFile(chosen);
    }
  };

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    // ----- CLIENT-SIDE VALIDATION -----
    if (!username.trim()) {
      return setError('Username is required');
    }
    if (!email.trim()) {
      return setError('Email is required');
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return setError('Please enter a valid email address');
    }
    if (password !== confirm) {
      return setError("Passwords don't match");
    }
    if (password.length < 6) {
      return setError('Password must be at least 6 characters');
    }
    if (rating && (rating < 100 || rating > 2000)) {
      return setError('Rating must be between 100 and 2000');
    }

    // ----- USERNAME UNIQUENESS CHECK -----
    try {
      const usersCol = collection(db, 'users');
      const q = query(usersCol, where('username', '==', username.trim()));
      const snap = await getDocs(q);
      if (!snap.empty) {
        return setError('That username is already taken');
      }
    } catch (queryErr: any) {
      console.error('Username check error', queryErr);
      return setError('Unable to verify username uniqueness');
    }

    setLoading(true);

    try {
      // 1) Create Auth user
      const credential = await createUserWithEmailAndPassword(auth, email, password);
      const user = credential.user;

      // 2) Optional upload profile pic
      let photoURL = '';
      if (file) {
        try {
          const ext  = file.name.split('.').pop();
          const path = `profilePics/${user.uid}.${ext}`;
          const ref  = storageRef(storage, path);
          await uploadBytes(ref, file);
          photoURL = await getDownloadURL(ref);
        } catch (uploadErr: any) {
          console.error('Storage upload error', uploadErr);
          throw new Error('Failed to upload profile picture');
        }
      }

      // 3) Update displayName + photoURL
      try {
        await updateProfile(user, { displayName: username.trim(), photoURL });
      } catch (profileErr: any) {
        console.error('Profile update error', profileErr);
        // Not fatal: continue on to firestore write
      }

      // 4) Write user doc
      await setDoc(doc(db, 'users', user.uid), {
        uid:               user.uid,
        username:          username.trim(),
        email:             user.email,
        rating,
        profilePic:        photoURL,
        createdAt:         serverTimestamp(),
        investmentsPublic: true,
      });

      router.push('/');
    } catch (err: any) {
      console.error('Signup flow error', err);
      // Map known Firebase errors
      if (err.code === 'auth/email-already-in-use') {
        setError('This email is already registered');
      } else if (err.code === 'auth/invalid-email') {
        setError('Invalid email address');
      } else if (err.code === 'auth/weak-password') {
        setError('Password is too weak');
      } else {
        setError(err.message || 'Something went wrong');
      }
      setLoading(false);
    }
  }

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
            Join the <span>#1</span> MLB The Show Prediction Platform
          </h1>
          <ul className={styles.brandFeatures}>
            <li><FaChartLine className={styles.featureIcon}/> 96% AI-powered accuracy</li>
            <li><FaUsers      className={styles.featureIcon}/> 2,000+ investors</li>
            <li><FaBolt       className={styles.featureIcon}/> Real-time alerts</li>
          </ul>
        </div>
      </aside>

      <section className={styles.formPanel}>
        <header className={styles.authHeader}>
          <h2>Create Your Account</h2>
          <p>Join our MLB The Show investors</p>
        </header>

        <form onSubmit={handleSubmit} className={styles.authForm}>
          {error && <div className={styles.authError}>{error}</div>}

          <div className={styles.formGroup}>
            <label htmlFor="username">Username</label>
            <input
              id="username"
              type="text"
              className={styles.formInput}
              value={username}
              onChange={e => { setError(''); setUsername(e.target.value); }}
              disabled={loading}
              required
            />
          </div>

          <div className={styles.formGroup}>
            <label htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              className={styles.formInput}
              value={email}
              onChange={e => { setError(''); setEmail(e.target.value); }}
              disabled={loading}
              required
            />
          </div>

          <div className={styles.fileUpload}>
            <label htmlFor="file" className={styles.fileLabel}>
              <FaCloudUploadAlt/> Upload Profile Pic (optional)
            </label>
            <input
              id="file"
              type="file"
              accept="image/*"
              className={styles.fileInput}
              onChange={onFileChange}
              disabled={loading}
            />
            <div className={styles.fileName}>{file?.name || 'No file chosen'}</div>
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

          <div className={styles.formGroup}>
            <label htmlFor="confirm">Confirm Password</label>
            <div className={styles.passwordContainer}>
              <input
                id="confirm"
                type={showCf ? 'text' : 'password'}
                className={styles.formInput}
                value={confirm}
                onChange={e => { setError(''); setConfirm(e.target.value); }}
                disabled={loading}
                required
              />
              <button
                type="button"
                className={styles.togglePassword}
                onClick={() => setShowCf(v => !v)}
                disabled={loading}
              >
                {showCf ? <FaEye/> : <FaEyeSlash/>}
              </button>
            </div>
          </div>

          <button
            type="submit"
            className={styles.submitBtn}
            disabled={loading}
          >
            {loading ? 'Creating…' : 'Sign Up'}
          </button>

          <p className={styles.loginLink}>
            Already have an account? <Link href="/login">Log In</Link>
          </p>
        </form>
      </section>
    </main>
  );
}
