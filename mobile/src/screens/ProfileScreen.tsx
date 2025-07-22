/**
 * ProfileScreen - User Account Management
 * 
 * LEARNING NOTES: User Profile Mobile Interfaces
 * 
 * This screen demonstrates:
 * 1. User information display and editing
 * 2. Settings and preferences management
 * 3. Account actions (logout, delete, etc.)
 * 4. Statistics and user activity summary
 * 5. Profile image handling
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  Switch,
  Alert,
  RefreshControl,
  Image,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { Ionicons } from '@expo/vector-icons';

import { theme } from '../styles/theme';
import { RootStackParamList } from '../navigation/AppNavigator';
import { useAuth, useAuthStatus } from '../contexts/AuthContext';

/**
 * LEARNING NOTE: User Profile Data Types
 * Profile screens need comprehensive user data structures
 */
interface UserProfile {
  id: string;
  displayName: string;
  email: string;
  joinDate: string;
  totalInvestments: number;
  portfolioValue: number;
  accuracyRate: number;
  favoritePlayer: string;
}

interface UserSettings {
  notifications: boolean;
  darkMode: boolean;
  emailUpdates: boolean;
  pushPredictions: boolean;
}

type ProfileScreenNavigationProp = StackNavigationProp<RootStackParamList>;

