/**
 * @fileoverview Cache integration helpers for service implementations
 *
 * Provides utility functions and patterns for integrating caching into domain services:
 * - Safe cache operations with graceful degradation
 * - Common caching patterns (get-or-fetch, invalidation strategies)
 * - Cache key generation utilities
 * - Performance tracking and metrics integration
 *
 * Created: 2025-08-19
 * Architecture Integration: TDD Refactor phase for cache system integration
 */

import type { CacheService } from './cache-service.js';
import { logger } from '../../../utils/logger.js';

// ============================================================================
// Cache Operation Types
// ============================================================================

/**
 * Options for cache-or-fetch operations
 */
export interface CacheOrFetchOptions<_T> {
  /** TTL override in milliseconds */
  ttl?: number;
  /** Skip cache and force fresh fetch */
  skipCache?: boolean;
  /** Custom cache key prefix */
  keyPrefix?: string;
}

/**
 * Cache invalidation pattern options
 */
export interface CacheInvalidationOptions {
  /** Patterns to match keys for invalidation */
  patterns?: string[];
  /** Specific keys to invalidate */
  keys?: string[];
  /** Cache types to invalidate */
  cacheTypes?: ('channels' | 'users' | 'search' | 'files' | 'threads')[];
}

// ============================================================================
// Cache Key Generation Utilities
// ============================================================================

/**
 * Cache key generation utilities for consistent key naming
 */
export class CacheKeyBuilder {
  /**
   * Generate cache key for channel operations
   */
  static channel(operation: string, params: Record<string, unknown>): string {
    const sortedParams = Object.keys(params)
      .sort()
      .map((key) => `${key}:${params[key]}`)
      .join('|');
    return `channels:${operation}:${sortedParams}`;
  }

  /**
   * Generate cache key for user operations
   */
  static user(operation: string, userId?: string, params?: Record<string, unknown>): string {
    const baseKey = `users:${operation}`;
    if (userId) {
      const paramStr = params
        ? '|' +
          Object.keys(params)
            .sort()
            .map((k) => `${k}:${params[k]}`)
            .join('|')
        : '';
      return `${baseKey}:${userId}${paramStr}`;
    }
    return baseKey;
  }

  /**
   * Generate cache key for search operations
   */
  static search(operation: string, query: string, params?: Record<string, unknown>): string {
    const paramStr = params
      ? '|' +
        Object.keys(params)
          .sort()
          .map((k) => `${k}:${params[k]}`)
          .join('|')
      : '';
    return `search:${operation}:${query}${paramStr}`;
  }

  /**
   * Generate cache key for file operations
   */
  static file(operation: string, params: Record<string, unknown>): string {
    const sortedParams = Object.keys(params)
      .sort()
      .map((key) => `${key}:${params[key]}`)
      .join('|');
    return `files:${operation}:${sortedParams}`;
  }

  /**
   * Generate cache key for thread operations
   */
  static thread(
    operation: string,
    channelId?: string,
    threadTs?: string,
    params?: Record<string, unknown>
  ): string {
    let key = `threads:${operation}`;
    if (channelId) {
      key += `:${channelId}`;
      if (threadTs) {
        key += `:${threadTs}`;
      }
    }
    if (params) {
      const paramStr = Object.keys(params)
        .sort()
        .map((k) => `${k}:${params[k]}`)
        .join('|');
      key += `|${paramStr}`;
    }
    return key;
  }
}

// ============================================================================
// Cache Integration Patterns
// ============================================================================

/**
 * Safe cache-or-fetch pattern with graceful degradation
 */
export class CacheIntegrationHelper {
  constructor(private cacheService: CacheService | null) {}

