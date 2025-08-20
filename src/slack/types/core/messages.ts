/**
 * Message-related type definitions for Slack API
 *
 * This module contains types for messages, blocks, attachments, and related structures.
 * Part of the modular type system following TypeScript official best practices.
 */

// Import common types
import type { SlackReaction } from './common.js';

/**
 * Represents a message in a Slack channel or thread
 */
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
  reply_count?: number;
}

/**
 * Represents a Slack Block Kit block element
 */
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

/**
 * Represents a message attachment
 */
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

/**
 * Represents a field within a message attachment
 */
export interface SlackAttachmentField {
  title: string;
  value: string;
  short: boolean;
}