export const ProfileScreen: React.FC = () => {
  const navigation = useNavigation<ProfileScreenNavigationProp>();
  
  // Authentication state from context
  const { user, userProfile, logout, refreshUserProfile } = useAuth();
  const { loading: authLoading, isAuthenticated, isGuest } = useAuthStatus();
  
  // Sample user data - will be replaced with actual user stats
  const [userStats] = useState({
    totalInvestments: 15,
    portfolioValue: 12450.75,
    accuracyRate: 78.5,
    favoritePlayer: 'Aaron Judge',
  });

  const [settings, setSettings] = useState<UserSettings>({
    notifications: true,
    darkMode: false,
    emailUpdates: true,
    pushPredictions: false,
  });

  // UI state
  const [refreshing, setRefreshing] = useState(false);

  /**
   * LEARNING NOTE: Profile Data Refresh
   * User profiles need updated stats and information
   */
  const onRefresh = async () => {
    setRefreshing(true);
    try {
      if (isAuthenticated) {
        await refreshUserProfile();
      }
    } catch (error) {
      console.error('Refresh error:', error);
    } finally {
      setRefreshing(false);
    }
  };

  /**
   * LEARNING NOTE: Settings Management
   * Profile screens handle user preferences
   */
  const updateSetting = (key: keyof UserSettings, value: boolean) => {
    setSettings(prev => ({ ...prev, [key]: value }));
    // TODO: Save settings to backend
  };

  /**
   * LEARNING NOTE: Account Actions
   * Profile screens need critical account operations
   */
  const handleEditProfile = () => {
    console.log('Navigate to edit profile screen');
    // TODO: Navigate to profile editing screen
  };

  const handleChangePassword = () => {
    console.log('Navigate to change password screen');
    // TODO: Navigate to password change screen
  };

  const handleLogout = () => {
    Alert.alert(
      'Logout',
      'Are you sure you want to logout?',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Logout', 
          style: 'destructive',
          onPress: async () => {
            try {
              await logout();
              console.log('User logged out successfully');
            } catch (error) {
              console.error('Logout error:', error);
              Alert.alert('Error', 'Failed to logout. Please try again.');
            }
          }
        },
      ]
    );
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      'Delete Account',
      'This action cannot be undone. Are you sure you want to delete your account?',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Delete', 
          style: 'destructive',
          onPress: () => {
            console.log('Delete account');
            // TODO: Implement account deletion
          }
        },
      ]
    );
  };

  /**
   * LEARNING NOTE: Currency Formatting
   * Consistent formatting across the app
   */
  const formatCurrency = (amount: number): string => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
    }).format(amount);
  };

  // Show loading spinner while checking auth
  if (authLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Loading...</Text>
        </View>
      </SafeAreaView>
    );
  }

  // Show login prompt if not authenticated
  if (isGuest) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.authPromptContainer}>
          <View style={styles.logoContainer}>
            <Image 
              source={require('../../assets/diamond_icon.png')} 
              style={styles.logo}
              resizeMode="contain"
              onError={(error) => console.log('Welcome logo loading error:', error)}
              onLoad={() => console.log('Welcome logo loaded successfully')}
            />
          </View>
          
          <Text style={styles.authTitle}>Welcome to DiamondInsights</Text>
          <Text style={styles.authSubtitle}>
            Sign in to track your investments, view predictions, and join the community
          </Text>
          
          <View style={styles.authButtons}>
            <TouchableOpacity
              style={styles.primaryButton}
              onPress={() => navigation.navigate('Login')}
            >
              <Text style={styles.primaryButtonText}>Sign In</Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={styles.secondaryButton}
              onPress={() => navigation.navigate('Signup')}
            >
              <Text style={styles.secondaryButtonText}>Create Account</Text>
            </TouchableOpacity>
          </View>
          
          <View style={styles.featuresPreview}>
            <Text style={styles.featuresTitle}>What you'll get:</Text>
            <View style={styles.featuresList}>
              <View style={styles.featureItem}>
                <Ionicons name="analytics" size={20} color={theme.colors.primary.main} />
                <Text style={styles.featureText}>AI-powered predictions</Text>
              </View>
              <View style={styles.featureItem}>
                <Ionicons name="trending-up" size={20} color={theme.colors.primary.main} />
                <Text style={styles.featureText}>Investment portfolio tracking</Text>
              </View>
              <View style={styles.featureItem}>
                <Ionicons name="people" size={20} color={theme.colors.primary.main} />
                <Text style={styles.featureText}>Community insights</Text>
              </View>
            </View>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Profile</Text>
        <Text style={styles.subtitle}>Manage your account</Text>
      </View>

      <ScrollView
        style={styles.scrollContainer}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* User Info Card */}
        <View style={styles.userCard}>
          <View style={styles.avatarContainer}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>
                {(userProfile?.displayName || user?.displayName || 'U').split(' ').map(n => n[0]).join('')}
              </Text>
            </View>
          </View>
          
          <Text style={styles.displayName}>
            {userProfile?.displayName || user?.displayName || 'User'}
          </Text>
          <Text style={styles.email}>
            {userProfile?.email || user?.email || 'No email'}
          </Text>
          <Text style={styles.joinDate}>
            Member since {userProfile?.createdAt ? 
              new Date(userProfile.createdAt.toDate()).toLocaleDateString('en-US', { 
                month: 'long', 
                year: 'numeric' 
              }) : 'Recently'
            }
          </Text>
          
          <TouchableOpacity style={styles.editButton} onPress={handleEditProfile}>
            <Text style={styles.editButtonText}>Edit Profile</Text>
          </TouchableOpacity>
        </View>

        {/* Stats Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Your Stats</Text>
          
          <View style={styles.statsContainer}>
            <View style={styles.statBox}>
              <Text style={styles.statNumber}>
                {userProfile?.totalInvestments || userStats.totalInvestments}
              </Text>
              <Text style={styles.statLabel}>Total Investments</Text>
            </View>
            
            <View style={styles.statBox}>
              <Text style={styles.statNumber}>
                {formatCurrency(userProfile?.portfolioValue || userStats.portfolioValue)}
              </Text>
              <Text style={styles.statLabel}>Portfolio Value</Text>
            </View>
            
            <View style={styles.statBox}>
              <Text style={styles.statNumber}>
                {userProfile?.accuracyRate || userStats.accuracyRate}%
              </Text>
              <Text style={styles.statLabel}>Prediction Accuracy</Text>
            </View>
          </View>
          
          <View style={styles.favoritePlayer}>
            <Text style={styles.favoriteLabel}>Favorite Player</Text>
            <Text style={styles.favoriteValue}>{userStats.favoritePlayer}</Text>
          </View>
        </View>

        {/* Settings Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Settings</Text>
          
          <View style={styles.settingItem}>
            <Text style={styles.settingLabel}>Push Notifications</Text>
            <Switch
              value={settings.notifications}
              onValueChange={(value) => updateSetting('notifications', value)}
            />
          </View>
          
          <View style={styles.settingItem}>
            <Text style={styles.settingLabel}>Dark Mode</Text>
            <Switch
              value={settings.darkMode}
              onValueChange={(value) => updateSetting('darkMode', value)}
            />
          </View>
          
          <View style={styles.settingItem}>
            <Text style={styles.settingLabel}>Email Updates</Text>
            <Switch
              value={settings.emailUpdates}
              onValueChange={(value) => updateSetting('emailUpdates', value)}
            />
          </View>
          
          <View style={styles.settingItem}>
            <Text style={styles.settingLabel}>Prediction Alerts</Text>
            <Switch
              value={settings.pushPredictions}
              onValueChange={(value) => updateSetting('pushPredictions', value)}
            />
          </View>
        </View>

        {/* Account Actions Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Account</Text>
          
          <TouchableOpacity style={styles.actionButton} onPress={handleChangePassword}>
            <Text style={styles.actionButtonText}>Change Password</Text>
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.actionButton} onPress={handleLogout}>
            <Text style={styles.actionButtonText}>Logout</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[styles.actionButton, styles.dangerButton]} 
            onPress={handleDeleteAccount}
          >
            <Text style={[styles.actionButtonText, styles.dangerButtonText]}>
              Delete Account
            </Text>
          </TouchableOpacity>
        </View>

        {/* Bottom padding */}
        <View style={styles.bottomPadding} />
      </ScrollView>
    </SafeAreaView>
  );
};

