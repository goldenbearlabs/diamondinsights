/**
 * Authentication Hook for Mobile App
 * 
 * LEARNING NOTES: React Native Authentication Patterns
 * 
 * This demonstrates:
 * 1. Custom hooks for authentication state management
 * 2. Firebase Auth integration with React Native
 * 3. Persistent authentication across app sessions
 * 4. Loading states and error handling
 * 5. Authentication methods (email/password, social, etc.)
 */

import { useState, useEffect } from 'react';
import { 
  User, 
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  updateProfile,
  sendPasswordResetEmail,
} from 'firebase/auth';

import { auth } from '../services/firebase';

/**
 * LEARNING NOTE: Authentication State Interface
 * 
 * Define the shape of authentication state for TypeScript
 * This provides type safety and clear contracts
 */
export interface AuthState {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  error: string | null;
}

/**
 * LEARNING NOTE: Authentication Methods Interface
 * 
 * Define all authentication actions available to components
 * This creates a clean API for authentication operations
 */
export interface AuthActions {
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, displayName?: string) => Promise<void>;
  logout: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  updateUserProfile: (updates: { displayName?: string; photoURL?: string }) => Promise<void>;
  clearError: () => void;
}

/**
 * LEARNING NOTE: Complete Auth Hook Return Type
 * 
 * Combine state and actions for a complete authentication solution
 */
export type UseAuthReturn = AuthState & AuthActions;

/**
 * Custom Authentication Hook
 * 
 * LEARNING NOTE: Hook Architecture
 * This hook encapsulates all authentication logic:
 * 1. State management (user, loading, errors)
 * 2. Firebase Auth integration
 * 3. Persistent authentication monitoring
 * 4. Authentication methods (login, signup, logout)
 * 5. Error handling and user feedback
 */
export const useAuth = (): UseAuthReturn => {
  // Authentication state
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  /**
   * LEARNING NOTE: Authentication State Monitoring
   * 
   * Firebase Auth provides onAuthStateChanged listener:
   * 1. Automatically detects login/logout
   * 2. Persists authentication across app restarts
   * 3. Handles token refresh automatically
   * 4. Works across all platforms (iOS, Android, Web)
   */
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser);
      setIsLoading(false);
    });

    // Cleanup subscription on unmount
    return unsubscribe;
  }, []);

  /**
   * LEARNING NOTE: Error Handling Helper
   * 
   * Firebase Auth errors need user-friendly messages
   */
  const handleAuthError = (authError: any): string => {
    switch (authError.code) {
      case 'auth/user-not-found':
        return 'No account found with this email address.';
      case 'auth/wrong-password':
        return 'Incorrect password. Please try again.';
      case 'auth/email-already-in-use':
        return 'An account with this email already exists.';
      case 'auth/weak-password':
        return 'Password should be at least 6 characters long.';
      case 'auth/invalid-email':
        return 'Please enter a valid email address.';
      case 'auth/network-request-failed':
        return 'Network error. Please check your connection.';
      default:
        return authError.message || 'An unexpected error occurred.';
    }
  };

  /**
   * Sign in with email and password
   */
  const signIn = async (email: string, password: string): Promise<void> => {
    try {
      setIsLoading(true);
      setError(null);
      
      await signInWithEmailAndPassword(auth, email, password);
      // User state will be updated automatically by onAuthStateChanged
    } catch (authError: any) {
      setError(handleAuthError(authError));
      throw authError; // Re-throw for component handling if needed
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Sign up with email and password
   */
  const signUp = async (
    email: string, 
    password: string, 
    displayName?: string
  ): Promise<void> => {
    try {
      setIsLoading(true);
      setError(null);
      
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      
      // Update user profile with display name if provided
      if (displayName && userCredential.user) {
        await updateProfile(userCredential.user, { displayName });
      }
    } catch (authError: any) {
      setError(handleAuthError(authError));
      throw authError;
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Sign out current user
   */
  const logout = async (): Promise<void> => {
    try {
      setIsLoading(true);
      setError(null);
      
      await signOut(auth);
      // User state will be updated automatically by onAuthStateChanged
    } catch (authError: any) {
      setError(handleAuthError(authError));
      throw authError;
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Send password reset email
   */
  const resetPassword = async (email: string): Promise<void> => {
    try {
      setError(null);
      
      await sendPasswordResetEmail(auth, email);
    } catch (authError: any) {
      setError(handleAuthError(authError));
      throw authError;
    }
  };

  /**
   * Update user profile information
   */
  const updateUserProfile = async (updates: {
    displayName?: string;
    photoURL?: string;
  }): Promise<void> => {
    try {
      setError(null);
      
      if (user) {
        await updateProfile(user, updates);
        // Force a re-render by updating the user object
        setUser({ ...user, ...updates });
      }
    } catch (authError: any) {
      setError(handleAuthError(authError));
      throw authError;
    }
  };

  /**
   * Clear error state
   */
  const clearError = (): void => {
    setError(null);
  };

  // Derived state
  const isAuthenticated = !!user;

  return {
    // State
    user,
    isLoading,
    isAuthenticated,
    error,
    
    // Actions
    signIn,
    signUp,
    logout,
    resetPassword,
    updateUserProfile,
    clearError,
  };
};

/**
 * LEARNING NOTES: Authentication Hook Best Practices
 * 
 * Key principles for mobile authentication:
 * 
 * 1. **State Management**: Centralized auth state accessible throughout app
 * 2. **Persistence**: Authentication survives app restarts and background states
 * 3. **Error Handling**: User-friendly error messages for all auth scenarios
 * 4. **Loading States**: Clear feedback during authentication operations
 * 5. **Type Safety**: Full TypeScript coverage for auth state and actions
 * 6. **Security**: Secure token handling, automatic refresh, proper logout
 * 7. **Performance**: Minimal re-renders, efficient state updates
 * 8. **Platform Compatibility**: Works consistently across iOS, Android, and Web
 * 
 * Usage in Components:
 * ```typescript
 * const { user, isLoading, signIn, logout } = useAuth();
 * 
 * if (isLoading) return <LoadingScreen />;
 * if (!user) return <LoginScreen onSignIn={signIn} />;
 * return <MainApp user={user} onLogout={logout} />;
 * ```
 */