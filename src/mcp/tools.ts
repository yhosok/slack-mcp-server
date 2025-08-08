/**
 * MCP tool definitions for Slack operations
 */

import type { MCPTool } from './types';

/**
 * Tool definition for sending messages to Slack
 */
export const SEND_MESSAGE_TOOL: MCPTool = {
  name: 'send_message',
  description: 'Send a message to a Slack channel or user',
  inputSchema: {
    type: 'object',
    properties: {
      channel: {
        type: 'string',
        description: 'Channel ID or user ID to send message to (e.g., #general, @username, or C1234567890)',
      },
      text: {
        type: 'string',
        description: 'Message text to send. Supports Slack markdown formatting.',
      },
      thread_ts: {
        type: 'string',
        description: 'Optional: Thread timestamp to reply to a specific message',
      },
    },
    required: ['channel', 'text'],
    additionalProperties: false,
  },
};

/**
 * Tool definition for listing channels
 */
export const LIST_CHANNELS_TOOL: MCPTool = {
  name: 'list_channels',
  description: 'List all channels in the Slack workspace',
  inputSchema: {
    type: 'object',
    properties: {
      types: {
        type: 'string',
        description: 'Comma-separated list of channel types to include',
        enum: [
          'public_channel',
          'private_channel',
          'mpim',
          'im',
          'public_channel,private_channel',
          'public_channel,private_channel,mpim,im',
        ],
        default: 'public_channel,private_channel',
      },
      exclude_archived: {
        type: 'boolean',
        description: 'Whether to exclude archived channels',
        default: true,
      },
    },
    additionalProperties: false,
  },
};

/**
 * Tool definition for getting channel history
 */
export const GET_CHANNEL_HISTORY_TOOL: MCPTool = {
  name: 'get_channel_history',
  description: 'Get message history from a Slack channel',
  inputSchema: {
    type: 'object',
    properties: {
      channel: {
        type: 'string',
        description: 'Channel ID to get history from (e.g., C1234567890)',
      },
      limit: {
        type: 'number',
        description: 'Number of messages to retrieve (1-100)',
        minimum: 1,
        maximum: 100,
        default: 10,
      },
      cursor: {
        type: 'string',
        description: 'Cursor for pagination (optional)',
      },
      oldest: {
        type: 'string',
        description: 'Start of time range (timestamp)',
      },
      latest: {
        type: 'string',
        description: 'End of time range (timestamp)',
      },
    },
    required: ['channel'],
    additionalProperties: false,
  },
};

/**
 * Tool definition for getting user information
 */
export const GET_USER_INFO_TOOL: MCPTool = {
  name: 'get_user_info',
  description: 'Get information about a Slack user',
  inputSchema: {
    type: 'object',
    properties: {
      user: {
        type: 'string',
        description: 'User ID to get information about (e.g., U1234567890)',
      },
    },
    required: ['user'],
    additionalProperties: false,
  },
};

/**
 * Tool definition for searching messages
 */
export const SEARCH_MESSAGES_TOOL: MCPTool = {
  name: 'search_messages',
  description: 'Search for messages in the Slack workspace',
  inputSchema: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description: 'Search query string',
      },
      sort: {
        type: 'string',
        description: 'Sort order for results',
        enum: ['score', 'timestamp'],
        default: 'score',
      },
      sort_dir: {
        type: 'string',
        description: 'Sort direction',
        enum: ['asc', 'desc'],
        default: 'desc',
      },
      count: {
        type: 'number',
        description: 'Number of results to return (1-100)',
        minimum: 1,
        maximum: 100,
        default: 20,
      },
    },
    required: ['query'],
    additionalProperties: false,
  },
};

/**
 * Tool definition for getting channel info
 */
