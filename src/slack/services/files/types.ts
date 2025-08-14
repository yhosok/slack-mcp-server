import type { InfrastructureServices } from '../../infrastructure/factory.js';
import type { MCPToolResult } from '../../../mcp/types.js';

/**
 * Dependencies for file service operations
 */
export type FileServiceDependencies = InfrastructureServices;

/**
 * Configuration for file service operations
 */
export interface FileServiceConfig {
  maxFileSize?: number;
  allowedFileTypes?: string[];
  defaultFileLimit?: number;
}

/**
 * File service interface
 */
export interface FileService {
  uploadFile(args: unknown): Promise<MCPToolResult>;
  listFiles(args: unknown): Promise<MCPToolResult>;
  getFileInfo(args: unknown): Promise<MCPToolResult>;
  deleteFile(args: unknown): Promise<MCPToolResult>;
  shareFile(args: unknown): Promise<MCPToolResult>;
  analyzeFiles(args: unknown): Promise<MCPToolResult>;
  searchFiles(args: unknown): Promise<MCPToolResult>;
}
