/**
 * Type definitions for Slack API responses and data structures
 */

export interface SlackChannel {
  id: string;
  name: string;
  is_channel: boolean;
  is_group: boolean;
  is_im: boolean;
  is_private: boolean;
  created: number;
  creator: string;
  is_archived: boolean;
  is_general: boolean;
  unlinked: number;
  name_normalized: string;
  is_shared: boolean;
  is_ext_shared: boolean;
  is_org_shared: boolean;
  pending_shared: string[];
  pending_connected_team_ids: string[];
  is_pending_ext_shared: boolean;
  is_member: boolean;
  is_open: boolean;
  last_read: string;
  latest: SlackMessage;
  unread_count: number;
  unread_count_display: number;
  topic: {
    value: string;
    creator: string;
    last_set: number;
  };
  purpose: {
    value: string;
    creator: string;
    last_set: number;
  };
  num_members?: number;
}

export interface SlackMessage {
  type: string;
  user?: string;
  text?: string;
  ts: string;
  thread_ts?: string;
  edited?: {
    user: string;
    ts: string;
  };
  bot_id?: string;
  app_id?: string;
  username?: string;
  blocks?: SlackBlock[];
  attachments?: SlackAttachment[];
  reactions?: SlackReaction[];
}

export interface SlackUser {
  id: string;
  team_id: string;
  name: string;
  deleted: boolean;
  color: string;
  real_name: string;
  tz: string;
  tz_label: string;
  tz_offset: number;
  profile: SlackUserProfile;
  is_admin: boolean;
  is_owner: boolean;
  is_primary_owner: boolean;
  is_restricted: boolean;
  is_ultra_restricted: boolean;
  is_bot: boolean;
  is_app_user: boolean;
  updated: number;
  is_email_confirmed: boolean;
  who_can_share_contact_card: string;
}

export interface SlackUserProfile {
  avatar_hash: string;
  status_text: string;
  status_emoji: string;
  real_name: string;
  display_name: string;
  real_name_normalized: string;
  display_name_normalized: string;
  email?: string;
  image_original?: string;
  image_24: string;
  image_32: string;
  image_48: string;
  image_72: string;
  image_192: string;
  image_512: string;
  team: string;
}

export interface SlackBlock {
  type: string;
  block_id?: string;
  text?: {
    type: string;
    text: string;
    emoji?: boolean;
  };
  accessory?: unknown;
  fields?: unknown[];
  elements?: unknown[];
}

export interface SlackAttachment {
  color?: string;
  fallback?: string;
  id: number;
  author_icon?: string;
  author_link?: string;
  author_name?: string;
  fields?: SlackAttachmentField[];
  footer?: string;
  footer_icon?: string;
  image_url?: string;
  pretext?: string;
  text?: string;
  thumb_url?: string;
  title?: string;
  title_link?: string;
  ts?: number;
}

export interface SlackAttachmentField {
  title: string;
  value: string;
  short: boolean;
}

export interface SlackReaction {
  name: string;
  users: string[];
  count: number;
}

/**
 * Search-related types
 */
export interface MessageSearchResult {
  matches: SearchMatch[];
  paging: {
    count: number;
    total: number;
    page: number;
    pages: number;
  };
  query: string;
}

export interface SearchMatch {
  type: string;
  channel: {
    id: string;
    name: string;
    is_private: boolean;
  };
  user: string;
  username: string;
  ts: string;
  text: string;
  permalink: string;
  previous?: SlackMessage;
  previous_2?: SlackMessage;
  next?: SlackMessage;
  next_2?: SlackMessage;
}

/**
 * API Response types
 */
export interface SlackAPIResponse<T = unknown> {
  ok: boolean;
  error?: string;
  data?: T;
  response_metadata?: {
    next_cursor?: string;
  };
}

export interface ListChannelsResponse extends SlackAPIResponse {
  channels?: SlackChannel[];
}

export interface ConversationHistoryResponse extends SlackAPIResponse {
  messages?: SlackMessage[];
  has_more?: boolean;
}

export interface UserInfoResponse extends SlackAPIResponse {
  user?: SlackUser;
}

export interface PostMessageResponse extends SlackAPIResponse {
  channel?: string;
  ts?: string;
  message?: SlackMessage;
}

/**
 * Thread-specific types and interfaces
 */
export interface SlackThread {
  parent_message: SlackMessage;
  replies: SlackMessage[];
  reply_count: number;
  reply_users: string[];
  reply_users_count: number;
  latest_reply: string;
  thread_ts: string;
  channel_id: string;
}

export interface ThreadSearchResult {
  thread: SlackThread;
  relevance_score?: number;
  matched_messages: SlackMessage[];
  match_reason: string;
}

export interface ThreadAnalysis {
  thread_ts: string;
  channel_id: string;
  participants: ThreadParticipant[];
  timeline: ThreadTimelineEvent[];
  key_topics: string[];
  urgency_score: number;
  importance_score: number;
  sentiment: 'positive' | 'neutral' | 'negative';
  action_items: ActionItem[];
  summary: string;
  word_count: number;
  duration_hours: number;
}