export const GET_CHANNEL_INFO_TOOL: MCPTool = {
  name: 'get_channel_info',
  description: 'Get detailed information about a Slack channel',
  inputSchema: {
    type: 'object',
    properties: {
      channel: {
        type: 'string',
        description: 'Channel ID to get information about (e.g., C1234567890)',
      },
    },
    required: ['channel'],
    additionalProperties: false,
  },
};

// ================================
// THREAD MANAGEMENT TOOLS
// ================================

/**
 * Tool definition for finding threads in a channel
 */
export const FIND_THREADS_IN_CHANNEL_TOOL: MCPTool = {
  name: 'find_threads_in_channel',
  description: 'Find all threaded conversations in a specific channel',
  inputSchema: {
    type: 'object',
    properties: {
      channel: {
        type: 'string',
        description: 'Channel ID to search for threads (e.g., C1234567890)',
      },
      limit: {
        type: 'number',
        description: 'Maximum number of parent messages to examine (1-200)',
        minimum: 1,
        maximum: 200,
        default: 50,
      },
      cursor: {
        type: 'string',
        description: 'Pagination cursor for retrieving more results',
      },
      oldest: {
        type: 'string',
        description: 'Start of time range (timestamp)',
      },
      latest: {
        type: 'string',
        description: 'End of time range (timestamp)',
      },
      include_all_metadata: {
        type: 'boolean',
        description: 'Include additional metadata in response',
        default: false,
      },
    },
    required: ['channel'],
    additionalProperties: false,
  },
};

/**
 * Tool definition for getting thread replies
 */
export const GET_THREAD_REPLIES_TOOL: MCPTool = {
  name: 'get_thread_replies',
  description: 'Get complete thread content including parent message and all replies',
  inputSchema: {
    type: 'object',
    properties: {
      channel: {
        type: 'string',
        description: 'Channel ID where the thread exists (e.g., C1234567890)',
      },
      thread_ts: {
        type: 'string',
        description: 'Thread timestamp (parent message timestamp)',
      },
      limit: {
        type: 'number',
        description: 'Maximum number of messages to retrieve (1-1000)',
        minimum: 1,
        maximum: 1000,
        default: 100,
      },
      cursor: {
        type: 'string',
        description: 'Pagination cursor',
      },
      oldest: {
        type: 'string',
        description: 'Start of time range',
      },
      latest: {
        type: 'string',
        description: 'End of time range',
      },
      inclusive: {
        type: 'boolean',
        description: 'Include messages with matching timestamps',
        default: true,
      },
    },
    required: ['channel', 'thread_ts'],
    additionalProperties: false,
  },
};

/**
 * Tool definition for searching threads
 */
export const SEARCH_THREADS_TOOL: MCPTool = {
  name: 'search_threads',
  description: 'Search for threads by keywords, participants, or content',
  inputSchema: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description: 'Search query string',
      },
      channel: {
        type: 'string',
        description: 'Limit search to specific channel',
      },
      user: {
        type: 'string',
        description: 'Filter by messages from specific user',
      },
      after: {
        type: 'string',
        description: 'Search after this date (YYYY-MM-DD)',
      },
      before: {
        type: 'string',
        description: 'Search before this date (YYYY-MM-DD)',
      },
      sort: {
        type: 'string',
        description: 'Sort results by timestamp or relevance',
        enum: ['timestamp', 'relevance'],
        default: 'relevance',
      },
      sort_dir: {
        type: 'string',
        description: 'Sort direction',
        enum: ['asc', 'desc'],
        default: 'desc',
      },
      limit: {
        type: 'number',
        description: 'Maximum number of results (1-100)',
        minimum: 1,
        maximum: 100,
        default: 20,
      },
    },
    required: ['query'],
    additionalProperties: false,
  },
};

/**
 * Tool definition for analyzing threads
 */
