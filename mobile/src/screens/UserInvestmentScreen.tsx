/**
 * UserInvestmentScreen - View Other User's Investment Portfolio
 * 
 * LEARNING NOTES: Read-Only Portfolio Viewing
 * 
 * This screen demonstrates:
 * 1. Public investment portfolio viewing
 * 2. Portfolio summary statistics
 * 3. Investment list display (read-only)
 * 4. User header with profile information
 * 5. Mobile-optimized portfolio layout
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Image,
  Alert,
  RefreshControl,
} from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { Ionicons } from '@expo/vector-icons';

import { theme } from '../styles/theme';
import { RootStackParamList } from '../navigation/AppNavigator';
import { apiClient, Investment } from '../services/api';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../services/firebase';

/**
 * Portfolio summary data structure matching website
 */
interface PortfolioSummary {
  cost: number;       // Total invested amount
  aiValue: number;    // AI projected portfolio value
  aiProfit: number;   // AI projected profit/loss
  myValue: number;    // User projected portfolio value  
  myProfit: number;   // User projected profit/loss
}

interface UserProfile {
  username: string;
  profilePic: string;
}

interface PlayerCard {
  id: string;
  name: string;
  ovr: number;
  qs_pred: number;    // AI predicted quick-sell value
  baked_img?: string;
}

type UserInvestmentScreenNavigationProp = StackNavigationProp<RootStackParamList>;
type UserInvestmentScreenRouteProp = RouteProp<RootStackParamList, 'UserInvestment'>;

/**
 * MLB The Show quick-sell value mapping based on player overall rating
 * Used to calculate potential profit from user's projected OVR improvements
 */
function qsValue(ovr: number): number {
  if (ovr < 65) return 5        // Bronze cards
  if (ovr < 75) return 25       // Silver cards
  if (ovr === 75) return 50     // Gold tier entry
  if (ovr === 76) return 75
  if (ovr === 77) return 100
  if (ovr === 78) return 125
  if (ovr === 79) return 150
  if (ovr === 80) return 400    // Diamond tier entry - significant jump
  if (ovr === 81) return 600
  if (ovr === 82) return 900
  if (ovr === 83) return 1200
  if (ovr === 84) return 1500
  if (ovr === 85) return 3000   // High diamond tier - major value increase
  if (ovr === 86) return 3750
  if (ovr === 87) return 4500
  if (ovr === 88) return 5500
  if (ovr === 89) return 7000
  if (ovr === 90) return 8000   // Elite tier
  if (ovr === 91) return 9000
  return ovr >= 92 ? 10000 : 0  // Max tier cards
}

