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
} from 'react-native';

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

export const ProfileScreen: React.FC = () => {
  // Sample user data - will be replaced with auth and API data
  const [userProfile] = useState<UserProfile>({
    id: 'user123',
    displayName: 'Baseball Enthusiast',
    email: 'user@example.com',
    joinDate: 'January 2024',
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
    // TODO: Fetch latest user data from API
    setTimeout(() => {
      setRefreshing(false);
    }, 1000);
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
          onPress: () => {
            console.log('Logout user');
            // TODO: Implement logout logic
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
                {userProfile.displayName.split(' ').map(n => n[0]).join('')}
              </Text>
            </View>
          </View>
          
          <Text style={styles.displayName}>{userProfile.displayName}</Text>
          <Text style={styles.email}>{userProfile.email}</Text>
          <Text style={styles.joinDate}>Member since {userProfile.joinDate}</Text>
          
          <TouchableOpacity style={styles.editButton} onPress={handleEditProfile}>
            <Text style={styles.editButtonText}>Edit Profile</Text>
          </TouchableOpacity>
        </View>

        {/* Stats Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Your Stats</Text>
          
          <View style={styles.statsContainer}>
            <View style={styles.statBox}>
              <Text style={styles.statNumber}>{userProfile.totalInvestments}</Text>
              <Text style={styles.statLabel}>Total Investments</Text>
            </View>
            
            <View style={styles.statBox}>
              <Text style={styles.statNumber}>
                {formatCurrency(userProfile.portfolioValue)}
              </Text>
              <Text style={styles.statLabel}>Portfolio Value</Text>
            </View>
            
            <View style={styles.statBox}>
              <Text style={styles.statNumber}>{userProfile.accuracyRate}%</Text>
              <Text style={styles.statLabel}>Prediction Accuracy</Text>
            </View>
          </View>
          
          <View style={styles.favoritePlayer}>
            <Text style={styles.favoriteLabel}>Favorite Player</Text>
            <Text style={styles.favoriteValue}>{userProfile.favoritePlayer}</Text>
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