export const ANALYZE_THREAD_TOOL: MCPTool = {
  name: 'analyze_thread',
  description: 'Analyze thread structure, participants, timeline, and extract key topics',
  inputSchema: {
    type: 'object',
    properties: {
      channel: {
        type: 'string',
        description: 'Channel ID where the thread exists',
      },
      thread_ts: {
        type: 'string',
        description: 'Thread timestamp to analyze',
      },
      include_sentiment_analysis: {
        type: 'boolean',
        description: 'Include sentiment analysis in results',
        default: true,
      },
      include_action_items: {
        type: 'boolean',
        description: 'Extract action items from thread',
        default: true,
      },
      include_timeline: {
        type: 'boolean',
        description: 'Include detailed timeline of events',
        default: true,
      },
      extract_topics: {
        type: 'boolean',
        description: 'Extract key topics and keywords',
        default: true,
      },
    },
    required: ['channel', 'thread_ts'],
    additionalProperties: false,
  },
};

/**
 * Tool definition for summarizing threads
 */
export const SUMMARIZE_THREAD_TOOL: MCPTool = {
  name: 'summarize_thread',
  description: 'Generate intelligent summary of thread content with key points and decisions',
  inputSchema: {
    type: 'object',
    properties: {
      channel: {
        type: 'string',
        description: 'Channel ID where the thread exists',
      },
      thread_ts: {
        type: 'string',
        description: 'Thread timestamp to summarize',
      },
      summary_length: {
        type: 'string',
        description: 'Desired summary length',
        enum: ['brief', 'detailed', 'comprehensive'],
        default: 'detailed',
      },
      include_action_items: {
        type: 'boolean',
        description: 'Include extracted action items',
        default: true,
      },
      include_decisions: {
        type: 'boolean',
        description: 'Include decisions made in the thread',
        default: true,
      },
      language: {
        type: 'string',
        description: 'Summary language (ISO 639-1 code)',
        default: 'en',
      },
    },
    required: ['channel', 'thread_ts'],
    additionalProperties: false,
  },
};

/**
 * Tool definition for posting thread replies
 */
export const POST_THREAD_REPLY_TOOL: MCPTool = {
  name: 'post_thread_reply',
  description: 'Post a reply to an existing thread',
  inputSchema: {
    type: 'object',
    properties: {
      channel: {
        type: 'string',
        description: 'Channel ID where the thread exists',
      },
      thread_ts: {
        type: 'string',
        description: 'Thread timestamp to reply to',
      },
      text: {
        type: 'string',
        description: 'Reply message text (supports Slack markdown)',
      },
      broadcast: {
        type: 'boolean',
        description: 'Broadcast reply to channel (deprecated, use reply_broadcast)',
        default: false,
      },
      reply_broadcast: {
        type: 'boolean',
        description: 'Broadcast reply to the channel',
        default: false,
      },
    },
    required: ['channel', 'thread_ts', 'text'],
    additionalProperties: false,
  },
};

/**
 * Tool definition for creating new threads
 */
export const CREATE_THREAD_TOOL: MCPTool = {
  name: 'create_thread',
  description: 'Create a new thread by posting a parent message and optional first reply',
  inputSchema: {
    type: 'object',
    properties: {
      channel: {
        type: 'string',
        description: 'Channel ID to create the thread in',
      },
      text: {
        type: 'string',
        description: 'Initial parent message text',
      },
      reply_text: {
        type: 'string',
        description: 'Optional first reply to start the thread',
      },
      broadcast: {
        type: 'boolean',
        description: 'Broadcast the initial reply to channel',
        default: false,
      },
    },
    required: ['channel', 'text'],
    additionalProperties: false,
  },
};

/**
 * Tool definition for marking threads as important
 */
