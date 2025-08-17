import type {
  FilesListArguments,
  FilesUploadV2Arguments,
  FilesCompleteUploadExternalResponse,
} from '@slack/web-api';
import { promises as fs } from 'fs';
import {
  UploadFileSchema,
  ListFilesSchema,
  GetFileInfoSchema,
  DeleteFileSchema,
  ShareFileSchema,
  AnalyzeFilesSchema,
  SearchFilesSchema,
  validateInput,
} from '../../../utils/validation.js';
import type { FileService, FileServiceDependencies } from './types.js';
import {
  createServiceSuccess,
  createTypedServiceError,
  enforceServiceOutput,
} from '../../types/typesafe-api-patterns.js';
import type {
  UploadFileResult,
  ListFilesResult,
  FileInfoResult,
  DeleteFileResult,
  ShareFileResult,
  FileAnalysisResult,
  SearchFilesResult,
  UploadFileOutput,
  ListFilesOutput,
  FileInfoOutput,
  DeleteFileOutput,
  ShareFileOutput,
  FileAnalysisOutput,
  SearchFilesOutput,
} from '../../types/outputs/files.js';
import { executePagination } from '../../infrastructure/generic-pagination.js';

// Export types for external use
export type { FileService, FileServiceDependencies } from './types.js';
import { SlackAPIError } from '../../../utils/errors.js';
import { formatFileAnalysis } from '../../analysis/index.js';
import { logger } from '../../../utils/logger.js';

/**
 * Constants for file upload logging and security limits
 */
const API_CONTEXT = {
  FILE_READ_ERROR: 'file_read_error',
  API_ERROR: 'uploadV2_api_error',
  EMPTY_RESPONSE: 'uploadV2_empty_response',
  CHANNEL_LIMITATION: 'uploadV2_channel_limitation',
  SECURITY_VIOLATION: 'file_security_violation',
} as const;

/**
 * Security configuration for file operations
 */
const FILE_SECURITY = {
  MAX_FILE_SIZE_MB: 50,
  ALLOWED_EXTENSIONS: new Set([
    '.txt',
    '.md',
    '.pdf',
    '.doc',
    '.docx',
    '.xls',
    '.xlsx',
    '.ppt',
    '.pptx',
    '.jpg',
    '.jpeg',
    '.png',
    '.gif',
    '.svg',
    '.webp',
    '.mp3',
    '.mp4',
    '.avi',
    '.mov',
    '.wav',
    '.zip',
    '.tar',
    '.gz',
    '.json',
    '.xml',
    '.csv',
  ]),
  BLOCKED_EXTENSIONS: new Set([
    '.exe',
    '.bat',
    '.cmd',
    '.scr',
    '.com',
    '.pif',
    '.vbs',
    '.js',
    '.jar',
    '.app',
    '.deb',
    '.rpm',
    '.dmg',
    '.pkg',
    '.msi',
  ]),
} as const;

/**
 * Type alias for the files.uploadV2 API response
 * Uses the same structure as files.completeUploadExternal
 */
type FilesUploadV2Response = FilesCompleteUploadExternalResponse;

/**
 * File validation result with detailed security information
 */
interface FileValidationResult {
  valid: boolean;
  error?: string;
  size?: number;
  extension?: string;
  securityRisk?: 'SIZE_EXCEEDED' | 'INVALID_TYPE' | 'BLOCKED_EXTENSION' | 'PATH_TRAVERSAL';
}

/**
 * Comprehensive file security validation before upload operations
 *
 * Implements multiple security layers:
 * - File size limits to prevent memory exhaustion
 * - File type validation using extension whitelist/blacklist
 * - Path traversal attack protection
 * - File existence and accessibility verification
 *
 * @param filePath - Absolute path to file for validation
 * @returns Promise resolving to validation result with security context
 */
