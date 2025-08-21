// src/app/account/[uid]/page.tsx
'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import styles from './page.module.css'
import { auth, db } from '@/lib/firebaseClient'

// Stubs currency icon component
const StubsIcon = ({ className = "" }: { className?: string }) => (
  <img 
    src="/assets/stubs.webp" 
    alt="Stubs" 
    className={`inline-block ${className}`}
    style={{ 
      width: '0.8em', 
      height: '0.8em', 
      verticalAlign: 'baseline',
      marginRight: '0.1em',
      marginTop: '-0.1em'
    }}
  />
)

// Friend request status types for TypeScript
type FriendshipStatus = 'none' | 'pending_sent' | 'pending_received' | 'friends' | 'loading'

// Educational: Friend Button Component
// This demonstrates React state management and API integration patterns
function FriendButton({ targetUserId, currentUser }: { 
  targetUserId: string, 
  currentUser: FirebaseUser | null 
}) {
  const [friendStatus, setFriendStatus] = useState<FriendshipStatus>('loading')
  const [isProcessing, setIsProcessing] = useState(false)
  const [requestId, setRequestId] = useState<string | null>(null)

  // Educational: Effect to check friendship status when component mounts
  useEffect(() => {
    if (!currentUser || !targetUserId || currentUser.uid === targetUserId) {
      setFriendStatus('none')
      return
    }

    const checkFriendshipStatus = async () => {
      try {
        const token = await currentUser.getIdToken()
        const response = await fetch(`/api/friends/status/${targetUserId}`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        })
        
        if (response.ok) {
          const data = await response.json()
          setFriendStatus(data.status)
          if (data.requestId) {
            setRequestId(data.requestId)
          }
        } else {
          setFriendStatus('none')
        }
      } catch (error) {
        console.error('Error checking friendship status:', error)
        setFriendStatus('none')
      }
    }

    checkFriendshipStatus()
  }, [currentUser, targetUserId])

  // Educational: Function to send friend request
  const sendFriendRequest = async () => {
    if (!currentUser) return

    setIsProcessing(true)
    try {
      const token = await currentUser.getIdToken()
      const response = await fetch('/api/friends/request', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          receiverId: targetUserId
        })
      })

      if (response.ok) {
        setFriendStatus('pending_sent')
        alert('Friend request sent successfully!')
      } else {
        const error = await response.json()
        alert(error.error || 'Failed to send friend request')
      }
    } catch (error) {
      console.error('Error sending friend request:', error)
      alert('Failed to send friend request')
    } finally {
      setIsProcessing(false)
    }
  }

  // Function to accept friend request
  const acceptFriendRequest = async () => {
    if (!currentUser || !requestId) return

    setIsProcessing(true)
    try {
      const token = await currentUser.getIdToken()
      const response = await fetch('/api/friends/respond', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          requestId: requestId,
          action: 'accept'
        })
      })

      if (response.ok) {
        setFriendStatus('friends')
        alert('Friend request accepted! You are now friends.')
        // Refresh the page to update friend count
        window.location.reload()
      } else {
        const error = await response.json()
        alert(error.error || 'Failed to accept friend request')
      }
    } catch (error) {
      console.error('Error accepting friend request:', error)
      alert('Failed to accept friend request')
    } finally {
      setIsProcessing(false)
    }
  }

  // Educational: Conditional rendering based on friendship status
  // This demonstrates how UI should adapt to different states
  if (!currentUser || currentUser.uid === targetUserId) {
    return null // Don't show friend button for own profile
  }

  if (friendStatus === 'loading') {
    return (
      <div className={styles.detailCard}>
        <div className="btn btn-secondary" style={{ opacity: 0.6 }}>
          Checking...
        </div>
      </div>
    )
  }

  return (
    <>
      {friendStatus === 'none' && (
        <button 
          className="btn btn-primary"
          onClick={sendFriendRequest}
          disabled={isProcessing}
        >
          {isProcessing ? 'Sending...' : (
            <>
              <FaUserPlus style={{ marginRight: '8px' }} />
              Add Friend
            </>
          )}
        </button>
      )}
      
      {friendStatus === 'pending_sent' && (
        <div className="btn btn-secondary" style={{ opacity: 0.7 }}>
          <FaClock style={{ marginRight: '8px' }} />
          Request Sent
        </div>
      )}
      
      {friendStatus === 'pending_received' && (
        <button 
          className="btn btn-primary"
          onClick={acceptFriendRequest}
          disabled={isProcessing}
        >
          {isProcessing ? 'Accepting...' : (
            <>
              <FaHandshake style={{ marginRight: '8px' }} />
              Accept Request
            </>
          )}
        </button>
      )}
      
      {friendStatus === 'friends' && (
        <div className="btn btn-success" style={{ opacity: 0.8 }}>
          <FaUserCheck style={{ marginRight: '8px' }} />
          Friends
        </div>
      )}
    </>
  )
}
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
import { FaSpinner, FaUserPlus, FaClock, FaHandshake, FaUserCheck, FaArrowLeft } from 'react-icons/fa'


