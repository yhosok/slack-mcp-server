import { z } from 'zod';

/**
 * Pagination constants - defined here to avoid circular dependency issues
 */
export const PAGINATION_DEFAULTS = {
  MAX_PAGES: 10,
  MAX_ITEMS: 1000,
  MAX_PAGES_LIMIT: 100,
  MAX_ITEMS_LIMIT: 10000,
} as const;

/**
 * Validation schemas for Slack API requests
 */

export const SendMessageSchema = z
  .object({
    channel: z
      .string()
      .min(1, 'Channel is required')
      .describe(
        'Channel ID or user ID to send message to (e.g., #general, @username, or C1234567890)'
      ),
    text: z
      .string()
      .min(1, 'Message text is required')
      .describe('Message text to send. Supports Slack markdown formatting.'),
    thread_ts: z
      .string()
      .optional()
      .describe('Optional: Thread timestamp to reply to a specific message'),
  })
  .describe('Send a message to a Slack channel or user');

export const ListChannelsSchema = z
  .object({
    types: z
      .string()
      .optional()
      .default('public_channel,private_channel')
      .describe('Comma-separated list of channel types to include'),
    exclude_archived: z
      .boolean()
      .optional()
      .default(true)
      .describe('Whether to exclude archived channels'),
    limit: z
      .number()
      .min(1)
      .max(200)
      .optional()
      .default(100)
      .describe('Number of channels to retrieve per page (1-200)'),
    cursor: z.string().optional().describe('Cursor for pagination (optional)'),
    name_filter: z
      .string()
      .optional()
      .describe('Filter channels by name (case-insensitive substring match)'),
    fetch_all_pages: z
      .boolean()
      .optional()
      .default(false)
      .describe('Whether to fetch all pages at once instead of single page'),
    max_pages: z
      .number()
      .min(1)
      .max(PAGINATION_DEFAULTS.MAX_PAGES_LIMIT)
      .optional()
      .describe('Maximum number of pages to fetch when fetch_all_pages is true'),
    max_items: z
      .number()
      .min(1)
      .max(PAGINATION_DEFAULTS.MAX_ITEMS_LIMIT)
      .optional()
      .describe('Maximum total items to fetch when fetch_all_pages is true'),
  })
  .describe('List all channels in the Slack workspace');

export const GetChannelHistorySchema = z
  .object({
    channel: z
      .string()
      .min(1, 'Channel is required')
      .describe('Channel ID to get history from (e.g., C1234567890)'),
    limit: z
      .number()
      .min(1)
      .max(1000)
      .optional()
      .default(100)
      .describe('Number of messages to retrieve per page (1-1000)'),
    cursor: z.string().optional().describe('Cursor for pagination (optional)'),

    // Date range parameters (recommended, user-friendly)
    after_date: z
      .string()
      .optional()
      .describe(
        'Start date in YYYY-MM-DD format, inclusive (00:00:00 UTC). Recommended for day-level filtering. Example: "2025-09-10". Cannot be used with oldest_ts.'
      ),
    before_date: z
      .string()
      .optional()
      .describe(
        'End date in YYYY-MM-DD format, inclusive (23:59:59 UTC). Recommended for day-level filtering. Example: "2025-09-30". Cannot be used with latest_ts.'
      ),

    // Timestamp range parameters (advanced, for precise second-level control)
    oldest_ts: z
      .string()
      .optional()
      .describe(
        'Start Unix timestamp in seconds. For precise second-level control. Cannot be used with after_date.'
      ),
    latest_ts: z
      .string()
      .optional()
      .describe(
        'End Unix timestamp in seconds. For precise second-level control. Cannot be used with before_date.'
      ),

    fetch_all_pages: z
      .boolean()
      .optional()
      .default(false)
      .describe('Whether to fetch all pages at once instead of single page'),
    max_pages: z
      .number()
      .min(1)
      .max(PAGINATION_DEFAULTS.MAX_PAGES_LIMIT)
      .optional()
      .describe('Maximum number of pages to fetch when fetch_all_pages is true'),
    max_items: z
      .number()
      .min(1)
      .max(PAGINATION_DEFAULTS.MAX_ITEMS_LIMIT)
      .optional()
      .describe('Maximum total items to fetch when fetch_all_pages is true'),
  })
  .refine((data) => !(data.after_date && data.oldest_ts), {
    message:
      'Cannot specify both after_date and oldest_ts. Use date strings OR timestamps, not both.',
  })
  .refine((data) => !(data.before_date && data.latest_ts), {
    message:
      'Cannot specify both before_date and latest_ts. Use date strings OR timestamps, not both.',
  })
  .describe('Get message history from a Slack channel with optional pagination support');

