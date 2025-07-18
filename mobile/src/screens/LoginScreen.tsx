/**
 * LoginScreen - Comprehensive Firebase Authentication
 * 
 * LEARNING NOTES: Advanced Mobile Authentication
 * 
 * This demonstrates:
 * 1. Email/username login with automatic email resolution
 * 2. Firestore username-to-email lookup (matching website)
 * 3. Comprehensive error handling with user-friendly messages
 * 4. Password visibility toggle and form validation
 * 5. Cross-platform authentication compatibility
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
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { FirebaseError } from 'firebase/auth';

// Import design system and authentication context
import { theme } from '../styles/theme';
import { RootStackParamList } from '../navigation/AppNavigator';
import { useAuth } from '../contexts/AuthContext';

type LoginScreenNavigationProp = StackNavigationProp<RootStackParamList, 'Login'>;

export const LoginScreen: React.FC = () => {
  const navigation = useNavigation<LoginScreenNavigationProp>();
  const { signIn } = useAuth();
  
  // Form state
  const [identifier, setIdentifier] = useState(''); // Email or username
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Username/email resolution is now handled by AuthContext

  /**
   * Get user-friendly error message from Firebase error code
   */
  const getErrorMessage = (error: FirebaseError): string => {
    switch (error.code) {
      case 'auth/user-not-found':
        return 'No account found with this email. Please check your email or create a new account.';
      case 'auth/wrong-password':
        return 'Incorrect password. Please try again.';
      case 'auth/invalid-email':
        return 'Please enter a valid email address.';
      case 'auth/user-disabled':
        return 'This account has been disabled. Please contact support.';
      case 'auth/too-many-requests':
        return 'Too many failed attempts. Please wait before trying again.';
      case 'auth/network-request-failed':
        return 'Network error. Please check your connection and try again.';
      case 'auth/invalid-credential':
        return 'Invalid email or password. Please check your credentials.';
      default:
        return error.message || 'An unexpected error occurred. Please try again.';
    }
  };

  /**
   * Handle sign in with comprehensive error handling
   */
  const handleSignIn = async () => {
    // Clear previous errors
    setError('');

    // Validate inputs
    if (!identifier.trim()) {
      setError('Please enter your email or username');
      return;
    }

    if (!password.trim()) {
      setError('Please enter your password');
      return;
    }

    setLoading(true);

    try {
      // Use AuthContext signIn method (handles username/email resolution)
      await signIn(identifier.trim(), password);
      
      // Success - navigation will happen automatically via auth state change
      console.log('Login successful');
      
    } catch (error: any) {
      console.error('Login error:', error);
      
      if (error instanceof FirebaseError) {
        setError(getErrorMessage(error));
      } else {
        // Handle username lookup errors or other custom errors
        setError(error.message || 'Login failed. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  /**
   * Navigate to signup screen
   */
  const handleSignUpPress = () => {
    navigation.navigate('Signup');
  };

  /**
   * Demo login for testing
   */
  const handleDemoLogin = async () => {
    setLoading(true);
    setError('');
    
    try {
      await signIn('demo@diamondinsights.com', 'demo123');
    } catch (error: any) {
      console.error('Demo login error:', error);
      setError('Demo account not available. Please create your own account or contact support.');
    } finally {
      setLoading(false);
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
              <Ionicons name="diamond" size={48} color={theme.colors.primary.main} />
            </View>
            
            <Text style={styles.title}>Welcome Back</Text>
            <Text style={styles.subtitle}>Sign in to your DiamondInsights account</Text>
          </View>

          {/* Error Message */}
          {error ? (
            <View style={styles.errorContainer}>
              <Ionicons name="alert-circle" size={20} color={theme.colors.error} />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}

          {/* Login Form */}
          <View style={styles.form}>
            {/* Email/Username Input */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Email or Username</Text>
              <View style={styles.inputContainer}>
                <Ionicons 
                  name="person" 
                  size={20} 
                  color={theme.colors.text.secondary} 
                  style={styles.inputIcon} 
                />
                <TextInput
                  style={styles.textInput}
                  placeholder="Enter email or username"
                  placeholderTextColor={theme.colors.text.secondary}
                  value={identifier}
                  onChangeText={setIdentifier}
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
                  placeholder="Enter your password"
                  placeholderTextColor={theme.colors.text.secondary}
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry={!showPassword}
                  autoCapitalize="none"
                  autoComplete="password"
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

            {/* Remember Me */}
            <View style={styles.optionsRow}>
              <TouchableOpacity
                style={styles.rememberMeContainer}
                onPress={() => setRememberMe(!rememberMe)}
              >
                <View style={[styles.checkbox, rememberMe && styles.checkboxChecked]}>
                  {rememberMe && (
                    <Ionicons name="checkmark" size={14} color="white" />
                  )}
                </View>
                <Text style={styles.rememberMeText}>Remember me</Text>
              </TouchableOpacity>
            </View>

            {/* Sign In Button */}
            <TouchableOpacity
              style={[styles.signInButton, loading && styles.disabledButton]}
              onPress={handleSignIn}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator size="small" color="white" />
              ) : (
                <Text style={styles.signInButtonText}>Sign In</Text>
              )}
            </TouchableOpacity>

            {/* Demo Login */}
            <TouchableOpacity
              style={[styles.demoButton, loading && styles.disabledButton]}
              onPress={handleDemoLogin}
              disabled={loading}
            >
              <Text style={styles.demoButtonText}>Try Demo Account</Text>
            </TouchableOpacity>

            {/* Sign Up Link */}
            <View style={styles.signUpContainer}>
              <Text style={styles.signUpText}>Don't have an account? </Text>
              <TouchableOpacity onPress={handleSignUpPress} disabled={loading}>
                <Text style={styles.signUpLink}>Sign Up</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Features */}
          <View style={styles.featuresContainer}>
            <Text style={styles.featuresTitle}>DiamondInsights Features</Text>
            <View style={styles.featuresList}>
              <View style={styles.featureItem}>
                <Ionicons name="analytics" size={16} color={theme.colors.primary.main} />
                <Text style={styles.featureText}>AI-powered predictions</Text>
              </View>
              <View style={styles.featureItem}>
                <Ionicons name="trending-up" size={16} color={theme.colors.primary.main} />
                <Text style={styles.featureText}>Investment tracking</Text>
              </View>
              <View style={styles.featureItem}>
                <Ionicons name="people" size={16} color={theme.colors.primary.main} />
                <Text style={styles.featureText}>Community insights</Text>
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
  
  optionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  
  rememberMeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  
  checkbox: {
    width: 20,
    height: 20,
    borderWidth: 2,
    borderColor: theme.colors.border.primary,
    borderRadius: 4,
    marginRight: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  
  checkboxChecked: {
    backgroundColor: theme.colors.primary.main,
    borderColor: theme.colors.primary.main,
  },
  
  rememberMeText: {
    fontSize: 14,
    color: theme.colors.text.secondary,
  },
  
  signInButton: {
    backgroundColor: theme.colors.primary.main,
    paddingVertical: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 12,
  },
  
  disabledButton: {
    opacity: 0.6,
  },
  
  signInButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  
  demoButton: {
    backgroundColor: theme.colors.background.medium,
    borderWidth: 1,
    borderColor: theme.colors.border.primary,
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  
  demoButtonText: {
    color: theme.colors.text.secondary,
    fontSize: 14,
    fontWeight: '500',
  },
  
  signUpContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 16,
  },
  
  signUpText: {
    fontSize: 14,
    color: theme.colors.text.secondary,
  },
  
  signUpLink: {
    fontSize: 14,
    color: theme.colors.primary.main,
    fontWeight: '600',
  },
  
  featuresContainer: {
    marginTop: 32,
    paddingTop: 24,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border.primary,
  },
  
  featuresTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.text.primary,
    marginBottom: 16,
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