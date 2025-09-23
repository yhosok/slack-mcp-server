/**
 * Consolidated User service implementation supporting both Domain and Infrastructure patterns
 *
 * This implementation eliminates duplication by providing both TypeSafeAPI (domain)
 * and lightweight utility (infrastructure) methods in a single service while maintaining
 * performance optimizations for different usage patterns.
 *
 * **Enhanced Features:**
 * - Type-safe operations with discriminated union results (domain pattern)
 * - Direct utility methods for infrastructure consumption (infrastructure pattern)
 * - Automatic input validation using Zod schemas
 * - Consistent error handling with ServiceResult patterns
 * - Dual dependency injection support (direct client or getClient function)
 * - Efficient caching for display names and user information
 * - Complete SlackUser domain type mapping
 * - Performance-optimized dual cache strategy
 */

import { GetUserInfoSchema, validateInput } from '../../../utils/validation.js';
import type { UserService, UserServiceDependencies, UserInfoResult } from './types.js';
import type { SlackUser, SlackUserProfile } from '../../types/core/users.js';
import {
  createServiceSuccess,
  createServiceError,
  enforceServiceOutput,
} from '../../types/typesafe-api-patterns.js';
import { logger } from '../../../utils/logger.js';

/**
 * Create consolidated user service supporting both Domain and Infrastructure patterns
 *
 * Factory function that creates a dual-interface user service eliminating the need
 * for separate infrastructure and domain user services while maintaining performance
 * and type safety for both usage patterns.
 *
 * @param deps - Dual dependencies (client or getClient function)
 * @returns Consolidated user service with both Domain and Infrastructure interfaces
 *
 * @example Domain Usage (TypeSafeAPI + ts-pattern)
 * ```typescript
 * const userService = createUserService({
 *   client: webClient
 * });
 *
 * const result = await userService.getUserInfo({ user: 'U1234567890' });
 * match(result)
 *   .with({ success: true }, (success) => console.log('User:', success.data))
 *   .with({ success: false }, (error) => console.error('Failed:', error.error))
 *   .exhaustive();
 * ```
 *
 * @example Infrastructure Usage (Direct utilities)
 * ```typescript
 * const userService = createUserService({
 *   getClient: () => clientManager.getClientForOperation('read')
 * });
 *
 * const displayName = await userService.getDisplayName('U1234567890');
 * const user = await userService.getUserInfoDirect('U1234567890');
 * ```
 */