/**
 * LEARNING NOTES: Profile Screen Design
 * 
 * Key principles for user profile interfaces:
 * 1. Clear user identification - Avatar, name, key info at top
 * 2. Logical grouping - Stats, settings, account actions in sections
 * 3. Visual hierarchy - Important info stands out
 * 4. Safety features - Confirmation dialogs for destructive actions
 * 5. Settings management - Toggle switches for preferences
 * 6. Accessibility - Proper labels and contrast for all elements
 * 7. Data consistency - Same formatting patterns across app
 */
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background.dark,
  },
  
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  
  loadingText: {
    fontSize: 16,
    color: theme.colors.text.secondary,
  },
  
  authPromptContainer: {
    flex: 1,
    paddingHorizontal: 24,
    paddingVertical: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  
  logoContainer: {
    width: 120,
    height: 120,
    backgroundColor: theme.colors.background.medium,
    borderRadius: 60,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 32,
    overflow: 'hidden',
  },
  
  logo: {
    width: 118,
    height: 118,
  },
  
  authTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: theme.colors.text.primary,
    textAlign: 'center',
    marginBottom: 12,
  },
  
  authSubtitle: {
    fontSize: 16,
    color: theme.colors.text.secondary,
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 40,
  },
  
  authButtons: {
    width: '100%',
    gap: 16,
    marginBottom: 40,
  },
  
  primaryButton: {
    backgroundColor: theme.colors.primary.main,
    paddingVertical: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  
  primaryButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  
  secondaryButton: {
    backgroundColor: theme.colors.background.medium,
    borderWidth: 1,
    borderColor: theme.colors.border.primary,
    paddingVertical: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  
  secondaryButtonText: {
    color: theme.colors.text.primary,
    fontSize: 16,
    fontWeight: '500',
  },
  
  featuresPreview: {
    width: '100%',
  },
  
  featuresTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: theme.colors.text.primary,
    textAlign: 'center',
    marginBottom: 20,
  },
  
  featuresList: {
    gap: 16,
  },
  
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  
  featureText: {
    fontSize: 16,
    color: theme.colors.text.secondary,
  },
  
  header: {
    backgroundColor: theme.colors.background.medium,
    paddingVertical: 20,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border.primary,
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
    marginTop: 4,
  },
  
  scrollContainer: {
    flex: 1,
  },
  
  userCard: {
    backgroundColor: 'white',
    margin: 16,
    padding: 20,
    borderRadius: 12,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  
  avatarContainer: {
    marginBottom: 16,
  },
  
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#3b82f6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  
  avatarText: {
    fontSize: 32,
    fontWeight: 'bold',
    color: 'white',
  },
  
  displayName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1a202c',
    marginBottom: 4,
  },
  
  email: {
    fontSize: 16,
    color: '#64748b',
    marginBottom: 4,
  },
  
  joinDate: {
    fontSize: 14,
    color: '#94a3b8',
    marginBottom: 16,
  },
  
  editButton: {
    backgroundColor: '#f1f5f9',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
  },
  
  editButtonText: {
    fontSize: 16,
    color: '#3b82f6',
    fontWeight: '500',
  },
  
  section: {
    backgroundColor: 'white',
    marginHorizontal: 16,
    marginBottom: 16,
    padding: 20,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  
  sectionTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 16,
  },
  
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  
  statBox: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: 8,
  },
  
  statNumber: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1a202c',
    marginBottom: 4,
  },
  
  statLabel: {
    fontSize: 12,
    color: '#64748b',
    textAlign: 'center',
  },
  
  favoritePlayer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
  },
  
  favoriteLabel: {
    fontSize: 16,
    color: '#374151',
  },
  
  favoriteValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1a202c',
  },
  
  settingItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  
  settingLabel: {
    fontSize: 16,
    color: '#374151',
  },
  
  actionButton: {
    backgroundColor: '#f8fafc',
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderRadius: 8,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  
  actionButtonText: {
    fontSize: 16,
    color: '#374151',
    textAlign: 'center',
    fontWeight: '500',
  },
  
  dangerButton: {
    backgroundColor: '#fef2f2',
    borderColor: '#fecaca',
  },
  
  dangerButtonText: {
    color: '#dc2626',
  },
  
  bottomPadding: {
    height: 20,
  },
});