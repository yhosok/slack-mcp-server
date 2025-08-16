/**
 * Channel-related type definitions for Slack API
 * 
 * This module contains types for channels and channel-related structures.
 * Part of the modular type system following TypeScript official best practices.
 */

// Import required types from messages module
import type { SlackMessage } from './messages.js';

/**
 * Represents a Slack channel
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