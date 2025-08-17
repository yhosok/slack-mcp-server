import { logger } from '../../../utils/logger.js';
import type { UserService, UserServiceDependencies } from './types.js';
import type { SlackUser, SlackUserProfile } from '../../types/core/users.js';

/**
 * Create a user service instance with caching capabilities
 * @param dependencies - Required dependencies for the service
 * @returns A new UserService instance
 */
export const createUserService = (dependencies: UserServiceDependencies): UserService => {
  // Immutable cache state management
  let userCache = new Map<string, string>();

  /**
   * Update the cache with new user information (immutable)
   * @param userId - The user ID to cache
   * @param displayName - The display name to cache
   */
  const updateCache = (userId: string, displayName: string): void => {
    userCache = new Map(userCache).set(userId, displayName);
  };

  // Note: updateCacheBulk removed as it's not currently used
  // Could be added back when bulk operations are needed

  /**
   * Get display name for a user ID
   */
  const getDisplayName = async (userId: string): Promise<string> => {
    // Return cached name if available
    if (userCache.has(userId)) {
      return userCache.get(userId)!;
    }

    // Handle special cases
    if (!userId || userId === 'unknown' || userId === 'Unknown') {
      const result = 'Unknown';
      updateCache(userId, result);
      return result;
    }

    try {
      const client = dependencies.getClient();
      const result = await client.users.info({ user: userId });

      if (result.user) {
        // Prefer display_name, then real_name, then name
        const displayName =
          result.user.profile?.display_name || result.user.real_name || result.user.name || userId;
        updateCache(userId, displayName);
        return displayName;
      }
    } catch (error) {
      logger.debug(`Failed to get user info for ${userId}: ${error}`);
    }

    // Fallback to user ID if lookup fails
    updateCache(userId, userId);
    return userId;
  };

  /**
   * Get display names for multiple user IDs efficiently
   */
  const bulkGetDisplayNames = async (userIds: string[]): Promise<ReadonlyMap<string, string>> => {
    const results = new Map<string, string>();
    const uncachedUserIds: string[] = [];

    // First, collect cached results and identify uncached users
    for (const userId of userIds) {
      if (userCache.has(userId)) {
        results.set(userId, userCache.get(userId)!);
      } else {
        uncachedUserIds.push(userId);
      }
    }

    // Process uncached users
    if (uncachedUserIds.length > 0) {
      const newEntries = await Promise.all(
        uncachedUserIds.map(async (userId) => {
          const displayName = await getDisplayName(userId);
          return [userId, displayName] as const;
        })
      );

      // Add new results to the return map
      for (const [userId, displayName] of newEntries) {
        results.set(userId, displayName);
      }
    }

    return results;
  };

  /**
   * Get full user information for a user ID
   */
  const getUserInfo = async (userId: string): Promise<SlackUser> => {
    try {
      const client = dependencies.getClient();
      const result = await client.users.info({ user: userId });
      
      if (!result.user) {
        throw new Error('User not found');
      }
      
      // Return complete SlackUser object instead of inline type
      return {
        id: result.user.id || '',
        team_id: result.user.team_id || '',
        name: result.user.name || '',
        deleted: result.user.deleted || false,
        color: result.user.color || '',
        real_name: result.user.real_name || '',
        tz: result.user.tz || '',
        tz_label: result.user.tz_label || '',
        tz_offset: result.user.tz_offset || 0,
        profile: result.user.profile as SlackUserProfile,
        is_admin: result.user.is_admin || false,
        is_owner: result.user.is_owner || false,
        is_primary_owner: result.user.is_primary_owner || false,
        is_restricted: result.user.is_restricted || false,
        is_ultra_restricted: result.user.is_ultra_restricted || false,
        is_bot: result.user.is_bot || false,
        is_app_user: result.user.is_app_user || false,
        updated: result.user.updated || 0,
        is_email_confirmed: result.user.is_email_confirmed || false,
        who_can_share_contact_card: result.user.who_can_share_contact_card || '',
      };
    } catch (error) {
      logger.debug(`Failed to get user info for ${userId}: ${error}`);
      throw error;
    }
  };

  /**
   * Clear the user cache
   */
  const clearCache = (): void => {
    userCache = new Map<string, string>();
  };

  return {
    getDisplayName,
    bulkGetDisplayNames,
    getUserInfo,
    clearCache,
  };
};
