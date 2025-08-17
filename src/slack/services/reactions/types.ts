import type { InfrastructureServices } from '../../infrastructure/factory.js';
import type { MCPToolResult } from '../../../mcp/types.js';
import type {
  AddReactionResult,
  RemoveReactionResult,
  GetReactionsResult,
  ReactionStatisticsResult,
  FindMessagesByReactionsResult,
} from '../../types/outputs/reactions.js';
import type { UserService as DomainUserService } from '../users/types.js';
import type { UserService as InfraUserService } from '../../infrastructure/user/types.js';

// Re-export for convenience
export type {
  AddReactionResult,
  RemoveReactionResult,
  GetReactionsResult,
  ReactionStatisticsResult,
  FindMessagesByReactionsResult,
};

/**
 * Dependencies for reaction service operations
 * Enhanced with both Infrastructure and Domain user services for efficient operations
 */
export interface ReactionServiceDependencies extends InfrastructureServices {
  /**
   * Infrastructure user service - lightweight display name operations
   * Use for: Quick display name resolution, bulk operations, caching
   */
  infrastructureUserService: InfraUserService;

  /**
   * Domain user service - complete TypeSafeAPI-compliant user operations
   * Use for: Full user information when detailed data is required
   */
  domainUserService: DomainUserService;
}

/**
 * Configuration for reaction service operations
 *
 * Optional configuration parameters for customizing reaction service behavior.
 * Allows setting limits and restrictions on reaction operations for compliance
 * and performance optimization.
 *
 * @example Basic Configuration
 * ```typescript
 * const config: ReactionServiceConfig = {
 *   maxReactionsPerMessage: 20,
 *   allowedReactions: ['thumbsup', 'heart', 'fire', 'star']
 * };
 * ```
 *
 * @implements TypeSafeAPI configuration pattern
 */
export interface ReactionServiceConfig {
  maxReactionsPerMessage?: number;
  allowedReactions?: string[];
}

/**
 * Reaction service interface with TypeSafeAPI + ts-pattern type safety
 *
 * Primary service interface for emoji reaction operations with comprehensive
 * type safety using discriminated unions and ts-pattern exhaustive matching.
 * All methods return ServiceResult types for consistent error handling.
 *
 * Features:
 * - Type-safe input validation with Zod schemas
 * - Discriminated union return types for exhaustive pattern matching
 * - Comprehensive reaction analytics and statistics
 * - Message filtering by reaction patterns
 * - Integration with Slack Web API reaction endpoints
 *
 * @example Service Usage
 * ```typescript
 * const service: ReactionService = createReactionServiceTypeSafeAPI(deps);
 *
 * // Type-safe operation with pattern matching
 * const result = await service.addReaction({
 *   channel: 'C1234567890',
 *   message_ts: '1234567890.123456',
 *   reaction_name: 'thumbsup'
 * });
 *
 * match(result)
 *   .with({ success: true }, (success) => console.log('Added:', success.data))
 *   .with({ success: false }, (error) => console.error('Failed:', error.error))
 *   .exhaustive();
 * ```
 *
 * @implements TypeSafeAPI ServiceOutput constraints
 * @implements ts-pattern discriminated unions
 * @implements Production-ready API response structure
 */
export interface ReactionService {
  /**
   * Add emoji reaction to a Slack message
   *
   * @param args - Reaction parameters (channel, message_ts, reaction_name)
   * @returns Promise<AddReactionResult> - Success/error discriminated union
   *
   * @implements TypeSafeAPI ServiceResult pattern
   */
  addReaction(args: unknown): Promise<AddReactionResult>;

  /**
   * Remove emoji reaction from a Slack message
   *
   * @param args - Reaction parameters (channel, message_ts, reaction_name)
   * @returns Promise<RemoveReactionResult> - Success/error discriminated union
   *
   * @implements TypeSafeAPI ServiceResult pattern
   */
  removeReaction(args: unknown): Promise<RemoveReactionResult>;

