/**
 * MCP tool definitions for Slack operations
 */

import type { MCPTool } from './types.js';
import { defineSlackTool } from './schema-converter.js';
import {
  SendMessageSchema,
  ListChannelsSchema,
  GetChannelHistorySchema,
  GetUserInfoSchema,
  SearchMessagesSchema,
  GetChannelInfoSchema,
  FindThreadsInChannelSchema,
  GetThreadRepliesSchema,
  SearchThreadsSchema,
  AnalyzeThreadSchema,
  SummarizeThreadSchema,
  PostThreadReplySchema,
  CreateThreadSchema,
  MarkThreadImportantSchema,
  ExtractActionItemsSchema,
  IdentifyImportantThreadsSchema,
  ExportThreadSchema,
  FindRelatedThreadsSchema,
  GetThreadMetricsSchema,
  GetThreadsByParticipantsSchema,
  UploadFileSchema,
  ListFilesSchema,
  GetFileInfoSchema,
  DeleteFileSchema,
  ShareFileSchema,
  AnalyzeFilesSchema,
  SearchFilesSchema,
  GetMessageImagesSchema,
  AddReactionSchema,
  RemoveReactionSchema,
  GetReactionsSchema,
  GetReactionStatisticsSchema,
  FindMessagesByReactionsSchema,
  GetWorkspaceInfoSchema,
  ListTeamMembersSchema,
  GetWorkspaceActivitySchema,
  GetServerHealthSchema,
} from '../utils/validation.js';

export const SEND_MESSAGE_TOOL: MCPTool = defineSlackTool(
  'send_message',
  'Send a message to a Slack channel or user',
  SendMessageSchema
);

export const LIST_CHANNELS_TOOL: MCPTool = defineSlackTool(
  'list_channels',
  'List all channels in the Slack workspace',
  ListChannelsSchema
);

export const GET_CHANNEL_HISTORY_TOOL: MCPTool = defineSlackTool(
  'get_channel_history',
  'Get message history from a Slack channel',
  GetChannelHistorySchema
);

export const GET_USER_INFO_TOOL: MCPTool = defineSlackTool(
  'get_user_info',
  'Get information about a Slack user',
  GetUserInfoSchema
);

export const SEARCH_MESSAGES_TOOL: MCPTool = defineSlackTool(
  'search_messages',
  'Search for messages in the Slack workspace',
  SearchMessagesSchema
);

export const GET_CHANNEL_INFO_TOOL: MCPTool = defineSlackTool(
  'get_channel_info',
  'Get detailed information about a Slack channel',
  GetChannelInfoSchema
);

// ================================
// THREAD MANAGEMENT TOOLS
// ================================

export const FIND_THREADS_IN_CHANNEL_TOOL: MCPTool = defineSlackTool(
  'find_threads_in_channel',
  'Find all threaded conversations in a specific channel',
  FindThreadsInChannelSchema
);

export const GET_THREAD_REPLIES_TOOL: MCPTool = defineSlackTool(
  'get_thread_replies',
  'Get complete thread content including parent message and all replies',
  GetThreadRepliesSchema
);

export const SEARCH_THREADS_TOOL: MCPTool = defineSlackTool(
  'search_threads',
  'Search for threads by keywords, participants, or content',
  SearchThreadsSchema
);

export const ANALYZE_THREAD_TOOL: MCPTool = defineSlackTool(
  'analyze_thread',
  'Analyze thread structure, participants, timeline, and extract key topics',
  AnalyzeThreadSchema
);

export const SUMMARIZE_THREAD_TOOL: MCPTool = defineSlackTool(
  'summarize_thread',
  'Generate intelligent summary of thread content with key points and decisions',
  SummarizeThreadSchema
);

export const POST_THREAD_REPLY_TOOL: MCPTool = defineSlackTool(
  'post_thread_reply',
  'Post a reply to an existing thread',
  PostThreadReplySchema
);

export const CREATE_THREAD_TOOL: MCPTool = defineSlackTool(
  'create_thread',
  'Create a new thread by posting a parent message and optional first reply',
  CreateThreadSchema
);

export const MARK_THREAD_IMPORTANT_TOOL: MCPTool = defineSlackTool(
  'mark_thread_important',
  'Mark a thread as important with reactions and notifications',
  MarkThreadImportantSchema
);

export const EXTRACT_ACTION_ITEMS_TOOL: MCPTool = defineSlackTool(
  'extract_action_items',
  'Extract action items and tasks from thread messages',
  ExtractActionItemsSchema
);

export const IDENTIFY_IMPORTANT_THREADS_TOOL: MCPTool = defineSlackTool(
  'identify_important_threads',
  'Identify important or urgent threads in a channel based on various criteria',
  IdentifyImportantThreadsSchema
);

export const EXPORT_THREAD_TOOL: MCPTool = defineSlackTool(
  'export_thread',
  'Export thread content in various formats (markdown, JSON, HTML, CSV)',
  ExportThreadSchema
);

export const FIND_RELATED_THREADS_TOOL: MCPTool = defineSlackTool(
  'find_related_threads',
  'Find threads related to a given thread based on content, participants, or topics',
  FindRelatedThreadsSchema
);

export const GET_THREAD_METRICS_TOOL: MCPTool = defineSlackTool(
  'get_thread_metrics',
  'Get statistics and metrics about threads in a channel or workspace',
  GetThreadMetricsSchema
);

export const GET_THREADS_BY_PARTICIPANTS_TOOL: MCPTool = defineSlackTool(
  'get_threads_by_participants',
  'Find threads that include specific participants',
  GetThreadsByParticipantsSchema
);

