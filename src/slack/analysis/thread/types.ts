/**
 * Pure thread analysis types and interfaces
 * These types are used by the pure analysis functions
 */

import type {
  SlackMessage,
  ThreadParticipant,
  ThreadTimelineEvent,
  ActionItem,
} from '../../types/index.js';

/**
 * Input data structures for analysis functions
 */
export interface AnalysisInput {
  readonly messages: readonly SlackMessage[];
  readonly participants: readonly ThreadParticipant[];
}

/**
 * Sentiment analysis types
 */
export type SentimentScore = 'positive' | 'neutral' | 'negative';

export interface SentimentAnalysisResult {
  readonly sentiment: SentimentScore;
  readonly positiveCount: number;
  readonly negativeCount: number;
  readonly totalWords: number;
}

/**
 * Topic extraction types
 */
export interface TopicExtractionResult {
  readonly topics: readonly string[];
  readonly wordCounts: ReadonlyMap<string, number>;
  readonly hasJapaneseContent: boolean;
  readonly hasEnglishContent: boolean;
}

/**
 * Urgency and importance scoring types
 */
export interface UrgencyScore {
  readonly score: number;
  readonly urgentKeywords: readonly string[];
  readonly messageCountFactor: number;
}

export interface ImportanceScore {
  readonly score: number;
  readonly participantFactor: number;
  readonly messageFactor: number;
  readonly keywordFactor: number;
  readonly importantKeywords: readonly string[];
}

/**
 * Action item extraction types
 */
export interface ActionItemExtractionResult {
  readonly actionItems: readonly ActionItem[];
  readonly totalActionIndicators: number;
  readonly actionIndicatorsFound: readonly string[];
}

export interface PriorityAnalysisResult {
  readonly priority: 'low' | 'medium' | 'high';
  readonly keywordsFound: readonly string[];
  readonly priorityLevel: number;
}

export interface StatusAnalysisResult {
  readonly status: 'open' | 'in_progress' | 'completed';
  readonly keywordsFound: readonly string[];
  readonly confidence: number;
}

/**
 * Timeline building types
 */
export interface TimelineEvent extends ThreadTimelineEvent {
  readonly messageIndex: number;
  readonly timeSinceStart: number; // minutes since first message
}

export interface TimelineAnalysisResult {
  readonly events: readonly TimelineEvent[];
  readonly totalDuration: number; // minutes
  readonly averageResponseTime: number; // minutes
  readonly messageVelocity: number; // messages per hour
}

/**
 * Multilingual analysis types
 */
export interface MultilingualContent {
  readonly hasJapanese: boolean;
  readonly hasEnglish: boolean;
  readonly mixedLanguage: boolean;
  readonly primaryLanguage: 'japanese' | 'english' | 'mixed';
}

/**
 * Keyword analysis types
 */
export interface KeywordAnalysis {
  readonly keywords: readonly string[];
  readonly frequency: ReadonlyMap<string, number>;
  readonly normalizedText: string;
  readonly language: 'japanese' | 'english' | 'mixed';
}

/**
 * Configuration interfaces for analysis functions
 */
export interface SentimentConfig {
  readonly positiveWords: readonly string[];
  readonly negativeWords: readonly string[];
  readonly threshold: number;
}

export interface TopicExtractionConfig {
  readonly maxTopics: number;
  readonly minWordLength: number;
  readonly japaneseStopWords: ReadonlySet<string>;
  readonly englishStopWords: ReadonlySet<string>;
  readonly preferKanji: boolean;
  readonly preferKatakana: boolean;
}

export interface UrgencyConfig {
  readonly urgentKeywords: readonly string[];
  readonly keywordWeight: number;
  readonly messageCountThresholds: {
    readonly medium: number;
    readonly high: number;
  };
  readonly messageCountWeight: number;
}

export interface ImportanceConfig {
  readonly importantKeywords: readonly string[];
  readonly participantWeight: number;
  readonly messageWeight: number;
  readonly keywordWeight: number;
  readonly maxParticipantScore: number;
  readonly maxMessageScore: number;
}

export interface ActionItemConfig {
  readonly actionIndicators: readonly string[];
  readonly priorityKeywords: {
    readonly high: readonly string[];
    readonly medium: readonly string[];
  };
  readonly statusKeywords: {
    readonly completed: readonly string[];
    readonly inProgress: readonly string[];
  };
}