  /**
   * Get comprehensive reaction data for a specific message
   *
   * @param args - Query parameters (channel, message_ts, full)
   * @returns Promise<GetReactionsResult> - Reaction details with user info
   *
   * @implements TypeSafeAPI ServiceResult pattern
   */
  getReactions(args: unknown): Promise<GetReactionsResult>;

  /**
   * Generate statistical analysis of reaction patterns
   *
   * @param args - Analytics parameters (channel, days_back, include_trends)
   * @returns Promise<ReactionStatisticsResult> - Statistical insights
   *
   * @implements TypeSafeAPI ServiceResult pattern
   */
  getReactionStatistics(args: unknown): Promise<ReactionStatisticsResult>;

  /**
   * Find messages matching specific reaction criteria
   *
   * @param args - Search parameters (reactions, match_type, min_reaction_count)
   * @returns Promise<FindMessagesByReactionsResult> - Filtered message list
   *
   * @implements TypeSafeAPI ServiceResult pattern
   */
  findMessagesByReactions(args: unknown): Promise<FindMessagesByReactionsResult>;
}

/**
 * Legacy interface for backward compatibility with MCP routing
 *
 * MCP-compatible interface that wraps TypeSafeAPI service results in
 * legacy MCPToolResult format. Used by SlackService facade to maintain
 * backward compatibility with existing MCP protocol routing while
 * leveraging TypeSafeAPI type safety internally.
 *
 * This interface serves as an adapter layer that:
 * - Converts ServiceResult types to MCPToolResult format
 * - Maintains API compatibility with existing MCP clients
 * - Preserves type safety through internal TypeSafeAPI usage
 * - Enables gradual migration to TypeSafeAPI patterns
 *
 * @example MCP Adapter Usage
 * ```typescript
 * const mcpService: ReactionServiceMCPCompat = createReactionServiceMCPAdapter(deps);
 *
 * // Returns MCPToolResult for MCP protocol compatibility
 * const mcpResult: MCPToolResult = await mcpService.addReaction(args);
 *
 * // Internal conversion from TypeSafeAPI ServiceResult to MCPToolResult
 * console.log(mcpResult.content); // Contains formatted response
 * ```
 *
 * @implements MCP protocol compatibility
 * @implements TypeSafeAPI-to-MCP adapter pattern
 * @deprecated Use ReactionService interface for new implementations
 */
export interface ReactionServiceMCPCompat {
  /**
   * Add emoji reaction to message (MCP-compatible)
   *
   * @param args - Reaction parameters
   * @returns Promise<MCPToolResult> - MCP protocol response
   *
   * @implements MCP protocol compatibility
   */
  addReaction(args: unknown): Promise<MCPToolResult>;

  /**
   * Remove emoji reaction from message (MCP-compatible)
   *
   * @param args - Reaction parameters
   * @returns Promise<MCPToolResult> - MCP protocol response
   *
   * @implements MCP protocol compatibility
   */
  removeReaction(args: unknown): Promise<MCPToolResult>;

  /**
   * Get message reaction data (MCP-compatible)
   *
   * @param args - Query parameters
   * @returns Promise<MCPToolResult> - MCP protocol response
   *
   * @implements MCP protocol compatibility
   */
  getReactions(args: unknown): Promise<MCPToolResult>;

  /**
   * Get reaction statistics (MCP-compatible)
   *
   * @param args - Analytics parameters
   * @returns Promise<MCPToolResult> - MCP protocol response
   *
   * @implements MCP protocol compatibility
   */
  getReactionStatistics(args: unknown): Promise<MCPToolResult>;

  /**
   * Find messages by reactions (MCP-compatible)
   *
   * @param args - Search parameters
   * @returns Promise<MCPToolResult> - MCP protocol response
   *
   * @implements MCP protocol compatibility
   */
  findMessagesByReactions(args: unknown): Promise<MCPToolResult>;
}
