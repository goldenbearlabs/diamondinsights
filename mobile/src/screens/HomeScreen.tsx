/**
 * HomeScreen - Landing Page (Website Replica)
 * 
 * LEARNING NOTES: Website-to-Mobile Adaptation
 * 
 * This demonstrates replicating web design on mobile:
 * 1. Exact same 3 featured players as website
 * 2. Hero section with gradient and brand colors
 * 3. Focus/blur card effects from desktop
 * 4. Responsive layout for mobile screens
 * 5. Brand-consistent typography and colors
 */

import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Image,
  Dimensions,
  Linking,
} from 'react-native';

// Import our custom components and design system
import { theme } from '../styles/theme';
import { useFeaturedPlayers } from '../hooks/useApi';

// Import icons for How It Works section
import { Ionicons } from '@expo/vector-icons';

// Get screen dimensions for responsive layout
const { width: screenWidth } = Dimensions.get('window');

/**
 * HomeScreen Component - Website Landing Page Replica
 * 
 * LEARNING NOTE: Mobile Adaptation of Web Design
 * This exactly replicates your website's landing page design:
 * - Same 3 featured players (Aaron Judge, Fernando Tatis Jr., Player 3)
 * - Hero section with gradient background and brand colors
 * - Player cards with focus/blur effects
 * - Responsive layout for mobile screens
 */
