/**
 * CommunityScreen - Real-time Chat and Comments
 * 
 * LEARNING NOTES: Mobile Community Features
 * 
 * This screen demonstrates:
 * 1. Real-time chat with Firebase Firestore
 * 2. Multiple chat rooms with tab navigation
 * 3. Live player comments with card integration
 * 4. Trending player cards with voting data
 * 5. Message interactions (likes, replies)
 * 6. User search and profile integration
 * 7. Mobile-optimized UI patterns
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  FlatList,
  TextInput,
  TouchableOpacity,
  RefreshControl,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Image,
  Alert,
  ActivityIndicator,
  Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';

import { theme } from '../styles/theme';
import type { RootStackParamList } from '../navigation/AppNavigator';
import { useAuth, useAuthStatus } from '../contexts/AuthContext';
import { 
  collection,
  query,
  orderBy,
  onSnapshot,
  doc,
  getDoc,
  getDocs,
} from 'firebase/firestore';
import { db } from '../services/firebase';
import { apiClient, type TrendingCard, apiConfig } from '../services/api';

/**
 * LEARNING NOTE: Community Data Types
 * Comprehensive type system for real-time chat features
 */

// Tab definition for different chat rooms
interface CommunityTab {
  key: string;
  label: string;
  icon: string;
  collection: string; // Firestore collection name
}

// Message structure for display
interface Message {
  id: string;
  parentId: string | null;
  userId: string;
  username: string;
  profilePicUrl: string;
  text: string;
  timestamp: number;
  playerId?: string;
  playerName?: string;
  likes: number;
  liked: boolean;
}

// Threaded message structure for nested display
interface MessageTree extends Message {
  replies: MessageTree[];
  depth: number;
}

// Raw Firestore message data
interface MessageData {
  parentId: string | null;
  userId: string;
  text: string;
  timestamp: any; // Firestore timestamp
  playerId?: string;
  likedBy: string[];
}

// User profile data from Firestore
interface UserData {
  username: string;
  profilePic: string;
}

// Note: TrendingCard interface is now imported from api.ts

// Tab configuration matching web version
const COMMUNITY_TABS: CommunityTab[] = [
  { key: 'live', label: 'Live', icon: 'radio-outline', collection: 'comments' },
  { key: 'trending', label: 'Trending', icon: 'flame-outline', collection: 'trending' },
  { key: 'main', label: 'Main', icon: 'chatbubbles-outline', collection: 'chat_main' },
  { key: 'investing', label: 'Investing', icon: 'trending-up-outline', collection: 'chat_investing' },
  { key: 'flipping', label: 'Flipping', icon: 'sync-outline', collection: 'chat_flipping' },
  { key: 'stub', label: 'Stubs', icon: 'cash-outline', collection: 'chat_stub' },
];

// Tab title mapping for header display
const TAB_TITLES: Record<string, string> = {
  live: 'Live Comments',
  trending: 'Trending Players',
  main: 'Main Chat',
  investing: 'Investing Chat',
  flipping: 'Flipping Chat',
  stub: 'Stub Making Chat',
};

type CommunityScreenNavigationProp = StackNavigationProp<RootStackParamList>;

/**
 * Memoized MessageItem component for threaded replies
 * Prevents unnecessary re-renders and profile picture reloading
 */
