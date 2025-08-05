/**
 * UserProfileScreen - View Other Users' Public Profiles
 * 
 * LEARNING NOTES: User Profile Viewing
 * 
 * This screen demonstrates:
 * 1. Public user profile information display
 * 2. Investment portfolio viewing (if public)
 * 3. User statistics and activity summary
 * 4. Read-only profile interface
 * 5. Navigation from search results
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Image,
  Alert,
} from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { Ionicons } from '@expo/vector-icons';

import { theme } from '../styles/theme';
import { RootStackParamList } from '../navigation/AppNavigator';
import { apiClient, Investment, apiConfig } from '../services/api';
import { isOfficialAccount } from '../utils/accounts';
import { doc, getDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../services/firebase';

/**
 * LEARNING NOTE: Public User Profile Data
 * Structure for displaying other users' public information
 */
interface PublicUserProfile {
  username: string;
  profilePic: string;
  createdAt?: any; // Firestore timestamp
  investmentsPublic?: boolean;
}

interface UserStats {
  totalInvestments: number;
  totalInvested: number;
  totalMessages: number;
}

type UserProfileScreenNavigationProp = StackNavigationProp<RootStackParamList>;
type UserProfileScreenRouteProp = RouteProp<RootStackParamList, 'UserProfile'>;

