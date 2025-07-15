/**
 * CommunityScreen - Chat and Comments
 * 
 * LEARNING NOTES: Social Mobile Interfaces
 * 
 * This screen demonstrates:
 * 1. Chat/messaging UI patterns
 * 2. Real-time data with timestamps
 * 3. User-generated content display
 * 4. Interactive elements (likes, replies)
 * 5. Input handling for new messages
 */

import React, { useState } from 'react';
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
} from 'react-native';

/**
 * LEARNING NOTE: Social Data Types
 * Chat and comment systems need structured data for proper display
 */
interface ChatMessage {
  id: string;
  userName: string;
  message: string;
  timestamp: string;
  likes: number;
  isLiked: boolean;
  playerTag?: string; // Optional player reference
}

export const CommunityScreen: React.FC = () => {
  // Sample chat data - will be replaced with real-time Firebase data
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: '1',
      userName: 'BaseballFan23',
      message: 'Anyone else think Judge is due for a massive rating boost? His stats this season are insane! 🔥',
      timestamp: '2 hours ago',
      likes: 12,
      isLiked: false,
      playerTag: 'Aaron Judge',
    },
    {
      id: '2',
      userName: 'DiamondPro',
      message: 'The AI predictions for Tatis Jr. look really promising. Might be a good investment opportunity.',
      timestamp: '3 hours ago',
      likes: 8,
      isLiked: true,
      playerTag: 'Fernando Tatis Jr.',
    },
    {
      id: '3',
      userName: 'MLBAnalyst',
      message: 'Just saw the latest confidence scores. 87% accuracy rate is pretty impressive for AI predictions.',
      timestamp: '4 hours ago',
      likes: 15,
      isLiked: false,
    },
    {
      id: '4',
      userName: 'CardCollector',
      message: 'Which players are you all watching for the next update cycle? I\'m keeping an eye on the rookie ratings.',
      timestamp: '5 hours ago',
      likes: 6,
      isLiked: false,
    },
    {
      id: '5',
      userName: 'StatHead',
      message: 'The portfolio tracker is so helpful! Up 15% this month thanks to the AI recommendations 📈',
      timestamp: '6 hours ago',
      likes: 22,
      isLiked: true,
    },
  ]);

  // UI state
  const [newMessage, setNewMessage] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  /**
   * LEARNING NOTE: Real-time Data Refresh
   * Chat interfaces need frequent updates for new messages
   */
  const onRefresh = async () => {
    setRefreshing(true);
    // TODO: Fetch latest messages from Firebase
    setTimeout(() => {
      setRefreshing(false);
    }, 1000);
  };

  /**
   * LEARNING NOTE: Message Interactions
   * Social features need interactive elements like likes
   */
  const handleLike = (messageId: string) => {
    setMessages(prevMessages =>
      prevMessages.map(msg =>
        msg.id === messageId
          ? {
              ...msg,
              isLiked: !msg.isLiked,
              likes: msg.isLiked ? msg.likes - 1 : msg.likes + 1,
            }
          : msg
      )
    );
  };

  /**
   * LEARNING NOTE: Message Sending
   * Chat interfaces need input handling and validation
   */
  const handleSendMessage = () => {
    if (newMessage.trim().length === 0) return;

    const message: ChatMessage = {
      id: Date.now().toString(),
      userName: 'You', // TODO: Get from user auth
      message: newMessage.trim(),
      timestamp: 'Just now',
      likes: 0,
      isLiked: false,
    };

    setMessages(prevMessages => [message, ...prevMessages]);
    setNewMessage('');
  };

  /**
   * LEARNING NOTE: FlatList Item Rendering
   * Chat messages need consistent, performant rendering
   */
  const renderMessage = ({ item }: { item: ChatMessage }) => (
    <View style={styles.messageCard}>
      <View style={styles.messageHeader}>
        <Text style={styles.userName}>{item.userName}</Text>
        <Text style={styles.timestamp}>{item.timestamp}</Text>
      </View>
      
      {item.playerTag && (
        <View style={styles.playerTag}>
          <Text style={styles.playerTagText}>#{item.playerTag}</Text>
        </View>
      )}
      
      <Text style={styles.messageText}>{item.message}</Text>
      
      <View style={styles.messageFooter}>
        <TouchableOpacity 
          style={styles.likeButton}
          onPress={() => handleLike(item.id)}
        >
          <Text style={[
            styles.likeText,
            item.isLiked && styles.likeTextActive
          ]}>
            {item.isLiked ? '❤️' : '🤍'} {item.likes}
          </Text>
        </TouchableOpacity>
        
        <TouchableOpacity style={styles.replyButton}>
          <Text style={styles.replyText}>Reply</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Community</Text>
        <Text style={styles.subtitle}>Chat with other players</Text>
      </View>

      <KeyboardAvoidingView 
        style={styles.mainContainer}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
      >
        {/* Messages List */}
        <FlatList
          data={messages}
          renderItem={renderMessage}
          keyExtractor={(item) => item.id}
          style={styles.messagesList}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.messagesContent}
          inverted // Show newest messages at bottom like typical chat
        />

        {/* Message Input */}
        <View style={styles.inputContainer}>
          <TextInput
            style={styles.messageInput}
            placeholder="Share your thoughts..."
            value={newMessage}
            onChangeText={setNewMessage}
            multiline
            maxLength={280}
            autoCapitalize="sentences"
            blurOnSubmit={false}
          />
          <TouchableOpacity 
            style={[
              styles.sendButton,
              newMessage.trim().length === 0 && styles.sendButtonDisabled
            ]}
            onPress={handleSendMessage}
            disabled={newMessage.trim().length === 0}
          >
            <Text style={[
              styles.sendButtonText,
              newMessage.trim().length === 0 && styles.sendButtonTextDisabled
            ]}>
              Send
            </Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