const MessageItem = React.memo<{
  message: MessageTree;
  activeTab: string;
  cardThumbs: Record<string, string>;
  cardNames: Record<string, string>;
  onStartReply: (message: Message) => void;
  onToggleLike: (messageId: string, currentlyLiked: boolean) => void;
  onUserPress: (userId: string) => void;
  formatTime: (timestamp: number) => string;
  navigation: any;
}>(({ message, activeTab, cardThumbs, cardNames, onStartReply, onToggleLike, onUserPress, formatTime, navigation }) => {
  const [collapsed, setCollapsed] = useState(true);

  return (
    <View style={[
      styles.messageCard,
      message.depth > 0 && styles.replyMessage,
      { marginLeft: message.depth * 16 } // Indent replies
    ]}>
      {/* Thread indicator line removed - using replyMessage border instead */}
      
      <View style={styles.messageHeader}>
        <TouchableOpacity onPress={() => onUserPress(message.userId)}>
          <Image
            source={
              message.profilePicUrl
                ? { uri: message.profilePicUrl }
                : require('../../assets/default_profile.jpg')
            }
            style={styles.avatar}
            defaultSource={require('../../assets/default_profile.jpg')}
          />
        </TouchableOpacity>
        <View style={styles.messageInfo}>
          <TouchableOpacity onPress={() => onUserPress(message.userId)}>
            <Text style={styles.username}>{message.username}</Text>
          </TouchableOpacity>
          <Text style={styles.timestamp}>{formatTime(message.timestamp)}</Text>
        </View>
        {activeTab === 'live' && message.playerId && (
          <TouchableOpacity 
            style={styles.playerTag}
            onPress={() => navigation.navigate('PlayerDetail', {
              playerId: message.playerId,
              playerName: cardNames[message.playerId] || 'Unknown Player'
            })}
          >
            {cardThumbs[message.playerId] && (
              <Image
                source={{ uri: cardThumbs[message.playerId] }}
                style={styles.playerThumb}
              />
            )}
            <Text style={styles.playerName}>
              {cardNames[message.playerId] || 'Unknown Player'}
            </Text>
          </TouchableOpacity>
        )}
      </View>
      
      <Text style={styles.messageText}>{message.text}</Text>
      
      {activeTab !== 'live' && (
        <View style={styles.messageActions}>
          <TouchableOpacity 
            style={styles.likeButton}
            onPress={() => onToggleLike(message.id, message.liked)}
          >
            <Ionicons 
              name={message.liked ? 'heart' : 'heart-outline'} 
              size={16} 
              color={message.liked ? '#ef4444' : theme.colors.text.secondary} 
            />
            <Text style={[
              styles.likeCount,
              message.liked && styles.likeCountActive
            ]}>
              {message.likes}
            </Text>
          </TouchableOpacity>
          
          {/* Reply Button */}
          <TouchableOpacity 
            style={styles.replyButton}
            onPress={() => onStartReply(message)}
          >
            <Ionicons 
              name="chatbubble-outline" 
              size={16} 
              color={theme.colors.text.secondary} 
            />
            <Text style={styles.replyText}>Reply</Text>
          </TouchableOpacity>
        </View>
      )}
      
      {/* Show/Hide Replies Button */}
      {message.replies.length > 0 && (
        <TouchableOpacity 
          style={styles.collapseButton}
          onPress={() => setCollapsed(!collapsed)}
        >
          <Text style={styles.collapseButtonText}>
            {collapsed 
              ? `Show replies (${message.replies.length})` 
              : 'Hide replies'
            }
          </Text>
          <Ionicons 
            name={collapsed ? 'chevron-down' : 'chevron-up'} 
            size={16} 
            color={theme.colors.text.secondary} 
          />
        </TouchableOpacity>
      )}
      
      {/* Render nested replies - only when not collapsed */}
      {!collapsed && (
        <View style={styles.repliesContainer}>
          {message.replies.map((reply) => (
            <MessageItem 
              key={reply.id} 
              message={reply}
              activeTab={activeTab}
              cardThumbs={cardThumbs}
              cardNames={cardNames}
              onStartReply={onStartReply}
              onToggleLike={onToggleLike}
              onUserPress={onUserPress}
              formatTime={formatTime}
              navigation={navigation}
            />
          ))}
        </View>
      )}
    </View>
  );
});

