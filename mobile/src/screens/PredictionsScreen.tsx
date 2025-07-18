/**
 * PredictionsScreen - AI Predictions Dashboard
 * 
 * LEARNING NOTES: Mobile-Optimized Data Interface
 * 
 * This demonstrates mobile-first design for complex data:
 * 1. Card-based layout instead of tables
 * 2. Touch-friendly filters and search
 * 3. Essential data hierarchy
 * 4. Real API integration
 * 5. Performance optimization for large datasets
 */

import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  FlatList,
  TextInput,
  TouchableOpacity,
  RefreshControl,
  Image,
  Dimensions,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';

// Import our design system and API hooks
import { theme } from '../styles/theme';
import { usePlayerCards } from '../hooks/useApi';
import { RootStackParamList } from '../navigation/AppNavigator';

// Get screen dimensions for responsive layout
const { width: screenWidth } = Dimensions.get('window');

// Navigation type
type PredictionsScreenNavigationProp = StackNavigationProp<RootStackParamList, 'Main'>;

/**
 * LEARNING NOTE: Real Data Integration
 * Using the same data structure as the website predictions page
 */
interface PredictionCard {
  id: string;
  name: string;
  ovr: number;
  rarity: string;
  is_hitter: boolean;
  baked_img?: string;
  team?: string;
  display_position?: string;
  
  // Prediction data
  delta_rank_pred: number;
  predicted_rank: number;
  confidence_percentage: number;
  
  // Market data
  market_price?: number;
  qs_pred: number;
  predicted_profit: number;
  predicted_profit_pct: number;
}