  /**
   * Get from cache or fetch with fallback - Standard pattern for read operations
   */
  async cacheOrFetch<T>(
    cacheType: 'channels' | 'users' | 'search' | 'files' | 'threads',
    cacheKey: string,
    fetchFunction: () => Promise<T>,
    options: CacheOrFetchOptions<T> = {}
  ): Promise<T> {
    // If caching is disabled or explicitly skipped, fetch directly
    if (!this.cacheService || options.skipCache) {
      return await fetchFunction();
    }

    try {
      // Try to get from cache first
      const cache = this.getCacheInstance(cacheType);
      if (cache) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const cached = (cache as any)?.get?.(cacheKey) as T | undefined;
        if (cached !== undefined) {
          logger.debug(`Cache hit for key: ${cacheKey}`);
          return cached;
        }
      }

      // Cache miss - fetch fresh data
      logger.debug(`Cache miss for key: ${cacheKey}, fetching fresh data`);
      const freshData = await fetchFunction();

      // Store in cache for next time
      if (cache && freshData !== undefined) {
        const setOptions = options.ttl ? { ttl: options.ttl } : {};
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (cache as any)?.set?.(cacheKey, freshData, setOptions);
        logger.debug(`Cached data for key: ${cacheKey}`);
      }

      return freshData;
    } catch (error) {
      // Log cache error but continue with direct fetch
      logger.warn(
        `Cache operation failed for key: ${cacheKey}, falling back to direct fetch:`,
        error
      );
      return await fetchFunction();
    }
  }

  /**
   * Invalidate cache entries based on patterns or specific keys
   */
  async invalidateCache(options: CacheInvalidationOptions): Promise<void> {
    if (!this.cacheService) return;

    try {
      // Handle specific key invalidation
      if (options.keys && options.keys.length > 0) {
        for (const key of options.keys) {
          // Try to determine cache type from key prefix
          const cacheType = this.determineCacheType(key);
          if (cacheType) {
            const cache = this.getCacheInstance(cacheType);
            if (cacheType === 'search') {
              // SearchCache doesn't have a direct delete method - use pattern invalidation
              const searchCache = this.cacheService.getSearchCache();
              await searchCache.invalidatePattern({
                type: 'query_pattern',
                value: key,
                reason: `Direct key invalidation: ${key}`,
              });
            } else {
              // LRU caches have delete method
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              (cache as any)?.delete?.(key);
            }
            logger.debug(`Invalidated cache key: ${key}`);
          }
        }
      }

      // Handle pattern-based invalidation (search cache supports this natively)
      if (options.patterns && options.patterns.length > 0) {
        const searchCache = this.cacheService.getSearchCache();
        for (const pattern of options.patterns) {
          await searchCache.invalidatePattern({
            type: 'query_pattern',
            value: pattern,
            reason: `Pattern invalidation: ${pattern}`,
          });
          logger.debug(`Invalidated cache pattern: ${pattern}`);
        }
      }

      // Handle cache type clearing
      if (options.cacheTypes && options.cacheTypes.length > 0) {
        for (const cacheType of options.cacheTypes) {
          const cache = this.getCacheInstance(cacheType);
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (cache as any)?.clear?.();
          logger.debug(`Cleared cache type: ${cacheType}`);
        }
      }
    } catch (error) {
      logger.warn('Cache invalidation failed:', error);
    }
  }

  /**
   * Get cache metrics for monitoring and health checks
   */
  getCacheMetrics(): Record<string, unknown> | null {
    if (!this.cacheService) return null;

    try {
      const metrics = this.cacheService.getMetrics();
      // Convert to generic record to match expected interface
      return JSON.parse(JSON.stringify(metrics)) as Record<string, unknown>;
    } catch (error) {
      logger.warn('Failed to retrieve cache metrics:', error);
      return null;
    }
  }

  /**
   * Check if caching is enabled and available
   */
  isCacheAvailable(): boolean {
    return this.cacheService !== null;
  }

  // ============================================================================
  // Private Helper Methods
  // ============================================================================

  private getCacheInstance(
    cacheType: 'channels' | 'users' | 'search' | 'files' | 'threads'
  ): unknown | null {
    if (!this.cacheService) return null;

    switch (cacheType) {
      case 'channels':
        return this.cacheService.getChannelCache();
      case 'users':
        return this.cacheService.getUserCache();
      case 'search':
        return this.cacheService.getSearchCache();
      case 'files':
        return this.cacheService.getFileCache();
      case 'threads':
        return this.cacheService.getThreadCache();
      default:
        return null;
    }
  }

  private determineCacheType(
    key: string
  ): 'channels' | 'users' | 'search' | 'files' | 'threads' | null {
    if (key.startsWith('channels:')) return 'channels';
    if (key.startsWith('users:')) return 'users';
    if (key.startsWith('search:')) return 'search';
    if (key.startsWith('files:')) return 'files';
    if (key.startsWith('threads:')) return 'threads';
    return null;
  }
}

// ============================================================================
// Factory Function
// ============================================================================

/**
 * Create cache integration helper for use in services
 */
export function createCacheIntegrationHelper(
  cacheService: CacheService | null
): CacheIntegrationHelper {
  return new CacheIntegrationHelper(cacheService);
}
