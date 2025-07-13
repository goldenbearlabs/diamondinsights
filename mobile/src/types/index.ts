/**
 * Mobile App Type Definitions
 * 
 * LEARNING NOTE: React Native Dependency Isolation
 * 
 * We're creating mobile-specific types to avoid React version conflicts.
 * In React Native, it's often better to:
 * 1. Isolate mobile dependencies from web dependencies
 * 2. Create platform-specific type definitions
 * 3. Avoid importing from parent monorepo packages initially
 * 4. Focus on mobile-specific patterns and requirements
 */

// Mobile-specific versions of shared types
// These mirror the web app types but are isolated for React Native
export interface PlayerCard {
  id: string;
  name: string;
  ovr: number;
  predicted_rank: number;
  confidence_percentage: number;
  market_price: number;
  baked_img: string;
}

export interface UserInvestment {
  playerUUID: string;
  quantity: number;
  avgBuyPrice: number;
  userProjectedOvr: number;
  createdAt: number;
}

export interface ChatMessage {
  userId: string;
  text: string;
  timestamp: number;
  parentId?: string;
  likedBy: string[];
  playerId?: string;
}

export interface User {
  uid: string;
  email: string;
  username?: string;
  createdAt: number;
}

/**
 * Mobile-Specific Types
 * 
 * These types are unique to the mobile app and handle
 * mobile-specific functionality like navigation, gestures, etc.
 */

// Navigation types for React Navigation
export type RootStackParamList = {
  Home: undefined;
  Login: undefined;
  PlayerDetails: { cardId: string };
  Investments: { userId: string };
  Community: undefined;
};

// Screen props type helper for type-safe navigation
export type ScreenProps<T extends keyof RootStackParamList> = {
  route: { params: RootStackParamList[T] };
  navigation: any; // Will be properly typed when we add React Navigation
};

// Mobile-specific UI component props
export interface MobileCardProps {
  title: string;
  subtitle?: string;
  onPress?: () => void;
  isLoading?: boolean;
}

// Touch gesture types
export interface GestureConfig {
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
  onLongPress?: () => void;
}