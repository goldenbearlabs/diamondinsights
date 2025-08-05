/**
 * SkeletonLoader - Animated placeholder components
 * 
 * Provides smooth loading placeholders that are more visually appealing
 * than spinning indicators and make the app feel faster.
 */

import React, { useEffect, useRef } from 'react';
import { View, Animated, StyleSheet, ViewStyle } from 'react-native';
import { theme } from '../styles/theme';

interface SkeletonProps {
  width?: number | string;
  height?: number;
  borderRadius?: number;
  style?: ViewStyle;
}

/**
 * Basic skeleton component with shimmer animation
 */
export const Skeleton: React.FC<SkeletonProps> = ({
  width = '100%',
  height = 20,
  borderRadius = 4,
  style,
}) => {
  const animatedValue = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const shimmer = Animated.loop(
      Animated.sequence([
        Animated.timing(animatedValue, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(animatedValue, {
          toValue: 0,
          duration: 1000,
          useNativeDriver: true,
        }),
      ])
    );

    shimmer.start();

    return () => shimmer.stop();
  }, [animatedValue]);

  const opacity = animatedValue.interpolate({
    inputRange: [0, 1],
    outputRange: [0.3, 0.7],
  });

  return (
    <Animated.View
      style={[
        styles.skeleton,
        {
          width,
          height,
          borderRadius,
          opacity,
        },
        style,
      ]}
    />
  );
};

/**
 * Skeleton for investment summary cards
 */
export const SummaryCardSkeleton: React.FC = () => (
  <View style={styles.summaryCardSkeleton}>
    <Skeleton width={60} height={12} style={{ marginBottom: 8 }} />
    <Skeleton width={80} height={16} />
  </View>
);

/**
 * Skeleton for investment card
 */
export const InvestmentCardSkeleton: React.FC = () => (
  <View style={styles.investmentCardSkeleton}>
    {/* Player header skeleton */}
    <View style={styles.investmentHeaderSkeleton}>
      <Skeleton width={50} height={70} borderRadius={6} style={{ marginRight: 12 }} />
      <View style={{ flex: 1 }}>
        <Skeleton width="70%" height={18} style={{ marginBottom: 4 }} />
        <Skeleton width="50%" height={14} />
      </View>
    </View>

    {/* Investment details skeleton */}
    <View style={styles.investmentBodySkeleton}>
      <View style={styles.investmentRowSkeleton}>
        <View style={styles.investmentDetailSkeleton}>
          <Skeleton width={40} height={12} style={{ marginBottom: 4 }} />
          <Skeleton width={30} height={14} />
        </View>
        <View style={styles.investmentDetailSkeleton}>
          <Skeleton width={60} height={12} style={{ marginBottom: 4 }} />
          <Skeleton width={40} height={14} />
        </View>
        <View style={styles.investmentDetailSkeleton}>
          <Skeleton width={50} height={12} style={{ marginBottom: 4 }} />
          <Skeleton width={50} height={14} />
        </View>
      </View>

      <View style={styles.investmentRowSkeleton}>
        <View style={styles.investmentDetailSkeleton}>
          <Skeleton width={50} height={12} style={{ marginBottom: 4 }} />
          <Skeleton width={25} height={14} />
        </View>
        <View style={styles.investmentDetailSkeleton}>
          <Skeleton width={30} height={12} style={{ marginBottom: 4 }} />
          <Skeleton width={35} height={14} />
        </View>
        <View style={styles.investmentDetailSkeleton}>
          <Skeleton width={40} height={12} style={{ marginBottom: 4 }} />
          <Skeleton width={35} height={14} />
        </View>
      </View>

      {/* Profit row skeleton */}
      <View style={styles.profitRowSkeleton}>
        <View style={styles.profitDetailSkeleton}>
          <Skeleton width={60} height={12} style={{ marginBottom: 4 }} />
          <Skeleton width={70} height={16} />
        </View>
        <View style={styles.profitDetailSkeleton}>
          <Skeleton width={70} height={12} style={{ marginBottom: 4 }} />
          <Skeleton width={70} height={16} />
        </View>
      </View>
    </View>

    {/* Actions skeleton */}
    <View style={styles.investmentActionsSkeleton}>
      <Skeleton width={80} height={32} borderRadius={6} />
      <Skeleton width={80} height={32} borderRadius={6} />
    </View>
  </View>
);

const styles = StyleSheet.create({
  skeleton: {
    backgroundColor: theme.colors.background.medium,
  },

  summaryCardSkeleton: {
    flex: 1,
    backgroundColor: theme.colors.background.medium,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.colors.border.primary,
    alignItems: 'center',
  },

  investmentCardSkeleton: {
    backgroundColor: theme.colors.background.medium,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: theme.colors.border.primary,
  },

  investmentHeaderSkeleton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },

  investmentBodySkeleton: {
    marginBottom: 12,
  },

  investmentRowSkeleton: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },

  investmentDetailSkeleton: {
    flex: 1,
    alignItems: 'center',
  },

  profitRowSkeleton: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 8,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border.primary,
  },

  profitDetailSkeleton: {
    alignItems: 'center',
  },

  investmentActionsSkeleton: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    gap: 8,
  },
});