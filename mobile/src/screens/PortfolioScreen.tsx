/**
 * PortfolioScreen - Investment Tracker
 * 
 * LEARNING NOTES: Financial Mobile Interfaces
 * 
 * This screen demonstrates:
 * 1. Financial data visualization on mobile
 * 2. Summary cards with key metrics
 * 3. Transaction history patterns
 * 4. Action buttons for trading
 * 5. Real-time data updates
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

/**
 * LEARNING NOTE: Financial Data Types
 * Mobile apps need clear, typed data structures for reliability
 */
interface Investment {
  id: string;
  playerName: string;
  purchasePrice: number;
  currentPrice: number;
  quantity: number;
  purchaseDate: string;
  gainLoss: number;
  gainLossPercent: number;
}

interface PortfolioSummary {
  totalValue: number;
  totalGainLoss: number;
  totalGainLossPercent: number;
  todayChange: number;
  todayChangePercent: number;
}

export const PortfolioScreen: React.FC = () => {
  // Sample data - will be replaced with API calls
  const [portfolioSummary] = useState<PortfolioSummary>({
    totalValue: 12450.75,
    totalGainLoss: 1245.50,
    totalGainLossPercent: 11.1,
    todayChange: 250.25,
    todayChangePercent: 2.05,
  });

  const [investments] = useState<Investment[]>([
    {
      id: '1',
      playerName: 'Aaron Judge',
      purchasePrice: 85.50,
      currentPrice: 92.25,
      quantity: 10,
      purchaseDate: '2024-01-15',
      gainLoss: 67.50,
      gainLossPercent: 7.9,
    },
    {
      id: '2',
      playerName: 'Fernando Tatis Jr.',
      purchasePrice: 88.00,
      currentPrice: 94.75,
      quantity: 8,
      purchaseDate: '2024-01-20',
      gainLoss: 54.00,
      gainLossPercent: 7.7,
    },
    {
      id: '3',
      playerName: 'Mike Trout',
      purchasePrice: 95.25,
      currentPrice: 91.50,
      quantity: 12,
      purchaseDate: '2024-02-01',
      gainLoss: -45.00,
      gainLossPercent: -3.9,
    },
  ]);

  // UI state
  const [refreshing, setRefreshing] = useState(false);

  /**
   * LEARNING NOTE: Pull-to-Refresh for Financial Data
   * Financial apps need frequent data updates
   */
  const onRefresh = async () => {
    setRefreshing(true);
    // TODO: Fetch latest portfolio data from API
    setTimeout(() => {
      setRefreshing(false);
    }, 1000);
  };

  /**
   * LEARNING NOTE: Financial Formatting
   * Helper function for consistent currency display
   */
  const formatCurrency = (amount: number): string => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
    }).format(amount);
  };

  const formatPercent = (percent: number): string => {
    const sign = percent >= 0 ? '+' : '';
    return `${sign}${percent.toFixed(2)}%`;
  };

  /**
   * LEARNING NOTE: Navigation Handlers
   * Will be updated to use React Navigation
   */
  const handleInvestmentPress = (investment: Investment) => {
    console.log(`View details for ${investment.playerName}`);
    // TODO: Navigate to investment detail screen
  };

  const handleBuyPress = () => {
    console.log('Navigate to buy screen');
    // TODO: Navigate to buy/search screen
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Portfolio</Text>
        <Text style={styles.subtitle}>Your investment tracker</Text>
      </View>

      <ScrollView
        style={styles.scrollContainer}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* Portfolio Summary Card */}
        <View style={styles.summaryCard}>
          <Text style={styles.summaryTitle}>Total Portfolio Value</Text>
          <Text style={styles.totalValue}>
            {formatCurrency(portfolioSummary.totalValue)}
          </Text>
          
          <View style={styles.summaryRow}>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryLabel}>Total Gain/Loss</Text>
              <Text style={[
                styles.summaryValue,
                portfolioSummary.totalGainLoss >= 0 ? styles.positive : styles.negative
              ]}>
                {formatCurrency(portfolioSummary.totalGainLoss)}
              </Text>
              <Text style={[
                styles.summaryPercent,
                portfolioSummary.totalGainLoss >= 0 ? styles.positive : styles.negative
              ]}>
                {formatPercent(portfolioSummary.totalGainLossPercent)}
              </Text>
            </View>
            
            <View style={styles.summaryItem}>
              <Text style={styles.summaryLabel}>Today's Change</Text>
              <Text style={[
                styles.summaryValue,
                portfolioSummary.todayChange >= 0 ? styles.positive : styles.negative
              ]}>
                {formatCurrency(portfolioSummary.todayChange)}
              </Text>
              <Text style={[
                styles.summaryPercent,
                portfolioSummary.todayChange >= 0 ? styles.positive : styles.negative
              ]}>
                {formatPercent(portfolioSummary.todayChangePercent)}
              </Text>
            </View>
          </View>
        </View>

        {/* Action Buttons */}
        <View style={styles.actionContainer}>
          <TouchableOpacity style={styles.buyButton} onPress={handleBuyPress}>
            <Text style={styles.buyButtonText}>Buy More Players</Text>
          </TouchableOpacity>
        </View>

        {/* Holdings Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Your Holdings</Text>
          
          {investments.map((investment) => (
            <TouchableOpacity
              key={investment.id}
              style={styles.investmentCard}
              onPress={() => handleInvestmentPress(investment)}
            >
              <View style={styles.investmentHeader}>
                <Text style={styles.playerName}>{investment.playerName}</Text>
                <Text style={styles.quantity}>{investment.quantity} shares</Text>
              </View>
              
              <View style={styles.investmentDetails}>
                <View style={styles.priceContainer}>
                  <Text style={styles.priceLabel}>Purchase</Text>
                  <Text style={styles.priceValue}>
                    {formatCurrency(investment.purchasePrice)}
                  </Text>
                </View>
                
                <View style={styles.priceContainer}>
                  <Text style={styles.priceLabel}>Current</Text>
                  <Text style={styles.priceValue}>
                    {formatCurrency(investment.currentPrice)}
                  </Text>
                </View>
                
                <View style={styles.gainLossContainer}>
                  <Text style={[
                    styles.gainLossValue,
                    investment.gainLoss >= 0 ? styles.positive : styles.negative
                  ]}>
                    {formatCurrency(investment.gainLoss)}
                  </Text>
                  <Text style={[
                    styles.gainLossPercent,
                    investment.gainLoss >= 0 ? styles.positive : styles.negative
                  ]}>
                    {formatPercent(investment.gainLossPercent)}
                  </Text>
                </View>
              </View>
              
              <Text style={styles.purchaseDate}>
                Purchased {investment.purchaseDate}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Bottom padding */}
        <View style={styles.bottomPadding} />
      </ScrollView>
    </SafeAreaView>
  );
};

