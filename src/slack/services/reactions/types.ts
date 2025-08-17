import type { InfrastructureServices } from '../../infrastructure/factory.js';
import type { MCPToolResult } from '../../../mcp/types.js';
import type {
  AddReactionResult,
  RemoveReactionResult,
  GetReactionsResult,
  ReactionStatisticsResult,
  FindMessagesByReactionsResult,
} from '../../types/outputs/reactions.js';

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
 */
export type ReactionServiceDependencies = InfrastructureServices;

/**
 * Configuration for reaction service operations
 */
export interface ReactionServiceConfig {
  maxReactionsPerMessage?: number;
  allowedReactions?: string[];
}

/**
 * Reaction service interface with TypeSafeAPI + ts-pattern type safety
 * Following production-ready discriminated union patterns for type-safe service results
 */
export interface ReactionService {
  addReaction(args: unknown): Promise<AddReactionResult>;
  removeReaction(args: unknown): Promise<RemoveReactionResult>;
  getReactions(args: unknown): Promise<GetReactionsResult>;
  getReactionStatistics(args: unknown): Promise<ReactionStatisticsResult>;
  findMessagesByReactions(args: unknown): Promise<FindMessagesByReactionsResult>;
}

/**
 * Legacy interface for backward compatibility with MCP routing
 * Used by SlackService facade for MCP protocol compatibility
 */
export interface ReactionServiceMCPCompat {
  addReaction(args: unknown): Promise<MCPToolResult>;
  removeReaction(args: unknown): Promise<MCPToolResult>;
  getReactions(args: unknown): Promise<MCPToolResult>;
  getReactionStatistics(args: unknown): Promise<MCPToolResult>;
  findMessagesByReactions(args: unknown): Promise<MCPToolResult>;
}