export const createUserService = (deps: UserServiceDependencies): UserService => {
  // Validate dependencies - ensure at least one client access method is provided
  if (!deps.client && !deps.getClient) {
    throw new Error('UserService requires either client or getClient dependency');
  }

  /**
   * Get appropriate client for operations (supports both dependency injection patterns)
   */
  const getClient = (): import('@slack/web-api').WebClient => {
    if (deps.client) {
      return deps.client;
    }
    if (deps.getClient) {
      return deps.getClient();
    }
    throw new Error('No client available - invalid UserService configuration');
  };

  // Immutable cache state management for display names
  let userDisplayNameCache = new Map<string, string>();

  // Immutable cache state management for full user information
  let userInfoCache = new Map<string, SlackUser>();

  /**
   * Update display name cache with new user information (immutable)
   * Performance optimization: Only create new Map if value differs
   */
  const updateDisplayNameCache = (userId: string, displayName: string): void => {
    if (userDisplayNameCache.get(userId) !== displayName) {
      userDisplayNameCache = new Map(userDisplayNameCache).set(userId, displayName);
    }
  };

  /**
   * Update user info cache with complete SlackUser data (immutable)
   * Performance optimization: Only create new Map if not already cached
   */
  const updateUserInfoCache = (userId: string, user: SlackUser): void => {
    if (!userInfoCache.has(userId)) {
      userInfoCache = new Map(userInfoCache).set(userId, user);
    }
  };

  /**
   * Get user information with TypeSafeAPI + ts-pattern type safety
   *
   * Retrieves complete user information from Slack API and maps to SlackUser domain type.
   * Uses read token strategy and includes comprehensive error handling.
   *
   * @param args - Unknown input (validated at runtime using GetUserInfoSchema)
   * @returns ServiceResult with SlackUser data or error details
   *
   * @example Basic Usage
   * ```typescript
   * const result = await getUserInfo({ user: 'U1234567890' });
   *
   * if (result.success) {
   *   console.log('User admin status:', result.data.is_admin);
   *   console.log('User bot status:', result.data.is_bot);
   *   console.log('User profile:', result.data.profile);
   * }
   * ```
   */
  const getUserInfo = async (args: unknown): Promise<UserInfoResult> => {
    try {
      // Validate input using TypeSafeAPI validation pattern
      const input = validateInput(GetUserInfoSchema, args);

      // Check cache first
      if (userInfoCache.has(input.user)) {
        const cachedUser = userInfoCache.get(input.user)!;
        return createServiceSuccess(cachedUser, 'User information retrieved from cache');
      }

      const client = getClient();
      const result = await client.users.info({ user: input.user });

      if (!result.user) {
        return createServiceError('User not found', 'Requested user does not exist');
      }

      // Enhanced validation: Ensure essential fields exist
      if (!result.user.id) {
        return createServiceError('Invalid user data', 'User data missing required ID field');
      }

      // Map Slack API response to SlackUser domain type with enhanced type safety
      const slackUser: SlackUser = enforceServiceOutput({
        id: result.user.id || '',
        team_id: result.user.team_id || '',
        name: result.user.name || '',
        deleted: result.user.deleted || false,
        color: result.user.color || '',
        real_name: result.user.real_name || '',
        tz: result.user.tz || '',
        tz_label: result.user.tz_label || '',
        tz_offset: result.user.tz_offset || 0,
        profile: {
          avatar_hash: result.user.profile?.avatar_hash || '',
          status_text: result.user.profile?.status_text || '',
          status_emoji: result.user.profile?.status_emoji || '',
          real_name: result.user.profile?.real_name || '',
          display_name: result.user.profile?.display_name || '',
          real_name_normalized: result.user.profile?.real_name_normalized || '',
          display_name_normalized: result.user.profile?.display_name_normalized || '',
          email: result.user.profile?.email,
          image_original: result.user.profile?.image_original,
          image_24: result.user.profile?.image_24 || '',
          image_32: result.user.profile?.image_32 || '',
          image_48: result.user.profile?.image_48 || '',
          image_72: result.user.profile?.image_72 || '',
          image_192: result.user.profile?.image_192 || '',
          image_512: result.user.profile?.image_512 || '',
          team: result.user.profile?.team || '',
        } as SlackUserProfile,
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
      });

      // Cache the complete user information
      updateUserInfoCache(input.user, slackUser);

      // Also cache the display name for efficiency
      const displayName =
        slackUser.profile.display_name || slackUser.real_name || slackUser.name || input.user;
      updateDisplayNameCache(input.user, displayName);

      return createServiceSuccess(slackUser, 'User information retrieved successfully');
    } catch (error) {
      logger.error(`Failed to get user info:`, error);
      return createServiceError(`Failed to get user: ${error}`, 'User retrieval failed');
    }
  };

  /**
   * Get complete user information directly (Infrastructure pattern)
   *
   * Retrieves complete user information without ServiceResult wrapper.
   * Optimized for infrastructure consumption where direct SlackUser access is needed.
   *
   * @param userId - Slack user ID
   * @returns SlackUser object directly (throws on error)
   *
   * @example Infrastructure Usage
   * ```typescript
   * try {
   *   const user = await getUserInfoDirect('U1234567890');
   *   console.log('User admin status:', user.is_admin);
   * } catch (error) {
   *   console.error('Failed to get user:', error);
   * }
   * ```
   */
  const getUserInfoDirect = async (userId: string): Promise<SlackUser> => {
    // Check cache first
    if (userInfoCache.has(userId)) {
      return userInfoCache.get(userId)!;
    }

    const client = getClient();
    const result = await client.users.info({ user: userId });

    if (!result.user) {
      throw new Error('User not found');
    }

    // Enhanced validation: Ensure essential fields exist
    if (!result.user.id) {
      throw new Error('Invalid user data - missing required ID field');
    }

    // Map Slack API response to SlackUser domain type with enhanced type safety
    const slackUser: SlackUser = {
      id: result.user.id || '',
      team_id: result.user.team_id || '',
      name: result.user.name || '',
      deleted: result.user.deleted || false,
      color: result.user.color || '',
      real_name: result.user.real_name || '',
      tz: result.user.tz || '',
      tz_label: result.user.tz_label || '',
      tz_offset: result.user.tz_offset || 0,
      profile: {
        avatar_hash: result.user.profile?.avatar_hash || '',
        status_text: result.user.profile?.status_text || '',
        status_emoji: result.user.profile?.status_emoji || '',
        real_name: result.user.profile?.real_name || '',
        display_name: result.user.profile?.display_name || '',
        real_name_normalized: result.user.profile?.real_name_normalized || '',
        display_name_normalized: result.user.profile?.display_name_normalized || '',
        email: result.user.profile?.email,
        image_original: result.user.profile?.image_original,
        image_24: result.user.profile?.image_24 || '',
        image_32: result.user.profile?.image_32 || '',
        image_48: result.user.profile?.image_48 || '',
        image_72: result.user.profile?.image_72 || '',
        image_192: result.user.profile?.image_192 || '',
        image_512: result.user.profile?.image_512 || '',
        team: result.user.profile?.team || '',
      } as SlackUserProfile,
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

    // Cache the complete user information
    updateUserInfoCache(userId, slackUser);

    // Also cache the display name for efficiency
    const displayName =
      slackUser.profile.display_name || slackUser.real_name || slackUser.name || userId;
    updateDisplayNameCache(userId, displayName);

    return slackUser;
  };

  /**
   * Get display name for a user ID with caching
   */
  const getDisplayName = async (userId: string): Promise<string> => {
    // Return cached name if available
    if (userDisplayNameCache.has(userId)) {
      return userDisplayNameCache.get(userId)!;
    }

    // Handle special cases
    if (!userId || userId === 'unknown' || userId === 'Unknown') {
      const result = 'Unknown';
      updateDisplayNameCache(userId, result);
      return result;
    }

    try {
      // Try to get from user info cache first
      if (userInfoCache.has(userId)) {
        const cachedUser = userInfoCache.get(userId)!;
        const displayName =
          cachedUser.profile.display_name || cachedUser.real_name || cachedUser.name || userId;
        updateDisplayNameCache(userId, displayName);
        return displayName;
      }

      // Fetch from API if not cached
      const client = getClient();
      const result = await client.users.info({ user: userId });

      if (result.user) {
        // Prefer display_name, then real_name, then name
        const displayName =
          result.user.profile?.display_name || result.user.real_name || result.user.name || userId;
        updateDisplayNameCache(userId, displayName);
        return displayName;
      }
    } catch (error) {
      logger.debug(`Failed to get user info for ${userId}: ${error}`);
    }

    // Fallback to user ID if lookup fails
    updateDisplayNameCache(userId, userId);
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
      if (userDisplayNameCache.has(userId)) {
        results.set(userId, userDisplayNameCache.get(userId)!);
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
   * Clear all user caches
   */
  const clearCache = (): void => {
    userDisplayNameCache = new Map<string, string>();
    userInfoCache = new Map<string, SlackUser>();
  };

  return {
    getUserInfo,
    getUserInfoDirect,
    getDisplayName,
    bulkGetDisplayNames,
    clearCache,
  };
};