export const PredictionsScreen: React.FC = () => {
  const navigation = useNavigation<PredictionsScreenNavigationProp>();
  
  // Real API data integration
  const { 
    data: predictions, 
    isLoading, 
    error, 
    refresh 
  } = usePlayerCards();

  // UI state
  const [searchText, setSearchText] = useState('');
  const [selectedRarity, setSelectedRarity] = useState<'all' | 'diamond' | 'gold' | 'silver' | 'bronze' | 'common'>('all');
  const [selectedType, setSelectedType] = useState<'all' | 'hitters' | 'pitchers'>('all');
  const [sortBy, setSortBy] = useState<'confidence' | 'profit' | 'upgrade' | 'downgrade'>('confidence');
  const [refreshing, setRefreshing] = useState(false);
  
  // Dropdown state
  const [dropdownOpen, setDropdownOpen] = useState<'rarity' | 'type' | 'sort' | null>(null);

  /**
   * LEARNING NOTE: Data Filtering
   * Mobile apps need efficient filtering for good performance
   */
  const filteredPredictions = useMemo(() => {
    if (!predictions) return [];
    
    return predictions.filter(prediction => {
      const matchesSearch = prediction.name?.toLowerCase().includes(searchText.toLowerCase()) ?? false;
      const matchesRarity = selectedRarity === 'all' || prediction.rarity?.toLowerCase() === selectedRarity;
      const matchesType = selectedType === 'all' || 
        (selectedType === 'hitters' && prediction.is_hitter) ||
        (selectedType === 'pitchers' && !prediction.is_hitter);
      
      return matchesSearch && matchesRarity && matchesType;
    });
  }, [predictions, searchText, selectedRarity, selectedType]);

  /**
   * LEARNING NOTE: Data Sorting
   * Sort filtered data based on selected criteria
   */
  const sortedPredictions = useMemo(() => {
    return [...filteredPredictions].sort((a, b) => {
      switch (sortBy) {
        case 'confidence':
          const aConf = typeof a.confidence_percentage === 'number' ? a.confidence_percentage : 0;
          const bConf = typeof b.confidence_percentage === 'number' ? b.confidence_percentage : 0;
          return bConf - aConf;
        case 'profit':
          const aProfit = typeof a.predicted_profit === 'number' ? a.predicted_profit : 0;
          const bProfit = typeof b.predicted_profit === 'number' ? b.predicted_profit : 0;
          return bProfit - aProfit;
        case 'upgrade':
          const aUpgrade = typeof a.delta_rank_pred === 'number' ? a.delta_rank_pred : 0;
          const bUpgrade = typeof b.delta_rank_pred === 'number' ? b.delta_rank_pred : 0;
          return bUpgrade - aUpgrade; // High to low (biggest upgrades first)
        case 'downgrade':
          const aDowngrade = typeof a.delta_rank_pred === 'number' ? a.delta_rank_pred : 0;
          const bDowngrade = typeof b.delta_rank_pred === 'number' ? b.delta_rank_pred : 0;
          return aDowngrade - bDowngrade; // Low to high (biggest downgrades first)
        default:
          return 0;
      }
    });
  }, [filteredPredictions, sortBy]);

  /**
   * LEARNING NOTE: Pull-to-Refresh
   * Essential pattern for updating data on mobile
   */
  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await refresh();
    } catch (error) {
      console.error('Failed to refresh predictions:', error);
    } finally {
      setRefreshing(false);
    }
  };

  /**
   * LEARNING NOTE: Navigation Handlers
   * Navigate to PlayerDetail screen with player data
   */
  const handlePlayerPress = (playerId: string, playerName: string) => {
    navigation.navigate('PlayerDetail', {
      playerId: playerId,
      playerName: playerName,
    });
  };

  /**
   * LEARNING NOTE: Card Component
   * Mobile-optimized card showing essential prediction data
   */
  const PredictionCard: React.FC<{ item: PredictionCard }> = ({ item }) => {
    const deltaRank = typeof item.delta_rank_pred === 'number' ? item.delta_rank_pred : 0;
    const changeColor = deltaRank > 0 ? '#10b981' : deltaRank < 0 ? '#ef4444' : '#64748b';
    const changeIcon = deltaRank > 0 ? 'trending-up' : deltaRank < 0 ? 'trending-down' : 'remove';
    
    return (
      <TouchableOpacity 
        style={styles.predictionCard}
        onPress={() => handlePlayerPress(item.id, item.name)}
        activeOpacity={0.7}
      >
        {/* Player Image & Basic Info */}
        <View style={styles.cardHeader}>
          <Image 
            source={{ uri: item.baked_img }} 
            style={styles.playerImage}
            resizeMode="cover"
          />
          <View style={styles.playerInfo}>
            <Text style={styles.playerName} numberOfLines={1}>{item.name || 'Unknown Player'}</Text>
            <Text style={styles.playerDetails}>
              {item.rarity || 'Unknown'} • {item.display_position || 'N/A'} • OVR {item.ovr || 0}
            </Text>
          </View>
          <View style={styles.confidenceContainer}>
            <Text style={styles.confidenceLabel}>Confidence</Text>
            <Text style={styles.confidenceValue}>
              {typeof item.confidence_percentage === 'number' ? item.confidence_percentage.toFixed(1) : '0.0'}%
            </Text>
          </View>
        </View>

        {/* Prediction Data */}
        <View style={styles.cardBody}>
          <View style={styles.predictionRow}>
            <View style={styles.predictionItem}>
              <Text style={styles.predictionLabel}>Rating Change</Text>
              <View style={styles.changeContainer}>
                <Ionicons name={changeIcon} size={16} color={changeColor} />
                <Text style={[styles.changeValue, { color: changeColor }]}>
                  {deltaRank > 0 ? '+' : ''}{deltaRank.toFixed(1)}
                </Text>
              </View>
            </View>
            
            <View style={styles.predictionItem}>
              <Text style={styles.predictionLabel}>Predicted OVR</Text>
              <Text style={styles.predictionValue}>{item.predicted_rank || 0}</Text>
            </View>
          </View>

          <View style={styles.predictionRow}>
            <View style={styles.predictionItem}>
              <Text style={styles.predictionLabel}>Current Price</Text>
              <Text style={styles.priceValue}>
                {item.market_price ? `${item.market_price.toLocaleString()} stubs` : 'N/A'}
              </Text>
            </View>
            
            <View style={styles.predictionItem}>
              <Text style={styles.predictionLabel}>Predicted Profit</Text>
              <Text style={[styles.profitValue, { 
                color: (typeof item.predicted_profit === 'number' ? item.predicted_profit : 0) > 0 ? '#10b981' : '#ef4444' 
              }]}>
                {(typeof item.predicted_profit === 'number' ? item.predicted_profit : 0) > 0 ? '+' : ''}
                {typeof item.predicted_profit === 'number' ? item.predicted_profit.toLocaleString() : '0'}
                <Text style={styles.profitPercent}>
                  {' '}({typeof item.predicted_profit_pct === 'number' ? item.predicted_profit_pct.toFixed(1) : '0.0'}%)
                </Text>
              </Text>
            </View>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  /**
   * LEARNING NOTE: FlatList Rendering
   * FlatList is optimized for large lists - only renders visible items
   */
  const renderPredictionItem = ({ item }: { item: PredictionCard }) => (
    <PredictionCard item={item} />
  );

  // Loading state
  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.colors.primary.main} />
          <Text style={styles.loadingText}>Loading predictions...</Text>
        </View>
      </SafeAreaView>
    );
  }

  // Error state
  if (error) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle" size={48} color={theme.colors.error} />
          <Text style={styles.errorText}>Failed to load predictions</Text>
          <TouchableOpacity style={styles.retryButton} onPress={() => refresh()}>
            <Text style={styles.retryText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>AI Predictions</Text>
        <Text style={styles.subtitle}>Latest player rating predictions</Text>
      </View>

      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <View style={styles.searchInputContainer}>
          <Ionicons name="search" size={20} color={theme.colors.text.secondary} style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search players..."
            placeholderTextColor={theme.colors.text.secondary}
            value={searchText}
            onChangeText={setSearchText}
            autoCapitalize="words"
            autoCorrect={false}
          />
        </View>
      </View>

      {/* Filters Row */}
      <View style={styles.filtersRow}>
        {/* Rarity Dropdown */}
        <View style={styles.filterGroup}>
          <Text style={styles.filterLabel}>Rarity:</Text>
          <View style={styles.dropdownContainer}>
            <TouchableOpacity 
              style={[styles.dropdown, dropdownOpen === 'rarity' && styles.dropdownActive]}
              onPress={() => setDropdownOpen(dropdownOpen === 'rarity' ? null : 'rarity')}
            >
              <Text style={styles.dropdownText} numberOfLines={1}>
                {selectedRarity === 'all' ? 'All' : selectedRarity.charAt(0).toUpperCase() + selectedRarity.slice(1)}
              </Text>
              <Ionicons 
                name={dropdownOpen === 'rarity' ? "chevron-up" : "chevron-down"} 
                size={16} 
                color={theme.colors.text.secondary} 
              />
            </TouchableOpacity>
            
            {dropdownOpen === 'rarity' && (
              <ScrollView style={styles.dropdownOptions} showsVerticalScrollIndicator={false}>
                {(['all', 'diamond', 'gold', 'silver', 'bronze', 'common'] as const).map((rarity) => (
                  <TouchableOpacity
                    key={rarity}
                    style={[styles.dropdownOption, selectedRarity === rarity && styles.dropdownOptionActive]}
                    onPress={() => {
                      setSelectedRarity(rarity);
                      setDropdownOpen(null);
                    }}
                  >
                    <Text style={[styles.dropdownOptionText, selectedRarity === rarity && styles.dropdownOptionTextActive]}>
                      {rarity === 'all' ? 'All' : rarity.charAt(0).toUpperCase() + rarity.slice(1)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            )}
          </View>
        </View>

        {/* Type Dropdown */}
        <View style={styles.filterGroup}>
          <Text style={styles.filterLabel}>Type:</Text>
          <View style={styles.dropdownContainer}>
            <TouchableOpacity 
              style={[styles.dropdown, dropdownOpen === 'type' && styles.dropdownActive]}
              onPress={() => setDropdownOpen(dropdownOpen === 'type' ? null : 'type')}
            >
              <Text style={styles.dropdownText} numberOfLines={1}>
                {selectedType === 'all' ? 'All' : selectedType.charAt(0).toUpperCase() + selectedType.slice(1)}
              </Text>
              <Ionicons 
                name={dropdownOpen === 'type' ? "chevron-up" : "chevron-down"} 
                size={16} 
                color={theme.colors.text.secondary} 
              />
            </TouchableOpacity>
            
            {dropdownOpen === 'type' && (
              <ScrollView style={styles.dropdownOptions} showsVerticalScrollIndicator={false}>
                {(['all', 'hitters', 'pitchers'] as const).map((type) => (
                  <TouchableOpacity
                    key={type}
                    style={[styles.dropdownOption, selectedType === type && styles.dropdownOptionActive]}
                    onPress={() => {
                      setSelectedType(type);
                      setDropdownOpen(null);
                    }}
                  >
                    <Text style={[styles.dropdownOptionText, selectedType === type && styles.dropdownOptionTextActive]}>
                      {type === 'all' ? 'All' : type.charAt(0).toUpperCase() + type.slice(1)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            )}
          </View>
        </View>

        {/* Sort Dropdown */}
        <View style={styles.filterGroup}>
          <Text style={styles.filterLabel}>Sort:</Text>
          <View style={styles.dropdownContainer}>
            <TouchableOpacity 
              style={[styles.dropdown, dropdownOpen === 'sort' && styles.dropdownActive]}
              onPress={() => setDropdownOpen(dropdownOpen === 'sort' ? null : 'sort')}
            >
              <Text style={styles.dropdownText} numberOfLines={1}>
                {sortBy === 'confidence' ? 'Confidence' : 
                 sortBy === 'profit' ? 'Profit' : 
                 sortBy === 'upgrade' ? 'Upgrade' : 'Downgrade'}
              </Text>
              <Ionicons 
                name={dropdownOpen === 'sort' ? "chevron-up" : "chevron-down"} 
                size={16} 
                color={theme.colors.text.secondary} 
              />
            </TouchableOpacity>
            
            {dropdownOpen === 'sort' && (
              <ScrollView style={styles.dropdownOptions} showsVerticalScrollIndicator={false}>
                {([
                  ['confidence', 'Confidence'], 
                  ['profit', 'Profit'], 
                  ['upgrade', 'Upgrade'],
                  ['downgrade', 'Downgrade']
                ] as const).map(([key, label]) => (
                  <TouchableOpacity
                    key={key}
                    style={[styles.dropdownOption, sortBy === key && styles.dropdownOptionActive]}
                    onPress={() => {
                      setSortBy(key);
                      setDropdownOpen(null);
                    }}
                  >
                    <Text style={[styles.dropdownOptionText, sortBy === key && styles.dropdownOptionTextActive]}>
                      {label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            )}
          </View>
        </View>
      </View>

      {/* Results Count */}
      <View style={styles.resultsContainer}>
        <Text style={styles.resultsText}>
          {sortedPredictions.length} predictions found
        </Text>
      </View>

      {/* Predictions List */}
      <FlatList
        data={sortedPredictions}
        renderItem={renderPredictionItem}
        keyExtractor={(item) => item.id}
        style={styles.list}
        refreshControl={
          <RefreshControl 
            refreshing={refreshing} 
            onRefresh={onRefresh}
            tintColor={theme.colors.primary.main}
          />
        }
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.listContent}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
      />
    </SafeAreaView>
  );
};

/**
 * LEARNING NOTES: Mobile Predictions Styling
 * 
 * Key considerations for mobile data interfaces:
 * 1. Card-based layout for complex data
 * 2. Touch-friendly filter controls
 * 3. Visual hierarchy with proper spacing
 * 4. Brand color integration
 * 5. Performance optimizations
 */
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background.dark,
  },
  
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: theme.colors.background.dark,
  },
  
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: theme.colors.text.secondary,
  },
  
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: theme.colors.background.dark,
  },
  
  errorText: {
    fontSize: 18,
    color: theme.colors.text.secondary,
    marginVertical: 16,
    textAlign: 'center',
  },
  
  retryButton: {
    backgroundColor: theme.colors.primary.main,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  
  retryText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  
  header: {
    backgroundColor: theme.colors.background.medium,
    paddingVertical: 20,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border.primary,
  },
  
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: theme.colors.secondary.main,
    textAlign: 'center',
  },
  
  subtitle: {
    fontSize: 16,
    color: theme.colors.text.secondary,
    textAlign: 'center',
    marginTop: 4,
  },
  
  searchContainer: {
    backgroundColor: theme.colors.background.medium,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border.primary,
  },
  
  searchInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.background.light,
    borderRadius: 8,
    paddingHorizontal: 16,
  },
  
  searchIcon: {
    marginRight: 8,
  },
  
  searchInput: {
    flex: 1,
    paddingVertical: 12,
    fontSize: 16,
    color: theme.colors.text.primary,
  },
  
  filtersRow: {
    backgroundColor: theme.colors.background.medium,
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border.primary,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 8,
  },
  
  filterGroup: {
    flex: 1,
    minWidth: 0, // Allow flex items to shrink below their content width
  },
  
  filterLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.colors.text.secondary,
    marginBottom: 8,
  },
  
  dropdownContainer: {
    position: 'relative',
    zIndex: 1000,
  },
  
  dropdown: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: theme.colors.background.light,
    borderWidth: 1,
    borderColor: theme.colors.border.primary,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  
  dropdownActive: {
    borderColor: theme.colors.primary.main,
    backgroundColor: theme.colors.background.dark,
  },
  
  dropdownText: {
    fontSize: 13,
    color: theme.colors.text.primary,
    fontWeight: '500',
    flex: 1,
  },
  
  dropdownOptions: {
    position: 'absolute',
    top: '100%',
    left: 0,
    right: 0,
    backgroundColor: theme.colors.background.dark,
    borderWidth: 1,
    borderColor: theme.colors.border.primary,
    borderRadius: 8,
    marginTop: 4,
    maxHeight: 200,
    zIndex: 1001,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 5,
  },
  
  dropdownOption: {
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border.primary,
  },
  
  dropdownOptionActive: {
    backgroundColor: theme.colors.primary.main,
  },
  
  dropdownOptionText: {
    fontSize: 14,
    color: theme.colors.text.primary,
    fontWeight: '500',
  },
  
  dropdownOptionTextActive: {
    color: 'white',
  },
  
  resultsContainer: {
    backgroundColor: theme.colors.background.medium,
    paddingHorizontal: 20,
    paddingVertical: 8,
  },
  
  resultsText: {
    fontSize: 14,
    color: theme.colors.text.secondary,
  },
  
  list: {
    flex: 1,
  },
  
  listContent: {
    padding: 16,
  },
  
  separator: {
    height: 12,
  },
  
  // Prediction Card Styles
  predictionCard: {
    backgroundColor: theme.colors.background.medium,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: theme.colors.border.primary,
  },
  
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  
  playerImage: {
    width: 50,
    height: 70,
    borderRadius: 6,
    marginRight: 12,
  },
  
  playerInfo: {
    flex: 1,
  },
  
  playerName: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.text.primary,
    marginBottom: 4,
  },
  
  playerDetails: {
    fontSize: 14,
    color: theme.colors.text.secondary,
  },
  
  confidenceContainer: {
    alignItems: 'flex-end',
  },
  
  confidenceLabel: {
    fontSize: 12,
    color: theme.colors.text.secondary,
    marginBottom: 2,
  },
  
  confidenceValue: {
    fontSize: 16,
    fontWeight: '700',
    color: theme.colors.primary.main,
  },
  
  cardBody: {
    gap: 12,
  },
  
  predictionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 16,
  },
  
  predictionItem: {
    flex: 1,
  },
  
  predictionLabel: {
    fontSize: 12,
    color: theme.colors.text.secondary,
    marginBottom: 4,
  },
  
  changeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  
  changeValue: {
    fontSize: 16,
    fontWeight: '600',
  },
  
  predictionValue: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.text.primary,
  },
  
  priceValue: {
    fontSize: 14,
    fontWeight: '500',
    color: theme.colors.text.primary,
  },
  
  profitValue: {
    fontSize: 16,
    fontWeight: '600',
  },
  
  profitPercent: {
    fontSize: 14,
    fontWeight: '400',
  },
});