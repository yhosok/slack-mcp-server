/**
 * Types for formatting functions
 */

import type { ThreadAnalysis, ThreadSummary, ThreadMetrics, FileAnalysis } from '../../types.js';

/**
 * Formatter configuration options
 */
export interface FormatterConfig {
  readonly includeEmojis: boolean;
  readonly includeTimestamps: boolean;
  readonly maxLineLength: number;
  readonly precision: number; // Decimal precision for numbers
}

/**
 * Default formatter configuration
 */
export const DEFAULT_FORMATTER_CONFIG: FormatterConfig = {
  includeEmojis: true,
  includeTimestamps: false,
  maxLineLength: 100,
  precision: 1,
} as const;

/**
 * Formatted output result
 */
export interface FormattedResult {
  readonly content: string;
  readonly lineCount: number;
  readonly characterCount: number;
  readonly includesEmojis: boolean;
}

/**
 * Thread analysis formatting options
 */
export interface ThreadAnalysisFormatterOptions extends FormatterConfig {
  readonly includeSummary: boolean;
  readonly includeParticipants: boolean;
  readonly includeTimeline: boolean;
  readonly includeActionItems: boolean;
  readonly includeTopics: boolean;
}

/**
 * Thread summary formatting options
 */
export interface ThreadSummaryFormatterOptions extends FormatterConfig {
  readonly includeDetails: boolean;
  readonly includeKeyPoints: boolean;
  readonly includeActionItems: boolean;
  readonly includeDecisions: boolean;
}

/**
 * Thread metrics formatting options
 */
export interface ThreadMetricsFormatterOptions extends FormatterConfig {
  readonly includeAverages: boolean;
  readonly includeBreakdown: boolean;
  readonly includeComparisons: boolean;
}

/**
 * File analysis formatting options
 */
export interface FileAnalysisFormatterOptions extends FormatterConfig {
  readonly includeTypeBreakdown: boolean;
  readonly includeUserStats: boolean;
  readonly includeLargeFiles: boolean;
  readonly includeOldFiles: boolean;
  readonly maxItems: number;
}

/**
 * Duration formatting options
 */
export interface DurationFormatterOptions {
  readonly units: 'auto' | 'minutes' | 'hours' | 'days';
  readonly precision: number;
  readonly includeSeconds: boolean;
}

/**
 * Byte formatting options
 */
export interface ByteFormatterOptions {
  readonly units: 'auto' | 'bytes' | 'kb' | 'mb' | 'gb';
  readonly precision: number;
  readonly binary: boolean; // Use 1024 vs 1000 as base
}
