/**
 * Mobile App Utility Functions
 * 
 * LEARNING NOTE: React Native Utility Isolation
 * 
 * We're creating mobile-specific utilities to avoid dependency conflicts.
 * This approach:
 * 1. Keeps React Native dependencies isolated
 * 2. Allows platform-specific optimizations
 * 3. Prevents React version conflicts
 * 4. Makes mobile app easier to debug
 */

// Mobile-specific versions of shared utilities
export const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
};

export const calculateProfitPercentage = (
  currentPrice: number,
  buyPrice: number
): number => {
  if (buyPrice === 0) return 0;
  return ((currentPrice - buyPrice) / buyPrice) * 100;
};

export const formatDate = (timestamp: number): string => {
  return new Date(timestamp).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
};

export const validateEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

/**
 * Mobile-Specific Utility Functions
 */

import { Dimensions, Platform } from 'react-native';

/**
 * Get device screen dimensions
 * LEARNING NOTE: This is mobile-specific - web doesn't have these APIs
 */
export const getScreenDimensions = () => {
  const { width, height } = Dimensions.get('window');
  return { width, height };
};

/**
 * Check if device is a tablet
 * LEARNING NOTE: Mobile apps often need to handle different screen sizes
 */
export const isTablet = () => {
  const { width, height } = getScreenDimensions();
  const aspectRatio = height / width;
  return aspectRatio < 1.6; // Tablets typically have lower aspect ratios
};

/**
 * Platform-specific utilities
 * LEARNING NOTE: Sometimes you need different behavior on iOS vs Android
 */
export const platformUtils = {
  isIOS: Platform.OS === 'ios',
  isAndroid: Platform.OS === 'android',
  
  // iOS status bar is typically 44pt, Android varies
  getStatusBarHeight: () => Platform.OS === 'ios' ? 44 : 24,
  
  // Different platforms have different safe area considerations
  getSafeAreaPadding: () => ({
    paddingTop: Platform.OS === 'ios' ? 44 : 0,
    paddingBottom: Platform.OS === 'ios' ? 34 : 0, // For home indicator
  }),
};

/**
 * Haptic feedback utility
 * LEARNING NOTE: Mobile devices can provide tactile feedback
 */
export const hapticFeedback = {
  light: () => {
    // Will implement with expo-haptics later
    console.log('Light haptic feedback');
  },
  medium: () => {
    console.log('Medium haptic feedback');
  },
  heavy: () => {
    console.log('Heavy haptic feedback');
  },
};