/**
 * LEARNING NOTES: Chat UI Design Principles
 * 
 * Key considerations for social mobile interfaces:
 * 1. Clear visual hierarchy - User names, timestamps, content
 * 2. Interactive elements - Likes, replies, shares
 * 3. Keyboard handling - Proper spacing and scrolling
 * 4. Real-time updates - Auto-refresh and push notifications
 * 5. Performance - Efficient list rendering for many messages
 * 6. Accessibility - Screen reader support for social content
 * 7. Input validation - Character limits and content filtering
 */
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  
  header: {
    backgroundColor: 'white',
    paddingVertical: 20,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#1a365d',
    textAlign: 'center',
  },
  
  subtitle: {
    fontSize: 16,
    color: '#64748b',
    textAlign: 'center',
    marginTop: 4,
  },
  
  mainContainer: {
    flex: 1,
  },
  
  messagesList: {
    flex: 1,
  },
  
  messagesContent: {
    padding: 16,
  },
  
  messageCard: {
    backgroundColor: 'white',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  
  messageHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  
  userName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1a202c',
  },
  
  timestamp: {
    fontSize: 12,
    color: '#64748b',
  },
  
  playerTag: {
    alignSelf: 'flex-start',
    backgroundColor: '#dbeafe',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    marginBottom: 8,
  },
  
  playerTagText: {
    fontSize: 12,
    color: '#1d4ed8',
    fontWeight: '500',
  },
  
  messageText: {
    fontSize: 16,
    color: '#374151',
    lineHeight: 22,
    marginBottom: 12,
  },
  
  messageFooter: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  
  likeButton: {
    marginRight: 16,
  },
  
  likeText: {
    fontSize: 14,
    color: '#64748b',
    fontWeight: '500',
  },
  
  likeTextActive: {
    color: '#dc2626',
  },
  
  replyButton: {
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  
  replyText: {
    fontSize: 14,
    color: '#3b82f6',
    fontWeight: '500',
  },
  
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    backgroundColor: 'white',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
  },
  
  messageInput: {
    flex: 1,
    backgroundColor: '#f1f5f9',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 20,
    fontSize: 16,
    color: '#374151',
    maxHeight: 100,
    marginRight: 12,
  },
  
  sendButton: {
    backgroundColor: '#3b82f6',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 20,
  },
  
  sendButtonDisabled: {
    backgroundColor: '#cbd5e1',
  },
  
  sendButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  
  sendButtonTextDisabled: {
    color: '#94a3b8',
  },
});