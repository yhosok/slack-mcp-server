/**
 * MCP Compatibility Adapter for Reaction Services
 * 
 * Converts TypeSafeAPI + ts-pattern ServiceResult types back to MCPToolResult
 * for backward compatibility with existing MCP protocol routing.
 * 
 * This adapter maintains the TypeSafeAPI type safety benefits while ensuring
 * seamless integration with the existing SlackService facade.
 */

import type { MCPToolResult } from '../../../mcp/types.js';
import type { ReactionService, ReactionServiceMCPCompat, ReactionServiceDependencies } from './types.js';
import { createReactionServiceTypeSafeAPI } from './reaction-service-typesafe.js';
import { convertToMCPResult } from '../../infrastructure/mcp-adapter-utils.js';

/**
 * Create MCP-compatible reaction service adapter
 * Uses the shared conversion utilities to wrap the TypeSafeAPI reaction service
 */
export const createReactionServiceMCPAdapter = (deps: ReactionServiceDependencies): ReactionServiceMCPCompat => {
  // Get the TypeSafeAPI type-safe reaction service
  const typeSafeApiService: ReactionService = createReactionServiceTypeSafeAPI(deps);

  // Manually wrap each method with the shared converter for type safety
  return {
    async addReaction(args: unknown): Promise<MCPToolResult> {
      const result = await typeSafeApiService.addReaction(args);
      return convertToMCPResult(result);
    },

    async removeReaction(args: unknown): Promise<MCPToolResult> {
      const result = await typeSafeApiService.removeReaction(args);
      return convertToMCPResult(result);
    },

    async getReactions(args: unknown): Promise<MCPToolResult> {
      const result = await typeSafeApiService.getReactions(args);
      return convertToMCPResult(result);
    },

    async getReactionStatistics(args: unknown): Promise<MCPToolResult> {
      const result = await typeSafeApiService.getReactionStatistics(args);
      return convertToMCPResult(result);
    },

    async findMessagesByReactions(args: unknown): Promise<MCPToolResult> {
      const result = await typeSafeApiService.findMessagesByReactions(args);
      return convertToMCPResult(result);
    },
  };
};

/**
 * Export both the TypeSafeAPI service and MCP adapter for different use cases
 */
export { createReactionServiceTypeSafeAPI } from './reaction-service-typesafe.js';
export type { ReactionService, ReactionServiceMCPCompat } from './types.js';