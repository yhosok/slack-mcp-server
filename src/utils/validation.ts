import { z } from 'zod';

/**
 * Validation schemas for Slack API requests
 */

export const SendMessageSchema = z.object({
  channel: z.string().min(1, 'Channel is required'),
  text: z.string().min(1, 'Message text is required'),
  thread_ts: z.string().optional(),
});

export const ListChannelsSchema = z.object({
  types: z.string().optional().default('public_channel,private_channel'),
});

export const GetChannelHistorySchema = z.object({
  channel: z.string().min(1, 'Channel is required'),
  limit: z.number().min(1).max(100).optional().default(10),
});

export const GetUserInfoSchema = z.object({
  user: z.string().min(1, 'User ID is required'),
});

export const SearchMessagesSchema = z.object({
  query: z.string().min(1, 'Search query is required'),
  sort: z.enum(['score', 'timestamp']).optional().default('score'),
  sort_dir: z.enum(['asc', 'desc']).optional().default('desc'),
  count: z.number().min(1).max(100).optional().default(20),
  page: z.number().min(1).max(100).optional().default(1),
  highlight: z.boolean().optional().default(false),
});

export const GetChannelInfoSchema = z.object({
  channel: z.string().min(1, 'Channel ID is required'),
});

/**
 * Thread-specific validation schemas
 */
export const FindThreadsInChannelSchema = z.object({
  channel: z.string().min(1, 'Channel ID is required'),
  limit: z.number().min(1).max(200).optional().default(50),
  cursor: z.string().optional(),
  oldest: z.string().optional(),
  latest: z.string().optional(),
  include_all_metadata: z.boolean().optional().default(false),
});

export const GetThreadRepliesSchema = z.object({
  channel: z.string().min(1, 'Channel ID is required'),
  thread_ts: z.string().min(1, 'Thread timestamp is required'),
  limit: z.number().min(1).max(1000).optional().default(100),
  cursor: z.string().optional(),
  oldest: z.string().optional(),
  latest: z.string().optional(),
  inclusive: z.boolean().optional().default(true),
});

export const SearchThreadsSchema = z.object({
  query: z.string().min(1, 'Search query is required'),
  channel: z.string().optional(),
  user: z.string().optional(),
  after: z.string().optional(),
  before: z.string().optional(),
  sort: z.enum(['timestamp', 'relevance']).optional().default('relevance'),
  sort_dir: z.enum(['asc', 'desc']).optional().default('desc'),
  limit: z.number().min(1).max(100).optional().default(20),
});

export const AnalyzeThreadSchema = z.object({
  channel: z.string().min(1, 'Channel ID is required'),
  thread_ts: z.string().min(1, 'Thread timestamp is required'),
  include_sentiment_analysis: z.boolean().optional().default(true),
  include_action_items: z.boolean().optional().default(true),
  include_timeline: z.boolean().optional().default(true),
  extract_topics: z.boolean().optional().default(true),
});

export const SummarizeThreadSchema = z.object({
  channel: z.string().min(1, 'Channel ID is required'),
  thread_ts: z.string().min(1, 'Thread timestamp is required'),
  summary_length: z.enum(['brief', 'detailed', 'comprehensive']).optional().default('detailed'),
  include_action_items: z.boolean().optional().default(true),
  include_decisions: z.boolean().optional().default(true),
  language: z.string().optional().default('en'),
});

export const PostThreadReplySchema = z.object({
  channel: z.string().min(1, 'Channel ID is required'),
  thread_ts: z.string().min(1, 'Thread timestamp is required'),
  text: z.string().min(1, 'Message text is required'),
  broadcast: z.boolean().optional().default(false),
  reply_broadcast: z.boolean().optional().default(false),
});

export const CreateThreadSchema = z.object({
  channel: z.string().min(1, 'Channel ID is required'),
  text: z.string().min(1, 'Initial message text is required'),
  reply_text: z.string().optional(),
  broadcast: z.boolean().optional().default(false),
});

export const MarkThreadImportantSchema = z.object({
  channel: z.string().min(1, 'Channel ID is required'),
  thread_ts: z.string().min(1, 'Thread timestamp is required'),
  importance_level: z.enum(['low', 'medium', 'high', 'critical']).optional().default('high'),
  reason: z.string().optional(),
  notify_participants: z.boolean().optional().default(false),
});

export const ExportThreadSchema = z.object({
  channel: z.string().min(1, 'Channel ID is required'),
  thread_ts: z.string().min(1, 'Thread timestamp is required'),
  format: z.enum(['markdown', 'json', 'html', 'csv']).optional().default('markdown'),
  include_metadata: z.boolean().optional().default(true),
  include_reactions: z.boolean().optional().default(true),
  include_user_profiles: z.boolean().optional().default(false),
  date_format: z.string().optional().default('ISO'),
});

