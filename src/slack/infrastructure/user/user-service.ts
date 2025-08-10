import { logger } from '../../../utils/logger.js';
import type { UserService, UserServiceDependencies } from './types.js';

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
   * Clear the user cache
   */
  const clearCache = (): void => {
    userCache = new Map<string, string>();
  };

  return {
    getDisplayName,
    bulkGetDisplayNames,
    clearCache,
  };
};
