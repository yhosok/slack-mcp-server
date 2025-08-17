/**
 * MCP Compatibility Adapter for File Services
 *
 * Converts TypeSafeAPI + ts-pattern ServiceResult types back to MCPToolResult
 * for backward compatibility with existing MCP protocol routing.
 *
 * This adapter maintains the TypeSafeAPI type safety benefits while ensuring
 * seamless integration with the existing SlackService facade.
 */

import type { MCPToolResult } from '../../../mcp/types.js';
import type { FileService, FileServiceMCPCompat, FileServiceDependencies } from './types.js';
import { createFileService } from './file-service.js';
import { convertToMCPResult } from '../../infrastructure/mcp-adapter-utils.js';

/**
 * Create MCP-compatible file service adapter
 * Uses the shared conversion utilities to wrap the TypeSafeAPI file service
 */
export const createFileServiceMCPAdapter = (
  deps: FileServiceDependencies
): FileServiceMCPCompat => {
  // Get the TypeSafeAPI type-safe file service
  const typeSafeApiService: FileService = createFileService(deps);

  // Manually wrap each method with the shared converter for type safety
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