export const HomeScreen: React.FC = () => {
  // Fetch the exact same featured players as website
  const { 
    data: featuredPlayers, 
    isLoading: playersLoading, 
    error: playersError, 
    refresh: refreshPlayers 
  } = useFeaturedPlayers();

  /**
   * LEARNING NOTE: Pull-to-Refresh Pattern
   * Refreshes the same 3 featured players
   */
  const onRefresh = async () => {
    await refreshPlayers(true); // Force refresh
  };

  /**
   * LEARNING NOTE: Navigation Handlers
   * Will be updated to use React Navigation later
   */
  const handlePlayerPress = (playerId: string, playerName: string) => {
    console.log(`Navigate to player ${playerName} (${playerId})`);
    // TODO: Navigate to PlayerDetail screen
  };

  const handleGetStarted = () => {
    console.log('Navigate to signup');
    // TODO: Navigate to signup
  };

  const handleViewPredictions = () => {
    console.log('Navigate to predictions');
    // TODO: Navigate to predictions tab
  };

  /**
   * Format numbers like the website
   */
  const fmt = (n: number, d = 2) => n.toFixed(d);

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView 
        style={styles.scrollContainer}
        refreshControl={
          <RefreshControl refreshing={playersLoading} onRefresh={onRefresh} />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* Hero Section - Matching Website */}
        <View style={styles.heroSection}>
          <View style={styles.heroContent}>
            {/* DiamondInsights Logo */}
            <View style={styles.logoContainer}>
              <Text style={styles.logoText}>
                <Text style={styles.logoPart1}>Diamond</Text>
                <Text style={styles.logoPart2}>Insights</Text>
              </Text>
            </View>
            
            <View style={styles.heroTitleContainer}>
              <Text style={styles.heroTitleLine}>AI-Powered</Text>
              <Text style={styles.heroTitleAccent}>Roster Predictions</Text>
              <Text style={styles.heroTitleLine}>for MLB The Show</Text>
            </View>
            <Text style={styles.heroSubtitle}>
              Get ahead of roster updates with machine learning-powered predictions
            </Text>
            <View style={styles.heroCta}>
              <TouchableOpacity style={styles.ctaPrimary} onPress={handleGetStarted}>
                <Text style={styles.ctaPrimaryText}>Get Started Free</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.ctaSecondary} onPress={handleViewPredictions}>
                <Text style={styles.ctaSecondaryText}>View Predictions</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Player Cards - Exact Website Layout */}
          <View style={styles.heroCards}>
            {/* Error State */}
            {playersError && (
              <View style={styles.errorContainer}>
                <Text style={styles.errorText}>
                  Unable to load featured players. Please check your connection.
                </Text>
                <TouchableOpacity style={styles.retryButton} onPress={() => refreshPlayers(true)}>
                  <Text style={styles.retryButtonText}>Retry</Text>
                </TouchableOpacity>
              </View>
            )}
            
            {/* Loading State */}
            {playersLoading && (
              <View style={styles.loadingContainer}>
                <Text style={styles.loadingText}>Loading featured players...</Text>
              </View>
            )}
            
            {/* Featured Player Cards */}
            {!playersLoading && !playersError && featuredPlayers && featuredPlayers.map(({ card, pred }, index) => {
              const oldRank = parseFloat(String(pred.old_rank || 0));
              const predictedRank = parseFloat(String(pred.predicted_rank || 0));
              const isMiddleCard = index === 1; // Fernando Tatis Jr. in focus
              
              const cardContent = (
                <TouchableOpacity
                  style={[
                    styles.playerCard,
                    isMiddleCard ? styles.focusedCard : styles.blurredCard
                  ]}
                  onPress={() => handlePlayerPress(card.id, pred.name)}
                  activeOpacity={0.9}
                >
                  <View style={styles.cardHeader}>
                    <Image 
                      source={{ uri: String(pred.baked_img || card.baked_img) }}
                      style={styles.playerImage}
                      resizeMode="contain"
                    />
                    <View style={styles.playerInfo}>
                      {(() => {
                        const fullName = String(pred.name);
                        const nameParts = fullName.split(' ');
                        const firstName = nameParts[0] || '';
                        const lastName = nameParts.slice(1).join(' ') || '';
                        
                        return (
                          <>
                            <Text style={styles.playerName}>{firstName}</Text>
                            {lastName && <Text style={styles.playerName}>{lastName}</Text>}
                          </>
                        );
                      })()}
                      <Text style={styles.playerPosition}>{String(pred.display_position)}</Text>
                    </View>
                  </View>
                  
                  <View style={styles.ratingComparison}>
                    <View style={styles.currentRating}>
                      <Text style={styles.ratingLabel}>Current</Text>
                      <Text style={styles.ratingValue}>{fmt(oldRank, 0)}</Text>
                    </View>

                    <View style={styles.predictionArrow}>
                      <Text style={styles.arrowText}>→</Text>
                    </View>

                    <View style={styles.predictedRating}>
                      <Text style={styles.ratingLabel}>Predicted</Text>
                      <Text style={styles.ratingValue}>{fmt(predictedRank)}</Text>
                    </View>
                  </View>
                  
                  <View style={styles.confidenceBadge}>
                    <Text style={styles.confidenceText}>
                      📈 {String(pred.confidence_percentage)}% Confidence
                    </Text>
                  </View>
                </TouchableOpacity>
              );

              // Return blurred cards with enhanced visual effects
              if (!isMiddleCard) {
                return (
                  <View key={index} style={styles.blurContainer}>
                    <View style={styles.blurredCardWrapper}>
                      {cardContent}
                    </View>
                  </View>
                );
              }
              
              // Return focused card without blur
              return <View key={index}>{cardContent}</View>;
            })}
          </View>
        </View>

        {/* Stats Section - Matching Website */}
        <View style={styles.statsSection}>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>96%</Text>
            <Text style={styles.statLabel}>Accuracy Rate</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>18k+</Text>
            <Text style={styles.statLabel}>Players Analyzed</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>#1</Text>
            <Text style={styles.statLabel}>MLB Investment Tool</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>2k+</Text>
            <Text style={styles.statLabel}>Active Investors</Text>
          </View>
        </View>

        {/* How Our AI Predictions Work Section */}
        <View style={styles.howSection}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>How Our AI Predictions Work</Text>
            <Text style={styles.sectionSubtitle}>
              Advanced machine learning models analyze player performance data
              to forecast roster updates
            </Text>
          </View>
          
          <View style={styles.processSteps}>
            <View style={styles.step}>
              <View style={styles.stepIcon}>
                <Ionicons name="server" size={32} color={theme.colors.primary.main} />
              </View>
              <Text style={styles.stepTitle}>Data Collection</Text>
              <Text style={styles.stepDescription}>
                Aggregate player stats, performance metrics, and historical roster data
              </Text>
            </View>
            
            <View style={styles.step}>
              <View style={styles.stepIcon}>
                <Ionicons name="analytics" size={32} color={theme.colors.primary.main} />
              </View>
              <Text style={styles.stepTitle}>AI Analysis</Text>
              <Text style={styles.stepDescription}>
                Machine learning models identify patterns and predict rating changes
              </Text>
            </View>
            
            <View style={styles.step}>
              <View style={styles.stepIcon}>
                <Ionicons name="trending-up" size={32} color={theme.colors.primary.main} />
              </View>
              <Text style={styles.stepTitle}>Investment Strategy</Text>
              <Text style={styles.stepDescription}>
                Get actionable insights to build your investment portfolio
              </Text>
            </View>
            
            <View style={styles.step}>
              <View style={styles.stepIcon}>
                <Ionicons name="refresh" size={32} color={theme.colors.primary.main} />
              </View>
              <Text style={styles.stepTitle}>Continuous Updates</Text>
              <Text style={styles.stepDescription}>
                Models retrained daily with the latest player performance data
              </Text>
            </View>
          </View>
        </View>

        {/* Join Our Community Section */}
        <View style={styles.communitySection}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Join Our Community</Text>
            <Text style={styles.sectionSubtitle}>
              Connect with thousands of MLB The Show investors
            </Text>
          </View>
          
          <View style={styles.communityCta}>
            <TouchableOpacity 
              style={styles.communityLink}
              onPress={() => Linking.openURL('https://x.com/DiamondIns58780')}
              activeOpacity={0.8}
            >
              <Ionicons name="logo-twitter" size={20} color={theme.colors.text.primary} />
              <Text style={styles.communityLinkText}>Follow on Twitter</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={styles.communityLink}
              onPress={() => Linking.openURL('https://www.instagram.com/diamondinsights.app/')}
              activeOpacity={0.8}
            >
              <Ionicons name="logo-instagram" size={20} color={theme.colors.text.primary} />
              <Text style={styles.communityLinkText}>Follow on Instagram</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={styles.communityLink}
              onPress={() => Linking.openURL('https://www.tiktok.com/@diamondinsights.app')}
              activeOpacity={0.8}
            >
              <Ionicons name="logo-tiktok" size={20} color={theme.colors.text.primary} />
              <Text style={styles.communityLinkText}>Follow on TikTok</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Bottom padding */}
        <View style={styles.bottomPadding} />
      </ScrollView>
    </SafeAreaView>
  );
};