export const CommunityScreen: React.FC = () => {
  // Navigation
  const navigation = useNavigation<CommunityScreenNavigationProp>();
  
  // Authentication state
  const { user, userProfile } = useAuth();
  const { isAuthenticated, isGuest } = useAuthStatus();

  // Navigation state
  const [activeTab, setActiveTab] = useState<string>('live');
  const [showUserSearch, setShowUserSearch] = useState(false);
  
  // Chat state
  const [messages, setMessages] = useState<Message[]>([]);
  const [messageTree, setMessageTree] = useState<MessageTree[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [newMessageText, setNewMessageText] = useState('');
  const [sendingMessage, setSendingMessage] = useState(false);
  
  // Reply state
  const [replyTarget, setReplyTarget] = useState<Message | null>(null);
  const [isReplying, setIsReplying] = useState(false);
  
  // Trending state
  const [trendingCards, setTrendingCards] = useState<TrendingCard[]>([]);
  const [trendingLoading, setTrendingLoading] = useState(false);
  
  // Player card data for live comments
  const [cardThumbs, setCardThumbs] = useState<Record<string, string>>({});
  const [cardNames, setCardNames] = useState<Record<string, string>>({});
  
  // User search state
  const [userSearch, setUserSearch] = useState('');
  const [userMatches, setUserMatches] = useState<{id: string, username: string, profilePic: string}[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  
  // References
  const flatListRef = useRef<FlatList>(null);
  const textInputRef = useRef<TextInput>(null);

  /**
   * Get display title for active tab
   */
  const getTabTitle = (tabKey: string): string => {
    return TAB_TITLES[tabKey] || 'Community';
  };

  /**
   * Build threaded message tree from flat message array
   */
  const buildMessageTree = (messages: Message[]): MessageTree[] => {
    const messageMap = new Map<string, MessageTree>();
    const rootMessages: MessageTree[] = [];

    // Convert messages to MessageTree and create lookup map
    messages.forEach(message => {
      const messageTree: MessageTree = {
        ...message,
        replies: [],
        depth: 0,
      };
      messageMap.set(message.id, messageTree);
    });

    // Build the tree structure
    messages.forEach(message => {
      const messageTree = messageMap.get(message.id)!;
      
      if (message.parentId) {
        // This is a reply, add to parent's replies
        const parent = messageMap.get(message.parentId);
        if (parent) {
          messageTree.depth = parent.depth + 1;
          parent.replies.push(messageTree);
          // Sort replies by timestamp (oldest first for natural conversation flow)
          parent.replies.sort((a, b) => a.timestamp - b.timestamp);
        } else {
          // Parent not found, treat as root message
          rootMessages.push(messageTree);
        }
      } else {
        // Root message
        rootMessages.push(messageTree);
      }
    });

    // Sort root messages by timestamp (newest first)
    return rootMessages.sort((a, b) => b.timestamp - a.timestamp);
  };

  /**
   * LEARNING NOTE: Real-time Message Listener
   * Firebase Firestore real-time updates for chat messages
   */
  useEffect(() => {
    if (activeTab === 'trending') {
      fetchTrendingCards();
      return;
    }

    setLoading(true);
    setMessages([]);
    setCardThumbs({});
    setCardNames({});

    const currentTab = COMMUNITY_TABS.find(tab => tab.key === activeTab);
    if (!currentTab) return;

    // Create Firestore query for real-time updates
    const messagesQuery = query(
      collection(db, currentTab.collection),
      orderBy('timestamp', 'desc')
    );

    // Subscribe to real-time updates
    const unsubscribe = onSnapshot(messagesQuery, async (snapshot) => {
      try {
        // Transform Firestore documents to message objects
        const rawMessages = snapshot.docs.map(doc => {
          const data = doc.data() as MessageData;
          return {
            id: doc.id,
            parentId: data.parentId || null,
            userId: data.userId,
            text: data.text,
            timestamp: data.timestamp?.toMillis ? data.timestamp.toMillis() : (data.timestamp || Date.now()),
            playerId: data.playerId,
            likes: (data.likedBy || []).length,
            liked: user ? (data.likedBy || []).includes(user.uid) : false,
          };
        });

        // Fetch user profiles for all message authors
        const userIds = Array.from(new Set(rawMessages.map(msg => msg.userId)));
        const userProfiles = await Promise.all(
          userIds.map(async (userId) => {
            const userDoc = await getDoc(doc(db, 'users', userId));
            if (userDoc.exists()) {
              const userData = userDoc.data() as UserData;
              return {
                userId,
                username: userData.username || 'Unknown',
                profilePicUrl: userData.profilePic || '',
              };
            }
            return {
              userId,
              username: 'Unknown',
              profilePicUrl: '',
            };
          })
        );

        // Create user lookup map
        const userMap = userProfiles.reduce((acc, profile) => {
          acc[profile.userId] = profile;
          return acc;
        }, {} as Record<string, { username: string; profilePicUrl: string }>);

        // Merge user data into messages
        const messagesWithUserData: Message[] = rawMessages.map(msg => ({
          ...msg,
          username: userMap[msg.userId]?.username || 'Unknown',
          profilePicUrl: userMap[msg.userId]?.profilePicUrl || '',
          playerName: '', // Will be populated for live comments
        }));

        // Fetch player card data for live comments
        if (activeTab === 'live') {
          const playerIds = Array.from(new Set(
            messagesWithUserData
              .map(msg => msg.playerId)
              .filter(Boolean) as string[]
          ));

          const thumbs: Record<string, string> = {};
          const names: Record<string, string> = {};

          await Promise.all(playerIds.map(async (playerId) => {
            const cardDoc = await getDoc(doc(db, 'cards', playerId));
            if (cardDoc.exists()) {
              const cardData = cardDoc.data();
              if (cardData.baked_img) thumbs[playerId] = cardData.baked_img;
              if (cardData.name) names[playerId] = cardData.name;
            }
          }));

          setCardThumbs(thumbs);
          setCardNames(names);
        }

        setMessages(messagesWithUserData);
        // Build threaded message tree
        const threadedMessages = buildMessageTree(messagesWithUserData);
        setMessageTree(threadedMessages);
        setLoading(false);
      } catch (error) {
        console.error('Error fetching messages:', error);
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, [activeTab, user]);

  /**
   * Fetch trending cards from API
   */
  const fetchTrendingCards = async () => {
    setTrendingLoading(true);
    try {
      // Fetch real trending data from API (same endpoint as website)
      const trendingData = await apiClient.getTrendingCards();
      setTrendingCards(trendingData);
    } catch (error) {
      console.error('Error fetching trending cards:', error);
      Alert.alert(
        'Error Loading Trending Players', 
        'Failed to load trending players. Please check your connection and try again.'
      );
      setTrendingCards([]);
    } finally {
      setTrendingLoading(false);
    }
  };

  /**
   * Handle tab change
   */
  const handleTabChange = (tabKey: string) => {
    setActiveTab(tabKey);
    setNewMessageText('');
    // Cancel any active reply when changing tabs
    setReplyTarget(null);
    setIsReplying(false);
  };

  /**
   * Handle search tab press
   */
  const handleSearchPress = () => {
    setShowUserSearch(true);
  };

  /**
   * Search for users
   */
  const searchUsers = async (searchTerm: string) => {
    if (!searchTerm.trim()) {
      setUserMatches([]);
      return;
    }

    setSearchLoading(true);
    try {
      // Query users collection for username matches
      const usersQuery = query(
        collection(db, 'users'),
        orderBy('username'),
        // Note: Firestore doesn't support contains queries, so we'll implement basic prefix matching
      );
      
      const snapshot = await getDocs(usersQuery);
      const matches = snapshot.docs
        .map(doc => ({
          id: doc.id,
          username: doc.data().username || '',
          profilePic: doc.data().profilePic || ''
        }))
        .filter(user => 
          user.username.toLowerCase().includes(searchTerm.toLowerCase())
        )
        .slice(0, 10); // Limit to 10 results
        
      setUserMatches(matches);
    } catch (error) {
      console.error('Error searching users:', error);
      setUserMatches([]);
    } finally {
      setSearchLoading(false);
    }
  };

  /**
   * Handle user search input change
   */
  const handleUserSearchChange = (text: string) => {
    setUserSearch(text);
    searchUsers(text);
  };

  /**
   * Handle user selection from search - navigate to user profile
   */
  const handleUserSelect = (user: {id: string, username: string, profilePic: string}) => {
    // Navigate to user profile screen
    navigation.navigate('UserProfile', { userId: user.id });
    closeUserSearch();
  };

  /**
   * Handle username press in messages - navigate to user profile
   */
  const handleUserPress = useCallback((userId: string) => {
    navigation.navigate('UserProfile', { userId });
  }, [navigation]);

  /**
   * Close user search
   */
  const closeUserSearch = () => {
    setShowUserSearch(false);
    setUserSearch('');
    setUserMatches([]);
    setSearchLoading(false);
  };

  /**
   * Start reply to a message
   */
  const handleStartReply = (message: Message) => {
    setReplyTarget(message);
    setIsReplying(true);
    textInputRef.current?.focus();
  };

  /**
   * Cancel reply
   */
  const handleCancelReply = () => {
    setReplyTarget(null);
    setIsReplying(false);
    setNewMessageText('');
  };

  /**
   * Send new message (supports replies)
   */
  const handleSendMessage = async () => {
    if (!user || !newMessageText.trim() || sendingMessage) return;

    const currentTab = COMMUNITY_TABS.find(tab => tab.key === activeTab);
    if (!currentTab || activeTab === 'trending' || activeTab === 'live') return;

    setSendingMessage(true);

    try {
      // Get Firebase ID token for authentication
      const token = await user.getIdToken();
      
      // Map tab keys to API endpoints (same as website)
      const room = activeTab === 'investing' ? 'investing' : activeTab;
      const endpoint = `${apiConfig.baseURL}/api/chat/${room}`;
      
      // Prepare message payload
      const payload = {
        text: newMessageText.trim(),
        userId: user.uid,
        ...(isReplying && replyTarget ? { parentId: replyTarget.id } : {})
      };

      // Send message via API
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to send message');
      }

      // Clear form on success
      setNewMessageText('');
      setReplyTarget(null);
      setIsReplying(false);
      textInputRef.current?.blur();
    } catch (error) {
      console.error('Error sending message:', error);
      Alert.alert('Error', 'Failed to send message. Please try again.');
    } finally {
      setSendingMessage(false);
    }
  };

  /**
   * Toggle like on message using API endpoint (matches web implementation)
   */
  const handleToggleLike = async (messageId: string, currentlyLiked: boolean) => {
    if (!user) {
      Alert.alert('Login Required', 'Please sign in to like messages.');
      return;
    }

    const currentTab = COMMUNITY_TABS.find(tab => tab.key === activeTab);
    if (!currentTab) return;

    try {
      const token = await user.getIdToken();
      // Convert collection name to room name for API endpoint
      const room = currentTab.collection.replace('chat_', '');
      
      const response = await fetch(`${apiConfig.baseURL}/api/chat/${room}/likes`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ messageId })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `HTTP ${response.status}`);
      }

      const { toggled } = await response.json();
      
      // Update local state based on server response
      setMessages(prevMessages =>
        prevMessages.map(msg =>
          msg.id === messageId
            ? {
                ...msg,
                liked: toggled,
                likes: toggled ? msg.likes + 1 : msg.likes - 1,
              }
            : msg
        )
      );
    } catch (error) {
      console.error('Error toggling like:', error);
      Alert.alert('Error', 'Failed to update like. Please try again.');
    }
  };

  /**
   * Handle refresh
   */
  const onRefresh = async () => {
    setRefreshing(true);
    if (activeTab === 'trending') {
      await fetchTrendingCards();
    }
    // Real-time listeners will automatically update other tabs
    setTimeout(() => setRefreshing(false), 1000);
  };

  /**
   * Format relative time (memoized for performance)
   */
  const formatTime = useCallback((timestamp: number): string => {
    const diff = Date.now() - timestamp;
    if (diff < 60000) return 'just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    return `${Math.floor(diff / 86400000)}d ago`;
  }, []);

  /**
   * Memoized reply handler to prevent unnecessary re-renders
   */
  const handleStartReplyMemo = useCallback((message: Message) => {
    handleStartReply(message);
  }, []);

  /**
   * Memoized like handler to prevent unnecessary re-renders
   */
  const handleToggleLikeMemo = useCallback((messageId: string, currentlyLiked: boolean) => {
    handleToggleLike(messageId, currentlyLiked);
  }, [user, activeTab]);


  /**
   * Render message item (wrapper for FlatList compatibility)
   */
  const renderMessage = ({ item }: { item: MessageTree }) => (
    <MessageItem 
      message={item}
      activeTab={activeTab}
      cardThumbs={cardThumbs}
      cardNames={cardNames}
      onStartReply={handleStartReplyMemo}
      onToggleLike={handleToggleLikeMemo}
      onUserPress={handleUserPress}
      formatTime={formatTime}
      navigation={navigation}
    />
  );

  /**
   * Render trending card
   */
  const renderTrendingCard = ({ item, index }: { item: TrendingCard, index: number }) => (
    <TouchableOpacity 
      style={styles.trendingCard}
      onPress={() => navigation.navigate('PlayerDetail', {
        playerId: item.id,
        playerName: item.name
      })}
    >
      {/* Trending Rank Badge */}
      <View style={styles.trendingRank}>
        <Text style={styles.trendingRankText}>#{index + 1}</Text>
      </View>
      
      <Image source={{ uri: item.baked_img }} style={styles.trendingImage} />
      <Text style={styles.trendingName}>{item.name}</Text>
      <Text style={styles.trendingMeta}>
        {item.team_short_name} • {item.display_position} • {item.ovr} OVR
      </Text>
      <View style={styles.trendingVotes}>
        <Text style={styles.upvotes}>↑ {item.upvotes}</Text>
        <Text style={styles.downvotes}>↓ {item.downvotes}</Text>
        <Text style={styles.netVotes}>Net: {item.netVotes}</Text>
      </View>
    </TouchableOpacity>
  );

  /**
   * Render main content based on active tab
   */
  const renderContent = () => {
    if (activeTab === 'trending') {
      return (
        <FlatList
          key="trending-grid" // Add key to force remount when switching tabs
          data={trendingCards}
          renderItem={renderTrendingCard}
          keyExtractor={(item) => item.id}
          numColumns={2}
          contentContainerStyle={styles.trendingGrid}
          refreshControl={
            <RefreshControl refreshing={trendingLoading} onRefresh={onRefresh} />
          }
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Ionicons name="flame-outline" size={48} color={theme.colors.text.secondary} />
              <Text style={styles.emptyTitle}>No trending players yet</Text>
              <Text style={styles.emptySubtitle}>Players with the most votes will appear here!</Text>
            </View>
          }
        />
      );
    }

    return (
      <FlatList
        key={`messages-${activeTab}`} // Add key to force remount when switching tabs
        ref={flatListRef}
        data={messageTree}
        renderItem={renderMessage}
        keyExtractor={(item) => item.id}
        style={styles.messagesList}
        contentContainerStyle={styles.messagesContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        ListEmptyComponent={
          loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={theme.colors.primary.main} />
              <Text style={styles.loadingText}>Loading messages...</Text>
            </View>
          ) : (
            <View style={styles.emptyState}>
              <Ionicons 
                name={activeTab === 'live' ? 'radio-outline' : 'chatbubbles-outline'} 
                size={48} 
                color={theme.colors.text.secondary} 
              />
              <Text style={styles.emptyTitle}>
                {activeTab === 'live' ? 'No player comments yet' : 'No messages yet'}
              </Text>
              <Text style={styles.emptySubtitle}>
                {activeTab === 'live' 
                  ? 'Player comments will appear here when users discuss specific players'
                  : isGuest ? 'Sign in to join the conversation!' : 'Be the first to start the conversation!'
                }
              </Text>
            </View>
          )
        }
        showsVerticalScrollIndicator={false}
      />
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Community</Text>
        <Text style={styles.subtitle}>{getTabTitle(activeTab)}</Text>
      </View>

      {/* Tab Row */}
      <View style={styles.tabRow}>
        {/* Search Tab */}
        <TouchableOpacity style={styles.searchTab} onPress={handleSearchPress}>
          <Ionicons name="search" size={20} color={theme.colors.text.primary} />
        </TouchableOpacity>
        
        {/* Chat Room Tabs */}
        {COMMUNITY_TABS.map((tab) => (
          <TouchableOpacity
            key={tab.key}
            style={[
              styles.tab,
              activeTab === tab.key && styles.activeTab
            ]}
            onPress={() => handleTabChange(tab.key)}
          >
            <Ionicons 
              name={tab.icon as any} 
              size={20} 
              color={activeTab === tab.key ? 'white' : theme.colors.text.secondary} 
            />
          </TouchableOpacity>
        ))}
      </View>

      {/* User Search Modal */}
      {showUserSearch && (
        <View style={styles.searchModal}>
          <View style={styles.searchModalContent}>
            <View style={styles.searchModalHeader}>
              <Text style={styles.searchModalTitle}>Search Users</Text>
              <TouchableOpacity onPress={closeUserSearch}>
                <Ionicons name="close" size={24} color={theme.colors.text.primary} />
              </TouchableOpacity>
            </View>
            <TextInput
              style={styles.searchInput}
              placeholder="Search for users..."
              value={userSearch}
              onChangeText={handleUserSearchChange}
              autoFocus
            />
            <ScrollView style={styles.searchResults}>
              {searchLoading ? (
                <View style={styles.searchLoadingContainer}>
                  <ActivityIndicator size="small" color={theme.colors.primary.main} />
                  <Text style={styles.searchLoadingText}>Searching...</Text>
                </View>
              ) : userMatches.length > 0 ? (
                userMatches.map((user) => (
                  <TouchableOpacity
                    key={user.id}
                    style={styles.searchResultItem}
                    onPress={() => handleUserSelect(user)}
                  >
                    <Image
                      source={
                        user.profilePic
                          ? { uri: user.profilePic }
                          : require('../../assets/default_profile.jpg')
                      }
                      style={styles.searchResultAvatar}
                      defaultSource={require('../../assets/default_profile.jpg')}
                    />
                    <Text style={styles.searchResultUsername}>{user.username}</Text>
                  </TouchableOpacity>
                ))
              ) : userSearch.length > 0 ? (
                <Text style={styles.searchResultsText}>No users found</Text>
              ) : (
                <Text style={styles.searchResultsText}>Type to search for users</Text>
              )}
            </ScrollView>
          </View>
        </View>
      )}

      <KeyboardAvoidingView 
        style={styles.mainContainer}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
      >
        {/* Content Area */}
        {renderContent()}

        {/* Message Input - only show for chat rooms */}
        {activeTab !== 'trending' && activeTab !== 'live' && (
          <View style={styles.inputContainer}>
            {isGuest ? (
              <View style={styles.loginPrompt}>
                <Text style={styles.loginPromptText}>Sign in to join the chat</Text>
              </View>
            ) : (
              <>
                {/* Reply Indicator */}
                {isReplying && replyTarget && (
                  <View style={styles.replyIndicator}>
                    <Text style={styles.replyIndicatorText}>
                      Replying to @{replyTarget.username}
                    </Text>
                    <TouchableOpacity onPress={handleCancelReply}>
                      <Ionicons name="close" size={20} color={theme.colors.text.secondary} />
                    </TouchableOpacity>
                  </View>
                )}
                
                <View style={styles.inputRow}>
                  {/* User Profile Picture */}
                  <Image
                    source={
                      user?.photoURL
                        ? { uri: user.photoURL }
                        : require('../../assets/default_profile.jpg')
                    }
                    style={styles.inputAvatar}
                    defaultSource={require('../../assets/default_profile.jpg')}
                  />
                  <TextInput
                    ref={textInputRef}
                    style={styles.messageInput}
                    placeholder={
                      isReplying 
                        ? `Reply to ${replyTarget?.username}...`
                        : `Message ${COMMUNITY_TABS.find(t => t.key === activeTab)?.label}...`
                    }
                    value={newMessageText}
                    onChangeText={setNewMessageText}
                    multiline
                    maxLength={500}
                    editable={!sendingMessage}
                  />
                  <TouchableOpacity 
                    style={[
                      styles.sendButton,
                      (!newMessageText.trim() || sendingMessage) && styles.sendButtonDisabled
                    ]}
                    onPress={handleSendMessage}
                    disabled={!newMessageText.trim() || sendingMessage}
                  >
                    {sendingMessage ? (
                      <ActivityIndicator size="small" color="white" />
                    ) : (
                      <Ionicons name="send" size={20} color="white" />
                    )}
                  </TouchableOpacity>
                </View>
              </>
            )}
          </View>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

/**
 * LEARNING NOTES: Mobile Community Design
 * 
 * Key mobile adaptations from web version:
 * 1. Horizontal scrollable tabs instead of sidebar
 * 2. Simplified message threading for touch interface
 * 3. Pull-to-refresh pattern for mobile users
 * 4. Keyboard-aware input handling
 * 5. Touch-optimized message cards and interactions
 * 6. Proper loading states and empty states
 * 7. Performance optimized FlatList rendering
 */
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background.dark,
  },
  
  header: {
    backgroundColor: theme.colors.background.medium,
    paddingVertical: 12,
    paddingHorizontal: 20,
    alignItems: 'center',
  },
  
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: theme.colors.text.primary,
    textAlign: 'center',
  },
  
  subtitle: {
    fontSize: 16,
    color: theme.colors.text.secondary,
    textAlign: 'center',
    marginTop: 2,
  },

  // Tab Row
  tabRow: {
    backgroundColor: theme.colors.background.medium,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border.primary,
    flexDirection: 'row',
    paddingLeft: 12,
    paddingRight: 6,
    paddingVertical: 8,
    alignItems: 'center',
  },

  searchTab: {
    backgroundColor: theme.colors.background.dark,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 20,
    marginRight: 8,
    width: 48,
    height: 48,
    borderWidth: 1,
    borderColor: theme.colors.border.secondary,
  },

  tab: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.background.dark,
    padding: 12,
    borderRadius: 20,
    marginRight: 6,
    width: 48,
    height: 48,
    borderWidth: 1,
    borderColor: theme.colors.border.secondary,
  },

  activeTab: {
    backgroundColor: theme.colors.primary.main,
    borderColor: theme.colors.primary.main,
  },


  // User Search Modal
  searchModal: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    zIndex: 2000,
    justifyContent: 'center',
    alignItems: 'center',
  },

  searchModalContent: {
    backgroundColor: theme.colors.background.medium,
    width: '90%',
    maxHeight: '80%',
    borderRadius: 12,
    padding: 20,
  },

  searchModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },

  searchModalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: theme.colors.text.primary,
  },

  searchInput: {
    backgroundColor: theme.colors.background.dark,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
    fontSize: 16,
    color: theme.colors.text.primary,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: theme.colors.border.secondary,
  },

  searchResults: {
    maxHeight: 200,
  },

  searchResultsText: {
    fontSize: 14,
    color: theme.colors.text.secondary,
    textAlign: 'center',
    padding: 20,
  },

  searchLoadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },

  searchLoadingText: {
    marginLeft: 8,
    fontSize: 14,
    color: theme.colors.text.secondary,
  },

  searchResultItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border.secondary,
  },

  searchResultAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    marginRight: 12,
  },

  searchResultUsername: {
    fontSize: 16,
    color: theme.colors.text.primary,
    fontWeight: '500',
  },

  // Main Content
  mainContainer: {
    flex: 1,
  },

  messagesList: {
    flex: 1,
  },

  messagesContent: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 16,
  },

  // Messages
  messageCard: {
    backgroundColor: theme.colors.surface.elevated,
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },

  messageHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },

  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    marginRight: 12,
  },

  messageInfo: {
    flex: 1,
  },

  username: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.colors.text.primary,
  },

  timestamp: {
    fontSize: 12,
    color: theme.colors.text.secondary,
    marginTop: 2,
  },

  playerTag: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.primary.main,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },

  playerThumb: {
    width: 20,
    height: 28,
    borderRadius: 4,
    marginRight: 4,
  },

  playerName: {
    fontSize: 10,
    color: 'white',
    fontWeight: '500',
  },

  messageText: {
    fontSize: 16,
    color: theme.colors.text.primary,
    lineHeight: 22,
    marginBottom: 8,
  },

  messageActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },

  likeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 12,
  },

  likeCount: {
    marginLeft: 4,
    fontSize: 12,
    color: theme.colors.text.secondary,
    fontWeight: '500',
  },

  likeCountActive: {
    color: '#ef4444',
  },

  replyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 12,
  },

  replyText: {
    marginLeft: 4,
    fontSize: 12,
    color: theme.colors.text.secondary,
    fontWeight: '500',
  },

  replyMessage: {
    backgroundColor: theme.colors.background.dark,
    borderLeftWidth: 2,
    borderLeftColor: theme.colors.primary.main,
  },

  threadLine: {
    position: 'absolute',
    left: -2,
    top: 0,
    bottom: 0,
    width: 2,
    backgroundColor: theme.colors.primary.main,
    opacity: 0.3,
  },

  collapseButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginTop: 8,
    backgroundColor: theme.colors.background.dark,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: theme.colors.border.secondary,
  },

  collapseButtonText: {
    fontSize: 12,
    color: theme.colors.text.secondary,
    fontWeight: '500',
    marginRight: 4,
  },

  repliesContainer: {
    marginTop: 12,
    backgroundColor: theme.colors.surface.elevated,
    borderRadius: 8,
    padding: 8,
  },

  replyIndicator: {
    backgroundColor: theme.colors.background.dark,
    paddingHorizontal: 12,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: theme.colors.border.primary,
  },

  replyIndicatorText: {
    fontSize: 14,
    color: theme.colors.text.secondary,
    fontStyle: 'italic',
  },

  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },

  // Trending
  trendingGrid: {
    paddingHorizontal: 16,
    paddingTop: 0,
    paddingBottom: 16,
  },

  trendingCard: {
    flex: 1,
    backgroundColor: theme.colors.surface.elevated,
    margin: 6,
    padding: 12,
    borderRadius: 12,
    alignItems: 'center',
    position: 'relative',
  },

  trendingRank: {
    position: 'absolute',
    top: 8,
    left: 8,
    backgroundColor: theme.colors.primary.main,
    borderRadius: 12,
    minWidth: 24,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
  },

  trendingRankText: {
    color: 'white',
    fontSize: 10,
    fontWeight: '700',
  },

  trendingImage: {
    width: 64,
    height: 88,
    borderRadius: 8,
    marginBottom: 8,
  },

  trendingName: {
    fontSize: 12,
    fontWeight: '600',
    color: theme.colors.text.primary,
    textAlign: 'center',
    marginBottom: 4,
  },

  trendingMeta: {
    fontSize: 10,
    color: theme.colors.text.secondary,
    textAlign: 'center',
    marginBottom: 8,
  },

  trendingVotes: {
    flexDirection: 'row',
    gap: 8,
  },

  upvotes: {
    fontSize: 10,
    color: '#10b981',
    fontWeight: '500',
  },

  downvotes: {
    fontSize: 10,
    color: '#ef4444',
    fontWeight: '500',
  },

  netVotes: {
    fontSize: 10,
    color: theme.colors.primary.main,
    fontWeight: '600',
  },

  // Input
  inputContainer: {
    backgroundColor: theme.colors.background.medium,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border.primary,
  },

  inputAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    marginRight: 12,
  },

  messageInput: {
    flex: 1,
    backgroundColor: theme.colors.background.dark,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 20,
    fontSize: 16,
    color: theme.colors.text.primary,
    maxHeight: 100,
    marginRight: 12,
    borderWidth: 1,
    borderColor: theme.colors.border.secondary,
  },

  sendButton: {
    backgroundColor: theme.colors.primary.main,
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },

  sendButtonDisabled: {
    backgroundColor: theme.colors.surface.elevated,
  },

  loginPrompt: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 16,
  },

  loginPromptText: {
    fontSize: 16,
    color: theme.colors.text.secondary,
  },

  // States
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },

  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: theme.colors.text.secondary,
  },

  emptyState: {
    alignItems: 'center',
    paddingVertical: 40,
  },

  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: theme.colors.text.primary,
    marginTop: 16,
    marginBottom: 8,
  },

  emptySubtitle: {
    fontSize: 16,
    color: theme.colors.text.secondary,
    textAlign: 'center',
    lineHeight: 22,
  },
});