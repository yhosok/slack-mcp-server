import type { SlackUser } from '../../types/core/users.js';

/**
 * Infrastructure User Service - Pure Utility for User Information Management
 *
 * This service provides shared user utilities across the Infrastructure layer.
 *
 * **Role**: Pure utility service for display name resolution, caching, and basic user info
 * **Used by**: thread-service, reaction-service, workspace-service, and other infrastructure components
 * **Responsibility**: Efficient user data retrieval with caching, NOT MCP tool implementation
 *
 * Note: This is distinct from Services layer UserService which implements MCP tools.
 * Both services have different responsibilities and can coexist.
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
 * Dependencies for creating an Infrastructure UserService
 *
 * Provides the WebClient needed for user API operations.
 * The client is obtained through dependency injection to ensure
 * proper token strategy and rate limiting.
 */
export interface UserServiceDependencies {
  /**
   * Function to get appropriate WebClient for user operations
   */
  getClient: () => import('@slack/web-api').WebClient;
}