export interface ThreadParticipant {
  user_id: string;
  username: string;
  real_name?: string;
  message_count: number;
  first_message_ts: string;
  last_message_ts: string;
  avg_response_time_minutes?: number;
}

export interface ThreadTimelineEvent {
  timestamp: string;
  user_id: string;
  event_type: 'message' | 'reaction' | 'edit' | 'delete';
  content?: string;
  reaction_name?: string;
}

export interface ActionItem {
  text: string;
  mentioned_users: string[];
  due_date?: string;
  priority: 'low' | 'medium' | 'high';
  status: 'open' | 'in_progress' | 'completed';
  extracted_from_message_ts: string;
}

export interface ThreadSummary {
  thread_ts: string;
  channel_id: string;
  title: string;
  brief_summary: string;
  key_points: string[];
  decisions_made: string[];
  action_items: ActionItem[];
  participants: string[];
  message_count: number;
  duration: string;
  status: 'active' | 'resolved' | 'stale';
}

export interface ThreadMetrics {
  total_threads: number;
  active_threads: number;
  resolved_threads: number;
  stale_threads: number;
  avg_messages_per_thread: number;
  avg_participants_per_thread: number;
  avg_duration_hours: number;
  top_participants: { user_id: string; thread_count: number }[];
  busiest_channels: { channel_id: string; thread_count: number }[];
  thread_activity_by_hour: { hour: number; thread_count: number }[];
}

export interface RelatedThread {
  thread_ts: string;
  channel_id: string;
  similarity_score: number;
  relationship_type: 'keyword_overlap' | 'participant_overlap' | 'temporal_proximity' | 'topic_similarity';
  brief_summary: string;
}

export interface ThreadExportOptions {
  format: 'markdown' | 'json' | 'html' | 'csv';
  include_metadata: boolean;
  include_reactions: boolean;
  include_user_profiles: boolean;
  date_format?: string;
}

export interface ThreadExportResult {
  format: string;
  content: string;
  filename: string;
  size_bytes: number;
  export_timestamp: string;
}

/**
 * API Response types for thread operations
 */
export interface ConversationRepliesResponse extends SlackAPIResponse {
  messages?: SlackMessage[];
  has_more?: boolean;
}

export interface FindThreadsResponse extends SlackAPIResponse {
  threads?: SlackThread[];
  total_count?: number;
}

export interface ThreadAnalysisResponse extends SlackAPIResponse {
  analysis?: ThreadAnalysis;
}

export interface SearchThreadsResponse extends SlackAPIResponse {
  results?: ThreadSearchResult[];
  total_count?: number;
}

export interface ThreadMetricsResponse extends SlackAPIResponse {
  metrics?: ThreadMetrics;
}

/**
 * File operation types and interfaces
 */
export interface SlackFile {
  id: string;
  created: number;
  timestamp: number;
  name: string;
  title: string;
  mimetype: string;
  filetype: string;
  pretty_type: string;
  user: string;
  username: string;
  size: number;
  mode: string;
  is_external: boolean;
  external_type: string;
  is_public: boolean;
  public_url_shared: boolean;
  display_as_bot: boolean;
  url_private: string;
  url_private_download: string;
  permalink: string;
  permalink_public?: string;
  edit_link?: string;
  preview?: string;
  preview_highlight?: string;
  lines?: number;
  lines_more?: number;
  is_starred: boolean;
  shares?: {
    public?: { [channel: string]: SlackFileShare[] };
    private?: { [channel: string]: SlackFileShare[] };
  };
  channels?: string[];
  groups?: string[];
  ims?: string[];
  has_rich_preview: boolean;
  file_access: string;
  comments_count: number;
  initial_comment?: SlackFileComment;
  num_stars?: number;
  is_tombstoned?: boolean;
}

export interface SlackFileShare {
  reply_users?: string[];
  reply_users_count?: number;
  reply_count?: number;
  ts: string;
  channel_name: string;
  team_id: string;
}

export interface SlackFileComment {
  id: string;
  created: number;
  timestamp: number;
  user: string;
  comment: string;
}

export interface FileUploadOptions {
  filename?: string;
  title?: string;
  initial_comment?: string;
  channels?: string[];
  thread_ts?: string;
  alt_txt?: string;
}

export interface FileAnalysis {
  total_files: number;
  total_size_bytes: number;
  by_type: { [filetype: string]: { count: number; size_bytes: number } };
  by_user: { [user: string]: { count: number; size_bytes: number } };
  by_channel: { [channel: string]: { count: number; size_bytes: number } };
  large_files: SlackFile[];
  old_files: SlackFile[];
  recent_activity: { date: string; uploads: number; size_bytes: number }[];
}

export interface FileSearchResult {
  files: SlackFile[];
  total_count: number;
  paging: {
    count: number;
    total: number;
    page: number;
    pages: number;
  };
}