export const MARK_THREAD_IMPORTANT_TOOL: MCPTool = {
  name: 'mark_thread_important',
  description: 'Mark a thread as important with reactions and notifications',
  inputSchema: {
    type: 'object',
    properties: {
      channel: {
        type: 'string',
        description: 'Channel ID where the thread exists',
      },
      thread_ts: {
        type: 'string',
        description: 'Thread timestamp to mark as important',
      },
      importance_level: {
        type: 'string',
        description: 'Level of importance',
        enum: ['low', 'medium', 'high', 'critical'],
        default: 'high',
      },
      reason: {
        type: 'string',
        description: 'Optional reason for marking as important',
      },
      notify_participants: {
        type: 'boolean',
        description: 'Notify all thread participants',
        default: false,
      },
    },
    required: ['channel', 'thread_ts'],
    additionalProperties: false,
  },
};

/**
 * Tool definition for extracting action items
 */
export const EXTRACT_ACTION_ITEMS_TOOL: MCPTool = {
  name: 'extract_action_items',
  description: 'Extract action items and tasks from thread messages',
  inputSchema: {
    type: 'object',
    properties: {
      channel: {
        type: 'string',
        description: 'Channel ID where the thread exists',
      },
      thread_ts: {
        type: 'string',
        description: 'Thread timestamp to analyze',
      },
      include_completed: {
        type: 'boolean',
        description: 'Include completed action items',
        default: false,
      },
      priority_threshold: {
        type: 'string',
        description: 'Minimum priority level to include',
        enum: ['low', 'medium', 'high'],
        default: 'low',
      },
      assign_priorities: {
        type: 'boolean',
        description: 'Automatically assign priorities based on content',
        default: true,
      },
    },
    required: ['channel', 'thread_ts'],
    additionalProperties: false,
  },
};

/**
 * Tool definition for identifying important threads
 */
export const IDENTIFY_IMPORTANT_THREADS_TOOL: MCPTool = {
  name: 'identify_important_threads',
  description: 'Identify important or urgent threads in a channel based on various criteria',
  inputSchema: {
    type: 'object',
    properties: {
      channel: {
        type: 'string',
        description: 'Channel ID to analyze',
      },
      time_range_hours: {
        type: 'number',
        description: 'Look back this many hours for threads (1-8760)',
        minimum: 1,
        maximum: 8760,
        default: 168,
      },
      importance_threshold: {
        type: 'number',
        description: 'Minimum importance score (0.0-1.0)',
        minimum: 0,
        maximum: 1,
        default: 0.7,
      },
      criteria: {
        type: 'array',
        description: 'Criteria to use for identifying important threads',
        items: {
          type: 'string',
          enum: ['participant_count', 'message_count', 'urgency_keywords', 'executive_involvement', 'mention_frequency'],
        },
      },
      limit: {
        type: 'number',
        description: 'Maximum number of threads to return (1-50)',
        minimum: 1,
        maximum: 50,
        default: 10,
      },
    },
    required: ['channel'],
    additionalProperties: false,
  },
};

/**
 * Tool definition for exporting thread content
 */
export const EXPORT_THREAD_TOOL: MCPTool = {
  name: 'export_thread',
  description: 'Export thread content in various formats (markdown, JSON, HTML, CSV)',
  inputSchema: {
    type: 'object',
    properties: {
      channel: {
        type: 'string',
        description: 'Channel ID where the thread exists',
      },
      thread_ts: {
        type: 'string',
        description: 'Thread timestamp to export',
      },
      format: {
        type: 'string',
        description: 'Export format',
        enum: ['markdown', 'json', 'html', 'csv'],
        default: 'markdown',
      },
      include_metadata: {
        type: 'boolean',
        description: 'Include message metadata (timestamps, user IDs)',
        default: true,
      },
      include_reactions: {
        type: 'boolean',
        description: 'Include message reactions',
        default: true,
      },
      include_user_profiles: {
        type: 'boolean',
        description: 'Include detailed user profile information',
        default: false,
      },
      date_format: {
        type: 'string',
        description: 'Date format for timestamps',
        default: 'ISO',
      },
    },
    required: ['channel', 'thread_ts'],
    additionalProperties: false,
  },
};

