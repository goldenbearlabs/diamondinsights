/**
 * PortfolioScreen - Investment Portfolio Tracker
 * 
 * LEARNING NOTES: Mobile Portfolio Interface
 * 
 * This demonstrates:
 * 1. Real-time investment tracking with API integration
 * 2. Portfolio summary with AI vs user projections
 * 3. Investment management (add, edit, delete)
 * 4. Mobile-optimized card layouts
 * 5. Quick-sell value calculations
 */

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  TextInput,
  Alert,
  ActivityIndicator,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';

// Import design system, API hooks, and authentication
import { theme } from '../styles/theme';
import { useUserInvestments, useInvestmentActions, usePlayerCards } from '../hooks/useApi';
import { qsValue, Investment, apiClient } from '../services/api';
import { RootStackParamList } from '../navigation/AppNavigator';
import { useAuth, useAuthStatus } from '../contexts/AuthContext';

// Navigation type
type PortfolioScreenNavigationProp = StackNavigationProp<RootStackParamList, 'Main'>;

// Sorting options for investments
enum SortOption {
  CREATION_DATE = 'creation',
  CREATION_DATE_ASC = 'creation_asc',
  QUANTITY_DESC = 'quantity_desc', 
  QUANTITY_ASC = 'quantity_asc',
  OVR_DESC = 'ovr_desc',
  OVR_ASC = 'ovr_asc', 
  PRICE_DESC = 'price_desc',
  PRICE_ASC = 'price_asc',
  YOUR_POTENTIAL_DESC = 'your_potential_desc',
  YOUR_POTENTIAL_ASC = 'your_potential_asc',
  AI_POTENTIAL_DESC = 'ai_potential_desc',
  AI_POTENTIAL_ASC = 'ai_potential_asc'
}

// Sort option labels for UI
const SORT_LABELS: Record<SortOption, string> = {
  [SortOption.CREATION_DATE]: 'Newest First',
  [SortOption.CREATION_DATE_ASC]: 'Oldest First',
  [SortOption.QUANTITY_DESC]: 'Quantity ↓',
  [SortOption.QUANTITY_ASC]: 'Quantity ↑',
  [SortOption.OVR_DESC]: 'Player OVR ↓',
  [SortOption.OVR_ASC]: 'Player OVR ↑',
  [SortOption.PRICE_DESC]: 'Avg Buy Price ↓',
  [SortOption.PRICE_ASC]: 'Avg Buy Price ↑',
  [SortOption.YOUR_POTENTIAL_DESC]: 'Your Potential ↓',
  [SortOption.YOUR_POTENTIAL_ASC]: 'Your Potential ↑',
  [SortOption.AI_POTENTIAL_DESC]: 'AI Potential ↓',
  [SortOption.AI_POTENTIAL_ASC]: 'AI Potential ↑',
};

/**
 * Portfolio summary calculation interface
 */
interface PortfolioSummary {
  cost: number;           // Total investment cost
  aiValue: number;        // AI projected portfolio value
  aiProfit: number;       // AI projected profit/loss
  myValue: number;        // User projected portfolio value
  myProfit: number;       // User projected profit/loss
}

