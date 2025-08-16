/**
 * File-related type definitions for Slack API
 * 
 * This module contains types for files, file sharing, and file analysis.
 * Part of the modular type system following TypeScript official best practices.
 */

/**
 * Represents a file uploaded to Slack
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

/**
 * Represents sharing information for a file
 */
export interface SlackFileShare {
  reply_users?: string[];
  reply_users_count?: number;
  reply_count?: number;
  ts: string;
  channel_name: string;
  team_id: string;
}

/**
 * Represents a comment on a file
 */
export interface SlackFileComment {
  id: string;
  created: number;
  timestamp: number;
  user: string;
  comment: string;
}

/**
 * Represents analysis results for files in a workspace
 */
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