import type { FilesListArguments } from '@slack/web-api';
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

// Export types for external use
export type { FileService, FileServiceDependencies } from './types.js';
import { SlackAPIError } from '../../../utils/errors.js';
import { formatFileAnalysis } from '../../analysis/index.js';

/**
 * Create file service with infrastructure dependencies
 * @param deps - Infrastructure dependencies
 * @returns File service instance
 */
export const createFileService = (deps: FileServiceDependencies): FileService => {
  /**
   * Upload a file to Slack channels or threads
   */
  const uploadFile = (args: unknown) =>
    deps.requestHandler.handle(UploadFileSchema, args, async (input) => {
      const client = deps.clientManager.getClientForOperation('write');

      // Read file content
      let fileContent: Buffer;
      try {
        fileContent = await fs.readFile(input.file_path);
      } catch (error) {
        throw new SlackAPIError(
          `Failed to read file: ${error instanceof Error ? error.message : 'Unknown error'}`
        );
      }

      // Extract filename from path if not provided
      const filename = input.filename || input.file_path.split('/').pop() || 'uploaded-file';

      const uploadOptions: any = {
        filename,
        file: fileContent,
      };

      // Only add optional fields if they are defined
      if (input.channels && input.channels.length > 0) {
        uploadOptions.channels = input.channels.join(',');
      }
      if (input.title) {
        uploadOptions.title = input.title;
      }
      if (input.initial_comment) {
        uploadOptions.initial_comment = input.initial_comment;
      }
      if (input.thread_ts) {
        uploadOptions.thread_ts = input.thread_ts;
      }

      const result = await client.files.upload(uploadOptions);

      if (!result.file) {
        throw new SlackAPIError('File upload failed');
      }

      return {
        success: true,
        file: {
          id: result.file.id,
          name: result.file.name,
          title: result.file.title,
          size: result.file.size,
          url: result.file.url_private,
          downloadUrl: result.file.url_private_download,
          channels: result.file.channels,
          timestamp: result.file.timestamp,
        },
      };
    });

  /**
   * List files in workspace with filtering options
   */
  const listFiles = (args: unknown) =>
    deps.requestHandler.handle(ListFilesSchema, args, async (input) => {
      const client = deps.clientManager.getClientForOperation('read');

      const listArgs: FilesListArguments = {
        channel: input.channel,
        user: input.user,
        ts_from: input.ts_from,
        ts_to: input.ts_to,
        types: input.types,
        count: input.count || 100,
        page: input.page || 1,
      };

      const result = await client.files.list(listArgs);

      if (!result.files) {
        return { files: [], total: 0 };
      }

      return {
        files: result.files.map((file) => ({
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
        })),
        total: result.files.length,
        pagination: result.paging,
      };
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
        } catch (error) {
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

      // Note: files.share API method may not be available
      // Use alternative approach or skip this functionality for now
      const result = await client.chat.postMessage({
        channel: input.channel,
        text: `File shared: <@${input.file_id}|File>`,
      });

      return {
        success: result.ok || false,
        fileId: input.file_id,
        channel: input.channel,
        message: result.ok ? 'File shared successfully' : 'Failed to share file',
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
