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

import type { MultilingualContent } from '../shared/text-processing/multilingual-processor.js';

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
  readonly japanesePositiveCount?: number;
  readonly japaneseNegativeCount?: number;
  readonly negationAdjustments?: number;
  readonly emphasisAdjustments?: number;
  readonly mitigationAdjustments?: number;
  readonly languageContent?: MultilingualContent;
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
  readonly punctuationScore?: number;
  readonly timeBasedScore?: number;
  readonly punctuationInfo?: PunctuationInfo;
  readonly timeUrgencyInfo?: TimeUrgencyInfo;
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
// Note: MultilingualContent is now imported from shared utilities
// Re-export for backward compatibility
export type { MultilingualContent };

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
  readonly japanesePositiveWords?: readonly string[];
  readonly japaneseNegativeWords?: readonly string[];
  readonly negationPatterns?: readonly string[];
  readonly emphasisPatterns?: ReadonlyMap<string, number>;
  readonly mitigationPatterns?: ReadonlyMap<string, number>;
  readonly enableJapaneseProcessing?: boolean;
}

export interface TopicExtractionConfig {
  readonly maxTopics: number;
  readonly minWordLength: number;
  readonly japaneseStopWords: ReadonlySet<string>;
  readonly englishStopWords: ReadonlySet<string>;
  readonly preferKanji: boolean;
  readonly preferKatakana: boolean;
  readonly enableConjugationNormalization?: boolean;
}

export interface UrgencyConfig {
  readonly urgentKeywords: readonly string[];
  readonly keywordWeight: number;
  readonly messageCountThresholds: {
    readonly medium: number;
    readonly high: number;
  };
  readonly messageCountWeight: number;
  readonly consecutivePunctuationWeight?: number;
  readonly maxPunctuationBonus?: number;
  readonly timeBasedKeywords?: readonly string[];
  readonly timeBasedWeight?: number;
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
  readonly bulletPointConfig?: BulletPointConfig;
  readonly enableLineScoring?: boolean;
  readonly enableConjugationNormalization?: boolean;
}

/**
 * Configuration for bullet point detection and scoring
 */
export interface BulletPointConfig {
  readonly japaneseBullets: readonly string[];
  readonly westernBullets: readonly string[];
  readonly numberedPatterns: readonly RegExp[];
  readonly bulletPointWeight: number;
}

/**
 * Information about detected bullet points
 */
export interface BulletPointInfo {
  readonly hasBulletPoint: boolean;
  readonly bulletType: string;
  readonly weight: number;
}

/**
 * Information about detected Japanese request patterns
 */
export interface RequestPatternInfo {
  readonly hasRequestPattern: boolean;
  readonly patterns: readonly string[];
  readonly weight: number;
}

/**
 * Line scoring result for action item detection
 */
export interface LineScoreInfo {
  readonly score: number;
  readonly bulletPointInfo: BulletPointInfo;
  readonly requestPatternInfo: RequestPatternInfo;
  readonly hasMentions: boolean;
  readonly hasUrgencyKeywords: boolean;
  readonly urgencyKeywords: readonly string[];
}

/**
 * Information about detected consecutive punctuation
 */
export interface PunctuationInfo {
  readonly hasConsecutivePunctuation: boolean;
  readonly maxConsecutiveCount: number;
  readonly punctuationTypes: readonly string[];
  readonly totalPunctuationCount: number;
}

/**
 * Information about detected time-based urgency
 */
export interface TimeUrgencyInfo {
  readonly hasTimeBasedUrgency: boolean;
  readonly timeKeywords: readonly string[];
  readonly deadlineIndicators: readonly string[];
  readonly meetingUrgency: readonly string[];
}
