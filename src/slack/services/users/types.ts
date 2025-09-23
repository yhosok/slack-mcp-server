/**
 * User service types following TypeSafeAPI + ts-pattern TypeScript best practices
 * Defines service interfaces and result types for user domain operations
 *
 * Enhanced to support both Domain (TypeSafeAPI) and Infrastructure (lightweight) usage patterns
 */

import type { SlackUser } from '../../types/core/users.js';
import type { ServiceResult } from '../../types/typesafe-api-patterns.js';
import type { UserInfoOutput } from '../../types/outputs/users.js';
import type { WebClient } from '@slack/web-api';

/**
 * Consolidated User service interface supporting both Domain and Infrastructure patterns
 *
 * This service combines both TypeSafeAPI-compliant methods for domain operations
 * and lightweight utility methods for infrastructure usage, eliminating duplication
 * while maintaining performance optimizations for different use cases.
 *
 * **Domain Methods** (TypeSafeAPI + ts-pattern):
 * - getUserInfo(args) - Returns ServiceResult<SlackUser> for MCP tool implementation
 *
 * **Infrastructure Methods** (Lightweight utilities):
 * - getDisplayName(userId) - Returns string for direct consumption by infrastructure services
 * - bulkGetDisplayNames(userIds) - Returns Map for efficient bulk operations
 * - getUserInfoDirect(userId) - Returns SlackUser directly for infrastructure needs
 *
 * **Shared Methods**:
 * - clearCache() - Cache management for both patterns
 */
export interface UserService {
  /**
   * Get complete user information as SlackUser domain type (Domain pattern)
   * @param args - Unknown input (validated at runtime)
   * @returns ServiceResult with SlackUser data or error details
   */
  getUserInfo(args: unknown): Promise<UserInfoResult>;

  /**
   * Get complete user information directly (Infrastructure pattern)
   * @param userId - Slack user ID
   * @returns SlackUser object directly (no ServiceResult wrapper)
   */
  getUserInfoDirect(userId: string): Promise<SlackUser>;

  /**
   * Get cached display name for a user ID (Shared pattern)
   * @param userId - Slack user ID
   * @returns Display name string (cached or fetched)
   */
  getDisplayName(userId: string): Promise<string>;

  /**
   * Get display names for multiple users efficiently (Shared pattern)
   * @param userIds - Array of Slack user IDs
   * @returns ReadonlyMap of user ID to display name
   */
  bulkGetDisplayNames(userIds: string[]): Promise<ReadonlyMap<string, string>>;

  /**
   * Clear the user cache (Shared pattern)
   */
  clearCache(): void;
}

/**
 * Dependencies required for consolidated user service creation
 *
 * Supports both Domain (direct client injection) and Infrastructure (getClient function) patterns
 * to enable dual usage while maintaining clean dependency injection.
 */
export interface UserServiceDependencies {
  /**
   * Direct Slack Web API client for user operations (Domain pattern)
   * When provided, takes precedence over getClient function
   */
  client?: WebClient;

  /**
   * Function to get appropriate WebClient for user operations (Infrastructure pattern)
   * Used when direct client injection is not available
   */
  getClient?: () => WebClient;
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
