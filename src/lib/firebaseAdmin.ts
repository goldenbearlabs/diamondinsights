// src/lib/firebaseAdmin.ts
// Server-side Firebase Admin SDK configuration for elevated database and storage operations
// Used in API routes and server components for admin-level access to Firestore and Storage
// Security: Uses service account credentials with full project permissions
import admin from 'firebase-admin'

// Initialize Firebase Admin SDK with singleton pattern to prevent multiple instances
// Only initialize if no admin apps exist to avoid "already exists" errors
if (!admin.apps.length) {
  admin.initializeApp({
    // Service account credentials for server-side authentication
    credential: admin.credential.cert({
      projectId:     process.env.FIREBASE_PROJECT_ID,      // Firebase project identifier
      clientEmail:   process.env.FIREBASE_CLIENT_EMAIL,    // Service account email
      // Private key requires newline conversion from environment variable format
      // Environment variables can't contain literal newlines, so \n is used as placeholder
      privateKey:    process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    }),
    // Storage bucket configuration for file uploads and downloads
    storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
  })
}

// Export Firestore database instance for server-side database operations
// Used in API routes for user management, investments, comments, and chat data
export const firestore = admin.firestore()

// Export Storage bucket instance for server-side file operations
// Used for profile picture uploads, image processing, and file management
export const bucket    = admin.storage().bucket(process.env.FIREBASE_STORAGE_BUCKET!);
