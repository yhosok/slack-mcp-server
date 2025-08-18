/**
 * Thread service output types following TypeSafeAPI + ts-pattern TypeScript best practices
 * All types extend ServiceOutput (Record<string, any>) for TypeSafeAPI compliance
 */

import type { ServiceOutput, ServiceResult } from '../typesafe-api-patterns';
import type { ThreadParticipant, ActionItem } from '../index';
import type { SentimentAnalysisResult } from '../../analysis/thread/types';

export interface ThreadDiscoveryOutput extends ServiceOutput {
  threads: Array<{
    threadTs: string | undefined;
    parentMessage: {
      text: string | undefined;
      user: string | undefined;
      timestamp: string | undefined;
      userDisplayName?: string;
    };
    replyCount: number;
    lastReply: string | undefined;
    participants: string[];
    participantDisplayNames?: Array<{
      id: string;
      displayName: string;
    }>;
  }>;
  total: number;
  hasMore: boolean;
  cursor: string | undefined;
  [key: string]: unknown;
}

export interface ThreadRepliesOutput extends ServiceOutput {
  messages: Array<{
    type: string;
    user?: string;
    text?: string;
    ts?: string;
    thread_ts?: string;
    reply_count?: number;
    reactions?: Array<{
      name: string;
      count: number;
      users: string[];
    }>;
  }>;
  hasMore: boolean;
  cursor?: string;
  totalMessages: number;
  threadInfo: {
    channel: string;
    threadTs: string;
  };
  [key: string]: unknown;
}

export interface ThreadSearchOutput extends ServiceOutput {
  results: Array<{
    text?: string;
    user?: string;
    ts?: string;
    channel?: {
      id?: string;
      name?: string;
    };
    thread_ts?: string;
    reply_count?: number;
    permalink?: string;
  }>;
  total: number;
  query: string;
  hasMore?: boolean;
  [key: string]: unknown;
}

export interface ThreadAnalysisOutput extends ServiceOutput {
  threadInfo: {
    channel: string;
    threadTs: string;
    messageCount: number;
  };
  participants: ThreadParticipant[];
  timeline: Array<{
    timestamp: string;
    event_type: 'message' | 'reaction' | 'edit';
    user_id: string;
    content: string;
  }>;
  keyTopics: string[];
  urgencyScore: number;
  importanceScore: number;
  sentiment: SentimentAnalysisResult;
  actionItems: ActionItem[];
  summary: string;
  wordCount: number;
  durationHours: number;
  analysisMetadata: {
    includeTimeline: boolean;
    includeSentimentAnalysis: boolean;
    includeActionItems: boolean;
    includeTopics: boolean;
  };
  [key: string]: unknown;
}

export interface ThreadSummaryOutput extends ServiceOutput {
  threadInfo: {
    channel: string;
    threadTs: string;
    messageCount: number;
    summary?: string;
  };
  summary: {
    messageCount: number;
    participantCount: number;
    duration: string;
    urgencyLevel: 'low' | 'medium' | 'high' | 'critical';
    actionItemCount: number;
  };
  keyPoints?: string[];
  decisionsMade?: Array<{
    decision: string;
    timestamp: string;
    user: string;
  }>;
  actionItems?: ActionItem[];
  sentiment: SentimentAnalysisResult;
  language: string;
  summaryLength: 'brief' | 'detailed' | 'comprehensive';
  [key: string]: unknown;
}

export interface ActionItemsOutput extends ServiceOutput {
  actionItems: readonly ActionItem[];
  extractedAt: string;
  threadInfo: {
    channel: string;
    threadTs: string;
    messageCount: number;
  };
  totalActionItems: number;
  priorityBreakdown: {
    high: number;
    medium: number;
    low: number;
  };
  statusBreakdown?: {
    pending: number; // maps to 'open' status
    in_progress: number;
    completed: number;
  };
  [key: string]: unknown;
}

export interface ThreadReplyOutput extends ServiceOutput {
  success: boolean;
  timestamp?: string;
  channel?: string;
  threadTs: string;
  message?: { text?: string; user?: string; timestamp?: string };
  replyInfo: {
    posted: boolean;
    broadcast?: boolean;
  };
  [key: string]: unknown;
}

export interface CreateThreadOutput extends ServiceOutput {
  success: boolean;
  threadTs: string;
  parentMessage: {
    timestamp?: string;
    channel?: string;
    message?: { text?: string; user?: string; timestamp?: string };
  };
  reply?: {
    timestamp?: string;
    message?: { text?: string; user?: string; timestamp?: string };
  } | null;
  threadInfo: {
    created: boolean;
    hasReply: boolean;
  };
  [key: string]: unknown;
}

