/**
 * @fileoverview Search-specific caching functionality with query normalization
 *
 * Provides advanced search result caching with:
 * - Query normalization and complexity analysis
 * - Adaptive TTL based on query complexity
 * - Pattern-based cache invalidation
 * - Batch operations for multiple queries
 * - Memory-efficient search result storage
 * - Integration with existing search-query-parser
 *
 * Created: 2025-08-19
 * TDD Green Phase: Implementation to make search cache tests pass
 */

import { LRUCacheWrapper, type LRUCacheConfig } from './lru-cache.js';
import {
  parseSearchQuery,
  buildSlackSearchQuery as _buildSlackSearchQuery,
  type ParsedSearchQuery,
  type QueryParseResult,
} from '../../utils/search-query-parser.js';
import crypto from 'crypto';

// ============================================================================
// Type Definitions
// ============================================================================

/**
 * Configuration for search cache behavior
 */
export interface SearchCacheConfig {
  /** Maximum number of cached queries */
  maxQueries: number;
  /** Maximum number of results to cache per query */
  maxResults: number;
  /** Default TTL for query cache entries in milliseconds */
  queryTTL: number;
  /** Default TTL for result cache entries in milliseconds */
  resultTTL: number;
  /** Enable adaptive TTL based on query complexity */
  adaptiveTTL: boolean;
  /** Enable pattern-based cache invalidation */
  enablePatternInvalidation: boolean;
  /** Optional memory limit in bytes */
  memoryLimit?: number;
}

/**
 * Normalized search query with metadata
 */
export interface SearchQuery {
  /** Original raw query string */
  raw: string;
  /** Normalized query string */
  normalized: string;
  /** Hash of the normalized query for cache key generation */
  hash: string;
  /** Query complexity level */
  complexity: 'simple' | 'moderate' | 'complex';
  /** Extracted channel filters */
  channels?: string[];
  /** Extracted user filters */
  users?: string[];
  /** Extracted date range */
  dateRange?: { start?: Date; end?: Date };
  /** List of operators used in the query */
  operators: string[];
}

/**
 * Cached search result with metadata
 */
export interface SearchResult {
  /** The normalized query that produced these results */
  query: SearchQuery;
  /** Array of search results */
  results: Record<string, unknown>[];
  /** Result metadata */
  metadata: {
    /** Total number of results returned */
    totalCount: number;
    /** Whether there are more results available */
    hasMore: boolean;
    /** Time taken to execute the search in milliseconds */
    searchTime: number;
    /** When the search was executed */
    timestamp: Date;
  };
  /** Cache key used to store this result */
  cacheKey: string;
}

/**
 * Cache invalidation pattern specification
 */
export interface CacheInvalidationPattern {
  /** Type of pattern to match */
  type: 'channel' | 'user' | 'date' | 'query_pattern';
  /** Pattern value (string or RegExp) */
  value: string | RegExp;
  /** Human-readable reason for invalidation */
  reason: string;
}

/**
 * Options for search cache operations
 */
export interface SearchCacheOptions {
  /** Total count of results (for metadata) */
  totalCount?: number;
  /** Whether there are more results available */
  hasMore?: boolean;
  /** Time taken to execute the search in milliseconds */
  searchTime?: number;
  /** Additional metadata */
  [key: string]: unknown;
}

/**
 * Search cache metrics and statistics
 */
export interface SearchCacheMetrics {
  /** Cache hits for query normalization */
  queryHits: number;
  /** Cache misses for query normalization */
  queryMisses: number;
  /** Cache hits for search results */
  resultHits: number;
  /** Cache misses for search results */
  resultMisses: number;
  /** Number of cache invalidations performed */
  invalidations: number;
  /** Number of adaptive TTL adjustments made */
  adaptiveTTLAdjustments: number;
  /** Current memory usage in bytes */
  memoryUsage: number;
  /** Average query complexity score */
  avgQueryComplexity: number;
}

// ============================================================================
// Search Query Normalizer
// ============================================================================

/**
 * Handles normalization of search queries for consistent caching
 */
