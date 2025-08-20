/**
 * @fileoverview Cache infrastructure module exports
 * 
 * Provides clean exports for all cache-related functionality including:
 * - LRUCacheWrapper class with comprehensive caching features
 * - SearchCache with advanced query normalization and adaptive TTL
 * - Unified CacheService for managing multiple cache instances
 * - CacheServiceFactory for dependency injection and configuration
 * - CachePerformanceMonitor for performance tracking
 * - Configuration and metrics interfaces
 * - Type definitions for cache operations
 * 
 * Created: 2025-08-19
 * Updated: 2025-08-19 - Added unified cache service components
 */

export {
  LRUCacheWrapper,
  type LRUCacheConfig,
  type CacheMetrics,
  type SetOptions
} from './lru-cache.js';

export {
  SearchCache,
  SearchQueryNormalizer,
  type SearchCacheConfig,
  type SearchQuery,
  type SearchResult,
  type CacheInvalidationPattern,
  type SearchCacheMetrics
} from './search-cache.js';

export {
  CacheService,
  CacheServiceFactory,
  CachePerformanceMonitor,
  type CacheServiceConfig,
  type CacheServiceDependencies,
  type CacheServiceMetrics,
  type CacheInstance,
  type CacheHealthStatus
} from './cache-service.js';

export {
  CacheIntegrationHelper,
  CacheKeyBuilder,
  createCacheIntegrationHelper,
  type CacheOrFetchOptions,
  type CacheInvalidationOptions
} from './cache-integration-helpers.js';