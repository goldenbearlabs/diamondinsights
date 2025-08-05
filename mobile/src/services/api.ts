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

// API Base URL - configured for your DiamondInsights setup
const API_BASE_URL = __DEV__ 
  ? 'http://10.0.0.215:3002' // Development - your Next.js dev server (using network IP)
  : 'https://diamondinsights.vercel.app'; // Production - your deployed app

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

// Investment data structure matching website implementation
export interface Investment {
  id: string;
  playerUUID: string;         // Reference to player card
  playerName: string;         // Cached player name
  quantity: number;           // Number of cards owned
  avgBuyPrice: number;        // Average purchase price per card
  userProjectedOvr: number;   // User's OVR prediction for profit calculation
  createdAt: string;
}

// Enhanced investment with player data (from optimized endpoint)
export interface InvestmentWithPlayer extends Investment {
  playerCard: {
    id: string;
    name: string;
    team: string;
    position: string;
    ovr: number;
    predicted_rank: number;
    predicted_rank_low: number;
    predicted_rank_high: number;
    confidence_percentage: number;
    qs_pred: number;
    baked_img: string | null;
    delta_rank_pred: number;
  };
}

// Portfolio summary matching website calculations
export interface PortfolioSummary {
  cost: number;           // Total investment cost
  aiValue: number;        // AI projected portfolio value
  aiProfit: number;       // AI projected profit/loss
  myValue: number;        // User projected portfolio value
  myProfit: number;       // User projected profit/loss
}

// Trending card data structure matching website API
export interface TrendingCard {
  id: string;
  name: string;
  team_short_name: string;
  display_position: string;
  baked_img: string;
  ovr: number;
  predicted_rank: number;
  delta_rank_pred: number;
  upvotes: number;        // Real vote counts from API
  downvotes: number;      // Real vote counts from API
  netVotes: number;       // upvotes - downvotes (calculated by API)
  totalVotes: number;     // upvotes + downvotes (calculated by API)
}

/**
 * MLB The Show quick-sell value calculation
 * Maps overall rating to quick-sell stub value
 */