export const GetUserInfoSchema = z
  .object({
    user: z
      .string()
      .min(1, 'User ID is required')
      .describe('User ID to get information about (e.g., U1234567890)'),
  })
  .describe('Get information about a Slack user');

export const SearchMessagesSchema = z
  .object({
    query: z.string().min(1, 'Search query is required').describe('Search query string'),
    sort: z
      .enum(['score', 'timestamp'])
      .optional()
      .default('score')
      .describe('Sort order for results'),
    sort_dir: z.enum(['asc', 'desc']).optional().default('desc').describe('Sort direction'),
    count: z
      .number()
      .min(1)
      .max(100)
      .optional()
      .default(20)
      .describe('Number of results to return (1-100)'),
    page: z.number().min(1).max(100).optional().default(1).describe('Page number for pagination'),
    highlight: z.boolean().optional().default(false).describe('Whether to highlight search terms'),
    after: z.string().optional().describe('Search after this date (YYYY-MM-DD)'),
    before: z.string().optional().describe('Search before this date (YYYY-MM-DD)'),
  })
  .describe('Search for messages in the Slack workspace');

export const GetChannelInfoSchema = z
  .object({
    channel: z
      .string()
      .min(1, 'Channel ID is required')
      .describe('Channel ID to get information about (e.g., C1234567890)'),
  })
  .describe('Get detailed information about a Slack channel');

/**
 * Thread-specific validation schemas
 */
export const FindThreadsInChannelSchema = z
  .object({
    channel: z
      .string()
      .min(1, 'Channel ID is required')
      .describe('Channel ID to search for threads (e.g., C1234567890)'),
    limit: z
      .number()
      .min(1)
      .max(200)
      .optional()
      .default(50)
      .describe('Maximum number of parent messages to examine (1-200)'),
    cursor: z.string().optional().describe('Pagination cursor for retrieving more results'),

    // Date range parameters (recommended, user-friendly)
    after_date: z
      .string()
      .optional()
      .describe(
        'Start date in YYYY-MM-DD format, inclusive (00:00:00 UTC). Recommended for day-level filtering. Example: "2025-09-10". Cannot be used with oldest_ts.'
      ),
    before_date: z
      .string()
      .optional()
      .describe(
        'End date in YYYY-MM-DD format, inclusive (23:59:59 UTC). Recommended for day-level filtering. Example: "2025-09-30". Cannot be used with latest_ts.'
      ),

    // Timestamp range parameters (advanced, for precise second-level control)
    oldest_ts: z
      .string()
      .optional()
      .describe(
        'Start Unix timestamp in seconds. For precise second-level control. Cannot be used with after_date.'
      ),
    latest_ts: z
      .string()
      .optional()
      .describe(
        'End Unix timestamp in seconds. For precise second-level control. Cannot be used with before_date.'
      ),

    include_all_metadata: z
      .boolean()
      .optional()
      .default(false)
      .describe('Include additional metadata in response'),
    fetch_all_pages: z
      .boolean()
      .optional()
      .default(false)
      .describe('Whether to fetch all pages at once instead of single page'),
    max_pages: z
      .number()
      .min(1)
      .max(PAGINATION_DEFAULTS.MAX_PAGES_LIMIT)
      .optional()
      .describe('Maximum number of pages to fetch when fetch_all_pages is true'),
    max_items: z
      .number()
      .min(1)
      .max(PAGINATION_DEFAULTS.MAX_ITEMS_LIMIT)
      .optional()
      .describe('Maximum total items to fetch when fetch_all_pages is true'),
  })
  .refine((data) => !(data.after_date && data.oldest_ts), {
    message:
      'Cannot specify both after_date and oldest_ts. Use date strings OR timestamps, not both.',
  })
  .refine((data) => !(data.before_date && data.latest_ts), {
    message:
      'Cannot specify both before_date and latest_ts. Use date strings OR timestamps, not both.',
  })
  .describe('Find all threaded conversations in a specific channel');