export const UserInvestmentScreen: React.FC = () => {
  const navigation = useNavigation<UserInvestmentScreenNavigationProp>();
  const route = useRoute<UserInvestmentScreenRouteProp>();
  const { userId, username } = route.params;
  
  // State
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [investments, setInvestments] = useState<Investment[]>([]);
  const [playerCards, setPlayerCards] = useState<Record<string, PlayerCard>>({});
  const [summary, setSummary] = useState<PortfolioSummary>({
    cost: 0,
    aiValue: 0,
    aiProfit: 0,
    myValue: 0,
    myProfit: 0,
  });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  /**
   * Load user profile data
   */
  const loadUserProfile = async () => {
    try {
      const userDoc = await getDoc(doc(db, 'users', userId));
      if (userDoc.exists()) {
        const userData = userDoc.data();
        setProfile({
          username: userData.username || username,
          profilePic: userData.profilePic || '',
        });
      } else {
        setProfile({
          username: username,
          profilePic: '',
        });
      }
    } catch (error) {
      console.error('Error loading user profile:', error);
      setProfile({
        username: username,
        profilePic: '',
      });
    }
  };

  /**
   * Load investment data and calculate summary
   */
  const loadInvestments = async () => {
    try {
      // Get user's public investment portfolio
      const userInvestments = await apiClient.getPublicPortfolio(userId);
      setInvestments(userInvestments);

      if (userInvestments.length === 0) {
        setLoading(false);
        return;
      }

      // Get player card details for all investments
      const playerIds = Array.from(new Set(userInvestments.map(inv => inv.playerUUID)));
      const cardPromises = playerIds.map(async (playerId) => {
        try {
          const cardData = await apiClient.getPlayerById(playerId);
          return { id: playerId, data: cardData };
        } catch {
          return null;
        }
      });

      const cardResults = await Promise.all(cardPromises);
      const cardMap: Record<string, PlayerCard> = {};
      
      cardResults.forEach(result => {
        if (result) {
          cardMap[result.id] = result.data as PlayerCard;
        }
      });
      
      setPlayerCards(cardMap);

      // Calculate portfolio summary
      const portfolioSummary = userInvestments.reduce((acc, investment) => {
        const card = cardMap[investment.playerUUID];
        if (!card) return acc;

        const cost = investment.quantity * investment.avgBuyPrice;
        const aiPrice = Number(card.qs_pred) || 0;
        const aiValue = investment.quantity * aiPrice;
        const aiProfit = aiValue - cost;
        
        const userQs = qsValue(investment.userProjectedOvr);
        const myValue = investment.quantity * userQs;
        const myProfit = myValue - cost;

        return {
          cost: acc.cost + cost,
          aiValue: acc.aiValue + aiValue,
          aiProfit: acc.aiProfit + aiProfit,
          myValue: acc.myValue + myValue,
          myProfit: acc.myProfit + myProfit,
        };
      }, { cost: 0, aiValue: 0, aiProfit: 0, myValue: 0, myProfit: 0 });

      setSummary(portfolioSummary);
    } catch (error) {
      console.error('Error loading investments:', error);
      Alert.alert('Error', 'Failed to load investment portfolio.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  /**
   * Refresh data
   */
  const handleRefresh = async () => {
    setRefreshing(true);
    await loadInvestments();
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
   * Format currency values (stubs format - no $ symbol to match PortfolioScreen)
   */
  const formatStubs = (amount: number): string => {
    return new Intl.NumberFormat('en-US', {
      minimumFractionDigits: 0,
    }).format(amount);
  };

  useEffect(() => {
    const loadData = async () => {
      await loadUserProfile();
      await loadInvestments();
    };
    loadData();
  }, [userId]);

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={24} color={theme.colors.text.primary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Investments</Text>
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.colors.primary.main} />
          <Text style={styles.loadingText}>Loading portfolio...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color={theme.colors.text.primary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Investments</Text>
      </View>

      <ScrollView 
        style={styles.content} 
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
        }
      >
        {/* User Header */}
        <View style={styles.userHeader}>
          <Image
            source={
              profile?.profilePic
                ? { uri: profile.profilePic }
                : require('../../assets/default_profile.jpg')
            }
            style={styles.userImage}
            defaultSource={require('../../assets/default_profile.jpg')}
          />
          <Text style={styles.userTitle}>{profile?.username}'s Investments</Text>
        </View>

        {investments.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="trending-up-outline" size={64} color={theme.colors.text.secondary} />
            <Text style={styles.emptyTitle}>No Public Investments</Text>
            <Text style={styles.emptySubtitle}>
              This user hasn't made their investment portfolio public or has no investments yet.
            </Text>
          </View>
        ) : (
          <>
            {/* Portfolio Summary */}
            <View style={styles.summaryContainer}>
              <View style={styles.summaryRow}>
                <View style={styles.summaryCard}>
                  <Text style={styles.summaryLabel}>Total Invested</Text>
                  <Text style={styles.summaryValue}>{formatStubs(summary.cost)}</Text>
                </View>
                <View style={styles.summaryCard}>
                  <Text style={styles.summaryLabel}>AI Value</Text>
                  <Text style={styles.summaryValue}>{formatStubs(summary.aiValue)}</Text>
                </View>
              </View>
              
              <View style={styles.summaryRow}>
                <View style={[
                  styles.summaryCard,
                  summary.myProfit >= 0 ? styles.positiveCard : styles.negativeCard
                ]}>
                  <Text style={styles.summaryLabel}>Your P/L</Text>
                  <Text style={[
                    styles.summaryValue,
                    { color: summary.myProfit >= 0 ? '#10b981' : '#ef4444' }
                  ]}>
                    {formatStubs(summary.myProfit)}
                  </Text>
                </View>
                <View style={[
                  styles.summaryCard,
                  summary.aiProfit >= 0 ? styles.positiveCard : styles.negativeCard
                ]}>
                  <Text style={styles.summaryLabel}>AI P/L</Text>
                  <Text style={[
                    styles.summaryValue,
                    { color: summary.aiProfit >= 0 ? '#10b981' : '#ef4444' }
                  ]}>
                    {formatStubs(summary.aiProfit)}
                  </Text>
                </View>
              </View>
              
              <View style={styles.summaryCard}>
                <Text style={styles.summaryLabel}>Your Value</Text>
                <Text style={styles.summaryValueLarge}>{formatStubs(summary.myValue)}</Text>
              </View>
            </View>

            {/* Investments List */}
            <View style={styles.investmentsList}>
              <View style={styles.investmentsHeader}>
                <Text style={styles.sectionTitle}>
                  Your Investments ({investments.length})
                </Text>
              </View>
              
              {investments.map((investment) => {
                const playerCard = playerCards[investment.playerUUID];
                const currentOvr = Number(playerCard?.ovr) || 0;
                const predictedOvr = Number(playerCard?.predicted_rank) || 0;
                const aiQsValue = Number(playerCard?.qs_pred) || 0;
                const myQsValue = qsValue(investment.userProjectedOvr);
                const cost = investment.quantity * investment.avgBuyPrice;
                const aiValue = investment.quantity * aiQsValue;
                const aiProfit = aiValue - cost;
                const myValue = investment.quantity * myQsValue;
                const myProfit = myValue - cost;

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
                          <Text style={styles.detailValue}>{investment.quantity}</Text>
                        </View>
                        
                        <View style={styles.investmentDetail}>
                          <Text style={styles.detailLabel}>Avg Buy Price</Text>
                          <Text style={styles.detailValue}>{investment.avgBuyPrice}</Text>
                        </View>
                        
                        <View style={styles.investmentDetail}>
                          <Text style={styles.detailLabel}>Total Cost</Text>
                          <Text style={styles.detailValue}>
                            {formatStubs(cost)}
                          </Text>
                        </View>
                      </View>

                      <View style={styles.investmentRow}>
                        <View style={styles.investmentDetail}>
                          <Text style={styles.detailLabel}>Your OVR</Text>
                          <Text style={styles.detailValue}>{investment.userProjectedOvr}</Text>
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
                            { color: aiProfit >= 0 ? '#10b981' : '#ef4444' }
                          ]}>
                            {formatStubs(aiProfit)}
                          </Text>
                        </View>
                        
                        <View style={styles.profitDetail}>
                          <Text style={styles.profitLabel}>Your Potential</Text>
                          <Text style={[
                            styles.profitValue,
                            { color: myProfit >= 0 ? '#10b981' : '#ef4444' }
                          ]}>
                            {formatStubs(myProfit)}
                          </Text>
                        </View>
                      </View>
                    </View>
                  </View>
                );
              })}
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

/**
 * LEARNING NOTES: Read-Only Portfolio Design
 * 
 * Key design considerations:
 * 1. Clear user identification in header
 * 2. Portfolio summary matching website layout
 * 3. Read-only interface - no edit/delete buttons
 * 4. Performance optimization for large portfolios
 * 5. Error handling for missing player data
 * 6. Refresh capability for updated data
 */
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background.dark,
  },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: theme.colors.background.medium,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border.primary,
  },

  backButton: {
    padding: 8,
    marginRight: 8,
  },

  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: theme.colors.text.primary,
  },

  content: {
    flex: 1,
  },

  userHeader: {
    backgroundColor: theme.colors.background.medium,
    paddingVertical: 20,
    paddingHorizontal: 16,
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border.primary,
  },

  userImage: {
    width: 60,
    height: 60,
    borderRadius: 30,
    marginBottom: 12,
  },

  userTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: theme.colors.text.primary,
  },

  sectionTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: theme.colors.text.primary,
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

  investmentsList: {
    paddingHorizontal: 16,
  },

  investmentsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
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

  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    paddingVertical: 64,
  },

  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: theme.colors.text.primary,
    marginTop: 16,
    marginBottom: 8,
  },

  emptySubtitle: {
    fontSize: 14,
    color: theme.colors.text.secondary,
    textAlign: 'center',
    lineHeight: 20,
  },

  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },

  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: theme.colors.text.secondary,
  },
});