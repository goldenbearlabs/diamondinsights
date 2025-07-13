/**
 * DiamondInsights Mobile App - Entry Point
 * 
 * LEARNING NOTES: App Architecture
 * 1. This demonstrates a simple mobile app structure
 * 2. Shows how to use custom components
 * 3. Demonstrates scrollable lists with sample data
 * 4. Uses our shared types and utilities
 * 5. Mobile-first responsive design patterns
 */

import { StatusBar } from 'expo-status-bar';
import { StyleSheet, Text, View, ScrollView, SafeAreaView } from 'react-native';
import { useState } from 'react';

// Import our custom components and utilities
import { PlayerCard } from './src/components/PlayerCard';
import { platformUtils } from './src/utils';

export default function App() {
  /**
   * LEARNING NOTE: Sample Data Structure
   * In a real app, this would come from API calls
   * Notice how it matches our shared types from the web app
   */
  const [samplePlayers] = useState([
    {
      id: '1',
      name: 'Aaron Judge',
      currentRating: 89,
      predictedRating: 92,
      confidence: 87,
      imageUrl: undefined, // Will use placeholder
    },
    {
      id: '2', 
      name: 'Fernando Tatis Jr.',
      currentRating: 91,
      predictedRating: 94,
      confidence: 92,
    },
    {
      id: '3',
      name: 'Mike Trout',
      currentRating: 93,
      predictedRating: 91,
      confidence: 78,
    }
  ]);

  /**
   * LEARNING NOTE: Event Handlers
   * These work exactly the same as React web
   */
  const handlePlayerPress = (playerId: string, playerName: string) => {
    console.log(`Player ${playerName} (${playerId}) was pressed!`);
    // In a real app, this would navigate to player details
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* 
        LEARNING NOTE: SafeAreaView
        Ensures content doesn't overlap with status bar or home indicator
        Essential for modern mobile devices with notches
      */}
      
      <View style={styles.header}>
        <Text style={styles.title}>DiamondInsights</Text>
        <Text style={styles.subtitle}>AI-Powered Baseball Predictions</Text>
      </View>
      
      {/* 
        LEARNING NOTE: ScrollView vs FlatList
        - ScrollView: Good for small, fixed lists
        - FlatList: Better for large, dynamic lists (performance optimized)
        We'll use ScrollView here for simplicity
      */}
      <ScrollView 
        style={styles.scrollContainer}
        showsVerticalScrollIndicator={false} // Hide scroll indicator for cleaner look
      >
        <Text style={styles.sectionTitle}>Featured Players</Text>
        
        {samplePlayers.map((player) => (
          <PlayerCard
            key={player.id}
            title={player.name}
            playerName={player.name}
            currentRating={player.currentRating}
            predictedRating={player.predictedRating}
            confidence={player.confidence}
            imageUrl={player.imageUrl}
            onPress={() => handlePlayerPress(player.id, player.name)}
          />
        ))}
        
        {/* Add some bottom padding for better scrolling experience */}
        <View style={styles.bottomPadding} />
      </ScrollView>
      
      <StatusBar style="auto" />
    </SafeAreaView>
  );
}

/**
 * LEARNING NOTES: Mobile App Styling Patterns
 * 
 * 1. Use SafeAreaView to handle device-specific safe areas
 * 2. Flex layouts adapt to different screen sizes
 * 3. ScrollView enables content longer than screen height
 * 4. Consistent spacing and typography create professional feel
 * 5. Platform-aware styling (shadows vs elevation)
 */
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc', // Very light gray background
  },
  
  header: {
    backgroundColor: 'white',
    paddingVertical: 20,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
    // Add platform-specific styling
    ...platformUtils.getSafeAreaPadding(),
  },
  
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#1a365d',
    textAlign: 'center',
  },
  
  subtitle: {
    fontSize: 16,
    color: '#64748b',
    textAlign: 'center',
    marginTop: 4,
  },
  
  scrollContainer: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  
  sectionTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#374151',
    marginTop: 20,
    marginBottom: 12,
    marginHorizontal: 20,
  },
  
  bottomPadding: {
    height: 20, // Extra space at bottom for better scroll experience
  },
});
