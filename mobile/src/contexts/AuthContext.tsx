/**
 * AuthContext - Global Authentication State Management
 * 
 * LEARNING NOTES: React Context for Authentication
 * 
 * This demonstrates:
 * 1. React Context API for global state management
 * 2. Firebase Auth integration with real-time state updates
 * 3. User profile data management and caching
 * 4. Authentication helpers and utilities
 * 5. Cross-platform authentication state persistence
 */

import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { 
  User, 
  onAuthStateChanged, 
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  updateProfile as firebaseUpdateProfile
} from 'firebase/auth';
import { 
  doc, 
  getDoc, 
  setDoc, 
  updateDoc, 
  serverTimestamp,
  collection,
  query,
  where,
  getDocs 
} from 'firebase/firestore';

import { auth, db } from '../services/firebase';

/**
 * LEARNING NOTE: User Profile Data Structure
 * Comprehensive user profile combining Firebase Auth and Firestore data
 */
export interface UserProfile {
  uid: string;
  username: string;
  email: string;
  displayName: string;
  profilePic?: string;
  createdAt: any;
  investmentsPublic: boolean;
  searchable: boolean;
  // Statistics (can be computed or cached)
  totalInvestments?: number;
  portfolioValue?: number;
  accuracyRate?: number;
}

/**
 * LEARNING NOTE: Authentication Context Interface
 * Defines all authentication-related state and actions
 */
interface AuthContextType {
  // Authentication state
  user: User | null;
  userProfile: UserProfile | null;
  loading: boolean;
  
  // Authentication actions
  signIn: (emailOrUsername: string, password: string) => Promise<void>;
  signUp: (username: string, email: string, password: string, profilePic?: string) => Promise<void>;
  logout: () => Promise<void>;
  
  // Profile management
  updateUserProfile: (updates: Partial<UserProfile>) => Promise<void>;
  refreshUserProfile: () => Promise<void>;
  
  // Utility functions
  isAuthenticated: boolean;
  requireAuth: () => boolean;
}

// Create the authentication context
const AuthContext = createContext<AuthContextType | undefined>(undefined);

/**
 * LEARNING NOTE: Context Provider Props
 * Provider component that wraps the app and provides auth state
 */
interface AuthProviderProps {
  children: ReactNode;
}

/**
 * AuthProvider Component
 * 
 * LEARNING NOTE: Context Provider Implementation
 * - Manages global authentication state
 * - Handles Firebase Auth state changes
 * - Provides authentication methods to entire app
 * - Caches user profile data for performance
 */
