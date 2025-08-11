import type { InfrastructureServices } from '../../infrastructure/factory.js';
import type { MCPToolResult } from '../../../mcp/types.js';

/**
 * Dependencies for reaction service operations
 */
export interface ReactionServiceDependencies extends InfrastructureServices {
  // Additional reaction-specific dependencies can be added here
}

/**
 * Configuration for reaction service operations
 */
export interface ReactionServiceConfig {
  maxReactionsPerMessage?: number;
  allowedReactions?: string[];
}

/**
 * Reaction service interface
 */
export interface ReactionService {
  addReaction(args: unknown): Promise<MCPToolResult>;
  removeReaction(args: unknown): Promise<MCPToolResult>;
  getReactions(args: unknown): Promise<MCPToolResult>;
  getReactionStatistics(args: unknown): Promise<MCPToolResult>;
  findMessagesByReactions(args: unknown): Promise<MCPToolResult>;
}
