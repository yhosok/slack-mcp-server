import type { InfrastructureServices } from '../../infrastructure/factory.js';

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
  addReaction(args: unknown): Promise<any>;
  removeReaction(args: unknown): Promise<any>;
  getReactions(args: unknown): Promise<any>;
  getReactionStatistics(args: unknown): Promise<any>;
  findMessagesByReactions(args: unknown): Promise<any>;
}