/**
 * Reaction management types and interfaces
 */
export interface ReactionDetails {
  name: string;
  count: number;
  users: string[];
}

export interface MessageReactions {
  channel: string;
  message_ts: string;
  reactions: ReactionDetails[];
}

export interface ReactionStatistics {
  total_reactions: number;
  unique_reactions: number;
  most_used_reactions: { name: string; count: number; percentage: number }[];
  reaction_trends: { date: string; count: number; unique_reactions: string[] }[];
  top_reactors: { user: string; reaction_count: number; favorite_reactions: string[] }[];
}

export interface ReactionSearchResult {
  messages: Array<{
    channel: string;
    message_ts: string;
    message_text?: string;
    user: string;
    reactions: ReactionDetails[];
    match_reason: string;
  }>;
  total_matches: number;
}

/**
 * Workspace management types
 */
export interface WorkspaceInfo {
  id: string;
  name: string;
  domain: string;
  email_domain: string;
  icon: {
    image_34: string;
    image_44: string;
    image_68: string;
    image_88: string;
    image_102: string;
    image_132: string;
    image_230: string;
  };
  enterprise_id?: string;
  enterprise_name?: string;
}

export interface TeamMember {
  id: string;
  name: string;
  real_name: string;
  profile: SlackUserProfile;
  is_admin: boolean;
  is_owner: boolean;
  is_primary_owner: boolean;
  is_restricted: boolean;
  is_ultra_restricted: boolean;
  is_bot: boolean;
  is_app_user: boolean;
  is_invited_user: boolean;
  has_2fa: boolean;
  deleted: boolean;
  status?: {
    status_text: string;
    status_emoji: string;
    status_expiration?: number;
  };
}

export interface AppConfiguration {
  app_id: string;
  app_name: string;
  permissions: {
    scopes: string[];
    user_scopes?: string[];
  };
  bot_user?: {
    id: string;
    username: string;
    display_name: string;
  };
  oauth_redirect_urls: string[];
  features: {
    bot_user: boolean;
    shortcuts: boolean;
    slash_commands: boolean;
    event_subscriptions: boolean;
    interactive_components: boolean;
    unfurl_domains: boolean;
  };
}

/**
 * Analytics and reporting types
 */
export interface WorkspaceActivity {
  date_range: {
    start: string;
    end: string;
  };
  message_stats: {
    total_messages: number;
    public_messages: number;
    private_messages: number;
    dm_messages: number;
    bot_messages: number;
  };
  user_stats: {
    active_users: number;
    total_users: number;
    new_users: number;
    user_activity: { user_id: string; message_count: number; active_days: number }[];
  };
  channel_stats: {
    active_channels: number;
    total_channels: number;
    new_channels: number;
    channel_activity: { channel_id: string; message_count: number; member_count: number }[];
  };
  file_stats: {
    files_uploaded: number;
    total_storage_bytes: number;
    storage_by_type: { [type: string]: number };
  };
  integration_stats: {
    api_calls: number;
    rate_limit_hits: number;
    error_rate: number;
  };
}

export interface ServerHealth {
  status: 'healthy' | 'degraded' | 'unhealthy';
  uptime_seconds: number;
  memory_usage: {
    used: number;
    total: number;
    percentage: number;
  };
  rate_limits: {
    remaining: number;
    reset_at: number;
    limit: number;
  };
  last_api_call: string;
  error_count_last_hour: number;
  response_times: {
    avg_ms: number;
    p95_ms: number;
    p99_ms: number;
  };
}

/**
 * API Response types for new features
 */
export interface FilesListResponse extends SlackAPIResponse {
  files?: SlackFile[];
  paging?: {
    count: number;
    total: number;
    page: number;
    pages: number;
  };
}

export interface FileInfoResponse extends SlackAPIResponse {
  file?: SlackFile;
  comments?: SlackFileComment[];
  paging?: {
    count: number;
    total: number;
    page: number;
    pages: number;
  };
}

export interface FileUploadResponse extends SlackAPIResponse {
  file?: SlackFile;
}

export interface ReactionAddResponse extends SlackAPIResponse {
  // Standard response, no additional fields
}

export interface ReactionGetResponse extends SlackAPIResponse {
  type: string;
  channel?: string;
  message?: SlackMessage;
  file?: SlackFile;
  comment?: string;
}

export interface WorkspaceInfoResponse extends SlackAPIResponse {
  team?: WorkspaceInfo;
}

export interface TeamMembersResponse extends SlackAPIResponse {
  members?: TeamMember[];
  cache_ts?: number;
  response_metadata?: {
    next_cursor?: string;
  };
}

/**
 * Search input types for service methods
 */
export interface SearchThreadsInput {
  query: string;
  channel?: string;
  user?: string;
  after?: string;
  before?: string;
  sort?: 'timestamp' | 'relevance';
  sort_dir?: 'asc' | 'desc';
  limit?: number;
}