export const GetThreadRepliesSchema = z
  .object({
    channel: z
      .string()
      .min(1, 'Channel ID is required')
      .describe('Channel ID where the thread exists (e.g., C1234567890)'),
    thread_ts: z
      .string()
      .min(1, 'Thread timestamp is required')
      .describe('Thread timestamp (parent message timestamp)'),
    limit: z
      .number()
      .min(1)
      .max(1000)
      .optional()
      .default(100)
      .describe('Maximum number of messages to retrieve per page (1-1000)'),
    cursor: z.string().optional().describe('Pagination cursor'),

    // Date range parameters (recommended, user-friendly)
    after_date: z
      .string()
      .optional()
      .describe(
        'Start date in YYYY-MM-DD format, inclusive (00:00:00 UTC). Recommended for day-level filtering. Example: "2025-09-10". Cannot be used with oldest_ts.'
      ),
    before_date: z
      .string()
      .optional()
      .describe(
        'End date in YYYY-MM-DD format, inclusive (23:59:59 UTC). Recommended for day-level filtering. Example: "2025-09-30". Cannot be used with latest_ts.'
      ),

    // Timestamp range parameters (advanced, for precise second-level control)
    oldest_ts: z
      .string()
      .optional()
      .describe(
        'Start Unix timestamp in seconds. For precise second-level control. Cannot be used with after_date.'
      ),
    latest_ts: z
      .string()
      .optional()
      .describe(
        'End Unix timestamp in seconds. For precise second-level control. Cannot be used with before_date.'
      ),

    inclusive: z
      .boolean()
      .optional()
      .default(true)
      .describe('Include messages with matching timestamps'),
    fetch_all_pages: z
      .boolean()
      .optional()
      .default(false)
      .describe('Whether to fetch all pages at once instead of single page'),
    max_pages: z
      .number()
      .min(1)
      .max(PAGINATION_DEFAULTS.MAX_PAGES_LIMIT)
      .optional()
      .describe('Maximum number of pages to fetch when fetch_all_pages is true'),
    max_items: z
      .number()
      .min(1)
      .max(PAGINATION_DEFAULTS.MAX_ITEMS_LIMIT)
      .optional()
      .describe('Maximum total items to fetch when fetch_all_pages is true'),
  })
  .refine((data) => !(data.after_date && data.oldest_ts), {
    message:
      'Cannot specify both after_date and oldest_ts. Use date strings OR timestamps, not both.',
  })
  .refine((data) => !(data.before_date && data.latest_ts), {
    message:
      'Cannot specify both before_date and latest_ts. Use date strings OR timestamps, not both.',
  })
  .describe(
    'Get complete thread content including parent message and all replies with optional pagination support'
  );

export const SearchThreadsSchema = z
  .object({
    query: z.string().min(1, 'Search query is required').describe('Search query string'),
    channel: z.string().optional().describe('Limit search to specific channel'),
    user: z.string().optional().describe('Filter by messages from specific user'),
    after: z.string().optional().describe('Search after this date (YYYY-MM-DD)'),
    before: z.string().optional().describe('Search before this date (YYYY-MM-DD)'),
    sort: z
      .enum(['timestamp', 'relevance'])
      .optional()
      .default('relevance')
      .describe('Sort results by timestamp or relevance'),
    sort_dir: z.enum(['asc', 'desc']).optional().default('desc').describe('Sort direction'),
    limit: z
      .number()
      .min(1)
      .max(100)
      .optional()
      .default(20)
      .describe('Maximum number of results (1-100)'),
  })
  .describe('Search for threads by keywords, participants, or content');

export const AnalyzeThreadSchema = z
  .object({
    channel: z
      .string()
      .min(1, 'Channel ID is required')
      .describe('Channel ID where the thread exists'),
    thread_ts: z
      .string()
      .min(1, 'Thread timestamp is required')
      .describe('Thread timestamp to analyze'),
    include_sentiment_analysis: z
      .boolean()
      .optional()
      .default(true)
      .describe('Include sentiment analysis in results'),
    include_action_items: z
      .boolean()
      .optional()
      .default(true)
      .describe('Extract action items from thread'),
    include_timeline: z
      .boolean()
      .optional()
      .default(true)
      .describe('Include detailed timeline of events'),
    extract_topics: z
      .boolean()
      .optional()
      .default(true)
      .describe('Extract key topics and keywords'),
  })
  .describe('Analyze thread structure, participants, timeline, and extract key topics');

export const SummarizeThreadSchema = z
  .object({
    channel: z
      .string()
      .min(1, 'Channel ID is required')
      .describe('Channel ID where the thread exists'),
    thread_ts: z
      .string()
      .min(1, 'Thread timestamp is required')
      .describe('Thread timestamp to summarize'),
    summary_length: z
      .enum(['brief', 'detailed', 'comprehensive'])
      .optional()
      .default('detailed')
      .describe('Desired summary length'),
    include_action_items: z
      .boolean()
      .optional()
      .default(true)
      .describe('Include extracted action items'),
    include_decisions: z
      .boolean()
      .optional()
      .default(true)
      .describe('Include decisions made in the thread'),
    language: z.string().optional().default('en').describe('Summary language (ISO 639-1 code)'),
  })
  .describe('Generate intelligent summary of thread content with key points and decisions');

