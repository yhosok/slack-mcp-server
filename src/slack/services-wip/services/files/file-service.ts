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
        throw new SlackAPIError(`Failed to read file: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
      
      // Extract filename from path if not provided
      const filename = input.filename || input.file_path.split('/').pop() || 'uploaded-file';
      
      const uploadOptions = {
        channels: input.channels ? input.channels.join(',') : undefined,
        filename,
        file: fileContent,
        title: input.title,
        initial_comment: input.initial_comment,
        thread_ts: input.thread_ts,
      };
      
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
        files: result.files.map(file => ({
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
      let comments = [];
      if (input.include_comments) {
        const commentsResult = await client.files.comments({
          file: input.file_id,
        });
        comments = commentsResult.comments || [];
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
        comments: comments.length > 0 ? comments.map((comment: any) => ({
          id: comment.id,
          user: comment.user,
          comment: comment.comment,
          timestamp: comment.timestamp,
        })) : [],
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
      
      const result = await client.files.share({
        file: input.file_id,
        channel: input.channel,
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
        totalFiles: files.length,
        totalSize: 0,
        averageSize: 0,
        typeBreakdown: new Map<string, { count: number; size: number }>(),
        sizeDistribution: {
          small: 0,    // < 1MB
          medium: 0,   // 1MB - 10MB
          large: 0,    // 10MB - 100MB
          extraLarge: 0, // > 100MB
        },
        uploadTrends: new Map<string, number>(),
        topUsers: new Map<string, { count: number; size: number }>(),
        largeFiles: [] as any[],
      };

      for (const file of files) {
        const size = file.size || 0;
        analysis.totalSize += size;
        
        // Type breakdown
        const type = file.filetype || 'unknown';
        const typeStats = analysis.typeBreakdown.get(type) || { count: 0, size: 0 };
        typeStats.count++;
        typeStats.size += size;
        analysis.typeBreakdown.set(type, typeStats);
        
        // Size distribution
        const sizeMB = size / (1024 * 1024);
        if (sizeMB < 1) analysis.sizeDistribution.small++;
        else if (sizeMB < 10) analysis.sizeDistribution.medium++;
        else if (sizeMB < 100) analysis.sizeDistribution.large++;
        else analysis.sizeDistribution.extraLarge++;
        
        // Upload trends (by day)
        if (file.timestamp) {
          const date = new Date(file.timestamp * 1000).toISOString().split('T')[0];
          analysis.uploadTrends.set(date, (analysis.uploadTrends.get(date) || 0) + 1);
        }
        
        // Top users
        if (file.user) {
          const userStats = analysis.topUsers.get(file.user) || { count: 0, size: 0 };
          userStats.count++;
          userStats.size += size;
          analysis.topUsers.set(file.user, userStats);
        }
        
        // Large files
        const thresholdMB = input.size_threshold_mb || 10;
        if (sizeMB > thresholdMB) {
          analysis.largeFiles.push({
            id: file.id,
            name: file.name,
            size: size,
            sizeMB: Math.round(sizeMB * 10) / 10,
            type: type,
            user: file.user,
            timestamp: file.timestamp,
          });
        }
      }
      
      analysis.averageSize = analysis.totalFiles > 0 ? analysis.totalSize / analysis.totalFiles : 0;
      analysis.largeFiles.sort((a, b) => b.size - a.size);

      const formatOptions = {
        includeLargeFiles: input.include_large_files !== false,
        sizeThresholdMB: input.size_threshold_mb || 10,
      };

      return formatFileAnalysis(analysis, formatOptions);
    });

  /**
   * Search for files by name, type, or content
   */
  const searchFiles = (args: unknown) =>
    deps.requestHandler.handle(SearchFilesSchema, args, async (input) => {
      // Check if search API is available
      deps.clientManager.checkSearchApiAvailability();
      
      const client = deps.clientManager.getClientForOperation('read');
      
      // Build search query
      let searchQuery = input.query;
      
      // Add file type filter if specified
      if (input.types) {
        const types = input.types.split(',').map(t => `filetype:${t.trim()}`).join(' OR ');
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