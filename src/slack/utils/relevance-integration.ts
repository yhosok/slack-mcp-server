/**
 * Relevance Integration Utility - Reusable helper for integrating RelevanceScorer
 * 
 * This utility provides a common pattern for integrating RelevanceScorer into search services
 * with proper error handling, configuration awareness, and graceful fallbacks.
 * 
 * Key Features:
 * - Configuration-driven behavior (respects searchRankingEnabled setting)
 * - Graceful error handling with fallback to original results
 * - Performance monitoring and logging
 * - Type-safe integration with generic support
 * - Consistent interface across all search services
 */

import type { RelevanceScorer } from '../analysis/search/relevance-scorer.js';
import { logger } from '../../utils/logger.js';

/**
 * Interface for items that can be ranked by relevance
 * All search result types should implement this interface
 */
export interface RankableItem extends Record<string, unknown> {
  text?: string;
  timestamp?: string;
  user?: string;
}

/**
 * Configuration options for relevance integration
 */
export interface RelevanceIntegrationOptions {
  /**
   * Performance threshold in milliseconds
   * If scoring takes longer than this, a warning will be logged
   */
  performanceThreshold?: number;
  
  /**
   * Whether to log relevance scoring operations
   */
  enableLogging?: boolean;
  
  /**
   * Context identifier for logging (e.g., 'searchMessages', 'searchThreads')
   */
  context?: string;
}

/**
 * Result of relevance scoring operation
 */
export interface RelevanceIntegrationResult<T extends RankableItem> {
  results: T[];
  scoringApplied: boolean;
  processingTime: number;
  error?: string;
}

/**
 * Default configuration for relevance integration
 */
const DEFAULT_OPTIONS: Required<RelevanceIntegrationOptions> = {
  performanceThreshold: 100, // 100ms threshold as per requirements
  enableLogging: true,
  context: 'search',
};

/**
 * Apply relevance scoring to search results with comprehensive error handling
 * 
 * This function serves as the central integration point for RelevanceScorer across
 * all search services. It handles:
 * - Configuration checking (null scorer when disabled)
 * - Error handling with graceful fallback
 * - Performance monitoring and logging
 * - Type-safe result transformation
 * 
 * @param results - Array of search results to rank
 * @param query - Search query string
 * @param relevanceScorer - RelevanceScorer instance (null when disabled)
 * @param options - Integration configuration options
 * @returns Promise<RelevanceIntegrationResult<T>>
 */
export async function applyRelevanceScoring<T extends RankableItem>(
  results: T[],
  query: string,
  relevanceScorer: RelevanceScorer | null,
  options: RelevanceIntegrationOptions = {}
): Promise<RelevanceIntegrationResult<T>> {
  const config = { ...DEFAULT_OPTIONS, ...options };
  const startTime = performance.now();
  
  // Early return if no scorer available (disabled configuration)
  if (!relevanceScorer) {
    if (config.enableLogging) {
      logger.debug(`Relevance scoring skipped (disabled) for ${config.context}`, {
        query,
        resultCount: results.length,
      });
    }
    
    return {
      results,
      scoringApplied: false,
      processingTime: 0,
      error: undefined,
    };
  }
  
  // Early return for empty results or query
  if (results.length === 0 || !query.trim()) {
    if (config.enableLogging) {
      logger.debug(`Relevance scoring skipped (empty input) for ${config.context}`, {
        query,
        resultCount: results.length,
      });
    }
    
    return {
      results,
      scoringApplied: false,
      processingTime: performance.now() - startTime,
      error: undefined,
    };
  }
  
  try {
    if (config.enableLogging) {
      logger.debug(`Applying relevance scoring for ${config.context}`, {
        query,
        resultCount: results.length,
      });
    }
    
    // Apply relevance scoring using RelevanceScorer.reRankResults method
    const rankedResults = await relevanceScorer.reRankResults(results, query);
    
    const processingTime = performance.now() - startTime;
    
    // Log performance warning if threshold exceeded
    if (processingTime > config.performanceThreshold) {
      logger.warn(`Relevance scoring exceeded performance threshold for ${config.context}`, {
        query,
        resultCount: results.length,
        processingTime,
        threshold: config.performanceThreshold,
      });
    } else if (config.enableLogging) {
      logger.debug(`Relevance scoring completed for ${config.context}`, {
        query,
        resultCount: results.length,
        processingTime,
      });
    }
    
    return {
      results: rankedResults,
      scoringApplied: true,
      processingTime,
      error: undefined,
    };
    
  } catch (error) {
    const processingTime = performance.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    // Log error but continue with graceful fallback
    logger.warn(`Relevance scoring failed for ${config.context}, falling back to original order`, {
      query,
      resultCount: results.length,
      processingTime,
      error: errorMessage,
    });
    
    return {
      results, // Return original results as fallback
      scoringApplied: false,
      processingTime,
      error: errorMessage,
    };
  }
}

/**
 * Validate that results implement the RankableItem interface
 * 
 * This function can be used to ensure type safety when integrating
 * with external APIs that may not guarantee proper typing.
 * 
 * @param results - Array of results to validate
 * @returns boolean - true if all results are valid RankableItems
 */
export function validateRankableItems<T extends Record<string, unknown>>(
  results: T[]
): results is (T & RankableItem)[] {
  if (!Array.isArray(results)) {
    return false;
  }
  
  return results.every(result => 
    result && 
    typeof result === 'object' &&
    // RankableItem properties are optional, so we just check basic structure
    (typeof result.text === 'string' || result.text === undefined) &&
    (typeof result.timestamp === 'string' || result.timestamp === undefined) &&
    (typeof result.user === 'string' || result.user === undefined)
  );
}

/**
 * Transform search results to ensure they implement RankableItem interface
 * 
 * This helper function standardizes different search result formats to work
 * with the RelevanceScorer. It handles common field mapping patterns.
 * 
 * @param results - Array of search results with various field names
 * @param fieldMapping - Optional field mapping configuration
 * @returns Array of RankableItem-compatible results
 */
export function normalizeSearchResults<T extends Record<string, unknown>>(
  results: T[],
  fieldMapping: {
    textField?: keyof T;
    timestampField?: keyof T;
    userField?: keyof T;
  } = {}
): (T & RankableItem)[] {
  const {
    textField = 'text',
    timestampField = 'ts', // Common Slack timestamp field
    userField = 'user',
  } = fieldMapping;
  
  return results.map(result => ({
    ...result,
    text: String(result[textField] || result.text || ''),
    timestamp: String(result[timestampField] || result.timestamp || Date.now().toString()),
    user: String(result[userField] || result.user || ''),
  }));
}

/**
 * Create a relevance integration function with pre-configured options
 * 
 * This factory function allows services to create customized integration
 * functions with service-specific configuration.
 * 
 * @param defaultOptions - Default options for this integration instance
 * @returns Configured integration function
 */
export function createRelevanceIntegration(
  defaultOptions: RelevanceIntegrationOptions
) {
  return async function<T extends RankableItem>(
    results: T[],
    query: string,
    relevanceScorer: RelevanceScorer | null,
    overrideOptions: RelevanceIntegrationOptions = {}
  ): Promise<RelevanceIntegrationResult<T>> {
    const mergedOptions = { ...defaultOptions, ...overrideOptions };
    return applyRelevanceScoring(results, query, relevanceScorer, mergedOptions);
  };
}