/**
 * HomeScreen - Landing Page
 * 
 * LEARNING NOTES: Screen Component Patterns
 * 
 * This demonstrates key mobile screen concepts:
 * 1. SafeAreaView for device-specific safe areas
 * 2. ScrollView for content longer than screen
 * 3. Custom header with branding
 * 4. Featured content sections
 * 5. Navigation to other screens
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
} from 'react-native';

// Import our custom components
import { PlayerCard } from '../components/PlayerCard';

/**
 * HomeScreen Component
 * 
 * LEARNING NOTE: Screen Structure
 * Mobile screens typically follow this pattern:
 * - SafeAreaView wrapper for device compatibility
 * - Custom header with app branding
 * - ScrollView for main content
 * - Pull-to-refresh functionality
 * - Section-based content organization
 */
export const HomeScreen: React.FC = () => {
  // State for refresh functionality
  const [refreshing, setRefreshing] = useState(false);
  
  // Sample data - will be replaced with API calls later
  const [featuredPlayers] = useState([
    {
      id: '1',
      name: 'Aaron Judge',
      currentRating: 89,
      predictedRating: 92,
      confidence: 87,
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
   * LEARNING NOTE: Pull-to-Refresh Pattern
   * Standard mobile UX pattern for refreshing content
   */
  const onRefresh = async () => {
    setRefreshing(true);
    // Simulate API call
    setTimeout(() => {
      setRefreshing(false);
    }, 1000);
  };

  /**
   * LEARNING NOTE: Navigation Handler
   * This will be updated to use React Navigation later
   */
  const handlePlayerPress = (playerId: string, playerName: string) => {
    console.log(`Navigate to player ${playerName} (${playerId})`);
    // TODO: Navigate to PlayerDetail screen
  };

  const handleViewAllPredictions = () => {
    console.log('Navigate to Predictions tab');
    // TODO: Switch to Predictions tab
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Custom Header */}
      <View style={styles.header}>
        <Text style={styles.title}>DiamondInsights</Text>
        <Text style={styles.subtitle}>AI-Powered Baseball Predictions</Text>
      </View>

      {/* Main Content */}
      <ScrollView 
        style={styles.scrollContainer}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* Welcome Section */}
        <View style={styles.welcomeSection}>
          <Text style={styles.welcomeTitle}>Welcome Back!</Text>
          <Text style={styles.welcomeText}>
            Check out the latest AI predictions and investment opportunities
          </Text>
        </View>

        {/* Featured Players Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Featured Players</Text>
            <TouchableOpacity onPress={handleViewAllPredictions}>
              <Text style={styles.viewAllButton}>View All</Text>
            </TouchableOpacity>
          </View>
          
          {featuredPlayers.map((player) => (
            <PlayerCard
              key={player.id}
              title={player.name}
              playerName={player.name}
              currentRating={player.currentRating}
              predictedRating={player.predictedRating}
              confidence={player.confidence}
              onPress={() => handlePlayerPress(player.id, player.name)}
            />
          ))}
        </View>

        {/* Quick Stats Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Today's Highlights</Text>
          
          <View style={styles.statsContainer}>
            <View style={styles.statBox}>
              <Text style={styles.statNumber}>12</Text>
              <Text style={styles.statLabel}>New Predictions</Text>
            </View>
            
            <View style={styles.statBox}>
              <Text style={styles.statNumber}>87%</Text>
              <Text style={styles.statLabel}>Avg Confidence</Text>
            </View>
            
            <View style={styles.statBox}>
              <Text style={styles.statNumber}>+5.2%</Text>
              <Text style={styles.statLabel}>Portfolio Growth</Text>
            </View>
          </View>
        </View>

        {/* Bottom padding for better scroll experience */}
        <View style={styles.bottomPadding} />
      </ScrollView>
    </SafeAreaView>
  );
};

/**
 * LEARNING NOTES: Mobile Screen Styling
 * 
 * Key patterns for mobile screens:
 * 1. Use SafeAreaView to handle device notches/home indicators
 * 2. Consistent spacing and padding for touch-friendly interface
 * 3. Clear visual hierarchy with typography
 * 4. Card-based layouts for easy scanning
 * 5. Proper contrast for outdoor readability
 */
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  
  header: {
    backgroundColor: 'white',
    paddingVertical: 20,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
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
  },
  
  welcomeSection: {
    backgroundColor: 'white',
    margin: 16,
    padding: 20,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  
  welcomeTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1a202c',
    marginBottom: 8,
  },
  
  welcomeText: {
    fontSize: 16,
    color: '#4a5568',
    lineHeight: 22,
  },
  
  section: {
    marginHorizontal: 16,
    marginBottom: 24,
  },
  
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  
  sectionTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#374151',
  },
  
  viewAllButton: {
    fontSize: 16,
    color: '#3b82f6',
    fontWeight: '500',
  },
  
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  
  statBox: {
    backgroundColor: 'white',
    flex: 1,
    marginHorizontal: 4,
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  
  statNumber: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1a202c',
    marginBottom: 4,
  },
  
  statLabel: {
    fontSize: 12,
    color: '#64748b',
    textAlign: 'center',
  },
  
  bottomPadding: {
    height: 20,
  },
});