export const PostThreadReplySchema = z
  .object({
    channel: z
      .string()
      .min(1, 'Channel ID is required')
      .describe('Channel ID where the thread exists'),
    thread_ts: z
      .string()
      .min(1, 'Thread timestamp is required')
      .describe('Thread timestamp to reply to'),
    text: z
      .string()
      .min(1, 'Message text is required')
      .describe('Reply message text (supports Slack markdown)'),
    broadcast: z
      .boolean()
      .optional()
      .default(false)
      .describe('Broadcast reply to channel (deprecated, use reply_broadcast)'),
    reply_broadcast: z
      .boolean()
      .optional()
      .default(false)
      .describe('Broadcast reply to the channel'),
  })
  .describe('Post a reply to an existing thread');

export const CreateThreadSchema = z
  .object({
    channel: z
      .string()
      .min(1, 'Channel ID is required')
      .describe('Channel ID to create the thread in'),
    text: z
      .string()
      .min(1, 'Initial message text is required')
      .describe('Initial parent message text'),
    reply_text: z.string().optional().describe('Optional first reply to start the thread'),
    broadcast: z
      .boolean()
      .optional()
      .default(false)
      .describe('Broadcast the initial reply to channel'),
  })
  .describe('Create a new thread by posting a parent message and optional first reply');

export const MarkThreadImportantSchema = z
  .object({
    channel: z
      .string()
      .min(1, 'Channel ID is required')
      .describe('Channel ID where the thread exists'),
    thread_ts: z
      .string()
      .min(1, 'Thread timestamp is required')
      .describe('Thread timestamp to mark as important'),
    importance_level: z
      .enum(['low', 'medium', 'high', 'critical'])
      .optional()
      .default('high')
      .describe('Level of importance'),
    reason: z.string().optional().describe('Optional reason for marking as important'),
    notify_participants: z
      .boolean()
      .optional()
      .default(false)
      .describe('Notify all thread participants'),
  })
  .describe('Mark a thread as important with reactions and notifications');

export const ExportThreadSchema = z
  .object({
    channel: z
      .string()
      .min(1, 'Channel ID is required')
      .describe('Channel ID where the thread exists'),
    thread_ts: z
      .string()
      .min(1, 'Thread timestamp is required')
      .describe('Thread timestamp to export'),
    format: z
      .enum(['markdown', 'json', 'html', 'csv'])
      .optional()
      .default('markdown')
      .describe('Export format'),
    include_metadata: z
      .boolean()
      .optional()
      .default(true)
      .describe('Include message metadata (timestamps, user IDs)'),
    include_reactions: z.boolean().optional().default(true).describe('Include message reactions'),
    include_user_profiles: z
      .boolean()
      .optional()
      .default(false)
      .describe('Include detailed user profile information'),
    date_format: z.string().optional().default('ISO').describe('Date format for timestamps'),
  })
  .describe('Export thread content in various formats (markdown, JSON, HTML, CSV)');

export const FindRelatedThreadsSchema = z
  .object({
    channel: z
      .string()
      .min(1, 'Channel ID is required')
      .describe('Channel ID of the reference thread'),
    thread_ts: z
      .string()
      .min(1, 'Thread timestamp is required')
      .describe('Reference thread timestamp'),
    similarity_threshold: z
      .number()
      .min(0)
      .max(1)
      .optional()
      .default(0.3)
      .describe('Minimum similarity score (0.0-1.0)'),
    max_results: z
      .number()
      .min(1)
      .max(50)
      .optional()
      .default(10)
      .describe('Maximum number of related threads to return (1-50)'),
    include_cross_channel: z
      .boolean()
      .optional()
      .default(false)
      .describe('Include threads from other channels'),
    relationship_types: z
      .array(
        z.enum(['keyword_overlap', 'participant_overlap', 'temporal_proximity', 'topic_similarity'])
      )
      .optional()
      .describe('Types of relationships to consider'),
  })
  .describe('Find threads related to a given thread based on content, participants, or topics');

export const GetThreadMetricsSchema = z
  .object({
    channel: z
      .string()
      .optional()
      .describe('Channel ID to analyze (optional, all channels if omitted)'),
    user: z.string().optional().describe('Filter metrics for specific user'),
    after: z.string().optional().describe('Start date for metrics (YYYY-MM-DD)'),
    before: z.string().optional().describe('End date for metrics (YYYY-MM-DD)'),
    include_activity_patterns: z
      .boolean()
      .optional()
      .default(true)
      .describe('Include activity patterns by time of day'),
    include_participant_stats: z
      .boolean()
      .optional()
      .default(true)
      .describe('Include top participants statistics'),
    time_zone: z.string().optional().default('UTC').describe('Timezone for activity patterns'),
  })
  .describe('Get statistics and metrics about threads in a channel or workspace');

