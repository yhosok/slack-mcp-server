/**
 * Reaction service output types following Context7 TypeScript best practices
 * All types extend ServiceOutput for JSON serialization safety
 */

import type { ServiceOutput } from '../context7-patterns.js';

export interface AddReactionOutput extends ServiceOutput {
  success: boolean;
  channel: string;
  message_ts: string;
  reaction_name: string;
  message: string;
}

export interface RemoveReactionOutput extends ServiceOutput {
  success: boolean;
  channel: string;
  message_ts: string;
  reaction_name: string;
  message: string;
}

export interface GetReactionsOutput extends ServiceOutput {
  reactions: Array<{
    name: string;
    count: number;
    users: string[];
  }>;
  message: {
    type: string;
    user: string;
    text: string;
    ts: string;
  };
  channel: string;
}

export interface ReactionStatisticsOutput extends ServiceOutput {
  totalReactions: number;
  topReactions: Array<{
    name: string;
    count: number;
    percentage: number;
  }>;
  topUsers: Array<{
    userId: string;
    reactionCount: number;
  }>;
  trends: Array<{
    date: string;
    count: number;
  }>;
  period: string;
}