export interface MarkImportantOutput extends ServiceOutput {
  success: boolean;
  channel: string;
  threadTs: string;
  importanceLevel: 'low' | 'medium' | 'high' | 'critical';
  reactionAdded: string;
  commentPosted: boolean;
  reason?: string;
  [key: string]: unknown;
}

export interface ImportantThreadsOutput extends ServiceOutput {
  importantThreads: Array<{
    channel: string;
    threadTs: string | undefined;
    parentMessage: {
      text: string | undefined;
      user: string | undefined;
      timestamp: string | undefined;
    };
    importanceScore: number;
    analysis: {
      messageCount: number;
      participantCount: number;
      urgencyLevel: 'low' | 'medium' | 'high' | 'critical';
      actionItemCount: number;
      duration: number;
    };
  }>;
  total: number;
  criteria: string[];
  threshold: number;
  timeRange: {
    hours: number;
    from: string;
    to: string;
  };
  [key: string]: unknown;
}

export interface ThreadExportOutput extends ServiceOutput {
  format: 'markdown' | 'json' | 'html' | 'csv';
  threadInfo: {
    channel: string;
    threadTs: string;
    messageCount: number;
    exportedAt: string;
  };
  messages: Array<{
    user?: string;
    text?: string;
    timestamp?: string;
    reactions?: Array<{ name: string; count: number; users?: string[] }>;
  }>;
  userProfiles?: Record<string, { displayName: string }>;
  exportMetadata: {
    includeReactions: boolean;
    includeUserProfiles: boolean;
    includeMetadata: boolean;
  };
  [key: string]: unknown;
}

export interface RelatedThreadsOutput extends ServiceOutput {
  relatedThreads: Array<{
    channel: string;
    threadTs: string | undefined;
    parentMessage: {
      text: string | undefined;
      user: string | undefined;
      timestamp: string | undefined;
    };
    similarityScore: number;
    relationshipTypes: string[];
    analysis: {
      messageCount: number;
      urgencyLevel: 'low' | 'medium' | 'high' | 'critical';
      actionItemCount: number;
    };
  }>;
  total: number;
  referenceThread: string;
  similarityThreshold: number;
  relationshipCriteria: string[];
  [key: string]: unknown;
}

export interface ThreadMetricsOutput extends ServiceOutput {
  summary: {
    totalThreads: number;
    averageReplies: number;
    totalMessages: number;
  };
  topParticipants: Array<{
    user: string;
    messageCount: number;
  }>;
  activityPatterns: Array<{
    hour: number;
    threadCount: number;
  }>;
  analysisConfig: {
    timeZone: string;
    channel?: string;
    dateRange: {
      after?: string;
      before?: string;
    };
  };
  timeDistribution: {
    hourly: Record<number, number>;
    daily?: Record<string, number>;
  };
  [key: string]: unknown;
}

export interface ThreadsByParticipantsOutput extends ServiceOutput {
  threads: Array<{
    channel: string;
    threadTs: string;
    parentMessage: {
      text?: string;
      user?: string;
      timestamp?: string;
    };
    participants: string[];
    messageCount: number;
    matchingParticipants: string[];
  }>;
  total: number;
  searchedParticipants: string[];
  requireAllParticipants: boolean;
  searchCriteria: {
    channelFilter?: string;
    dateRange?: {
      after?: string;
      before?: string;
    };
  };
  [key: string]: unknown;
}

/**
 * TypeSafeAPI + ts-pattern discriminated union types for type-safe service results
 */
export type ThreadDiscoveryResult = ServiceResult<ThreadDiscoveryOutput>;
export type ThreadRepliesResult = ServiceResult<ThreadRepliesOutput>;
export type ThreadSearchResult = ServiceResult<ThreadSearchOutput>;
export type ThreadAnalysisResult = ServiceResult<ThreadAnalysisOutput>;
export type ThreadSummaryResult = ServiceResult<ThreadSummaryOutput>;
export type ActionItemsResult = ServiceResult<ActionItemsOutput>;
export type ThreadReplyResult = ServiceResult<ThreadReplyOutput>;
export type CreateThreadResult = ServiceResult<CreateThreadOutput>;
export type MarkImportantResult = ServiceResult<MarkImportantOutput>;
export type ImportantThreadsResult = ServiceResult<ImportantThreadsOutput>;
export type ThreadExportResult = ServiceResult<ThreadExportOutput>;
export type RelatedThreadsResult = ServiceResult<RelatedThreadsOutput>;
export type ThreadMetricsResult = ServiceResult<ThreadMetricsOutput>;
export type ThreadsByParticipantsResult = ServiceResult<ThreadsByParticipantsOutput>;
