import type { FilesListArguments, FilesUploadV2Arguments, FilesCompleteUploadExternalResponse } from '@slack/web-api';
import { promises as fs } from 'fs';
import {
  UploadFileSchema,
  ListFilesSchema,
  GetFileInfoSchema,
  DeleteFileSchema,
  ShareFileSchema,
  AnalyzeFilesSchema,
  SearchFilesSchema,
} from '../../../utils/validation.js';
import type { FileService, FileServiceDependencies } from './types.js';
import { executePagination } from '../../infrastructure/generic-pagination.js';

// Export types for external use
export type { FileService, FileServiceDependencies } from './types.js';
import { SlackAPIError } from '../../../utils/errors.js';
import { formatFileAnalysis } from '../../analysis/index.js';
import { logger } from '../../../utils/logger.js';

/**
 * Type alias for the files.uploadV2 API response
 * Uses the same structure as files.completeUploadExternal
 */
type FilesUploadV2Response = FilesCompleteUploadExternalResponse;

/**
 * Create file service with infrastructure dependencies
 * @param deps - Infrastructure dependencies
 * @returns File service instance
 */
export const createFileService = (deps: FileServiceDependencies): FileService => {
  /**
   * Upload a file to Slack channels or threads using files.uploadV2 API
   * 
   * Note: The V2 API has limitations compared to the legacy files.upload API:
   * - Only supports a single channel per upload (use channel_id)
   * - Multiple channels require separate upload calls
   * - Response structure uses files array instead of single file object
   */
  const uploadFile = (args: unknown) =>
    deps.requestHandler.handle(UploadFileSchema, args, async (input) => {
      const client = deps.clientManager.getClientForOperation('write');

      // Read file content from filesystem
      let fileContent: Buffer;
      try {
        fileContent = await fs.readFile(input.file_path);
      } catch (error) {
        throw new SlackAPIError(
          `Failed to read file from path '${input.file_path}': ${error instanceof Error ? error.message : 'Unknown error'}`
        );
      }

      // Extract filename from path if not explicitly provided
      const filename = input.filename || input.file_path.split('/').pop() || 'uploaded-file';

      // Build upload options for V2 API with flexible typing
      const uploadOptions: Record<string, unknown> = {
        filename,
        file: fileContent,
      };

      // Handle channel targeting - V2 API uses channel_id for single channel
      // If multiple channels provided, use the first one (V2 limitation)
      if (input.channels && input.channels.length > 0) {
        uploadOptions.channel_id = input.channels[0];
        
        // Log a warning if multiple channels were specified (V2 API limitation)
        if (input.channels.length > 1) {
          logger.warn(
            `files.uploadV2 API only supports single channel uploads. Using first channel: ${input.channels[0]}. ` +
            `Additional channels ignored: ${input.channels.slice(1).join(', ')}`
          );
        }
      }

      // Add optional parameters
      if (input.title) {
        uploadOptions.title = input.title;
      }
      if (input.initial_comment) {
        uploadOptions.initial_comment = input.initial_comment;
      }
      if (input.thread_ts) {
        uploadOptions.thread_ts = input.thread_ts;
      }

      // Call Slack files.uploadV2 API with proper type casting
      // Using unknown intermediate cast due to complex V2 API type constraints
      const result = await client.filesUploadV2(uploadOptions as unknown as FilesUploadV2Arguments) as FilesUploadV2Response;

      // Validate V2 API response structure
      if (!result.ok) {
        throw new SlackAPIError(
          `File upload failed: ${result.error || 'Unknown error'}`
        );
      }

      if (!result.files || result.files.length === 0) {
        throw new SlackAPIError(
          'File upload failed: API succeeded but returned no file information'
        );
      }

      // Extract uploaded file information from V2 response (uses files array)
      // The files array is guaranteed to have at least one element due to the check above
      const uploadedFile = result.files[0]!
      
      // Ensure we have a valid file ID (required field)
      if (!uploadedFile.id) {
        throw new SlackAPIError(
          'File upload failed: API returned file without ID'
        );
      }

      return {
        success: true,
        file: {
          id: uploadedFile.id,
          name: uploadedFile.name || filename,
          title: uploadedFile.title || filename,
          size: uploadedFile.size || fileContent.length,
          url: uploadedFile.url_private || '',
          downloadUrl: uploadedFile.url_private_download || '',
          channels: uploadedFile.channels || (uploadOptions.channel_id ? [uploadOptions.channel_id] : []),
          timestamp: uploadedFile.timestamp || Math.floor(Date.now() / 1000),
        },
      };
    });

  /**
   * List files in workspace with filtering options
   */
  const listFiles = (args: unknown) =>
    deps.requestHandler.handle(ListFilesSchema, args, async (input) => {
      const client = deps.clientManager.getClientForOperation('read');

      // Use unified pagination implementation for Slack files API (page-based)
      let currentPage = input.page || 1;
      
      return await executePagination(input, {
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
            throw new SlackAPIError(`Failed to retrieve files${currentPage > 1 ? ` (page ${currentPage})` : ''}`);
          }

          currentPage++;
          return result;
        },

        getCursor: (response) => {
          // Slack files.list uses page-based pagination, not cursor-based
          // Continue if we have more pages based on the paging info
          const paging = response.paging;
          if (paging && paging.page !== undefined && paging.pages !== undefined && paging.page < paging.pages) {
            return `page-${paging.page + 1}`;
          }
          return undefined;
        },
        
        getItems: (response) => response.files || [],
        
        formatResponse: (data) => {
          const files = data.items.map((file: any) => ({
            id: file.id,
            name: file.name,
            title: file.title,
            filetype: file.filetype,
            size: file.size,
            url: file.url_private,
            downloadUrl: file.url_private_download,
            user: file.user,
            timestamp: file.timestamp,
            channels: file.channels,
          }));

          return {
            files,
            total: files.length,
            pageCount: data.pageCount,
            pagination: data.hasMore ? { hasMore: true } : null,
          };
        },
      });
    });

  /**
   * Get detailed information about a specific file
   */
  const getFileInfo = (args: unknown) =>
    deps.requestHandler.handle(GetFileInfoSchema, args, async (input) => {
      const client = deps.clientManager.getClientForOperation('read');

      const result = await client.files.info({
        file: input.file_id,
      });

      if (!result.file) {
        throw new SlackAPIError('File not found');
      }

      // Get file comments if requested
      let comments: any[] = [];
      if (input.include_comments) {
        try {
          // Note: files.comments is deprecated, skip for now
          comments = [];
        } catch {
          // Comments API not available or deprecated
          comments = [];
        }
      }

      return {
        id: result.file.id,
        name: result.file.name,
        title: result.file.title,
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
        comments:
          comments.length > 0
            ? comments.map(
                (comment: { id: string; user: string; comment: string; timestamp: number }) => ({
                  id: comment.id,
                  user: comment.user,
                  comment: comment.comment,
                  timestamp: comment.timestamp,
                })
              )
            : [],
      };
    });

  /**
   * Delete a file (where permitted)
   */
  const deleteFile = (args: unknown) =>
    deps.requestHandler.handle(DeleteFileSchema, args, async (input) => {
      const client = deps.clientManager.getClientForOperation('write');

      const result = await client.files.delete({
        file: input.file_id,
      });

      return {
        success: result.ok || false,
        fileId: input.file_id,
        message: result.ok ? 'File deleted successfully' : 'Failed to delete file',
      };
    });

  /**
   * Share an existing file to additional channels
   */
  const shareFile = (args: unknown) =>
    deps.requestHandler.handle(ShareFileSchema, args, async (input) => {
      const client = deps.clientManager.getClientForOperation('write');

      // First, get the file information to retrieve the permalink
      const fileInfo = await client.files.info({
        file: input.file_id,
      });

      if (!fileInfo.ok) {
        throw new Error(`Failed to get file information: ${fileInfo.error}`);
      }

      if (!fileInfo.file?.permalink) {
        throw new Error('File permalink not available');
      }

      // Share the file by posting its permalink to the channel
      const result = await client.chat.postMessage({
        channel: input.channel,
        text: `File shared: ${fileInfo.file.permalink}`,
        unfurl_links: true, // Enable link previews for the file
      });

      if (!result.ok) {
        throw new Error(`Failed to share file: ${result.error}`);
      }

      return {
        success: true,
        fileId: input.file_id,
        channel: input.channel,
        permalink: fileInfo.file.permalink,
        message: 'File shared successfully',
      };
    });

  /**
   * Analyze file types, sizes, and usage patterns in workspace
   */
  const analyzeFiles = (args: unknown) =>
    deps.requestHandler.handle(AnalyzeFilesSchema, args, async (input) => {
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
        return { analysis: null, message: 'No files found in the specified period' };
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
            timestamp: file.timestamp,
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

      return formatFileAnalysis(analysis, formatOptions);
    });

  /**
   * Search for files by name, type, or content
   */
  const searchFiles = (args: unknown) =>
    deps.requestHandler.handle(SearchFilesSchema, args, async (input) => {
      // Check if search API is available
      deps.clientManager.checkSearchApiAvailability(
        'searchFiles',
        'Use file listing with filters instead'
      );

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
        return { results: [], total: 0 };
      }

      return {
        results: searchResult.files.matches,
        total: searchResult.files.total || 0,
        query: searchQuery,
        pagination: searchResult.files.paging,
      };
    });

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
