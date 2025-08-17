/**
 * MCP Protocol Adapter for Reaction Services
 *
 * Advanced adapter pattern that bridges TypeSafeAPI + ts-pattern ServiceResult types
 * with MCPToolResult format as required by the Model Context Protocol specification,
 * preserving type safety benefits while ensuring MCP protocol compliance.
 *
 * Architecture Features:
 * - Maintains TypeSafeAPI type safety internally
 * - Converts discriminated union results to MCP protocol format
 * - Preserves comprehensive error handling patterns
 * - Enables clean separation between internal and protocol types
 * - Supports both internal TypeSafeAPI and external MCP protocol usage
 *
 * This adapter serves as a protocol bridge that:
 * 1. Uses TypeSafeAPI service internally for type safety
 * 2. Converts ServiceResult discriminated unions to required MCPToolResult
 * 3. Maintains API contract compatibility with MCP protocol specification
 * 4. Provides clean abstraction between internal architecture and protocol requirements
 *
 * @implements MCP protocol compatibility
 * @implements TypeSafeAPI-to-MCP adapter pattern
 * @implements Production-ready MCP protocol compliance
 */

import type { MCPToolResult } from '../../../mcp/types.js';
import type {
  ReactionService,
  ReactionServiceMCPCompat,
  ReactionServiceDependencies,
} from './types.js';
import { createReactionServiceTypeSafeAPI } from './reaction-service.js';
import { convertToMCPResult } from '../../infrastructure/mcp-adapter-utils.js';

/**
 * Create MCP-compatible reaction service adapter with TypeSafeAPI bridge pattern
 *
 * Factory function that creates a fully MCP-compatible service while leveraging
 * TypeSafeAPI type safety internally. Uses shared conversion utilities to transform
 * discriminated union ServiceResult types into MCPToolResult format.
 *
 * Implementation Strategy:
 * - Creates TypeSafeAPI service instance for type-safe operations
 * - Wraps each method with conversion utilities
 * - Maintains identical API surface for backward compatibility
 * - Preserves all error handling and validation benefits
 *
 * @param deps - Infrastructure dependencies for service creation
 * @returns MCP-compatible service with TypeSafeAPI benefits
 *
 * @example Basic Usage
 * ```typescript
 * const mcpReactionService = createReactionServiceMCPAdapter({
 *   clientManager,
 *   rateLimitTracker,
 *   requestHandler,
 *   userService
 * });
 *
 * // MCP-compatible interface
 * const result: MCPToolResult = await mcpReactionService.addReaction({
 *   channel: 'C1234567890',
 *   message_ts: '1234567890.123456',
 *   reaction_name: 'thumbsup'
 * });
 *
 * console.log(result.content); // Formatted MCP response
 * ```
 *
 * @example Usage Strategy
 * ```typescript
 * // MCP Protocol usage (required for MCP servers)
 * const mcpService = createReactionServiceMCPAdapter(deps);
 * const mcpResult = await mcpService.addReaction(args);
 *
 * // Internal TypeSafeAPI usage (for enhanced type safety)
 * const typeSafeService = createReactionServiceTypeSafeAPI(deps);
 * const typeSafeResult = await typeSafeService.addReaction(args);
 *
 * match(typeSafeResult)
 *   .with({ success: true }, (data) => handleSuccess(data))
 *   .with({ success: false }, (error) => handleError(error))
 *   .exhaustive();
 * ```
 *
 * @implements MCP protocol compatibility
 * @implements TypeSafeAPI dependency injection
 * @implements Production-ready adapter pattern
 */
