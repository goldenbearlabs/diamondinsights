/**
 * Account utilities for special account handling
 */

/**
 * Check if a username belongs to the official DiamondInsights account
 */
export const isOfficialAccount = (username: string): boolean => {
  return username === 'diamondInsights';
};