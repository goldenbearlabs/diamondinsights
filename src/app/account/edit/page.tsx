// src/app/account/[uid]/edit/page.tsx
'use client'

import React, { useState, useEffect } from 'react'
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
} from 'firebase/storage'
import { doc, updateDoc, setDoc } from 'firebase/firestore'

export default function EditProfilePage() {
  const router = useRouter()
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

  // 1) hook up current user
  useEffect(() => {
    return onAuthStateChanged(auth, u => {
      if (!u) {
        router.replace('/login')
        return
      }
      setUser(u)
      setDisplayName(u.displayName || '')
      setEmail(u.email || '')
      setPreviewUrl(u.photoURL || null)
      setLoading(false)
    })
  }, [router])

  // 2) submit handler
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!user) return
    setError(null)
    setSaving(true)

    // only require current password if they're changing email or password
    const wantsCredChange = newPw || email !== user.email
    if (wantsCredChange) {
      if (!currentPw) {
        setError('You must enter your current password to change email or password.')
        setSaving(false)
        // reload so everything resets
        return window.location.reload()
      }
      try {
        const cred = EmailAuthProvider.credential(user.email!, currentPw)
        await reauthenticateWithCredential(user, cred)
      } catch {
        setError('Current password is incorrect.')
        setSaving(false)
        return window.location.reload()
      }
    }

    try {
      // 2a) upload new profile pic if provided
      let photoURL = user.photoURL
      if (file) {
        const ext  = file.type.split('/')[1] || 'jpg'
        const path = `profilePics/${user.uid}.${ext}`
        const imageRef = storageRef(storage, path)
        await uploadBytes(imageRef, file)
        photoURL = await getDownloadURL(imageRef)
        // force reload so auth picks up new photoURL
        await auth.currentUser?.reload()
      }

      // 2b) update Firebase Auth profile
      await updateProfile(user, { displayName, photoURL })

      // 2c) update email if changed
      if (email !== user.email) {
        await updateEmail(user, email)
      }

      // 2d) update password if requested
      if (newPw) {
        if (newPw !== confirmPw) {
          throw new Error("New passwords don't match.")
        }
        await updatePassword(user, newPw)
      }

      // 2e) mirror changes into Firestore user doc (create if doesn't exist)
      const userRef = doc(db, 'users', user.uid)
      await setDoc(userRef, {
        username:   displayName,
        email:      email,
        profilePic: photoURL
      }, { merge: true })

      // done → back to profile
      router.push(`/account/${user.uid}`)
    } catch (e: any) {
      console.error('EditProfile error:', e)
      setError(e.message || 'Failed to save changes.')
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className={styles.container}>
        <p>Loading…</p>
      </div>
    )
  }

  return (
    <main className={styles.container}>
      <h1 className={styles.title}>Edit Profile</h1>
      {error && <div className={styles.error}>{error}</div>}
      <form onSubmit={handleSubmit} className={styles.form}>
        {/* Profile Picture */}
        <div className={styles.field}>
          <label className={styles.label}>Profile Picture</label>
          <div className={styles.preview}>
            {previewUrl
              ? <img src={previewUrl} alt="Preview" className={styles.avatar}/>
              : <div className={styles.avatarPlaceholder}/>}
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

        {/* Username */}
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

        {/* Email */}
        <div className={styles.field}>
          <label className={styles.label} htmlFor="email">Email</label>
          <input
            id="email"
            type="email"
            className={styles.input}
            value={email}
            onChange={e => setEmail(e.target.value)}
            disabled={saving}
            required
          />
        </div>

        {/* Current Password */}
        <div className={styles.field}>
          <label className={styles.label} htmlFor="currentPw">
            Current Password
            <span className={styles.helpText}>(needed to change email or password)</span>
          </label>
          <input
            id="currentPw"
            type="password"
            className={styles.input}
            value={currentPw}
            onChange={e => setCurrentPw(e.target.value)}
            disabled={saving}
          />
        </div>

        {/* New Password */}
        <div className={styles.field}>
          <label className={styles.label} htmlFor="newPw">New Password</label>
          <input
            id="newPw"
            type="password"
            className={styles.input}
            value={newPw}
            onChange={e => setNewPw(e.target.value)}
            disabled={saving}
            placeholder="leave blank to keep current"
          />
        </div>

        {/* Confirm New Password */}
        <div className={styles.field}>
          <label className={styles.label} htmlFor="confirmPw">Confirm New Password</label>
          <input
            id="confirmPw"
            type="password"
            className={styles.input}
            value={confirmPw}
            onChange={e => setConfirmPw(e.target.value)}
            disabled={saving}
            placeholder="must match new password"
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
