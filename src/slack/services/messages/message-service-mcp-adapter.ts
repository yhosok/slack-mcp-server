/**
 * MCP Compatibility Adapter for Message Services
 * 
 * Converts Context7 + ts-pattern ServiceResult types back to MCPToolResult
 * for backward compatibility with existing MCP protocol routing.
 * 
 * This adapter maintains the Context7 type safety benefits while ensuring
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
} from '../../types/context7-patterns.js';

/**
 * Create MCP-compatible message service adapter
 * Wraps the Context7 message service to provide MCPToolResult compatibility
 */
export const createMessageServiceMCPAdapter = (deps: MessageServiceDependencies): MessageServiceMCPCompat => {
  // Get the Context7 type-safe message service
  const context7Service: MessageService = createMessageService(deps);

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
   * MCP-compatible service methods that maintain Context7 type safety internally
   */
  return {
    async sendMessage(args: unknown): Promise<MCPToolResult> {
      const result = await context7Service.sendMessage(args);
      return convertToMCPResult(result);
    },

    async listChannels(args: unknown): Promise<MCPToolResult> {
      const result = await context7Service.listChannels(args);
      return convertToMCPResult(result);
    },

    async getChannelHistory(args: unknown): Promise<MCPToolResult> {
      const result = await context7Service.getChannelHistory(args);
      return convertToMCPResult(result);
    },

    async getUserInfo(args: unknown): Promise<MCPToolResult> {
      const result = await context7Service.getUserInfo(args);
      return convertToMCPResult(result);
    },

    async searchMessages(args: unknown): Promise<MCPToolResult> {
      const result = await context7Service.searchMessages(args);
      return convertToMCPResult(result);
    },

    async getChannelInfo(args: unknown): Promise<MCPToolResult> {
      const result = await context7Service.getChannelInfo(args);
      return convertToMCPResult(result);
    },
  };
};

/**
 * Export both the Context7 service and MCP adapter for different use cases
 */
export { createMessageService } from './message-service.js';
export type { MessageService, MessageServiceMCPCompat } from './types.js';