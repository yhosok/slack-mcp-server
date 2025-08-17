import type { SlackUser } from '../../types/core/users.js';

/**
 * Interface for managing user information and caching
 */
export interface UserService {
  /**
   * Get display name for a user ID, using cache when available
   * @param userId - The Slack user ID
   * @returns Promise resolving to the user's display name
   */
  getDisplayName(userId: string): Promise<string>;

  /**
   * Get display names for multiple user IDs efficiently
   * @param userIds - Array of Slack user IDs
   * @returns Promise resolving to a map of user IDs to display names
   */
  bulkGetDisplayNames(userIds: string[]): Promise<ReadonlyMap<string, string>>;

  /**
   * Get full user information for a user ID
   * @param userId - The Slack user ID
   * @returns Promise resolving to complete SlackUser information
   */
  getUserInfo(userId: string): Promise<SlackUser>;

  /**
   * Clear the user cache (useful for testing or when needed)
   */
  clearCache(): void;
}

/**
 * Dependencies for creating a UserService
 */
export interface UserServiceDependencies {
  /**
   * Function to get appropriate WebClient for user operations
   */
  getClient: () => import('@slack/web-api').WebClient;
}
