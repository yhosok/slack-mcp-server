/**
 * User transformation utilities for SlackUser to UserInfoOutput mapping
 * Following TypeSafeAPI + ts-pattern patterns for type-safe data transformations
 */

import type { SlackUser } from '../../types/core/users.js';
import type { UserInfoOutput } from '../../types/outputs/users.js';
import { enforceServiceOutput } from '../../types/typesafe-api-patterns.js';

/**
 * Transform SlackUser domain type to UserInfoOutput for API responses
 *
 * Converts complete SlackUser data to the consumer-facing UserInfoOutput format
 * while preserving all essential user information and profile data.
 *
 * This transformation follows TypeSafeAPI patterns:
 * - Type-safe mapping with compile-time guarantees
 * - Enforced ServiceOutput compliance for API responses
 * - Consistent field mapping with fallback values
 * - Preservation of all admin, bot, and profile information
 *
 * @param slackUser - Complete SlackUser domain object
 * @param displayName - Cached display name (may be different from profile.display_name)
 * @returns UserInfoOutput for API responses and client consumption
 *
 * @example Basic Transformation
 * ```typescript
 * const userResult = await userService.getUserInfo({ user: 'U1234567890' });
 * if (userResult.success) {
 *   const displayName = await userService.getDisplayName('U1234567890');
 *   const output = transformSlackUserToUserInfoOutput(userResult.data, displayName);
 *
 *   // output.isAdmin, output.isBot, output.profile are all properly typed
 *   console.log('Admin status:', output.isAdmin);
 *   console.log('Bot status:', output.isBot);
 *   console.log('Profile images:', output.profile);
 * }
 * ```
 *
 * @example Integration with User Service
 * ```typescript
 * const getUserInfo = async (args: unknown): Promise<UserInfoOutputResult> => {
 *   const userResult = await deps.userService.getUserInfo(args);
 *
 *   if (!userResult.success) {
 *     return createServiceError(userResult.error, 'Failed to retrieve user information');
 *   }
 *
 *   const displayName = await deps.userService.getDisplayName(userResult.data.id);
 *   const output = transformSlackUserToUserInfoOutput(userResult.data, displayName);
 *
 *   return createServiceSuccess(output, 'User information retrieved successfully');
 * };
 * ```
 */
export const transformSlackUserToUserInfoOutput = (
  slackUser: SlackUser,
  displayName: string
): UserInfoOutput => {
  return enforceServiceOutput({
    id: slackUser.id,
    name: slackUser.name,
    displayName,
    realName: slackUser.real_name,
    email: slackUser.profile?.email,
    isBot: slackUser.is_bot,
    isAdmin: slackUser.is_admin,
    isOwner: slackUser.is_owner,
    deleted: slackUser.deleted,
    profile: {
      image24: slackUser.profile?.image_24,
      image32: slackUser.profile?.image_32,
      image48: slackUser.profile?.image_48,
      image72: slackUser.profile?.image_72,
      image192: slackUser.profile?.image_192,
      image512: slackUser.profile?.image_512,
      statusText: slackUser.profile?.status_text,
      statusEmoji: slackUser.profile?.status_emoji,
      title: slackUser.profile?.title,
    },
  });
};

/**
 * Extract admin and bot detection capabilities from SlackUser
 *
 * Utility function for consumer services that need to check user privileges
 * and types. Provides type-safe access to user classification flags.
 *
 * @param slackUser - SlackUser domain object
 * @returns Object with admin and bot detection flags
 *
 * @example Privilege Checking
 * ```typescript
 * const userCapabilities = extractUserCapabilities(slackUser);
 *
 * if (userCapabilities.isAdmin) {
 *   // User has admin privileges
 *   allowAdminOperation();
 * }
 *
 * if (userCapabilities.isBot) {
 *   // Filter out bot messages or apply bot-specific logic
 *   applyBotHandling();
 * }
 * ```
 */
export const extractUserCapabilities = (
  slackUser: SlackUser
): {
  isAdmin: boolean;
  isOwner: boolean;
  isPrimaryOwner: boolean;
  isBot: boolean;
  isAppUser: boolean;
  isRestricted: boolean;
  isUltraRestricted: boolean;
  deleted: boolean;
} => {
  return {
    isAdmin: slackUser.is_admin,
    isOwner: slackUser.is_owner,
    isPrimaryOwner: slackUser.is_primary_owner,
    isBot: slackUser.is_bot,
    isAppUser: slackUser.is_app_user,
    isRestricted: slackUser.is_restricted,
    isUltraRestricted: slackUser.is_ultra_restricted,
    deleted: slackUser.deleted,
  };
};

/**
 * Extract complete user profile information for detailed views
 *
 * Utility function that provides access to all user profile data
 * in a structured format for profile display and user information views.
 *
 * @param slackUser - SlackUser domain object
 * @returns Complete profile information object
 *
 * @example Profile Display
 * ```typescript
 * const profile = extractUserProfile(slackUser);
 *
 * const profileView = {
 *   displayName: profile.displayName,
 *   realName: profile.realName,
 *   email: profile.email,
 *   avatarUrl: profile.images.image192, // High-quality avatar
 *   status: `${profile.statusEmoji} ${profile.statusText}`,
 *   timezone: profile.timezone,
 * };
 * ```
 */
export const extractUserProfile = (
  slackUser: SlackUser
): {
  displayName: string;
  realName: string;
  email?: string;
  statusText?: string;
  statusEmoji?: string;
  title?: string;
  timezone: {
    tz?: string;
    label?: string;
    offset?: number;
  };
  images: {
    image24?: string;
    image32?: string;
    image48?: string;
    image72?: string;
    image192?: string;
    image512?: string;
    imageOriginal?: string;
  };
  normalized: {
    realName?: string;
    displayName?: string;
  };
} => {
  return {
    displayName: slackUser.profile?.display_name || slackUser.real_name || slackUser.name,
    realName: slackUser.real_name,
    email: slackUser.profile?.email,
    statusText: slackUser.profile?.status_text,
    statusEmoji: slackUser.profile?.status_emoji,
    title: slackUser.profile?.title,
    timezone: {
      tz: slackUser.tz,
      label: slackUser.tz_label,
      offset: slackUser.tz_offset,
    },
    images: {
      image24: slackUser.profile?.image_24,
      image32: slackUser.profile?.image_32,
      image48: slackUser.profile?.image_48,
      image72: slackUser.profile?.image_72,
      image192: slackUser.profile?.image_192,
      image512: slackUser.profile?.image_512,
      imageOriginal: slackUser.profile?.image_original,
    },
    normalized: {
      realName: slackUser.profile?.real_name_normalized,
      displayName: slackUser.profile?.display_name_normalized,
    },
  };
};
