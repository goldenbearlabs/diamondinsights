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

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
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
   * Using useRef to avoid apiCall dependency issues
   */
  const apiCallRef = useRef(apiCall);
  
  // Update ref when apiCall changes but don't trigger re-renders
  useEffect(() => {
    apiCallRef.current = apiCall;
  });

  const fetchData = useCallback(async () => {
    setState(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      const data = await apiCallRef.current();
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
  }, []); // No dependencies - stable function

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
  const { immediate = true, cacheTime = 5 * 60 * 1000 } = options || {};

  // State management
  const [state, setState] = useState<ApiState<any[]>>({
    data: null,
    isLoading: false,
    error: null,
    lastFetched: null,
  });

  /**
   * Stable fetch function that doesn't change on every render
   */
  const fetchData = useCallback(async () => {
    setState(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      const data = await apiClient.getLivePlayerData();
      
      // Transform is_hitter field from string to boolean (matching website behavior)
      const transformedData = data.map(card => ({
        ...card,
        is_hitter: card.is_hitter === true || 
                  card.is_hitter === 'true' || 
                  card.is_hitter === 'True'
      }));
      
      setState({
        data: transformedData,
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
  }, []);

  /**
   * Check if cached data is still valid
   */
  const isCacheValid = useCallback(() => {
    if (!state.lastFetched) return false;
    const now = new Date().getTime();
    const lastFetch = state.lastFetched.getTime();
    return (now - lastFetch) < cacheTime;
  }, [state.lastFetched, cacheTime]);

  /**
   * Smart refresh logic
   */
  const refresh = useCallback(async (force = false) => {
    if (force || !isCacheValid()) {
      await fetchData();
    }
  }, [fetchData, isCacheValid]);

  /**
   * Effect for initial fetch
   */
  useEffect(() => {
    if (immediate) {
      fetchData();
    }
  }, [immediate, fetchData]);

  return {
    ...state,
    refresh,
    refetch: fetchData,
  };
};

/**
 * Hook for fetching live player data (for search)
 */
export const useLivePlayerData = (options?: UseApiOptions) => {
  return useApi(() => apiClient.getLivePlayerData(), options);
};

/**
 * Hook for fetching featured players (same as website landing page)
 */
export const useFeaturedPlayers = (options?: UseApiOptions) => {
  const { immediate = true, cacheTime = 5 * 60 * 1000 } = options || {};

  // State management
  const [state, setState] = useState<ApiState<Array<{card: any, pred: any}>>>({
    data: null,
    isLoading: false,
    error: null,
    lastFetched: null,
  });

  /**
   * Stable fetch function for featured players
   */
  const fetchData = useCallback(async () => {
    setState(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      const data = await apiClient.getFeaturedPlayers();
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
        error: error.message || 'An error occurred while fetching featured players',
      }));
    }
  }, []);

  /**
   * Check if cached data is still valid
   */
  const isCacheValid = useCallback(() => {
    if (!state.lastFetched) return false;
    const now = new Date().getTime();
    const lastFetch = state.lastFetched.getTime();
    return (now - lastFetch) < cacheTime;
  }, [state.lastFetched, cacheTime]);

  /**
   * Smart refresh logic
   */
  const refresh = useCallback(async (force = false) => {
    if (force || !isCacheValid()) {
      await fetchData();
    }
  }, [fetchData, isCacheValid]);

  /**
   * Effect for initial fetch
   */
  useEffect(() => {
    if (immediate) {
      fetchData();
    }
  }, [immediate, fetchData]);

  return {
    ...state,
    refresh,
    refetch: fetchData,
  };
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
 * Hook for fetching user investments (requires authentication)
 */
export const useUserInvestments = (options?: UseApiOptions) => {
  return useApi(() => apiClient.getUserInvestments(), options);
};

/**
 * Hook for fetching user investments with player data (optimized)
 * This reduces API calls and payload size significantly for portfolio loading
 */
export const useUserInvestmentsWithPlayers = (options?: UseApiOptions) => {
  return useApi(() => apiClient.getUserInvestmentsWithPlayers(), options);
};

/**
 * Hook for fetching public portfolio for a specific user
 */
export const usePublicPortfolio = (userId: string, options?: UseApiOptions) => {
  return useApi(() => apiClient.getPublicPortfolio(userId), {
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
 * INVESTMENT ACTION HOOKS
 * These hooks provide functions for creating, updating, and deleting investments
 */

/**
 * Hook for investment actions (create, update, delete)
 * Returns functions that can be called to perform these actions
 */
export const useInvestmentActions = () => {
  const createInvestment = async (investment: {
    playerUUID: string;
    playerName: string;
    quantity: number;
    avgBuyPrice: number;
    userProjectedOvr: number;
  }) => {
    return await apiClient.createInvestment(investment);
  };

  const updateInvestment = async (id: string, updates: {
    quantity?: number;
    avgBuyPrice?: number;
    userProjectedOvr?: number;
  }) => {
    return await apiClient.updateInvestment(id, updates);
  };

  const deleteInvestment = async (id: string) => {
    return await apiClient.deleteInvestment(id);
  };

  return {
    createInvestment,
    updateInvestment,
    deleteInvestment,
  };
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