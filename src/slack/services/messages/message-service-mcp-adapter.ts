/**
 * MCP Compatibility Adapter for Message Services
 * 
 * Converts TypeSafeAPI + ts-pattern ServiceResult types back to MCPToolResult
 * for backward compatibility with existing MCP protocol routing.
 * 
 * This adapter maintains the TypeSafeAPI type safety benefits while ensuring
 * seamless integration with the existing SlackService facade.
 */

import type { MCPToolResult } from '../../../mcp/types.js';
import type { MessageService, MessageServiceMCPCompat, MessageServiceDependencies } from './types.js';
import { createMessageService } from './message-service.js';
import { convertToMCPResult } from '../../infrastructure/mcp-adapter-utils.js';

/**
 * Create MCP-compatible message service adapter
 * Uses the shared conversion utilities to wrap the TypeSafeAPI message service
 */
export const createMessageServiceMCPAdapter = (deps: MessageServiceDependencies): MessageServiceMCPCompat => {
  // Get the TypeSafeAPI type-safe message service
  const typeSafeApiService: MessageService = createMessageService(deps);

  // Manually wrap each method with the shared converter for type safety
  return {
    async sendMessage(args: unknown): Promise<MCPToolResult> {
      const result = await typeSafeApiService.sendMessage(args);
      return convertToMCPResult(result);
    },

    async listChannels(args: unknown): Promise<MCPToolResult> {
      const result = await typeSafeApiService.listChannels(args);
      return convertToMCPResult(result);
    },

    async getChannelHistory(args: unknown): Promise<MCPToolResult> {
      const result = await typeSafeApiService.getChannelHistory(args);
      return convertToMCPResult(result);
    },

    async getUserInfo(args: unknown): Promise<MCPToolResult> {
      const result = await typeSafeApiService.getUserInfo(args);
      return convertToMCPResult(result);
    },

    async searchMessages(args: unknown): Promise<MCPToolResult> {
      const result = await typeSafeApiService.searchMessages(args);
      return convertToMCPResult(result);
    },

    async getChannelInfo(args: unknown): Promise<MCPToolResult> {
      const result = await typeSafeApiService.getChannelInfo(args);
      return convertToMCPResult(result);
    },
  };
};

/**
 * Export both the TypeSafeAPI service and MCP adapter for different use cases
 */
export { createMessageService } from './message-service.js';
export type { MessageService, MessageServiceMCPCompat } from './types.js';