// ================================
// FILE OPERATION TOOLS
// ================================

export const UPLOAD_FILE_TOOL: MCPTool = defineSlackTool(
  'upload_file',
  'Upload a file to Slack channels or threads',
  UploadFileSchema
);

export const LIST_FILES_TOOL: MCPTool = defineSlackTool(
  'list_files',
  'List files in workspace with filtering options',
  ListFilesSchema
);

export const GET_FILE_INFO_TOOL: MCPTool = defineSlackTool(
  'get_file_info',
  'Get detailed information about a specific file',
  GetFileInfoSchema
);

export const DELETE_FILE_TOOL: MCPTool = defineSlackTool(
  'delete_file',
  'Delete a file (where permitted)',
  DeleteFileSchema
);

export const SHARE_FILE_TOOL: MCPTool = defineSlackTool(
  'share_file',
  'Share an existing file to additional channels',
  ShareFileSchema
);

export const ANALYZE_FILES_TOOL: MCPTool = defineSlackTool(
  'analyze_files',
  'Analyze file types, sizes, and usage patterns in workspace',
  AnalyzeFilesSchema
);

export const SEARCH_FILES_TOOL: MCPTool = defineSlackTool(
  'search_files',
  'Search for files by name, type, or content',
  SearchFilesSchema
);

export const GET_MESSAGE_IMAGES_TOOL: MCPTool = defineSlackTool(
  'get_message_images',
  'Get all images from a specific message',
  GetMessageImagesSchema
);

// ================================
// REACTION MANAGEMENT TOOLS
// ================================

export const ADD_REACTION_TOOL: MCPTool = defineSlackTool(
  'add_reaction',
  'Add a reaction emoji to a message',
  AddReactionSchema
);

export const REMOVE_REACTION_TOOL: MCPTool = defineSlackTool(
  'remove_reaction',
  'Remove a reaction emoji from a message',
  RemoveReactionSchema
);

export const GET_REACTIONS_TOOL: MCPTool = defineSlackTool(
  'get_reactions',
  'Get all reactions on a specific message',
  GetReactionsSchema
);

export const GET_REACTION_STATISTICS_TOOL: MCPTool = defineSlackTool(
  'get_reaction_statistics',
  'Get reaction statistics and trends for workspace or channel',
  GetReactionStatisticsSchema
);

export const FIND_MESSAGES_BY_REACTIONS_TOOL: MCPTool = defineSlackTool(
  'find_messages_by_reactions',
  'Find messages that have specific reaction patterns',
  FindMessagesByReactionsSchema
);

// ================================
// WORKSPACE MANAGEMENT TOOLS
// ================================

export const GET_WORKSPACE_INFO_TOOL: MCPTool = defineSlackTool(
  'get_workspace_info',
  'Get workspace/team information and settings',
  GetWorkspaceInfoSchema
);

export const LIST_TEAM_MEMBERS_TOOL: MCPTool = defineSlackTool(
  'list_team_members',
  'List all team members with their roles and status',
  ListTeamMembersSchema
);

// ================================
// ANALYTICS AND REPORTING TOOLS
// ================================

export const GET_WORKSPACE_ACTIVITY_TOOL: MCPTool = defineSlackTool(
  'get_workspace_activity',
  'Generate comprehensive workspace activity report',
  GetWorkspaceActivitySchema
);

export const GET_SERVER_HEALTH_TOOL: MCPTool = defineSlackTool(
  'get_server_health',
  'Get MCP server health status and performance metrics',
  GetServerHealthSchema
);

/**
 * Array of all available tools
 */
export const ALL_TOOLS: MCPTool[] = [
  // Original tools
  SEND_MESSAGE_TOOL,
  LIST_CHANNELS_TOOL,
  GET_CHANNEL_HISTORY_TOOL,
  GET_USER_INFO_TOOL,
  SEARCH_MESSAGES_TOOL,
  GET_CHANNEL_INFO_TOOL,

  // Thread management tools
  FIND_THREADS_IN_CHANNEL_TOOL,
  GET_THREAD_REPLIES_TOOL,
  SEARCH_THREADS_TOOL,
  ANALYZE_THREAD_TOOL,
  SUMMARIZE_THREAD_TOOL,
  POST_THREAD_REPLY_TOOL,
  CREATE_THREAD_TOOL,
  MARK_THREAD_IMPORTANT_TOOL,
  EXTRACT_ACTION_ITEMS_TOOL,
  IDENTIFY_IMPORTANT_THREADS_TOOL,
  EXPORT_THREAD_TOOL,
  FIND_RELATED_THREADS_TOOL,
  GET_THREAD_METRICS_TOOL,
  GET_THREADS_BY_PARTICIPANTS_TOOL,

  // File operation tools
  UPLOAD_FILE_TOOL,
  LIST_FILES_TOOL,
  GET_FILE_INFO_TOOL,
  DELETE_FILE_TOOL,
  SHARE_FILE_TOOL,
  ANALYZE_FILES_TOOL,
  SEARCH_FILES_TOOL,
  GET_MESSAGE_IMAGES_TOOL,

  // Reaction management tools
  ADD_REACTION_TOOL,
  REMOVE_REACTION_TOOL,
  GET_REACTIONS_TOOL,
  GET_REACTION_STATISTICS_TOOL,
  FIND_MESSAGES_BY_REACTIONS_TOOL,

  // Workspace management tools
  GET_WORKSPACE_INFO_TOOL,
  LIST_TEAM_MEMBERS_TOOL,

  // Analytics and reporting tools
  GET_WORKSPACE_ACTIVITY_TOOL,
  GET_SERVER_HEALTH_TOOL,
];
