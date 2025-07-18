/**
 * Firebase Configuration for Mobile App
 * 
 * LEARNING NOTES: Firebase Mobile Setup
 * 
 * This demonstrates:
 * 1. Firebase SDK initialization for React Native
 * 2. Environment variable handling in mobile apps
 * 3. Service exports for authentication and database
 * 4. Cross-platform compatibility (iOS/Android/Web)
 * 5. Security best practices for mobile Firebase
 */

import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, initializeAuth, getReactNativePersistence } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

// For React Native persistence
import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * LEARNING NOTE: Mobile Firebase Configuration
 * 
 * Mobile apps can use the same Firebase project as web apps
 * but need different configuration for:
 * 1. Authentication persistence (AsyncStorage vs localStorage)
 * 2. Platform-specific features (push notifications, etc.)
 * 3. Bundle optimization (tree shaking)
 */

// Firebase configuration - using same project as web app
const firebaseConfig = {
  apiKey: "AIzaSyAzyyRrIjigUjOjBIiJiInvZbNnivB2zGc",
  authDomain: "theshow-587b1.firebaseapp.com",
  projectId: "theshow-587b1",
  storageBucket: "theshow-587b1.firebasestorage.app",
  messagingSenderId: "841491877742",
  appId: "1:841491877742:web:8366dc78539abafcfebb7f"
};

/**
 * LEARNING NOTE: Environment Variables in Mobile
 * 
 * React Native handles environment variables differently:
 * 1. Create a config file or use react-native-config
 * 2. Can't use process.env directly like in web apps
 * 3. Need to be careful about exposing sensitive data
 * 
 * For this demo, we'll use hardcoded values and explain
 * how to set them up properly in production
 */

// Initialize Firebase app with singleton pattern
let app;
if (getApps().length === 0) {
  app = initializeApp(firebaseConfig);
} else {
  app = getApp();
}

/**
 * LEARNING NOTE: Authentication Setup for Mobile
 * 
 * React Native requires special auth initialization:
 * 1. initializeAuth instead of getAuth for first setup
 * 2. AsyncStorage for persistence across app sessions
 * 3. Handles authentication state automatically
 */
let auth;
try {
  // Try to initialize auth with persistence
  auth = initializeAuth(app, {
    persistence: getReactNativePersistence(AsyncStorage),
  });
} catch (error) {
  // If already initialized, get the existing instance
  auth = getAuth(app);
}

/**
 * LEARNING NOTE: Firestore Mobile Setup
 * 
 * Firestore works the same on mobile as web:
 * 1. Real-time listeners for live data
 * 2. Offline persistence built-in
 * 3. Same security rules apply
 * 4. Optimized for mobile networks
 */
const db = getFirestore(app);

/**
 * LEARNING NOTE: Storage for Mobile
 * 
 * Firebase Storage on mobile:
 * 1. Can upload from camera/photo library
 * 2. Automatic image optimization
 * 3. Progress tracking for uploads
 * 4. Same security rules as web
 */
const storage = getStorage(app);

// Export services for use throughout the app
export { auth, db, storage };

/**
 * LEARNING NOTE: Firebase Services Architecture
 * 
 * Best practices for mobile Firebase:
 * 1. Single configuration file for all services
 * 2. Export instances, not the setup functions
 * 3. Handle initialization errors gracefully
 * 4. Use TypeScript for better development experience
 * 5. Keep configuration secure and environment-specific
 */

/**
 * Helper function to check if Firebase is properly configured
 * Useful for debugging and development
 */
export const isFirebaseConfigured = (): boolean => {
  return (
    firebaseConfig.apiKey.startsWith("AIza") &&
    firebaseConfig.projectId === "theshow-587b1"
  );
};

/**
 * Configuration status for debugging
 */
export const getFirebaseConfig = () => {
  return {
    configured: isFirebaseConfigured(),
    projectId: firebaseConfig.projectId,
    authDomain: firebaseConfig.authDomain,
  };
};