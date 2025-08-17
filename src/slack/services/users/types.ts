/**
 * User service types following TypeSafeAPI + ts-pattern TypeScript best practices
 * Defines service interfaces and result types for user domain operations
 */

import type { SlackUser } from '../../types/core/users.js';
import type { ServiceResult } from '../../types/typesafe-api-patterns.js';
import type { UserInfoOutput } from '../../types/outputs/users.js';
import type { SlackClientManager } from '../../infrastructure/client/types.js';

/**
 * User service interface defining all user-related operations
 * 
 * Provides TypeSafeAPI-compliant methods for user information retrieval,
 * display name caching, and user data management.
 */
export interface UserService {
  /**
   * Get complete user information as SlackUser domain type
   * @param args - Unknown input (validated at runtime)
   * @returns ServiceResult with SlackUser data or error details
   */
  getUserInfo(args: unknown): Promise<UserInfoResult>;

  /**
   * Get cached display name for a user ID
   * @param userId - Slack user ID
   * @returns Display name string (cached or fetched)
   */
  getDisplayName(userId: string): Promise<string>;

  /**
   * Get display names for multiple users efficiently
   * @param userIds - Array of Slack user IDs
   * @returns ReadonlyMap of user ID to display name
   */
  bulkGetDisplayNames(userIds: string[]): Promise<ReadonlyMap<string, string>>;

  /**
   * Clear the user cache
   */
  clearCache(): void;
}

/**
 * Dependencies required for user service creation
 * 
 * Infrastructure dependencies following dependency injection patterns
 * for TypeSafeAPI compliance and testability.
 */
export interface UserServiceDependencies {
  /**
   * Client manager for Slack Web API operations
   */
  clientManager: SlackClientManager;
}

/**
 * TypeSafeAPI + ts-pattern discriminated union types for user service results
 */
export type UserInfoResult = ServiceResult<SlackUser>;

/**
 * User info output result for message service integration
 * Transforms SlackUser to UserInfoOutput for API responses
 */
export type UserInfoOutputResult = ServiceResult<UserInfoOutput>;