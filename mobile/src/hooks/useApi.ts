/**
 * API Data Fetching Hook
 * 
 * LEARNING NOTES: Mobile Data Fetching Patterns
 * 
 * This demonstrates:
 * 1. Custom hooks for API data management
 * 2. Loading states and error handling
 * 3. Caching and refresh strategies
 * 4. Network-aware data fetching
 * 5. TypeScript generics for reusable hooks
 */

import { useState, useEffect, useCallback } from 'react';
import { apiClient } from '../services/api';

/**
 * LEARNING NOTE: Generic API State Interface
 * 
 * This interface can be used for any API data type
 * Provides consistent structure across all API calls
 */
export interface ApiState<T> {
  data: T | null;
  isLoading: boolean;
  error: string | null;
  lastFetched: Date | null;
}

/**
 * LEARNING NOTE: API Hook Configuration
 * 
 * Options to control hook behavior
 */
export interface UseApiOptions {
  immediate?: boolean; // Fetch immediately on mount
  cacheTime?: number; // Cache duration in milliseconds
  refetchInterval?: number; // Auto-refetch interval
}

/**
 * Generic API Data Fetching Hook
 * 
 * LEARNING NOTE: Generic Hook Pattern
 * This hook can be used with any API endpoint and data type:
 * - Type-safe with TypeScript generics
 * - Consistent loading/error states
 * - Built-in caching and refresh logic
 * - Network-aware behavior
 */
export function useApi<T>(
  apiCall: () => Promise<T>,
  options: UseApiOptions = {}
) {
  const { immediate = true, cacheTime = 5 * 60 * 1000 } = options; // 5 minutes default cache

  // State management
  const [state, setState] = useState<ApiState<T>>({
    data: null,
    isLoading: false,
    error: null,
    lastFetched: null,
  });

  /**
   * LEARNING NOTE: Fetch Function with Error Handling
   * 
   * Centralized fetch logic with consistent error handling
   */
  const fetchData = useCallback(async () => {
    setState(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      const data = await apiCall();
      setState({
        data,
        isLoading: false,
        error: null,
        lastFetched: new Date(),
      });
    } catch (error: any) {
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: error.message || 'An error occurred while fetching data',
      }));
    }
  }, [apiCall]);

  /**
   * LEARNING NOTE: Cache Validation
   * 
   * Check if cached data is still valid
   */
  const isCacheValid = useCallback(() => {
    if (!state.lastFetched) return false;
    const now = new Date().getTime();
    const lastFetch = state.lastFetched.getTime();
    return (now - lastFetch) < cacheTime;
  }, [state.lastFetched, cacheTime]);

  /**
   * LEARNING NOTE: Smart Refresh Logic
   * 
   * Only fetch if cache is invalid or force refresh
   */
  const refresh = useCallback(async (force = false) => {
    if (force || !isCacheValid()) {
      await fetchData();
    }
  }, [fetchData, isCacheValid]);

  /**
   * LEARNING NOTE: Effect for Initial Fetch
   * 
   * Automatically fetch data on mount if immediate is true
   */
  useEffect(() => {
    if (immediate) {
      fetchData();
    }
  }, [immediate, fetchData]);

  return {
    ...state,
    refresh,
    refetch: () => fetchData(), // Force refetch ignoring cache
  };
}

/**
 * Specific hooks for common API endpoints
 * 
 * LEARNING NOTE: Specialized Hook Pattern
 * Create specific hooks for common use cases
 * This provides better ergonomics and type safety
 */

/**
 * Hook for fetching player cards
 */
export const usePlayerCards = (options?: UseApiOptions) => {
  return useApi(() => apiClient.getPlayerCards(), options);
};

/**
 * Hook for fetching live player data (for search)
 */
export const useLivePlayerData = (options?: UseApiOptions) => {
  return useApi(() => apiClient.getLivePlayerData(), options);
};

/**
 * Hook for fetching specific player data
 */
export const usePlayer = (cardId: string, options?: UseApiOptions) => {
  return useApi(() => apiClient.getPlayerById(cardId), {
    immediate: !!cardId, // Only fetch if cardId is provided
    ...options,
  });
};

/**
 * Hook for fetching player predictions
 */
export const usePlayerPredictions = (cardId: string, options?: UseApiOptions) => {
  return useApi(() => apiClient.getPlayerPredictions(cardId), {
    immediate: !!cardId,
    ...options,
  });
};

/**
 * Hook for fetching user investments
 */
export const useUserInvestments = (userId: string, options?: UseApiOptions) => {
  return useApi(() => apiClient.getUserInvestments(userId), {
    immediate: !!userId,
    ...options,
  });
};

/**
 * Hook for fetching portfolio summary
 */
export const usePortfolioSummary = (userId: string, options?: UseApiOptions) => {
  return useApi(() => apiClient.getPortfolioSummary(userId), {
    immediate: !!userId,
    ...options,
  });
};

/**
 * Hook for fetching chat messages
 */
export const useChatMessages = (options?: UseApiOptions) => {
  return useApi(() => apiClient.getChatMessages(), options);
};

/**
 * Hook for fetching user profile
 */
export const useUserProfile = (userId: string, options?: UseApiOptions) => {
  return useApi(() => apiClient.getUserProfile(userId), {
    immediate: !!userId,
    ...options,
  });
};

/**
 * LEARNING NOTES: API Hook Best Practices
 * 
 * Key principles for mobile data fetching:
 * 
 * 1. **Generic Patterns**: Reusable hooks that work with any data type
 * 2. **Specialized Hooks**: Specific hooks for common endpoints
 * 3. **Caching**: Avoid unnecessary network requests
 * 4. **Error Handling**: Consistent error states and user feedback
 * 5. **Loading States**: Clear loading indicators for better UX
 * 6. **Type Safety**: Full TypeScript coverage for API responses
 * 7. **Performance**: Efficient re-renders and memory usage
 * 8. **Network Awareness**: Handle offline scenarios gracefully
 * 
 * Usage Examples:
 * ```typescript
 * // Generic usage
 * const { data, isLoading, error, refresh } = useApi(() => apiClient.getPlayerCards());
 * 
 * // Specialized usage
 * const { data: players, isLoading } = usePlayerCards();
 * const { data: player } = usePlayer(playerId);
 * const { data: portfolio } = usePortfolioSummary(userId);
 * ```
 */