/**
 * Tool definition for finding related threads
 */
export const FIND_RELATED_THREADS_TOOL: MCPTool = {
  name: 'find_related_threads',
  description: 'Find threads related to a given thread based on content, participants, or topics',
  inputSchema: {
    type: 'object',
    properties: {
      channel: {
        type: 'string',
        description: 'Channel ID of the reference thread',
      },
      thread_ts: {
        type: 'string',
        description: 'Reference thread timestamp',
      },
      similarity_threshold: {
        type: 'number',
        description: 'Minimum similarity score (0.0-1.0)',
        minimum: 0,
        maximum: 1,
        default: 0.3,
      },
      max_results: {
        type: 'number',
        description: 'Maximum number of related threads to return (1-50)',
        minimum: 1,
        maximum: 50,
        default: 10,
      },
      include_cross_channel: {
        type: 'boolean',
        description: 'Include threads from other channels',
        default: false,
      },
      relationship_types: {
        type: 'array',
        description: 'Types of relationships to consider',
        items: {
          type: 'string',
          enum: ['keyword_overlap', 'participant_overlap', 'temporal_proximity', 'topic_similarity'],
        },
      },
    },
    required: ['channel', 'thread_ts'],
    additionalProperties: false,
  },
};

/**
 * Tool definition for getting thread metrics
 */
export const GET_THREAD_METRICS_TOOL: MCPTool = {
  name: 'get_thread_metrics',
  description: 'Get statistics and metrics about threads in a channel or workspace',
  inputSchema: {
    type: 'object',
    properties: {
      channel: {
        type: 'string',
        description: 'Channel ID to analyze (optional, all channels if omitted)',
      },
      user: {
        type: 'string',
        description: 'Filter metrics for specific user',
      },
      after: {
        type: 'string',
        description: 'Start date for metrics (YYYY-MM-DD)',
      },
      before: {
        type: 'string',
        description: 'End date for metrics (YYYY-MM-DD)',
      },
      include_activity_patterns: {
        type: 'boolean',
        description: 'Include activity patterns by time of day',
        default: true,
      },
      include_participant_stats: {
        type: 'boolean',
        description: 'Include top participants statistics',
        default: true,
      },
      time_zone: {
        type: 'string',
        description: 'Timezone for activity patterns',
        default: 'UTC',
      },
    },
    additionalProperties: false,
  },
};

/**
 * Tool definition for getting threads by participants
 */
export const GET_THREADS_BY_PARTICIPANTS_TOOL: MCPTool = {
  name: 'get_threads_by_participants',
  description: 'Find threads that include specific participants',
  inputSchema: {
    type: 'object',
    properties: {
      participants: {
        type: 'array',
        description: 'User IDs of participants to search for',
        items: {
          type: 'string',
        },
        minItems: 1,
      },
      channel: {
        type: 'string',
        description: 'Limit search to specific channel',
      },
      after: {
        type: 'string',
        description: 'Search after this date (YYYY-MM-DD)',
      },
      before: {
        type: 'string',
        description: 'Search before this date (YYYY-MM-DD)',
      },
      limit: {
        type: 'number',
        description: 'Maximum number of threads to return (1-100)',
        minimum: 1,
        maximum: 100,
        default: 20,
      },
      require_all_participants: {
        type: 'boolean',
        description: 'Require ALL participants to be in thread (vs ANY)',
        default: false,
      },
    },
    required: ['participants'],
    additionalProperties: false,
  },
};

// ================================
// FILE OPERATION TOOLS
// ================================

/**
 * Tool definition for uploading files
 */
