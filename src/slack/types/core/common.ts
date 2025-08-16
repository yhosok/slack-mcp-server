/**
 * Common type definitions used across multiple Slack API domains
 * 
 * This module contains shared types that are used by multiple other type modules.
 * Part of the modular type system following TypeScript official best practices.
 */

/**
 * Represents an emoji reaction on a message
 * 
 * Note: This type is imported and re-exported by messages.ts for backward compatibility
 */
export interface SlackReaction {
  name: string;
  users: string[];
  count: number;
}

/**
 * Represents an action item extracted from a thread
 */
export interface ActionItem {
  text: string;
  mentioned_users: string[];
  due_date?: string;
  priority: 'low' | 'medium' | 'high';
  status: 'open' | 'in_progress' | 'completed';
  extracted_from_message_ts: string;
}