// Shared constants for DiamondInsights
// These constants can be used by both web and mobile apps

export const CHAT_ROOMS = {
  MAIN: 'main',
  INVESTING: 'investing',
  FLIPPING: 'flipping',
  STUB_MAKING: 'stub-making',
} as const;

export const PLAYER_RARITIES = {
  COMMON: 'Common',
  BRONZE: 'Bronze',
  SILVER: 'Silver',
  GOLD: 'Gold',
  DIAMOND: 'Diamond',
} as const;

export const API_ENDPOINTS = {
  CARDS: '/api/cards',
  CARDS_LIVE: '/api/cards/live',
  INVESTMENTS: '/api/investments',
  CHAT: '/api/chat',
  USERS: '/api/users',
} as const;

export const FIREBASE_COLLECTIONS = {
  CARDS: 'cards',
  USERS: 'users',
  INVESTMENTS: 'investments',
  COMMENTS: 'comments',
} as const;

export const DEFAULT_PAGINATION = {
  PAGE_SIZE: 50,
  MAX_PAGE_SIZE: 100,
} as const;