export const UPLOAD_FILE_TOOL: MCPTool = {
  name: 'upload_file',
  description: 'Upload a file to Slack channels or threads',
  inputSchema: {
    type: 'object',
    properties: {
      file_path: {
        type: 'string',
        description: 'Local path to the file to upload',
      },
      filename: {
        type: 'string',
        description: 'Optional filename to use (defaults to original filename)',
      },
      title: {
        type: 'string',
        description: 'Optional title for the file',
      },
      channels: {
        type: 'array',
        items: { type: 'string' },
        description: 'Channels to share the file to (channel IDs)',
      },
      initial_comment: {
        type: 'string',
        description: 'Optional initial comment for the file',
      },
      thread_ts: {
        type: 'string',
        description: 'Optional thread timestamp to upload to a thread',
      },
    },
    required: ['file_path'],
    additionalProperties: false,
  },
};

/**
 * Tool definition for listing files
 */
export const LIST_FILES_TOOL: MCPTool = {
  name: 'list_files',
  description: 'List files in workspace with filtering options',
  inputSchema: {
    type: 'object',
    properties: {
      user: {
        type: 'string',
        description: 'Filter by user who uploaded the file',
      },
      channel: {
        type: 'string',
        description: 'Filter by channel where file was shared',
      },
      types: {
        type: 'string',
        description: 'Comma-separated list of file types to include (e.g., "images,pdfs")',
      },
      ts_from: {
        type: 'string',
        description: 'Filter files created after this timestamp',
      },
      ts_to: {
        type: 'string',
        description: 'Filter files created before this timestamp',
      },
      count: {
        type: 'number',
        description: 'Number of files to return (1-1000)',
        minimum: 1,
        maximum: 1000,
        default: 100,
      },
      page: {
        type: 'number',
        description: 'Page number for pagination',
        minimum: 1,
        default: 1,
      },
    },
    additionalProperties: false,
  },
};

/**
 * Tool definition for getting file info
 */
export const GET_FILE_INFO_TOOL: MCPTool = {
  name: 'get_file_info',
  description: 'Get detailed information about a specific file',
  inputSchema: {
    type: 'object',
    properties: {
      file_id: {
        type: 'string',
        description: 'File ID to get information about',
      },
      include_comments: {
        type: 'boolean',
        description: 'Include file comments in response',
        default: false,
      },
    },
    required: ['file_id'],
    additionalProperties: false,
  },
};

/**
 * Tool definition for deleting files
 */
export const DELETE_FILE_TOOL: MCPTool = {
  name: 'delete_file',
  description: 'Delete a file (where permitted)',
  inputSchema: {
    type: 'object',
    properties: {
      file_id: {
        type: 'string',
        description: 'File ID to delete',
      },
    },
    required: ['file_id'],
    additionalProperties: false,
  },
};

/**
 * Tool definition for sharing files to additional channels
 */
export const SHARE_FILE_TOOL: MCPTool = {
  name: 'share_file',
  description: 'Share an existing file to additional channels',
  inputSchema: {
    type: 'object',
    properties: {
      file_id: {
        type: 'string',
        description: 'File ID to share',
      },
      channel: {
        type: 'string',
        description: 'Channel ID to share the file to',
      },
    },
    required: ['file_id', 'channel'],
    additionalProperties: false,
  },
};

/**
 * Tool definition for analyzing files in workspace
 */
export const ANALYZE_FILES_TOOL: MCPTool = {
  name: 'analyze_files',
  description: 'Analyze file types, sizes, and usage patterns in workspace',
  inputSchema: {
    type: 'object',
    properties: {
      channel: {
        type: 'string',
        description: 'Limit analysis to specific channel',
      },
      user: {
        type: 'string',
        description: 'Limit analysis to specific user',
      },
      days_back: {
        type: 'number',
        description: 'Number of days back to analyze (1-365)',
        minimum: 1,
        maximum: 365,
        default: 30,
      },
      include_large_files: {
        type: 'boolean',
        description: 'Include analysis of large files (>10MB)',
        default: true,
      },
      size_threshold_mb: {
        type: 'number',
        description: 'Size threshold in MB for identifying large files',
        default: 10,
      },
    },
    additionalProperties: false,
  },
};

