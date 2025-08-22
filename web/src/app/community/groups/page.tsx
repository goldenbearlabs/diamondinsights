'use client'
import React, { useState, useEffect } from 'react'
import styles from '../page.module.css'
import { getAuth, onAuthStateChanged, type User } from 'firebase/auth'
import Link from 'next/link'

// Icon imports
import {
    FaUsers,
    FaPlus,
    FaUserPlus,
    FaBars,
    FaTimes,
    FaSpinner,
    FaLock,
    FaGlobe,
    FaSignOutAlt,
    FaTrash,
    FaCopy,
    FaCrown
} from 'react-icons/fa'

interface Group {
    id: string
    name: string
    description?: string
    isPrivate: boolean
    inviteCode: string
    ownerId: string
    memberCount: number
    lastActivity: number
    userIsMember?: boolean
    userIsOwner?: boolean
}

interface CreateGroupData {
    name: string
    description: string
    isPrivate: boolean
}

interface JoinGroupData {
    code: string
}

export default function GroupsPage() {
    const auth = getAuth()
    const [user, setUser] = useState<User | null>(null)
    const [loading, setLoading] = useState(true)
    const [activeTab, setActiveTab] = useState<'my-groups' | 'create' | 'join'>('my-groups')
    const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false)
    
    // My Groups state
    const [myGroups, setMyGroups] = useState<Group[]>([])
    const [publicGroups, setPublicGroups] = useState<Group[]>([])
    
    // Create Group state
    const [createForm, setCreateForm] = useState<CreateGroupData>({
        name: '',
        description: '',
        isPrivate: true
    })
    const [creating, setCreating] = useState(false)
    
    // Join Group state
    const [joinForm, setJoinForm] = useState<JoinGroupData>({
        code: ''
    })
    const [joining, setJoining] = useState(false)
    
    // Error and success states
    const [error, setError] = useState('')
    const [success, setSuccess] = useState('')

    useEffect(() => {
        return onAuthStateChanged(auth, u => {
            setUser(u)
            setLoading(false)
        })
    }, [auth])

    useEffect(() => {
        if (user) {
            loadMyGroups()
            if (activeTab === 'join') {
                loadPublicGroups()
            }
        }
    }, [user, activeTab])

    const loadMyGroups = async () => {
        if (!user) return
        
        try {
            const token = await user.getIdToken()
            const response = await fetch('/api/groups/my-groups', {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            })
            
            if (response.ok) {
                const data = await response.json()
                setMyGroups(data.groups)
            }
        } catch (error) {
            console.error('Failed to load my groups:', error)
        }
    }

    const loadPublicGroups = async () => {
        try {
            const headers: HeadersInit = {}
            if (user) {
                const token = await user.getIdToken()
                headers['Authorization'] = `Bearer ${token}`
            }
            
            const response = await fetch('/api/groups/public', { headers })
            
            if (response.ok) {
                const data = await response.json()
                setPublicGroups(data.groups)
            }
        } catch (error) {
            console.error('Failed to load public groups:', error)
        }
    }

    const handleCreateGroup = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!user || !createForm.name.trim()) return
        
        setCreating(true)
        setError('')
        setSuccess('')
        
        try {
            const token = await user.getIdToken()
            const response = await fetch('/api/groups', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(createForm)
            })
            
            const data = await response.json()
            
            if (response.ok) {
                setSuccess(`Group created successfully! ${createForm.isPrivate ? `Invite code: ${data.inviteCode}` : ''}`)
                setCreateForm({ name: '', description: '', isPrivate: true })
                loadMyGroups()
                setTimeout(() => setActiveTab('my-groups'), 2000)
            } else {
                setError(data.error || 'Failed to create group')
            }
        } catch (error) {
            setError('Failed to create group. Please try again.')
        } finally {
            setCreating(false)
        }
    }

    const handleJoinGroup = async (e: React.FormEvent, groupId?: string) => {
        e.preventDefault()
        if (!user) return
        
        setJoining(true)
        setError('')
        setSuccess('')
        
        try {
            const token = await user.getIdToken()
            const response = await fetch('/api/groups/join', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    groupId: groupId,
                    inviteCode: groupId ? undefined : joinForm.code
                })
            })
            
            const data = await response.json()
            
            if (response.ok) {
                setSuccess('Successfully joined group!')
                setJoinForm({ code: '' })
                loadMyGroups()
                loadPublicGroups()
                setTimeout(() => setActiveTab('my-groups'), 2000)
            } else {
                setError(data.error || 'Failed to join group')
            }
        } catch (error) {
            setError('Failed to join group. Please try again.')
        } finally {
            setJoining(false)
        }
    }

    const handleLeaveGroup = async (groupId: string) => {
        if (!user || !confirm('Are you sure you want to leave this group?')) return
        
        try {
            const token = await user.getIdToken()
            const response = await fetch(`/api/groups/${groupId}/leave`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            })
            
            if (response.ok) {
                setSuccess('Left group successfully')
                loadMyGroups()
            } else {
                const data = await response.json()
                setError(data.error || 'Failed to leave group')
            }
        } catch (error) {
            setError('Failed to leave group. Please try again.')
        }
    }

    const handleDeleteGroup = async (groupId: string) => {
        if (!user || !confirm('Are you sure you want to delete this group? This action cannot be undone.')) return
        
        try {
            const token = await user.getIdToken()
            const response = await fetch(`/api/groups/${groupId}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            })
            
            if (response.ok) {
                setSuccess('Group deleted successfully')
                loadMyGroups()
            } else {
                const data = await response.json()
                setError(data.error || 'Failed to delete group')
            }
        } catch (error) {
            setError('Failed to delete group. Please try again.')
        }
    }

    const copyInviteCode = (code: string) => {
        navigator.clipboard.writeText(code).then(() => {
            setSuccess('Invite code copied to clipboard!')
        }).catch(() => {
            setError('Failed to copy invite code')
        })
    }

    const formatLastActivity = (timestamp: number) => {
        const diff = Date.now() - timestamp
        if (diff < 60000) return 'just now'
        if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`
        if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`
        return `${Math.floor(diff / 86400000)}d ago`
    }

    if (loading) {
        return (
            <main className={styles.page}>
                <div className="spinner-container">
                    <FaSpinner className="spinner" />
                </div>
            </main>
        )
    }

    if (!user) {
        return (
            <main className={styles.page}>
                <div className={styles.container}>
                    <div className={styles.loginPrompt}>
                        <h2>Please log in to access Groups</h2>
                        <Link href="/login" className="btn btn-primary">Log In</Link>
                    </div>
                </div>
            </main>
        )
    }

    return (
        <main className={styles.page}>
            <div className={styles.container}>
                {/* Mobile header */}
                <div className={styles.mobileHeader}>
                    <button 
                        className={styles.mobileMenuButton}
                        onClick={() => setMobileSidebarOpen(!mobileSidebarOpen)}
                    >
                        {mobileSidebarOpen ? <FaTimes /> : <FaBars />}
                    </button>
                    <h2 className={styles.mobileTitle}>Groups</h2>
                </div>

                {/* Sidebar */}
                <aside className={`${styles.sidebar} ${mobileSidebarOpen ? styles.sidebarOpen : ''}`}>
                    <div className={styles.sidebarHeader}>
                        <h2 className={styles.head}>Groups</h2>
                    </div>

                    <nav className={styles.tabs}>
                        <button
                            className={`${styles.tab} ${activeTab === 'my-groups' ? styles.active : ''}`}
                            onClick={() => {
                                setActiveTab('my-groups')
                                setMobileSidebarOpen(false)
                                setError('')
                                setSuccess('')
                            }}
                        >
                            <span className={styles.tabIcon}><FaUsers /></span>
                            <span className={styles.tabLabel}>My Groups</span>
                        </button>
                        <button
                            className={`${styles.tab} ${activeTab === 'create' ? styles.active : ''}`}
                            onClick={() => {
                                setActiveTab('create')
                                setMobileSidebarOpen(false)
                                setError('')
                                setSuccess('')
                            }}
                        >
                            <span className={styles.tabIcon}><FaPlus /></span>
                            <span className={styles.tabLabel}>Create Group</span>
                        </button>
                        <button
                            className={`${styles.tab} ${activeTab === 'join' ? styles.active : ''}`}
                            onClick={() => {
                                setActiveTab('join')
                                setMobileSidebarOpen(false)
                                setError('')
                                setSuccess('')
                            }}
                        >
                            <span className={styles.tabIcon}><FaUserPlus /></span>
                            <span className={styles.tabLabel}>Join Group</span>
                        </button>
                    </nav>

                    <div className={styles.userInfo}>
                        <img
                            src={user.photoURL && user.photoURL.trim() !== '' ? user.photoURL : '/default_profile.jpg'}
                            className={styles.userAvatar}
                            alt={user.displayName || 'You'}
                            onError={e => { (e.currentTarget as HTMLImageElement).src = '/default_profile.jpg' }}
                        />
                        <div className={styles.userDetails}>
                            <div className={styles.userName}>
                                {user.displayName || 'You'}
                            </div>
                            <div className={styles.userStatus}>Online</div>
                        </div>
                    </div>
                </aside>

                {/* Main content area */}
                <section className={styles.chatArea}>
                    {error && (
                        <div className={styles.errorMessage}>
                            {error}
                        </div>
                    )}
                    
                    {success && (
                        <div className={styles.successMessage}>
                            {success}
                        </div>
                    )}

                    {activeTab === 'my-groups' && (
                        <div className={styles.tabContent}>
                            <div className={styles.tabHeader}>
                                <h3>My Groups</h3>
                                <p>Groups you've created or joined</p>
                            </div>
                            
                            {myGroups.length === 0 ? (
                                <div className={styles.emptyState}>
                                    <div className={styles.emptyIcon}><FaUsers /></div>
                                    <h4>No groups yet</h4>
                                    <p>Create a new group or join an existing one to get started!</p>
                                </div>
                            ) : (
                                <div className={styles.groupsList}>
                                    {myGroups.map(group => (
                                        <div key={group.id} className={styles.groupCard}>
                                            <div className={styles.groupHeader}>
                                                <div className={styles.groupTitle}>
                                                    <h4>{group.name}</h4>
                                                    <div className={styles.groupMeta}>
                                                        {group.isPrivate ? (
                                                            <span className={styles.privacyBadge}>
                                                                <FaLock /> Private
                                                            </span>
                                                        ) : (
                                                            <span className={styles.privacyBadge}>
                                                                <FaGlobe /> Public
                                                            </span>
                                                        )}
                                                        {group.ownerId === user.uid && (
                                                            <span className={styles.ownerBadge}>
                                                                <FaCrown /> Owner
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                                <div className={styles.groupStats}>
                                                    <span>{group.memberCount} members</span>
                                                    <span>Last activity: {formatLastActivity(group.lastActivity)}</span>
                                                </div>
                                            </div>
                                            
                                            {group.description && (
                                                <p className={styles.groupDescription}>{group.description}</p>
                                            )}
                                            
                                            <div className={styles.groupActions}>
                                                <Link 
                                                    href={`/community/groups/${group.id}`} 
                                                    className={styles.enterGroupBtn}
                                                >
                                                    Enter Group
                                                </Link>
                                                
                                                {group.isPrivate && group.ownerId === user.uid && (
                                                    <button
                                                        className={styles.copyCodeBtn}
                                                        onClick={() => copyInviteCode(group.inviteCode)}
                                                    >
                                                        <FaCopy /> Copy Invite Code
                                                    </button>
                                                )}
                                                
                                                {group.ownerId === user.uid ? (
                                                    <button
                                                        className={styles.deleteGroupBtn}
                                                        onClick={() => handleDeleteGroup(group.id)}
                                                    >
                                                        <FaTrash /> Delete Group
                                                    </button>
                                                ) : (
                                                    <button
                                                        className={styles.leaveGroupBtn}
                                                        onClick={() => handleLeaveGroup(group.id)}
                                                    >
                                                        <FaSignOutAlt /> Leave Group
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    {activeTab === 'create' && (
                        <div className={styles.tabContent}>
                            <div className={styles.tabHeader}>
                                <h3>Create New Group</h3>
                                <p>Start your own community group</p>
                            </div>
                            
                            <form onSubmit={handleCreateGroup} className={styles.createForm}>
                                <div className={styles.formGroup}>
                                    <label htmlFor="groupName">Group Name *</label>
                                    <input
                                        id="groupName"
                                        type="text"
                                        value={createForm.name}
                                        onChange={e => setCreateForm(prev => ({ ...prev, name: e.target.value }))}
                                        placeholder="Enter group name"
                                        maxLength={50}
                                        required
                                    />
                                </div>
                                
                                <div className={styles.formGroup}>
                                    <label htmlFor="groupDescription">Description</label>
                                    <textarea
                                        id="groupDescription"
                                        value={createForm.description}
                                        onChange={e => setCreateForm(prev => ({ ...prev, description: e.target.value }))}
                                        placeholder="Describe your group (optional)"
                                        maxLength={200}
                                        rows={3}
                                    />
                                </div>
                                
                                <div className={styles.formGroup}>
                                    <label>Privacy Setting</label>
                                    <div className={styles.privacyOptions}>
                                        <label className={styles.radioOption}>
                                            <input
                                                type="radio"
                                                checked={createForm.isPrivate}
                                                onChange={() => setCreateForm(prev => ({ ...prev, isPrivate: true }))}
                                            />
                                            <span className={styles.radioLabel}>
                                                <FaLock /> Private - Requires invite code
                                            </span>
                                        </label>
                                        <label className={styles.radioOption}>
                                            <input
                                                type="radio"
                                                checked={!createForm.isPrivate}
                                                onChange={() => setCreateForm(prev => ({ ...prev, isPrivate: false }))}
                                            />
                                            <span className={styles.radioLabel}>
                                                <FaGlobe /> Public - Anyone can join
                                            </span>
                                        </label>
                                    </div>
                                </div>
                                
                                <button
                                    type="submit"
                                    disabled={creating || !createForm.name.trim()}
                                    className={styles.createBtn}
                                >
                                    {creating ? <FaSpinner className="spinner" /> : 'Create Group'}
                                </button>
                            </form>
                        </div>
                    )}

                    {activeTab === 'join' && (
                        <div className={styles.tabContent}>
                            <div className={styles.tabHeader}>
                                <h3>Join Group</h3>
                                <p>Enter an invite code or browse public groups</p>
                            </div>
                            
                            <div className={styles.joinSections}>
                                <div className={styles.joinByCode}>
                                    <h4>Join with Invite Code</h4>
                                    <form onSubmit={handleJoinGroup} className={styles.joinForm}>
                                        <div className={styles.formGroup}>
                                            <input
                                                type="text"
                                                value={joinForm.code}
                                                onChange={e => setJoinForm({ code: e.target.value })}
                                                placeholder="Enter invite code"
                                                maxLength={20}
                                            />
                                        </div>
                                        <button
                                            type="submit"
                                            disabled={joining || !joinForm.code.trim()}
                                            className={styles.joinBtn}
                                        >
                                            {joining ? <FaSpinner className="spinner" /> : 'Join Group'}
                                        </button>
                                    </form>
                                </div>
                                
                                <div className={styles.publicGroups}>
                                    <h4>Public Groups</h4>
                                    {publicGroups.length === 0 ? (
                                        <div className={styles.emptyState}>
                                            <p>No public groups available</p>
                                        </div>
                                    ) : (
                                        <div className={styles.groupsList}>
                                            {publicGroups.map(group => (
                                                <div key={group.id} className={styles.groupCard}>
                                                    <div className={styles.groupHeader}>
                                                        <div className={styles.groupTitle}>
                                                            <h4>{group.name}</h4>
                                                            <div className={styles.groupMeta}>
                                                                <span className={styles.privacyBadge}>
                                                                    <FaGlobe /> Public
                                                                </span>
                                                                {group.userIsOwner && (
                                                                    <span className={styles.ownerBadge}>
                                                                        <FaCrown /> Owner
                                                                    </span>
                                                                )}
                                                            </div>
                                                        </div>
                                                        <div className={styles.groupStats}>
                                                            <span>{group.memberCount} members</span>
                                                        </div>
                                                    </div>
                                                    
                                                    {group.description && (
                                                        <p className={styles.groupDescription}>{group.description}</p>
                                                    )}
                                                    
                                                    {group.userIsOwner ? (
                                                        <div className={styles.groupActions}>
                                                            <Link 
                                                                href={`/community/groups/${group.id}`} 
                                                                className={styles.enterGroupBtn}
                                                            >
                                                                Enter Your Group
                                                            </Link>
                                                        </div>
                                                    ) : group.userIsMember ? (
                                                        <div className={styles.groupActions}>
                                                            <Link 
                                                                href={`/community/groups/${group.id}`} 
                                                                className={styles.enterGroupBtn}
                                                            >
                                                                Enter Group
                                                            </Link>
                                                        </div>
                                                    ) : (
                                                        <button
                                                            onClick={e => handleJoinGroup(e, group.id)}
                                                            disabled={joining}
                                                            className={styles.joinBtn}
                                                        >
                                                            {joining ? <FaSpinner className="spinner" /> : 'Join Group'}
                                                        </button>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}
                </section>
            </div>
        </main>
    )
}