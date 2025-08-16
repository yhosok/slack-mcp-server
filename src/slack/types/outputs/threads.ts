/**
 * Thread service output types following Context7 TypeScript best practices
 * All types extend Record<string, any> for JSON serialization safety
 */

import type { SlackThread, ThreadAnalysis, ThreadParticipant, ThreadMetrics } from '../core/threads.js';

export interface ThreadAnalysisOutput extends Record<string, any> {
  thread: SlackThread;
  analysis: ThreadAnalysis;
  participants: ThreadParticipant[];
  metrics: ThreadMetrics;
}

export interface ThreadSummaryOutput extends Record<string, any> {
  summary: string;
  keyPoints: string[];
  decisions: string[];
  actionItems: Array<{
    description: string;
    assignee?: string;
    priority: 'low' | 'medium' | 'high';
    status: 'pending' | 'in_progress' | 'completed';
  }>;
  metadata: {
    messageCount: number;
    participantCount: number;
    duration: string;
    status: string;
  };
}

export interface CreateThreadOutput extends Record<string, any> {
  success: boolean;
  thread_ts: string;
  channel: string;
  message: string;
  replies?: Array<{
    ts: string;
    text: string;
  }>;
}

export interface ThreadMetricsOutput extends Record<string, any> {
  totalThreads: number;
  averageReplies: number;
  topParticipants: Array<{
    userId: string;
    threadCount: number;
    replyCount: number;
  }>;
  timePatterns: Record<string, number>;
  summary: string;
}