/**
 * LEARNING NOTES: Website-to-Mobile Styling
 * 
 * Key adaptations from your website design:
 * 1. Exact color matching with CSS variables
 * 2. Hero section with gradient background
 * 3. Focus/blur card effects from desktop
 * 4. Responsive typography for mobile
 * 5. Brand-consistent visual hierarchy
 */
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background.dark,
  },
  
  scrollContainer: {
    flex: 1,
  },
  
  // Hero Section - Matching Website
  heroSection: {
    alignItems: 'center',
    paddingVertical: theme.spacing['3xl'],
    paddingHorizontal: theme.spacing.lg,
    // Gradient background matching website
    backgroundColor: '#1a1a1a', // Will add gradient effect with additional view if needed
    borderRadius: theme.borderRadius.md,
    marginBottom: theme.spacing.lg,
  },
  
  heroContent: {
    maxWidth: 800,
    marginBottom: theme.spacing['3xl'],
    alignItems: 'center',
  },
  
  // DiamondInsights Logo
  logoContainer: {
    alignItems: 'center',
    marginBottom: theme.spacing['2xl'],
  },
  
  logoText: {
    fontSize: screenWidth > 400 ? 36 : 32, // Larger than website for mobile readability
    fontWeight: theme.typography.fontWeight.bold,
    textAlign: 'center',
  },
  
  logoPart1: {
    color: theme.colors.secondary.main, // #e5e4e2 - matches website accent-secondary
  },
  
  logoPart2: {
    color: theme.colors.primary.main, // #1263dd - matches website accent-primary
  },
  
  heroTitleContainer: {
    alignItems: 'center',
    marginBottom: theme.spacing.lg,
  },
  
  heroTitleLine: {
    fontSize: screenWidth > 400 ? 32 : 28, // Responsive font size
    lineHeight: 1.1 * (screenWidth > 400 ? 32 : 28), // Tighter line spacing
    textAlign: 'center',
    color: theme.colors.text.primary,
    fontWeight: theme.typography.fontWeight.bold,
  },
  
  heroTitleAccent: {
    fontSize: screenWidth > 400 ? 32 : 28, // Same size as other lines
    lineHeight: 1.1 * (screenWidth > 400 ? 32 : 28), // Tighter line spacing
    textAlign: 'center',
    color: theme.colors.primary.main, // #1263dd - your brand blue
    fontWeight: theme.typography.fontWeight.bold,
  },
  
  heroSubtitle: {
    fontSize: theme.typography.fontSize.lg,
    color: theme.colors.text.secondary,
    marginBottom: theme.spacing['2xl'],
    textAlign: 'center',
    maxWidth: 600,
  },
  
  heroCta: {
    flexDirection: screenWidth > 400 ? 'row' : 'column',
    justifyContent: 'center',
    gap: theme.spacing.lg,
  },
  
  ctaPrimary: {
    backgroundColor: theme.colors.primary.main,
    paddingHorizontal: theme.spacing['2xl'],
    paddingVertical: theme.spacing.lg,
    borderRadius: theme.borderRadius.md,
    minWidth: 140,
  },
  
  ctaPrimaryText: {
    color: 'white',
    fontSize: theme.typography.fontSize.base,
    fontWeight: theme.typography.fontWeight.semibold,
    textAlign: 'center',
  },
  
  ctaSecondary: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: theme.colors.border.primary,
    paddingHorizontal: theme.spacing['2xl'],
    paddingVertical: theme.spacing.lg,
    borderRadius: theme.borderRadius.md,
    minWidth: 140,
  },
  
  ctaSecondaryText: {
    color: theme.colors.text.primary,
    fontSize: theme.typography.fontSize.base,
    fontWeight: theme.typography.fontWeight.semibold,
    textAlign: 'center',
  },
  
  // Player Cards - Mobile Vertical Layout
  heroCards: {
    flexDirection: 'row', // Three cards side-by-side
    justifyContent: 'center',
    alignItems: 'center',
    gap: theme.spacing.sm, // Smaller gap for horizontal layout
    maxWidth: 1000,
    width: '100%',
  },
  
  playerCard: {
    backgroundColor: theme.colors.background.medium,
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(77, 184, 184, 0.1)',
    padding: theme.spacing.md,
    width: (screenWidth - 48) / 3, // Three slightly wider cards side-by-side
    minHeight: 170, // Taller for vertical layout with image on top
    ...theme.shadows.large,
  },
  
  focusedCard: {
    transform: [{ scale: 1.05 }], // More prominent scale for better contrast
    borderColor: 'rgba(77, 184, 184, 0.5)',
    shadowColor: 'rgba(77, 184, 184, 0.4)',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.5,
    shadowRadius: 25,
    elevation: 10,
  },
  
  blurredCard: {
    transform: [{ scale: 0.95 }], // Scale difference for visual hierarchy
  },
  
  blurContainer: {
    borderRadius: 12,
  },
  
  blurredCardWrapper: {
    opacity: 0.6, // Stronger blur effect
    backgroundColor: 'rgba(0, 0, 0, 0.2)', // Add dark overlay
    borderRadius: 12,
  },
  
  cardHeader: {
    flexDirection: 'column',
    alignItems: 'center',
    marginBottom: theme.spacing.sm,
  },
  
  playerImage: {
    width: 48,
    height: 64,
    borderRadius: 6,
    marginBottom: theme.spacing.xs,
    borderWidth: 2,
    borderColor: theme.colors.primary.main,
  },
  
  playerInfo: {
    alignItems: 'center',
  },
  
  playerName: {
    fontSize: 10,
    fontWeight: theme.typography.fontWeight.bold,
    color: theme.colors.text.primary,
    marginBottom: 1,
    lineHeight: 12,
    textAlign: 'center',
  },
  
  playerPosition: {
    fontSize: 8,
    color: theme.colors.text.secondary,
    textAlign: 'center',
  },
  
  ratingComparison: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: theme.spacing.sm,
  },
  
  currentRating: {
    alignItems: 'center',
    flex: 1,
  },
  
  predictedRating: {
    alignItems: 'center',
    flex: 1,
  },
  
  ratingLabel: {
    fontSize: 6,
    color: theme.colors.text.secondary,
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  
  ratingValue: {
    fontSize: 10,
    fontWeight: theme.typography.fontWeight.bold,
    color: theme.colors.text.primary,
  },
  
  predictionArrow: {
    paddingHorizontal: theme.spacing.xs,
  },
  
  arrowText: {
    fontSize: 10,
    color: theme.colors.text.secondary,
  },
  
  confidenceBadge: {
    backgroundColor: 'rgba(77, 184, 184, 0.1)',
    paddingHorizontal: theme.spacing.xs,
    paddingVertical: 4,
    borderRadius: theme.borderRadius.sm,
    alignSelf: 'center',
  },
  
  confidenceText: {
    fontSize: 10,
    color: theme.colors.chart.up, // Teal color from website
    fontWeight: theme.typography.fontWeight.medium,
  },
  
  // Stats Section - Website Design
  statsSection: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: theme.spacing['3xl'],
    paddingHorizontal: theme.spacing.lg,
    backgroundColor: theme.colors.background.medium,
    marginHorizontal: theme.spacing.lg,
    marginBottom: theme.spacing.lg,
    borderRadius: theme.borderRadius.md,
  },
  
  statItem: {
    alignItems: 'center',
    flex: 1,
  },
  
  statValue: {
    fontSize: theme.typography.fontSize['3xl'],
    fontWeight: theme.typography.fontWeight.bold,
    color: theme.colors.text.primary,
    marginBottom: theme.spacing.xs,
  },
  
  statLabel: {
    fontSize: theme.typography.fontSize.xs,
    color: theme.colors.text.secondary,
    textAlign: 'center',
    paddingHorizontal: theme.spacing.xs,
  },
  
  bottomPadding: {
    height: theme.spacing['3xl'],
  },
  
  // How Our AI Predictions Work Section
  howSection: {
    paddingVertical: theme.spacing['3xl'],
    paddingHorizontal: theme.spacing.lg,
    backgroundColor: theme.colors.background.dark,
    marginBottom: theme.spacing.lg,
  },
  
  sectionHeader: {
    alignItems: 'center',
    marginBottom: theme.spacing['3xl'],
  },
  
  sectionTitle: {
    fontSize: theme.typography.fontSize['2xl'],
    fontWeight: theme.typography.fontWeight.bold,
    color: theme.colors.text.primary,
    textAlign: 'center',
    marginBottom: theme.spacing.lg,
  },
  
  sectionSubtitle: {
    fontSize: theme.typography.fontSize.base,
    color: theme.colors.text.secondary,
    textAlign: 'center',
    lineHeight: 24,
    maxWidth: 300,
  },
  
  processSteps: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: theme.spacing.lg,
  },
  
  step: {
    backgroundColor: theme.colors.background.medium,
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.lg,
    alignItems: 'center',
    width: (screenWidth - 48) / 2 - theme.spacing.sm, // 2 columns on mobile
    marginBottom: theme.spacing.lg,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
  },
  
  stepIcon: {
    width: 60,
    height: 60,
    backgroundColor: 'rgba(18, 99, 221, 0.1)',
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: theme.spacing.lg,
  },
  
  stepTitle: {
    fontSize: theme.typography.fontSize.base,
    fontWeight: theme.typography.fontWeight.bold,
    color: theme.colors.text.primary,
    textAlign: 'center',
    marginBottom: theme.spacing.sm,
  },
  
  stepDescription: {
    fontSize: theme.typography.fontSize.sm,
    color: theme.colors.text.secondary,
    textAlign: 'center',
    lineHeight: 20,
  },
  
  // Join Our Community Section
  communitySection: {
    paddingVertical: theme.spacing['3xl'],
    paddingHorizontal: theme.spacing.lg,
    backgroundColor: theme.colors.background.dark,
    marginBottom: theme.spacing.lg,
  },
  
  communityCta: {
    flexDirection: 'column',
    alignItems: 'center',
    gap: theme.spacing.lg,
  },
  
  communityLink: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.background.medium,
    paddingVertical: theme.spacing.lg,
    paddingHorizontal: theme.spacing.xl,
    borderRadius: 30,
    borderWidth: 1,
    borderColor: 'rgba(77, 184, 184, 0.1)',
    minWidth: 200,
    justifyContent: 'center',
    gap: theme.spacing.sm,
  },
  
  communityLinkText: {
    fontSize: theme.typography.fontSize.base,
    fontWeight: theme.typography.fontWeight.medium,
    color: theme.colors.text.primary,
  },
  
  // Error and Loading States
  errorContainer: {
    backgroundColor: theme.colors.surface.elevated,
    padding: theme.spacing['3xl'],
    borderRadius: theme.borderRadius.md,
    alignItems: 'center',
    margin: theme.spacing.lg,
  },
  
  errorText: {
    fontSize: theme.typography.fontSize.base,
    color: theme.colors.error,
    textAlign: 'center',
    marginBottom: theme.spacing.lg,
  },
  
  retryButton: {
    backgroundColor: theme.colors.primary.main,
    paddingHorizontal: theme.spacing['2xl'],
    paddingVertical: theme.spacing.lg,
    borderRadius: theme.borderRadius.md,
  },
  
  retryButtonText: {
    color: 'white',
    fontSize: theme.typography.fontSize.base,
    fontWeight: theme.typography.fontWeight.semibold,
  },
  
  loadingContainer: {
    backgroundColor: theme.colors.surface.elevated,
    padding: theme.spacing['4xl'],
    borderRadius: theme.borderRadius.md,
    alignItems: 'center',
    margin: theme.spacing.lg,
  },
  
  loadingText: {
    fontSize: theme.typography.fontSize.lg,
    color: theme.colors.text.secondary,
  },
});