/**
 * LEARNING NOTES: Financial UI Design
 * 
 * Key principles for financial mobile interfaces:
 * 1. Clear hierarchy - Most important info (total value) at top
 * 2. Color coding - Green for gains, red for losses
 * 3. Consistent formatting - Currency and percentages
 * 4. Touch targets - Easy to tap investment cards
 * 5. Real-time updates - Pull-to-refresh for latest data
 * 6. Accessibility - Screen reader friendly labels
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
  
  summaryCard: {
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
  
  summaryTitle: {
    fontSize: 16,
    color: '#64748b',
    marginBottom: 8,
    textAlign: 'center',
  },
  
  totalValue: {
    fontSize: 36,
    fontWeight: 'bold',
    color: '#1a202c',
    textAlign: 'center',
    marginBottom: 20,
  },
  
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  
  summaryItem: {
    flex: 1,
    alignItems: 'center',
  },
  
  summaryLabel: {
    fontSize: 14,
    color: '#64748b',
    marginBottom: 4,
  },
  
  summaryValue: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 2,
  },
  
  summaryPercent: {
    fontSize: 14,
    fontWeight: '500',
  },
  
  positive: {
    color: '#059669',
  },
  
  negative: {
    color: '#dc2626',
  },
  
  actionContainer: {
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  
  buyButton: {
    backgroundColor: '#3b82f6',
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  
  buyButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  
  section: {
    marginHorizontal: 16,
  },
  
  sectionTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 12,
  },
  
  investmentCard: {
    backgroundColor: 'white',
    padding: 16,
    borderRadius: 8,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  
  investmentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  
  playerName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1a202c',
  },
  
  quantity: {
    fontSize: 14,
    color: '#64748b',
  },
  
  investmentDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  
  priceContainer: {
    alignItems: 'center',
  },
  
  priceLabel: {
    fontSize: 12,
    color: '#64748b',
    marginBottom: 2,
  },
  
  priceValue: {
    fontSize: 16,
    fontWeight: '500',
    color: '#374151',
  },
  
  gainLossContainer: {
    alignItems: 'flex-end',
  },
  
  gainLossValue: {
    fontSize: 16,
    fontWeight: '600',
  },
  
  gainLossPercent: {
    fontSize: 14,
    fontWeight: '500',
  },
  
  purchaseDate: {
    fontSize: 12,
    color: '#64748b',
  },
  
  bottomPadding: {
    height: 20,
  },
});