/**
 * MCP Compatibility Adapter for File Services
 * 
 * Converts TypeSafeAPI + ts-pattern ServiceResult types back to MCPToolResult
 * for backward compatibility with existing MCP protocol routing.
 * 
 * This adapter maintains the TypeSafeAPI type safety benefits while ensuring
 * seamless integration with the existing SlackService facade.
 */

import { match } from 'ts-pattern';
import type { MCPToolResult } from '../../../mcp/types.js';
import type { FileService, FileServiceMCPCompat, FileServiceDependencies } from './types.js';
import { createFileService } from './file-service.js';
import {
  handleServiceResult,
  type ServiceResult,
  type ServiceOutput,
} from '../../types/typesafe-api-patterns.js';

/**
 * Create MCP-compatible file service adapter
 * Wraps the TypeSafeAPI file service to provide MCPToolResult compatibility
 */
export const createFileServiceMCPAdapter = (deps: FileServiceDependencies): FileServiceMCPCompat => {
  // Get the TypeSafeAPI type-safe file service
  const typeSafeApiService: FileService = createFileService(deps);

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
    async uploadFile(args: unknown): Promise<MCPToolResult> {
      const result = await typeSafeApiService.uploadFile(args);
      return convertToMCPResult(result);
    },

    async listFiles(args: unknown): Promise<MCPToolResult> {
      const result = await typeSafeApiService.listFiles(args);
      return convertToMCPResult(result);
    },

    async getFileInfo(args: unknown): Promise<MCPToolResult> {
      const result = await typeSafeApiService.getFileInfo(args);
      return convertToMCPResult(result);
    },

    async deleteFile(args: unknown): Promise<MCPToolResult> {
      const result = await typeSafeApiService.deleteFile(args);
      return convertToMCPResult(result);
    },

    async shareFile(args: unknown): Promise<MCPToolResult> {
      const result = await typeSafeApiService.shareFile(args);
      return convertToMCPResult(result);
    },

    async analyzeFiles(args: unknown): Promise<MCPToolResult> {
      const result = await typeSafeApiService.analyzeFiles(args);
      return convertToMCPResult(result);
    },

    async searchFiles(args: unknown): Promise<MCPToolResult> {
      const result = await typeSafeApiService.searchFiles(args);
      return convertToMCPResult(result);
    },
  };
};

/**
 * Export both the TypeSafeAPI service and MCP adapter for different use cases
 */
export { createFileService } from './file-service.js';
export type { FileService, FileServiceMCPCompat } from './types.js';