export const FindRelatedThreadsSchema = z.object({
  channel: z.string().min(1, 'Channel ID is required'),
  thread_ts: z.string().min(1, 'Thread timestamp is required'),
  similarity_threshold: z.number().min(0).max(1).optional().default(0.3),
  max_results: z.number().min(1).max(50).optional().default(10),
  include_cross_channel: z.boolean().optional().default(false),
  relationship_types: z.array(z.enum(['keyword_overlap', 'participant_overlap', 'temporal_proximity', 'topic_similarity'])).optional(),
});

export const GetThreadMetricsSchema = z.object({
  channel: z.string().optional(),
  user: z.string().optional(),
  after: z.string().optional(),
  before: z.string().optional(),
  include_activity_patterns: z.boolean().optional().default(true),
  include_participant_stats: z.boolean().optional().default(true),
  time_zone: z.string().optional().default('UTC'),
});

export const GetThreadsByParticipantsSchema = z.object({
  participants: z.array(z.string()).min(1, 'At least one participant required'),
  channel: z.string().optional(),
  after: z.string().optional(),
  before: z.string().optional(),
  limit: z.number().min(1).max(100).optional().default(20),
  require_all_participants: z.boolean().optional().default(false),
});

export const ExtractActionItemsSchema = z.object({
  channel: z.string().min(1, 'Channel ID is required'),
  thread_ts: z.string().min(1, 'Thread timestamp is required'),
  include_completed: z.boolean().optional().default(false),
  priority_threshold: z.enum(['low', 'medium', 'high']).optional().default('low'),
  assign_priorities: z.boolean().optional().default(true),
});

export const IdentifyImportantThreadsSchema = z.object({
  channel: z.string().min(1, 'Channel ID is required'),
  time_range_hours: z.number().min(1).max(8760).optional().default(168), // Default 1 week
  importance_threshold: z.number().min(0).max(1).optional().default(0.7),
  criteria: z.array(z.enum(['participant_count', 'message_count', 'urgency_keywords', 'executive_involvement', 'mention_frequency'])).optional(),
  limit: z.number().min(1).max(50).optional().default(10),
});

/**
 * File operation validation schemas
 */
export const UploadFileSchema = z.object({
  file_path: z.string().min(1, 'File path is required'),
  filename: z.string().optional(),
  title: z.string().optional(),
  channels: z.array(z.string()).optional(),
  initial_comment: z.string().optional(),
  thread_ts: z.string().optional(),
});

export const ListFilesSchema = z.object({
  user: z.string().optional(),
  channel: z.string().optional(),
  types: z.string().optional(),
  ts_from: z.string().optional(),
  ts_to: z.string().optional(),
  count: z.number().min(1).max(1000).optional().default(100),
  page: z.number().min(1).optional().default(1),
});

export const GetFileInfoSchema = z.object({
  file_id: z.string().min(1, 'File ID is required'),
  include_comments: z.boolean().optional().default(false),
});

export const DeleteFileSchema = z.object({
  file_id: z.string().min(1, 'File ID is required'),
});

export const ShareFileSchema = z.object({
  file_id: z.string().min(1, 'File ID is required'),
  channel: z.string().min(1, 'Channel ID is required'),
});

export const AnalyzeFilesSchema = z.object({
  channel: z.string().optional(),
  user: z.string().optional(),
  days_back: z.number().min(1).max(365).optional().default(30),
  include_large_files: z.boolean().optional().default(true),
  size_threshold_mb: z.number().optional().default(10),
});

export const SearchFilesSchema = z.object({
  query: z.string().min(1, 'Search query is required'),
  types: z.string().optional(),
  user: z.string().optional(),
  channel: z.string().optional(),
  after: z.string().optional(),
  before: z.string().optional(),
  count: z.number().min(1).max(100).optional().default(20),
});

/**
 * Reaction management validation schemas
 */
export const AddReactionSchema = z.object({
  channel: z.string().min(1, 'Channel ID is required'),
  message_ts: z.string().min(1, 'Message timestamp is required'),
  reaction_name: z.string().min(1, 'Reaction name is required'),
});

export const RemoveReactionSchema = z.object({
  channel: z.string().min(1, 'Channel ID is required'),
  message_ts: z.string().min(1, 'Message timestamp is required'),
  reaction_name: z.string().min(1, 'Reaction name is required'),
});

export const GetReactionsSchema = z.object({
  channel: z.string().min(1, 'Channel ID is required'),
  message_ts: z.string().min(1, 'Message timestamp is required'),
  full: z.boolean().optional().default(false),
});

export const GetReactionStatisticsSchema = z.object({
  channel: z.string().optional(),
  user: z.string().optional(),
  days_back: z.number().min(1).max(365).optional().default(30),
  include_trends: z.boolean().optional().default(true),
  top_count: z.number().optional().default(10),
});

