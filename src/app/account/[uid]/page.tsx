// src/app/account/[uid]/page.tsx
'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import styles from './page.module.css'
import { auth, db } from '@/lib/firebaseClient'
import {
  onAuthStateChanged,
  User as FirebaseUser
} from 'firebase/auth'
import {
  doc,
  getDoc,
  updateDoc,
  Timestamp,
  collection,
  query,
  where,
  getDocs
} from 'firebase/firestore'

interface ProfileData {
  username:         string
  email:            string
  rating:           number
  profilePic:       string
  createdAt:        Timestamp
  investmentsPublic?: boolean
}

export default function AccountPage() {
  const router = useRouter()
  const { uid } = useParams() as { uid?: string }
  const [currentUser, setCurrentUser] = useState<FirebaseUser|null>(null)
  const [profile, setProfile]         = useState<ProfileData|null>(null)
  const [loading, setLoading]         = useState(true)
  const [saving, setSaving]           = useState(false)
  const [stats, setStats] = useState<{
    invCount: number
    totalInvested: number
    totalMessages: number
  }>({ invCount: 0, totalInvested: 0, totalMessages: 0 })

  const viewingUid = uid || currentUser?.uid
  const isOwner    = currentUser?.uid === viewingUid

  // 1) auth listener
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, user => {
      setCurrentUser(user)
      if (!user && !uid) router.replace('/login')
    })
    return unsub
  }, [router, uid])

  // 2) load profile
  useEffect(() => {
    if (!viewingUid) return
    const loadProfile = async () => {
      const snap = await getDoc(doc(db, 'users', viewingUid))
      if (snap.exists()) {
        setProfile(snap.data() as ProfileData)
      } else {
        setProfile({
          username: viewingUid,
          email: '',
          rating: 0,
          profilePic: '',
          createdAt: Timestamp.now(),
          investmentsPublic: false
        })
      }
    }
    loadProfile()
  }, [viewingUid])

  // 3) load stats once we know viewingUid
  useEffect(() => {
    if (!viewingUid) return
    const loadStats = async () => {
      // investments
      const invCol = collection(db, 'users', viewingUid, 'investments')
      const invSnap = await getDocs(invCol)
      let total = 0
      invSnap.forEach(d => {
        const { quantity, avgBuyPrice } = d.data() as any
        total += (quantity || 0) * (avgBuyPrice || 0)
      })

      // comments
      const commentsQ = query(
        collection(db, 'comments'),
        where('userId', '==', viewingUid)
      )
      const commentsSnap = await getDocs(commentsQ)
      let msgCount = commentsSnap.size

      // chat rooms
      const rooms = ['main','investing','flipping','stub']
      for (const r of rooms) {
        const chatQ = query(
          collection(db, `chat_${r}`),
          where('userId', '==', viewingUid)
        )
        const snap = await getDocs(chatQ)
        msgCount += snap.size
      }

      setStats({
        invCount: invSnap.size,
        totalInvested: total,
        totalMessages: msgCount
      })

      setLoading(false)
    }
    loadStats()
  }, [viewingUid])

  if (loading || !profile) {
    return <p style={{ padding:'2rem', textAlign:'center' }}>Loading…</p>
  }

  const createdDate = profile.createdAt.toDate().toLocaleDateString()

  // toggle public/private
  const toggleVisibility = async () => {
    if (!isOwner) return
    setSaving(true)
    const newVal = !profile.investmentsPublic
    await updateDoc(doc(db, 'users', viewingUid!), {
      investmentsPublic: newVal
    })
    setProfile(p => p ? { ...p, investmentsPublic: newVal } : p)
    setSaving(false)
  }

  return (
    <div className={styles.accountContainer}>
      <div className={styles.accountHeader}>
        <h2>
          {isOwner ? 'My Account' : `${profile.username}'s Account`}
        </h2>
        <p>
          {isOwner
            ? 'Manage your profile, view statistics, and update your settings'
            : 'View user profile and statistics'}
        </p>
      </div>

      <div className={styles.profileSection}>
        <div className={styles.profileCard}>
          <div className={styles.profileHeader}>
            <img
              src={profile.profilePic || '/placeholder.png'}
              alt="Profile Picture"
              className={styles.profilePic}
            />
            <div className={styles.profileInfo}>
              <h3>{profile.username}</h3>
            </div>
          </div>

          <div className={styles.profileDetails}>
            {isOwner && (
              <div className={styles.detailCard}>
                <h4>Email</h4>
                <p className={styles.value}>{profile.email}</p>
              </div>
            )}

            <div className={styles.detailCard}>
              <h4>Online Rating</h4>
              <p className={styles.value}>{profile.rating}</p>
            </div>

            <div className={styles.detailCard}>
              <h4>Account Created</h4>
              <p className={styles.value}>{createdDate}</p>
            </div>

            {isOwner ? (
              <div className={styles.detailCard}>
                <h4>Investments Visibility</h4>
                <label className={styles.switch}>
                  <input
                    type="checkbox"
                    checked={!!profile.investmentsPublic}
                    onChange={toggleVisibility}
                    disabled={saving}
                  />
                  <span className={styles.slider} />
                </label>
                <p className={styles.helpText}>
                  {profile.investmentsPublic
                    ? 'Your investments are public.'
                    : 'Your investments are private.'}
                </p>
              </div>
            ) : (
              profile.investmentsPublic && (
                <div className={styles.detailCard}>
                  <Link
                    href={`/investment/${viewingUid}`}
                    className="btn btn-primary"
                  >
                    View {profile.username}’s Investments
                  </Link>
                </div>
              )
            )}
          </div>
        </div>

        <div className={styles.accountStats}>
          <div className={styles.statsHeader}>
            <h3>Trader Statistics</h3>
            <p>Your performance metrics and trading insights</p>
          </div>
          <div className={styles.statsGrid}>
            <div className={styles.statItem}>
              <h5>Total Investments</h5>
              <p className={styles.value}>{stats.invCount}</p>
            </div>
            <div className={styles.statItem}>
              <h5>Total Invested</h5>
              <p className={styles.value}>
                ${stats.totalInvested.toLocaleString()}
              </p>
            </div>
            <div className={styles.statItem}>
              <h5>Total Messages</h5>
              <p className={styles.value}>{stats.totalMessages}</p>
            </div>
          </div>
        </div>
      </div>

      {isOwner && (
        <div className={styles.accountActions}>
          <div className={styles.actionCard}>
            <h4>Update Profile</h4>
            <p>Change your profile picture, username, or other personal details</p>
            <Link href="/account/edit" className="btn btn-secondary">
              Edit Profile
            </Link>
          </div>
        </div>
      )}
    </div>
  )
}