export function qsValue(ovr: number): number {
  if (ovr < 65)        return 5;        // Bronze cards
  if (ovr < 75)        return 25;       // Silver cards
  if (ovr === 75)      return 50;       // Gold tier entry
  if (ovr === 76)      return 75;
  if (ovr === 77)      return 100;
  if (ovr === 78)      return 125;
  if (ovr === 79)      return 150;
  if (ovr === 80)      return 400;      // Diamond tier entry - significant jump
  if (ovr === 81)      return 600;
  if (ovr === 82)      return 900;
  if (ovr === 83)      return 1200;
  if (ovr === 84)      return 1500;
  if (ovr === 85)      return 3000;     // High diamond tier - major value increase
  if (ovr === 86)      return 3750;
  if (ovr === 87)      return 4500;
  if (ovr === 88)      return 5500;
  if (ovr === 89)      return 7000;
  if (ovr === 90)      return 8000;     // Elite tier
  if (ovr === 91)      return 9000;
  return ovr >= 92 ? 10000 : 0;        // Max tier cards
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
   * Ensure user is authenticated and set auth token
   */
  private async ensureAuthenticated(): Promise<void> {
    try {
      const { auth } = await import('./firebase');
      
      if (!auth) {
        throw new Error('Firebase auth service not available');
      }

      const user = auth.currentUser;
      
      if (!user) {
        throw new Error('User not authenticated');
      }

      const token = await user.getIdToken();
      this.setAuthToken(token);
    } catch (error) {
      console.error('Failed to get auth token:', error);
      throw new Error('Authentication failed');
    }
  }

  /**
   * Generic HTTP request method with error handling
   */
  private async request<T>(
    endpoint: string, 
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.baseURL}${endpoint}`;
    
    // Create AbortController for timeout (React Native compatible)
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout
    
    const finalHeaders = {
      ...this.defaultHeaders,
      ...options.headers,
    };
    
    // Optional debug logging (disabled in production)
    if (__DEV__) {
      console.log('API REQUEST:', {
        url,
        method: options.method || 'GET',
      });
    }
    
    try {
      const response = await fetch(url, {
        ...options,
        headers: finalHeaders,
        signal: controller.signal,
      });

      clearTimeout(timeoutId); // Clear timeout if request succeeds

      if (__DEV__) {
        console.log('API RESPONSE:', {
          url,
          status: response.status,
        });
      }

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const responseData = await response.json();
      return responseData;
    } catch (error) {
      clearTimeout(timeoutId); // Clear timeout on error
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

  /**
   * Get player with predictions (combined data)
   */
  async getPlayerWithPredictions(cardId: string): Promise<{card: PlayerCard, pred: PlayerPrediction}> {
    const [card, pred] = await Promise.all([
      this.getPlayerById(cardId),
      this.getPlayerPredictions(cardId)
    ]);
    return { card, pred };
  }

  /**
   * Get specific featured players (matching website landing page)
   */
  async getFeaturedPlayers(): Promise<Array<{card: PlayerCard, pred: PlayerPrediction}>> {
    const FEATURED_PLAYER_IDS = [
      '3e67d1f24ebdbbbe125e7040442f6e84', // Aaron Judge
      'b2585f509345e30749a913d76f462bc3', // Fernando Tatis Jr.
      '514cce4a132d7b9e56401205f68d9c04'  // Player 3
    ];
    
    const playerData = await Promise.all(
      FEATURED_PLAYER_IDS.map(id => this.getPlayerWithPredictions(id))
    );
    
    return playerData;
  }

  // === Investment APIs ===

  /**
   * Get user's investment portfolio (requires authentication)
   * Matches website's /api/investments endpoint
   */
  async getUserInvestments(): Promise<Investment[]> {
    // Ensure we have an auth token before making the request
    await this.ensureAuthenticated();
    return this.request<Investment[]>('/api/investments');
  }

  /**
   * Get user's investments with player data (optimized endpoint)
   * Reduces API calls and payload size significantly
   */
  async getUserInvestmentsWithPlayers(): Promise<InvestmentWithPlayer[]> {
    await this.ensureAuthenticated();
    return this.request<InvestmentWithPlayer[]>('/api/investments/with-players');
  }

  /**
   * Create new investment (requires authentication)
   */
  async createInvestment(investment: {
    playerUUID: string;
    playerName: string;
    quantity: number;
    avgBuyPrice: number;
    userProjectedOvr: number;
  }): Promise<Investment> {
    await this.ensureAuthenticated();
    return this.request<Investment>('/api/investments', {
      method: 'POST',
      body: JSON.stringify(investment),
    });
  }

  /**
   * Update existing investment (requires authentication)
   */
  async updateInvestment(id: string, updates: {
    quantity?: number;
    avgBuyPrice?: number;
    userProjectedOvr?: number;
  }): Promise<Investment> {
    await this.ensureAuthenticated();
    return this.request<Investment>(`/api/investments/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(updates),
    });
  }

  /**
   * Delete investment (requires authentication)
   */
  async deleteInvestment(id: string): Promise<void> {
    await this.ensureAuthenticated();
    return this.request<void>(`/api/investments/${id}`, {
      method: 'DELETE',
    });
  }

  /**
   * Get public portfolio for a specific user (no auth required)
   */
  async getPublicPortfolio(userId: string): Promise<Investment[]> {
    return this.request<Investment[]>(`/api/users/${userId}/investments`);
  }

  // === Community APIs ===

  /**
   * Get trending player cards with vote data (matches /api/trending/cards)
   */
  async getTrendingCards(): Promise<TrendingCard[]> {
    return this.request<TrendingCard[]>('/api/trending/cards');
  }

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
  timeout: 30000,
  retryAttempts: 3,
  cacheEnabled: true,
};