export const GetThreadsByParticipantsSchema = z
  .object({
    participants: z
      .array(z.string())
      .min(1, 'At least one participant required')
      .describe('User IDs of participants to search for'),
    channel: z.string().optional().describe('Limit search to specific channel'),
    after: z.string().optional().describe('Search after this date (YYYY-MM-DD)'),
    before: z.string().optional().describe('Search before this date (YYYY-MM-DD)'),
    limit: z
      .number()
      .min(1)
      .max(100)
      .optional()
      .default(20)
      .describe('Maximum number of threads to return (1-100)'),
    require_all_participants: z
      .boolean()
      .optional()
      .default(false)
      .describe('Require ALL participants to be in thread (vs ANY)'),
  })
  .describe('Find threads that include specific participants');

export const ExtractActionItemsSchema = z
  .object({
    channel: z
      .string()
      .min(1, 'Channel ID is required')
      .describe('Channel ID where the thread exists'),
    thread_ts: z
      .string()
      .min(1, 'Thread timestamp is required')
      .describe('Thread timestamp to analyze'),
    include_completed: z
      .boolean()
      .optional()
      .default(false)
      .describe('Include completed action items'),
    priority_threshold: z
      .enum(['low', 'medium', 'high'])
      .optional()
      .default('low')
      .describe('Minimum priority level to include'),
    assign_priorities: z
      .boolean()
      .optional()
      .default(true)
      .describe('Automatically assign priorities based on content'),
  })
  .describe('Extract action items and tasks from thread messages');

export const IdentifyImportantThreadsSchema = z
  .object({
    channel: z.string().min(1, 'Channel ID is required').describe('Channel ID to analyze'),
    time_range_hours: z
      .number()
      .min(1)
      .max(8760)
      .optional()
      .default(168)
      .describe('Look back this many hours for threads (1-8760)'), // Default 1 week
    importance_threshold: z
      .number()
      .min(0)
      .max(1)
      .optional()
      .default(0.7)
      .describe('Minimum importance score (0.0-1.0)'),
    criteria: z
      .array(
        z.enum([
          'participant_count',
          'message_count',
          'urgency_keywords',
          'executive_involvement',
          'mention_frequency',
          'tf_idf_relevance',
          'time_decay',
          'engagement_metrics',
        ])
      )
      .optional()
      .describe('Criteria to use for identifying important threads'),
    limit: z
      .number()
      .min(1)
      .max(50)
      .optional()
      .default(10)
      .describe('Maximum number of threads to return (1-50)'),
  })
  .describe('Identify important or urgent threads in a channel based on various criteria');

/**
 * File operation validation schemas
 */
export const UploadFileSchema = z
  .object({
    file_path: z
      .string()
      .min(1, 'File path is required')
      .max(4096, 'File path too long (max 4096 characters)')
      .refine(
        (path) => !path.includes('..') && !path.includes('~'),
        'File path must not contain path traversal patterns'
      )
      .describe('Local path to the file to upload (validated for security)'),
    filename: z
      .string()
      .max(255, 'Filename too long (max 255 characters)')
      .optional()
      .describe('Optional filename to use (defaults to original filename)'),
    title: z
      .string()
      .max(255, 'Title too long (max 255 characters)')
      .optional()
      .describe('Optional title for the file'),
    channels: z
      .array(z.string())
      .max(10, 'Too many channels (max 10 per upload)')
      .optional()
      .describe('Channels to share the file to (channel IDs)'),
    initial_comment: z
      .string()
      .max(8000, 'Initial comment too long (max 8000 characters)')
      .optional()
      .describe('Optional initial comment for the file'),
    thread_ts: z.string().optional().describe('Optional thread timestamp to upload to a thread'),
  })
  .describe('Upload a file to Slack channels or threads with security validation');

