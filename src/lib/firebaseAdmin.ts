// src/lib/firebaseAdmin.ts
import admin from 'firebase-admin'

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId:     process.env.FIREBASE_PROJECT_ID,
      clientEmail:   process.env.FIREBASE_CLIENT_EMAIL,
      // note: replace literal `\n` into actual newlines in your env var
      privateKey:    process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    }),
    storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
  })
}

export const firestore = admin.firestore()
export const bucket    = admin.storage().bucket(process.env.FIREBASE_STORAGE_BUCKET!);
