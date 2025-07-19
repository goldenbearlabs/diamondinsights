// src/app/signup/page.tsx
// User registration page with comprehensive account creation workflow
// Features: Firebase authentication, profile picture upload, username uniqueness validation, Firestore integration
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { FirebaseError } from 'firebase/app'

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

/**
 * Signup page component - handles complete user registration workflow
 * Multi-step process: validation → username check → Firebase Auth → file upload → profile update → Firestore
 * Features comprehensive error handling and user feedback throughout the registration process
 */
export default function SignupPage() {
  const router = useRouter();

  // Form input states for user registration data
  const [username, setUsername] = useState('');     // Unique username for platform identity
  const [email, setEmail]       = useState('');     // Email address for Firebase authentication
  const [password, setPassword] = useState('');     // User password (minimum 6 characters)
  const [confirm, setConfirm]   = useState('');     // Password confirmation for validation

  // File upload state for profile picture
  const [file, setFile]         = useState<File|null>(null);  // Selected profile image file

  // UI control states for password visibility
  const [showPw, setShowPw]     = useState(false);  // Toggle password field visibility
  const [showCf, setShowCf]     = useState(false);  // Toggle confirm password field visibility

  // Application states for user feedback
  const [error, setError]       = useState('');     // Error message display
  const [loading, setLoading]   = useState(false);  // Form submission loading state

  // Handle profile picture file selection with validation
  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setError('');
    const chosen = e.target.files?.[0] ?? null;
    if (chosen && chosen.size > 5_000_000) {
      // Enforce 5MB file size limit for storage efficiency
      setError('Profile picture must be under 5 MB');
      setFile(null);
    } else {
      setFile(chosen);
    }
  };

  // Handle form submission with multi-step registration workflow
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    // Step 1: Client-side form validation
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

    // Step 2: Username uniqueness verification in Firestore
    try {
      const usersCol = collection(db, 'users');
      const q = query(usersCol, where('username', '==', username.trim()));
      const snap = await getDocs(q);
      if (!snap.empty) {
        return setError('That username is already taken');
      }
    } catch (queryErr: unknown) {
      console.error('Username check error', queryErr);
      return setError('Unable to verify username uniqueness');
    }

    setLoading(true);

    try {
      // Step 3: Create Firebase Authentication user account
      const credential = await createUserWithEmailAndPassword(auth, email, password);
      const user = credential.user;

      // Step 4: Upload profile picture to Firebase Storage (optional)
      let photoURL = '';
      if (file) {
        try {
          const ext  = file.name.split('.').pop();  // Extract file extension
          const path = `profilePics/${user.uid}.${ext}`;  // Create unique filename
          const ref  = storageRef(storage, path);
          await uploadBytes(ref, file);
          photoURL = await getDownloadURL(ref);  // Get public download URL
        } catch (uploadErr: unknown) {
          console.error('Storage upload error', uploadErr);
          throw new Error('Failed to upload profile picture');
        }
      }

      // Step 5: Update Firebase Auth user profile with display name and photo
      try {
        await updateProfile(user, { displayName: username.trim(), photoURL });
      } catch (profileErr: unknown) {
        console.error('Profile update error', profileErr);
        // Not fatal: continue to Firestore document creation
      }

      // Step 6: Create comprehensive user document in Firestore
      const trimmedUsername = username.trim()
      await setDoc(doc(db, 'users', user.uid), {
        uid:               user.uid,
        username:          trimmedUsername,
        username_lower:    trimmedUsername.toLowerCase(),  // For case-insensitive searches
        email:             user.email,
        profilePic:        photoURL,
        createdAt:         serverTimestamp(),
        investmentsPublic: true,   // Default to public investment portfolio
        searchable:        true,   // Allow user to be found in search
      });

      // Redirect to user's account page on successful registration
      router.push(`/account/${user.uid}`);
    } catch (err: unknown) {
      console.error('Signup flow error', err);
      
      // Comprehensive error handling with user-friendly messages
      if (err instanceof FirebaseError) {
        // Map Firebase authentication error codes to readable messages
        switch (err.code) {
          case 'auth/email-already-in-use':
            setError('This email is already registered')
            break
          case 'auth/invalid-email':
            setError('Invalid email address')
            break
          case 'auth/weak-password':
            setError('Password is too weak')
            break
          default:
            setError(err.message || 'Something went wrong')
        }
      } else {
        // Handle custom errors (e.g., from profile picture upload) and other exceptions
        const msg = (err as { message?: string }).message
        setError(msg ?? 'Something went wrong')
      }
      setLoading(false);  // Re-enable form after error
    }
  }

  return (
    <main className={styles.authContainer}>
      {/* Brand marketing panel showcasing platform value and encouraging registration */}
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
          {/* Registration call-to-action with platform positioning */}
          <h1 className={styles.brandHeading}>
            Join the <span>#1</span> MLB The Show Prediction Platform
          </h1>
          {/* Key platform features and statistics to encourage signup */}
          <ul className={styles.brandFeatures}>
            <li><FaChartLine className={styles.featureIcon}/> 96% AI-powered accuracy</li>
            <li><FaUsers      className={styles.featureIcon}/> 2,000+ investors</li>
            <li><FaBolt       className={styles.featureIcon}/> Real-time alerts</li>
          </ul>
        </div>
      </aside>

      {/* Registration form panel with comprehensive user input fields */}
      <section className={styles.formPanel}>
        <header className={styles.authHeader}>
          <h2>Create Your Account</h2>
          <p>Join our MLB The Show investors</p>
        </header>

        <form onSubmit={handleSubmit} className={styles.authForm}>
          {/* Error message display for registration failures */}
          {error && <div className={styles.authError}>{error}</div>}

          {/* Username input field with uniqueness validation */}
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

          {/* Email input field for Firebase authentication */}
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

          {/* Optional profile picture upload with file size validation */}
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

          {/* Password input field with visibility toggle and strength requirements */}
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
              {/* Show/hide password toggle for better user experience */}
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

          {/* Password confirmation field with matching validation */}
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
              {/* Show/hide password confirmation toggle */}
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

          {/* Submit button with loading state feedback during registration process */}
          <button
            type="submit"
            className={styles.submitBtn}
            disabled={loading}
          >
            {loading ? 'Creating…' : 'Sign Up'}
          </button>

          {/* Navigation link to login page for existing users */}
          <p className={styles.loginLink}>
            Already have an account? <Link href="/login">Log In</Link>
          </p>
        </form>
      </section>
    </main>
  );
}
