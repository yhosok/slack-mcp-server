// Client Management
export { createSlackClientManager, convertLogLevel } from './client/client-manager.js';
export { createRateLimitService } from './client/rate-limit-service.js';
export type {
  SlackClientManager,
  ClientManagerDependencies,
  RateLimitConfig,
  ClientConfig,
} from './client/types.js';
export type { RateLimitService, RateLimitMetrics } from './client/rate-limit-service.js';

// User Management - REMOVED: Now using consolidated domain user service
// The infrastructure user service has been consolidated with the domain user service
// to eliminate duplication. Use the domain service from '../services/users/user-service.js'

// Request Validation and Handling
export {
  createRequestHandler,
  defaultResponseFormatter,
  defaultErrorFormatter,
} from './validation/request-handler.js';
export type {
  RequestHandler,
  RequestHandlerDependencies,
  ResponseFormatter,
  ErrorFormatter,
} from './validation/types.js';

// Cache Management
export {
  CacheService,
  CacheServiceFactory,
  CachePerformanceMonitor,
  LRUCacheWrapper,
  SearchCache,
  CacheIntegrationHelper,
  CacheKeyBuilder,
  createCacheIntegrationHelper,
} from './cache/index.js';
export type {
  CacheServiceConfig,
  CacheServiceDependencies,
  CacheServiceMetrics,
  CacheInstance,
  CacheHealthStatus,
  LRUCacheConfig,
  SearchCacheConfig,
  CacheOrFetchOptions,
  CacheInvalidationOptions,
} from './cache/index.js';

// Infrastructure Factory
export { createInfrastructureServices, createRelevanceScorerConfig } from './factory.js';
export type { InfrastructureConfig, InfrastructureServices } from './factory.js';
