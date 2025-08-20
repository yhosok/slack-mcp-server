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

// User Management
export { createUserService } from './user/user-service.js';
export type { UserService, UserServiceDependencies } from './user/types.js';

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
