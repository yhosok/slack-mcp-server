/**
 * MCP Compatibility Adapter for Thread Services
 * 
 * Converts Context7 + ts-pattern ServiceResult types back to MCPToolResult
 * for backward compatibility with existing MCP protocol routing.
 * 
 * This adapter maintains the Context7 type safety benefits while ensuring
 * seamless integration with the existing SlackService facade.
 */

import { match } from 'ts-pattern';
import type { MCPToolResult } from '../../../mcp/types.js';
import type { ThreadService, ThreadServiceMCPCompat, ThreadServiceDependencies } from './types.js';
import { createThreadService } from './thread-service.js';
import {
  handleServiceResult,
  type ServiceResult,
  type ServiceOutput,
} from '../../types/context7-patterns.js';

/**
 * Create MCP-compatible thread service adapter
 * Wraps the Context7 thread service to provide MCPToolResult compatibility
 */
export const createThreadServiceMCPAdapter = (deps: ThreadServiceDependencies): ThreadServiceMCPCompat => {
  // Get the Context7 type-safe thread service
  const context7Service: ThreadService = createThreadService(deps);

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
    async findThreadsInChannel(args: unknown): Promise<MCPToolResult> {
      const result = await context7Service.findThreadsInChannel(args);
      return convertToMCPResult(result);
    },

    async getThreadReplies(args: unknown): Promise<MCPToolResult> {
      const result = await context7Service.getThreadReplies(args);
      return convertToMCPResult(result);
    },

    async searchThreads(args: unknown): Promise<MCPToolResult> {
      const result = await context7Service.searchThreads(args);
      return convertToMCPResult(result);
    },

    async analyzeThread(args: unknown): Promise<MCPToolResult> {
      const result = await context7Service.analyzeThread(args);
      return convertToMCPResult(result);
    },

    async summarizeThread(args: unknown): Promise<MCPToolResult> {
      const result = await context7Service.summarizeThread(args);
      return convertToMCPResult(result);
    },

    async extractActionItems(args: unknown): Promise<MCPToolResult> {
      const result = await context7Service.extractActionItems(args);
      return convertToMCPResult(result);
    },

    async postThreadReply(args: unknown): Promise<MCPToolResult> {
      const result = await context7Service.postThreadReply(args);
      return convertToMCPResult(result);
    },

    async createThread(args: unknown): Promise<MCPToolResult> {
      const result = await context7Service.createThread(args);
      return convertToMCPResult(result);
    },

    async markThreadImportant(args: unknown): Promise<MCPToolResult> {
      const result = await context7Service.markThreadImportant(args);
      return convertToMCPResult(result);
    },

    async identifyImportantThreads(args: unknown): Promise<MCPToolResult> {
      const result = await context7Service.identifyImportantThreads(args);
      return convertToMCPResult(result);
    },

    async exportThread(args: unknown): Promise<MCPToolResult> {
      const result = await context7Service.exportThread(args);
      return convertToMCPResult(result);
    },

    async findRelatedThreads(args: unknown): Promise<MCPToolResult> {
      const result = await context7Service.findRelatedThreads(args);
      return convertToMCPResult(result);
    },

    async getThreadMetrics(args: unknown): Promise<MCPToolResult> {
      const result = await context7Service.getThreadMetrics(args);
      return convertToMCPResult(result);
    },

    async getThreadsByParticipants(args: unknown): Promise<MCPToolResult> {
      const result = await context7Service.getThreadsByParticipants(args);
      return convertToMCPResult(result);
    },
  };
};

/**
 * Export both the Context7 service and MCP adapter for different use cases
 */
export { createThreadService } from './thread-service.js';
export type { ThreadService, ThreadServiceMCPCompat } from './types.js';