/**
 * PlayerDetailScreen - Individual Player Details
 * 
 * LEARNING NOTES: Mobile Player Detail Interface
 * 
 * This demonstrates comprehensive player detail view for mobile:
 * 1. Scrollable layout with player image and stats
 * 2. Prediction details with confidence calculations
 * 3. Voting system integration
 * 4. Comments section with real-time updates
 * 5. Market data and profit calculations
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  SafeAreaView,
  Image,
  TouchableOpacity,
  ActivityIndicator,
  TextInput,
  Alert,
  RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';

// Import design system and API hooks
import { theme } from '../styles/theme';
import { usePlayer } from '../hooks/useApi';
import { RootStackParamList } from '../navigation/AppNavigator';
import { useAuth } from '../contexts/AuthContext';
import { apiConfig } from '../services/api';
import { isOfficialAccount } from '../utils/accounts';

// Type definitions
type PlayerDetailRouteProp = RouteProp<RootStackParamList, 'PlayerDetail'>;
type PlayerDetailNavigationProp = StackNavigationProp<RootStackParamList, 'PlayerDetail'>;

// Attribute groups for different player types
const hitterGroups: [string, [string, string][]][] = [
  [
    'Hitting',
    [
      ['Contact vs L', 'contact_left'],
      ['Contact vs R', 'contact_right'],
      ['Power vs L', 'power_left'],
      ['Power vs R', 'power_right'],
      ['Plate Vision', 'plate_vision'],
      ['Batting Clutch', 'batting_clutch'],
    ],
  ],
  [
    'Fielding',
    [
      ['Fielding Ability', 'fielding_ability'],
      ['Arm Strength', 'arm_strength'],
      ['Arm Accuracy', 'arm_accuracy'],
      ['Reaction Time', 'reaction_time'],
      ['Blocking', 'blocking'],
    ],
  ],
  [
    'Running',
    [
      ['Speed', 'speed'],
      ['Stealing', 'baserunning_ability'],
      ['Aggression', 'baserunning_aggression'],
    ],
  ],
];

const pitcherGroups: [string, [string, string][]][] = [
  [
    'Pitching',
    [
      ['Stamina', 'stamina'],
      ['Pitching Clutch', 'pitching_clutch'],
      ['H/9', 'hits_per_bf'],
      ['K/9', 'k_per_bf'],
      ['BB/9', 'bb_per_bf'],
      ['HR/9', 'hr_per_bf'],
    ],
  ],
  [
    'Pitch Attributes',
    [
      ['Velocity', 'pitch_velocity'],
      ['Pitch Control', 'pitch_control'],
      ['Pitch Movement', 'pitch_movement'],
    ],
  ],
];

interface Comment {
  id: string;
  parentId: string | null;
  userId: string;
  username: string;
  profilePicUrl: string;
  text: string;
  timestamp: number | null;
  likes: string[];
}

interface PlayerData {
  id: string;
  name: string;
  team_short_name: string;
  display_position: string;
  age: string;
  baked_img: string;
  
  ovr: number;
  delta_rank_pred: number;
  delta_rank_low: number;
  delta_rank_high: number;
  
  predicted_rank: number;
  predicted_rank_low: number;
  predicted_rank_high: number;
  
  confidence_percentage: number;
  
  market_price?: number;
  qs_actual: number;
  qs_pred: number;
  qs_pred_low: number;
  qs_pred_high: number;
  
  predicted_profit: number;
  predicted_profit_low: number;
  predicted_profit_high: number;
  
  predicted_profit_pct: number;
  predicted_profit_pct_low?: number;
  predicted_profit_pct_high?: number;
  
  bat_hand: string;
  throw_hand: string;
  height: string;
  weight: string;
  
  is_hitter: boolean | string;
  
  [key: string]: string | number | boolean | null | undefined;
}

export const PlayerDetailScreen: React.FC = () => {
  const route = useRoute<PlayerDetailRouteProp>();
  const navigation = useNavigation<PlayerDetailNavigationProp>();
  const { playerId, playerName } = route.params;
  
  // Authentication
  const { user } = useAuth();
  
  // API data
  const { 
    data: playerData, 
    isLoading, 
    error, 
    refresh 
  } = usePlayer(playerId);
  
  // Local state
  const [refreshing, setRefreshing] = useState(false);
  const [votes, setVotes] = useState<{upvotes: number, downvotes: number, userVote: 'up'|'down'|null}>({
    upvotes: 0,
    downvotes: 0,
    userVote: null
  });
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [showComments, setShowComments] = useState(false);
  const [loadingComments, setLoadingComments] = useState(false);
  const [postingComment, setPostingComment] = useState(false);
  
  // Reply state
  const [replyingTo, setReplyingTo] = useState<Comment | null>(null);
  const [replyText, setReplyText] = useState('');
  const [postingReply, setPostingReply] = useState(false);
  const [expandedThreads, setExpandedThreads] = useState<Set<string>>(new Set());
  const [votesLoading, setVotesLoading] = useState(false);
  const [votingInProgress, setVotingInProgress] = useState(false);
  
  // Attributes/Stats toggle state
  const [activeTab, setActiveTab] = useState<'attributes' | 'stats'>('attributes');
  const [statsPeriod, setStatsPeriod] = useState<'season' | '3wk' | '1wk'>('season');
  
  // Pull to refresh
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await refresh();
    } catch (error) {
      console.error('Failed to refresh player data:', error);
    } finally {
      setRefreshing(false);
    }
  }, [refresh]);
  
  // Vote handlers
  const handleVote = useCallback(async (voteType: 'up' | 'down') => {
    if (!user) {
      Alert.alert('Sign In Required', 'Please sign in to vote on players.');
      return;
    }
    
    if (votingInProgress) return;
    
    setVotingInProgress(true);
    
    try {
      const token = await user.getIdToken();
      
      // If user clicks the same vote they already made, remove it (toggle off)
      const method = votes.userVote === voteType ? 'DELETE' : 'POST';
      const body = method === 'POST' ? JSON.stringify({ vote: voteType }) : undefined;
      
      const response = await fetch(`${apiConfig.baseURL}/api/cards/${playerId}/votes`, {
        method,
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to submit vote');
      }
      
      const result = await response.json();
      setVotes({
        upvotes: result.upvotes,
        downvotes: result.downvotes,
        userVote: result.userVote
      });
    } catch (error) {
      console.error('Error voting:', error);
      Alert.alert('Error', 'Failed to submit vote. Please try again.');
    } finally {
      setVotingInProgress(false);
    }
  }, [user, votes.userVote, playerId, votingInProgress]);
  
  // Load votes from API
  const loadVotes = useCallback(async () => {
    setVotesLoading(true);
    try {
      const headers: Record<string, string> = {};
      
      // Include auth token if user is logged in
      if (user) {
        const token = await user.getIdToken();
        headers['Authorization'] = `Bearer ${token}`;
      }
      
      const response = await fetch(`${apiConfig.baseURL}/api/cards/${playerId}/votes`, { headers });
      if (response.ok) {
        const voteData = await response.json();
        setVotes({
          upvotes: voteData.upvotes || 0,
          downvotes: voteData.downvotes || 0,
          userVote: voteData.userVote || null
        });
      } else {
        console.error('Failed to load votes:', response.statusText);
      }
    } catch (error) {
      console.error('Error loading votes:', error);
    } finally {
      setVotesLoading(false);
    }
  }, [playerId, user]);
  
  // Load comments from API
  const loadComments = useCallback(async () => {
    setLoadingComments(true);
    try {
      const response = await fetch(`${apiConfig.baseURL}/api/cards/${playerId}/comments`);
      if (response.ok) {
        const commentsData = await response.json();
        setComments(commentsData);
      } else {
        console.error('Failed to load comments:', response.statusText);
      }
    } catch (error) {
      console.error('Error loading comments:', error);
    } finally {
      setLoadingComments(false);
    }
  }, [playerId]);
  
  // Comment handlers
  const handleAddComment = useCallback(async () => {
    if (!newComment.trim() || !user || postingComment) return;
    
    setPostingComment(true);
    
    try {
      // Get Firebase ID token for authentication
      const token = await user.getIdToken();
      
      // Send comment to API
      const response = await fetch(`${apiConfig.baseURL}/api/cards/${playerId}/comments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          text: newComment.trim(),
          playerId: playerId
        })
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to post comment');
      }
      
      // Clear input and reload comments to show the new comment
      setNewComment('');
      await loadComments();
    } catch (error) {
      console.error('Error posting comment:', error);
      Alert.alert('Error', 'Failed to post comment. Please try again.');
    } finally {
      setPostingComment(false);
    }
  }, [newComment, user, playerId, loadComments, postingComment]);

  /**
   * Handle deleting a comment
   */
  const handleDeleteComment = useCallback(async (commentId: string) => {
    if (!user) {
      Alert.alert('Error', 'You must be logged in to delete comments');
      return;
    }

    // Confirm deletion
    Alert.alert(
      'Delete Comment',
      'Are you sure you want to delete this comment? This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Delete', 
          style: 'destructive',
          onPress: () => performDeleteComment(commentId)
        }
      ]
    );
  }, [user]);

  const performDeleteComment = async (commentId: string) => {
    try {
      const token = await user!.getIdToken();
      
      const response = await fetch(`${apiConfig.baseURL}/api/cards/${playerId}/comments/${commentId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `HTTP ${response.status}`);
      }

      // Remove comment from local state
      setComments(prevComments => prevComments.filter(comment => comment.id !== commentId));
      
    } catch (error) {
      console.error('Delete comment error:', error);
      Alert.alert('Error', 'Failed to delete comment. Please try again.');
    }
  };

  /**
   * Handle starting a reply to a comment
   */
  const handleStartReply = useCallback((comment: Comment) => {
    setReplyingTo(comment);
    setReplyText(`@${comment.username} `);
  }, []);

  /**
   * Handle canceling a reply
   */
  const handleCancelReply = useCallback(() => {
    setReplyingTo(null);
    setReplyText('');
  }, []);

  /**
   * Handle posting a reply
   */
  const handlePostReply = useCallback(async (parentId: string) => {
    if (!replyText.trim() || !user || postingReply) return;
    
    setPostingReply(true);
    
    try {
      // Get Firebase ID token for authentication
      const token = await user.getIdToken();
      
      // Send reply to API with parentId
      const response = await fetch(`${apiConfig.baseURL}/api/cards/${playerId}/comments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          text: replyText.trim(),
          parentId: parentId
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to post reply');
      }
      
      // Clear reply state and reload comments to show the new reply
      setReplyingTo(null);
      setReplyText('');
      await loadComments();
    } catch (error) {
      console.error('Error posting reply:', error);
      Alert.alert('Error', 'Failed to post reply. Please try again.');
    } finally {
      setPostingReply(false);
    }
  }, [replyText, user, playerId, loadComments, postingReply]);
  
  // Handle user profile navigation
  const handleUserPress = useCallback((userId: string) => {
    navigation.navigate('UserProfile', { userId });
  }, [navigation]);
  
  // Load votes and comments when component mounts
  useEffect(() => {
    loadVotes();
    loadComments();
  }, [loadVotes, loadComments]);
  
  // Loading state
  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.colors.primary.main} />
          <Text style={styles.loadingText}>Loading player details...</Text>
        </View>
      </SafeAreaView>
    );
  }
  
  // Error state
  if (error || !playerData) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle" size={48} color={theme.colors.error} />
          <Text style={styles.errorText}>Failed to load player details</Text>
          <TouchableOpacity style={styles.retryButton} onPress={() => refresh()}>
            <Text style={styles.retryText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }
  
  const player = playerData as PlayerData;
  
  // Fix is_hitter boolean conversion (same as in useApi.ts)
  const isHitter = player.is_hitter === true || 
                   player.is_hitter === 'true' || 
                   player.is_hitter === 'True';
  
  const deltaRank = typeof player.delta_rank_pred === 'number' ? player.delta_rank_pred : 0;
  const changeColor = deltaRank > 0 ? '#10b981' : deltaRank < 0 ? '#ef4444' : '#64748b';
  const changeIcon = deltaRank > 0 ? 'trending-up' : deltaRank < 0 ? 'trending-down' : 'remove';
  
  return (
    <SafeAreaView style={styles.container}>
      <ScrollView 
        style={styles.scrollView}
        refreshControl={
          <RefreshControl 
            refreshing={refreshing} 
            onRefresh={onRefresh}
            tintColor={theme.colors.primary.main}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* Custom Back Button */}
        <View style={styles.customHeader}>
          <TouchableOpacity 
            onPress={() => navigation.goBack()}
            style={styles.backButton}
            activeOpacity={0.7}
          >
            <Ionicons name="chevron-back" size={16} color={theme.colors.primary.main} />
            <Text style={styles.backButtonText}>Back</Text>
          </TouchableOpacity>
        </View>
        
        {/* Player Header */}
        <View style={styles.playerHeader}>
          <Image 
            source={{ uri: player.baked_img }} 
            style={styles.playerImage}
            resizeMode="cover"
          />
          <View style={styles.playerInfo}>
            <Text style={styles.playerName}>{player.name}</Text>
            <Text style={styles.playerTeam}>{player.team_short_name}</Text>
            <Text style={styles.playerPosition}>{player.display_position} • Age {player.age}</Text>
            <View style={styles.playerStatsRow}>
              <Text style={styles.playerStat}>OVR {player.ovr}</Text>
              <Text style={styles.playerStat}>•</Text>
              <Text style={styles.playerStat}>{player.height} • {player.weight} </Text>
            </View>
            <View style={styles.playerStatsRow}>
              <Text style={styles.playerStat}>Bats: {player.bat_hand}</Text>
              <Text style={styles.playerStat}>•</Text>
              <Text style={styles.playerStat}>Throws: {player.throw_hand}</Text>
            </View>
          </View>
        </View>
        
        {/* Community Section */}
        <View style={styles.firstSection}>
          <Text style={styles.sectionTitle}>Community</Text>
          
          {/* Voting Component */}
          <View style={styles.votingCard}>
            <Text style={styles.votingQuestion}>
              Do you think {player.name} will get upgraded or downgraded?
            </Text>
            
            <View style={styles.votingButtons}>
              <TouchableOpacity 
                style={[
                  styles.voteButton, 
                  styles.upvoteButton,
                  votes.userVote === 'up' && styles.voteButtonActive,
                  (votesLoading || votingInProgress) && styles.voteButtonDisabled
                ]}
                onPress={() => handleVote('up')}
                disabled={votesLoading || votingInProgress}
              >
                {votingInProgress && votes.userVote !== 'up' ? (
                  <ActivityIndicator size="small" color="#10b981" />
                ) : (
                  <Ionicons 
                    name="thumbs-up" 
                    size={20} 
                    color={votes.userVote === 'up' ? 'white' : '#10b981'} 
                  />
                )}
                <Text style={[
                  styles.voteText,
                  votes.userVote === 'up' && styles.voteTextActive
                ]}>
                  Upgrade ({votesLoading ? '...' : votes.upvotes})
                </Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={[
                  styles.voteButton, 
                  styles.downvoteButton,
                  votes.userVote === 'down' && styles.voteButtonActive,
                  (votesLoading || votingInProgress) && styles.voteButtonDisabled
                ]}
                onPress={() => handleVote('down')}
                disabled={votesLoading || votingInProgress}
              >
                {votingInProgress && votes.userVote !== 'down' ? (
                  <ActivityIndicator size="small" color="#ef4444" />
                ) : (
                  <Ionicons 
                    name="thumbs-down" 
                    size={20} 
                    color={votes.userVote === 'down' ? 'white' : '#ef4444'} 
                  />
                )}
                <Text style={[
                  styles.voteText,
                  votes.userVote === 'down' && styles.voteTextActive
                ]}>
                  Downgrade ({votesLoading ? '...' : votes.downvotes})
                </Text>
              </TouchableOpacity>
            </View>
          </View>
          
          {/* Comments Toggle */}
          <TouchableOpacity 
            onPress={() => setShowComments(!showComments)}
            style={styles.toggleCommentsButton}
          >
            <Text style={styles.toggleCommentsText}>
              {showComments ? 'Hide' : 'Show'} Comments ({comments.length})
            </Text>
            <Ionicons 
              name={showComments ? "chevron-up" : "chevron-down"} 
              size={16} 
              color={theme.colors.primary.main} 
            />
          </TouchableOpacity>
          
          {showComments && (
            <View style={styles.commentsSection}>
              {/* Add Comment */}
              {user ? (
                <View style={styles.addCommentContainer}>
                  <TextInput
                    style={styles.commentInput}
                    placeholder="Share your thoughts..."
                    placeholderTextColor={theme.colors.text.secondary}
                    value={newComment}
                    onChangeText={setNewComment}
                    multiline
                    maxLength={500}
                    editable={!postingComment}
                  />
                  <TouchableOpacity 
                    style={[
                      styles.postButton,
                      (!newComment.trim() || postingComment) && styles.postButtonDisabled
                    ]}
                    onPress={handleAddComment}
                    disabled={!newComment.trim() || postingComment}
                  >
                    {postingComment ? (
                      <ActivityIndicator size="small" color="white" />
                    ) : (
                      <Text style={[
                        styles.postButtonText,
                        (!newComment.trim() || postingComment) && styles.postButtonTextDisabled
                      ]}>
                        Post
                      </Text>
                    )}
                  </TouchableOpacity>
                </View>
              ) : (
                <View style={styles.loginPromptContainer}>
                  <Text style={styles.loginPromptText}>
                    Sign in to share your thoughts on this player
                  </Text>
                </View>
              )}
              
              {/* Comments List */}
              {loadingComments ? (
                <View style={styles.loadingCommentsContainer}>
                  <ActivityIndicator size="small" color={theme.colors.primary.main} />
                  <Text style={styles.loadingCommentsText}>Loading comments...</Text>
                </View>
              ) : comments.length === 0 ? (
                <View style={styles.noCommentsContainer}>
                  <Text style={styles.noCommentsText}>
                    No comments yet. Be the first to share your thoughts!
                  </Text>
                </View>
              ) : (
                <View style={styles.commentsList}>
                  {comments
                    .filter(comment => !comment.parentId) // Only top-level comments
                    .map((comment) => {
                      const replies = comments.filter(reply => reply.parentId === comment.id);
                      const isThreadExpanded = expandedThreads.has(comment.id);
                      
                      return (
                        <View key={comment.id}>
                          {/* Top-level comment */}
                          <View style={styles.commentItem}>
                            <View style={styles.commentHeader}>
                              <TouchableOpacity onPress={() => handleUserPress(comment.userId)}>
                                <Image
                                  source={
                                    comment.profilePicUrl
                                      ? { uri: comment.profilePicUrl }
                                      : require('../../assets/default_profile.jpg')
                                  }
                                  style={styles.commentAvatar}
                                  defaultSource={require('../../assets/default_profile.jpg')}
                                />
                              </TouchableOpacity>
                              <View style={styles.commentUserInfo}>
                                <TouchableOpacity onPress={() => handleUserPress(comment.userId)}>
                                  <View style={styles.commentUsernameContainer}>
                                    <Text style={[
                                      styles.commentUsername,
                                      isOfficialAccount(comment.username) && styles.officialCommentUsername
                                    ]}>
                                      {comment.username}
                                    </Text>
                                    {isOfficialAccount(comment.username) && (
                                      <Ionicons 
                                        name="checkmark-circle" 
                                        size={14} 
                                        color={theme.colors.primary.main} 
                                        style={styles.commentVerifiedIcon}
                                      />
                                    )}
                                  </View>
                                </TouchableOpacity>
                                <Text style={styles.commentTime}>
                                  {comment.timestamp ? new Date(comment.timestamp).toLocaleDateString() : 'Unknown'}
                                </Text>
                              </View>
                            </View>
                            <Text style={styles.commentText}>{comment.text}</Text>
                            
                            {/* Comment Actions */}
                            <View style={styles.commentActions}>
                              {/* Reply button */}
                              {user && (
                                <TouchableOpacity 
                                  style={styles.commentReplyButton}
                                  onPress={() => handleStartReply(comment)}
                                >
                                  <Ionicons 
                                    name="chatbubble-outline" 
                                    size={14} 
                                    color={theme.colors.text.secondary} 
                                  />
                                  <Text style={styles.commentReplyText}>Reply</Text>
                                </TouchableOpacity>
                              )}
                              
                              {/* Delete button - only show for user's own comments */}
                              {user && comment.userId === user.uid && (
                                <TouchableOpacity 
                                  style={styles.commentDeleteButton}
                                  onPress={() => handleDeleteComment(comment.id)}
                                >
                                  <Ionicons 
                                    name="trash-outline" 
                                    size={14} 
                                    color="#ef4444" 
                                  />
                                  <Text style={styles.commentDeleteText}>Delete</Text>
                                </TouchableOpacity>
                              )}
                            </View>
                            
                            {/* Reply Input - show if this comment is being replied to */}
                            {replyingTo && replyingTo.id === comment.id && (
                              <View style={styles.replyInputContainer}>
                                <TextInput
                                  style={styles.replyInput}
                                  value={replyText}
                                  onChangeText={setReplyText}
                                  placeholder={`Reply to ${comment.username}...`}
                                  multiline={true}
                                  maxLength={500}
                                  editable={!postingReply}
                                />
                                <View style={styles.replyActions}>
                                  <TouchableOpacity 
                                    style={styles.replyCancel}
                                    onPress={handleCancelReply}
                                  >
                                    <Text style={styles.replyCancelText}>Cancel</Text>
                                  </TouchableOpacity>
                                  <TouchableOpacity 
                                    style={[
                                      styles.replyPost,
                                      (!replyText.trim() || postingReply) && styles.replyPostDisabled
                                    ]}
                                    onPress={() => handlePostReply(comment.id)}
                                    disabled={!replyText.trim() || postingReply}
                                  >
                                    {postingReply ? (
                                      <ActivityIndicator size="small" color="white" />
                                    ) : (
                                      <Text style={styles.replyPostText}>Post Reply</Text>
                                    )}
                                  </TouchableOpacity>
                                </View>
                              </View>
                            )}
                          </View>
                          
                          {/* Replies Toggle and Thread */}
                          {replies.length > 0 && (
                            <View style={styles.repliesContainer}>
                              <TouchableOpacity 
                                style={styles.repliesToggle}
                                onPress={() => {
                                  const newExpanded = new Set(expandedThreads);
                                  if (isThreadExpanded) {
                                    newExpanded.delete(comment.id);
                                  } else {
                                    newExpanded.add(comment.id);
                                  }
                                  setExpandedThreads(newExpanded);
                                }}
                              >
                                <Ionicons 
                                  name={isThreadExpanded ? "chevron-up" : "chevron-down"} 
                                  size={16} 
                                  color={theme.colors.primary.main} 
                                />
                                <Text style={styles.repliesToggleText}>
                                  {isThreadExpanded ? 'Hide' : 'Show'} {replies.length} {replies.length === 1 ? 'reply' : 'replies'}
                                </Text>
                              </TouchableOpacity>
                              
                              {/* Replies List */}
                              {isThreadExpanded && (
                                <View style={styles.repliesList}>
                                  {replies.map((reply) => (
                                    <View key={reply.id} style={styles.replyItem}>
                                      <View style={styles.commentHeader}>
                                        <TouchableOpacity onPress={() => handleUserPress(reply.userId)}>
                                          <Image
                                            source={
                                              reply.profilePicUrl
                                                ? { uri: reply.profilePicUrl }
                                                : require('../../assets/default_profile.jpg')
                                            }
                                            style={styles.replyAvatar}
                                            defaultSource={require('../../assets/default_profile.jpg')}
                                          />
                                        </TouchableOpacity>
                                        <View style={styles.commentUserInfo}>
                                          <TouchableOpacity onPress={() => handleUserPress(reply.userId)}>
                                            <View style={styles.commentUsernameContainer}>
                                              <Text style={[
                                                styles.commentUsername,
                                                isOfficialAccount(reply.username) && styles.officialCommentUsername
                                              ]}>
                                                {reply.username}
                                              </Text>
                                              {isOfficialAccount(reply.username) && (
                                                <Ionicons 
                                                  name="checkmark-circle" 
                                                  size={14} 
                                                  color={theme.colors.primary.main} 
                                                  style={styles.commentVerifiedIcon}
                                                />
                                              )}
                                            </View>
                                          </TouchableOpacity>
                                          <Text style={styles.commentTime}>
                                            {reply.timestamp ? new Date(reply.timestamp).toLocaleDateString() : 'Unknown'}
                                          </Text>
                                        </View>
                                      </View>
                                      <Text style={styles.commentText}>{reply.text}</Text>
                                      
                                      {/* Reply Actions */}
                                      <View style={styles.commentActions}>
                                        {/* Delete button - only show for user's own replies */}
                                        {user && reply.userId === user.uid && (
                                          <TouchableOpacity 
                                            style={styles.commentDeleteButton}
                                            onPress={() => handleDeleteComment(reply.id)}
                                          >
                                            <Ionicons 
                                              name="trash-outline" 
                                              size={14} 
                                              color="#ef4444" 
                                            />
                                            <Text style={styles.commentDeleteText}>Delete</Text>
                                          </TouchableOpacity>
                                        )}
                                      </View>
                                    </View>
                                  ))}
                                </View>
                              )}
                            </View>
                          )}
                        </View>
                      );
                    })
                  }
                </View>
              )}
            </View>
          )}
        </View>
        
        {/* Prediction Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>AI Prediction</Text>
          
          <View style={styles.predictionCard}>
            <View style={styles.confidenceHeader}>
              <Text style={styles.confidenceLabel}>Confidence</Text>
              <Text style={styles.confidenceValue}>
                {typeof player.confidence_percentage === 'number' ? player.confidence_percentage.toFixed(1) : '0.0'}%
              </Text>
            </View>
            
            <View style={styles.predictionGrid}>
              <View style={styles.predictionItem}>
                <Text style={styles.predictionLabel}>Current OVR</Text>
                <Text style={styles.predictionValue}>{player.ovr}</Text>
              </View>
              
              <View style={styles.predictionItem}>
                <Text style={styles.predictionLabel}>Predicted OVR</Text>
                <Text style={styles.predictionValue}>{player.predicted_rank || 0}</Text>
              </View>
              
              <View style={styles.predictionItem}>
                <Text style={styles.predictionLabel}>Rating Change</Text>
                <View style={styles.changeContainer}>
                  <Ionicons name={changeIcon} size={16} color={changeColor} />
                  <Text style={[styles.changeValue, { color: changeColor }]}>
                    {deltaRank > 0 ? '+' : ''}{deltaRank.toFixed(1)}
                  </Text>
                </View>
              </View>
              
              <View style={styles.predictionItem}>
                <Text style={styles.predictionLabel}>Range</Text>
                <Text style={styles.predictionValue}>
                  {player.predicted_rank_low} - {player.predicted_rank_high}
                </Text>
              </View>
            </View>
          </View>
        </View>
        
        {/* Market Data Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Market Data</Text>
          
          <View style={styles.marketCard}>
            <View style={styles.marketGrid}>
              <View style={styles.marketItem}>
                <Text style={styles.marketLabel}>Current Price</Text>
                <Text style={styles.marketValue}>
                  {player.market_price ? `${player.market_price.toLocaleString()} stubs` : 'N/A'}
                </Text>
              </View>
              
              <View style={styles.marketItem}>
                <Text style={styles.marketLabel}>Quick Sell</Text>
                <Text style={styles.marketValue}>{player.qs_actual.toLocaleString()} stubs</Text>
              </View>
              
              <View style={styles.marketItem}>
                <Text style={styles.marketLabel}>Predicted Profit</Text>
                <Text style={[styles.profitValue, { 
                  color: (typeof player.predicted_profit === 'number' ? player.predicted_profit : 0) > 0 ? '#10b981' : '#ef4444' 
                }]}>
                  {(typeof player.predicted_profit === 'number' ? player.predicted_profit : 0) > 0 ? '+' : ''}
                  {typeof player.predicted_profit === 'number' ? player.predicted_profit.toLocaleString() : '0'} stubs
                </Text>
              </View>
              
              <View style={styles.marketItem}>
                <Text style={styles.marketLabel}>Profit %</Text>
                <Text style={[styles.profitValue, { 
                  color: (typeof player.predicted_profit_pct === 'number' ? player.predicted_profit_pct : 0) > 0 ? '#10b981' : '#ef4444' 
                }]}>
                  {(typeof player.predicted_profit_pct === 'number' ? player.predicted_profit_pct : 0) > 0 ? '+' : ''}
                  {typeof player.predicted_profit_pct === 'number' ? player.predicted_profit_pct.toFixed(1) : '0.0'}%
                </Text>
              </View>
            </View>
          </View>
        </View>
        
        {/* Attributes/Stats Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionToggle}>
              <TouchableOpacity 
                style={[styles.toggleButton, activeTab === 'attributes' && styles.toggleActive]}
                onPress={() => setActiveTab('attributes')}
              >
                <Text style={[
                  styles.toggleText,
                  activeTab === 'attributes' && styles.toggleTextActive
                ]}>
                  Attributes
                </Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.toggleButton, activeTab === 'stats' && styles.toggleActive]}
                onPress={() => setActiveTab('stats')}
              >
                <Text style={[
                  styles.toggleText,
                  activeTab === 'stats' && styles.toggleTextActive
                ]}>
                  MLB Stats
                </Text>
              </TouchableOpacity>
            </View>
          </View>
          
          {/* Attributes Content */}
          {activeTab === 'attributes' && (
            <>
              {(isHitter ? hitterGroups : pitcherGroups).map(([groupTitle, attrs]) => (
            <View key={groupTitle} style={styles.attributesGroup}>
              <Text style={styles.groupTitle}>{groupTitle}</Text>
              
              {attrs.map(([label, key]) => {
                const currentVal = Number(player[key] ?? 0);
                
                // Special handling for hits_per_bf (H/9) - matches website logic
                let predictedVal: number;
                let delta: number;
                
                if (key === 'hits_per_bf') {
                  // For H/9, look for h_per_bf_new_pred which contains the delta, not absolute value
                  const deltaValue = Number(player['h_per_bf_new_pred'] ?? 0);
                  delta = deltaValue;
                  predictedVal = currentVal + delta;
                } else {
                  // Standard handling for other attributes
                  predictedVal = Number(player[`${key}_new_pred`] ?? currentVal);
                  delta = predictedVal - currentVal;
                }
                
                const isUpgrade = delta > 0;
                const isDowngrade = delta < 0;
                
                return (
                  <View key={label} style={styles.attributeRow}>
                    <View style={styles.attributeHeader}>
                      <Text style={styles.attributeLabel}>{label}</Text>
                      <View style={styles.attributeValues}>
                        <Text style={styles.currentValue}>{currentVal}</Text>
                        {delta !== 0 && (
                          <Text style={[
                            styles.deltaValue,
                            { color: isUpgrade ? '#10b981' : '#ef4444' }
                          ]}>
                            {delta > 0 ? '+' : ''}{delta.toFixed(1)}
                          </Text>
                        )}
                      </View>
                    </View>
                    
                    {/* Progress Bar */}
                    <View style={styles.attributeBar}>
                      <View style={styles.barBackground}>
                        {/* Current value bar */}
                        <View 
                          style={[
                            styles.currentBar,
                            { 
                              width: `${Math.min((currentVal / 125) * 100, 100)}%`,
                              borderTopRightRadius: delta === 0 ? 3 : (isUpgrade ? 0 : 3),
                              borderBottomRightRadius: delta === 0 ? 3 : (isUpgrade ? 0 : 3),
                            }
                          ]} 
                        />
                        
                        {/* Predicted change overlay */}
                        {delta !== 0 && (
                          <View 
                            style={[
                              styles.predictedBar,
                              {
                                width: `${Math.min((Math.abs(delta) / 125) * 100, 100)}%`,
                                left: isUpgrade 
                                  ? `${Math.min((currentVal / 125) * 100, 100)}%`
                                  : `${Math.min((predictedVal / 125) * 100, 100)}%`,
                                backgroundColor: isUpgrade ? '#10b981' : '#ef4444',
                                opacity: 0.7,
                                borderTopRightRadius: isUpgrade ? 3 : 0,
                                borderBottomRightRadius: isUpgrade ? 3 : 0,
                                borderTopLeftRadius: isUpgrade ? 0 : 3,
                                borderBottomLeftRadius: isUpgrade ? 0 : 3,
                              }
                            ]} 
                          />
                        )}
                      </View>
                    </View>
                  </View>
                );
              })}
            </View>
          ))}
            </>
          )}
          
          {/* MLB Stats Content */}
          {activeTab === 'stats' && (
            <>
              {/* Period Selection Tabs */}
              <View style={styles.periodTabs}>
                {['season', '3wk', '1wk'].map((period) => (
                  <TouchableOpacity
                    key={period}
                    style={[styles.periodTab, statsPeriod === period && styles.periodTabActive]}
                    onPress={() => setStatsPeriod(period as 'season' | '3wk' | '1wk')}
                  >
                    <Text style={[
                      styles.periodTabText,
                      statsPeriod === period && styles.periodTabTextActive
                    ]}>
                      {period === '3wk' ? '3-Week' : period === '1wk' ? '1-Week' : 'Season'}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
              
              {/* Stats Table */}
              <View style={styles.statsContainer}>
                <View style={styles.statsTable}>
                  {/* Header Row */}
                  <View style={styles.statsHeaderRow}>
                    <Text style={styles.statsHeaderCell}>Stat</Text>
                    {isHitter ? (
                      <>
                        <Text style={styles.statsHeaderCell}>vs LHP</Text>
                        <Text style={styles.statsHeaderCell}>vs RHP</Text>
                        <Text style={styles.statsHeaderCell}>RISP</Text>
                      </>
                    ) : (
                      <>
                        <Text style={styles.statsHeaderCell}>Overall</Text>
                        <Text style={styles.statsHeaderCell}>RISP</Text>
                      </>
                    )}
                  </View>
                  
                  {/* Data Rows */}
                  {isHitter ? (
                    // Hitter stats
                    ['pa', 'avg', 'obp', 'slug', 'ops', 'hr', 'h', 'so', 'bb', 'rbi'].map(stat => {
                      const sl = statsPeriod === 'season' ? `season_vl_${stat}` : `${statsPeriod}_vl_${stat}`;
                      const sr = statsPeriod === 'season' ? `season_vr_${stat}` : `${statsPeriod}_vr_${stat}`;
                      const ri = statsPeriod === 'season' ? `season_risp_${stat}` : `${statsPeriod}_risp_${stat}`;
                      const isPct = ['avg', 'obp', 'slug', 'ops'].includes(stat);
                      
                      return (
                        <View key={stat} style={styles.statsDataRow}>
                          <Text style={styles.statsCell}>{stat.toUpperCase()}</Text>
                          <Text style={styles.statsCell}>
                            {Number(player[sl] ?? 0).toFixed(isPct ? 3 : 0)}
                          </Text>
                          <Text style={styles.statsCell}>
                            {Number(player[sr] ?? 0).toFixed(isPct ? 3 : 0)}
                          </Text>
                          <Text style={styles.statsCell}>
                            {Number(player[ri] ?? 0).toFixed(isPct ? 3 : 0)}
                          </Text>
                        </View>
                      );
                    })
                  ) : (
                    // Pitcher stats
                    [
                      ['IP', 'IP'], ['ERA', 'ER'], ['WHIP', 'WHIP'],
                      ['K/9', 'K'], ['BB/9', 'BB'], ['H/9', 'H'], ['HR/9', 'HR']
                    ].map(([label, field]) => {
                      const prefix = statsPeriod === 'season' ? 'season' : statsPeriod;
                      const overallKey = `${prefix}_ovr_${field}`;
                      const rispKey = `${prefix}_risp_${field}`;
                      const ipOverallKey = `${prefix}_ovr_IP`;
                      const ipRispKey = `${prefix}_risp_IP`;
                      
                      // Helper function to calculate ERA: (Earned Runs / Innings Pitched) * 9
                      const calculateERA = (erKey: string, ipKey: string) => {
                        const earnedRuns = Number(player[erKey] ?? 0);
                        const innings = Number(player[ipKey] ?? 0);
                        return innings > 0 ? ((earnedRuns / innings) * 9).toFixed(2) : '–';
                      };
                      
                      // Helper function to calculate rate stats (per 9 innings)
                      const calculateRate = (statKey: string, ipKey: string, digits = 1) => {
                        const statValue = Number(player[statKey] ?? 0);
                        const innings = Number(player[ipKey] ?? 0);
                        return innings > 0 ? (statValue * 9 / innings).toFixed(digits) : '–';
                      };
                      
                      return (
                        <View key={label} style={styles.statsDataRow}>
                          <Text style={styles.statsCell}>{label}</Text>
                          <Text style={styles.statsCell}>
                            {label === 'ERA' 
                              ? calculateERA(overallKey, ipOverallKey)
                              : label.includes('/9')
                                ? calculateRate(overallKey, ipOverallKey)
                                : Number(player[overallKey] ?? 0).toFixed(1)
                            }
                          </Text>
                          <Text style={styles.statsCell}>
                            {label === 'ERA'
                              ? calculateERA(rispKey, ipRispKey)
                              : label.includes('/9')
                                ? calculateRate(rispKey, ipRispKey)
                                : Number(player[rispKey] ?? 0).toFixed(1)
                            }
                          </Text>
                        </View>
                      );
                    })
                  )}
                </View>
              </View>
            </>
          )}
        </View>
        
        {/* Bottom Padding */}
        <View style={styles.bottomPadding} />
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background.dark,
  },
  
  scrollView: {
    flex: 1,
  },
  
  // Custom Header
  customHeader: {
    paddingTop: 12,
    paddingHorizontal: 16,
    paddingBottom: 8,
    backgroundColor: theme.colors.background.dark,
  },
  
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 0,
  },
  
  backButtonText: {
    fontSize: 16,
    color: theme.colors.primary.main,
    fontWeight: '400',
    marginLeft: 2,
  },
  
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: theme.colors.background.dark,
  },
  
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: theme.colors.text.secondary,
  },
  
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: theme.colors.background.dark,
  },
  
  errorText: {
    fontSize: 18,
    color: theme.colors.text.secondary,
    marginVertical: 16,
    textAlign: 'center',
  },
  
  retryButton: {
    backgroundColor: theme.colors.primary.main,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  
  retryText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  
  // Player Header
  playerHeader: {
    flexDirection: 'row',
    backgroundColor: theme.colors.background.medium,
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border.primary,
  },
  
  playerImage: {
    width: 80,
    height: 112,
    borderRadius: 8,
    marginRight: 16,
  },
  
  playerInfo: {
    flex: 1,
    justifyContent: 'center',
  },
  
  playerName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: theme.colors.text.primary,
    marginBottom: 4,
  },
  
  playerTeam: {
    fontSize: 18,
    color: theme.colors.secondary.main,
    fontWeight: '600',
    marginBottom: 4,
  },
  
  playerPosition: {
    fontSize: 16,
    color: theme.colors.text.secondary,
    marginBottom: 8,
  },
  
  playerStatsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  
  playerStat: {
    fontSize: 14,
    color: theme.colors.text.secondary,
    marginRight: 8,
  },
  
  // Sections
  section: {
    backgroundColor: theme.colors.background.medium,
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: theme.colors.border.primary,
  },
  
  // First section (no top border for seamless flow from player header)
  firstSection: {
    backgroundColor: theme.colors.background.medium,
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderColor: theme.colors.border.primary,
  },
  
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: theme.colors.text.primary,
    marginBottom: 16,
  },
  
  // Prediction Card
  predictionCard: {
    backgroundColor: theme.colors.background.light,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: theme.colors.border.primary,
  },
  
  confidenceHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border.primary,
  },
  
  confidenceLabel: {
    fontSize: 16,
    color: theme.colors.text.secondary,
  },
  
  confidenceValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: theme.colors.primary.main,
  },
  
  predictionGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  
  predictionItem: {
    width: '48%',
    marginBottom: 12,
  },
  
  predictionLabel: {
    fontSize: 14,
    color: theme.colors.text.secondary,
    marginBottom: 4,
  },
  
  predictionValue: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.text.primary,
  },
  
  changeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  
  changeValue: {
    fontSize: 16,
    fontWeight: '600',
  },
  
  // Market Card
  marketCard: {
    backgroundColor: theme.colors.background.light,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: theme.colors.border.primary,
  },
  
  marketGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  
  marketItem: {
    width: '48%',
    marginBottom: 12,
  },
  
  marketLabel: {
    fontSize: 14,
    color: theme.colors.text.secondary,
    marginBottom: 4,
  },
  
  marketValue: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.text.primary,
  },
  
  profitValue: {
    fontSize: 16,
    fontWeight: '600',
  },
  
  // Voting Card
  votingCard: {
    backgroundColor: theme.colors.background.light,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: theme.colors.border.primary,
  },
  
  votingQuestion: {
    fontSize: 16,
    color: theme.colors.text.primary,
    textAlign: 'center',
    marginBottom: 16,
  },
  
  votingButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  
  voteButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 2,
    gap: 8,
  },
  
  upvoteButton: {
    borderColor: '#10b981',
    backgroundColor: 'transparent',
  },
  
  downvoteButton: {
    borderColor: '#ef4444',
    backgroundColor: 'transparent',
  },
  
  voteButtonActive: {
    backgroundColor: theme.colors.primary.main,
    borderColor: theme.colors.primary.main,
  },

  voteButtonDisabled: {
    opacity: 0.6,
  },
  
  voteText: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.colors.text.primary,
  },
  
  voteTextActive: {
    color: 'white',
  },
  
  // Comments Section
  commentsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  
  toggleCommentsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 16,
    paddingVertical: 8,
  },
  
  toggleCommentsText: {
    fontSize: 14,
    color: theme.colors.primary.main,
    fontWeight: '500',
  },
  
  commentsSection: {
    marginTop: 16,
  },
  
  addCommentContainer: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  
  commentInput: {
    flex: 1,
    backgroundColor: theme.colors.background.light,
    borderWidth: 1,
    borderColor: theme.colors.border.primary,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 14,
    color: theme.colors.text.primary,
    maxHeight: 100,
  },
  
  postButton: {
    backgroundColor: theme.colors.primary.main,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    justifyContent: 'center',
  },
  
  postButtonDisabled: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: theme.colors.text.secondary,
  },
  
  postButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
  
  postButtonTextDisabled: {
    color: theme.colors.text.secondary,
  },
  
  noCommentsContainer: {
    paddingVertical: 20,
    alignItems: 'center',
  },
  
  noCommentsText: {
    fontSize: 14,
    color: theme.colors.text.secondary,
    textAlign: 'center',
  },
  
  commentsList: {
    gap: 12,
  },
  
  commentItem: {
    backgroundColor: theme.colors.background.light,
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: theme.colors.border.primary,
  },
  
  commentUsername: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.colors.text.primary,
    marginBottom: 4,
  },

  commentUsernameContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 4,
  },

  officialCommentUsername: {
    color: theme.colors.primary.main,
    fontWeight: 'bold',
  },

  commentVerifiedIcon: {
    marginLeft: 2,
  },
  
  commentText: {
    fontSize: 14,
    color: theme.colors.text.primary,
    marginBottom: 4,
  },
  
  commentTime: {
    fontSize: 12,
    color: theme.colors.text.secondary,
  },

  commentHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },

  commentAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    marginRight: 12,
  },

  commentUserInfo: {
    flex: 1,
  },
  
  commentDeleteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-end',
    marginTop: 8,
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 6,
  },
  
  commentDeleteText: {
    marginLeft: 4,
    fontSize: 12,
    color: '#ef4444',
    fontWeight: '500',
  },

  commentActions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginTop: 8,
    gap: 12,
  },

  commentReplyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 6,
  },

  commentReplyText: {
    marginLeft: 4,
    fontSize: 12,
    color: theme.colors.text.secondary,
    fontWeight: '500',
  },

  replyInputContainer: {
    backgroundColor: theme.colors.background.light,
    borderRadius: 8,
    padding: 12,
    marginTop: 8,
    borderWidth: 1,
    borderColor: theme.colors.border.primary,
  },

  replyInput: {
    backgroundColor: theme.colors.background.dark,
    borderRadius: 6,
    padding: 12,
    color: theme.colors.text.primary,
    fontSize: 14,
    minHeight: 60,
    textAlignVertical: 'top',
    borderWidth: 1,
    borderColor: theme.colors.border.primary,
  },

  replyActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    marginTop: 8,
    gap: 8,
  },

  replyCancel: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 6,
  },

  replyCancelText: {
    fontSize: 14,
    color: theme.colors.text.secondary,
    fontWeight: '500',
  },

  replyPost: {
    backgroundColor: theme.colors.primary.main,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 6,
  },

  replyPostDisabled: {
    backgroundColor: theme.colors.text.secondary,
    opacity: 0.5,
  },

  replyPostText: {
    fontSize: 14,
    color: 'white',
    fontWeight: '600',
  },

  repliesContainer: {
    marginLeft: 16,
    marginTop: 8,
    borderLeftWidth: 2,
    borderLeftColor: theme.colors.border.primary,
    paddingLeft: 12,
  },

  repliesToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    gap: 6,
  },

  repliesToggleText: {
    fontSize: 13,
    color: theme.colors.primary.main,
    fontWeight: '500',
  },

  repliesList: {
    marginTop: 8,
  },

  replyItem: {
    backgroundColor: theme.colors.background.light,
    borderRadius: 6,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: theme.colors.border.primary,
  },

  replyAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: theme.colors.background.dark,
    marginRight: 8,
  },

  loginPromptContainer: {
    backgroundColor: theme.colors.background.light,
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: theme.colors.border.primary,
  },

  loginPromptText: {
    fontSize: 14,
    color: theme.colors.text.secondary,
    textAlign: 'center',
  },

  loadingCommentsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 20,
    gap: 8,
  },

  loadingCommentsText: {
    fontSize: 14,
    color: theme.colors.text.secondary,
  },
  
  bottomPadding: {
    height: 20,
  },
  
  // Attributes Section
  attributesGroup: {
    marginBottom: 24,
  },
  
  groupTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: theme.colors.secondary.main,
    marginBottom: 12,
    paddingBottom: 6,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border.primary,
  },
  
  attributeRow: {
    marginBottom: 12,
  },
  
  attributeHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  
  attributeLabel: {
    fontSize: 14,
    color: theme.colors.text.primary,
    fontWeight: '500',
  },
  
  attributeValues: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  
  currentValue: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.colors.text.primary,
  },
  
  deltaValue: {
    fontSize: 12,
    fontWeight: '600',
  },
  
  attributeBar: {
    height: 6,
    backgroundColor: theme.colors.background.light,
    borderRadius: 3,
    overflow: 'hidden',
  },
  
  barBackground: {
    flex: 1,
    position: 'relative',
    backgroundColor: theme.colors.background.light,
  },
  
  currentBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    bottom: 0,
    backgroundColor: theme.colors.primary.main,
    borderTopLeftRadius: 3,
    borderBottomLeftRadius: 3,
  },
  
  predictedBar: {
    position: 'absolute',
    top: 0,
    bottom: 0,
  },
  
  // Section Header and Toggle
  sectionHeader: {
    marginBottom: 16,
  },
  
  sectionToggle: {
    flexDirection: 'row',
    backgroundColor: theme.colors.background.light,
    borderRadius: 8,
    padding: 4,
  },
  
  toggleButton: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 6,
    alignItems: 'center',
  },
  
  toggleActive: {
    backgroundColor: theme.colors.primary.main,
  },
  
  toggleText: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.colors.text.secondary,
  },
  
  toggleTextActive: {
    color: 'white',
  },
  
  // Period Tabs
  periodTabs: {
    flexDirection: 'row',
    marginBottom: 16,
    gap: 8,
  },
  
  periodTab: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: theme.colors.background.light,
    borderRadius: 6,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: theme.colors.border.primary,
  },
  
  periodTabActive: {
    backgroundColor: theme.colors.primary.main,
    borderColor: theme.colors.primary.main,
  },
  
  periodTabText: {
    fontSize: 13,
    fontWeight: '500',
    color: theme.colors.text.secondary,
  },
  
  periodTabTextActive: {
    color: 'white',
  },
  
  // Stats Table
  statsContainer: {
    backgroundColor: theme.colors.background.light,
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: theme.colors.border.primary,
  },
  
  statsTable: {
    width: '100%',
  },
  
  statsHeaderRow: {
    flexDirection: 'row',
    borderBottomWidth: 2,
    borderBottomColor: theme.colors.border.primary,
    paddingBottom: 8,
    marginBottom: 8,
  },
  
  statsHeaderCell: {
    flex: 1,
    fontSize: 13,
    fontWeight: 'bold',
    color: theme.colors.text.primary,
    textAlign: 'center',
  },
  
  statsDataRow: {
    flexDirection: 'row',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border.primary,
  },
  
  statsCell: {
    flex: 1,
    fontSize: 13,
    color: theme.colors.text.primary,
    textAlign: 'center',
    fontWeight: '500',
  },
});