export const ListFilesSchema = z
  .object({
    user: z.string().optional().describe('Filter by user who uploaded the file'),
    channel: z.string().optional().describe('Filter by channel where file was shared'),
    types: z
      .string()
      .optional()
      .describe('Comma-separated list of file types to include (e.g., "images,pdfs")'),

    // Date range parameters (recommended, user-friendly)
    after_date: z
      .string()
      .optional()
      .describe(
        'Start date in YYYY-MM-DD format, inclusive (00:00:00 UTC). Filter files created on or after this date. Example: "2025-09-10". Cannot be used with ts_from.'
      ),
    before_date: z
      .string()
      .optional()
      .describe(
        'End date in YYYY-MM-DD format, inclusive (23:59:59 UTC). Filter files created on or before this date. Example: "2025-09-30". Cannot be used with ts_to.'
      ),

    // Timestamp range parameters (advanced, for precise second-level control)
    ts_from: z
      .string()
      .optional()
      .describe(
        'Filter files created after this Unix timestamp (seconds). For precise second-level control. Cannot be used with after_date.'
      ),
    ts_to: z
      .string()
      .optional()
      .describe(
        'Filter files created before this Unix timestamp (seconds). For precise second-level control. Cannot be used with before_date.'
      ),

    count: z
      .number()
      .min(1)
      .max(1000)
      .optional()
      .default(100)
      .describe('Number of files to return per page (1-1000)'),
    page: z.number().min(1).optional().default(1).describe('Page number for pagination'),
    fetch_all_pages: z
      .boolean()
      .optional()
      .default(false)
      .describe('Whether to fetch all pages at once instead of single page'),
    max_pages: z
      .number()
      .min(1)
      .max(PAGINATION_DEFAULTS.MAX_PAGES_LIMIT)
      .optional()
      .describe('Maximum number of pages to fetch when fetch_all_pages is true'),
    max_items: z
      .number()
      .min(1)
      .max(PAGINATION_DEFAULTS.MAX_ITEMS_LIMIT)
      .optional()
      .describe('Maximum total items to fetch when fetch_all_pages is true'),
  })
  .refine((data) => !(data.after_date && data.ts_from), {
    message:
      'Cannot specify both after_date and ts_from. Use date strings OR timestamps, not both.',
  })
  .refine((data) => !(data.before_date && data.ts_to), {
    message: 'Cannot specify both before_date and ts_to. Use date strings OR timestamps, not both.',
  })
  .describe('List files in workspace with filtering options and optional pagination support');

export const GetFileInfoSchema = z
  .object({
    file_id: z.string().min(1, 'File ID is required').describe('File ID to get information about'),
    include_comments: z
      .boolean()
      .optional()
      .default(false)
      .describe('Include file comments in response'),
  })
  .describe('Get detailed information about a specific file');

export const DeleteFileSchema = z
  .object({
    file_id: z.string().min(1, 'File ID is required').describe('File ID to delete'),
  })
  .describe('Delete a file (where permitted)');

export const ShareFileSchema = z
  .object({
    file_id: z.string().min(1, 'File ID is required').describe('File ID to share'),
    channel: z
      .string()
      .min(1, 'Channel ID is required')
      .describe('Channel ID to share the file to'),
  })
  .describe('Share an existing file to additional channels');

export const AnalyzeFilesSchema = z
  .object({
    channel: z.string().optional().describe('Limit analysis to specific channel'),
    user: z.string().optional().describe('Limit analysis to specific user'),
    days_back: z
      .number()
      .min(1)
      .max(365)
      .optional()
      .default(30)
      .describe('Number of days back to analyze (1-365)'),
    include_large_files: z
      .boolean()
      .optional()
      .default(true)
      .describe('Include analysis of large files (>10MB)'),
    size_threshold_mb: z
      .number()
      .optional()
      .default(10)
      .describe('Size threshold in MB for identifying large files'),
  })
  .describe('Analyze file types, sizes, and usage patterns in workspace');

export const SearchFilesSchema = z
  .object({
    query: z
      .string()
      .min(1, 'Search query is required')
      .describe('Search query (filename, content, or keywords)'),
    types: z.string().optional().describe('Comma-separated file types to search'),
    user: z.string().optional().describe('Filter by user who uploaded'),
    channel: z.string().optional().describe('Filter by channel where shared'),
    after: z.string().optional().describe('Search files after date (YYYY-MM-DD)'),
    before: z.string().optional().describe('Search files before date (YYYY-MM-DD)'),
    count: z
      .number()
      .min(1)
      .max(100)
      .optional()
      .default(20)
      .describe('Number of results to return (1-100)'),
    fetch_all_pages: z
      .boolean()
      .optional()
      .default(false)
      .describe('Whether to fetch all pages at once instead of single page'),
    max_pages: z
      .number()
      .min(1)
      .max(PAGINATION_DEFAULTS.MAX_PAGES_LIMIT)
      .optional()
      .describe('Maximum number of pages to fetch when fetch_all_pages is true'),
    max_items: z
      .number()
      .min(1)
      .max(PAGINATION_DEFAULTS.MAX_ITEMS_LIMIT)
      .optional()
      .describe('Maximum total items to fetch when fetch_all_pages is true'),
  })
  .describe('Search for files by name, type, or content');