/**
 * Tool definition for searching files
 */
export const SEARCH_FILES_TOOL: MCPTool = {
  name: 'search_files',
  description: 'Search for files by name, type, or content',
  inputSchema: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description: 'Search query (filename, content, or keywords)',
      },
      types: {
        type: 'string',
        description: 'Comma-separated file types to search',
      },
      user: {
        type: 'string',
        description: 'Filter by user who uploaded',
      },
      channel: {
        type: 'string',
        description: 'Filter by channel where shared',
      },
      after: {
        type: 'string',
        description: 'Search files after date (YYYY-MM-DD)',
      },
      before: {
        type: 'string',
        description: 'Search files before date (YYYY-MM-DD)',
      },
      count: {
        type: 'number',
        description: 'Number of results to return (1-100)',
        minimum: 1,
        maximum: 100,
        default: 20,
      },
    },
    required: ['query'],
    additionalProperties: false,
  },
};

// ================================
// REACTION MANAGEMENT TOOLS
// ================================

/**
 * Tool definition for adding reactions
 */
export const ADD_REACTION_TOOL: MCPTool = {
  name: 'add_reaction',
  description: 'Add a reaction emoji to a message',
  inputSchema: {
    type: 'object',
    properties: {
      channel: {
        type: 'string',
        description: 'Channel where the message is located',
      },
      message_ts: {
        type: 'string',
        description: 'Timestamp of the message to react to',
      },
      reaction_name: {
        type: 'string',
        description: 'Name of reaction emoji (without colons, e.g., "thumbsup")',
      },
    },
    required: ['channel', 'message_ts', 'reaction_name'],
    additionalProperties: false,
  },
};

/**
 * Tool definition for removing reactions
 */
export const REMOVE_REACTION_TOOL: MCPTool = {
  name: 'remove_reaction',
  description: 'Remove a reaction emoji from a message',
  inputSchema: {
    type: 'object',
    properties: {
      channel: {
        type: 'string',
        description: 'Channel where the message is located',
      },
      message_ts: {
        type: 'string',
        description: 'Timestamp of the message to remove reaction from',
      },
      reaction_name: {
        type: 'string',
        description: 'Name of reaction emoji to remove (without colons)',
      },
    },
    required: ['channel', 'message_ts', 'reaction_name'],
    additionalProperties: false,
  },
};

/**
 * Tool definition for getting message reactions
 */
export const GET_REACTIONS_TOOL: MCPTool = {
  name: 'get_reactions',
  description: 'Get all reactions on a specific message',
  inputSchema: {
    type: 'object',
    properties: {
      channel: {
        type: 'string',
        description: 'Channel where the message is located',
      },
      message_ts: {
        type: 'string',
        description: 'Timestamp of the message to get reactions for',
      },
      full: {
        type: 'boolean',
        description: 'Include full user info for reaction users',
        default: false,
      },
    },
    required: ['channel', 'message_ts'],
    additionalProperties: false,
  },
};

/**
 * Tool definition for reaction statistics
 */
export const GET_REACTION_STATISTICS_TOOL: MCPTool = {
  name: 'get_reaction_statistics',
  description: 'Get reaction statistics and trends for workspace or channel',
  inputSchema: {
    type: 'object',
    properties: {
      channel: {
        type: 'string',
        description: 'Limit statistics to specific channel',
      },
      user: {
        type: 'string',
        description: 'Limit statistics to specific user',
      },
      days_back: {
        type: 'number',
        description: 'Number of days back to analyze (1-365)',
        minimum: 1,
        maximum: 365,
        default: 30,
      },
      include_trends: {
        type: 'boolean',
        description: 'Include daily trends analysis',
        default: true,
      },
      top_count: {
        type: 'number',
        description: 'Number of top reactions/users to include',
        default: 10,
      },
    },
    additionalProperties: false,
  },
};

