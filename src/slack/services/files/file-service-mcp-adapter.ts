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
    /**
     * Upload a file to Slack channels or threads
     * @param args - Upload file arguments (file_path, channels, etc.)
     * @returns MCP-compatible result with upload details
     */
    async uploadFile(args: unknown): Promise<MCPToolResult> {
      const result = await typeSafeApiService.uploadFile(args);
      return convertToMCPResult(result);
    },

    /**
     * List files in workspace with filtering options
     * @param args - List files arguments (channel, user, types, pagination, etc.)
     * @returns MCP-compatible result with file listings and pagination
     */
    async listFiles(args: unknown): Promise<MCPToolResult> {
      const result = await typeSafeApiService.listFiles(args);
      return convertToMCPResult(result);
    },

    /**
     * Get detailed information about a specific file
     * @param args - File info arguments (file_id, include_comments)
     * @returns MCP-compatible result with file metadata and details
     */
    async getFileInfo(args: unknown): Promise<MCPToolResult> {
      const result = await typeSafeApiService.getFileInfo(args);
      return convertToMCPResult(result);
    },

    /**
     * Delete a file from Slack (where permitted)
     * @param args - Delete file arguments (file_id)
     * @returns MCP-compatible result with deletion status
     */
    async deleteFile(args: unknown): Promise<MCPToolResult> {
      const result = await typeSafeApiService.deleteFile(args);
      return convertToMCPResult(result);
    },

    /**
     * Share an existing file to additional channels
     * @param args - Share file arguments (file_id, channel)
     * @returns MCP-compatible result with sharing status
     */
    async shareFile(args: unknown): Promise<MCPToolResult> {
      const result = await typeSafeApiService.shareFile(args);
      return convertToMCPResult(result);
    },

    /**
     * Analyze file types, sizes, and usage patterns in workspace
     * @param args - Analysis arguments (channel, user, days_back, size_threshold_mb)
     * @returns MCP-compatible result with file analytics and statistics
     */
    async analyzeFiles(args: unknown): Promise<MCPToolResult> {
      const result = await typeSafeApiService.analyzeFiles(args);
      return convertToMCPResult(result);
    },

    /**
     * Search for files by name, type, or content
     * @param args - Search arguments (query, channel, user, types, date range, pagination)
     * @returns MCP-compatible result with matching files and search metadata
     */
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
