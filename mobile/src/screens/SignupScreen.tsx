/**
 * SignupScreen - Comprehensive Mobile User Registration
 * 
 * LEARNING NOTES: Advanced Mobile Registration System
 * 
 * This demonstrates:
 * 1. Complete user registration workflow matching website functionality
 * 2. Username uniqueness validation with Firestore integration
 * 3. Profile picture upload with camera/photo library access
 * 4. Firebase Auth account creation with comprehensive error handling
 * 5. Cross-platform authentication compatibility with website
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TextInput,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Image,
  Linking,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import * as ImagePicker from 'expo-image-picker';
import { FirebaseError } from 'firebase/auth';
import { 
  ref as storageRef, 
  uploadBytes, 
  getDownloadURL 
} from 'firebase/storage';

// Import design system, Firebase, and authentication context
import { theme } from '../styles/theme';
import { storage } from '../services/firebase';
import { RootStackParamList } from '../navigation/AppNavigator';
import { TabParamList } from '../navigation/TabNavigator';
import { useAuth } from '../contexts/AuthContext';

type SignupScreenNavigationProp = StackNavigationProp<RootStackParamList, 'Signup'>;

export const SignupScreen: React.FC = () => {
  const navigation = useNavigation<SignupScreenNavigationProp>();
  const { signUp } = useAuth();
  
  // Form state
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  // Profile picture state
  const [profileImage, setProfileImage] = useState<string | null>(null);
  const [imageFile, setImageFile] = useState<any>(null);

  /**
   * Request camera/photo library permissions and select image
   */
  const selectProfileImage = async () => {
    const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
    
    if (permissionResult.granted === false) {
      Alert.alert('Permission Required', 'Permission to access camera roll is required!');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
      base64: false,
    });

    if (!result.canceled) {
      setProfileImage(result.assets[0].uri);
      setImageFile(result.assets[0]);
    }
  };

  /**
   * Take photo with camera
   */
  const takePhoto = async () => {
    const permissionResult = await ImagePicker.requestCameraPermissionsAsync();
    
    if (permissionResult.granted === false) {
      Alert.alert('Permission Required', 'Permission to access camera is required!');
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (!result.canceled) {
      setProfileImage(result.assets[0].uri);
      setImageFile(result.assets[0]);
    }
  };

  /**
   * Show image selection options
   */
  const showImageOptions = () => {
    Alert.alert(
      'Profile Picture',
      'Choose how to add your profile picture',
      [
        { text: 'Camera', onPress: takePhoto },
        { text: 'Photo Library', onPress: selectProfileImage },
        { text: 'Cancel', style: 'cancel' },
      ]
    );
  };

  // Username validation is now handled by AuthContext

  /**
   * Upload profile image to Firebase Storage
   */
  const uploadProfileImage = async (userId: string): Promise<string> => {
    if (!imageFile) return '';

    try {
      // Convert image to blob for upload
      const response = await fetch(imageFile.uri);
      const blob = await response.blob();
      
      // Create unique filename
      const ext = imageFile.uri.split('.').pop();
      const filename = `profilePics/${userId}.${ext}`;
      const imageRef = storageRef(storage, filename);
      
      // Upload and get download URL
      await uploadBytes(imageRef, blob);
      return await getDownloadURL(imageRef);
    } catch (error) {
      console.error('Image upload error:', error);
      throw new Error('Failed to upload profile picture');
    }
  };

  /**
   * Get user-friendly error message from Firebase error code
   */
  const getErrorMessage = (error: FirebaseError): string => {
    switch (error.code) {
      case 'auth/email-already-in-use':
        return 'This email is already registered. Please use a different email or sign in.';
      case 'auth/invalid-email':
        return 'Please enter a valid email address.';
      case 'auth/weak-password':
        return 'Password should be at least 6 characters long.';
      case 'auth/network-request-failed':
        return 'Network error. Please check your connection and try again.';
      default:
        return error.message || 'An unexpected error occurred. Please try again.';
    }
  };

  /**
   * Handle sign up with comprehensive validation and user creation
   */
  const handleSignUp = async () => {
    // Clear previous errors
    setError('');

    // Validate inputs
    if (!username.trim()) {
      setError('Username is required');
      return;
    }

    if (username.trim().length < 3) {
      setError('Username must be at least 3 characters long');
      return;
    }

    if (!email.trim()) {
      setError('Email is required');
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      setError('Please enter a valid email address');
      return;
    }

    if (!password.trim()) {
      setError('Password is required');
      return;
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters long');
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords don't match");
      return;
    }

    setLoading(true);

    try {
      // Upload profile image if selected
      let photoURL = '';
      if (imageFile) {
        try {
          // Create a temporary user ID for image upload path
          const tempId = Date.now().toString();
          photoURL = await uploadProfileImage(tempId);
        } catch (uploadError) {
          console.error('Profile image upload failed:', uploadError);
          // Continue without profile image rather than failing entire signup
        }
      }

      // Use AuthContext signUp method (handles all user creation steps)
      await signUp(username.trim(), email.trim(), password, photoURL);

      // Success - navigate to Profile tab
      console.log('Account created successfully');
      navigation.navigate('Main', { screen: 'Profile' });
      
    } catch (error: any) {
      console.error('Signup error:', error);
      
      if (error instanceof FirebaseError) {
        setError(getErrorMessage(error));
      } else {
        setError(error.message || 'Account creation failed. Please try again.');
      }
      setLoading(false);
    }
  };

  /**
   * Navigate to login screen
   */
  const handleLoginPress = () => {
    navigation.navigate('Login');
  };

  /**
   * Open Terms of Service in browser
   */
  const handleTermsPress = async () => {
    const termsUrl = 'https://diamondinsights.vercel.app/terms';
    try {
      const supported = await Linking.canOpenURL(termsUrl);
      if (supported) {
        await Linking.openURL(termsUrl);
      } else {
        Alert.alert(
          'Terms of Service',
          'Unable to open browser. Please visit diamondinsights.vercel.app/terms in your web browser.',
          [{ text: 'OK' }]
        );
      }
    } catch (error) {
      console.error('Error opening terms URL:', error);
      Alert.alert(
        'Terms of Service',
        'Unable to open browser. Please visit diamondinsights.vercel.app/terms in your web browser.',
        [{ text: 'OK' }]
      );
    }
  };

  /**
   * Open Privacy Policy in browser
   */
  const handlePrivacyPress = async () => {
    const privacyUrl = 'https://diamondinsights.vercel.app/privacy';
    try {
      const supported = await Linking.canOpenURL(privacyUrl);
      if (supported) {
        await Linking.openURL(privacyUrl);
      } else {
        Alert.alert(
          'Privacy Policy',
          'Unable to open browser. Please visit diamondinsights.vercel.app/privacy in your web browser.',
          [{ text: 'OK' }]
        );
      }
    } catch (error) {
      console.error('Error opening privacy URL:', error);
      Alert.alert(
        'Privacy Policy',
        'Unable to open browser. Please visit diamondinsights.vercel.app/privacy in your web browser.',
        [{ text: 'OK' }]
      );
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView 
        style={styles.keyboardView}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView 
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity 
              style={styles.backButton} 
              onPress={() => navigation.goBack()}
            >
              <Ionicons name="chevron-back" size={24} color={theme.colors.text.secondary} />
            </TouchableOpacity>
            
            <View style={styles.logoContainer}>
              <Image 
                source={require('../../assets/diamond_icon.png')} 
                style={styles.logo}
                resizeMode="contain"
                onError={(error) => console.log('Logo loading error:', error)}
                onLoad={() => console.log('Logo loaded successfully')}
              />
            </View>
            
            <Text style={styles.title}>Join DiamondInsights</Text>
            <Text style={styles.subtitle}>Create your account to start investing</Text>
          </View>

          {/* Error Message */}
          {error ? (
            <View style={styles.errorContainer}>
              <Ionicons name="alert-circle" size={20} color={theme.colors.error} />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}

          {/* Signup Form */}
          <View style={styles.form}>
            {/* Profile Picture */}
            <View style={styles.profilePictureSection}>
              <Text style={styles.inputLabel}>Profile Picture (Optional)</Text>
              <TouchableOpacity
                style={styles.profilePictureContainer}
                onPress={showImageOptions}
                disabled={loading}
              >
                {profileImage ? (
                  <Image source={{ uri: profileImage }} style={styles.profileImage} />
                ) : (
                  <View style={styles.profilePlaceholder}>
                    <Ionicons name="camera" size={32} color={theme.colors.text.secondary} />
                    <Text style={styles.profilePlaceholderText}>Add Photo</Text>
                  </View>
                )}
              </TouchableOpacity>
            </View>

            {/* Username Input */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Username</Text>
              <View style={styles.inputContainer}>
                <Ionicons 
                  name="person" 
                  size={20} 
                  color={theme.colors.text.secondary} 
                  style={styles.inputIcon} 
                />
                <TextInput
                  style={styles.textInput}
                  placeholder="Choose a unique username"
                  placeholderTextColor={theme.colors.text.secondary}
                  value={username}
                  onChangeText={setUsername}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
              </View>
            </View>

            {/* Email Input */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Email</Text>
              <View style={styles.inputContainer}>
                <Ionicons 
                  name="mail" 
                  size={20} 
                  color={theme.colors.text.secondary} 
                  style={styles.inputIcon} 
                />
                <TextInput
                  style={styles.textInput}
                  placeholder="Enter your email address"
                  placeholderTextColor={theme.colors.text.secondary}
                  value={email}
                  onChangeText={setEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  autoComplete="email"
                />
              </View>
            </View>

            {/* Password Input */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Password</Text>
              <View style={styles.inputContainer}>
                <Ionicons 
                  name="lock-closed" 
                  size={20} 
                  color={theme.colors.text.secondary} 
                  style={styles.inputIcon} 
                />
                <TextInput
                  style={[styles.textInput, styles.passwordInput]}
                  placeholder="Create a password (6+ characters)"
                  placeholderTextColor={theme.colors.text.secondary}
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry={!showPassword}
                  autoCapitalize="none"
                  autoComplete="password-new"
                />
                <TouchableOpacity
                  style={styles.passwordToggle}
                  onPress={() => setShowPassword(!showPassword)}
                >
                  <Ionicons
                    name={showPassword ? "eye-off" : "eye"}
                    size={20}
                    color={theme.colors.text.secondary}
                  />
                </TouchableOpacity>
              </View>
            </View>

            {/* Confirm Password Input */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Confirm Password</Text>
              <View style={styles.inputContainer}>
                <Ionicons 
                  name="lock-closed" 
                  size={20} 
                  color={theme.colors.text.secondary} 
                  style={styles.inputIcon} 
                />
                <TextInput
                  style={[styles.textInput, styles.passwordInput]}
                  placeholder="Confirm your password"
                  placeholderTextColor={theme.colors.text.secondary}
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  secureTextEntry={!showConfirmPassword}
                  autoCapitalize="none"
                  autoComplete="password-new"
                />
                <TouchableOpacity
                  style={styles.passwordToggle}
                  onPress={() => setShowConfirmPassword(!showConfirmPassword)}
                >
                  <Ionicons
                    name={showConfirmPassword ? "eye-off" : "eye"}
                    size={20}
                    color={theme.colors.text.secondary}
                  />
                </TouchableOpacity>
              </View>
            </View>

            {/* Sign Up Button */}
            <TouchableOpacity
              style={[styles.signUpButton, loading && styles.disabledButton]}
              onPress={handleSignUp}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator size="small" color="white" />
              ) : (
                <Text style={styles.signUpButtonText}>Create Account</Text>
              )}
            </TouchableOpacity>

            {/* Login Link */}
            <View style={styles.loginContainer}>
              <Text style={styles.loginText}>Already have an account? </Text>
              <TouchableOpacity onPress={handleLoginPress} disabled={loading}>
                <Text style={styles.loginLink}>Sign In</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Terms and Features */}
          <View style={styles.footerContainer}>
            <View style={styles.termsContainer}>
              <Text style={styles.termsText}>By creating an account, you agree to our </Text>
              <TouchableOpacity onPress={handleTermsPress}>
                <Text style={styles.linkText}>Terms of Service</Text>
              </TouchableOpacity>
              <Text style={styles.termsText}> and </Text>
              <TouchableOpacity onPress={handlePrivacyPress}>
                <Text style={styles.linkText}>Privacy Policy</Text>
              </TouchableOpacity>
            </View>
            
            <View style={styles.featuresContainer}>
              <Text style={styles.featuresTitle}>What you'll get:</Text>
              <View style={styles.featuresList}>
                <View style={styles.featureItem}>
                  <Ionicons name="analytics" size={16} color={theme.colors.primary.main} />
                  <Text style={styles.featureText}>AI-powered predictions</Text>
                </View>
                <View style={styles.featureItem}>
                  <Ionicons name="trending-up" size={16} color={theme.colors.primary.main} />
                  <Text style={styles.featureText}>Investment portfolio tracking</Text>
                </View>
                <View style={styles.featureItem}>
                  <Ionicons name="people" size={16} color={theme.colors.primary.main} />
                  <Text style={styles.featureText}>Community insights & discussions</Text>
                </View>
              </View>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background.dark,
  },
  
  keyboardView: {
    flex: 1,
  },
  
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingBottom: 32,
  },
  
  header: {
    paddingTop: 20,
    paddingBottom: 32,
    alignItems: 'center',
  },
  
  backButton: {
    position: 'absolute',
    left: 0,
    top: 20,
    padding: 8,
  },
  
  logoContainer: {
    width: 80,
    height: 80,
    backgroundColor: theme.colors.background.medium,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    marginTop: 20,
    overflow: 'hidden',
  },
  
  logo: {
    width: 78,
    height: 78,
  },
  
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: theme.colors.text.primary,
    marginBottom: 8,
    textAlign: 'center',
  },
  
  subtitle: {
    fontSize: 16,
    color: theme.colors.text.secondary,
    textAlign: 'center',
    lineHeight: 22,
  },
  
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fef2f2',
    borderColor: '#fecaca',
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    marginBottom: 20,
  },
  
  errorText: {
    color: '#dc2626',
    fontSize: 14,
    marginLeft: 8,
    flex: 1,
    lineHeight: 20,
  },
  
  form: {
    gap: 20,
  },
  
  profilePictureSection: {
    alignItems: 'center',
    gap: 12,
  },
  
  profilePictureContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    overflow: 'hidden',
  },
  
  profileImage: {
    width: '100%',
    height: '100%',
  },
  
  profilePlaceholder: {
    width: '100%',
    height: '100%',
    backgroundColor: theme.colors.background.medium,
    borderWidth: 2,
    borderColor: theme.colors.border.primary,
    borderStyle: 'dashed',
    borderRadius: 50,
    justifyContent: 'center',
    alignItems: 'center',
  },
  
  profilePlaceholderText: {
    fontSize: 12,
    color: theme.colors.text.secondary,
    marginTop: 4,
  },
  
  inputGroup: {
    gap: 8,
  },
  
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.colors.text.primary,
  },
  
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.background.medium,
    borderWidth: 1,
    borderColor: theme.colors.border.primary,
    borderRadius: 8,
    paddingHorizontal: 12,
  },
  
  inputIcon: {
    marginRight: 12,
  },
  
  textInput: {
    flex: 1,
    paddingVertical: 14,
    fontSize: 16,
    color: theme.colors.text.primary,
  },
  
  passwordInput: {
    paddingRight: 40,
  },
  
  passwordToggle: {
    position: 'absolute',
    right: 12,
    padding: 4,
  },
  
  signUpButton: {
    backgroundColor: theme.colors.primary.main,
    paddingVertical: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 12,
  },
  
  disabledButton: {
    opacity: 0.6,
  },
  
  signUpButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  
  loginContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 16,
  },
  
  loginText: {
    fontSize: 14,
    color: theme.colors.text.secondary,
  },
  
  loginLink: {
    fontSize: 14,
    color: theme.colors.primary.main,
    fontWeight: '600',
  },
  
  footerContainer: {
    marginTop: 32,
    paddingTop: 24,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border.primary,
    gap: 20,
  },
  
  termsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  
  termsText: {
    fontSize: 12,
    color: theme.colors.text.secondary,
    lineHeight: 18,
  },
  
  linkText: {
    fontSize: 12,
    color: theme.colors.primary.main,
    lineHeight: 18,
    textDecorationLine: 'underline',
    fontWeight: '500',
  },
  
  featuresContainer: {
    gap: 12,
  },
  
  featuresTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.text.primary,
    textAlign: 'center',
  },
  
  featuresList: {
    gap: 12,
  },
  
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  
  featureText: {
    fontSize: 14,
    color: theme.colors.text.secondary,
  },
});