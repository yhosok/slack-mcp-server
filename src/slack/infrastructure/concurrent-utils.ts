/**
 * Concurrent Processing Utilities for Thread Service Performance Optimization
 * 
 * Provides utilities for parallel processing operations while respecting Slack API
 * rate limits and maintaining error handling consistency.
 */

import pLimit from 'p-limit';
import { logger } from '../../utils/logger.js';

/**
 * Configuration for concurrent processing operations
 */
export interface ConcurrentProcessingConfig {
  /** Maximum number of concurrent operations */
  concurrency?: number;
  /** Custom error handler for individual operations */
  errorHandler?: (error: Error, index: number) => void;
  /** Whether to fail fast on first error or collect all results */
  failFast?: boolean;
}

/**
 * Result of concurrent processing operation
 */
export interface ConcurrentProcessingResult<T> {
  /** Successfully processed results */
  results: T[];
  /** Errors that occurred during processing */
  errors: Array<{ index: number; error: Error }>;
  /** Total items processed */
  totalProcessed: number;
  /** Number of successful operations */
  successCount: number;
  /** Number of failed operations */
  errorCount: number;
}

/**
 * Default configuration for thread service concurrent operations
 */
const DEFAULT_CONFIG: Required<ConcurrentProcessingConfig> = {
  concurrency: 3, // Matches existing Slack API concurrency limits
  errorHandler: (error: Error, index: number) => {
    logger.warn(`Concurrent operation ${index} failed: ${error.message}`);
  },
  failFast: false,
};

/**
 * Process an array of items concurrently with rate limiting and error handling.
 * 
 * @template T - Input item type
 * @template R - Result type
 * @param items - Array of items to process
 * @param processor - Async function to process each item
 * @param config - Configuration for concurrent processing
 * @returns Promise resolving to processing results
 * 
 * @example
 * ```typescript
 * const threadResults = await processConcurrently(
 *   threadTimestamps,
 *   async (ts) => await client.conversations.replies({ channel, ts }),
 *   { concurrency: 5, failFast: false }
 * );
 * ```
 */
export async function processConcurrently<T, R>(
  items: readonly T[],
  processor: (item: T, index: number) => Promise<R>,
  config: ConcurrentProcessingConfig = {}
): Promise<ConcurrentProcessingResult<R>> {
  const finalConfig = { ...DEFAULT_CONFIG, ...config };
  const limit = pLimit(finalConfig.concurrency);
  const results: R[] = [];
  const errors: Array<{ index: number; error: Error }> = [];

  const promises = items.map((item, index) =>
    limit(async () => {
      try {
        const result = await processor(item, index);
        return { success: true as const, result, index };
      } catch (error) {
        const errorObj = error instanceof Error ? error : new Error(String(error));
        finalConfig.errorHandler(errorObj, index);
        
        if (finalConfig.failFast) {
          throw errorObj;
        }
        
        return { success: false as const, error: errorObj, index };
      }
    })
  );

  const outcomes = await Promise.all(promises);
  
  for (const outcome of outcomes) {
    if (outcome.success) {
      results.push(outcome.result);
    } else {
      errors.push({ index: outcome.index, error: outcome.error });
    }
  }

  return {
    results,
    errors,
    totalProcessed: items.length,
    successCount: results.length,
    errorCount: errors.length,
  };
}

/**
 * Process items in batches with concurrent processing within each batch.
 * Useful for very large datasets that need to be processed in chunks.
 * 
 * @template T - Input item type
 * @template R - Result type
 * @param items - Array of items to process
 * @param processor - Async function to process each item
 * @param batchSize - Number of items per batch
 * @param config - Configuration for concurrent processing
 * @returns Promise resolving to processing results
 */
