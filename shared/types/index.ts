// Shared TypeScript types for DiamondInsights
// This file will contain common interfaces and types used by both web and mobile apps

export interface PlayerCard {
  id: string;
  name: string;
  ovr: number;
  predicted_rank: number;
  confidence_percentage: number;
  market_price: number;
  baked_img: string;
}

export interface UserInvestment {
  playerUUID: string;
  quantity: number;
  avgBuyPrice: number;
  userProjectedOvr: number;
  createdAt: number;
}

export interface ChatMessage {
  userId: string;
  text: string;
  timestamp: number;
  parentId?: string;
  likedBy: string[];
  playerId?: string;
}

export interface User {
  uid: string;
  email: string;
  username?: string;
  createdAt: number;
}