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

import React, { useState, useEffect } from 'react';
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
  ActivityIndicator,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Linking,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { Ionicons } from '@expo/vector-icons';

import { theme } from '../styles/theme';
import { RootStackParamList } from '../navigation/AppNavigator';
import { useAuth, useAuthStatus } from '../contexts/AuthContext';
import { apiClient, apiConfig } from '../services/api';
import { storage, auth, db } from '../services/firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import {
  updatePassword,
  reauthenticateWithCredential,
  EmailAuthProvider,
} from 'firebase/auth';

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
  publicPortfolio: boolean;
}

type ProfileScreenNavigationProp = StackNavigationProp<RootStackParamList>;

export const ProfileScreen: React.FC = () => {
  const navigation = useNavigation<ProfileScreenNavigationProp>();
  
  // Authentication state from context
  const { user, userProfile, logout, refreshUserProfile, updateUserProfile } = useAuth();
  const { loading: authLoading, isAuthenticated, isGuest } = useAuthStatus();
  
  // Real user statistics state
  const [userStats, setUserStats] = useState({
    totalInvestments: 0,
    totalInvested: 0,
    totalMessages: 0,
  });
  const [statsLoading, setStatsLoading] = useState(false);

  const [settings, setSettings] = useState<UserSettings>({
    notifications: true,
    publicPortfolio: true, // Default to public (matches backend default)
  });

  // UI state
  const [refreshing, setRefreshing] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  
  // Toast notification state
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  
  // Edit profile modal state
  const [showEditModal, setShowEditModal] = useState(false);
  const [editForm, setEditForm] = useState({
    displayName: '',
    email: '',
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [editLoading, setEditLoading] = useState(false);

  /**
   * LEARNING NOTE: Real User Stats Loading
   * Load actual investment data and calculate statistics
   */
  const loadUserStats = async () => {
    if (!isAuthenticated) return;
    
    setStatsLoading(true);
    try {
      // Get user's investment data
      const investments = await apiClient.getUserInvestments();
      
      // Calculate total investments count
      const totalInvestments = investments.length;
      
      // Calculate total invested amount (quantity * avgBuyPrice)
      const totalInvested = investments.reduce((sum, investment) => {
        return sum + (investment.quantity * investment.avgBuyPrice);
      }, 0);
      
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
                return messages.filter((msg: any) => msg.userId === user?.uid).length;
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
        if (user?.uid) {
          try {
            const commentsQuery = query(
              collection(db, 'comments'),
              where('userId', '==', user.uid)
            );
            const commentsSnapshot = await getDocs(commentsQuery);
            liveCommentsCount = commentsSnapshot.size;
          } catch (error) {
            console.error('Error counting live comments:', error);
            // Keep liveCommentsCount as 0 if query fails
          }
        }
        
        totalMessages = chatRoomMessages + liveCommentsCount;
      } catch (error) {
        console.error('Error counting user messages:', error);
        // Keep totalMessages as 0 if API call fails
      }
      
      // Set calculated stats
      setUserStats({
        totalInvestments,
        totalInvested,
        totalMessages,
      });
    } catch (error) {
      console.error('Failed to load user stats:', error);
      // Keep stats at 0 on error
      setUserStats({
        totalInvestments: 0,
        totalInvested: 0,
        totalMessages: 0,
      });
    } finally {
      setStatsLoading(false);
    }
  };

  /**
   * LEARNING NOTE: Profile Data Refresh
   * User profiles need updated stats and information
   */
  const onRefresh = async () => {
    setRefreshing(true);
    try {
      if (isAuthenticated) {
        await Promise.all([
          refreshUserProfile(),
          loadUserStats()
        ]);
      }
    } catch (error) {
      console.error('Refresh error:', error);
    } finally {
      setRefreshing(false);
    }
  };

  /**
   * LEARNING NOTE: Component Lifecycle for Stats Loading
   * Load stats when user becomes authenticated
   */
  useEffect(() => {
    if (isAuthenticated && !authLoading) {
      loadUserStats();
    }
  }, [isAuthenticated, authLoading]);

  /**
   * Sync settings with user profile when profile loads
   */
  useEffect(() => {
    if (userProfile) {
      setSettings(prev => ({
        ...prev,
        publicPortfolio: userProfile.investmentsPublic ?? true
      }));
    }
  }, [userProfile]);

  /**
   * LEARNING NOTE: Settings Management
   * Profile screens handle user preferences with real backend sync
   */
  const updateSetting = async (key: keyof UserSettings, value: boolean) => {
    try {
      // Update local state immediately for responsive UI
      setSettings(prev => ({ ...prev, [key]: value }));
      
      // Handle backend sync for Public Portfolio
      if (key === 'publicPortfolio') {
        await updateUserProfile({ investmentsPublic: value });
        showSuccessToast(value ? 'Portfolio is now public' : 'Portfolio is now private');
      }
      
      // For notifications, just update local state (no backend sync needed yet)
      // TODO: Implement backend sync for push notifications when ready
    } catch (error) {
      console.error('Failed to update setting:', error);
      // Revert local state on error
      setSettings(prev => ({ ...prev, [key]: !value }));
      Alert.alert('Error', 'Failed to update setting. Please try again.');
    }
  };

  /**
   * LEARNING NOTE: Profile Picture Upload
   * Handle image selection and upload to Firebase Storage
   */
  const handleEditProfilePicture = async () => {
    try {
      // Request image picker permissions (not required for library access, but good practice)
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(
          'Permission Required',
          'Sorry, we need camera roll permissions to change your profile picture!'
        );
        return;
      }

      // Launch image picker
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1], // Square aspect ratio for profile pictures
        quality: 0.8, // Good quality but manageable file size
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const selectedImage = result.assets[0];
        await uploadProfilePicture(selectedImage.uri);
      }
    } catch (error) {
      console.error('Error selecting image:', error);
      Alert.alert('Error', 'Failed to select image. Please try again.');
    }
  };

  /**
   * Upload selected image to Firebase Storage and update user profile
   */
  const uploadProfilePicture = async (imageUri: string) => {
    if (!user) {
      Alert.alert('Error', 'You must be logged in to update your profile picture.');
      return;
    }

    setUploadingImage(true);

    try {
      // Verify user authentication and get fresh token
      console.log('Verifying authentication for upload...');
      const token = await user.getIdToken(true); // Force refresh token
      console.log('Authentication verified, token refreshed');

      // Log user info for debugging
      console.log('Uploading for user:', user.uid);
      console.log('Image URI:', imageUri);

      // Convert image URI to blob for Firebase Storage
      console.log('Converting image to blob...');
      const response = await fetch(imageUri);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch image: ${response.status} ${response.statusText}`);
      }
      
      const blob = await response.blob();
      console.log('Blob created successfully, size:', blob.size, 'type:', blob.type);

      // Create storage reference (match Firebase Storage rules path)
      const storageRef = `profilePics/${user.uid}/profile.jpg`;
      console.log('Storage reference:', storageRef);
      const imageRef = ref(storage, storageRef);

      // Upload image
      console.log('Starting upload to Firebase Storage...');
      await uploadBytes(imageRef, blob);
      console.log('Upload completed successfully');

      // Get download URL
      console.log('Getting download URL...');
      const downloadURL = await getDownloadURL(imageRef);
      console.log('Download URL obtained:', downloadURL);

      // Update user profile with new image URL
      console.log('Updating user profile...');
      await updateUserProfile({ profilePic: downloadURL });
      console.log('Profile updated successfully');

      showSuccessToast('Updated Profile Picture');
    } catch (error: any) {
      console.error('Error uploading image:', error);
      
      // Provide more specific error messages
      let errorMessage = 'Failed to upload image. Please try again.';
      
      if (error.code === 'storage/unauthorized') {
        errorMessage = 'Permission denied. Please contact support if this persists.';
        console.error('Storage rules may need to be updated for profile_pics path');
      } else if (error.code === 'storage/unknown') {
        errorMessage = 'Storage error occurred. Please check your internet connection.';
      } else if (error.message?.includes('Failed to fetch')) {
        errorMessage = 'Failed to process selected image. Please try a different image.';
      } else if (error.code === 'auth/requires-recent-login') {
        errorMessage = 'Please log out and log back in, then try again.';
      }
      
      Alert.alert('Upload Error', errorMessage);
    } finally {
      setUploadingImage(false);
    }
  };

  /**
   * Handle edit profile button press
   */
  const handleEditProfile = () => {
    // Pre-populate form with current user data
    setEditForm({
      displayName: userProfile?.displayName || user?.displayName || '',
      email: userProfile?.email || user?.email || '',
      currentPassword: '',
      newPassword: '',
      confirmPassword: '',
    });
    setShowEditModal(true);
  };

  /**
   * Handle save profile changes
   */
  const handleSaveProfile = async () => {
    if (!user) return;

    // Basic validation
    if (!editForm.displayName.trim()) {
      Alert.alert('Error', 'Username is required');
      return;
    }

    if (!editForm.email.trim()) {
      Alert.alert('Error', 'Email is required');
      return;
    }

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(editForm.email)) {
      Alert.alert('Error', 'Please enter a valid email address');
      return;
    }

    // Check if sensitive changes require current password
    const hasEmailChange = editForm.email.trim() !== (userProfile?.email || user?.email);
    const hasPasswordChange = editForm.newPassword.trim() !== '';
    const requiresAuth = hasEmailChange || hasPasswordChange;

    if (requiresAuth && !editForm.currentPassword.trim()) {
      Alert.alert('Error', 'Current password is required to change email or password');
      return;
    }

    // Password confirmation validation
    if (hasPasswordChange) {
      if (editForm.newPassword !== editForm.confirmPassword) {
        Alert.alert('Error', 'New passwords do not match');
        return;
      }
      
      if (editForm.newPassword.length < 6) {
        Alert.alert('Error', 'New password must be at least 6 characters');
        return;
      }
    }

    setEditLoading(true);

    try {
      // Re-authenticate if changing sensitive information
      if (requiresAuth) {
        const currentEmail = userProfile?.email || user?.email;
        if (!currentEmail) {
          throw new Error('Unable to verify current email');
        }
        
        const credential = EmailAuthProvider.credential(currentEmail, editForm.currentPassword);
        await reauthenticateWithCredential(user, credential);
      }

      // Update profile information (username/email)
      await updateUserProfile({
        displayName: editForm.displayName.trim(),
        email: editForm.email.trim(),
      });

      // Update password if provided
      if (hasPasswordChange) {
        await updatePassword(user, editForm.newPassword);
      }

      // Close modal and show success
      setShowEditModal(false);
      
      // Show specific success message
      if (hasPasswordChange && hasEmailChange) {
        showSuccessToast('Profile and password updated successfully!');
      } else if (hasPasswordChange) {
        showSuccessToast('Password updated successfully!');
      } else if (hasEmailChange) {
        showSuccessToast('Profile updated successfully!');
      } else {
        showSuccessToast('Profile updated successfully!');
      }
      
      // Refresh user profile to show changes
      await refreshUserProfile();
    } catch (error: any) {
      console.error('Failed to update profile:', error);
      
      // Handle specific Firebase errors
      let errorMessage = 'Failed to update profile. Please try again.';
      
      if (error.code === 'auth/wrong-password') {
        errorMessage = 'Current password is incorrect';
      } else if (error.code === 'auth/weak-password') {
        errorMessage = 'New password is too weak. Please choose a stronger password';
      } else if (error.code === 'auth/email-already-in-use') {
        errorMessage = 'This email is already in use by another account';
      } else if (error.code === 'auth/invalid-email') {
        errorMessage = 'Invalid email address format';
      } else if (error.code === 'auth/requires-recent-login') {
        errorMessage = 'Please log out and log back in, then try again';
      } else if (error.message?.includes('Username already taken')) {
        errorMessage = 'This username is already taken';
      }
      
      Alert.alert('Error', errorMessage);
    } finally {
      setEditLoading(false);
    }
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
   * Handle contact support - opens email app with pre-filled support request
   */
  const handleContactSupport = () => {
    const supportEmail = 'diamondinsights25@gmail.com';
    const subject = 'DiamondInsights Mobile App Support Request';
    const userName = userProfile?.displayName || user?.displayName || 'N/A';
    const userEmail = userProfile?.email || user?.email || 'N/A';
    
    const body = `Hi DiamondInsights Support Team,

I need help with:
[Please describe your issue here]

User Details:
- Username: ${userName}
- Email: ${userEmail}
- App Version: Mobile App
- Device: ${Platform.OS === 'ios' ? 'iOS' : 'Android'}

Thank you!`;

    const mailtoUrl = `mailto:${supportEmail}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    
    Linking.openURL(mailtoUrl).catch(() => {
      Alert.alert(
        'Email Not Available',
        `Please email us directly at ${supportEmail}`,
        [
          { 
            text: 'Show Email', 
            onPress: () => {
              Alert.alert(
                'Contact Support',
                `Email: ${supportEmail}\n\nPlease copy this email address and contact us with your support request.`,
                [{ text: 'OK' }]
              );
            }
          },
          { text: 'OK', style: 'cancel' }
        ]
      );
    });
  };

  /**
   * Show success toast notification
   */
  const showSuccessToast = (message: string) => {
    setToastMessage(message);
    setShowToast(true);
    // Auto-dismiss after 3 seconds
    setTimeout(() => {
      setShowToast(false);
      setToastMessage('');
    }, 3000);
  };

  /**
   * LEARNING NOTE: Currency Formatting
   * Consistent formatting across the app
   */
  const formatCurrency = (amount: number): string => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  /**
   * LEARNING NOTE: Stubs Formatting
   * Format numbers for display with stubs icon (no currency symbol)
   */
  const formatStubs = (amount: number): string => {
    return new Intl.NumberFormat('en-US', {
      minimumFractionDigits: 0,
    }).format(amount);
  };

  /**
   * LEARNING NOTE: Profile Picture Source Selection
   * Matches web app's image fallback pattern
   */
  const pickProfilePic = (profilePic?: string, photoURL?: string) => {
    // Priority: 1. Firestore profilePic, 2. Firebase Auth photoURL, 3. Default image
    if (profilePic && profilePic.trim() !== '') {
      return { uri: profilePic };
    }
    if (photoURL && photoURL.trim() !== '') {
      return { uri: photoURL };
    }
    return require('../../assets/default_profile.jpg');
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
      {/* Success Toast Notification */}
      {showToast && (
        <View style={styles.toastContainer}>
          <View style={styles.toast}>
            <Ionicons name="checkmark-circle" size={20} color="white" />
            <Text style={styles.toastText}>{toastMessage}</Text>
          </View>
        </View>
      )}
      
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
            <Image
              source={pickProfilePic(userProfile?.profilePic, user?.photoURL)}
              style={styles.avatar}
              resizeMode="cover"
              onError={() => {
                // Fallback is already handled by pickProfilePic function
                console.log('Profile image failed to load, using fallback');
              }}
            />
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
          
          <TouchableOpacity 
            style={[styles.editButton, uploadingImage && styles.editButtonDisabled]} 
            onPress={handleEditProfile}
            disabled={uploadingImage}
          >
            {uploadingImage ? (
              <>
                <ActivityIndicator size="small" color="#3b82f6" style={{ marginRight: 8 }} />
                <Text style={styles.editButtonText}>Uploading...</Text>
              </>
            ) : (
              <Text style={styles.editButtonText}>Edit Profile</Text>
            )}
          </TouchableOpacity>
        </View>

        {/* Stats Section */}
        <View style={styles.section}>
          <View style={styles.statsHeader}>
            <Text style={styles.statsTitle}>Trader Statistics</Text>
            <Text style={styles.statsSubtitle}>Your performance metrics and trading insights</Text>
          </View>
          
          <View style={styles.statsGrid}>
            <View style={styles.statCard}>
              <Text style={styles.statLabel}>Total Investments</Text>
              <Text style={styles.statNumber}>
                {statsLoading ? '...' : userStats.totalInvestments}
              </Text>
            </View>
            
            <View style={styles.statCard}>
              <Text style={styles.statLabel}>Total Invested</Text>
              <Text style={styles.statNumber}>
                {statsLoading ? '...' : formatStubs(userStats.totalInvested)}
              </Text>
            </View>
            
            <View style={styles.statCard}>
              <Text style={styles.statLabel}>Total Messages</Text>
              <Text style={styles.statNumber}>
                {statsLoading ? '...' : userStats.totalMessages}
              </Text>
            </View>
          </View>
        </View>

        {/* Settings & Account Section */}
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
            <Text style={styles.settingLabel}>Public Portfolio</Text>
            <Switch
              value={settings.publicPortfolio}
              onValueChange={(value) => updateSetting('publicPortfolio', value)}
            />
          </View>
          
          <TouchableOpacity 
            style={[styles.actionButton, { marginTop: 16 }]} 
            onPress={handleContactSupport}
          >
            <View style={styles.buttonContent}>
              <Ionicons name="help-circle-outline" size={20} color={theme.colors.text.primary} />
              <Text style={styles.actionButtonText}>Contact Support</Text>
            </View>
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.actionButton} onPress={handleLogout}>
            <View style={styles.buttonContent}>
              <Ionicons name="log-out-outline" size={20} color={theme.colors.text.primary} />
              <Text style={styles.actionButtonText}>Logout</Text>
            </View>
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

      {/* Edit Profile Modal */}
      <Modal
        visible={showEditModal}
        animationType="slide"
        presentationStyle="pageSheet"
      >
        <SafeAreaView style={styles.modalContainer}>
          <KeyboardAvoidingView 
            style={styles.modalContent}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          >
            {/* Modal Header */}
            <View style={styles.modalHeader}>
              <TouchableOpacity 
                onPress={() => setShowEditModal(false)}
                style={styles.modalCancelButton}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              
              <Text style={styles.modalTitle}>Edit Profile</Text>
              
              <TouchableOpacity 
                onPress={handleSaveProfile}
                style={styles.modalSaveButton}
                disabled={editLoading}
              >
                {editLoading ? (
                  <ActivityIndicator size="small" color="#3b82f6" />
                ) : (
                  <Text style={styles.modalSaveText}>Save</Text>
                )}
              </TouchableOpacity>
            </View>

            {/* Form Fields */}
            <ScrollView style={styles.modalScrollView} showsVerticalScrollIndicator={false}>
              <View style={styles.modalFormContainer}>
                
                {/* Profile Picture Section */}
                <View style={styles.modalField}>
                  <Text style={styles.modalFieldLabel}>Profile Picture</Text>
                  <TouchableOpacity 
                    style={styles.profilePictureButton}
                    onPress={handleEditProfilePicture}
                    disabled={uploadingImage}
                  >
                    <Image
                      source={pickProfilePic(userProfile?.profilePic, user?.photoURL)}
                      style={styles.modalProfilePic}
                      resizeMode="cover"
                    />
                    <View style={styles.profilePictureOverlay}>
                      {uploadingImage ? (
                        <ActivityIndicator size="small" color="white" />
                      ) : (
                        <Ionicons name="camera" size={24} color="white" />
                      )}
                    </View>
                  </TouchableOpacity>
                </View>

                {/* Username Field */}
                <View style={styles.modalField}>
                  <Text style={styles.modalFieldLabel}>Username</Text>
                  <TextInput
                    style={styles.modalTextInput}
                    value={editForm.displayName}
                    onChangeText={(text) => setEditForm(prev => ({ ...prev, displayName: text }))}
                    placeholder="Enter username"
                    placeholderTextColor="#999"
                    editable={!editLoading}
                  />
                </View>

                {/* Email Field */}
                <View style={styles.modalField}>
                  <Text style={styles.modalFieldLabel}>Email</Text>
                  <TextInput
                    style={styles.modalTextInput}
                    value={editForm.email}
                    onChangeText={(text) => setEditForm(prev => ({ ...prev, email: text }))}
                    placeholder="Enter email"
                    placeholderTextColor="#999"
                    keyboardType="email-address"
                    autoCapitalize="none"
                    editable={!editLoading}
                  />
                </View>

                {/* Current Password Field */}
                <View style={styles.modalField}>
                  <Text style={styles.modalFieldLabel}>
                    Current Password
                    <Text style={styles.helpText}> (required to change email or password)</Text>
                  </Text>
                  <TextInput
                    style={styles.modalTextInput}
                    value={editForm.currentPassword}
                    onChangeText={(text) => setEditForm(prev => ({ ...prev, currentPassword: text }))}
                    placeholder="Enter current password"
                    placeholderTextColor="#999"
                    secureTextEntry
                    autoCapitalize="none"
                    autoComplete="current-password"
                    editable={!editLoading}
                  />
                </View>

                {/* New Password Field */}
                <View style={styles.modalField}>
                  <Text style={styles.modalFieldLabel}>New Password</Text>
                  <TextInput
                    style={styles.modalTextInput}
                    value={editForm.newPassword}
                    onChangeText={(text) => setEditForm(prev => ({ ...prev, newPassword: text }))}
                    placeholder="Leave blank to keep current"
                    placeholderTextColor="#999"
                    secureTextEntry
                    autoCapitalize="none"
                    autoComplete="new-password"
                    editable={!editLoading}
                  />
                </View>

                {/* Confirm New Password Field */}
                <View style={styles.modalField}>
                  <Text style={styles.modalFieldLabel}>Confirm New Password</Text>
                  <TextInput
                    style={styles.modalTextInput}
                    value={editForm.confirmPassword}
                    onChangeText={(text) => setEditForm(prev => ({ ...prev, confirmPassword: text }))}
                    placeholder="Must match new password"
                    placeholderTextColor="#999"
                    secureTextEntry
                    autoCapitalize="none"
                    autoComplete="new-password"
                    editable={!editLoading}
                  />
                </View>
                
              </View>
            </ScrollView>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </Modal>
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
    backgroundColor: theme.colors.surface.elevated,
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
    backgroundColor: theme.colors.surface.elevated,
    borderWidth: 2,
    borderColor: theme.colors.primary.main,
  },
  
  displayName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: theme.colors.text.primary,
    marginBottom: 4,
  },
  
  email: {
    fontSize: 16,
    color: theme.colors.text.secondary,
    marginBottom: 4,
  },
  
  joinDate: {
    fontSize: 14,
    color: theme.colors.text.secondary,
    marginBottom: 16,
  },
  
  editButton: {
    backgroundColor: theme.colors.background.medium,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  
  editButtonDisabled: {
    opacity: 0.6,
  },
  
  editButtonText: {
    fontSize: 16,
    color: '#3b82f6',
    fontWeight: '500',
  },
  
  section: {
    backgroundColor: theme.colors.surface.elevated,
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
    color: theme.colors.text.primary,
    marginBottom: 16,
  },
  
  statsHeader: {
    marginBottom: 20,
  },
  
  statsTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: theme.colors.text.primary,
    marginBottom: 8,
  },
  
  statsSubtitle: {
    fontSize: 14,
    color: theme.colors.text.secondary,
    lineHeight: 20,
  },
  
  statsGrid: {
    gap: 12,
  },
  
  statCard: {
    backgroundColor: theme.colors.background.medium,
    borderRadius: 12,
    padding: 20,
    borderWidth: 1,
    borderColor: theme.colors.border.primary,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  
  statLabel: {
    fontSize: 14,
    color: theme.colors.text.secondary,
    marginBottom: 8,
    fontWeight: '500',
  },
  
  statNumber: {
    fontSize: 24,
    fontWeight: '700',
    color: theme.colors.text.primary,
  },
  
  settingItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border.secondary,
  },
  
  settingLabel: {
    fontSize: 16,
    color: theme.colors.text.primary,
  },
  
  actionButton: {
    backgroundColor: theme.colors.background.medium,
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderRadius: 8,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: theme.colors.border.primary,
  },
  
  actionButtonText: {
    fontSize: 16,
    color: theme.colors.text.primary,
    textAlign: 'center',
    fontWeight: '500',
  },

  buttonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  
  dangerButton: {
    backgroundColor: theme.colors.surface.elevated,
    borderColor: theme.colors.error,
  },
  
  dangerButtonText: {
    color: '#dc2626',
  },
  
  bottomPadding: {
    height: 20,
  },

  toastContainer: {
    position: 'absolute',
    top: 60,
    left: 0,
    right: 0,
    zIndex: 1000,
    paddingHorizontal: 16,
  },

  toast: {
    backgroundColor: '#10b981',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
    gap: 8,
  },

  toastText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '500',
    flex: 1,
  },

  // Modal styles
  modalContainer: {
    flex: 1,
    backgroundColor: theme.colors.background.dark,
  },

  modalContent: {
    flex: 1,
  },

  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border.primary,
    backgroundColor: theme.colors.background.medium,
  },

  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: theme.colors.text.primary,
  },

  modalCancelButton: {
    width: 60,
  },

  modalCancelText: {
    fontSize: 16,
    color: '#3b82f6',
  },

  modalSaveButton: {
    width: 60,
    alignItems: 'flex-end',
  },

  modalSaveText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#3b82f6',
  },

  modalScrollView: {
    flex: 1,
  },

  modalFormContainer: {
    padding: 20,
  },

  modalField: {
    marginBottom: 24,
  },

  modalFieldLabel: {
    fontSize: 16,
    fontWeight: '500',
    color: theme.colors.text.primary,
    marginBottom: 8,
  },

  modalTextInput: {
    backgroundColor: theme.colors.background.medium,
    borderWidth: 1,
    borderColor: theme.colors.border.primary,
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    color: theme.colors.text.primary,
  },

  profilePictureButton: {
    alignSelf: 'center',
    position: 'relative',
  },

  modalProfilePic: {
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 2,
    borderColor: theme.colors.primary.main,
  },

  profilePictureOverlay: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: 'rgba(0,0,0,0.7)',
    borderRadius: 16,
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },

  helpText: {
    fontSize: 12,
    color: theme.colors.text.secondary,
    fontWeight: '400',
  },
});