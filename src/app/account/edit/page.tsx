// src/app/account/[uid]/edit/page.tsx
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

export default function EditProfilePage() {
  const router    = useRouter()
  const [user,    setUser]    = useState<FirebaseUser|null>(null)
  const [loading, setLoading] = useState(true)
  const [saving,  setSaving]  = useState(false)
  const [error,   setError]   = useState<string|null>(null)

  // form fields
  const [displayName, setDisplayName] = useState('')
  const [email,       setEmail]       = useState('')
  const [currentPw,   setCurrentPw]   = useState('')
  const [newPw,       setNewPw]       = useState('')
  const [confirmPw,   setConfirmPw]   = useState('')
  const [file,        setFile]        = useState<File|null>(null)
  const [previewUrl,  setPreviewUrl]  = useState<string|null>(null)
  const [initialPhotoURL, setInitialPhotoURL] = useState<string|null>(null)

  // 1) load current user:
  useEffect(() => {
    return onAuthStateChanged(auth, u => {
      if (!u) {
        router.replace('/login')
        return
      }
      setUser(u)
      setDisplayName(u.displayName||'')
      setEmail(u.email||'')
      setPreviewUrl(u.photoURL||null)
      setInitialPhotoURL(u.photoURL||null)
      setLoading(false)
    })
  }, [router])

  // 2) form submit
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!user) return
    setError(null)
    setSaving(true)

    // require current password if changing email or password
    const credChange = newPw || email !== user.email
    if (credChange && !currentPw) {
      setError('Please enter your current password to change email or password.')
      setSaving(false)
      return
    }

    try {
      // 2a) reauthenticate if needed
      if (credChange) {
        try {
          const cred = EmailAuthProvider.credential(user.email!, currentPw)
          await reauthenticateWithCredential(user, cred)
        } catch {
          throw new Error('Current password is incorrect.')
        }
      }

      // 2b) check username uniqueness
      if (displayName !== user.displayName) {
        const q = query(
          collection(db, 'users'),
          where('username', '==', displayName)
        )
        const snap = await getDocs(q)
        if (!snap.empty && snap.docs.some(d => d.id !== user.uid)) {
          throw new Error('That username is already taken.')
        }
      }

      let photoURL = user.photoURL

      // 2c) if new avatar, delete old and upload new
      if (file) {
        if (initialPhotoURL && initialPhotoURL.includes('/profilePics/')) {
          try {
            const oldRef = storageRef(storage, initialPhotoURL
              .split('?')[0]
              .split('/o/')[1]
              .replace('%2F','/'))
            await deleteObject(oldRef)
          } catch {
            /* fail silently */
          }
        }
        const ext      = file.type.split('/')[1] || 'jpg'
        const path     = `profilePics/${user.uid}.${ext}`
        const imageRef = storageRef(storage, path)
        await uploadBytes(imageRef, file)
        photoURL = await getDownloadURL(imageRef)
      }

      // 2d) Auth profile
      await updateProfile(user, { displayName, photoURL })

      // 2e) email
      if (email !== user.email) {
        await updateEmail(user, email)
      }

      // 2f) password
      if (newPw) {
        if (newPw !== confirmPw) {
          throw new Error("New passwords don't match.")
        }
        await updatePassword(user, newPw)
      }

      // 2g) mirror in Firestore
      await setDoc(doc(db, 'users', user.uid), {
        username:   displayName,
        email,
        profilePic: photoURL
      }, { merge:true })

      router.push(`/account/${user.uid}`)
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'Failed to save changes.'
      setError(message)
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="spinner-container">
        <FaSpinner className="spinner" />
      </div>
    )
  }

  const displayUrl = previewUrl || initialPhotoURL || '/default_profile.jpg'

  return (
    <main className={styles.container}>
      <h1 className={styles.title}>Edit Profile</h1>

      {error && <div className={styles.errorBanner}>{error}</div>}

      <form onSubmit={handleSubmit} className={styles.form}>
        {/* avatar */}
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
          <input
            type="file"
            accept="image/*"
            onChange={e => {
              const f = e.target.files?.[0] ?? null
              setFile(f)
              if (f) setPreviewUrl(URL.createObjectURL(f))
            }}
            disabled={saving}
          />
        </div>

        {/* username */}
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

        {/* email */}
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

        {/* current password */}
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

        {/* new password */}
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

        {/* confirm */}
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