interface ProfileData {
  username:         string
  email:            string
  rating:           number
  profilePic:       string
  createdAt:        Timestamp
  investmentsPublic?: boolean
}

interface InvestmentRecord {
  quantity: number
  avgBuyPrice: number
}

export default function AccountPage() {
  const router = useRouter()
  const { uid } = useParams() as { uid?: string }
  const [currentUser, setCurrentUser] = useState<FirebaseUser|null>(null)
  const [profile, setProfile]         = useState<ProfileData|null>(null)
  const [loading, setLoading]         = useState(true)
  const [saving, setSaving]           = useState(false)
  const [tooltipOpen, setTooltipOpen] = useState<string|null>(null)
  const [stats, setStats] = useState<{
    invCount: number
    totalInvested: number
    totalMessages: number
    friendsCount: number
  }>({ invCount: 0, totalInvested: 0, totalMessages: 0, friendsCount: 0 })

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
        // Create default profile using current user info if available
        const defaultProfile = {
          username: currentUser?.displayName || viewingUid,
          email: currentUser?.email || '',
          rating: 0,
          profilePic: currentUser?.photoURL || '',
          createdAt: Timestamp.now(),
          investmentsPublic: false
        }
        setProfile(defaultProfile)
      }
    }
    loadProfile()
  }, [viewingUid, currentUser])

  // 3) load stats once we know viewingUid
  useEffect(() => {
    if (!viewingUid) return
    const loadStats = async () => {
      // investments
      const invCol = collection(db, 'users', viewingUid, 'investments')
      const invSnap = await getDocs(invCol)
      let total = 0
      invSnap.forEach(d => {
        const { quantity, avgBuyPrice } = d.data() as InvestmentRecord
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

      // friends count - Educational: Using server-side API to avoid Firestore permission issues
      let friendsCount = 0
      try {
        const friendsResponse = await fetch(`/api/friends/count/${viewingUid}`)
        if (friendsResponse.ok) {
          const friendsData = await friendsResponse.json()
          friendsCount = friendsData.friendsCount
        } else {
          console.warn('Failed to fetch friends count, defaulting to 0')
        }
      } catch (error) {
        console.error('Error fetching friends count:', error)
        // friendsCount remains 0 if API call fails
      }

      setStats({
        invCount: invSnap.size,
        totalInvested: total,
        totalMessages: msgCount,
        friendsCount: friendsCount
      })

      setLoading(false)
    }
    loadStats()
  }, [viewingUid])

  if (loading) {
    return (
      <div className="spinner-container">
        <FaSpinner className="spinner" />
      </div>
    )
  }

  if (!profile) {
    return <div className="errorContainer">Profile failed to load.</div>
  }

  const createdDate = (() => {
    // Try profile.createdAt first
    if (profile?.createdAt) {
      try {
        // Try Firestore Timestamp first
        if (typeof profile?.createdAt.toDate === 'function') {
          return profile?.createdAt.toDate().toLocaleDateString()
        }
        
        // Try if it's a Firestore timestamp object with seconds
        if ('seconds' in profile?.createdAt) {
          return new Date(profile?.createdAt.seconds * 1000).toLocaleDateString()
        }
        
        // Try direct Date conversion
        return new Date(profile?.createdAt).toLocaleDateString()
      } catch {
        // Fall through to Firebase Auth fallback
      }
    }
    
    // Fallback to Firebase Auth creation time for existing accounts
    if (currentUser?.metadata?.creationTime) {
      try {
        return new Date(currentUser.metadata.creationTime).toLocaleDateString()
      } catch {
        return 'Unknown'
      }
    }
    
    return 'Unknown'
  })()

  // toggle public/private
  const toggleVisibility = async () => {
    if (!isOwner) return
    setSaving(true)
    const newVal = !profile?.investmentsPublic
    await updateDoc(doc(db, 'users', viewingUid!), {
      investmentsPublic: newVal
    })
    setProfile(p => p ? { ...p, investmentsPublic: newVal } : p)
    setSaving(false)
  }

  const pickPic = (url?: string) =>
    url && url.trim() !== '' ? url : '/default_profile.jpg'

  return (
    <div className={styles.accountContainer}>
      <div className={styles.accountHeader}>
        {!isOwner && (
          <button 
            className={styles.backButton}
            onClick={() => router.back()}
          >
            <FaArrowLeft />
            Back
          </button>
        )}
        <h2>
        {isOwner ? 'My Account' : `${profile?.username}'s Account`}
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
              src={pickPic(profile?.profilePic)}
              alt="Profile Picture"
              className={styles.profilePic}
              onError={e => {
                (e.currentTarget as HTMLImageElement).src = '/default_profile.jpg'
              }}
            />
            <div className={styles.profileInfo}>
              <h3>{profile?.username}</h3>
              {!isOwner && (
                <p className={styles.accountCreated}>Member since {createdDate}</p>
              )}
            </div>
          </div>

          {/* Profile actions for visitors */}
          {!isOwner && (
            <div className={styles.profileActions}>
              <FriendButton targetUserId={viewingUid!} currentUser={currentUser} />
              {profile?.investmentsPublic && (
                <Link
                  href={`/investment/${viewingUid}`}
                  className="btn btn-secondary"
                >
                  View Investments
                </Link>
              )}
            </div>
          )}

          <div className={styles.profileDetails}>
            {isOwner && (
              <>
                <div className={styles.detailCard}>
                  <h4>Email</h4>
                  <p className={styles.value}>{profile?.email}</p>
                </div>

                <div className={styles.detailCard}>
                  <h4>Account Created</h4>
                  <p className={styles.value}>{createdDate}</p>
                </div>

                <div className={styles.detailCard}>
                  <div style={{ display: 'flex', alignItems: 'center', position: 'relative' }}>
                    <h4>Investments Visibility</h4>
                    <button
                      className={styles.tooltipBtn}
                      onClick={e => {
                        e.stopPropagation()
                        setTooltipOpen(open => open === 'investments' ? null : 'investments')
                      }}
                    >?</button>
                    {tooltipOpen === 'investments' && (
                      <div className={styles.tooltipPopup} onClick={e => e.stopPropagation()}>
                        Public investments are viewable by anyone visiting your profile. Private investments are only visible to you.
                      </div>
                    )}
                  </div>
                  <label className={styles.switch}>
                    <input
                      type="checkbox"
                      checked={!!profile?.investmentsPublic}
                      onChange={toggleVisibility}
                      disabled={saving}
                    />
                    <span className={styles.slider} />
                  </label>
                  <p className={styles.helpText}>
                    {profile?.investmentsPublic
                      ? 'Your investments are public.'
                      : 'Your investments are private.'}
                  </p>
                </div>
              </>
            )}
            
            {!isOwner && (
              <div className={styles.bioPlaceholder}>
                <p className={styles.bioPlaceholderText}>Bio section - coming soon</p>
              </div>
            )}
          </div>
        </div>

        {/* User statistics section */}
        <div className={styles.accountStats}>
          <div className={styles.statsHeader}>
            <h3>Trader Statistics</h3>
            <p>Your performance metrics and trading insights</p>
          </div>
          <div className={styles.statsGrid}>
            {/* Investment count statistic */}
            <div className={styles.statItem}>
              <h5>Total Investments</h5>
              <p className={styles.value}>{stats.invCount}</p>
            </div>
            {/* Total invested amount statistic */}
            <div className={styles.statItem}>
              <h5>Total Invested</h5>
              <p className={styles.value}>
                <StubsIcon />{stats.totalInvested.toLocaleString()}
              </p>
            </div>
            {/* Message count statistic */}
            <div className={styles.statItem}>
              <h5>Total Messages</h5>
              <p className={styles.value}>{stats.totalMessages}</p>
            </div>
            {/* Friends count statistic */}
            <div className={styles.statItem}>
              <h5>Friends</h5>
              <p className={styles.value}>{stats.friendsCount}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Profile editing actions (owner only) */}
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