/**
 * Tool definition for finding messages by reactions
 */
export const FIND_MESSAGES_BY_REACTIONS_TOOL: MCPTool = {
  name: 'find_messages_by_reactions',
  description: 'Find messages that have specific reaction patterns',
  inputSchema: {
    type: 'object',
    properties: {
      reactions: {
        type: 'array',
        items: { type: 'string' },
        description: 'Reaction names to search for',
        minItems: 1,
      },
      channel: {
        type: 'string',
        description: 'Limit search to specific channel',
      },
      match_type: {
        type: 'string',
        enum: ['any', 'all'],
        description: 'Match any of the reactions or all of them',
        default: 'any',
      },
      min_reaction_count: {
        type: 'number',
        description: 'Minimum total reactions required',
        default: 1,
      },
      after: {
        type: 'string',
        description: 'Search messages after date (YYYY-MM-DD)',
      },
      before: {
        type: 'string',
        description: 'Search messages before date (YYYY-MM-DD)',
      },
      limit: {
        type: 'number',
        description: 'Maximum number of messages to return (1-100)',
        minimum: 1,
        maximum: 100,
        default: 20,
      },
    },
    required: ['reactions'],
    additionalProperties: false,
  },
};

// ================================
// WORKSPACE MANAGEMENT TOOLS
// ================================

/**
 * Tool definition for getting workspace info
 */
export const GET_WORKSPACE_INFO_TOOL: MCPTool = {
  name: 'get_workspace_info',
  description: 'Get workspace/team information and settings',
  inputSchema: {
    type: 'object',
    properties: {},
    additionalProperties: false,
  },
};

/**
 * Tool definition for listing team members
 */
export const LIST_TEAM_MEMBERS_TOOL: MCPTool = {
  name: 'list_team_members',
  description: 'List all team members with their roles and status',
  inputSchema: {
    type: 'object',
    properties: {
      include_deleted: {
        type: 'boolean',
        description: 'Include deleted users in results',
        default: false,
      },
      include_bots: {
        type: 'boolean',
        description: 'Include bot users in results',
        default: true,
      },
      cursor: {
        type: 'string',
        description: 'Pagination cursor',
      },
      limit: {
        type: 'number',
        description: 'Maximum number of members to return (1-200)',
        minimum: 1,
        maximum: 200,
        default: 100,
      },
    },
    additionalProperties: false,
  },
};

// ================================
// ANALYTICS AND REPORTING TOOLS
// ================================

/**
 * Tool definition for workspace activity reports
 */
export const GET_WORKSPACE_ACTIVITY_TOOL: MCPTool = {
  name: 'get_workspace_activity',
  description: 'Generate comprehensive workspace activity report',
  inputSchema: {
    type: 'object',
    properties: {
      start_date: {
        type: 'string',
        description: 'Start date for report (YYYY-MM-DD)',
      },
      end_date: {
        type: 'string',
        description: 'End date for report (YYYY-MM-DD)',
      },
      include_user_details: {
        type: 'boolean',
        description: 'Include detailed user activity breakdown',
        default: true,
      },
      include_channel_details: {
        type: 'boolean',
        description: 'Include detailed channel activity breakdown',
        default: true,
      },
      top_count: {
        type: 'number',
        description: 'Number of top users/channels to include',
        default: 10,
      },
    },
    additionalProperties: false,
  },
};

/**
 * Tool definition for server health monitoring
 */
export const GET_SERVER_HEALTH_TOOL: MCPTool = {
  name: 'get_server_health',
  description: 'Get MCP server health status and performance metrics',
  inputSchema: {
    type: 'object',
    properties: {
      include_rate_limits: {
        type: 'boolean',
        description: 'Include current rate limit status',
        default: true,
      },
      include_response_times: {
        type: 'boolean',
        description: 'Include API response time statistics',
        default: true,
      },
    },
    additionalProperties: false,
  },
};

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