/**
 * File service output types following TypeSafeAPI TypeScript best practices
 * 
 * Design Principles:
 * - All interfaces extend ServiceOutput for JSON serialization safety
 * - Consistent error/success patterns across all operations
 * - Discriminated unions for better type safety
 * - Comprehensive metadata for debugging and analytics
 */

import type { ServiceOutput } from '../../infrastructure/validation/type-helpers.js';

/**
 * Result of file deletion operation
 * TypeSafeAPI pattern: Consistent success/error structure with file context
 */
export interface DeleteFileOutput extends ServiceOutput {
  success: boolean;
  fileId: string;
  message: string;
  timestamp?: string;
  [key: string]: unknown;

}

/**
 * Result of file upload operation
 * TypeSafeAPI pattern: Discriminated union for type-safe success/error handling
 */
export type UploadFileOutput = UploadFileSuccess | UploadFileError;

export interface UploadFileSuccess extends ServiceOutput {
  success: true;
  file: {
    id?: string; // Optional due to Slack API limitations
    name: string;
    title?: string;
    size: number;
    url: string;
    downloadUrl?: string;
    channels: string[];
    timestamp: number;
  };
  message: string;
  [key: string]: unknown;

}

export interface UploadFileError extends ServiceOutput {
  success: false;
  error: string;
  message: string;
  context?: {
    filename?: string;
    fileSize?: number;
    channels?: string[];
  };
  [key: string]: unknown;

}

/**
 * Result of file analysis operation
 * TypeSafeAPI pattern: Comprehensive analytics with consistent naming
 */
export interface FileAnalysisOutput extends ServiceOutput {
  analysis: {
    totalFiles: number;
    totalSizeBytes: number;
    byType: Record<string, { count: number; sizeBytes: number }>;
    byUser: Record<string, { count: number; sizeBytes: number }>;
    largeFiles: Array<{
      id: string;
      name: string;
      title: string;
      filetype: string;
      size: number;
      url: string;
      user: string;
      timestamp: number;
      channels: string[];
    }>;
  };
  summary: string;
  metadata: {
    analysisDate: string;
    periodDays: number;
    thresholdMB: number;
  };
  [key: string]: unknown;

}

/**
 * Result of file sharing operation
 * TypeSafeAPI pattern: Consistent structure with sharing context
 */
export interface ShareFileOutput extends ServiceOutput {
  success: boolean;
  fileId: string;
  channel: string;
  permalink: string;
  message: string;
  timestamp?: string;
  [key: string]: unknown;

}

/**
 * Result of file information retrieval
 * TypeSafeAPI pattern: Comprehensive file metadata structure
 */
export interface FileInfoOutput extends ServiceOutput {
  id: string;
  name: string;
  title: string;
  mimetype?: string;
  filetype?: string;
  size?: number;
  url?: string;
  downloadUrl?: string;
  previewUrl?: string;
  thumbnailUrl?: string;
  channels?: string[];
  groups?: string[];
  ims?: string[];
  user?: string;
  username?: string;
  timestamp?: number;
  created?: number;
  isPublic?: boolean;
  isExternal?: boolean;
  hasRichPreview?: boolean;
  comments: Array<{
    id: string;
    user: string;
    comment: string;
    timestamp: number;
  }>;
  [key: string]: unknown;

}

/**
 * Result of file listing operation
 * TypeSafeAPI pattern: Paginated results with comprehensive metadata
 */
export interface ListFilesOutput extends ServiceOutput {
  files: Array<{
    id: string;
    name: string;
    title: string;
    filetype?: string;
    size?: number;
    url?: string;
    downloadUrl?: string;
    user?: string;
    timestamp?: number;
    channels?: string[];
  }>;
  total: number;
  pageCount: number;
  pagination?: {
    hasMore: boolean;
    cursor?: string;
  } | null;
  [key: string]: unknown;

}

/**
 * Result of file search operation
 * TypeSafeAPI pattern: Search results with query context
 */
export interface SearchFilesOutput extends ServiceOutput {
  results: Array<{ id: string; name: string; title?: string; filetype?: string; size?: number; url?: string; user?: string; timestamp?: string; channel?: string }>; // Slack API search result structure
  total: number;
  query: string;
  pagination?: { hasMore?: boolean; cursor?: string; total?: number }; // Slack API pagination structure
  [key: string]: unknown;

}