export async function processConcurrentlyInBatches<T, R>(
  items: readonly T[],
  processor: (item: T, index: number) => Promise<R>,
  batchSize: number = 50,
  config: ConcurrentProcessingConfig = {}
): Promise<ConcurrentProcessingResult<R>> {
  const allResults: R[] = [];
  const allErrors: Array<{ index: number; error: Error }> = [];
  let globalIndex = 0;

  // Process items in batches
  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    
    const batchResult = await processConcurrently(
      batch,
      async (item, batchIndex) => {
        const actualIndex = globalIndex + batchIndex;
        return await processor(item, actualIndex);
      },
      config
    );

    allResults.push(...batchResult.results);
    
    // Adjust error indices to global indices
    const adjustedErrors = batchResult.errors.map(({ index, error }) => ({
      index: globalIndex + index,
      error,
    }));
    allErrors.push(...adjustedErrors);
    
    globalIndex += batch.length;
  }

  return {
    results: allResults,
    errors: allErrors,
    totalProcessed: items.length,
    successCount: allResults.length,
    errorCount: allErrors.length,
  };
}

/**
 * Map an array with concurrent processing, preserving order and handling errors gracefully.
 * Similar to Promise.all but with concurrency limiting and error collection.
 * 
 * @template T - Input item type
 * @template R - Result type
 * @param items - Array of items to map
 * @param mapper - Async mapping function
 * @param config - Configuration for concurrent processing
 * @returns Promise resolving to array of results (undefined for failed items)
 */
export async function mapConcurrently<T, R>(
  items: readonly T[],
  mapper: (item: T, index: number) => Promise<R>,
  config: ConcurrentProcessingConfig = {}
): Promise<(R | undefined)[]> {
  const finalConfig = { ...DEFAULT_CONFIG, ...config };
  const limit = pLimit(finalConfig.concurrency);
  const orderedResults: (R | undefined)[] = new Array(items.length).fill(undefined);

  const promises = items.map((item, index) =>
    limit(async () => {
      try {
        const result = await mapper(item, index);
        orderedResults[index] = result;
      } catch (error) {
        const errorObj = error instanceof Error ? error : new Error(String(error));
        finalConfig.errorHandler(errorObj, index);
        // orderedResults[index] remains undefined
      }
    })
  );

  await Promise.all(promises);
  return orderedResults;
}

/**
 * Filter an array with concurrent async predicate, maintaining original order.
 * 
 * @template T - Item type
 * @param items - Array of items to filter
 * @param predicate - Async predicate function
 * @param config - Configuration for concurrent processing
 * @returns Promise resolving to filtered array
 */
export async function filterConcurrently<T>(
  items: readonly T[],
  predicate: (item: T, index: number) => Promise<boolean>,
  config: ConcurrentProcessingConfig = {}
): Promise<T[]> {
  const finalConfig = { ...DEFAULT_CONFIG, ...config };
  const limit = pLimit(finalConfig.concurrency);
  const predicateResults: boolean[] = new Array(items.length).fill(false);

  const promises = items.map((item, index) =>
    limit(async () => {
      try {
        const result = await predicate(item, index);
        predicateResults[index] = result;
      } catch (error) {
        const errorObj = error instanceof Error ? error : new Error(String(error));
        finalConfig.errorHandler(errorObj, index);
        // predicateResults[index] remains false (filtered out)
      }
    })
  );

  await Promise.all(promises);
  return items.filter((_, index) => predicateResults[index] === true);
}

/**
 * Create a simple cache for function results to avoid redundant operations.
 * Useful for caching API responses that don't change frequently.
 * 
 * @template K - Cache key type
 * @template V - Cache value type
 * @param ttlMs - Time to live in milliseconds (default: 5 minutes)
 * @returns Cache object with get/set/clear methods
 */
export function createSimpleCache<K, V>(ttlMs: number = 5 * 60 * 1000): {
  get(key: K): V | undefined;
  set(key: K, value: V): void;
  clear(): void;
  size(): number;
} {
  const cache = new Map<K, { value: V; expires: number }>();
  
  return {
    get(key: K): V | undefined {
      const entry = cache.get(key);
      if (!entry) return undefined;
      
      if (Date.now() > entry.expires) {
        cache.delete(key);
        return undefined;
      }
      
      return entry.value;
    },
    
    set(key: K, value: V): void {
      cache.set(key, {
        value,
        expires: Date.now() + ttlMs,
      });
    },
    
    clear(): void {
      cache.clear();
    },
    
    size(): number {
      // Clean expired entries and return size
      const now = Date.now();
      for (const [key, entry] of cache.entries()) {
        if (now > entry.expires) {
          cache.delete(key);
        }
      }
      return cache.size;
    },
  };
}