export const FindMessagesByReactionsSchema = z.object({
  reactions: z.array(z.string()).min(1, 'At least one reaction is required'),
  channel: z.string().optional(),
  match_type: z.enum(['any', 'all']).optional().default('any'),
  min_reaction_count: z.number().optional().default(1),
  after: z.string().optional(),
  before: z.string().optional(),
  limit: z.number().min(1).max(100).optional().default(20),
});

/**
 * Workspace management validation schemas
 */
export const GetWorkspaceInfoSchema = z.object({});

export const ListTeamMembersSchema = z.object({
  include_deleted: z.boolean().optional().default(false),
  include_bots: z.boolean().optional().default(true),
  cursor: z.string().optional(),
  limit: z.number().min(1).max(200).optional().default(100),
});

/**
 * Analytics and reporting validation schemas
 */
export const GetWorkspaceActivitySchema = z.object({
  start_date: z.string().optional(),
  end_date: z.string().optional(),
  include_user_details: z.boolean().optional().default(true),
  include_channel_details: z.boolean().optional().default(true),
  top_count: z.number().optional().default(10),
});

export const GetServerHealthSchema = z.object({
  include_rate_limits: z.boolean().optional().default(true),
  include_response_times: z.boolean().optional().default(true),
});

/**
 * Generic validation helper
 */
export function validateInput<T>(schema: z.ZodSchema<T>, input: unknown): T {
  const result = schema.safeParse(input);
  
  if (!result.success) {
    const errors = result.error.errors.map(err => `${err.path.join('.')}: ${err.message}`);
    throw new Error(`Validation failed: ${errors.join(', ')}`);
  }
  
  return result.data;
}

// Existing types
export type SendMessageInput = z.infer<typeof SendMessageSchema>;
export type ListChannelsInput = z.infer<typeof ListChannelsSchema>;
export type GetChannelHistoryInput = z.infer<typeof GetChannelHistorySchema>;
export type GetUserInfoInput = z.infer<typeof GetUserInfoSchema>;

// Thread-specific input types
export type FindThreadsInChannelInput = z.infer<typeof FindThreadsInChannelSchema>;
export type GetThreadRepliesInput = z.infer<typeof GetThreadRepliesSchema>;
export type SearchThreadsInput = z.infer<typeof SearchThreadsSchema>;
export type AnalyzeThreadInput = z.infer<typeof AnalyzeThreadSchema>;
export type SummarizeThreadInput = z.infer<typeof SummarizeThreadSchema>;
export type PostThreadReplyInput = z.infer<typeof PostThreadReplySchema>;
export type CreateThreadInput = z.infer<typeof CreateThreadSchema>;
export type MarkThreadImportantInput = z.infer<typeof MarkThreadImportantSchema>;
export type ExportThreadInput = z.infer<typeof ExportThreadSchema>;
export type FindRelatedThreadsInput = z.infer<typeof FindRelatedThreadsSchema>;
export type GetThreadMetricsInput = z.infer<typeof GetThreadMetricsSchema>;
export type GetThreadsByParticipantsInput = z.infer<typeof GetThreadsByParticipantsSchema>;
export type ExtractActionItemsInput = z.infer<typeof ExtractActionItemsSchema>;
export type IdentifyImportantThreadsInput = z.infer<typeof IdentifyImportantThreadsSchema>;

// File operation input types
export type UploadFileInput = z.infer<typeof UploadFileSchema>;
export type ListFilesInput = z.infer<typeof ListFilesSchema>;
export type GetFileInfoInput = z.infer<typeof GetFileInfoSchema>;
export type DeleteFileInput = z.infer<typeof DeleteFileSchema>;
export type ShareFileInput = z.infer<typeof ShareFileSchema>;
export type AnalyzeFilesInput = z.infer<typeof AnalyzeFilesSchema>;
export type SearchFilesInput = z.infer<typeof SearchFilesSchema>;

// Reaction management input types
export type AddReactionInput = z.infer<typeof AddReactionSchema>;
export type RemoveReactionInput = z.infer<typeof RemoveReactionSchema>;
export type GetReactionsInput = z.infer<typeof GetReactionsSchema>;
export type GetReactionStatisticsInput = z.infer<typeof GetReactionStatisticsSchema>;
export type FindMessagesByReactionsInput = z.infer<typeof FindMessagesByReactionsSchema>;

// Workspace management input types
export type GetWorkspaceInfoInput = z.infer<typeof GetWorkspaceInfoSchema>;
export type ListTeamMembersInput = z.infer<typeof ListTeamMembersSchema>;

// Analytics and reporting input types
export type GetWorkspaceActivityInput = z.infer<typeof GetWorkspaceActivitySchema>;
export type GetServerHealthInput = z.infer<typeof GetServerHealthSchema>;