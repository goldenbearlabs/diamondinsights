'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import styles from './page.module.css'
import Link from 'next/link'
import { auth } from '@/lib/firebaseClient'                           // ← import your firebase client
import { onAuthStateChanged, type User } from 'firebase/auth'
import { FaArrowLeft } from 'react-icons/fa'

type SortBy = 'recent'|'liked'|'replies'

interface Comment {
  id:            string
  parentId:      string | null
  userId:        string
  username:      string
  profilePicUrl: string
  text:          string
  timestamp:     number | null
  likes:         string[]
}

interface Card {
  id: string
  name: string
  team_short_name: string
  display_position: string
  age: string
  baked_img: string

  ovr: number
  delta_rank_pred: number
  delta_rank_low: number
  delta_rank_high: number

  predicted_rank: number
  predicted_rank_low: number
  predicted_rank_high: number

  confidence_percentage: number

  market_price?: number

  qs_actual: number
  qs_pred: number
  qs_pred_low: number
  qs_pred_high: number

  predicted_profit: number
  predicted_profit_low: number
  predicted_profit_high: number

  predicted_profit_pct: number
  predicted_profit_pct_low?: number
  predicted_profit_pct_high?: number

  bat_hand: string
  throw_hand: string
  height: string
  weight: string

  is_hitter: boolean | string

  // any other dynamic stats...
  [key: string]: any
}

