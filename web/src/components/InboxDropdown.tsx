import { collection, onSnapshot, query, where, orderBy, doc, updateDoc } from 'firebase/firestore'
import { auth, db } from '@/lib/firebaseClient'
import { useEffect, useState } from 'react'
import styles from './InboxDropdown.module.css'

interface Notification {
  id: string
  senderName: string
  senderPic:  string
  text: string
  createdAt: any
  read: boolean
}

export default function InboxDropdown({ onClose }: { onClose: () => void }) {
  const [notes, setNotes] = useState<Notification[]>([])
  const user = auth.currentUser

  useEffect(() => {
    if (!user) return
    const q = query(
      collection(db, 'notifications'),
      where('recipientId', '==', user.uid),
      orderBy('createdAt', 'desc')
    )
    return onSnapshot(q, snap => {
      setNotes(snap.docs.map(d => {
        const data = d.data() as any
        return {
          id:         d.id,
          senderName: data.senderName,
          senderPic:  data.senderPic,
          text:       data.text,
          createdAt:  data.createdAt,
          read:       data.read
        }
      }))
    })
  }, [user])

  const markRead = async (id: string) => {
    await updateDoc(doc(db, 'notifications', id), { read: true })
  }

  return (
    <div className={styles.dropdown}>
      <div className={styles.header}>
        <span>Inbox</span>
        <button onClick={onClose}>×</button>
      </div>
      <ul className={styles.list}>
        {notes.length === 0 && (
          <li className={styles.empty}>No notifications</li>
        )}
        {notes.map(n => (
          <li
            key={n.id}
            className={!n.read ? styles.unread : ''}
            onClick={() => markRead(n.id)}
          >
            <img
              src={n.senderPic || '/default_profile.jpg'}
              alt={n.senderName}
              className={styles.notifAvatar}
            />
            <div className={styles.notifContent}>
              <strong>{n.senderName}</strong> {n.text}
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}
