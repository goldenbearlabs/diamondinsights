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

import React, { useState, useEffect, useMemo } from 'react';
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
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';

// Import design system, API hooks, and authentication
import { theme } from '../styles/theme';
import { useUserInvestments, useInvestmentActions, usePlayerCards } from '../hooks/useApi';
import { qsValue, Investment } from '../services/api';
import { RootStackParamList } from '../navigation/AppNavigator';
import { useAuth, useAuthStatus } from '../contexts/AuthContext';

// Navigation type
type PortfolioScreenNavigationProp = StackNavigationProp<RootStackParamList, 'Main'>;

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
    data: investments, 
    isLoading: investmentsLoading, 
    error: investmentsError, 
    refresh: refreshInvestments 
  } = useUserInvestments({ immediate: isAuthenticated });
  
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
      await refreshInvestments();
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
      await refreshInvestments();
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
    setEditPrice(''); // Leave blank to avoid accidental changes
    setEditOvr(String(investment.userProjectedOvr));
  };

  /**
   * Save investment edits
   */
  const saveEdit = async (investment: Investment) => {
    try {
      const newQty = parseInt(editQuantity) || investment.quantity;
      const unitPrice = parseFloat(editPrice) || 0;
      const newOvr = parseInt(editOvr) || investment.userProjectedOvr;
      const deltaQty = newQty - investment.quantity;

      let newAvgPrice = investment.avgBuyPrice;
      
      // Recalculate average price based on quantity and price changes
      if (deltaQty > 0 && unitPrice > 0) {
        // Adding quantity with new unit price
        newAvgPrice = ((investment.quantity * investment.avgBuyPrice) + (deltaQty * unitPrice)) / newQty;
      } else if (deltaQty === 0 && unitPrice > 0) {
        // Just updating price without changing quantity
        newAvgPrice = unitPrice;
      }
      // If reducing quantity, keep existing average price

      await updateInvestment(investment.id, {
        quantity: newQty,
        avgBuyPrice: Math.round(newAvgPrice),
        userProjectedOvr: newOvr,
      });

      setEditingId(null);
      await refreshInvestments();
    } catch (error) {
      console.error('Failed to update investment:', error);
      Alert.alert('Error', 'Failed to update investment');
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
              await refreshInvestments();
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
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Portfolio</Text>
        <Text style={styles.subtitle}>Your investment tracker</Text>
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
              <Text style={styles.summaryValue}>${formatCurrency(portfolioSummary.cost)}</Text>
            </View>
            <View style={styles.summaryCard}>
              <Text style={styles.summaryLabel}>AI Value</Text>
              <Text style={styles.summaryValue}>${formatCurrency(portfolioSummary.aiValue)}</Text>
            </View>
          </View>
          
          <View style={styles.summaryRow}>
            <View style={[
              styles.summaryCard,
              portfolioSummary.aiProfit >= 0 ? styles.positiveCard : styles.negativeCard
            ]}>
              <Text style={styles.summaryLabel}>AI P/L</Text>
              <Text style={[
                styles.summaryValue,
                { color: portfolioSummary.aiProfit >= 0 ? '#10b981' : '#ef4444' }
              ]}>
                ${formatCurrency(portfolioSummary.aiProfit)}
              </Text>
            </View>
            <View style={[
              styles.summaryCard,
              portfolioSummary.myProfit >= 0 ? styles.positiveCard : styles.negativeCard
            ]}>
              <Text style={styles.summaryLabel}>Your P/L</Text>
              <Text style={[
                styles.summaryValue,
                { color: portfolioSummary.myProfit >= 0 ? '#10b981' : '#ef4444' }
              ]}>
                ${formatCurrency(portfolioSummary.myProfit)}
              </Text>
            </View>
          </View>
          
          <View style={styles.summaryCard}>
            <Text style={styles.summaryLabel}>Your Value</Text>
            <Text style={styles.summaryValueLarge}>${formatCurrency(portfolioSummary.myValue)}</Text>
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
                value={searchQuery}
                onChangeText={(text) => {
                  setSearchQuery(text);
                  setSelectedPlayer(null);
                }}
              />
              
              {searchResults.length > 0 && !selectedPlayer && (
                <View style={styles.searchResults}>
                  {searchResults.map((player) => (
                    <TouchableOpacity
                      key={player.id}
                      style={styles.searchResultItem}
                      onPress={() => {
                        setSelectedPlayer(player);
                        setSearchQuery(player.name);
                      }}
                    >
                      <Text style={styles.searchResultText}>{player.name}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </View>

            {/* Form Fields */}
            <View style={styles.formRow}>
              <View style={[styles.formGroup, { flex: 1 }]}>
                <Text style={styles.formLabel}>Quantity</Text>
                <TextInput
                  style={styles.textInput}
                  placeholder="0"
                  value={quantity}
                  onChangeText={setQuantity}
                  keyboardType="numeric"
                />
              </View>
              <View style={[styles.formGroup, { flex: 1, marginLeft: 10 }]}>
                <Text style={styles.formLabel}>Avg Price</Text>
                <TextInput
                  style={styles.textInput}
                  placeholder="0"
                  value={avgPrice}
                  onChangeText={setAvgPrice}
                  keyboardType="numeric"
                />
              </View>
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>Your Projected OVR</Text>
              <TextInput
                style={styles.textInput}
                placeholder="85"
                value={projectedOvr}
                onChangeText={setProjectedOvr}
                keyboardType="numeric"
              />
            </View>

            <TouchableOpacity style={styles.submitButton} onPress={handleAddInvestment}>
              <Text style={styles.submitButtonText}>Add Investment</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Investments List */}
        <View style={styles.investmentsList}>
          <Text style={styles.sectionTitle}>
            Your Investments ({investments?.length || 0})
          </Text>
          
          {!investments || investments.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="briefcase-outline" size={48} color={theme.colors.text.secondary} />
              <Text style={styles.emptyStateText}>No investments yet</Text>
              <Text style={styles.emptyStateSubtext}>Add your first investment above</Text>
            </View>
          ) : (
            investments.map((investment) => {
              const playerCard = playerCards?.find(card => card.id === investment.playerUUID);
              const currentOvr = Number(playerCard?.ovr) || 0;
              const predictedOvr = Number(playerCard?.predicted_rank) || 0;
              const aiQsValue = Number(playerCard?.qs_pred) || 0;
              const myQsValue = qsValue(investment.userProjectedOvr);
              const isEditing = editingId === investment.id;

              return (
                <View key={investment.id} style={styles.investmentCard}>
                  {/* Player Header */}
                  <TouchableOpacity
                    onPress={() => handlePlayerPress(investment.playerUUID, investment.playerName)}
                  >
                    <View style={styles.investmentHeader}>
                      <Text style={styles.playerName}>{investment.playerName}</Text>
                      <Text style={styles.playerMeta}>
                        OVR: {currentOvr} • Pred: {predictedOvr.toFixed(1)}
                      </Text>
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
                        <Text style={styles.detailLabel}>Avg Price</Text>
                        {isEditing ? (
                          <TextInput
                            style={styles.editInput}
                            value={editPrice}
                            onChangeText={setEditPrice}
                            placeholder={String(investment.avgBuyPrice)}
                            keyboardType="numeric"
                          />
                        ) : (
                          <Text style={styles.detailValue}>${investment.avgBuyPrice}</Text>
                        )}
                      </View>
                      
                      <View style={styles.investmentDetail}>
                        <Text style={styles.detailLabel}>Total Cost</Text>
                        <Text style={styles.detailValue}>
                          ${formatCurrency(investment.quantity * investment.avgBuyPrice)}
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
                          ${formatCurrency(investment.quantity * aiQsValue - investment.quantity * investment.avgBuyPrice)}
                        </Text>
                      </View>
                      
                      <View style={styles.profitDetail}>
                        <Text style={styles.profitLabel}>Your Potential</Text>
                        <Text style={[
                          styles.profitValue,
                          { color: (investment.quantity * myQsValue - investment.quantity * investment.avgBuyPrice) >= 0 ? '#10b981' : '#ef4444' }
                        ]}>
                          ${formatCurrency(investment.quantity * myQsValue - investment.quantity * investment.avgBuyPrice)}
                        </Text>
                      </View>
                    </View>
                  </View>

                  {/* Actions */}
                  <View style={styles.investmentActions}>
                    {isEditing ? (
                      <>
                        <TouchableOpacity
                          style={[styles.actionButton, styles.saveButton]}
                          onPress={() => saveEdit(investment)}
                        >
                          <Ionicons name="checkmark" size={16} color="white" />
                          <Text style={styles.actionButtonText}>Save</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={[styles.actionButton, styles.cancelButton]}
                          onPress={() => setEditingId(null)}
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
    maxHeight: 200,
  },
  
  searchResultItem: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border.primary,
  },
  
  searchResultText: {
    fontSize: 16,
    color: theme.colors.text.primary,
  },
  
  submitButton: {
    backgroundColor: theme.colors.secondary.main,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  
  submitButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  
  investmentsList: {
    paddingHorizontal: 16,
  },
  
  sectionTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: theme.colors.text.primary,
    marginBottom: 16,
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
    marginBottom: 12,
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
  
  bottomPadding: {
    height: 20,
  },
});