export const GetMessageImagesSchema = z
  .object({
    channel: z
      .string()
      .min(1, 'Channel ID is required')
      .describe('Channel ID where the message is located (e.g., C1234567890)'),
    message_ts: z
      .string()
      .min(1, 'Message timestamp is required')
      .describe('Timestamp of the message to retrieve images from'),
    include_image_data: z
      .boolean()
      .optional()
      .default(false)
      .describe('Whether to include Base64-encoded image data in the response'),
  })
  .describe('Get all images from a specific message');

/**
 * Reaction management validation schemas
 */
export const AddReactionSchema = z
  .object({
    channel: z
      .string()
      .min(1, 'Channel ID is required')
      .describe('Channel where the message is located'),
    message_ts: z
      .string()
      .min(1, 'Message timestamp is required')
      .describe('Timestamp of the message to react to'),
    reaction_name: z
      .string()
      .min(1, 'Reaction name is required')
      .describe('Name of reaction emoji (without colons, e.g., "thumbsup")'),
  })
  .describe('Add a reaction emoji to a message');

export const RemoveReactionSchema = z
  .object({
    channel: z
      .string()
      .min(1, 'Channel ID is required')
      .describe('Channel where the message is located'),
    message_ts: z
      .string()
      .min(1, 'Message timestamp is required')
      .describe('Timestamp of the message to remove reaction from'),
    reaction_name: z
      .string()
      .min(1, 'Reaction name is required')
      .describe('Name of reaction emoji to remove (without colons)'),
  })
  .describe('Remove a reaction emoji from a message');

export const GetReactionsSchema = z
  .object({
    channel: z
      .string()
      .min(1, 'Channel ID is required')
      .describe('Channel where the message is located'),
    message_ts: z
      .string()
      .min(1, 'Message timestamp is required')
      .describe('Timestamp of the message to get reactions for'),
    full: z
      .boolean()
      .optional()
      .default(false)
      .describe('Include full user info for reaction users'),
  })
  .describe('Get all reactions on a specific message');

export const GetReactionStatisticsSchema = z
  .object({
    channel: z.string().optional().describe('Limit statistics to specific channel'),
    user: z.string().optional().describe('Limit statistics to specific user'),
    days_back: z
      .number()
      .min(1)
      .max(365)
      .optional()
      .default(30)
      .describe('Number of days back to analyze (1-365)'),
    include_trends: z.boolean().optional().default(true).describe('Include daily trends analysis'),
    top_count: z
      .number()
      .optional()
      .default(10)
      .describe('Number of top reactions/users to include'),
  })
  .describe('Get reaction statistics and trends for workspace or channel');

export const FindMessagesByReactionsSchema = z
  .object({
    reactions: z
      .array(z.string())
      .min(1, 'At least one reaction is required')
      .describe('Reaction names to search for'),
    channel: z.string().optional().describe('Limit search to specific channel'),
    match_type: z
      .enum(['any', 'all'])
      .optional()
      .default('any')
      .describe('Match any of the reactions or all of them'),
    min_reaction_count: z
      .number()
      .optional()
      .default(1)
      .describe('Minimum total reactions required'),
    after: z.string().optional().describe('Search messages after date (YYYY-MM-DD)'),
    before: z.string().optional().describe('Search messages before date (YYYY-MM-DD)'),
    limit: z
      .number()
      .min(1)
      .max(100)
      .optional()
      .default(20)
      .describe('Maximum number of messages to return (1-100)'),
  })
  .describe('Find messages that have specific reaction patterns');

/**
 * Workspace management validation schemas
 */
export const GetWorkspaceInfoSchema = z
  .object({})
  .describe('Get workspace/team information and settings');

export const ListTeamMembersSchema = z
  .object({
    include_deleted: z
      .boolean()
      .optional()
      .default(false)
      .describe('Include deleted users in results'),
    include_bots: z.boolean().optional().default(true).describe('Include bot users in results'),
    include_profile_details: z
      .boolean()
      .optional()
      .default(true)
      .describe(
        'Include detailed profile information. When false, returns only core fields and single image for optimized response size'
      ),
    cursor: z.string().optional().describe('Pagination cursor'),
    limit: z
      .number()
      .min(1)
      .max(200)
      .optional()
      .default(100)
      .describe('Maximum number of members to return per page (1-200)'),
    fetch_all_pages: z
      .boolean()
      .optional()
      .default(false)
      .describe('Whether to fetch all pages at once instead of single page'),
    max_pages: z
      .number()
      .min(1)
      .max(PAGINATION_DEFAULTS.MAX_PAGES_LIMIT)
      .optional()
      .describe('Maximum number of pages to fetch when fetch_all_pages is true'),
    max_items: z
      .number()
      .min(1)
      .max(PAGINATION_DEFAULTS.MAX_ITEMS_LIMIT)
      .optional()
      .describe('Maximum total items to fetch when fetch_all_pages is true'),
  })
  .describe('List all team members with their roles and status with optional pagination support');

