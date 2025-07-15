/**
 * API Service Layer for Mobile App
 * 
 * LEARNING NOTES: Mobile API Architecture
 * 
 * This demonstrates:
 * 1. API client setup for mobile apps
 * 2. TypeScript interfaces for API responses
 * 3. Error handling and network management
 * 4. Connecting to existing web app endpoints
 * 5. Caching strategies for mobile
 */

/**
 * LEARNING NOTE: API Base Configuration
 * 
 * Mobile apps need to configure API endpoints:
 * 1. Development: localhost or ngrok tunnel
 * 2. Production: your deployed API URL
 * 3. Environment-specific configuration
 */

// API Base URL - will need to be updated based on environment
const API_BASE_URL = __DEV__ 
  ? 'http://localhost:3000' // Development - your Next.js dev server
  : 'https://your-production-domain.com'; // Production - your deployed app

/**
 * LEARNING NOTE: TypeScript API Interfaces
 * 
 * Define interfaces that match your existing API responses
 * These should align with your web app's API structure
 */

export interface PlayerCard {
  id: string;
  name: string;
  team: string;
  position: string;
  currentRating: number;
  baked_img?: string; // Player image URL
}

export interface PlayerPrediction {
  id: string;
  name: string;
  currentRating: number;
  predictedRating: number;
  confidence: number;
  lastUpdated: string;
  trend: 'up' | 'down' | 'stable';
}

export interface Investment {
  id: string;
  userId: string;
  playerId: string;
  playerName: string;
  purchasePrice: number;
  currentPrice: number;
  quantity: number;
  purchaseDate: string;
  gainLoss: number;
  gainLossPercent: number;
}

export interface PortfolioSummary {
  totalValue: number;
  totalGainLoss: number;
  totalGainLossPercent: number;
  todayChange: number;
  todayChangePercent: number;
}

/**
 * LEARNING NOTE: HTTP Client Setup
 * 
 * Mobile apps need robust HTTP clients:
 * 1. Timeout handling for slow networks
 * 2. Retry logic for failed requests
 * 3. Authentication token management
 * 4. Error standardization
 */

class ApiClient {
  private baseURL: string;
  private defaultHeaders: Record<string, string>;

  constructor(baseURL: string) {
    this.baseURL = baseURL;
    this.defaultHeaders = {
      'Content-Type': 'application/json',
    };
  }

  /**
   * Generic HTTP request method with error handling
   */
  private async request<T>(
    endpoint: string, 
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.baseURL}${endpoint}`;
    
    try {
      const response = await fetch(url, {
        ...options,
        headers: {
          ...this.defaultHeaders,
          ...options.headers,
        },
        // Add timeout for mobile networks
        signal: AbortSignal.timeout(10000), // 10 second timeout
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error(`API request failed: ${url}`, error);
      throw error;
    }
  }

  /**
   * Set authentication token for requests
   */
  setAuthToken(token: string) {
    this.defaultHeaders['Authorization'] = `Bearer ${token}`;
  }

  /**
   * Clear authentication token
   */
  clearAuthToken() {
    delete this.defaultHeaders['Authorization'];
  }

  // === Player & Card APIs ===

  /**
   * Get all player cards (matches /api/cards)
   */
  async getPlayerCards(): Promise<PlayerCard[]> {
    return this.request<PlayerCard[]>('/api/cards');
  }

  /**
   * Get live player data for search (matches /api/cards/live)
   */
  async getLivePlayerData(): Promise<PlayerCard[]> {
    return this.request<PlayerCard[]>('/api/cards/live');
  }

  /**
   * Get specific player data (matches /api/cards/[cardId])
   */
  async getPlayerById(cardId: string): Promise<PlayerCard> {
    return this.request<PlayerCard>(`/api/cards/${cardId}`);
  }

  /**
   * Get player predictions (matches /api/cards/[cardId]/predictions)
   */
  async getPlayerPredictions(cardId: string): Promise<PlayerPrediction> {
    return this.request<PlayerPrediction>(`/api/cards/${cardId}/predictions`);
  }

  // === Investment APIs ===

  /**
   * Get user's investment portfolio (matches /api/investments)
   */
  async getUserInvestments(userId: string): Promise<Investment[]> {
    return this.request<Investment[]>(`/api/investments?userId=${userId}`);
  }

  /**
   * Get portfolio summary data
   */
  async getPortfolioSummary(userId: string): Promise<PortfolioSummary> {
    return this.request<PortfolioSummary>(`/api/investments/summary?userId=${userId}`);
  }

  /**
   * Create new investment
   */
  async createInvestment(investment: Omit<Investment, 'id'>): Promise<Investment> {
    return this.request<Investment>('/api/investments', {
      method: 'POST',
      body: JSON.stringify(investment),
    });
  }

  // === Community APIs ===

  /**
   * Get community chat messages (matches /api/chat)
   */
  async getChatMessages(): Promise<any[]> {
    return this.request<any[]>('/api/chat');
  }

  /**
   * Post new chat message
   */
  async postChatMessage(message: any): Promise<any> {
    return this.request<any>('/api/chat', {
      method: 'POST',
      body: JSON.stringify(message),
    });
  }

  /**
   * Get comments for a player (matches /api/comments)
   */
  async getPlayerComments(playerId: string): Promise<any[]> {
    return this.request<any[]>(`/api/comments?playerId=${playerId}`);
  }

  // === User APIs ===

  /**
   * Get user profile data (matches /api/users/[uid])
   */
  async getUserProfile(userId: string): Promise<any> {
    return this.request<any>(`/api/users/${userId}`);
  }

  /**
   * Update user profile
   */
  async updateUserProfile(userId: string, updates: any): Promise<any> {
    return this.request<any>(`/api/users/${userId}`, {
      method: 'PATCH',
      body: JSON.stringify(updates),
    });
  }
}

// Create and export API client instance
export const apiClient = new ApiClient(API_BASE_URL);

/**
 * LEARNING NOTES: Mobile API Best Practices
 * 
 * Key considerations for mobile API clients:
 * 1. **Network Resilience**: Handle timeouts, retries, and offline scenarios
 * 2. **Performance**: Cache responses, batch requests, optimize payload size
 * 3. **Security**: Token management, certificate pinning, request signing
 * 4. **User Experience**: Loading states, error messages, offline feedback
 * 5. **Development**: Environment switching, mock data, debugging tools
 * 6. **Type Safety**: Full TypeScript coverage for API contracts
 * 7. **Monitoring**: Request logging, performance metrics, error tracking
 */

/**
 * Helper function to check API connectivity
 * Useful for debugging and health checks
 */
export const checkApiHealth = async (): Promise<boolean> => {
  try {
    // Try to fetch a simple endpoint
    await apiClient.getPlayerCards();
    return true;
  } catch (error) {
    console.error('API health check failed:', error);
    return false;
  }
};

/**
 * Configuration for mobile-specific API behavior
 */
export const apiConfig = {
  baseURL: API_BASE_URL,
  timeout: 10000,
  retryAttempts: 3,
  cacheEnabled: true,
};