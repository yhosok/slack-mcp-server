/**
 * Reaction service output types following TypeSafeAPI TypeScript best practices
 * All types extend ServiceOutput for JSON serialization safety
 */

import type { ServiceOutput, ServiceResult } from '../typesafe-api-patterns';

export interface AddReactionOutput extends ServiceOutput {
  success: boolean;
  channel: string;
  message_ts: string;
  reaction_name: string;
  message: string;
  [key: string]: unknown;

}

export interface RemoveReactionOutput extends ServiceOutput {
  success: boolean;
  channel: string;
  message_ts: string;
  reaction_name: string;
  message: string;
  [key: string]: unknown;

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
  totalReactions: number;
  [key: string]: unknown;

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
  [key: string]: unknown;

}

export interface FindMessagesByReactionsOutput extends ServiceOutput {
  messages: Array<{
    channel: string;
    text?: string;
    user?: string;
    timestamp?: string;
    reactions: Array<{
      name: string;
      count: number;
      users?: string[];
    }>;
    totalReactions: number;
    permalink?: string;
  }>;
  total: number;
  searchedReactions: string[];
  matchType: 'any' | 'all';
  minReactionCount: number;
  [key: string]: unknown;

}

/**
 * TypeSafeAPI + ts-pattern discriminated union types for type-safe service results
 */
export type AddReactionResult = ServiceResult<AddReactionOutput>;
export type RemoveReactionResult = ServiceResult<RemoveReactionOutput>;
export type GetReactionsResult = ServiceResult<GetReactionsOutput>;
export type ReactionStatisticsResult = ServiceResult<ReactionStatisticsOutput>;
export type FindMessagesByReactionsResult = ServiceResult<FindMessagesByReactionsOutput>;