export const createReactionServiceMCPAdapter = (
  deps: ReactionServiceDependencies
): ReactionServiceMCPCompat => {
  // Get the TypeSafeAPI type-safe reaction service
  const typeSafeApiService: ReactionService = createReactionServiceTypeSafeAPI(deps);

  // Manually wrap each method with the shared converter for type safety
  return {
    /**
     * Add emoji reaction to Slack message with MCP compatibility
     *
     * Internally uses TypeSafeAPI service for type safety, then converts
     * the discriminated union result to MCP format for protocol compatibility.
     *
     * @param args - Unknown input (validated by TypeSafeAPI service)
     * @returns Promise<MCPToolResult> - MCP-formatted response
     *
     * @implements MCP protocol compatibility
     * @implements TypeSafeAPI-to-MCP conversion pattern
     */
    async addReaction(args: unknown): Promise<MCPToolResult> {
      const result = await typeSafeApiService.addReaction(args);
      return convertToMCPResult(result);
    },

    /**
     * Remove emoji reaction from Slack message with MCP compatibility
     *
     * Internally uses TypeSafeAPI service for type safety, then converts
     * the discriminated union result to MCP format for protocol compatibility.
     *
     * @param args - Unknown input (validated by TypeSafeAPI service)
     * @returns Promise<MCPToolResult> - MCP-formatted response
     *
     * @implements MCP protocol compatibility
     * @implements TypeSafeAPI-to-MCP conversion pattern
     */
    async removeReaction(args: unknown): Promise<MCPToolResult> {
      const result = await typeSafeApiService.removeReaction(args);
      return convertToMCPResult(result);
    },

    /**
     * Get comprehensive reaction data for message with MCP compatibility
     *
     * Internally uses TypeSafeAPI service for type safety, then converts
     * the discriminated union result to MCP format for protocol compatibility.
     *
     * @param args - Unknown input (validated by TypeSafeAPI service)
     * @returns Promise<MCPToolResult> - MCP-formatted response with reaction details
     *
     * @implements MCP protocol compatibility
     * @implements TypeSafeAPI-to-MCP conversion pattern
     */
    async getReactions(args: unknown): Promise<MCPToolResult> {
      const result = await typeSafeApiService.getReactions(args);
      return convertToMCPResult(result);
    },

    /**
     * Generate reaction statistics and trends with MCP compatibility
     *
     * Internally uses TypeSafeAPI service for type safety, then converts
     * the discriminated union result to MCP format for protocol compatibility.
     *
     * @param args - Unknown input (validated by TypeSafeAPI service)
     * @returns Promise<MCPToolResult> - MCP-formatted response with statistical analysis
     *
     * @implements MCP protocol compatibility
     * @implements TypeSafeAPI-to-MCP conversion pattern
     */
    async getReactionStatistics(args: unknown): Promise<MCPToolResult> {
      const result = await typeSafeApiService.getReactionStatistics(args);
      return convertToMCPResult(result);
    },

    /**
     * Find messages matching reaction patterns with MCP compatibility
     *
     * Internally uses TypeSafeAPI service for type safety, then converts
     * the discriminated union result to MCP format for protocol compatibility.
     *
     * @param args - Unknown input (validated by TypeSafeAPI service)
     * @returns Promise<MCPToolResult> - MCP-formatted response with filtered messages
     *
     * @implements MCP protocol compatibility
     * @implements TypeSafeAPI-to-MCP conversion pattern
     */
    async findMessagesByReactions(args: unknown): Promise<MCPToolResult> {
      const result = await typeSafeApiService.findMessagesByReactions(args);
      return convertToMCPResult(result);
    },
  };
};

/**
 * Export both the TypeSafeAPI service and MCP adapter for different use cases
 *
 * Provides flexibility for different implementation strategies:
 * - Use createReactionServiceTypeSafeAPI for new TypeSafeAPI + ts-pattern code
 * - Use createReactionServiceMCPAdapter for MCP protocol compatibility
 * - Import types for both modern and legacy service interfaces
 *
 * @example TypeSafeAPI Usage
 * ```typescript
 * import { createReactionServiceTypeSafeAPI, ReactionService } from './reaction-service-mcp-adapter.js';
 *
 * const service: ReactionService = createReactionServiceTypeSafeAPI(deps);
 * const result = await service.addReaction(args);
 * ```
 *
 * @example MCP Compatibility Usage
 * ```typescript
 * import { createReactionServiceMCPAdapter, ReactionServiceMCPCompat } from './reaction-service-mcp-adapter.js';
 *
 * const mcpService: ReactionServiceMCPCompat = createReactionServiceMCPAdapter(deps);
 * const mcpResult = await mcpService.addReaction(args);
 * ```
 */
export { createReactionServiceTypeSafeAPI } from './reaction-service.js';
export type { ReactionService, ReactionServiceMCPCompat } from './types.js';
