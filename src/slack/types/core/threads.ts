/**
 * Thread-related type definitions for Slack API
 * 
 * This module contains types for threads, thread analysis, and thread metrics.
 * Part of the modular type system following TypeScript official best practices.
 */

// Import required types from other modules
import type { SlackMessage } from './messages.js';
import type { ActionItem } from './common.js';

/**
 * Represents a complete Slack thread with its messages
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

/**
 * Represents detailed analysis results for a thread
 */
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

/**
 * Represents a participant in a thread
 */
export interface ThreadParticipant {
  user_id: string;
  username: string;
  real_name?: string;
  message_count: number;
  first_message_ts: string;
  last_message_ts: string;
  avg_response_time_minutes?: number;
}

/**
 * Represents an event in a thread's timeline
 */
export interface ThreadTimelineEvent {
  timestamp: string;
  user_id: string;
  event_type: 'message' | 'reaction' | 'edit' | 'delete';
  content?: string;
  reaction_name?: string;
}


/**
 * Represents a high-level summary of a thread
 */
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

/**
 * Represents metrics about threads in a workspace
 */
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