export const PortfolioScreen: React.FC = () => {
  const navigation = useNavigation<PortfolioScreenNavigationProp>();
  
  // Authentication state from context
  const { user } = useAuth();
  const { loading: authLoading, isAuthenticated, isGuest } = useAuthStatus();

  // Investment data and actions (only fetch if authenticated)
  const { 
    data: hookInvestments, 
    isLoading: investmentsLoading, 
    error: investmentsError, 
    refresh: refreshInvestments 
  } = useUserInvestments({ immediate: isAuthenticated });

  // Use hook data directly (no optimistic updates)
  const investments = hookInvestments;
  
  const { 
    data: playerCards, 
    isLoading: cardsLoading 
  } = usePlayerCards();
  
  const { 
    createInvestment, 
    updateInvestment, 
    deleteInvestment 
  } = useInvestmentActions();

  // Authentication is now handled by AuthContext

  // UI state
  const [refreshing, setRefreshing] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);
  
  // Toast notification state
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  
  // Portfolio privacy status (public by default, will be controlled from account settings later)
  const [isPublic, setIsPublic] = useState(true);
  
  // Investment sorting state
  const [sortOption, setSortOption] = useState<SortOption>(SortOption.CREATION_DATE);
  const [showSortDropdown, setShowSortDropdown] = useState(false);

  // Add investment form state
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPlayer, setSelectedPlayer] = useState<any | null>(null);
  const [quantity, setQuantity] = useState('');
  const [avgPrice, setAvgPrice] = useState('');
  const [projectedOvr, setProjectedOvr] = useState('');

  // Edit form state
  const [editQuantity, setEditQuantity] = useState('');
  const [editPrice, setEditPrice] = useState('');
  const [editOvr, setEditOvr] = useState('');

  /**
   * Player search filtering for add form
   */
  const searchResults = useMemo(() => {
    if (!playerCards || !searchQuery.trim()) return [];
    return playerCards
      .filter(player => 
        player.name?.toLowerCase().includes(searchQuery.toLowerCase())
      )
      .slice(0, 5);
  }, [playerCards, searchQuery]);

  /**
   * Form validation for add investment
   */
  const canAdd = Boolean(selectedPlayer && quantity && avgPrice && projectedOvr);

  /**
   * Portfolio summary calculations
   */
  const portfolioSummary: PortfolioSummary = useMemo(() => {
    if (!investments || !playerCards) {
      return { cost: 0, aiValue: 0, aiProfit: 0, myValue: 0, myProfit: 0 };
    }

    return investments.reduce((summary, investment) => {
      const playerCard = playerCards.find(card => card.id === investment.playerUUID);
      if (!playerCard) return summary;

      const cost = investment.quantity * investment.avgBuyPrice;
      const aiQsValue = Number(playerCard.qs_pred) || 0;
      const aiValue = investment.quantity * aiQsValue;
      const aiProfit = aiValue - cost;
      
      const myQsValue = qsValue(investment.userProjectedOvr);
      const myValue = investment.quantity * myQsValue;
      const myProfit = myValue - cost;

      return {
        cost: summary.cost + cost,
        aiValue: summary.aiValue + aiValue,
        aiProfit: summary.aiProfit + aiProfit,
        myValue: summary.myValue + myValue,
        myProfit: summary.myProfit + myProfit,
      };
    }, { cost: 0, aiValue: 0, aiProfit: 0, myValue: 0, myProfit: 0 });
  }, [investments, playerCards]);

  /**
   * Pull-to-refresh handler
   */
  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await refreshInvestments(true);
    } catch (error) {
      console.error('Failed to refresh investments:', error);
    } finally {
      setRefreshing(false);
    }
  };

  /**
   * Add investment handler
   */
  const handleAddInvestment = async () => {
    if (!selectedPlayer || !quantity || !avgPrice || !projectedOvr) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }

    try {
      await createInvestment({
        playerUUID: selectedPlayer.id,
        playerName: selectedPlayer.name,
        quantity: parseInt(quantity),
        avgBuyPrice: Math.round(parseFloat(avgPrice)),
        userProjectedOvr: parseInt(projectedOvr),
      });
      
      // Clear form and refresh data
      setSearchQuery('');
      setSelectedPlayer(null);
      setQuantity('');
      setAvgPrice('');
      setProjectedOvr('');
      setShowAddForm(false);
      await refreshInvestments(true);
      
      // Show success notification
      showSuccessToast(`Added ${selectedPlayer.name}`);
    } catch (error) {
      console.error('Failed to add investment:', error);
      Alert.alert('Error', 'Failed to add investment');
    }
  };

  /**
   * Start editing an investment
   */
  const startEdit = (investment: Investment) => {
    setEditingId(investment.id);
    setEditQuantity(String(investment.quantity));
    setEditPrice(String(investment.avgBuyPrice)); // Pre-populate with current price
    setEditOvr(String(investment.userProjectedOvr));
  };

  /**
   * Save investment edits
   */
  const saveEdit = async (investment: Investment) => {
    try {
      // Parse and validate inputs
      const newQty = parseInt(editQuantity);
      const newPrice = parseFloat(editPrice);
      const newOvr = parseInt(editOvr);

      // Validation
      if (isNaN(newQty) || newQty <= 0) {
        Alert.alert('Error', 'Quantity must be a positive number');
        return;
      }
      
      if (isNaN(newPrice) || newPrice <= 0) {
        Alert.alert('Error', 'Average price must be a positive number');
        return;
      }
      
      if (isNaN(newOvr) || newOvr < 50 || newOvr > 99) {
        Alert.alert('Error', 'Overall rating must be between 50 and 99');
        return;
      }

      // Show loading state
      setSavingId(investment.id);

      // 1. Update via API
      await updateInvestment(investment.id, {
        quantity: newQty,
        avgBuyPrice: Math.round(newPrice),
        userProjectedOvr: newOvr,
      });

      // 2. Immediate refresh to get updated data
      await refreshInvestments(true);

      // 3. Show success notification
      const playerCard = playerCards?.find(card => card.id === investment.playerUUID);
      const playerName = investment.playerName || playerCard?.name || 'Player';
      showSuccessToast(`Updated ${playerName}`);

      // 4. Exit edit mode and clear state
      setEditingId(null);
      setEditQuantity('');
      setEditPrice('');
      setEditOvr('');
      setSavingId(null);
    } catch (error) {
      console.error('Failed to update investment:', error);
      Alert.alert('Error', 'Failed to update investment');
      // Clear states on error
      setEditingId(null);
      setEditQuantity('');
      setEditPrice('');
      setEditOvr('');
      setSavingId(null);
    }
  };

  /**
   * Delete investment with confirmation
   */
  const handleDelete = async (investment: Investment) => {
    Alert.alert(
      'Delete Investment',
      `Are you sure you want to delete ${investment.playerName}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteInvestment(investment.id);
              await refreshInvestments(true);
              
              // Show success notification
              const playerCard = playerCards?.find(card => card.id === investment.playerUUID);
              const playerName = investment.playerName || playerCard?.name || 'Player';
              showSuccessToast(`Deleted ${playerName}`);
            } catch (error) {
              console.error('Failed to delete investment:', error);
              Alert.alert('Error', 'Failed to delete investment');
            }
          },
        },
      ]
    );
  };

  /**
   * Navigate to player detail
   */
  const handlePlayerPress = (playerUUID: string, playerName: string) => {
    navigation.navigate('PlayerDetail', {
      playerId: playerUUID,
      playerName: playerName,
    });
  };

  /**
   * Format currency values
   */
  const formatCurrency = (amount: number): string => {
    return amount.toLocaleString();
  };

  /**
   * Format stubs values (no currency symbol, for use with stubs icon)
   */
  const formatStubs = (amount: number): string => {
    return new Intl.NumberFormat('en-US', {
      minimumFractionDigits: 0,
    }).format(amount);
  };

  /**
   * Show success toast notification
   */
  const showSuccessToast = (message: string) => {
    setToastMessage(message);
    setShowToast(true);
    // Auto-dismiss after 3 seconds
    setTimeout(() => {
      setShowToast(false);
      setToastMessage('');
    }, 3000);
  };

  /**
   * Handle projected OVR input validation (1-99 range)
   */
  const handleProjectedOvrChange = (text: string) => {
    // Allow empty string for clearing
    if (text === '') {
      setProjectedOvr('');
      return;
    }
    
    // Only allow numeric characters
    const numericValue = text.replace(/[^0-9]/g, '');
    
    // Convert to number and validate range
    const number = parseInt(numericValue);
    if (!isNaN(number) && number >= 1 && number <= 99) {
      setProjectedOvr(number.toString());
    }
    // If invalid, don't update state (keeps previous valid value)
  };

  /**
   * Handle quantity input validation (1 or greater)
   */
  const handleQuantityChange = (text: string) => {
    // Allow empty string for clearing
    if (text === '') {
      setQuantity('');
      return;
    }
    
    // Only allow numeric characters
    const numericValue = text.replace(/[^0-9]/g, '');
    
    // Convert to number and validate (must be 1 or greater)
    const number = parseInt(numericValue);
    if (!isNaN(number) && number >= 1) {
      setQuantity(number.toString());
    }
    // If invalid (0 or negative), don't update state
  };

  /**
   * Sort investments based on selected option
   */
  const sortInvestments = useCallback((investments: Investment[], sortOption: SortOption) => {
    if (!investments || !playerCards) return investments;

    const sorted = [...investments].sort((a, b) => {
      const playerCardA = playerCards.find(card => card.id === a.playerUUID);
      const playerCardB = playerCards.find(card => card.id === b.playerUUID);

      switch (sortOption) {
        case SortOption.CREATION_DATE:
          // Newest first (default) - convert to numbers for reliable comparison
          return Number(b.createdAt) - Number(a.createdAt);
          
        case SortOption.CREATION_DATE_ASC:
          // Oldest first - convert to numbers for reliable comparison
          return Number(a.createdAt) - Number(b.createdAt);
          
        case SortOption.QUANTITY_DESC:
          return b.quantity - a.quantity;
          
        case SortOption.QUANTITY_ASC:
          return a.quantity - b.quantity;
          
        case SortOption.OVR_DESC:
          const ovrA = Number(playerCardA?.ovr) || 0;
          const ovrB = Number(playerCardB?.ovr) || 0;
          return ovrB - ovrA;
          
        case SortOption.OVR_ASC:
          const ovrA2 = Number(playerCardA?.ovr) || 0;
          const ovrB2 = Number(playerCardB?.ovr) || 0;
          return ovrA2 - ovrB2;
          
        case SortOption.PRICE_DESC:
          return b.avgBuyPrice - a.avgBuyPrice;
          
        case SortOption.PRICE_ASC:
          return a.avgBuyPrice - b.avgBuyPrice;
          
        case SortOption.YOUR_POTENTIAL_DESC:
          const yourPotentialA = (a.quantity * qsValue(a.userProjectedOvr)) - (a.quantity * a.avgBuyPrice);
          const yourPotentialB = (b.quantity * qsValue(b.userProjectedOvr)) - (b.quantity * b.avgBuyPrice);
          return yourPotentialB - yourPotentialA;
          
        case SortOption.YOUR_POTENTIAL_ASC:
          const yourPotentialA2 = (a.quantity * qsValue(a.userProjectedOvr)) - (a.quantity * a.avgBuyPrice);
          const yourPotentialB2 = (b.quantity * qsValue(b.userProjectedOvr)) - (b.quantity * b.avgBuyPrice);
          return yourPotentialA2 - yourPotentialB2;
          
        case SortOption.AI_POTENTIAL_DESC:
          const aiQsA = Number(playerCardA?.qs_pred) || 0;
          const aiQsB = Number(playerCardB?.qs_pred) || 0;
          const aiPotentialA = (a.quantity * aiQsA) - (a.quantity * a.avgBuyPrice);
          const aiPotentialB = (b.quantity * aiQsB) - (b.quantity * b.avgBuyPrice);
          return aiPotentialB - aiPotentialA;
          
        case SortOption.AI_POTENTIAL_ASC:
          const aiQsA2 = Number(playerCardA?.qs_pred) || 0;
          const aiQsB2 = Number(playerCardB?.qs_pred) || 0;
          const aiPotentialA2 = (a.quantity * aiQsA2) - (a.quantity * a.avgBuyPrice);
          const aiPotentialB2 = (b.quantity * aiQsB2) - (b.quantity * b.avgBuyPrice);
          return aiPotentialA2 - aiPotentialB2;
          
        default:
          return 0;
      }
    });

    return sorted;
  }, [playerCards]);

  /**
   * Apply sorting to investments
   */
  const sortedInvestments = useMemo(() => {
    return sortInvestments(investments || [], sortOption);
  }, [investments, sortOption, sortInvestments]);

  // Authentication loading state
  if (authLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.colors.primary.main} />
          <Text style={styles.loadingText}>Checking authentication...</Text>
        </View>
      </SafeAreaView>
    );
  }

  // Unauthenticated state
  if (isGuest) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.authContainer}>
          <Ionicons name="lock-closed" size={64} color={theme.colors.text.secondary} />
          <Text style={styles.authTitle}>Login Required</Text>
          <Text style={styles.authSubtitle}>
            You need to sign in to view and manage your investment portfolio.
          </Text>
          <View style={styles.authButtons}>
            <TouchableOpacity 
              style={styles.loginButton}
              onPress={() => navigation.navigate('Login')}
            >
              <Text style={styles.loginButtonText}>Sign In</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={styles.signupButton}
              onPress={() => navigation.navigate('Signup')}
            >
              <Text style={styles.signupButtonText}>Create Account</Text>
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  // Loading state
  if (investmentsLoading || cardsLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.colors.primary.main} />
          <Text style={styles.loadingText}>Loading portfolio...</Text>
        </View>
      </SafeAreaView>
    );
  }

  // Error state
  if (investmentsError) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle" size={48} color={theme.colors.error} />
          <Text style={styles.errorText}>Failed to load portfolio</Text>
          <TouchableOpacity style={styles.retryButton} onPress={handleRefresh}>
            <Text style={styles.retryText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Success Toast Notification */}
      {showToast && (
        <View style={styles.toastContainer}>
          <View style={styles.toast}>
            <Ionicons name="checkmark-circle" size={20} color="white" />
            <Text style={styles.toastText}>{toastMessage}</Text>
          </View>
        </View>
      )}

      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Portfolio</Text>
        <Text style={styles.subtitle}>Your investment tracker</Text>
        
        {/* Portfolio Status Tag */}
        <View style={styles.portfolioStatusContainer}>
          <View style={styles.portfolioStatus}>
            <Text style={styles.portfolioStatusText}>
              {isPublic ? 'Public' : 'Private'} Portfolio
            </Text>
          </View>
        </View>
      </View>

      <ScrollView
        style={styles.scrollView}
        refreshControl={
          <RefreshControl 
            refreshing={refreshing} 
            onRefresh={handleRefresh}
            tintColor={theme.colors.primary.main}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* Portfolio Summary Cards */}
        <View style={styles.summaryContainer}>
          <View style={styles.summaryRow}>
            <View style={styles.summaryCard}>
              <Text style={styles.summaryLabel}>Total Invested</Text>
              <Text style={styles.summaryValue}>{formatStubs(portfolioSummary.cost)}</Text>
            </View>
            <View style={styles.summaryCard}>
              <Text style={styles.summaryLabel}>AI Value</Text>
              <Text style={styles.summaryValue}>{formatStubs(portfolioSummary.aiValue)}</Text>
            </View>
          </View>
          
          <View style={styles.summaryRow}>
            <View style={[
              styles.summaryCard,
              portfolioSummary.myProfit >= 0 ? styles.positiveCard : styles.negativeCard
            ]}>
              <Text style={styles.summaryLabel}>Your P/L</Text>
              <Text style={[
                styles.summaryValue,
                { color: portfolioSummary.myProfit >= 0 ? '#10b981' : '#ef4444' }
              ]}>
                {formatStubs(portfolioSummary.myProfit)}
              </Text>
            </View>
            <View style={[
              styles.summaryCard,
              portfolioSummary.aiProfit >= 0 ? styles.positiveCard : styles.negativeCard
            ]}>
              <Text style={styles.summaryLabel}>AI P/L</Text>
              <Text style={[
                styles.summaryValue,
                { color: portfolioSummary.aiProfit >= 0 ? '#10b981' : '#ef4444' }
              ]}>
                {formatStubs(portfolioSummary.aiProfit)}
              </Text>
            </View>
          </View>
          
          <View style={styles.summaryCard}>
            <Text style={styles.summaryLabel}>Your Value</Text>
            <Text style={styles.summaryValueLarge}>{formatStubs(portfolioSummary.myValue)}</Text>
          </View>
        </View>

        {/* Add Investment Button */}
        <View style={styles.actionContainer}>
          <TouchableOpacity 
            style={styles.addButton}
            onPress={() => setShowAddForm(!showAddForm)}
          >
            <Ionicons 
              name={showAddForm ? "remove" : "add"} 
              size={20} 
              color="white" 
            />
            <Text style={styles.addButtonText}>
              {showAddForm ? 'Cancel' : 'Add Investment'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Add Investment Form */}
        {showAddForm && (
          <View style={styles.addForm}>
            <Text style={styles.formTitle}>Add New Investment</Text>
            
            {/* Player Search */}
            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>Player</Text>
              <TextInput
                style={styles.textInput}
                placeholder="Search for player..."
                placeholderTextColor="#999999"
                value={searchQuery}
                onChangeText={(text) => {
                  setSearchQuery(text);
                  setSelectedPlayer(null);
                }}
              />
              
              {searchResults.length > 0 && !selectedPlayer && (
                <ScrollView 
                  style={styles.searchResults}
                  showsVerticalScrollIndicator={false}
                  nestedScrollEnabled={true}
                >
                  {searchResults.map((player) => (
                    <TouchableOpacity
                      key={player.id}
                      style={styles.searchResultItem}
                      onPress={() => {
                        setSelectedPlayer(player);
                        setSearchQuery(player.name);
                      }}
                    >
                      <Image
                        source={{
                          uri: player.baked_img || 'https://via.placeholder.com/40x56/cccccc/ffffff?text=?'
                        }}
                        style={styles.searchResultImage}
                        defaultSource={{ uri: 'https://via.placeholder.com/40x56/cccccc/ffffff?text=?' }}
                      />
                      <Text style={styles.searchResultText}>{player.name}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              )}
            </View>

            {/* Form Fields */}
            <View style={styles.formRow}>
              <View style={[styles.formGroup, { flex: 1 }]}>
                <Text style={styles.formLabel}>Quantity</Text>
                <TextInput
                  style={styles.textInput}
                  placeholder="1"
                  placeholderTextColor="#999999"
                  value={quantity}
                  onChangeText={handleQuantityChange}
                  keyboardType="numeric"
                />
              </View>
              <View style={[styles.formGroup, { flex: 1, marginLeft: 10 }]}>
                <Text style={styles.formLabel}>Avg Buy Price</Text>
                <TextInput
                  style={styles.textInput}
                  placeholder="0"
                  placeholderTextColor="#999999"
                  value={avgPrice}
                  onChangeText={setAvgPrice}
                  keyboardType="numeric"
                />
              </View>
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>Projected OVR</Text>
              <TextInput
                style={styles.textInput}
                placeholder="50-99"
                placeholderTextColor="#999999"
                value={projectedOvr}
                onChangeText={handleProjectedOvrChange}
                keyboardType="numeric"
                maxLength={2}
              />
            </View>

            <TouchableOpacity 
              style={[styles.submitButton, canAdd && styles.submitButtonEnabled]} 
              onPress={handleAddInvestment}
            >
              <Text style={styles.submitButtonText}>Add Investment</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Investments List */}
        <View style={styles.investmentsList}>
          <View style={styles.investmentsHeader}>
            <Text style={styles.sectionTitle}>
              Your Investments ({investments?.length || 0})
            </Text>
            <View style={styles.sortContainer}>
              <TouchableOpacity 
                style={styles.sortButton}
                onPress={() => setShowSortDropdown(!showSortDropdown)}
              >
                <Text style={styles.sortButtonText}>
                  {SORT_LABELS[sortOption]}
                </Text>
                <View style={styles.sortButtonDivider} />
                <Ionicons 
                  name={showSortDropdown ? "chevron-up" : "chevron-down"} 
                  size={16} 
                  color={theme.colors.text.secondary} 
                />
              </TouchableOpacity>

              {showSortDropdown && (
                <>
                  {/* Overlay to close dropdown when touching outside */}
                  <TouchableOpacity 
                    style={styles.dropdownOverlay}
                    onPress={() => setShowSortDropdown(false)}
                    activeOpacity={1}
                  />
                  
                  {/* Dropdown Content */}
                  <View style={styles.sortDropdown}>
                    <ScrollView 
                      showsVerticalScrollIndicator={false}
                      style={styles.sortDropdownScroll}
                    >
                      {Object.values(SortOption).map((option, index, array) => (
                        <TouchableOpacity
                          key={option}
                          style={[
                            styles.sortDropdownItem,
                            sortOption === option && styles.sortDropdownItemSelected,
                            index === array.length - 1 && styles.sortDropdownItemLast
                          ]}
                          onPress={() => {
                            setSortOption(option);
                            setShowSortDropdown(false);
                          }}
                        >
                          <Text style={[
                            styles.sortDropdownText,
                            sortOption === option && styles.sortDropdownTextSelected
                          ]}>
                            {SORT_LABELS[option]}
                          </Text>
                          {sortOption === option && (
                            <Ionicons name="checkmark" size={16} color={theme.colors.primary.main} />
                          )}
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                  </View>
                </>
              )}
            </View>
          </View>
          
          {!sortedInvestments || sortedInvestments.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="briefcase-outline" size={48} color={theme.colors.text.secondary} />
              <Text style={styles.emptyStateText}>No investments yet</Text>
              <Text style={styles.emptyStateSubtext}>Add your first investment above</Text>
            </View>
          ) : (
            sortedInvestments.map((investment) => {
              const playerCard = playerCards?.find(card => card.id === investment.playerUUID);
              const currentOvr = Number(playerCard?.ovr) || 0;
              const predictedOvr = Number(playerCard?.predicted_rank) || 0;
              const aiQsValue = Number(playerCard?.qs_pred) || 0;
              const myQsValue = qsValue(investment.userProjectedOvr);
              const isEditing = editingId === investment.id;
              const isSaving = savingId === investment.id;

              return (
                <View key={investment.id} style={styles.investmentCard}>
                  {/* Player Header */}
                  <TouchableOpacity
                    onPress={() => handlePlayerPress(investment.playerUUID, investment.playerName)}
                  >
                    <View style={styles.investmentHeader}>
                      <View style={styles.playerImageContainer}>
                        <Image
                          source={{
                            uri: playerCard?.baked_img || 'https://via.placeholder.com/50x70/cccccc/ffffff?text=?'
                          }}
                          style={styles.playerImage}
                          defaultSource={{ uri: 'https://via.placeholder.com/50x70/cccccc/ffffff?text=?' }}
                        />
                      </View>
                      <View style={styles.playerInfo}>
                        <Text style={styles.playerName}>
                          {investment.playerName || playerCard?.name || 'Unknown Player'}
                        </Text>
                        <Text style={styles.playerMeta}>
                          OVR: {currentOvr} • Predicted: {predictedOvr.toFixed(1)}
                        </Text>
                      </View>
                    </View>
                  </TouchableOpacity>

                  {/* Investment Details */}
                  <View style={styles.investmentBody}>
                    <View style={styles.investmentRow}>
                      <View style={styles.investmentDetail}>
                        <Text style={styles.detailLabel}>Quantity</Text>
                        {isEditing ? (
                          <TextInput
                            style={styles.editInput}
                            value={editQuantity}
                            onChangeText={setEditQuantity}
                            keyboardType="numeric"
                          />
                        ) : (
                          <Text style={styles.detailValue}>{investment.quantity}</Text>
                        )}
                      </View>
                      
                      <View style={styles.investmentDetail}>
                        <Text style={styles.detailLabel}>Avg Buy Price</Text>
                        {isEditing ? (
                          <TextInput
                            style={styles.editInput}
                            value={editPrice}
                            onChangeText={setEditPrice}
                            placeholder={String(investment.avgBuyPrice)}
                            keyboardType="numeric"
                          />
                        ) : (
                          <Text style={styles.detailValue}>{investment.avgBuyPrice}</Text>
                        )}
                      </View>
                      
                      <View style={styles.investmentDetail}>
                        <Text style={styles.detailLabel}>Total Cost</Text>
                        <Text style={styles.detailValue}>
                          {formatStubs(investment.quantity * investment.avgBuyPrice)}
                        </Text>
                      </View>
                    </View>

                    <View style={styles.investmentRow}>
                      <View style={styles.investmentDetail}>
                        <Text style={styles.detailLabel}>Your OVR</Text>
                        {isEditing ? (
                          <TextInput
                            style={styles.editInput}
                            value={editOvr}
                            onChangeText={setEditOvr}
                            keyboardType="numeric"
                          />
                        ) : (
                          <Text style={styles.detailValue}>{investment.userProjectedOvr}</Text>
                        )}
                      </View>
                      
                      <View style={styles.investmentDetail}>
                        <Text style={styles.detailLabel}>AI QS</Text>
                        <Text style={styles.detailValue}>{aiQsValue}</Text>
                      </View>
                      
                      <View style={styles.investmentDetail}>
                        <Text style={styles.detailLabel}>Your QS</Text>
                        <Text style={styles.detailValue}>{myQsValue}</Text>
                      </View>
                    </View>

                    {/* Profit/Loss */}
                    <View style={styles.profitRow}>
                      <View style={styles.profitDetail}>
                        <Text style={styles.profitLabel}>AI Potential</Text>
                        <Text style={[
                          styles.profitValue,
                          { color: (investment.quantity * aiQsValue - investment.quantity * investment.avgBuyPrice) >= 0 ? '#10b981' : '#ef4444' }
                        ]}>
                          {formatStubs(investment.quantity * aiQsValue - investment.quantity * investment.avgBuyPrice)}
                        </Text>
                      </View>
                      
                      <View style={styles.profitDetail}>
                        <Text style={styles.profitLabel}>Your Potential</Text>
                        <Text style={[
                          styles.profitValue,
                          { color: (investment.quantity * myQsValue - investment.quantity * investment.avgBuyPrice) >= 0 ? '#10b981' : '#ef4444' }
                        ]}>
                          {formatStubs(investment.quantity * myQsValue - investment.quantity * investment.avgBuyPrice)}
                        </Text>
                      </View>
                    </View>
                  </View>

                  {/* Actions */}
                  <View style={styles.investmentActions}>
                    {isEditing ? (
                      <>
                        <TouchableOpacity
                          style={[styles.actionButton, styles.saveButton, isSaving && styles.disabledButton]}
                          onPress={() => saveEdit(investment)}
                          disabled={isSaving}
                        >
                          {isSaving ? (
                            <ActivityIndicator size={16} color="white" />
                          ) : (
                            <Ionicons name="checkmark" size={16} color="white" />
                          )}
                          <Text style={styles.actionButtonText}>
                            {isSaving ? 'Saving...' : 'Save'}
                          </Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={[styles.actionButton, styles.cancelButton, isSaving && styles.disabledButton]}
                          disabled={isSaving}
                          onPress={() => {
                            setEditingId(null);
                            // Clear edit state when canceling
                            setEditQuantity('');
                            setEditPrice('');
                            setEditOvr('');
                          }}
                        >
                          <Ionicons name="close" size={16} color="white" />
                          <Text style={styles.actionButtonText}>Cancel</Text>
                        </TouchableOpacity>
                      </>
                    ) : (
                      <>
                        <TouchableOpacity
                          style={[styles.actionButton, styles.editButton]}
                          onPress={() => startEdit(investment)}
                        >
                          <Ionicons name="pencil" size={16} color="white" />
                          <Text style={styles.actionButtonText}>Edit</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={[styles.actionButton, styles.deleteButton]}
                          onPress={() => handleDelete(investment)}
                        >
                          <Ionicons name="trash" size={16} color="white" />
                          <Text style={styles.actionButtonText}>Delete</Text>
                        </TouchableOpacity>
                      </>
                    )}
                  </View>
                </View>
              );
            })
          )}
        </View>

        {/* Bottom Padding */}
        <View style={styles.bottomPadding} />
      </ScrollView>
    </SafeAreaView>
  );
};

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
  
  authContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
    backgroundColor: theme.colors.background.dark,
  },
  
  authTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: theme.colors.text.primary,
    marginTop: 24,
    marginBottom: 12,
    textAlign: 'center',
  },
  
  authSubtitle: {
    fontSize: 16,
    color: theme.colors.text.secondary,
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 32,
  },
  
  authButtons: {
    width: '100%',
    gap: 12,
  },
  
  loginButton: {
    backgroundColor: theme.colors.primary.main,
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  
  loginButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  
  signupButton: {
    backgroundColor: theme.colors.background.medium,
    borderWidth: 1,
    borderColor: theme.colors.border.primary,
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  
  signupButtonText: {
    color: theme.colors.text.primary,
    fontSize: 16,
    fontWeight: '500',
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
  
  errorSubtext: {
    fontSize: 14,
    color: theme.colors.text.secondary,
    textAlign: 'center',
    marginBottom: 20,
    paddingHorizontal: 20,
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
  
  scrollView: {
    flex: 1,
  },

  portfolioStatusContainer: {
    marginTop: 8,
    alignItems: 'center',
  },

  portfolioStatus: {
    backgroundColor: 'rgba(77, 184, 184, 0.15)',
    paddingHorizontal: 12,
    paddingVertical: 3,
    borderRadius: 20,
  },

  portfolioStatusText: {
    color: '#4db8b8',
    fontSize: 12,
    fontWeight: '500',
  },
  
  summaryContainer: {
    padding: 16,
  },
  
  summaryRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  
  summaryCard: {
    flex: 1,
    backgroundColor: theme.colors.background.medium,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.colors.border.primary,
    alignItems: 'center',
  },
  
  positiveCard: {
    borderColor: '#10b981',
    borderWidth: 1,
  },
  
  negativeCard: {
    borderColor: '#ef4444',
    borderWidth: 1,
  },
  
  summaryLabel: {
    fontSize: 12,
    color: theme.colors.text.secondary,
    marginBottom: 4,
    textAlign: 'center',
  },
  
  summaryValue: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.text.primary,
    textAlign: 'center',
  },
  
  summaryValueLarge: {
    fontSize: 24,
    fontWeight: 'bold',
    color: theme.colors.primary.main,
    textAlign: 'center',
  },
  
  actionContainer: {
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  
  addButton: {
    backgroundColor: theme.colors.primary.main,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 8,
    gap: 8,
  },
  
  addButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  
  addForm: {
    backgroundColor: theme.colors.background.medium,
    margin: 16,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.colors.border.primary,
  },
  
  formTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: theme.colors.text.primary,
    marginBottom: 16,
    textAlign: 'center',
  },
  
  formGroup: {
    marginBottom: 16,
  },
  
  formRow: {
    flexDirection: 'row',
  },
  
  formLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: theme.colors.text.secondary,
    marginBottom: 6,
  },
  
  textInput: {
    backgroundColor: theme.colors.background.light,
    borderWidth: 1,
    borderColor: theme.colors.border.primary,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    color: theme.colors.text.primary,
  },
  
  searchResults: {
    backgroundColor: theme.colors.background.light,
    borderWidth: 1,
    borderColor: theme.colors.border.primary,
    borderRadius: 8,
    marginTop: 4,
    maxHeight: 280,
  },
  
  searchResultItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border.primary,
    gap: 12,
  },

  searchResultImage: {
    width: 40,
    height: 56,
    borderRadius: 6,
    backgroundColor: theme.colors.background.medium,
  },
  
  searchResultText: {
    flex: 1,
    fontSize: 16,
    color: theme.colors.text.primary,
  },
  
  submitButton: {
    backgroundColor: theme.colors.secondary.main,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },

  submitButtonEnabled: {
    backgroundColor: '#10b981',
  },
  
  submitButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  
  investmentsList: {
    paddingHorizontal: 16,
  },

  investmentsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  
  sectionTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: theme.colors.text.primary,
  },

  sortContainer: {
    position: 'relative',
  },

  sortButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.background.medium,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: theme.colors.border.primary,
    gap: 6,
  },

  sortButtonText: {
    fontSize: 14,
    color: theme.colors.text.secondary,
    fontWeight: '500',
  },

  sortButtonDot: {
    fontSize: 14,
    color: theme.colors.text.secondary,
    marginHorizontal: 4,
  },
  sortButtonDivider: {
    width: 1,
    backgroundColor: theme.colors.text.secondary,
    marginHorizontal: 8,
    alignSelf: 'stretch',
  },

  dropdownOverlay: {
    position: 'absolute',
    top: 0,
    left: -1000,
    right: -1000,
    bottom: -1000,
    zIndex: 999,
  },

  sortDropdown: {
    position: 'absolute',
    top: 42,
    right: 0,
    backgroundColor: theme.colors.background.light,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: theme.colors.border.primary,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
    zIndex: 1000,
    maxHeight: 200,
    minWidth: 180,
  },

  sortDropdownScroll: {
    maxHeight: 200,
  },

  sortDropdownItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border.primary,
  },

  sortDropdownItemSelected: {
    backgroundColor: theme.colors.primary.main + '20',
  },

  sortDropdownText: {
    fontSize: 14,
    color: theme.colors.text.primary,
    fontWeight: '500',
    flex: 1,
  },

  sortDropdownTextSelected: {
    color: theme.colors.primary.main,
    fontWeight: '600',
  },

  sortDropdownItemLast: {
    borderBottomWidth: 0,
  },
  
  emptyState: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  
  emptyStateText: {
    fontSize: 18,
    color: theme.colors.text.secondary,
    marginTop: 12,
  },
  
  emptyStateSubtext: {
    fontSize: 14,
    color: theme.colors.text.secondary,
    marginTop: 4,
  },
  
  investmentCard: {
    backgroundColor: theme.colors.background.medium,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: theme.colors.border.primary,
  },
  
  investmentHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },

  playerImageContainer: {
    marginRight: 12,
  },

  playerImage: {
    width: 50,
    height: 70,
    borderRadius: 6,
    backgroundColor: theme.colors.background.medium,
  },

  playerInfo: {
    flex: 1,
  },
  
  playerName: {
    fontSize: 18,
    fontWeight: '600',
    color: theme.colors.text.primary,
    marginBottom: 4,
  },
  
  playerMeta: {
    fontSize: 14,
    color: theme.colors.text.secondary,
  },
  
  investmentBody: {
    marginBottom: 12,
  },
  
  investmentRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  
  investmentDetail: {
    flex: 1,
    alignItems: 'center',
  },
  
  detailLabel: {
    fontSize: 12,
    color: theme.colors.text.secondary,
    marginBottom: 4,
  },
  
  detailValue: {
    fontSize: 14,
    fontWeight: '500',
    color: theme.colors.text.primary,
  },
  
  editInput: {
    backgroundColor: theme.colors.background.light,
    borderWidth: 1,
    borderColor: theme.colors.border.primary,
    borderRadius: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    fontSize: 14,
    color: theme.colors.text.primary,
    textAlign: 'center',
    minWidth: 60,
  },
  
  profitRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 8,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border.primary,
  },
  
  profitDetail: {
    alignItems: 'center',
  },
  
  profitLabel: {
    fontSize: 12,
    color: theme.colors.text.secondary,
    marginBottom: 4,
  },
  
  profitValue: {
    fontSize: 16,
    fontWeight: '600',
  },
  
  investmentActions: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    gap: 8,
  },
  
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 6,
    gap: 4,
  },
  
  actionButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '500',
  },
  
  editButton: {
    backgroundColor: theme.colors.primary.main,
  },
  
  deleteButton: {
    backgroundColor: '#ef4444',
  },
  
  saveButton: {
    backgroundColor: '#10b981',
  },
  
  cancelButton: {
    backgroundColor: '#64748b',
  },

  disabledButton: {
    opacity: 0.6,
  },

  toastContainer: {
    position: 'absolute',
    top: 60,
    left: 0,
    right: 0,
    zIndex: 1000,
    paddingHorizontal: 16,
  },

  toast: {
    backgroundColor: '#10b981',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
    gap: 8,
  },

  toastText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '500',
    flex: 1,
  },
  
  bottomPadding: {
    height: 20,
  },
});