// src/app/account/edit/page.tsx
// Profile editing page - allows users to update their profile information, email, password, and profile picture
'use client'

import React, { useState, useEffect } from 'react'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import styles from './page.module.css'
import { auth, db, storage } from '@/lib/firebaseClient'
import {
  updateProfile,
  updateEmail,
  updatePassword,
  onAuthStateChanged,
  reauthenticateWithCredential,
  EmailAuthProvider,
  User as FirebaseUser
} from 'firebase/auth'
import {
  ref as storageRef,
  uploadBytes,
  getDownloadURL,
  deleteObject
} from 'firebase/storage'
import {
  collection,
  query,
  where,
  getDocs,
  doc,
  setDoc
} from 'firebase/firestore'
import { FaSpinner } from 'react-icons/fa'

/**
 * Profile editing page component - allows authenticated users to update their profile information
 * Handles profile picture upload, username/email changes, and password updates with proper validation
 */
export default function EditProfilePage() {
  const router    = useRouter()
  // Current authenticated user state
  const [user,    setUser]    = useState<FirebaseUser|null>(null)
  // Loading state for initial page load
  const [loading, setLoading] = useState(true)
  // Saving state for form submission
  const [saving,  setSaving]  = useState(false)
  // Error message state for form validation
  const [error,   setError]   = useState<string|null>(null)

  // Form field states
  const [displayName, setDisplayName] = useState('')
  const [email,       setEmail]       = useState('')
  const [currentPw,   setCurrentPw]   = useState('')
  const [newPw,       setNewPw]       = useState('')
  const [confirmPw,   setConfirmPw]   = useState('')
  // File upload state for profile picture
  const [file,        setFile]        = useState<File|null>(null)
  // Preview URL for selected profile picture
  const [previewUrl,  setPreviewUrl]  = useState<string|null>(null)
  // Track initial photo URL for cleanup purposes
  const [initialPhotoURL, setInitialPhotoURL] = useState<string|null>(null)

  // Load current user data and populate form fields
  useEffect(() => {
    return onAuthStateChanged(auth, u => {
      if (!u) {
        // Redirect to login if not authenticated
        router.replace('/login')
        return
      }
      setUser(u)
      // Pre-populate form with current user data
      setDisplayName(u.displayName||'')
      setEmail(u.email||'')
      setPreviewUrl(u.photoURL||null)
      setInitialPhotoURL(u.photoURL||null)
      setLoading(false)
    })
  }, [router])

  // Handle form submission with comprehensive validation and updates
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!user) return
    setError(null)
    setSaving(true)

    // Require current password for sensitive operations (email/password changes)
    const credChange = newPw || email !== user.email
    if (credChange && !currentPw) {
      setError('Please enter your current password to change email or password.')
      setSaving(false)
      return
    }

    try {
      // Re-authenticate user if changing sensitive credentials
      if (credChange) {
        try {
          const cred = EmailAuthProvider.credential(user.email!, currentPw)
          await reauthenticateWithCredential(user, cred)
        } catch {
          throw new Error('Current password is incorrect.')
        }
      }

      // Check username uniqueness if username is being changed
      if (displayName !== user.displayName) {
        const q = query(
          collection(db, 'users'),
          where('username', '==', displayName)
        )
        const snap = await getDocs(q)
        // Ensure no other user has this username
        if (!snap.empty && snap.docs.some(d => d.id !== user.uid)) {
          throw new Error('That username is already taken.')
        }
      }

      let photoURL = user.photoURL

      // Handle profile picture upload if new file is selected
      if (file) {
        // Delete old profile picture if it exists in our storage
        if (initialPhotoURL && initialPhotoURL.includes('/profilePics/')) {
          try {
            const oldRef = storageRef(storage, initialPhotoURL
              .split('?')[0]
              .split('/o/')[1]
              .replace('%2F','/'))
            await deleteObject(oldRef)
          } catch {
            /* fail silently - old image might not exist */
          }
        }
        // Upload new profile picture to Firebase Storage
        const ext      = file.type.split('/')[1] || 'jpg'
        const path     = `profilePics/${user.uid}.${ext}`
        const imageRef = storageRef(storage, path)
        await uploadBytes(imageRef, file)
        photoURL = await getDownloadURL(imageRef)
      }

      // Update Firebase Auth profile with new display name and photo
      await updateProfile(user, { displayName, photoURL })

      // Update email if it has changed
      if (email !== user.email) {
        // Re-authenticate immediately before email update for security
        const cred = EmailAuthProvider.credential(user.email!, currentPw)
        await reauthenticateWithCredential(user, cred)
    
        // Update email address
        await updateEmail(user, email)
      }

      // Update password if new password is provided
      if (newPw) {
        if (newPw !== confirmPw) {
          throw new Error("New passwords don't match.")
        }
        await updatePassword(user, newPw)
      }

      // Synchronize changes to Firestore user document
      await setDoc(
        doc(db, 'users', user.uid),
        { 
          username: displayName, 
          username_lower: displayName.toLowerCase(),
          email, 
          profilePic: photoURL,
          searchable: true
        },
        { merge: true }
      )

      // Redirect back to account page after successful update
      router.push(`/account/${user.uid}`)
    } catch (err: unknown) {
      let msg = 'Failed to save changes.'
      console.log(err)
  
      if (typeof err === 'object' && err !== null) {
        // Handle Firebase Auth error codes
        const e = err as { code?: unknown; message?: unknown }
  
        if (typeof e.code === 'string') {
          switch (e.code) {
            case 'auth/invalid-email':
              msg = 'That email address isn’t valid.'
              break
            case 'auth/email-already-in-use':
              msg = 'That email is already in use by another account.'
              break
            case 'auth/requires-recent-login':
              msg = 'Please re-enter your password and try again.'
              break
            case 'auth/operation-not-allowed':
              msg = 'Changing your email is currently disabled. Contact support.'
              break
            default:
              // Use generic message for unknown Firebase errors
              break
          }
        } else if (typeof e.message === 'string') {
          // it wasn’t a firebase auth code, but it does have a message
          msg = e.message
        }
      }
  
      setError(msg)
      setSaving(false)
    }
    
  }

  // Show loading spinner while fetching user data
  if (loading) {
    return (
      <div className="spinner-container">
        <FaSpinner className="spinner" />
      </div>
    )
  }

  // Determine profile picture URL with fallback to default
  const displayUrl = previewUrl || initialPhotoURL || '/default_profile.jpg'

  return (
    <main className={styles.container}>
      <h1 className={styles.title}>Edit Profile</h1>

      {/* Display error message if validation fails */}
      {error && <div className={styles.errorBanner}>{error}</div>}

      <form onSubmit={handleSubmit} className={styles.form}>
        {/* Profile picture upload section */}
        <div className={styles.field}>
          <label className={styles.label}>Profile Picture</label>
          <div className={styles.preview}>
            {previewUrl ? (
                <Image
                  src={displayUrl}
                  alt="Avatar Preview"
                  width={100}
                  height={100}
                  className={styles.avatar}
                />
              ) : (
                <div className={styles.avatarPlaceholder} role="img" aria-label="No avatar"/>
              )}
          </div>
          {/* File input for selecting new profile picture */}
          <input
            type="file"
            accept="image/*"
            onChange={e => {
              const f = e.target.files?.[0] ?? null
              setFile(f)
              // Generate preview URL for selected image
              if (f) setPreviewUrl(URL.createObjectURL(f))
            }}
            disabled={saving}
          />
        </div>

        {/* Username field */}
        <div className={styles.field}>
          <label className={styles.label} htmlFor="displayName">Username</label>
          <input
            id="displayName"
            className={styles.input}
            value={displayName}
            onChange={e => setDisplayName(e.target.value)}
            disabled={saving}
            required
          />
        </div>

        {/* Email field */}
        <div className={styles.field}>
          <label className={styles.label} htmlFor="email">Email</label>
          <input
            id="email" type="email"
            className={styles.input}
            value={email}
            onChange={e => setEmail(e.target.value)}
            disabled={saving}
            required
          />
        </div>

        {/* Current password field - required for sensitive changes */}
        <div className={styles.field}>
          <label className={styles.label} htmlFor="currentPw">
            Current Password
            <span className={styles.helpText}>
              (required to change email or password)
            </span>
          </label>
          <input
            id="currentPw" type="password"
            className={styles.input}
            value={currentPw}
            onChange={e => setCurrentPw(e.target.value)}
            disabled={saving}
            autoComplete="off"
          />
        </div>

        {/* New password field */}
        <div className={styles.field}>
          <label className={styles.label} htmlFor="newPw">New Password</label>
          <input
            id="newPw" type="password"
            className={styles.input}
            value={newPw}
            onChange={e => setNewPw(e.target.value)}
            disabled={saving}
            placeholder="leave blank to keep current"
            autoComplete="new-password"
          />
        </div>

        {/* Password confirmation field */}
        <div className={styles.field}>
          <label className={styles.label} htmlFor="confirmPw">Confirm New Password</label>
          <input
            id="confirmPw" type="password"
            className={styles.input}
            value={confirmPw}
            onChange={e => setConfirmPw(e.target.value)}
            disabled={saving}
            placeholder="must match new password"
            autoComplete="new-password"
          />
        </div>

        {/* Submit button with loading state */}
        <button
          type="submit"
          className={styles.submit}
          disabled={saving}
        >
          {saving ? 'Saving…' : 'Save Changes'}
        </button>
      </form>
    </main>
  )
}
