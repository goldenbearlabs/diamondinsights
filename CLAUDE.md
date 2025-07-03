# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

DiamondInsights is a Next.js application that provides AI-powered roster predictions for MLB The Show. The app helps users make informed investment decisions by predicting player rating changes using machine learning models.

## Development Commands

### Core Commands
- `npm run dev` - Start development server (http://localhost:3000)
- `npm run build` - Build production bundle
- `npm run start` - Start production server
- `npm run lint` - Run ESLint

### Testing
No test framework is currently configured. Check with the team before adding tests.

## Architecture Overview

### Tech Stack
- **Framework**: Next.js 15.3.4 with App Router
- **Database**: Firebase Firestore (server-side via firebase-admin)
- **Authentication**: Firebase Auth (client-side)
- **Storage**: Firebase Storage
- **Styling**: CSS Modules
- **Icons**: React Icons (FA5/FA6)

### Directory Structure
```
src/
├── app/                    # Next.js App Router pages
│   ├── api/               # API routes
│   │   ├── cards/         # Player card endpoints
│   │   ├── chat/          # Chat/community features
│   │   ├── comments/      # Comment system
│   │   ├── investments/   # Investment tracking
│   │   └── users/         # User management
│   ├── account/           # User account pages
│   ├── community/         # Community features
│   ├── investment/        # Investment tracking UI
│   ├── login/            # Authentication
│   ├── player/           # Individual player pages
│   ├── predictions/      # Predictions dashboard
│   └── signup/           # User registration
├── components/           # Reusable React components
└── lib/                 # Utility libraries
    ├── firebaseAdmin.ts  # Server-side Firebase config
    └── firebaseClient.ts # Client-side Firebase config
```

### Firebase Configuration

**Server-side (firebaseAdmin.ts)**:
- Uses service account credentials via environment variables
- Exports `firestore` for database operations
- Exports `bucket` for storage operations

**Client-side (firebaseClient.ts)**:
- Uses public Firebase config via NEXT_PUBLIC_* environment variables
- Exports `auth`, `db`, and `storage` instances

### Required Environment Variables

**Server-side**:
- `FIREBASE_PROJECT_ID`
- `FIREBASE_CLIENT_EMAIL`
- `FIREBASE_PRIVATE_KEY` (with \n escape sequences)
- `FIREBASE_STORAGE_BUCKET`

**Client-side**:
- `NEXT_PUBLIC_FIREBASE_API_KEY`
- `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`
- `NEXT_PUBLIC_FIREBASE_PROJECT_ID`
- `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`
- `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`
- `NEXT_PUBLIC_FIREBASE_APP_ID`

### Data Model

**Cards Collection Structure**:
- `/cards/{cardId}` - Player card data
- `/cards/{cardId}/predictions/latest` - Latest AI predictions with confidence calculations

**API Patterns**:
- GET `/api/cards` - List all player cards
- GET `/api/cards/{cardId}` - Individual player data
- GET `/api/cards/{cardId}/predictions` - Player predictions with confidence percentage
- GET `/api/cards/live` - Live player data for search autocomplete

### Key Features

1. **Player Search**: Autocomplete search in Navbar component fetches from `/api/cards/live`
2. **Predictions**: AI-powered rating predictions with confidence calculations
3. **Investment Tracking**: User-specific investment portfolio management
4. **Community**: Chat and commenting system with likes functionality
5. **Authentication**: Firebase Auth integration with protected routes

### Code Conventions

- Use CSS Modules for component styling (`.module.css`)
- Client components must use `'use client'` directive
- API routes use Next.js App Router conventions
- Firebase operations use proper error handling
- Path alias `@/*` maps to `src/*`

### Authentication Flow

- Unauthenticated users are redirected to `/login` for protected pages
- Account page: `/account/{uid}`
- Investment tracker: `/investment/{uid}`
- Auth state managed via Firebase Auth `onAuthStateChanged`

### Deployment Notes

- Built for Next.js production deployment
- Requires Firebase project setup with Firestore and Authentication enabled
- Uses Firebase Storage for player images (`baked_img` field)