const validateFileUpload = async (filePath: string): Promise<FileValidationResult> => {
  try {
    // Path traversal protection
    if (filePath.includes('..') || filePath.includes('~')) {
      return {
        valid: false,
        error: 'Path traversal detected in file path',
        securityRisk: 'PATH_TRAVERSAL',
      };
    }

    // File existence and size check
    const stats = await fs.stat(filePath);
    const sizeBytes = stats.size;
    const sizeMB = sizeBytes / (1024 * 1024);

    // File size validation
    if (sizeMB > FILE_SECURITY.MAX_FILE_SIZE_MB) {
      return {
        valid: false,
        error: `File size (${sizeMB.toFixed(1)}MB) exceeds maximum limit of ${FILE_SECURITY.MAX_FILE_SIZE_MB}MB`,
        size: sizeBytes,
        securityRisk: 'SIZE_EXCEEDED',
      };
    }

    // File extension validation
    const extension = filePath.toLowerCase().substring(filePath.lastIndexOf('.'));

    if (FILE_SECURITY.BLOCKED_EXTENSIONS.has(extension)) {
      return {
        valid: false,
        error: `File type '${extension}' is blocked for security reasons`,
        extension,
        securityRisk: 'BLOCKED_EXTENSION',
      };
    }

    if (extension && !FILE_SECURITY.ALLOWED_EXTENSIONS.has(extension)) {
      return {
        valid: false,
        error: `File type '${extension}' is not in the allowed types list`,
        extension,
        securityRisk: 'INVALID_TYPE',
      };
    }

    return {
      valid: true,
      size: sizeBytes,
      extension,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const errorCode = (error as NodeJS.ErrnoException)?.code;

    return {
      valid: false,
      error: `File access error: ${errorMessage}${errorCode ? ` (${errorCode})` : ''}`,
    };
  }
};

/**
 * Create file service with infrastructure dependencies
 *
 * Factory function that creates a TypeSafeAPI-compliant file service with
 * full type safety, error handling, and integration with existing infrastructure.
 *
 * Features:
 * - Type-safe operations with discriminated union results
 * - Automatic input validation using Zod schemas
 * - Consistent error handling with ServiceResult patterns
 * - Integration with Slack Web API client management
 * - Support for both bot and user token operations
 *
 * @param deps - Infrastructure dependencies (client manager, rate limiter, etc.)
 * @returns File service instance with TypeSafeAPI + ts-pattern type safety
 */
export const createFileService = (deps: FileServiceDependencies): FileService => {
  /**
   * Upload a file to Slack channels or threads using files.uploadV2 API with TypeSafeAPI + ts-pattern type safety
   *
   * Uploads a file from the local filesystem to Slack channels or threads.
   * Uses files.uploadV2 API with comprehensive error handling and validation.
   *
   * Note: The V2 API has limitations compared to the legacy files.upload API:
   * - Only supports a single channel per upload (use channel_id)
   * - Multiple channels require separate upload calls
   * - Response structure uses files array instead of single file object
   *
   * @param args - Unknown input (validated at runtime using UploadFileSchema)
   * @returns ServiceResult with upload confirmation or error details
   *
   * @example Basic Upload
   * ```typescript
   * const result = await uploadFile({
   *   file_path: '/path/to/file.txt',
   *   channels: ['C1234567890']
   * });
   * ```
   *
   * @example Thread Upload
   * ```typescript
   * const result = await uploadFile({
   *   file_path: '/path/to/file.txt',
   *   channels: ['C1234567890'],
   *   thread_ts: '1234567890.123456'
   * });
   * ```
   */
  const uploadFile = async (args: unknown): Promise<UploadFileResult> => {
    try {
      // Validate input using TypeSafeAPI validation pattern
      const input = validateInput(UploadFileSchema, args);

      const client = deps.clientManager.getClientForOperation('write');

      // Security validation before file operations
      const validation = await validateFileUpload(input.file_path);
      if (!validation.valid) {
        logger.error('File security validation failed', {
          file_path: input.file_path,
          error: validation.error,
          security_risk: validation.securityRisk,
          api_context: API_CONTEXT.SECURITY_VIOLATION,
          operation: 'uploadFile',
        });

        return createTypedServiceError(
          'VALIDATION_ERROR',
          validation.error || 'File validation failed',
          'File upload security validation failed',
          {
            filePath: input.file_path,
            securityRisk: validation.securityRisk,
            fileSize: validation.size,
            fileExtension: validation.extension,
          }
        );
      }

      // Read file content from filesystem (now security-validated)
      let fileContent: Buffer;
      try {
        fileContent = await fs.readFile(input.file_path);
      } catch (error) {
        // Enhanced error context for better debugging
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        const errorCode = (error as NodeJS.ErrnoException)?.code;

        logger.error('Failed to read file for upload', {
          file_path: input.file_path,
          error_message: errorMessage,
          error_code: errorCode,
          api_context: API_CONTEXT.FILE_READ_ERROR,
          operation: 'uploadFile',
        });

        return createTypedServiceError(
          'API_ERROR',
          `Failed to read file from path '${input.file_path}': ${errorMessage}${errorCode ? ` (${errorCode})` : ''}`,
          'File system error during upload',
          {
            filePath: input.file_path,
            errorCode,
            validatedSize: validation.size,
          }
        );
      }

      // Extract filename from path if not explicitly provided
      const filename = input.filename || input.file_path.split('/').pop() || 'uploaded-file';

      // Build upload options for V2 API with type-safe construction
      // V2 API requires channel_id - if no channels provided, we'll let the API handle it
      const uploadOptions: Partial<FilesUploadV2Arguments> = {
        filename,
        file: fileContent,
        ...(input.title && { title: input.title }),
        ...(input.initial_comment && { initial_comment: input.initial_comment }),
        ...(input.thread_ts && { thread_ts: input.thread_ts }),
      };

      // Add channel_id if channels are provided
      if (input.channels && input.channels.length > 0) {
        uploadOptions.channel_id = input.channels[0];
      }

      // Log a warning if multiple channels were specified (V2 API limitation)
      if (input.channels && input.channels.length > 1) {
        logger.warn('files.uploadV2 API limitation: multiple channels not supported', {
          filename,
          total_channels: input.channels.length,
          selected_channel: input.channels[0],
          ignored_channels: input.channels.slice(1),
          api_context: API_CONTEXT.CHANNEL_LIMITATION,
        });
      }

      // Call Slack files.uploadV2 API with type-safe arguments
      const result = (await client.filesUploadV2(
        uploadOptions as FilesUploadV2Arguments
      )) as FilesUploadV2Response;

      // Validate V2 API response structure
      if (!result.ok) {
        logger.error('Slack files.uploadV2 API returned error response', {
          filename,
          file_size: fileContent.length,
          upload_channel: uploadOptions.channel_id || 'none',
          slack_error: result.error || 'Unknown error',
          api_context: API_CONTEXT.API_ERROR,
          operation: 'uploadFile',
        });

        return createTypedServiceError(
          'API_ERROR',
          `File upload failed: ${result.error || 'Unknown error'}`,
          'Slack API error during upload',
          {
            slackError: result.error,
            filename,
            fileSize: fileContent.length,
            uploadChannel: uploadOptions.channel_id,
          }
        );
      }

      if (!result.files || result.files.length === 0) {
        logger.error('Slack files.uploadV2 API succeeded but returned no file information', {
          filename,
          file_size: fileContent.length,
          upload_channel: uploadOptions.channel_id || 'none',
          api_context: API_CONTEXT.EMPTY_RESPONSE,
          operation: 'uploadFile',
          response_structure: {
            has_files_array: !!result.files,
            files_array_length: result.files?.length || 0,
          },
        });

        return createTypedServiceError(
          'API_ERROR',
          'File upload failed: API succeeded but returned no file information',
          'Invalid API response during upload',
          {
            filename,
            fileSize: fileContent.length,
            responseStructure: {
              hasFilesArray: !!result.files,
              filesArrayLength: result.files?.length || 0,
            },
          }
        );
      }

      // Extract uploaded file information from V2 response (uses files array)
      // The files array is guaranteed to have at least one element due to the check above
      const uploadedFile = result.files[0]!;

      // Create TypeSafeAPI-compliant output
      const output: UploadFileOutput = enforceServiceOutput({
        file: {
          ...(uploadedFile.id && { id: uploadedFile.id }),
          name: uploadedFile.name || filename,
          title: uploadedFile.title || filename,
          size: uploadedFile.size || fileContent.length,
          url: uploadedFile.url_private || '',
          downloadUrl: uploadedFile.url_private_download || '',
          channels:
            uploadedFile.channels ||
            (uploadOptions.channel_id ? [uploadOptions.channel_id as string] : []),
          timestamp: uploadedFile.timestamp || Math.floor(Date.now() / 1000),
        },
        uploadedAt: new Date().toISOString(),
      });

      return createServiceSuccess(output, 'File uploaded successfully');
    } catch (error) {
      if (error instanceof SlackAPIError) {
        return createTypedServiceError(
          'API_ERROR',
          error.message,
          'Slack API error during upload',
          {
            slackErrorCode: error.code,
            statusCode: error.statusCode,
          }
        );
      }

      return createTypedServiceError(
        'UNKNOWN_ERROR',
        `Failed to upload file: ${error}`,
        'Unexpected error during file upload',
        {
          errorType: error?.constructor?.name || 'Unknown',
        }
      );
    }
  };

  /**
   * List files in workspace with filtering options using TypeSafeAPI + ts-pattern type safety
   *
   * Retrieves files from the workspace with comprehensive filtering and pagination support.
   * Uses the unified pagination implementation for consistent behavior.
   *
   * @param args - Unknown input (validated at runtime using ListFilesSchema)
   * @returns ServiceResult with file list and pagination metadata
   *
   * @example Basic Listing
   * ```typescript
   * const result = await listFiles({});
   * ```
   *
   * @example Filtered Listing
   * ```typescript
   * const result = await listFiles({
   *   channel: 'C1234567890',
   *   user: 'U1234567890',
   *   types: 'images,pdfs'
   * });
   * ```
   */
  const listFiles = async (args: unknown): Promise<ListFilesResult> => {
    try {
      // Validate input using TypeSafeAPI validation pattern
      const input = validateInput(ListFilesSchema, args);

      const client = deps.clientManager.getClientForOperation('read');

      // Use unified pagination implementation for Slack files API (page-based)
      let currentPage = input.page || 1;

      const paginationResult = await executePagination(input, {
        fetchPage: async () => {
          const listArgs: FilesListArguments = {
            channel: input.channel,
            user: input.user,
            ts_from: input.ts_from,
            ts_to: input.ts_to,
            types: input.types,
            count: input.count || 100,
            page: currentPage,
          };

          const result = await client.files.list(listArgs);

          if (!result.files) {
            throw new SlackAPIError(
              `Failed to retrieve files${currentPage > 1 ? ` (page ${currentPage})` : ''}`
            );
          }

          currentPage++;
          return result;
        },

        getCursor: (response) => {
          // Slack files.list uses page-based pagination, not cursor-based
          // Continue if we have more pages based on the paging info
          const paging = response.paging;
          if (
            paging &&
            paging.page !== undefined &&
            paging.pages !== undefined &&
            paging.page < paging.pages
          ) {
            return `page-${paging.page + 1}`;
          }
          return undefined;
        },

        getItems: (response) => response.files || [],

        formatResponse: (data) => {
          // Type-safe file mapping with proper Slack API types
          const files = data.items.map((file) => ({
            id: file.id || '',
            name: file.name || '',
            title: file.title || '',
            filetype: file.filetype || '',
            size: file.size || 0,
            url: file.url_private || '',
            downloadUrl: file.url_private_download || '',
            user: file.user || '',
            timestamp: file.timestamp || 0,
            channels: file.channels || [],
          }));

          return {
            files,
            total: files.length,
            pageCount: data.pageCount,
            pagination: data.hasMore ? { hasMore: true } : null,
          };
        },
      });

      // Create TypeSafeAPI-compliant output from pagination result
      const output: ListFilesOutput = enforceServiceOutput(paginationResult);

      return createServiceSuccess(output, 'Files retrieved successfully');
    } catch (error) {
      if (error instanceof SlackAPIError) {
        return createTypedServiceError('API_ERROR', error.message, 'Failed to retrieve files', {
          slackErrorCode: error.code,
          statusCode: error.statusCode,
        });
      }

      return createTypedServiceError(
        'UNKNOWN_ERROR',
        `Failed to list files: ${error}`,
        'Unexpected error during file listing',
        {
          errorType: error?.constructor?.name || 'Unknown',
        }
      );
    }
  };

  /**
   * Get detailed information about a specific file using TypeSafeAPI + ts-pattern type safety
   *
   * Retrieves comprehensive metadata about a specific file including
   * optional comments if requested.
   *
   * @param args - Unknown input (validated at runtime using GetFileInfoSchema)
   * @returns ServiceResult with detailed file information
   *
   * @example Basic File Info
   * ```typescript
   * const result = await getFileInfo({
   *   file_id: 'F1234567890'
   * });
   * ```
   *
   * @example File Info with Comments
   * ```typescript
   * const result = await getFileInfo({
   *   file_id: 'F1234567890',
   *   include_comments: true
   * });
   * ```
   */
  const getFileInfo = async (args: unknown): Promise<FileInfoResult> => {
    try {
      // Validate input using TypeSafeAPI validation pattern
      const input = validateInput(GetFileInfoSchema, args);

      const client = deps.clientManager.getClientForOperation('read');

      const result = await client.files.info({
        file: input.file_id,
      });

      if (!result.file) {
        return createTypedServiceError(
          'NOT_FOUND_ERROR',
          'File not found',
          'The requested file does not exist or is not accessible',
          {
            fileId: input.file_id,
          }
        );
      }

      // Get file comments if requested
      let comments: Array<{ comment: string; user: string; timestamp: number; id: string }> = [];
      if (input.include_comments) {
        try {
          // Note: files.comments is deprecated, skip for now
          comments = [];
        } catch {
          // Comments API not available or deprecated
          comments = [];
        }
      }

      // Create TypeSafeAPI-compliant output
      const output: FileInfoOutput = enforceServiceOutput({
        id: result.file.id || '',
        name: result.file.name || '',
        title: result.file.title || '',
        mimetype: result.file.mimetype,
        filetype: result.file.filetype,
        size: result.file.size,
        url: result.file.url_private,
        downloadUrl: result.file.url_private_download,
        previewUrl: result.file.preview,
        thumbnailUrl: result.file.thumb_360,
        channels: result.file.channels,
        groups: result.file.groups,
        ims: result.file.ims,
        user: result.file.user,
        username: result.file.username,
        timestamp: result.file.timestamp,
        created: result.file.created,
        isPublic: result.file.public_url_shared,
        isExternal: result.file.is_external,
        hasRichPreview: result.file.has_rich_preview,
        comments: comments.map((comment) => ({
          id: comment.id,
          user: comment.user,
          comment: comment.comment,
          timestamp: comment.timestamp,
        })),
      });

      return createServiceSuccess(output, 'File information retrieved successfully');
    } catch (error) {
      if (error instanceof SlackAPIError) {
        return createTypedServiceError(
          'API_ERROR',
          error.message,
          'Failed to retrieve file information',
          {
            slackErrorCode: error.code,
            statusCode: error.statusCode,
          }
        );
      }

      return createTypedServiceError(
        'UNKNOWN_ERROR',
        `Failed to get file info: ${error}`,
        'Unexpected error during file information retrieval',
        {
          errorType: error?.constructor?.name || 'Unknown',
        }
      );
    }
  };

  /**
   * Delete a file (where permitted) using TypeSafeAPI + ts-pattern type safety
   *
   * Removes a file from the workspace if the user has appropriate permissions.
   * This is a simple success/failure operation with context preservation.
   *
   * @param args - Unknown input (validated at runtime using DeleteFileSchema)
   * @returns ServiceResult with deletion confirmation
   *
   * @example File Deletion
   * ```typescript
   * const result = await deleteFile({
   *   file_id: 'F1234567890'
   * });
   * ```
   */
  const deleteFile = async (args: unknown): Promise<DeleteFileResult> => {
    try {
      // Validate input using TypeSafeAPI validation pattern
      const input = validateInput(DeleteFileSchema, args);

      const client = deps.clientManager.getClientForOperation('write');

      const result = await client.files.delete({
        file: input.file_id,
      });

      if (!result.ok) {
        return createTypedServiceError(
          'API_ERROR',
          `Failed to delete file: ${result.error || 'Unknown error'}`,
          'File deletion failed',
          {
            slackError: result.error,
            fileId: input.file_id,
          }
        );
      }

      // Create TypeSafeAPI-compliant output
      const output: DeleteFileOutput = enforceServiceOutput({
        success: true,
        fileId: input.file_id,
        message: 'File deleted successfully',
        timestamp: new Date().toISOString(),
      });

      return createServiceSuccess(output, 'File deleted successfully');
    } catch (error) {
      if (error instanceof SlackAPIError) {
        return createTypedServiceError('API_ERROR', error.message, 'Failed to delete file', {
          slackErrorCode: error.code,
          statusCode: error.statusCode,
        });
      }

      return createTypedServiceError(
        'UNKNOWN_ERROR',
        `Failed to delete file: ${error}`,
        'Unexpected error during file deletion',
        {
          errorType: error?.constructor?.name || 'Unknown',
        }
      );
    }
  };

  /**
   * Share an existing file to additional channels using TypeSafeAPI + ts-pattern type safety
   *
   * Shares a file to additional channels by posting its permalink via chat.postMessage.
   * This is a complex operation involving file info retrieval and message posting.
   *
   * @param args - Unknown input (validated at runtime using ShareFileSchema)
   * @returns ServiceResult with sharing confirmation and permalink
   *
   * @example File Sharing
   * ```typescript
   * const result = await shareFile({
   *   file_id: 'F1234567890',
   *   channel: 'C1234567890'
   * });
   * ```
   */
  const shareFile = async (args: unknown): Promise<ShareFileResult> => {
    try {
      // Validate input using TypeSafeAPI validation pattern
      const input = validateInput(ShareFileSchema, args);

      const client = deps.clientManager.getClientForOperation('write');

      // First, get the file information to retrieve the permalink
      const fileInfo = await client.files.info({
        file: input.file_id,
      });

      if (!fileInfo.ok) {
        return createTypedServiceError(
          'API_ERROR',
          `Failed to get file information: ${fileInfo.error || 'Unknown error'}`,
          'File information retrieval failed',
          {
            slackError: fileInfo.error,
            fileId: input.file_id,
          }
        );
      }

      if (!fileInfo.file?.permalink) {
        return createTypedServiceError(
          'NOT_FOUND_ERROR',
          'File permalink not available',
          'File cannot be shared due to missing permalink',
          {
            fileId: input.file_id,
            hasFile: !!fileInfo.file,
          }
        );
      }

      // Share the file by posting its permalink to the channel
      const result = await client.chat.postMessage({
        channel: input.channel,
        text: `File shared: ${fileInfo.file.permalink}`,
        unfurl_links: true, // Enable link previews for the file
      });

      if (!result.ok) {
        return createTypedServiceError(
          'API_ERROR',
          `Failed to share file: ${result.error || 'Unknown error'}`,
          'File sharing message failed',
          {
            slackError: result.error,
            fileId: input.file_id,
            channel: input.channel,
          }
        );
      }

      // Create TypeSafeAPI-compliant output
      const output: ShareFileOutput = enforceServiceOutput({
        success: true,
        fileId: input.file_id,
        channel: input.channel,
        permalink: fileInfo.file.permalink,
        message: 'File shared successfully',
        timestamp: new Date().toISOString(),
      });

      return createServiceSuccess(output, 'File shared successfully');
    } catch (error) {
      if (error instanceof SlackAPIError) {
        return createTypedServiceError('API_ERROR', error.message, 'Failed to share file', {
          slackErrorCode: error.code,
          statusCode: error.statusCode,
        });
      }

      return createTypedServiceError(
        'UNKNOWN_ERROR',
        `Failed to share file: ${error}`,
        'Unexpected error during file sharing',
        {
          errorType: error?.constructor?.name || 'Unknown',
        }
      );
    }
  };

  /**
   * Analyze file types, sizes, and usage patterns in workspace using TypeSafeAPI + ts-pattern type safety
   *
   * Performs comprehensive file analysis including type breakdown, user statistics,
   * and large file identification. Integrates with formatFileAnalysis for consistent reporting.
   *
   * @param args - Unknown input (validated at runtime using AnalyzeFilesSchema)
   * @returns ServiceResult with comprehensive file analysis
   *
   * @example Basic Analysis
   * ```typescript
   * const result = await analyzeFiles({
   *   days_back: 30
   * });
   * ```
   *
   * @example Filtered Analysis
   * ```typescript
   * const result = await analyzeFiles({
   *   days_back: 7,
   *   channel: 'C1234567890',
   *   size_threshold_mb: 5
   * });
   * ```
   */
  const analyzeFiles = async (args: unknown): Promise<FileAnalysisResult> => {
    try {
      // Validate input using TypeSafeAPI validation pattern
      const input = validateInput(AnalyzeFilesSchema, args);

      const client = deps.clientManager.getClientForOperation('read');

      // Calculate time range
      const now = new Date();
      const daysBack = input.days_back || 30;
      const fromTime = Math.floor((now.getTime() - daysBack * 24 * 60 * 60 * 1000) / 1000);

      const listArgs: FilesListArguments = {
        ts_from: fromTime.toString(),
        channel: input.channel,
        user: input.user,
        count: 1000, // Get comprehensive data
      };

      const result = await client.files.list(listArgs);

      if (!result.files) {
        return createTypedServiceError(
          'NOT_FOUND_ERROR',
          'No files found in the specified period',
          'File analysis cannot be performed on empty dataset',
          {
            daysBack: input.days_back || 30,
            channel: input.channel,
            user: input.user,
          }
        );
      }

      const files = result.files;
      const analysis = {
        total_files: files.length,
        total_size_bytes: 0,
        by_type: {} as { [filetype: string]: { count: number; size_bytes: number } },
        by_user: {} as { [user: string]: { count: number; size_bytes: number } },
        by_channel: {} as { [channel: string]: { count: number; size_bytes: number } },
        large_files: [] as any[],
        old_files: [] as any[],
        recent_activity: [] as { date: string; uploads: number; size_bytes: number }[],
      };

      for (const file of files) {
        const size = file.size || 0;
        analysis.total_size_bytes += size;

        // Type breakdown
        const type = file.filetype || 'unknown';
        if (!analysis.by_type[type]) {
          analysis.by_type[type] = { count: 0, size_bytes: 0 };
        }
        analysis.by_type[type].count++;
        analysis.by_type[type].size_bytes += size;

        // User breakdown
        const userId = file.user || 'unknown';
        if (!analysis.by_user[userId]) {
          analysis.by_user[userId] = { count: 0, size_bytes: 0 };
        }
        analysis.by_user[userId].count++;
        analysis.by_user[userId].size_bytes += size;

        // Large files
        const thresholdMB = input.size_threshold_mb || 10;
        const sizeMB = size / (1024 * 1024);
        if (sizeMB > thresholdMB) {
          analysis.large_files.push({
            id: file.id || '',
            name: file.name || 'unknown',
            title: file.title || '',
            filetype: type,
            size: size,
            url: file.url_private || '',
            downloadUrl: file.url_private_download || '',
            user: file.user || '',
            timestamp: file.timestamp || 0,
            channels: file.channels || [],
          });
        }
      }

      analysis.large_files.sort((a, b) => (b.size || 0) - (a.size || 0));

      const formatOptions = {
        includeLargeFiles: input.include_large_files !== false,
        includeUserStats: true,
        includeTypeBreakdown: true,
        includeOldFiles: false,
        maxItems: 10,
        includeEmojis: false,
        includeTimestamps: false,
        maxLineLength: 80,
        precision: 1,
      };

      const _analysisResult = formatFileAnalysis(analysis, formatOptions);

      // Create TypeSafeAPI-compliant output
      const output: FileAnalysisOutput = enforceServiceOutput({
        analysis: {
          totalFiles: analysis.total_files,
          totalSizeBytes: analysis.total_size_bytes,
          byType: Object.fromEntries(
            Object.entries(analysis.by_type).map(([key, value]) => [
              key,
              { count: value.count, sizeBytes: value.size_bytes },
            ])
          ),
          byUser: Object.fromEntries(
            Object.entries(analysis.by_user).map(([key, value]) => [
              key,
              { count: value.count, sizeBytes: value.size_bytes },
            ])
          ),
          largeFiles: analysis.large_files,
        },
        summary: `File analysis completed for ${daysBack} days`,
        metadata: {
          analysisDate: new Date().toISOString(),
          periodDays: daysBack,
          thresholdMB: input.size_threshold_mb || 10,
        },
      });

      return createServiceSuccess(output, 'File analysis completed successfully');
    } catch (error) {
      if (error instanceof SlackAPIError) {
        return createTypedServiceError('API_ERROR', error.message, 'Failed to analyze files', {
          slackErrorCode: error.code,
          statusCode: error.statusCode,
        });
      }

      return createTypedServiceError(
        'UNKNOWN_ERROR',
        `Failed to analyze files: ${error}`,
        'Unexpected error during file analysis',
        {
          errorType: error?.constructor?.name || 'Unknown',
        }
      );
    }
  };

  /**
   * Search for files by name, type, or content using TypeSafeAPI + ts-pattern type safety
   *
   * Searches for files using the Slack search API with advanced query building.
   * Requires user token validation and supports complex filtering options.
   *
   * @param args - Unknown input (validated at runtime using SearchFilesSchema)
   * @returns ServiceResult with search results and query context
   *
   * @example Basic Search
   * ```typescript
   * const result = await searchFiles({
   *   query: 'document'
   * });
   * ```
   *
   * @example Advanced Search
   * ```typescript
   * const result = await searchFiles({
   *   query: 'report',
   *   types: 'pdf,docx',
   *   channel: 'C1234567890',
   *   after: '2023-01-01'
   * });
   * ```
   */
  const searchFiles = async (args: unknown): Promise<SearchFilesResult> => {
    try {
      // Validate input using TypeSafeAPI validation pattern
      const input = validateInput(SearchFilesSchema, args);

      // Check if search API is available
      try {
        deps.clientManager.checkSearchApiAvailability(
          'searchFiles',
          'Use file listing with filters instead'
        );
      } catch (error) {
        return createTypedServiceError(
          'AUTHORIZATION_ERROR',
          error instanceof Error ? error.message : 'Search API not available',
          'File search requires user token',
          {
            searchQuery: input.query,
            requiresUserToken: true,
          }
        );
      }

      const client = deps.clientManager.getClientForOperation('read');

      // Build search query
      let searchQuery = input.query;

      // Add file type filter if specified
      if (input.types) {
        const types = input.types
          .split(',')
          .map((t) => `filetype:${t.trim()}`)
          .join(' OR ');
        searchQuery += ` (${types})`;
      }

      // Add channel filter if specified
      if (input.channel) {
        searchQuery += ` in:<#${input.channel}>`;
      }

      // Add user filter if specified
      if (input.user) {
        searchQuery += ` from:<@${input.user}>`;
      }

      // Add date filters if specified
      if (input.after) {
        searchQuery += ` after:${input.after}`;
      }
      if (input.before) {
        searchQuery += ` before:${input.before}`;
      }

      const searchResult = await client.search.files({
        query: searchQuery,
        count: input.count || 20,
        sort: 'timestamp',
        sort_dir: 'desc',
      });

      if (!searchResult.files?.matches) {
        // Create TypeSafeAPI-compliant output for empty results
        const output: SearchFilesOutput = enforceServiceOutput({
          results: [],
          total: 0,
          query: searchQuery,
          pagination: undefined,
        });

        return createServiceSuccess(output, 'File search completed (no results found)');
      }

      // Create TypeSafeAPI-compliant output
      const output: SearchFilesOutput = enforceServiceOutput({
        results: searchResult.files.matches.map((file) => ({
          id: file.id || '',
          name: file.name || '',
          title: file.title || '',
          filetype: file.filetype || '',
          size: file.size || 0,
          url: file.url_private || '',
          user: file.user || '',
          timestamp: file.timestamp?.toString() || '',
          channel: file.channels?.[0] || '',
        })),
        total: searchResult.files.total || 0,
        query: searchQuery,
        pagination: searchResult.files.paging
          ? {
              hasMore:
                (searchResult.files.paging.total || 0) > (searchResult.files.paging.count || 0),
              cursor: searchResult.files.paging.page?.toString(),
              total: searchResult.files.paging.total,
            }
          : undefined,
      });

      return createServiceSuccess(output, 'File search completed successfully');
    } catch (error) {
      if (error instanceof SlackAPIError) {
        return createTypedServiceError('API_ERROR', error.message, 'Failed to search files', {
          slackErrorCode: error.code,
          statusCode: error.statusCode,
        });
      }

      return createTypedServiceError(
        'UNKNOWN_ERROR',
        `Failed to search files: ${error}`,
        'Unexpected error during file search',
        {
          errorType: error?.constructor?.name || 'Unknown',
        }
      );
    }
  };

  return {
    uploadFile,
    listFiles,
    getFileInfo,
    deleteFile,
    shareFile,
    analyzeFiles,
    searchFiles,
  };
};