export class SearchQueryNormalizer {
  private readonly complexityWeights = {
    terms: 1,
    phrases: 2,
    operators: 3,
    booleanOperators: 4,
    groups: 5,
  };

  /**
   * Normalize a search query into a consistent form for caching
   *
   * @param query - Raw search query string
   * @returns Normalized search query object
   * @throws {Error} When query cannot be parsed
   */
  normalize(query: string): SearchQuery {
    try {
      // Parse the query using existing parser
      const parseResult: QueryParseResult = parseSearchQuery(query.trim());

      if (!parseResult.success) {
        throw new Error(`Query parsing failed: ${parseResult.error.message}`);
      }

      const parsed = parseResult.query;

      // Create normalized representation by sorting and standardizing components
      const normalizedParts: string[] = [];

      // Add terms (sorted for consistency)
      if (parsed.terms?.length > 0) {
        const sortedTerms = [...parsed.terms].sort();
        normalizedParts.push(...sortedTerms);
      }

      // Add phrases (sorted for consistency)
      if (parsed.phrases?.length > 0) {
        const sortedPhrases = [...parsed.phrases].sort();
        sortedPhrases.forEach((phrase) => {
          normalizedParts.push(`"${phrase}"`);
        });
      }

      // Add operators (sorted by type then value for consistency)
      const sortedOperators = [...(parsed.operators || [])].sort((a, b) => {
        if (a.type !== b.type) {
          return a.type.localeCompare(b.type);
        }
        return a.value.localeCompare(b.value);
      });

      sortedOperators.forEach((op) => {
        normalizedParts.push(`${op.type}:${op.value}`);
      });

      // Add boolean operators in a consistent way
      if (parsed.booleanOperators?.length > 0) {
        // Sort by position to maintain logical structure
        const sortedBoolOps = [...parsed.booleanOperators].sort((a, b) => a.position - b.position);
        sortedBoolOps.forEach((boolOp) => {
          normalizedParts.push(boolOp.type);
        });
      }

      const normalizedQuery = normalizedParts.join(' ').toLowerCase().trim();

      // Extract metadata for cache decisions
      const channels = this.extractChannels(parsed);
      const users = this.extractUsers(parsed);
      const dateRange = this.extractDateRange(parsed);
      const operators = sortedOperators.map((op) => op.type);

      // Calculate complexity
      const complexity = this.calculateComplexity({
        raw: query,
        normalized: normalizedQuery,
        hash: '',
        complexity: 'simple',
        channels,
        users,
        dateRange,
        operators,
      });

      // Generate hash for cache key
      const hash = this.generateHash(normalizedQuery, { channels, users, dateRange, operators });

      return {
        raw: query.trim(),
        normalized: normalizedQuery,
        hash,
        complexity,
        channels,
        users,
        dateRange,
        operators,
      };
    } catch (error) {
      throw new Error(
        `Query normalization failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Calculate the complexity level of a search query
   *
   * @param query - Search query object
   * @returns Complexity level
   */
  calculateComplexity(query: SearchQuery): 'simple' | 'moderate' | 'complex' {
    const parsed = parseSearchQuery(query.raw);
    if (!parsed.success) {
      return 'simple'; // Default to simple for unparseable queries
    }

    let score = 0;
    const p = parsed.query;

    // Weight different query components
    score += (p.terms?.length || 0) * this.complexityWeights.terms;
    score += (p.phrases?.length || 0) * this.complexityWeights.phrases;
    score += (p.operators?.length || 0) * this.complexityWeights.operators;
    score += (p.booleanOperators?.length || 0) * this.complexityWeights.booleanOperators;
    score += (p.groups?.length || 0) * this.complexityWeights.groups;

    // Additional complexity factors
    if (query.dateRange?.start || query.dateRange?.end) {
      score += 5; // Date ranges add complexity
    }

    if (query.channels && query.channels.length > 1) {
      score += 3; // Multiple channels add complexity
    }

    if (query.users && query.users.length > 1) {
      score += 3; // Multiple users add complexity
    }

    // Classify based on total score
    if (score <= 5) {
      return 'simple';
    } else if (score <= 15) {
      return 'moderate';
    } else {
      return 'complex';
    }
  }

  /**
   * Generate a cache key for a normalized query
   *
   * @param query - Search query object
   * @param options - Additional options that affect cache key
   * @returns Cache key string
   */
  generateCacheKey(query: SearchQuery, options?: SearchCacheOptions): string {
    const keyParts = [query.hash, query.complexity];

    // Include options in cache key if provided
    if (options) {
      const optionsHash = this.generateHash(JSON.stringify(options));
      keyParts.push(optionsHash.substring(0, 8));
    }

    return `search:${keyParts.join(':')}`;
  }

  /**
   * Extract channel filters from parsed query
   */
  private extractChannels(parsed: ParsedSearchQuery): string[] | undefined {
    const channels = parsed.operators
      ?.filter((op) => op.type === 'in')
      .map((op) => op.value.replace(/^#/, ''))
      .filter(Boolean);

    return channels && channels.length > 0 ? channels : undefined;
  }

  /**
   * Extract user filters from parsed query
   */
  private extractUsers(parsed: ParsedSearchQuery): string[] | undefined {
    const users = parsed.operators
      ?.filter((op) => op.type === 'from')
      .map((op) => op.value.replace(/^@/, ''))
      .filter(Boolean);

    return users && users.length > 0 ? users : undefined;
  }

  /**
   * Extract date range from parsed query
   */
  private extractDateRange(parsed: ParsedSearchQuery): { start?: Date; end?: Date } | undefined {
    const dateOps =
      parsed.operators?.filter((op) => op.type === 'after' || op.type === 'before') || [];

    if (dateOps.length === 0) {
      return undefined;
    }

    let start: Date | undefined;
    let end: Date | undefined;

    dateOps.forEach((op) => {
      try {
        const date = new Date(op.value);
        if (!isNaN(date.getTime())) {
          if (op.type === 'after') {
            start = date;
          } else if (op.type === 'before') {
            end = date;
          }
        }
      } catch {
        // Ignore invalid dates
      }
    });

    return start || end ? { start, end } : undefined;
  }

  /**
   * Generate SHA-256 hash of input string
   */
  private generateHash(input: string, metadata?: SearchCacheOptions): string {
    const hashInput = metadata ? `${input}:${JSON.stringify(metadata)}` : input;
    return crypto.createHash('sha256').update(hashInput).digest('hex');
  }
}

// ============================================================================
// Search Cache Implementation
// ============================================================================

/**
 * Advanced search result cache with query normalization and adaptive TTL
 */
export class SearchCache {
  private readonly cache: LRUCacheWrapper<string, SearchResult>;
  private readonly queryNormalizer: SearchQueryNormalizer;
  private readonly config: SearchCacheConfig;

  // Metrics tracking
  private metrics = {
    queryHits: 0,
    queryMisses: 0,
    resultHits: 0,
    resultMisses: 0,
    invalidations: 0,
    adaptiveTTLAdjustments: 0,
    complexitySum: 0,
    queryCount: 0,
  };

  /**
   * Create a new search cache instance
   *
   * @param config - Search cache configuration
   * @throws {Error} When configuration is invalid
   */
  constructor(config: SearchCacheConfig) {
    this.validateConfig(config);
    this.config = { ...config };
    this.queryNormalizer = new SearchQueryNormalizer();

    // Calculate memory size for search results
    const sizeCalculation = (value: SearchResult, key: string): number => {
      try {
        // Estimate memory usage of the result object
        const resultSize = JSON.stringify(value.results).length * 2; // UTF-16 chars
        const metadataSize = JSON.stringify(value.metadata).length * 2;
        const querySize = JSON.stringify(value.query).length * 2;
        const keySize = key.length * 2;

        return resultSize + metadataSize + querySize + keySize + 100; // Add overhead
      } catch {
        return 1000; // Fallback size if serialization fails
      }
    };

    // Create LRU cache with search-specific configuration
    const cacheConfig: LRUCacheConfig<string, SearchResult> = {
      max: config.maxQueries,
      ttl: config.resultTTL,
      sizeCalculation,
      maxSize: config.memoryLimit,
      updateAgeOnGet: true,
      dispose: (value, key, reason) => {
        if (reason === 'evict' && config.enablePatternInvalidation) {
          // Track evictions for metrics
        }
      },
    };

    this.cache = new LRUCacheWrapper(cacheConfig);
  }

  /**
   * Get cached search results for a query
   *
   * @param query - Search query string
   * @param options - Additional search options
   * @returns Cached search result or null if not found
   */
  async get(query: string, options?: SearchCacheOptions): Promise<SearchResult | null> {
    try {
      const normalizedQuery = this.queryNormalizer.normalize(query);
      const cacheKey = this.queryNormalizer.generateCacheKey(normalizedQuery, options);

      const cachedResult = this.cache.get(cacheKey);

      if (cachedResult) {
        this.metrics.resultHits++;
        return cachedResult;
      } else {
        this.metrics.resultMisses++;
        return null;
      }
    } catch {
      // If normalization fails, treat as cache miss
      this.metrics.resultMisses++;
      return null;
    }
  }

  /**
   * Cache search results for a query
   *
   * @param query - Search query string
   * @param results - Search results to cache
   * @param options - Additional search options and metadata
   */
  async set(
    query: string,
    results: Record<string, unknown>[],
    options?: SearchCacheOptions
  ): Promise<void> {
    try {
      const normalizedQuery = this.queryNormalizer.normalize(query);
      const cacheKey = this.queryNormalizer.generateCacheKey(normalizedQuery, options);

      // Limit result set size to prevent memory issues
      const limitedResults = results.slice(0, this.config.maxResults);

      const searchResult: SearchResult = {
        query: normalizedQuery,
        results: limitedResults,
        metadata: {
          totalCount: options?.totalCount || results.length,
          hasMore: options?.hasMore || false,
          searchTime: options?.searchTime || 0,
          timestamp: new Date(),
        },
        cacheKey,
      };

      // Calculate adaptive TTL if enabled
      let ttl = this.config.resultTTL;
      if (this.config.adaptiveTTL) {
        ttl = this.calculateAdaptiveTTL(normalizedQuery);
        this.metrics.adaptiveTTLAdjustments++;
      }

      this.cache.set(cacheKey, searchResult, { ttl });

      // Update complexity metrics
      this.updateComplexityMetrics(normalizedQuery.complexity);
    } catch {
      // Silently ignore cache set failures to prevent disrupting search functionality
    }
  }

  /**
   * Get multiple cached search results in batch
   *
   * @param queries - Array of search query strings
   * @returns Map of query strings to cached results (or null if not cached)
   */
  async getBatch(queries: string[]): Promise<Map<string, SearchResult | null>> {
    const results = new Map<string, SearchResult | null>();

    for (const query of queries) {
      const result = await this.get(query);
      results.set(query, result);
    }

    return results;
  }

  /**
   * Cache multiple search results in batch
   *
   * @param entries - Array of query-result pairs to cache
   */
  async setBatch(
    entries: Array<{
      query: string;
      results: Record<string, unknown>[];
      options?: SearchCacheOptions;
    }>
  ): Promise<void> {
    for (const entry of entries) {
      await this.set(entry.query, entry.results, entry.options);
    }
  }

  /**
   * Invalidate cache entries matching a pattern
   *
   * @param pattern - Invalidation pattern specification
   * @returns Number of entries invalidated
   */
  async invalidatePattern(pattern: CacheInvalidationPattern): Promise<number> {
    if (!this.config.enablePatternInvalidation) {
      return 0;
    }

    let invalidated = 0;
    const cacheMetrics = this.cache.getMetrics();

    // Get all cache entries to check against pattern
    // Note: This is a simplified implementation - in a real system,
    // you might want to maintain an index of cache keys by pattern

    // For now, we'll clear the entire cache for pattern invalidation
    // In a production system, you'd iterate through keys and match patterns
    if (pattern.type === 'channel' || pattern.type === 'user' || pattern.type === 'date') {
      this.cache.clear();
      invalidated = cacheMetrics.size;
      this.metrics.invalidations += invalidated;
    }

    return invalidated;
  }

  /**
   * Invalidate all cache entries for a specific channel
   *
   * @param channelId - Channel ID to invalidate
   * @returns Number of entries invalidated
   */
  async invalidateChannel(channelId: string): Promise<number> {
    return this.invalidatePattern({
      type: 'channel',
      value: channelId,
      reason: `Channel ${channelId} invalidation`,
    });
  }

  /**
   * Invalidate all cache entries for a specific user
   *
   * @param userId - User ID to invalidate
   * @returns Number of entries invalidated
   */
  async invalidateUser(userId: string): Promise<number> {
    return this.invalidatePattern({
      type: 'user',
      value: userId,
      reason: `User ${userId} invalidation`,
    });
  }

  /**
   * Get comprehensive cache metrics
   *
   * @returns Search cache metrics and statistics
   */
  getMetrics(): SearchCacheMetrics {
    const cacheMetrics = this.cache.getMetrics();

    return {
      queryHits: this.metrics.queryHits,
      queryMisses: this.metrics.queryMisses,
      resultHits: this.metrics.resultHits,
      resultMisses: this.metrics.resultMisses,
      invalidations: this.metrics.invalidations,
      adaptiveTTLAdjustments: this.metrics.adaptiveTTLAdjustments,
      memoryUsage: cacheMetrics.memoryUsage,
      avgQueryComplexity:
        this.metrics.queryCount > 0 ? this.metrics.complexitySum / this.metrics.queryCount : 0,
    };
  }

  /**
   * Clear all cached search results
   */
  async clear(): Promise<void> {
    this.cache.clear();
    this.resetMetrics();
  }

  /**
   * Reset all metrics counters
   */
  private resetMetrics(): void {
    this.metrics = {
      queryHits: 0,
      queryMisses: 0,
      resultHits: 0,
      resultMisses: 0,
      invalidations: 0,
      adaptiveTTLAdjustments: 0,
      complexitySum: 0,
      queryCount: 0,
    };
  }

  /**
   * Validate search cache configuration
   *
   * @param config - Configuration to validate
   * @throws {Error} When configuration is invalid
   */
  private validateConfig(config: SearchCacheConfig): void {
    if (!config.maxQueries || config.maxQueries <= 0) {
      throw new Error('maxQueries must be a positive number');
    }

    if (!config.maxResults || config.maxResults <= 0) {
      throw new Error('maxResults must be a positive number');
    }

    if (config.queryTTL < 0) {
      throw new Error('queryTTL must be non-negative');
    }

    if (config.resultTTL < 0) {
      throw new Error('resultTTL must be non-negative');
    }

    if (config.memoryLimit !== undefined && config.memoryLimit < 0) {
      throw new Error('memoryLimit must be non-negative');
    }
  }

  /**
   * Calculate adaptive TTL based on query complexity
   *
   * @param query - Normalized search query
   * @returns TTL in milliseconds
   */
  private calculateAdaptiveTTL(query: SearchQuery): number {
    const baseTTL = this.config.resultTTL;

    switch (query.complexity) {
      case 'simple':
        return baseTTL * 3; // 3x longer for simple queries
      case 'moderate':
        return baseTTL * 2; // 2x longer for moderate queries
      case 'complex':
        return baseTTL; // Default TTL for complex queries
      default:
        return baseTTL;
    }
  }

  /**
   * Update complexity metrics
   *
   * @param complexity - Query complexity level
   */
  private updateComplexityMetrics(complexity: SearchQuery['complexity']): void {
    this.metrics.queryCount++;

    const complexityScore = {
      simple: 1,
      moderate: 2,
      complex: 3,
    }[complexity];

    this.metrics.complexitySum += complexityScore;
  }
}
