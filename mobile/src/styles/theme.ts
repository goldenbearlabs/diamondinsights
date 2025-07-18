/**
 * DiamondInsights Mobile Design System
 * 
 * LEARNING NOTES: Design System for Mobile
 * 
 * This demonstrates:
 * 1. Extracting design tokens from web app
 * 2. Creating consistent styling across mobile screens
 * 3. Typography, colors, and spacing systems
 * 4. Platform-specific adaptations
 * 5. Theme consistency between web and mobile
 */

import { Platform } from 'react-native';

/**
 * LEARNING NOTE: Color System
 * 
 * Extracted from your website's CSS variables to ensure
 * brand consistency across web and mobile platforms
 */
export const colors = {
  // Background colors (matching your dark theme)
  background: {
    dark: '#1a1a1a',      // --bg-dark
    medium: '#252525',     // --bg-medium  
    light: '#303030',      // --bg-light
  },
  
  // Primary brand colors
  primary: {
    main: '#1263dd',       // --accent-primary (your main blue)
    light: '#4285f4',      // Lighter variant for hover states
    dark: '#0d52bd',       // Darker variant for pressed states
  },
  
  // Secondary/accent colors
  secondary: {
    main: '#e5e4e2',       // --accent-secondary
    light: '#f5f5f3',      // Lighter variant
    dark: '#d5d4d2',       // Darker variant
  },
  
  // Text colors
  text: {
    primary: '#e8e8e8',    // --text-primary
    secondary: '#b0b0b0',  // --text-secondary
    disabled: '#6b7280',   // For disabled states
    inverse: '#1a1a1a',    // For text on light backgrounds
  },
  
  // Status colors
  success: '#4CAF50',      // --positive (green)
  error: '#F44336',        // --negative (red)
  warning: '#ff9800',      // Orange for warnings
  info: '#2196f3',         // Blue for info
  
  // Chart/meter colors (for predictions)
  chart: {
    up: '#4db8b8',         // --meter-new-up (teal)
    down: '#ff6b6b',       // --meter-new-down (red)
    neutral: '#b0b0b0',    // For stable predictions
  },
  
  // UI element colors
  surface: {
    elevated: '#2a2a2a',   // Cards, modals
    pressed: '#3a3a3a',    // Button pressed states
    disabled: '#404040',   // Disabled components
  },
  
  // Border and divider colors
  border: {
    primary: '#404040',    // Main borders
    secondary: '#353535',  // Subtle dividers
    focus: '#1263dd',      // Focused input borders
  },
  
  // Transparent overlays
  overlay: {
    light: 'rgba(0, 0, 0, 0.1)',
    medium: 'rgba(0, 0, 0, 0.3)',
    heavy: 'rgba(0, 0, 0, 0.7)',
  },
};

/**
 * LEARNING NOTE: Typography System
 * 
 * Mobile typography needs to be readable at various sizes
 * and should match your web app's font choices
 */
export const typography = {
  // Font family (matching your website)
  fontFamily: {
    regular: Platform.OS === 'ios' ? 'System' : 'Roboto', // Will fall back to system fonts
    medium: Platform.OS === 'ios' ? 'System' : 'Roboto-Medium',
    bold: Platform.OS === 'ios' ? 'System' : 'Roboto-Bold',
  },
  
  // Font sizes (mobile-optimized)
  fontSize: {
    xs: 12,
    sm: 14,
    base: 16,
    lg: 18,
    xl: 20,
    '2xl': 24,
    '3xl': 28,
    '4xl': 32,
    '5xl': 36,
  },
  
  // Font weights
  fontWeight: {
    normal: '400',
    medium: '500',
    semibold: '600',
    bold: '700',
  },
  
  // Line heights (matching your CSS line-height: 1.6)
  lineHeight: {
    tight: 1.2,
    normal: 1.6,
    relaxed: 1.8,
  },
};

/**
 * LEARNING NOTE: Spacing System
 * 
 * Consistent spacing creates visual hierarchy
 * and professional appearance
 */
export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  '2xl': 24,
  '3xl': 32,
  '4xl': 40,
  '5xl': 48,
  '6xl': 64,
};

/**
 * LEARNING NOTE: Border Radius System
 * 
 * Consistent border radius (matching your CSS --border-radius: 8px)
 */
export const borderRadius = {
  none: 0,
  sm: 4,
  md: 8,        // Your default border radius
  lg: 12,
  xl: 16,
  full: 9999,   // For circular elements
};

/**
 * LEARNING NOTE: Shadow System
 * 
 * Platform-specific shadows for elevated surfaces
 */
export const shadows = {
  small: Platform.select({
    ios: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.1,
      shadowRadius: 2,
    },
    android: {
      elevation: 2,
    },
  }),
  
  medium: Platform.select({
    ios: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
    },
    android: {
      elevation: 4,
    },
  }),
  
  large: Platform.select({
    ios: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.15,
      shadowRadius: 8,
    },
    android: {
      elevation: 8,
    },
  }),
};

/**
 * LEARNING NOTE: Component Variants
 * 
 * Pre-defined style combinations for common UI patterns
 */
export const variants = {
  // Card variants
  card: {
    elevated: {
      backgroundColor: colors.surface.elevated,
      borderRadius: borderRadius.md,
      ...shadows.medium,
    },
    flat: {
      backgroundColor: colors.surface.elevated,
      borderRadius: borderRadius.md,
      borderWidth: 1,
      borderColor: colors.border.secondary,
    },
  },
  
  // Button variants
  button: {
    primary: {
      backgroundColor: colors.primary.main,
      borderRadius: borderRadius.md,
    },
    secondary: {
      backgroundColor: colors.surface.elevated,
      borderRadius: borderRadius.md,
      borderWidth: 1,
      borderColor: colors.border.primary,
    },
    ghost: {
      backgroundColor: 'transparent',
      borderRadius: borderRadius.md,
    },
  },
};

/**
 * LEARNING NOTE: Theme Export
 * 
 * Single export containing all design tokens
 * Makes it easy to import and use throughout the app
 */
export const theme = {
  colors,
  typography,
  spacing,
  borderRadius,
  shadows,
  variants,
};

/**
 * LEARNING NOTES: Design System Best Practices
 * 
 * Key principles for mobile design systems:
 * 1. **Consistency**: Same colors and spacing throughout app
 * 2. **Accessibility**: Proper contrast ratios and touch targets
 * 3. **Platform Awareness**: iOS vs Android design differences
 * 4. **Scalability**: Easy to add new colors or adjust spacing
 * 5. **Brand Alignment**: Matches web app for cohesive experience
 * 6. **Typography**: Readable at various sizes and contexts
 * 7. **Flexibility**: Variants for different use cases
 */