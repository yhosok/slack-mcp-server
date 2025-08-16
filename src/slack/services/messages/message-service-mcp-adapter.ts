/**
 * MCP Compatibility Adapter for Message Services
 * 
 * Converts TypeSafeAPI + ts-pattern ServiceResult types back to MCPToolResult
 * for backward compatibility with existing MCP protocol routing.
 * 
 * This adapter maintains the TypeSafeAPI type safety benefits while ensuring
 * seamless integration with the existing SlackService facade.
 */

import { match } from 'ts-pattern';
import type { MCPToolResult } from '../../../mcp/types.js';
import type { MessageService, MessageServiceMCPCompat, MessageServiceDependencies } from './types.js';
import { createMessageService } from './message-service.js';
import {
  handleServiceResult,
  type ServiceResult,
  type ServiceOutput,
} from '../../types/typesafe-api-patterns.js';

/**
 * Create MCP-compatible message service adapter
 * Wraps the TypeSafeAPI message service to provide MCPToolResult compatibility
 */
export const createMessageServiceMCPAdapter = (deps: MessageServiceDependencies): MessageServiceMCPCompat => {
  // Get the TypeSafeAPI type-safe message service
  const typeSafeApiService: MessageService = createMessageService(deps);

  /**
   * Convert ServiceResult to MCPToolResult with production-ready response structure
   */
  const convertToMCPResult = <T extends ServiceOutput>(result: ServiceResult<T>): MCPToolResult => {
    const apiResponse = handleServiceResult(result);
    
    return match(result)
      .with({ success: true }, (_successResult) => ({
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify({
              statusCode: apiResponse.statusCode,
              message: apiResponse.message,
              data: apiResponse.data,
            }, null, 2),
          },
        ],
      }))
      .with({ success: false }, (_errorResult) => ({
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify({
              statusCode: apiResponse.statusCode,
              message: apiResponse.message,
              error: apiResponse.error,
            }, null, 2),
          },
        ],
        isError: true,
      }))
      .exhaustive(); // Type-safe exhaustive matching
  };

  /**
   * MCP-compatible service methods that maintain TypeSafeAPI type safety internally
   */
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