// src/lib/firebaseClient.ts
// Client-side Firebase SDK configuration for user authentication and real-time data operations
// Used in React components and client-side code for user-facing Firebase features
// Security: Uses public configuration safe for client-side exposure
import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth }    from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage }   from "firebase/storage";

// Firebase client configuration using public environment variables
// NEXT_PUBLIC_ prefix makes these variables safe for client-side use
// These are public configuration values that don't expose sensitive credentials
const firebaseConfig = {
  apiKey:             process.env.NEXT_PUBLIC_FIREBASE_API_KEY!,             // Public API key for Firebase services
  authDomain:         process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN!,         // Authentication domain for OAuth flows
  projectId:          process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID!,          // Firebase project identifier
  storageBucket:      process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET!,      // Storage bucket for file uploads
  messagingSenderId:  process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID!, // Cloud messaging sender ID
  appId:              process.env.NEXT_PUBLIC_FIREBASE_APP_ID!,              // Firebase app identifier
};

// Initialize Firebase app with singleton pattern to prevent multiple instances
// Check if any Firebase apps exist before initializing to avoid conflicts
const app = !getApps().length
  ? initializeApp(firebaseConfig)  // Initialize new app if none exist
  : getApp();                      // Get existing app instance

// Export Firebase Authentication instance for user login/logout and auth state management
// Used throughout the app for user authentication, profile management, and protected routes
export const auth    = getAuth(app);

// Export Firestore database instance for real-time data operations
// Used for user profiles, investments, comments, chat messages, and live data subscriptions
export const db      = getFirestore(app);

// Export Storage instance for client-side file uploads
// Used for profile picture uploads and user-generated content storage
export const storage = getStorage(app);