/**
 * Analytics and reporting validation schemas
 */
export const GetWorkspaceActivitySchema = z
  .object({
    // Date range parameters (recommended, user-friendly)
    after_date: z
      .string()
      .optional()
      .describe(
        'Start date in YYYY-MM-DD format, inclusive (00:00:00 UTC). Activity from this date onwards will be included. Example: "2025-09-01". Cannot be used with oldest_ts.'
      ),
    before_date: z
      .string()
      .optional()
      .describe(
        'End date in YYYY-MM-DD format, inclusive (23:59:59 UTC). Activity up to and including this date will be included. Example: "2025-09-30". Cannot be used with latest_ts.'
      ),

    // Timestamp range parameters (advanced, for precise second-level control)
    oldest_ts: z
      .string()
      .optional()
      .describe(
        'Start Unix timestamp in seconds. For precise second-level control. Cannot be used with after_date.'
      ),
    latest_ts: z
      .string()
      .optional()
      .describe(
        'End Unix timestamp in seconds. For precise second-level control. Cannot be used with before_date.'
      ),

    include_user_details: z
      .boolean()
      .optional()
      .default(true)
      .describe('Include detailed user activity breakdown'),
    include_channel_details: z
      .boolean()
      .optional()
      .default(true)
      .describe('Include detailed channel activity breakdown'),
    top_count: z
      .number()
      .optional()
      .default(10)
      .describe('Number of top users/channels to include'),
    fetch_all_pages: z
      .boolean()
      .optional()
      .default(false)
      .describe('Whether to fetch all pages at once instead of single page'),
    max_pages: z
      .number()
      .min(1)
      .max(PAGINATION_DEFAULTS.MAX_PAGES_LIMIT)
      .optional()
      .describe('Maximum number of pages to fetch when fetch_all_pages is true'),
    max_items: z
      .number()
      .min(1)
      .max(PAGINATION_DEFAULTS.MAX_ITEMS_LIMIT)
      .optional()
      .describe('Maximum total items to fetch when fetch_all_pages is true'),
  })
  .refine((data) => !(data.after_date && data.oldest_ts), {
    message:
      'Cannot specify both after_date and oldest_ts. Use date strings OR timestamps, not both.',
  })
  .refine((data) => !(data.before_date && data.latest_ts), {
    message:
      'Cannot specify both before_date and latest_ts. Use date strings OR timestamps, not both.',
  })
  .describe('Generate comprehensive workspace activity report');

export const GetServerHealthSchema = z
  .object({
    include_rate_limits: z
      .boolean()
      .optional()
      .default(true)
      .describe('Include current rate limit status'),
    include_response_times: z
      .boolean()
      .optional()
      .default(true)
      .describe('Include API response time statistics'),
  })
  .describe('Get MCP server health status and performance metrics');

/**
 * Generic validation helper
 */
export function validateInput<T>(schema: z.ZodSchema<T>, input: unknown): T {
  const result = schema.safeParse(input);

  if (!result.success) {
    const errors = result.error.errors.map((err) => `${err.path.join('.')}: ${err.message}`);
    throw new Error(`Validation failed: ${errors.join(', ')}`);
  }

  return result.data;
}

/**
 * Applies implicit safety defaults for pagination parameters when fetch_all_pages is true
 * This prevents memory and performance issues by applying reasonable limits
 */
export function applyPaginationSafetyDefaults<T extends Record<string, unknown>>(
  input: T
): T & { max_pages?: number; max_items?: number } {
  if (!input.fetch_all_pages) {
    return input;
  }

  const result = { ...input } as T & { max_pages?: number; max_items?: number };

  // Apply implicit defaults only if not explicitly specified
  if (result.max_pages === undefined || result.max_pages === null) {
    result.max_pages = PAGINATION_DEFAULTS.MAX_PAGES;
  }

  if (result.max_items === undefined || result.max_items === null) {
    result.max_items = PAGINATION_DEFAULTS.MAX_ITEMS;
  }

  return result;
}

// Existing types
export type SendMessageInput = z.infer<typeof SendMessageSchema>;
export type ListChannelsInput = z.infer<typeof ListChannelsSchema>;
export type GetChannelHistoryInput = z.infer<typeof GetChannelHistorySchema>;
export type GetUserInfoInput = z.infer<typeof GetUserInfoSchema>;
export type SearchMessagesInput = z.infer<typeof SearchMessagesSchema>;

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
export type GetMessageImagesInput = z.infer<typeof GetMessageImagesSchema>;

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
