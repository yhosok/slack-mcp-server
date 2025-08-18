/**
 * User Service Factory with TypeSafeAPI + ts-pattern MCP transformation
 *
 * Provides getUserInfo that returns UserInfoOutput for MCP compatibility
 * while maintaining SlackUser domain model internally.
 */

import type { WebClient } from '@slack/web-api';
import type { UserInfoResult } from '../../types/outputs/users.js';
import { createUserService } from './user-service.js';
import { transformSlackUserToUserInfoOutput } from './user-transformers.js';
import { validateInput } from '../../../utils/validation.js';
import { GetUserInfoSchema } from '../../../utils/validation.js';
import { createServiceSuccess, createServiceError } from '../../types/typesafe-api-patterns.js';

/**
 * Create user service with MCP compatibility layer
 *
 * Wraps the core user service and provides MCP-compatible getUserInfo
 * that returns UserInfoOutput instead of SlackUser.
 * Infrastructure independence achieved by direct WebClient injection.
 */
export const createUserServiceWithMCPTransformation = (
  client: WebClient
): {
  getUserInfo: (args: unknown) => Promise<UserInfoResult>;
} => {
  const coreUserService = createUserService({
    client,
  });

  const getUserInfo = async (args: unknown): Promise<UserInfoResult> => {
    try {
      // Validate input using TypeSafeAPI validation pattern
      const input = validateInput(GetUserInfoSchema, args);

      // Use core user service to get SlackUser
      const userResult = await coreUserService.getUserInfo({ user: input.user });

      if (!userResult.success) {
        return createServiceError(userResult.error, 'Failed to retrieve user information');
      }

      // Get display name from cache
      const displayName = await coreUserService.getDisplayName(input.user);

      // Transform SlackUser to UserInfoOutput using transformer
      const output = transformSlackUserToUserInfoOutput(userResult.data, displayName);

      return createServiceSuccess(output, 'User information retrieved successfully');
    } catch (error) {
      return createServiceError(
        `Failed to get user info: ${error}`,
        'Unexpected error during user information retrieval'
      );
    }
  };

  return {
    getUserInfo,
  };
};
