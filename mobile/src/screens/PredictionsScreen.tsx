/**
 * PredictionsScreen - AI Predictions Dashboard
 * 
 * LEARNING NOTES: Data-Heavy Mobile Screens
 * 
 * This screen demonstrates:
 * 1. List-based UI patterns for mobile
 * 2. Search and filter functionality
 * 3. Performance optimization for large datasets
 * 4. Loading states and error handling
 * 5. Infinite scroll patterns
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  FlatList,
  TextInput,
  TouchableOpacity,
  RefreshControl,
} from 'react-native';

// Import our custom components
import { PlayerCard } from '../components/PlayerCard';

/**
 * LEARNING NOTE: Screen State Management
 * Screens often need to manage multiple pieces of state:
 * - Data (predictions list)
 * - UI state (loading, refreshing, search)
 * - User interactions (search text, filters)
 */
interface Prediction {
  id: string;
  name: string;
  currentRating: number;
  predictedRating: number;
  confidence: number;
  trend: 'up' | 'down' | 'stable';
  lastUpdated: string;
}

export const PredictionsScreen: React.FC = () => {
  // Sample data - will be replaced with API calls
  const [allPredictions] = useState<Prediction[]>([
    {
      id: '1',
      name: 'Aaron Judge',
      currentRating: 89,
      predictedRating: 92,
      confidence: 87,
      trend: 'up',
      lastUpdated: '2 hours ago',
    },
    {
      id: '2',
      name: 'Fernando Tatis Jr.',
      currentRating: 91,
      predictedRating: 94,
      confidence: 92,
      trend: 'up',
      lastUpdated: '1 hour ago',
    },
    {
      id: '3',
      name: 'Mike Trout',
      currentRating: 93,
      predictedRating: 91,
      confidence: 78,
      trend: 'down',
      lastUpdated: '3 hours ago',
    },
    {
      id: '4',
      name: 'Mookie Betts',
      currentRating: 88,
      predictedRating: 90,
      confidence: 84,
      trend: 'up',
      lastUpdated: '1 hour ago',
    },
    {
      id: '5',
      name: 'Shohei Ohtani',
      currentRating: 95,
      predictedRating: 95,
      confidence: 91,
      trend: 'stable',
      lastUpdated: '30 minutes ago',
    },
  ]);

  // UI state
  const [searchText, setSearchText] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [selectedFilter, setSelectedFilter] = useState<'all' | 'up' | 'down'>('all');

  /**
   * LEARNING NOTE: Data Filtering
   * Mobile apps need efficient filtering for good performance
   */
  const filteredPredictions = allPredictions.filter(prediction => {
    const matchesSearch = prediction.name.toLowerCase().includes(searchText.toLowerCase());
    const matchesFilter = selectedFilter === 'all' || prediction.trend === selectedFilter;
    return matchesSearch && matchesFilter;
  });

  /**
   * LEARNING NOTE: Pull-to-Refresh
   * Essential pattern for updating data on mobile
   */
  const onRefresh = async () => {
    setRefreshing(true);
    // TODO: Fetch latest predictions from API
    setTimeout(() => {
      setRefreshing(false);
    }, 1000);
  };

  /**
   * LEARNING NOTE: Navigation Handlers
   * Will be updated to use React Navigation
   */
  const handlePlayerPress = (playerId: string, playerName: string) => {
    console.log(`Navigate to player ${playerName} details`);
    // TODO: Navigate to PlayerDetail screen
  };

  /**
   * LEARNING NOTE: FlatList Rendering
   * FlatList is optimized for large lists - only renders visible items
   */
  const renderPredictionItem = ({ item }: { item: Prediction }) => (
    <PlayerCard
      title={item.name}
      playerName={item.name}
      currentRating={item.currentRating}
      predictedRating={item.predictedRating}
      confidence={item.confidence}
      onPress={() => handlePlayerPress(item.id, item.name)}
    />
  );

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>AI Predictions</Text>
        <Text style={styles.subtitle}>Latest player rating predictions</Text>
      </View>

      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <TextInput
          style={styles.searchInput}
          placeholder="Search players..."
          value={searchText}
          onChangeText={setSearchText}
          autoCapitalize="words"
          autoCorrect={false}
        />
      </View>

      {/* Filter Buttons */}
      <View style={styles.filterContainer}>
        <TouchableOpacity 
          style={[styles.filterButton, selectedFilter === 'all' && styles.filterButtonActive]}
          onPress={() => setSelectedFilter('all')}
        >
          <Text style={[styles.filterText, selectedFilter === 'all' && styles.filterTextActive]}>
            All
          </Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={[styles.filterButton, selectedFilter === 'up' && styles.filterButtonActive]}
          onPress={() => setSelectedFilter('up')}
        >
          <Text style={[styles.filterText, selectedFilter === 'up' && styles.filterTextActive]}>
            Trending Up
          </Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={[styles.filterButton, selectedFilter === 'down' && styles.filterButtonActive]}
          onPress={() => setSelectedFilter('down')}
        >
          <Text style={[styles.filterText, selectedFilter === 'down' && styles.filterTextActive]}>
            Trending Down
          </Text>
        </TouchableOpacity>
      </View>

      {/* Results Count */}
      <View style={styles.resultsContainer}>
        <Text style={styles.resultsText}>
          {filteredPredictions.length} predictions found
        </Text>
      </View>

      {/* Predictions List */}
      <FlatList
        data={filteredPredictions}
        renderItem={renderPredictionItem}
        keyExtractor={(item) => item.id}
        style={styles.list}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.listContent}
      />
    </SafeAreaView>
  );
};

/**
 * LEARNING NOTES: List Screen Styling
 * 
 * Key considerations for data-heavy screens:
 * 1. Clear search and filter controls
 * 2. Consistent spacing between list items
 * 3. Performance-optimized scrolling
 * 4. Visual feedback for active filters
 * 5. Proper keyboard handling for search
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
  
  searchContainer: {
    backgroundColor: 'white',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  
  searchInput: {
    backgroundColor: '#f1f5f9',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
    fontSize: 16,
    color: '#374151',
  },
  
  filterContainer: {
    flexDirection: 'row',
    backgroundColor: 'white',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  
  filterButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#f1f5f9',
    marginRight: 8,
  },
  
  filterButtonActive: {
    backgroundColor: '#3b82f6',
  },
  
  filterText: {
    fontSize: 14,
    color: '#64748b',
    fontWeight: '500',
  },
  
  filterTextActive: {
    color: 'white',
  },
  
  resultsContainer: {
    backgroundColor: 'white',
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  
  resultsText: {
    fontSize: 14,
    color: '#64748b',
  },
  
  list: {
    flex: 1,
  },
  
  listContent: {
    paddingBottom: 20,
  },
});