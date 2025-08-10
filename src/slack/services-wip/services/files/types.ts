import type { InfrastructureServices } from '../../infrastructure/factory.js';

/**
 * Dependencies for file service operations
 */
export interface FileServiceDependencies extends InfrastructureServices {
  // Additional file-specific dependencies can be added here
}

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
  uploadFile(args: unknown): Promise<any>;
  listFiles(args: unknown): Promise<any>;
  getFileInfo(args: unknown): Promise<any>;
  deleteFile(args: unknown): Promise<any>;
  shareFile(args: unknown): Promise<any>;
  analyzeFiles(args: unknown): Promise<any>;
  searchFiles(args: unknown): Promise<any>;
}