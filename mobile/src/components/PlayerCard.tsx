/**
 * PlayerCard Component - Mobile Version
 * 
 * LEARNING NOTES: React Native Component Patterns
 * 
 * This demonstrates key concepts:
 * 1. How to create reusable mobile components
 * 2. Props interface patterns for type safety
 * 3. Mobile-specific styling approaches
 * 4. Touch interactions and feedback
 * 5. Platform-specific behavior
 */

import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Image,
} from 'react-native';

// Import our custom types
import { MobileCardProps } from '../types';

/**
 * PlayerCard Props Interface
 * LEARNING NOTE: Always define props interfaces for type safety
 */
interface PlayerCardProps extends MobileCardProps {
  playerName: string;
  currentRating: number;
  predictedRating: number;
  confidence: number;
  imageUrl?: string;
  onPress?: () => void;
}

/**
 * PlayerCard Component
 * 
 * LEARNING NOTE: Functional Components
 * React Native uses the same functional component pattern as React web,
 * but with mobile-specific components and styling
 */
export const PlayerCard: React.FC<PlayerCardProps> = ({
  playerName,
  currentRating,
  predictedRating,
  confidence,
  imageUrl,
  onPress,
  isLoading = false,
}) => {
  
  /**
   * Calculate rating change for visual feedback
   * LEARNING NOTE: Business logic works the same as web React
   */
  const ratingChange = predictedRating - currentRating;
  const isIncrease = ratingChange > 0;
  
  /**
   * LEARNING NOTE: Conditional Styling
   * Mobile apps often use dynamic styling based on data
   */
  const ratingChangeStyle = [
    styles.ratingChange,
    isIncrease ? styles.ratingIncrease : styles.ratingDecrease,
  ];

  return (
    <TouchableOpacity 
      style={styles.card} 
      onPress={onPress}
      activeOpacity={0.7} // Provides visual feedback when pressed
      disabled={isLoading}
    >
      {/* 
        LEARNING NOTE: Layout Structure
        Mobile layouts often use flex for responsive design
      */}
      <View style={styles.cardContent}>
        
        {/* Player Image Section */}
        <View style={styles.imageContainer}>
          {imageUrl ? (
            <Image 
              source={{ uri: imageUrl }} 
              style={styles.playerImage}
              // Removed defaultSource temporarily to fix require() error
              // Will implement proper fallback handling later
            />
          ) : (
            <View style={styles.imagePlaceholder}>
              <Text style={styles.placeholderText}>⚾</Text>
            </View>
          )}
        </View>
        
        {/* Player Info Section */}
        <View style={styles.infoContainer}>
          <Text style={styles.playerName}>{playerName}</Text>
          
          {/* Rating Comparison */}
          <View style={styles.ratingContainer}>
            <View style={styles.ratingBox}>
              <Text style={styles.ratingLabel}>Current</Text>
              <Text style={styles.ratingValue}>{currentRating}</Text>
            </View>
            
            <Text style={styles.arrow}>→</Text>
            
            <View style={styles.ratingBox}>
              <Text style={styles.ratingLabel}>Predicted</Text>
              <Text style={styles.ratingValue}>{predictedRating}</Text>
            </View>
          </View>
          
          {/* Rating Change Indicator */}
          <Text style={ratingChangeStyle}>
            {isIncrease ? '+' : ''}{ratingChange.toFixed(1)}
          </Text>
          
          {/* Confidence Badge */}
          <View style={styles.confidenceBadge}>
            <Text style={styles.confidenceText}>{confidence}% Confidence</Text>
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
};

/**
 * LEARNING NOTES: Mobile Styling Best Practices
 * 
 * 1. Use StyleSheet.create() for performance optimization
 * 2. Design for touch targets (minimum 44x44 points)
 * 3. Use flexible layouts that work on different screen sizes
 * 4. Consider dark mode and accessibility
 * 5. Platform-specific styling when needed
 */
const styles = StyleSheet.create({
  card: {
    backgroundColor: 'white',
    borderRadius: 12,
    margin: 8,
    // Shadow for iOS
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    // Elevation for Android
    elevation: 3,
  },
  
  cardContent: {
    flexDirection: 'row', // Horizontal layout
    padding: 16,
    alignItems: 'center',
  },
  
  imageContainer: {
    marginRight: 16,
  },
  
  playerImage: {
    width: 60,
    height: 60,
    borderRadius: 30, // Circular image
  },
  
  imagePlaceholder: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#e2e8f0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  
  placeholderText: {
    fontSize: 24,
    color: '#64748b',
    fontWeight: 'bold',
  },
  
  infoContainer: {
    flex: 1, // Takes remaining space
  },
  
  playerName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1a202c',
    marginBottom: 8,
  },
  
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  
  ratingBox: {
    alignItems: 'center',
    minWidth: 60,
  },
  
  ratingLabel: {
    fontSize: 12,
    color: '#64748b',
    textTransform: 'uppercase',
  },
  
  ratingValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#2d3748',
  },
  
  arrow: {
    marginHorizontal: 12,
    fontSize: 18,
    color: '#64748b',
  },
  
  ratingChange: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  
  ratingIncrease: {
    color: '#059669', // Green for increases
  },
  
  ratingDecrease: {
    color: '#dc2626', // Red for decreases
  },
  
  confidenceBadge: {
    backgroundColor: '#e0f2fe',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    alignSelf: 'flex-start', // Only takes needed width
  },
  
  confidenceText: {
    fontSize: 12,
    color: '#0369a1',
    fontWeight: '500',
  },
});