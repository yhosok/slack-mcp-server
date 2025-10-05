import type { InfrastructureServices } from '../../infrastructure/factory.js';
import type { MCPToolResult } from '../../../mcp/types.js';
import type {
  UploadFileResult,
  ListFilesResult,
  FileInfoResult,
  DeleteFileResult,
  ShareFileResult,
  FileAnalysisResult,
  SearchFilesResult,
} from '../../types/outputs/files.js';

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
 * File service interface with TypeSafeAPI + ts-pattern type safety
 *
 * All methods return ServiceResult discriminated unions enabling:
 * - Exhaustive pattern matching with compile-time guarantees
 * - Type-safe error handling without try-catch complexity
 * - Functional programming patterns for result processing
 * - Zero-cost abstractions with TypeScript inference
 */
export interface FileService {
  uploadFile(args: unknown): Promise<UploadFileResult>;
  listFiles(args: unknown): Promise<ListFilesResult>;
  getFileInfo(args: unknown): Promise<FileInfoResult>;
  deleteFile(args: unknown): Promise<DeleteFileResult>;
  shareFile(args: unknown): Promise<ShareFileResult>;
  analyzeFiles(args: unknown): Promise<FileAnalysisResult>;
  searchFiles(args: unknown): Promise<SearchFilesResult>;
}

/**
 * MCP protocol interface for tool result compatibility with files
 * Used by SlackService facade for MCP protocol compliance
 *
 * This interface returns MCPToolResult as required by the Model Context Protocol.
 * The internal TypeSafeAPI services provide enhanced type safety, while this
 * interface ensures MCP protocol compatibility through adapter pattern.
 */
export interface FileServiceMCPCompat {
  uploadFile(args: unknown): Promise<MCPToolResult>;
  listFiles(args: unknown): Promise<MCPToolResult>;
  getFileInfo(args: unknown): Promise<MCPToolResult>;
  deleteFile(args: unknown): Promise<MCPToolResult>;
  shareFile(args: unknown): Promise<MCPToolResult>;
  analyzeFiles(args: unknown): Promise<MCPToolResult>;
  searchFiles(args: unknown): Promise<MCPToolResult>;
}
