/**
 * MCP Compatibility Adapter for Thread Services
 * 
 * Converts TypeSafeAPI + ts-pattern ServiceResult types back to MCPToolResult
 * for backward compatibility with existing MCP protocol routing.
 * 
 * This adapter maintains the TypeSafeAPI type safety benefits while ensuring
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
} from '../../types/typesafe-api-patterns.js';

/**
 * Create MCP-compatible thread service adapter
 * Wraps the TypeSafeAPI thread service to provide MCPToolResult compatibility
 */
export const createThreadServiceMCPAdapter = (deps: ThreadServiceDependencies): ThreadServiceMCPCompat => {
  // Get the TypeSafeAPI type-safe thread service
  const typeSafeApiService: ThreadService = createThreadService(deps);

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
    async findThreadsInChannel(args: unknown): Promise<MCPToolResult> {
      const result = await typeSafeApiService.findThreadsInChannel(args);
      return convertToMCPResult(result);
    },

    async getThreadReplies(args: unknown): Promise<MCPToolResult> {
      const result = await typeSafeApiService.getThreadReplies(args);
      return convertToMCPResult(result);
    },

    async searchThreads(args: unknown): Promise<MCPToolResult> {
      const result = await typeSafeApiService.searchThreads(args);
      return convertToMCPResult(result);
    },

    async analyzeThread(args: unknown): Promise<MCPToolResult> {
      const result = await typeSafeApiService.analyzeThread(args);
      return convertToMCPResult(result);
    },

    async summarizeThread(args: unknown): Promise<MCPToolResult> {
      const result = await typeSafeApiService.summarizeThread(args);
      return convertToMCPResult(result);
    },

    async extractActionItems(args: unknown): Promise<MCPToolResult> {
      const result = await typeSafeApiService.extractActionItems(args);
      return convertToMCPResult(result);
    },

    async postThreadReply(args: unknown): Promise<MCPToolResult> {
      const result = await typeSafeApiService.postThreadReply(args);
      return convertToMCPResult(result);
    },

    async createThread(args: unknown): Promise<MCPToolResult> {
      const result = await typeSafeApiService.createThread(args);
      return convertToMCPResult(result);
    },

    async markThreadImportant(args: unknown): Promise<MCPToolResult> {
      const result = await typeSafeApiService.markThreadImportant(args);
      return convertToMCPResult(result);
    },

    async identifyImportantThreads(args: unknown): Promise<MCPToolResult> {
      const result = await typeSafeApiService.identifyImportantThreads(args);
      return convertToMCPResult(result);
    },

    async exportThread(args: unknown): Promise<MCPToolResult> {
      const result = await typeSafeApiService.exportThread(args);
      return convertToMCPResult(result);
    },

    async findRelatedThreads(args: unknown): Promise<MCPToolResult> {
      const result = await typeSafeApiService.findRelatedThreads(args);
      return convertToMCPResult(result);
    },

    async getThreadMetrics(args: unknown): Promise<MCPToolResult> {
      const result = await typeSafeApiService.getThreadMetrics(args);
      return convertToMCPResult(result);
    },

    async getThreadsByParticipants(args: unknown): Promise<MCPToolResult> {
      const result = await typeSafeApiService.getThreadsByParticipants(args);
      return convertToMCPResult(result);
    },
  };
};

/**
 * Export both the TypeSafeAPI service and MCP adapter for different use cases
 */
export { createThreadService } from './thread-service.js';
export type { ThreadService, ThreadServiceMCPCompat } from './types.js';