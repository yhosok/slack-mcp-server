/**
 * Slack Analysis Layer - Pure Functional Analysis Functions
 *
 * This module provides a comprehensive set of pure functions for analyzing Slack data.
 * All functions are side-effect free, immutable, and fully testable.
 *
 * Key Features:
 * - Sentiment analysis with multilingual support
 * - Topic extraction with Japanese/English processing
 * - Urgency and importance scoring
 * - Action item extraction and prioritization
 * - Timeline analysis and event processing
 * - Comprehensive formatting utilities
 */

// Thread Analysis Functions
export * from './thread/sentiment-analysis.js';
export * from './thread/topic-extraction.js';
export * from './thread/urgency-calculation.js';
export * from './thread/action-extraction.js';
export * from './thread/timeline-builder.js';
export * from './thread/types.js';

// Formatting Functions
export * from './formatters/general-formatters.js';
export * from './formatters/thread-formatters.js';
export * from './formatters/file-formatters.js';
export * from './formatters/types.js';

// Re-export key types for convenience
export type {
  SentimentScore,
  SentimentAnalysisResult,
  TopicExtractionResult,
  UrgencyScore,
  ImportanceScore,
  ActionItemExtractionResult,
  TimelineAnalysisResult,
} from './thread/types.js';

export type {
  FormatterConfig,
  ThreadAnalysisFormatterOptions,
  ThreadSummaryFormatterOptions,
  ThreadMetricsFormatterOptions,
  FileAnalysisFormatterOptions,
  FormattedResult,
} from './formatters/types.js';

/**
 * High-level analysis orchestration functions
 */

import type { SlackMessage, ThreadParticipant } from '../types/index.js';
import type {
  SentimentAnalysisResult,
  TopicExtractionResult,
  UrgencyScore,
  ImportanceScore,
  ActionItemExtractionResult,
  TimelineAnalysisResult,
} from './thread/types.js';

import { analyzeSentiment } from './thread/sentiment-analysis.js';
import { extractTopicsFromThread } from './thread/topic-extraction.js';
import { calculateUrgencyScore, calculateImportanceScore } from './thread/urgency-calculation.js';
import { extractActionItemsFromMessages } from './thread/action-extraction.js';
import { buildThreadTimeline } from './thread/timeline-builder.js';

/**
 * Comprehensive analysis result combining all analysis types
 */
export interface ComprehensiveAnalysisResult {
  readonly sentiment: SentimentAnalysisResult;
  readonly topics: TopicExtractionResult;
  readonly urgency: UrgencyScore;
  readonly importance: ImportanceScore;
  readonly actionItems: ActionItemExtractionResult;
  readonly timeline: TimelineAnalysisResult;
  readonly metadata: {
    readonly analysisTimestamp: number;
    readonly messageCount: number;
    readonly participantCount: number;
    readonly hasMultilingualContent: boolean;
  };
}

/**
 * Perform comprehensive analysis on thread messages with parallel processing optimization
 * @param messages - Array of Slack messages
 * @param participants - Array of thread participants
 * @returns Complete analysis result
 */
export async function performComprehensiveAnalysis(
  messages: readonly SlackMessage[],
  participants: readonly ThreadParticipant[]
): Promise<ComprehensiveAnalysisResult> {
  // Performance optimization: Run independent analyses in parallel
  const [sentiment, topics, urgency, importance, actionItems, timeline] = await Promise.all([
    Promise.resolve(analyzeSentiment(messages)),
    Promise.resolve(extractTopicsFromThread(messages)),
    Promise.resolve(calculateUrgencyScore(messages)),
    Promise.resolve(calculateImportanceScore(messages, participants)),
    Promise.resolve(extractActionItemsFromMessages(messages)),
    Promise.resolve(buildThreadTimeline(messages)),
  ]);

  return {
    sentiment,
    topics,
    urgency,
    importance,
    actionItems,
    timeline,
    metadata: {
      analysisTimestamp: Date.now(),
      messageCount: messages.length,
      participantCount: participants.length,
      hasMultilingualContent: topics.hasJapaneseContent && topics.hasEnglishContent,
    },
  };
}

/**
 * Quick analysis for basic thread insights with parallel processing optimization
 * @param messages - Array of Slack messages
 * @returns Basic analysis result
 */
export async function performQuickAnalysis(messages: readonly SlackMessage[]): Promise<{
  readonly sentiment: SentimentAnalysisResult;
  readonly topicCount: number;
  readonly urgencyLevel: 'low' | 'medium' | 'high' | 'critical';
  readonly actionItemCount: number;
  readonly duration: number;
}> {
  // Performance optimization: Run analyses in parallel for faster results
  const [sentiment, topics, urgency, actionItems, timeline] = await Promise.all([
    Promise.resolve(analyzeSentiment(messages)),
    Promise.resolve(extractTopicsFromThread(messages)),
    Promise.resolve(calculateUrgencyScore(messages)),
    Promise.resolve(extractActionItemsFromMessages(messages)),
    Promise.resolve(buildThreadTimeline(messages)),
  ]);

  // Determine urgency level
  let urgencyLevel: 'low' | 'medium' | 'high' | 'critical' = 'low';
  if (urgency.score >= 0.8) urgencyLevel = 'critical';
  else if (urgency.score >= 0.6) urgencyLevel = 'high';
  else if (urgency.score >= 0.3) urgencyLevel = 'medium';

  return {
    sentiment,
    topicCount: topics.topics.length,
    urgencyLevel,
    actionItemCount: actionItems.actionItems.length,
    duration: timeline.totalDuration,
  };
}