export const UserProfileScreen: React.FC = () => {
  const navigation = useNavigation<UserProfileScreenNavigationProp>();
  const route = useRoute<UserProfileScreenRouteProp>();
  const { userId } = route.params;
  
  // Profile state
  const [profile, setProfile] = useState<PublicUserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<UserStats>({
    totalInvestments: 0,
    totalInvested: 0,
    totalMessages: 0,
  });
  const [investments, setInvestments] = useState<Investment[]>([]);
  const [statsLoading, setStatsLoading] = useState(false);

  /**
   * Load user profile data from Firestore
   */
  const loadUserProfile = async () => {
    try {
      const userDoc = await getDoc(doc(db, 'users', userId));
      
      if (!userDoc.exists()) {
        Alert.alert('Error', 'User profile not found.');
        navigation.goBack();
        return;
      }

      const userData = userDoc.data() as PublicUserProfile;
      const userProfile = {
        username: userData.username || 'Unknown User',
        profilePic: userData.profilePic || '',
        createdAt: userData.createdAt,
        investmentsPublic: userData.investmentsPublic || false,
      };
      
      setProfile(userProfile);

      // Load user statistics with the profile data
      await loadUserStats(userProfile);
    } catch (error) {
      console.error('Error loading user profile:', error);
      Alert.alert('Error', 'Failed to load user profile.');
    } finally {
      setLoading(false);
    }
  };

  /**
   * Load user statistics including investments and messages
   */
  const loadUserStats = async (userProfile?: PublicUserProfile) => {
    setStatsLoading(true);
    try {
      // Load investment statistics if public
      let totalInvestments = 0;
      let totalInvested = 0;
      
      const profileToCheck = userProfile || profile;
      if (profileToCheck?.investmentsPublic) {
        const userInvestments = await apiClient.getPublicPortfolio(userId);
        setInvestments(userInvestments);
        
        totalInvestments = userInvestments.length;
        totalInvested = userInvestments.reduce((sum, inv) => {
          return sum + (inv.quantity * inv.avgBuyPrice);
        }, 0);
      }

      // Calculate total messages across all chat rooms and live comments
      let totalMessages = 0;
      try {
        // Count chat room messages via API
        const chatRooms = ['main', 'investing', 'flipping', 'stub'];
        const messageCounts = await Promise.all(
          chatRooms.map(async (room) => {
            try {
              const response = await fetch(`${apiConfig.baseURL}/api/chat/${room}`);
              if (response.ok) {
                const messages = await response.json();
                return messages.filter((msg: any) => msg.userId === userId).length;
              }
              return 0;
            } catch {
              return 0;
            }
          })
        );
        
        const chatRoomMessages = messageCounts.reduce((sum, count) => sum + count, 0);
        
        // Count live comments from Firestore comments collection
        let liveCommentsCount = 0;
        try {
          const commentsQuery = query(
            collection(db, 'comments'),
            where('userId', '==', userId)
          );
          const commentsSnapshot = await getDocs(commentsQuery);
          liveCommentsCount = commentsSnapshot.size;
        } catch (error) {
          console.error('Error counting live comments:', error);
          // Keep liveCommentsCount as 0 if query fails
        }
        
        totalMessages = chatRoomMessages + liveCommentsCount;
      } catch (error) {
        console.error('Error counting user messages:', error);
        // Keep totalMessages as 0 if API call fails
      }

      setStats({
        totalInvestments,
        totalInvested,
        totalMessages,
      });
    } catch (error) {
      console.error('Error loading user stats:', error);
      // Don't show error for stats, just keep empty
    } finally {
      setStatsLoading(false);
    }
  };

  /**
   * Format join date
   */
  const formatJoinDate = (timestamp: any): string => {
    if (!timestamp) return 'Unknown';
    
    try {
      const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
      return `Joined ${date.toLocaleDateString('en-US', { 
        month: 'long', 
        day: 'numeric',
        year: 'numeric' 
      })}`;
    } catch {
      return 'Unknown';
    }
  };

  /**
   * Format stubs values (no currency symbol, for consistency with app)
   */
  const formatStubs = (amount: number): string => {
    return new Intl.NumberFormat('en-US', {
      minimumFractionDigits: 0,
    }).format(amount);
  };

  /**
   * Navigate to user's investment portfolio
   */
  const handleViewInvestments = () => {
    if (profile) {
      navigation.navigate('UserInvestment', { 
        userId: userId,
        username: profile.username 
      });
    }
  };

  useEffect(() => {
    loadUserProfile();
  }, [userId]);

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={24} color={theme.colors.text.primary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>User Profile</Text>
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.colors.primary.main} />
          <Text style={styles.loadingText}>Loading profile...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!profile) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={24} color={theme.colors.text.primary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>User Profile</Text>
        </View>
        <View style={styles.errorContainer}>
          <Ionicons name="person-outline" size={64} color={theme.colors.text.secondary} />
          <Text style={styles.errorTitle}>Profile Not Found</Text>
          <Text style={styles.errorSubtitle}>This user's profile could not be loaded.</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color={theme.colors.text.primary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>User Profile</Text>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Profile Section */}
        <View style={styles.profileSection}>
          <Image
            source={
              profile.profilePic
                ? { uri: profile.profilePic }
                : require('../../assets/default_profile.jpg')
            }
            style={styles.profileImage}
            defaultSource={require('../../assets/default_profile.jpg')}
          />
          <View style={styles.profileUsernameContainer}>
            <Text style={[
              styles.username,
              isOfficialAccount(profile.username) && styles.officialUsername
            ]}>
              {profile.username}
            </Text>
            {isOfficialAccount(profile.username) && (
              <Ionicons 
                name="checkmark-circle" 
                size={20} 
                color={theme.colors.primary.main} 
                style={styles.profileVerifiedIcon}
              />
            )}
          </View>
          <Text style={styles.joinDate}>{formatJoinDate(profile.createdAt)}</Text>
        </View>

        {/* Trader Statistics Section */}
        <View style={styles.statsSection}>
          <Text style={styles.sectionTitle}>Trader Statistics</Text>
          {statsLoading ? (
            <View style={styles.statsLoading}>
              <ActivityIndicator size="small" color={theme.colors.primary.main} />
              <Text style={styles.statsLoadingText}>Loading statistics...</Text>
            </View>
          ) : (
            <View style={styles.statsGrid}>
              <View style={styles.statCard}>
                <Ionicons name="chatbubbles" size={24} color={theme.colors.primary.main} style={styles.statIcon} />
                <View style={styles.statTextContainer}>
                  <Text style={styles.statValue}>{stats.totalMessages}</Text>
                  <Text style={styles.statLabel}>Total Messages</Text>
                </View>
              </View>
              <View style={styles.statCard}>
                <Ionicons name="trending-up" size={24} color={theme.colors.primary.main} style={styles.statIcon} />
                <View style={styles.statTextContainer}>
                  <Text style={styles.statValue}>{stats.totalInvestments}</Text>
                  <Text style={styles.statLabel}>Total Investments</Text>
                </View>
              </View>
              {profile.investmentsPublic && (
                <View style={styles.statCard}>
                  <Ionicons name="cash" size={24} color={theme.colors.primary.main} style={styles.statIcon} />
                  <View style={styles.statTextContainer}>
                    <Text style={styles.statValue}>{formatStubs(stats.totalInvested)}</Text>
                    <Text style={styles.statLabel}>Total Invested</Text>
                  </View>
                </View>
              )}
            </View>
          )}
        </View>

        {/* View Investments Button */}
        {profile.investmentsPublic ? (
          <View style={styles.investmentSection}>
            <TouchableOpacity style={styles.viewInvestmentsButton} onPress={handleViewInvestments}>
              <Ionicons name="briefcase" size={20} color="white" />
              <Text style={styles.viewInvestmentsText}>View Investments</Text>
              <Ionicons name="chevron-forward" size={20} color="white" />
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.privateSection}>
            <Ionicons name="lock-closed" size={32} color={theme.colors.text.secondary} />
            <Text style={styles.privateTitle}>Private Portfolio</Text>
            <Text style={styles.privateSubtitle}>
              This user has chosen to keep their investment portfolio private.
            </Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

/**
 * LEARNING NOTES: User Profile Screen Design
 * 
 * Key design considerations for user profile viewing:
 * 1. Privacy controls - respect user's privacy settings
 * 2. Read-only interface - no editing capabilities
 * 3. Clear navigation - easy back button and clear header
 * 4. Loading states - handle async data gracefully
 * 5. Error handling - graceful fallbacks for missing data
 * 6. Performance - only load public data that's needed
 */
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background.dark,
  },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: theme.colors.background.medium,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border.primary,
  },

  backButton: {
    padding: 8,
    marginRight: 8,
  },

  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: theme.colors.text.primary,
  },

  content: {
    flex: 1,
    paddingHorizontal: 16,
  },

  profileSection: {
    alignItems: 'center',
    paddingVertical: 32,
  },

  profileImage: {
    width: 100,
    height: 100,
    borderRadius: 50,
    marginBottom: 16,
    backgroundColor: theme.colors.surface.elevated,
  },

  username: {
    fontSize: 24,
    fontWeight: 'bold',
    color: theme.colors.text.primary,
    marginBottom: 4,
  },

  profileUsernameContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginBottom: 4,
  },

  officialUsername: {
    color: theme.colors.primary.main,
  },

  profileVerifiedIcon: {
    marginLeft: 4,
  },

  joinDate: {
    fontSize: 14,
    color: theme.colors.text.secondary,
  },

  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: theme.colors.text.primary,
    marginBottom: 16,
  },

  statsSection: {
    marginBottom: 24,
  },

  statsLoading: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 20,
  },

  statsLoadingText: {
    marginLeft: 12,
    fontSize: 14,
    color: theme.colors.text.secondary,
  },

  statsGrid: {
    flexDirection: 'column',
    gap: 16,
  },

  statCard: {
    backgroundColor: theme.colors.background.medium,
    padding: 20,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.colors.border.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 80,
  },

  statIcon: {
    marginRight: 12,
  },

  statTextContainer: {
    alignItems: 'center',
  },

  statValue: {
    fontSize: 22,
    fontWeight: 'bold',
    color: theme.colors.text.primary,
    marginBottom: 4,
    textAlign: 'center',
    lineHeight: 26,
  },

  statLabel: {
    fontSize: 13,
    color: theme.colors.text.secondary,
    textAlign: 'center',
    fontWeight: '500',
  },

  privateSection: {
    alignItems: 'center',
    paddingVertical: 32,
    marginBottom: 24,
  },

  privateTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.text.primary,
    marginTop: 12,
    marginBottom: 8,
  },

  privateSubtitle: {
    fontSize: 14,
    color: theme.colors.text.secondary,
    textAlign: 'center',
    lineHeight: 20,
  },

  investmentSection: {
    marginBottom: 24,
    paddingHorizontal: 0,
  },

  viewInvestmentsButton: {
    backgroundColor: theme.colors.primary.main,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderRadius: 12,
    gap: 12,
  },

  viewInvestmentsText: {
    fontSize: 16,
    fontWeight: '600',
    color: 'white',
  },

  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
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
    paddingHorizontal: 32,
  },

  errorTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: theme.colors.text.primary,
    marginTop: 16,
    marginBottom: 8,
  },

  errorSubtitle: {
    fontSize: 14,
    color: theme.colors.text.secondary,
    textAlign: 'center',
    lineHeight: 20,
  },
});