export default function CardPage() {
  const router = useRouter()
  const [card, setCard] = useState<Card | null>(null)
  const [loading, setLoading] = useState(true)
  const [period, setPeriod] = useState<'season'|'3wk'|'1wk'>('season')
  const [commentsOpen, setCommentsOpen]     = useState(false)
  const [comments, setComments]             = useState<Comment[]>([])
  const [newComment, setNewComment]         = useState('')
  const [replyTo, setReplyTo]               = useState<string | null>(null)
  const [user, setUser]         = useState<User|null>(auth.currentUser)
  const [sortBy, setSortBy]     = useState<SortBy>('recent')
  const [openReplies, setOpenReplies] = useState<Record<string,boolean>>({})
  const [votes, setVotes] = useState<{upvotes: number, downvotes: number, userVote: 'up'|'down'|null}>({
    upvotes: 0,
    downvotes: 0,
    userVote: null
  })
  useEffect(() => onAuthStateChanged(auth, u => setUser(u)), [])

  // fixed destructuring
  const [seasonKey, threeKey, oneKey] = ['season','3wk','1wk']

  useEffect(() => {
    const id = window.location.pathname.split('/').pop()
    fetch(`/api/cards/${id}`)
      .then(r => r.json())
      .then((data: Card) => {
        setCard({
          ...data,
          is_hitter:
            data.is_hitter === true || data.is_hitter === 'True',
        })
      })
      .finally(() => setLoading(false))
  }, [])

  // helper to compute rate stats for pitchers
  const rate = (numKey: string, denKey: string, digits = 1) => {
    const n = Number(card![numKey]), d = Number(card![denKey])
    return d > 0 ? (n * 9 / d).toFixed(digits) : '–'
  }

  // Helper function to render text with @mentions highlighted
  const renderCommentText = (text: string) => {
    const mentionRegex = /@(\w+)/g
    const parts = text.split(mentionRegex)
    
    return parts.map((part, index) => {
      // Every odd index is a username from the regex capture group
      if (index % 2 === 1) {
        return (
          <span key={index} className={styles.mention}>
            @{part}
          </span>
        )
      }
      return part
    })
  }

  useEffect(() => {
    if (!card) return
    fetch(`/api/cards/${card.id}/comments`)
      .then(r => r.json())
      .then((comms: Comment[]) => setComments(comms))
  }, [card])

  // Fetch vote data when card loads
  useEffect(() => {
    if (!card) return
    fetch(`/api/cards/${card.id}/votes`)
      .then(r => r.json())
      .then((voteData) => {
        setVotes(prev => ({
          ...prev,
          upvotes: voteData.upvotes || 0,
          downvotes: voteData.downvotes || 0
        }))
      })
      .catch(err => console.error('Failed to fetch votes:', err))
  }, [card])

  if (loading) return <p className={styles.loading}>Loading…</p>
  if (!card)  return <p className={styles.error}>Not found.</p>

  const postComment = async () => {
    if (!newComment.trim()) return
    if (!user) return router.push('/login')
    
    let finalText = newComment
    let finalParentId = replyTo
    
    // If replying to someone, add @username and flatten the reply structure
    if (replyTo) {
      const replyTarget = comments.find(c => c.id === replyTo)
      if (replyTarget) {
        // Add @username if not already present
        if (!newComment.toLowerCase().startsWith(`@${replyTarget.username.toLowerCase()}`)) {
          finalText = `@${replyTarget.username} ${newComment}`
        }
        
        // Flatten: if replying to a reply, make it a reply to the root comment instead
        finalParentId = replyTarget.parentId || replyTarget.id
      }
    }
    
    await fetch(`/api/cards/${card!.id}/comments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text:     finalText,
        parentId: finalParentId,
        userId:   user.uid
      })
    })
    setNewComment('')
    setReplyTo(null)
    // re-fetch
    const res = await fetch(`/api/cards/${card!.id}/comments`)
    setComments(await res.json())
  }

  // build nested thread
  const threads = comments.filter(c => !c.parentId)
  const repliesMap: Record<string, Comment[]> = {}
  comments.forEach(c => {
    if (c.parentId) (repliesMap[c.parentId] ||= []).push(c)
  })

  const sortedThreads = [...threads].sort((a,b) => {
    if (sortBy === 'recent') return (b.timestamp! - a.timestamp!)
    if (sortBy === 'liked')  return b.likes.length - a.likes.length
    if (sortBy === 'replies')
      return (repliesMap[b.id]?.length || 0) - (repliesMap[a.id]?.length || 0)
    return 0
  })

  const toggleLike = async (cid: string) => {
    if (!user) return router.push('/login')
    await fetch(`/api/cards/${card!.id}/comments/${cid}/likes`, {
      method:'POST',
      headers:{ 'Content-Type':'application/json' },
      body: JSON.stringify({ userId: user.uid })
    })
    // optimistic update
    setComments(cs => cs.map(c =>
      c.id === cid
        ? {
            ...c,
            likes: c.likes.includes(user.uid)
              ? c.likes.filter(u=>u!==user.uid)
              : [...c.likes, user.uid]
          }
        : c
    ))
  }

  const deleteComment = async (cid: string) => {
    if (!user) return router.push('/login')
    
    // Confirmation dialog
    if (!window.confirm('Are you sure you want to delete this comment? This action cannot be undone.')) {
      return
    }
    
    try {
      const token = await user.getIdToken()
      const response = await fetch(`/api/cards/${card!.id}/comments/${cid}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      })
      
      if (!response.ok) {
        const error = await response.json()
        alert(error.error || 'Failed to delete comment')
        return
      }
      
      // Refetch all comments to ensure accurate count and state
      const res = await fetch(`/api/cards/${card!.id}/comments`)
      setComments(await res.json())
      
    } catch (error) {
      console.error('Delete comment error:', error)
      alert('Failed to delete comment. Please try again.')
    }
  }

  const handleVote = async (voteType: 'up' | 'down') => {
    if (!user) return router.push('/login')
    if (!card) return

    try {
      const token = await user.getIdToken()
      
      // If user clicks the same vote they already made, remove it
      const method = votes.userVote === voteType ? 'DELETE' : 'POST'
      const body = method === 'POST' ? JSON.stringify({ vote: voteType }) : undefined
      
      const response = await fetch(`/api/cards/${card.id}/votes`, {
        method,
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body
      })
      
      if (!response.ok) {
        const error = await response.json()
        alert(error.error || 'Failed to submit vote')
        return
      }
      
      const result = await response.json()
      setVotes({
        upvotes: result.upvotes,
        downvotes: result.downvotes,
        userVote: result.userVote
      })
      
    } catch (error) {
      console.error('Vote error:', error)
      alert('Failed to submit vote. Please try again.')
    }
  }

  const hitterGroups: [string, [string, string][]][] = [
    [
      'Hitting',
      [
        ['Contact vs L', 'contact_left'],
        ['Contact vs R', 'contact_right'],
        ['Power vs L',   'power_left'],
        ['Power vs R',   'power_right'],
        ['Plate Vision', 'plate_vision'],
        ['Batting Clutch','batting_clutch'],
      ],
    ],
    [
      'Fielding',
      [
        ['Fielding Ability','fielding_ability'],
        ['Arm Strength',    'arm_strength'],
        ['Arm Accuracy',    'arm_accuracy'],
        ['Reaction Time',   'reaction_time'],
        ['Blocking',        'blocking'],
      ],
    ],
    [
      'Running',
      [
        ['Speed',      'speed'],
        ['Stealing',   'baserunning_ability'],
        ['Aggression', 'baserunning_aggression'],
      ],
    ],
  ]
  
  const pitcherGroups: [string, [string, string][]][] = [
    [
      'Pitching',
      [
        ['Stamina',         'stamina'],
        ['Pitching Clutch','pitching_clutch'],
        ['H/9',         'hits_per_bf'],
        ['K/9',            'k_per_bf'],
        ['BB/9',           'bb_per_bf'],
        ['HR/9',           'hr_per_bf'],
      ],
    ],
    [
      'Pitch Attributes',
      [
        ['Velocity',      'pitch_velocity'],
        ['Pitch Control', 'pitch_control'],
        ['Pitch Movement','pitch_movement'],
      ],
    ],
  ]

  return (
    <main className={styles.playerPageContainer}>
      <button
        className={styles.backButton}
        onClick={() => {
          // Always use browser back to preserve state - sessionStorage will handle it
          window.history.back()
        }}
      >
        <FaArrowLeft />
        Back
      </button>

      {/* Header */}
      <section className={styles.playerHeader}>
        <div className={styles.playerCard}>
          <img
            src={card.baked_img}
            alt={card.name}
            className={styles.playerImage}
          />
        </div>

        <div className={styles.playerBasicInfo}>
          <div className={styles.playerNameRow}>
            <h1 className={styles.playerName}>{card.name}</h1>
            <div className={styles.voteButtons}>
              <button 
                className={`${styles.voteBtn} ${styles.upvoteBtn} ${votes.userVote === 'up' ? styles.active : ''}`}
                onClick={() => handleVote('up')}
                disabled={!user}
                title={user ? 'Upvote this prediction' : 'Login to vote'}
              >
                ↑ {votes.upvotes}
              </button>
              <button 
                className={`${styles.voteBtn} ${styles.downvoteBtn} ${votes.userVote === 'down' ? styles.active : ''}`}
                onClick={() => handleVote('down')}
                disabled={!user}
                title={user ? 'Downvote this prediction' : 'Login to vote'}
              >
                ↓ {votes.downvotes}
              </button>
            </div>
            <div className={styles.playerMeta}>
              <span>{card.team_short_name}</span>
              <span>{card.display_position}</span>
              <span>Age: {card.age}</span>
            </div>
          </div>

          <div className={styles.playerStatsRow}>
            {[
              ['Overall', card.ovr, '', ''],
              [
                'Change In Overall',
                card.delta_rank_pred,
                card.delta_rank_pred >= 0 ? 'positive' : 'negative',
                card.delta_rank_pred >= 0 ? '+' : '',
              ],
              [
                'Confidence',
                `${card.confidence_percentage.toFixed(1)}%`,
                '', ''
              ],
              [
                'Profit %',
                `${card.predicted_profit_pct.toFixed(1)}%`,
                card.predicted_profit_pct >= 0 ? 'positive' : 'negative',
                card.predicted_profit_pct >= 0 ? '+' : '',
              ],
            ].map(([label, value, cls, prefix]) => (
              <div key={label} className={styles.statCard}>
                <span className={styles.statLabel}>{label}</span>
                <span className={`${styles.statValue} ${cls ? styles[cls as string] : ''}`}>
                  {prefix}{value}
                </span>
              </div>
            ))}
          </div>

          <div className={styles.playerDetailsRow}>
            {[
              ['Bat Hand', card.bat_hand],
              ['Throw Hand', card.throw_hand],
              ['Height', card.height],
              ['Weight', card.weight],
            ].map(([label, value]) => (
              <div key={label} className={styles.detailItem}>
                <span className={styles.detailLabel}>{label}</span>
                <span className={styles.detailValue}>{value}</span>
              </div>
            ))}
          </div>

          <div className={styles.playerDescription}>
            <p>
              Our model predicts a{' '}
              <strong>
                {card.confidence_percentage.toFixed(1)}%
              </strong>{' '}
              chance that <strong>{card.name}</strong> upgrades{' '}
              <strong className={card.delta_rank_pred >= 0 ? styles.positive : styles.negative}>
                {card.delta_rank_pred >= 0 ? '+' : ''}
                {card.delta_rank_pred}
              </strong>{' '}
              to <strong>{card.predicted_rank}</strong> overall.
              {card.market_price && (
                <>
                  {' '}Buying at <strong>{card.market_price}</strong> you
                  can expect a profit of{' '}
                  <strong className={card.predicted_profit >= 0 ? styles.positive : styles.negative}>
                    {card.predicted_profit.toFixed(0)}
                  </strong>{' '}
                  (
                  <strong className={card.predicted_profit_pct >= 0 ? styles.positive : styles.negative}>
                    {card.predicted_profit_pct >= 0 ? '+' : ''}
                    {card.predicted_profit_pct.toFixed(1)}%
                  </strong>
                  ).
                </>
              )}{' '}Low‐case is{' '}
              <strong className={card.delta_rank_low >= 0 ? styles.positive : styles.negative}>
                {card.delta_rank_low >= 0 ? '+' : ''}
                {card.delta_rank_low}
              </strong>{' '}
              to <strong>{card.predicted_rank_low}</strong>, profit{' '}
              <strong className={card.predicted_profit_low >= 0 ? styles.positive : styles.negative}>
                {card.predicted_profit_low.toFixed(0)}
              </strong>{' '}
              (
              <strong className={card.predicted_profit_pct_low! >= 0 ? styles.positive : styles.negative}>
                {card.predicted_profit_pct_low! >= 0 ? '+' : ''}
                {card.predicted_profit_pct_low!.toFixed(1)}%
              </strong>
              ).
            </p>
          </div>

          {/* ─── Comments toggle ─────────────────────────────────────── */}
          <div className={styles.commentsHeader}>
            <button
              className={styles.commentsToggle}
              onClick={() => setCommentsOpen(o => !o)}
            >
              Comments ({comments.length})
              <span className={styles.chevron}>{commentsOpen ? '▲' : '▼'}</span>
            </button>
          </div>

          {commentsOpen && (
            <section className={styles.commentsSection}>
              {/* ─── Sort Controls ───────────────────────────────────────── */}
              <div className={styles.commentsSort}>
                <label htmlFor="sortComments">Sort by:</label>
                <select
                  id="sortComments"
                  value={sortBy}
                  onChange={e => setSortBy(e.target.value as SortBy)}
                >
                  <option value="recent">Most Recent</option>
                  <option value="liked">Most Liked</option>
                  <option value="replies">Most Replies</option>
                </select>
              </div>

              {/* ─── New Comment Form ─────────────────────────────────────── */}
              {user ? (
                <div className={styles.newCommentForm}>
                  <textarea
                    placeholder="Add a comment…"
                    value={replyTo ? '' : newComment}
                    onChange={e => !replyTo && setNewComment(e.target.value)}
                    disabled={!!replyTo}
                  />
                  <button onClick={postComment} disabled={!!replyTo}>
                    Post
                  </button>
                </div>
              ) : (
                <p><Link href="/login">Log in</Link> to leave a comment.</p>
              )}

              {/* ─── Comment Threads ──────────────────────────────────────── */}
              <ul className={styles.commentList}>
                {sortedThreads.map(c => (
                  <li key={c.id} className={styles.commentItem}>
                    <div className={styles.commentHeader}>
                      <img
                        src={c.profilePicUrl}
                        alt={c.username}
                        className={styles.commentAvatar}
                        onClick={() => router.push(`/account/${c.userId}`)}
                      />
                      <button
                        className={styles.commentUser}
                        onClick={() => router.push(`/account/${c.userId}`)}
                      >
                        {c.username}
                      </button>
                      <span className={styles.commentTime}>
                        {new Date(c.timestamp!).toLocaleString()}
                      </span>
                    </div>

                    <p className={styles.commentText}>{renderCommentText(c.text)}</p>

                    <div className={styles.commentActions}>
                      <button
                        className={styles.likeButton}
                        onClick={() => toggleLike(c.id)}
                      >
                        {c.likes.includes(user?.uid ?? '') ? '♥' : '♡'} {c.likes.length}
                      </button>
                      {user && (
                        <button
                          className={styles.replyButton}
                          onClick={() => setReplyTo(c.id)}
                        >
                          Reply
                        </button>
                      )}
                      {user && c.userId === user.uid && (
                        <button
                          className={styles.deleteButton}
                          onClick={() => deleteComment(c.id)}
                        >
                          Delete
                        </button>
                      )}
                    </div>

                    {/* Inline Reply Form */}
                    {replyTo === c.id && user && (
                      <div className={styles.inlineReplyForm}>
                        <textarea
                          placeholder={`Reply to @${c.username}…`}
                          value={newComment}
                          onChange={e => setNewComment(e.target.value)}
                          autoFocus
                        />
                        <div className={styles.replyActions}>
                          <button onClick={postComment} disabled={!newComment.trim()}>
                            Reply
                          </button>
                          <button
                            onClick={() => {
                              setReplyTo(null)
                              setNewComment('')
                            }}
                            className={styles.cancelReplyBtn}
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    )}

                    {/* ─── Show / Hide Replies ──────────────────────────────── */}
                    {repliesMap[c.id]?.length > 0 && (
                      <>
                        <button
                          className={styles.toggleReplies}
                          onClick={() =>
                            setOpenReplies(m => ({ ...m, [c.id]: !m[c.id] }))
                          }
                        >
                          {openReplies[c.id] ? 'Hide' : 'Show'} {repliesMap[c.id].length}{' '}
                          {repliesMap[c.id].length === 1 ? 'reply' : 'replies'}
                        </button>

                        {openReplies[c.id] && (
                          <ul className={styles.replyList}>
                            {repliesMap[c.id].map(r => (
                              <li key={r.id} className={styles.commentItem}>
                                <div className={styles.commentHeader}>
                                  <img
                                    src={r.profilePicUrl}
                                    alt={r.username}
                                    className={styles.commentAvatar}
                                    onClick={() => router.push(`/account/${r.userId}`)}
                                  />
                                  <button
                                    className={styles.commentUser}
                                    onClick={() => router.push(`/account/${r.userId}`)}
                                  >
                                    {r.username}
                                  </button>
                                  <span className={styles.commentTime}>
                                    {new Date(r.timestamp!).toLocaleString()}
                                  </span>
                                </div>

                                <p className={styles.commentText}>{renderCommentText(r.text)}</p>

                                <div className={styles.commentActions}>
                                  <button
                                    className={styles.likeButton}
                                    onClick={() => toggleLike(r.id)}
                                  >
                                    {r.likes.includes(user?.uid ?? '')
                                      ? '♥'
                                      : '♡'} {r.likes.length}
                                  </button>
                                  {user && (
                                    <button
                                      className={styles.replyButton}
                                      onClick={() => setReplyTo(r.id)}
                                    >
                                      Reply
                                    </button>
                                  )}
                                  {user && r.userId === user.uid && (
                                    <button
                                      className={styles.deleteButton}
                                      onClick={() => deleteComment(r.id)}
                                    >
                                      Delete
                                    </button>
                                  )}
                                </div>

                                {/* Inline Reply Form for nested replies */}
                                {replyTo === r.id && user && (
                                  <div className={styles.inlineReplyForm}>
                                    <textarea
                                      placeholder={`Reply to @${r.username}…`}
                                      value={newComment}
                                      onChange={e => setNewComment(e.target.value)}
                                      autoFocus
                                    />
                                    <div className={styles.replyActions}>
                                      <button onClick={postComment} disabled={!newComment.trim()}>
                                        Reply
                                      </button>
                                      <button
                                        onClick={() => {
                                          setReplyTo(null)
                                          setNewComment('')
                                        }}
                                        className={styles.cancelReplyBtn}
                                      >
                                        Cancel
                                      </button>
                                    </div>
                                  </div>
                                )}
                              </li>
                            ))}
                          </ul>
                        )}
                      </>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          )}
          
        </div>
      </section>

      {/* ─── Attributes ───────────────────────────────────────── */}
      <section className={styles.playerSection}>
        <h2 className={styles.sectionTitle}>Attributes</h2>
        <div className={styles.attributesContainer}>
          {(card.is_hitter ? hitterGroups : pitcherGroups).map(
            ([groupTitle, attrs]) => (
              <div key={groupTitle} className={styles.attributesGroup}>
                <h3 className={styles.groupTitle}>{groupTitle}</h3>
                {attrs.map(([label, key]) => {
                  const currentVal   = Number(card[key] ?? 0)
                  const predictedVal = Number(card[`${key}_new_pred`] ?? currentVal)
                  const currentPct   = (currentVal   / 125) * 100
                  const predictedPct = (predictedVal / 125) * 100
                  const delta        = predictedVal - currentVal
                  const isUpgrade    = delta > 0
                  const isDowngrade  = delta < 0

                  return (
                    <div key={label} className={styles.attributeRow}>
                      <span className={styles.attributeLabel}>{label}</span>
                      <div className={styles.attributeBar}>
                        {/* Δ label */}
                        <span className={styles.attributeDelta}>
                          {delta >= 0 ? `+${delta.toFixed(1)}` : delta.toFixed(1)}
                        </span>

                        {/* Single gradient bar */}
                        <div
                          className={styles.barGradient}
                          style={{
                            background: (() => {
                              if (delta === 0) {
                                // No change - solid blue
                                return `linear-gradient(to right, var(--accent-primary) ${currentPct}%, var(--bg-medium) ${currentPct}%)`
                              } else if (isUpgrade) {
                                // Upgrade - blue to green gradient (current% < predicted%)
                                return `linear-gradient(to right, var(--accent-primary) ${currentPct}%, var(--positive) ${predictedPct}%, var(--bg-medium) ${predictedPct}%)`
                              } else {
                                // Downgrade - blue to red gradient (predicted% < current%)
                                return `linear-gradient(to right, var(--accent-primary) ${predictedPct}%, var(--negative) ${currentPct}%, var(--bg-medium) ${currentPct}%)`
                              }
                            })()
                          }}
                        />

                        {/* current value */}
                        <span className={styles.attributeValue}>
                          {currentVal}
                        </span>
                      </div>
                    </div>
                  )
                })}
              </div>
            )
          )}
        </div>
      </section>

      {/* Predictions */}
      <section className={styles.playerSection}>
        <h2 className={styles.sectionTitle}>Predictions</h2>
        <div className={styles.predictionsGrid}>
          {[
            ['Current Overall', card.ovr],
            ['Predicted Overall', card.predicted_rank],
            [
              'Change in Overall',
              card.delta_rank_pred,
              card.delta_rank_pred >= 0 ? 'positive' : 'negative',
              card.delta_rank_pred >= 0 ? '+' : '',
            ],
            ['Confidence', `${card.confidence_percentage.toFixed(1)}%`],
          ].map(([title, val, cls, prefix]) => (
            <div key={title} className={styles.predictionCard}>
              <h3 className={styles.predictionTitle}>{title}</h3>
              <div className={`${styles.predictionValue} ${cls ? styles[cls] : ''}`}>
                {prefix}{val}
              </div>
            </div>
          ))}
        </div>

        <h3 className={styles.subSectionTitle}>Attribute Predictions</h3>
        <div className={styles.predictionTable}>
          <table>
            <thead>
              <tr>
                <th>Attribute</th>
                <th>Current</th>
                <th>Predicted</th>
                <th>Δ</th>
              </tr>
            </thead>
            <tbody>
              {(card.is_hitter
                ? [
                    'contact_left','contact_right',
                    'power_left','power_right',
                    'plate_vision','plate_discipline', 'batting_clutch'
                  ]
                : [
                    'stamina','pitching_clutch',
                    'hits_per_bf','k_per_bf','bb_per_bf','hr_per_bf',
                  ]
              ).map(attr => {
                const curr     = Number(card[attr] ?? 0)
                // coerce rawPred into a number (fall back to curr if NaN)
                const rawPred  = card[`${attr}_new_pred`]
                const predNum  = Number(rawPred)
                const pred     = isNaN(predNum) ? curr : predNum
                const delta    = pred - curr

                return (
                  <tr key={attr}>
                    <td>
                      {attr
                        .replace(/_/g, ' ')
                        .replace(/\b\w/g, l => l.toUpperCase())
                      }
                    </td>
                    <td>{curr}</td>
                    <td>{pred.toFixed(1)}</td>
                    <td className={delta >= 0 ? styles.positive : styles.negative}>
                      {delta >= 0 ? '+' : ''}{delta.toFixed(1)}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </section>

      {/* Market */}
      <section className={styles.playerSection}>
        <h2 className={styles.sectionTitle}>Market Data</h2>
        <div className={styles.marketGrid}>
          {[
            ['Quick Sell Actual', card.qs_actual],
            ['Quick Sell Predicted', Number(card.qs_pred).toFixed(0)],
            ['Market Price', card.market_price],
            [
              'Predicted Profit',
              Number(card.predicted_profit).toFixed(0),
              card.predicted_profit >= 0 ? 'positive' : 'negative',
            ],
            [
              'Predicted Profit %',
              `${card.predicted_profit_pct >= 0 ? '+' : ''}${card.predicted_profit_pct.toFixed(1)}%`,
              card.predicted_profit_pct >= 0 ? 'positive' : 'negative',
            ],
          ].map(([title, val, cls, prefix]) => (
            <div key={title} className={styles.marketCard}>
              <h3 className={styles.marketTitle}>{title}</h3>
              <div className={`${styles.marketValue} ${cls ? styles[cls as string] : ''}`}>
                {prefix}{val ?? '–'}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Stats */}
      <section className={styles.playerSection}>
        <h2 className={styles.sectionTitle}>Player Stats</h2>
        <div className={styles.timePeriodTabs}>
          {[seasonKey, threeKey, oneKey].map(p => (
            <button
              key={p}
              className={`${styles.periodTab} ${period === p ? styles.active : ''}`}
              onClick={() => setPeriod(p as any)}
            >
              {p === '3wk' ? '3-Week' : p === '1wk' ? '1-Week' : 'Season'}
            </button>
          ))}
        </div>

        {[ { id:'season-stats', key:seasonKey },
           { id:'3wk-stats'   , key:threeKey  },
           { id:'1wk-stats'   , key:oneKey    }
        ].map(({id,key}) => (
          <div
            key={id}
            className={`${styles.statsTableContainer} ${period === key ? styles.active : ''}`}
            id={id}
          >
            <h3 className={styles.statsTitle}>
              {key === 'season' ? 'Season' : key === '3wk' ? '3-Week' : '1-Week'} Stats
            </h3>
            <div className={styles.responsiveTable}>
              <table className={styles.statsTable}>
                <thead>
                  <tr>
                    {card.is_hitter ? (
                      <> <th>Stat</th><th>vs LHP</th><th>vs RHP</th><th>RISP</th> </>
                    ) : (
                      <> <th>Stat</th><th>Overall</th><th>RISP</th> </>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {card.is_hitter
                    ? ['pa','avg','obp','slug','ops','hr','h','so','bb','rbi'].map(stat => {
                        const sl = key==='season'? `season_vl_${stat}` : `${key}_vl_${stat}`
                        const sr = key==='season'? `season_vr_${stat}` : `${key}_vr_${stat}`
                        const ri = key==='season'? `season_risp_${stat}`: `${key}_risp_${stat}`
                        const isPct = ['avg','obp','slug','ops'].includes(stat)
                        return (
                          <tr key={stat}>
                            <td>{stat.toUpperCase()}</td>
                            <td>{Number(card[sl]).toFixed(isPct?3:0)}</td>
                            <td>{Number(card[sr]).toFixed(isPct?3:0)}</td>
                            <td>{Number(card[ri]).toFixed(isPct?3:0)}</td>
                          </tr>
                        )
                      })
                    : [
                        ['IP','IP'], ['ERA','ER'], ['WHIP','WHIP'],
                        ['K/9','K/9'], ['BB/9','BB/9'], ['H/9','H/9'], ['HR/9','HR/9']
                      ].map(([lbl, fld]) => {
                        const prefix = period === 'season' ? 'season' : period;
                        // build your field names
                        const overallKey = `${prefix}_ovr_${fld}`;
                        const rispKey    = `${prefix}_risp_${fld}`;
                        const ipKey      = `${prefix}_ovr_IP`;
                        // now return a full <tr>
                        return (
                          <tr key={lbl}>
                            <td>{lbl}</td>
                  
                            {/* Overall column */}
                            <td>
                              {lbl === 'ERA'
                                ? rate(`${prefix}_ovr_ER`, ipKey, 2)
                                : lbl.includes('/')
                                  ? rate(overallKey, ipKey)
                                  : Number(card[overallKey]).toFixed(1)
                              }
                            </td>
                  
                            {/* RISP column */}
                            <td>
                              {lbl === 'ERA'
                                ? rate(`${prefix}_risp_ER`, `${prefix}_risp_IP`, 2)
                                : lbl.includes('/')
                                  ? rate(rispKey, `${prefix}_risp_IP`)
                                  : Number(card[rispKey]).toFixed(1)
                              }
                            </td>
                          </tr>
                        )
                      })
                    }
                  </tbody>
              </table>
            </div>
          </div>
        ))}
      </section>
    </main>
  )
}