export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  // Authentication state
  const [user, setUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  /**
   * LEARNING NOTE: Authentication State Monitoring
   * Firebase Auth provides real-time auth state updates
   */
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      
      if (firebaseUser) {
        // Load user profile when authenticated
        await loadUserProfile(firebaseUser.uid);
      } else {
        // Clear profile when not authenticated
        setUserProfile(null);
      }
      
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  /**
   * Load user profile from Firestore
   */
  const loadUserProfile = async (uid: string): Promise<void> => {
    try {
      const userDoc = await getDoc(doc(db, 'users', uid));
      
      if (userDoc.exists()) {
        const profileData = userDoc.data() as UserProfile;
        setUserProfile(profileData);
      } else {
        console.warn('User profile not found in Firestore');
        setUserProfile(null);
      }
    } catch (error) {
      console.error('Error loading user profile:', error);
      setUserProfile(null);
    }
  };

  /**
   * Resolve username to email for authentication
   */
  const resolveEmailFromUsername = async (username: string): Promise<string> => {
    try {
      const usersRef = collection(db, 'users');
      const q = query(usersRef, where('username', '==', username.trim()));
      const querySnapshot = await getDocs(q);
      
      if (querySnapshot.empty) {
        throw new Error('Username not found');
      }
      
      const userDoc = querySnapshot.docs[0];
      const userData = userDoc.data();
      
      if (!userData.email) {
        throw new Error('No email associated with this username');
      }
      
      return userData.email;
    } catch (error) {
      console.error('Username lookup error:', error);
      throw new Error('Username not found. Please check your username or use your email address.');
    }
  };

  /**
   * Sign in with email or username
   */
  const signIn = async (emailOrUsername: string, password: string): Promise<void> => {
    try {
      // Determine if input is email or username
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      let email = emailOrUsername.trim();
      
      if (!emailRegex.test(emailOrUsername)) {
        // Resolve username to email
        email = await resolveEmailFromUsername(emailOrUsername);
      }
      
      // Sign in with Firebase Auth
      await signInWithEmailAndPassword(auth, email, password);
      
    } catch (error: any) {
      console.error('Sign in error:', error);
      throw error;
    }
  };

  /**
   * Sign up with comprehensive user creation
   */
  const signUp = async (
    username: string, 
    email: string, 
    password: string, 
    profilePic?: string
  ): Promise<void> => {
    try {
      // Validate username uniqueness
      const usersRef = collection(db, 'users');
      const q = query(usersRef, where('username', '==', username.trim()));
      const querySnapshot = await getDocs(q);
      
      if (!querySnapshot.empty) {
        throw new Error('Username already taken');
      }

      // Create Firebase Auth user
      const userCredential = await createUserWithEmailAndPassword(auth, email.trim(), password);
      const firebaseUser = userCredential.user;

      // Update Firebase Auth profile
      await firebaseUpdateProfile(firebaseUser, {
        displayName: username.trim(),
        photoURL: profilePic || '',
      });

      // Create user profile in Firestore
      const trimmedUsername = username.trim();
      const userProfile: UserProfile = {
        uid: firebaseUser.uid,
        username: trimmedUsername,
        email: firebaseUser.email!,
        displayName: trimmedUsername,
        profilePic: profilePic || '',
        createdAt: serverTimestamp(),
        investmentsPublic: true,
        searchable: true,
      };

      await setDoc(doc(db, 'users', firebaseUser.uid), userProfile);
      
    } catch (error: any) {
      console.error('Sign up error:', error);
      throw error;
    }
  };

  /**
   * Sign out user
   */
  const logout = async (): Promise<void> => {
    try {
      await signOut(auth);
    } catch (error: any) {
      console.error('Logout error:', error);
      throw error;
    }
  };

  /**
   * Update user profile in Firestore
   */
  const updateUserProfile = async (updates: Partial<UserProfile>): Promise<void> => {
    if (!user || !userProfile) {
      throw new Error('User not authenticated');
    }

    try {
      // Update Firestore document
      await updateDoc(doc(db, 'users', user.uid), updates);
      
      // Update local state
      setUserProfile(prev => prev ? { ...prev, ...updates } : null);
      
      // Update Firebase Auth profile if display name or photo changed
      if (updates.displayName || updates.profilePic !== undefined) {
        await firebaseUpdateProfile(user, {
          displayName: updates.displayName || user.displayName,
          photoURL: updates.profilePic !== undefined ? updates.profilePic : user.photoURL,
        });
      }
      
    } catch (error: any) {
      console.error('Profile update error:', error);
      throw error;
    }
  };

  /**
   * Refresh user profile from Firestore
   */
  const refreshUserProfile = async (): Promise<void> => {
    if (!user) {
      throw new Error('User not authenticated');
    }

    await loadUserProfile(user.uid);
  };

  /**
   * Check if user is authenticated
   */
  const isAuthenticated = !!user;

  /**
   * Require authentication (throws error if not authenticated)
   */
  const requireAuth = (): boolean => {
    if (!user) {
      throw new Error('Authentication required');
    }
    return true;
  };

  // Context value
  const value: AuthContextType = {
    // State
    user,
    userProfile,
    loading,
    
    // Actions
    signIn,
    signUp,
    logout,
    
    // Profile management
    updateUserProfile,
    refreshUserProfile,
    
    // Utilities
    isAuthenticated,
    requireAuth,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

/**
 * LEARNING NOTE: Custom Hook for Context Consumption
 * Provides type-safe access to auth context with error handling
 */
export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  
  return context;
};

/**
 * LEARNING NOTE: Authentication Status Hook
 * Convenient hook for components that only need to know auth status
 */
export const useAuthStatus = () => {
  const { user, loading, isAuthenticated } = useAuth();
  
  return {
    user,
    loading,
    isAuthenticated,
    isGuest: !isAuthenticated && !loading,
  };
};

/**
 * LEARNING NOTE: Require Authentication Hook
 * Hook for components that require authentication
 */
export const useRequireAuth = () => {
  const { user, loading, requireAuth } = useAuth();
  
  useEffect(() => {
    if (!loading && !user) {
      console.warn('Authentication required but user not authenticated');
    }
  }, [user, loading]);
  
  return {
    user,
    loading,
    requireAuth,
    isAuthenticated: !!user,
  };
};