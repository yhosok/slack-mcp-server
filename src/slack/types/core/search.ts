/**
 * Search and relevance scoring type definitions for Slack MCP Server
 *
 * This module contains types for search analysis, relevance scoring, and decision extraction.
 */

// Types are referenced in other modules but not directly used in this file

/**
 * Individual relevance score for a message
 */
export interface RelevanceScore {
  tfidfScore: number;
  timeDecayScore: number;
  engagementScore: number;
  compositeScore: number;
  confidence: number;
}

/**
 * Enhanced relevance score with additional metrics
 */
export interface EnhancedRelevanceScore extends RelevanceScore {
  urgencyScore?: number;
  importanceScore?: number;
  messageIndex: number;
  timestamp: string;
}

/**
 * TF-IDF calculation result
 */
export interface TFIDFResult {
  scores: number[];
  fieldBoosts: Record<string, number>;
  cacheHit?: boolean;
  queryProcessingTime?: number;
}

/**
 * Complete relevance calculation result
 */
export interface RelevanceResult {
  scores: RelevanceScore[];
  processingTime?: number;
  cacheHit?: boolean;
  totalMessages: number;
}

/**
 * Configuration for relevance scorer
 */
export interface RelevanceScorerConfig {
  weights: {
    tfidf: number;
    timeDecay: number;
    engagement: number;
    urgency: number;
    importance: number;
  };
  timeDecayHalfLife: number; // hours
  miniSearchConfig: {
    fields: string[];
    storeFields: string[];
    searchOptions: {
      boost: Record<string, number>;
      fuzzy: number;
    };
  };
  engagementMetrics: {
    reactionWeight: number;
    replyWeight: number;
    mentionWeight: number;
  };
  cacheTTL?: number; // milliseconds
}

/**
 * Decision extraction result
 */
export interface DecisionExtractionResult {
  decisions: Array<{
    text: string;
    confidence: number;
    keywords: string[];
    messageIndex: number;
    timestamp: string;
    language?: 'en' | 'ja';
  }>;
  totalMessages: number;
  decisionsMade?: Array<{
    decision: string;
    confidence: number;
    participant?: string;
    timestamp: string;
  }>;
  [key: string]: unknown; // Make it compatible with ServiceOutput
}