import { validateInput } from '../../utils/validation.js';
import type { z } from 'zod';
import {
  createSlackClientManager,
  createRateLimitService,
  createRequestHandler,
  convertLogLevel,
  defaultResponseFormatter,
  defaultErrorFormatter,
  CacheServiceFactory,
} from './index.js';
import { createUserService } from '../services/users/user-service.js';
import type {
  SlackClientManager,
  RateLimitService,
  RequestHandler,
  ClientManagerDependencies,
  ClientConfig,
  CacheService,
  CacheServiceConfig,
} from './index.js';
import type { UserService } from '../services/users/types.js';
import { RelevanceScorer } from '../analysis/search/relevance-scorer.js';
import type { RelevanceScorerConfig } from '../types/index.js';

/**
 * Configuration for creating infrastructure services
 */
export interface InfrastructureConfig {
  botToken: string;
  userToken?: string;
  useUserTokenForRead: boolean;
  enableRateLimit: boolean;
  rateLimitRetries: number;
  maxRequestConcurrency: number;
  rejectRateLimitedCalls: boolean;
  logLevel: string;
  // Cache configuration
  cacheEnabled: boolean;
  cacheConfig: CacheServiceConfig;
  // Search ranking configuration
  searchRankingEnabled: boolean; // Enable/disable advanced search ranking features
  searchIndexTTL: number; // Search index cache TTL in seconds
  searchTimeDecayRate: number; // Time decay rate for message recency scoring (0.001-1.0)
  searchMaxIndexSize: number; // Maximum search index size for memory management
}

/**
 * Complete infrastructure services bundle
 */
export interface InfrastructureServices {
  clientManager: SlackClientManager;
  rateLimitService: RateLimitService;
  userService: UserService;
  requestHandler: RequestHandler;
  cacheService: CacheService | null; // Null when caching is disabled
  relevanceScorer: RelevanceScorer | null; // Null when search ranking is disabled
  config: {
    maxRequestConcurrency: number;
    cacheEnabled: boolean;
  };
}

/**
 * Create RelevanceScorer configuration from infrastructure configuration
 *
 * This factory function transforms infrastructure-level search ranking configuration
 * into the specific configuration format required by the RelevanceScorer class.
 *
 * @param config - Infrastructure configuration containing search ranking settings
 * @returns RelevanceScorer configuration with validated and transformed values
 * @throws {Error} When configuration values are invalid (negative TTL, non-positive rates)
 */
export const createRelevanceScorerConfig = (
  config: InfrastructureConfig
): RelevanceScorerConfig => {
  // Validate configuration parameters
  if (config.searchIndexTTL < 0) {
    throw new Error(`Invalid search index TTL: ${config.searchIndexTTL}. Must be non-negative.`);
  }
  if (config.searchTimeDecayRate <= 0) {
    throw new Error(
      `Invalid search time decay rate: ${config.searchTimeDecayRate}. Must be positive.`
    );
  }
  if (config.searchMaxIndexSize <= 0) {
    throw new Error(
      `Invalid search max index size: ${config.searchMaxIndexSize}. Must be positive.`
    );
  }

  // Convert searchTimeDecayRate to timeDecayHalfLife using practical conversion
  // Mathematical relationship: higher decay rate = shorter half-life (faster decay)
  // Formula: halfLife = baseHalfLife * (baseRate / actualRate)
  // Where baseHalfLife = 24 hours, baseRate = 0.01
  const timeDecayHalfLife = Math.max(1, 24 * (0.01 / config.searchTimeDecayRate));

  return {
    weights: {
      tfidf: 0.4, // TF-IDF content relevance weight
      timeDecay: 0.25, // Message recency weight
      engagement: 0.2, // User engagement (reactions, replies) weight
      urgency: 0.1, // Urgency keywords weight
      importance: 0.05, // Importance indicators weight
    },
    timeDecayHalfLife,
    miniSearchConfig: {
      fields: ['text', 'user'], // Fields to index and search
      storeFields: ['id', 'timestamp', 'threadTs'], // Fields to store for retrieval
      searchOptions: {
        boost: { text: 2, user: 1.5 }, // Field importance multipliers
        fuzzy: 0.2, // Fuzzy matching tolerance
      },
    },
    engagementMetrics: {
      reactionWeight: 0.3, // Weight for message reactions in engagement score
      replyWeight: 0.5, // Weight for thread replies in engagement score
      mentionWeight: 0.2, // Weight for user mentions in engagement score
    },
    cacheTTL: config.searchIndexTTL * 1000, // Convert seconds to milliseconds for cache
  };
};

/**
 * Create all infrastructure services with proper dependency injection
 * @param config - Configuration for the infrastructure
 * @returns Complete infrastructure services bundle
 */
export const createInfrastructureServices = (
  config: InfrastructureConfig
): InfrastructureServices => {
  // Create rate limit service first (no dependencies)
  const rateLimitService = createRateLimitService(config.rejectRateLimitedCalls);

  // Create client configuration
  const clientConfig: ClientConfig = {
    logLevel: convertLogLevel(config.logLevel),
    retryConfig: config.enableRateLimit
      ? {
          retries: config.rateLimitRetries,
          factor: 2,
          minTimeout: 1000,
          maxTimeout: 300000,
          randomize: true,
        }
      : undefined,
    maxRequestConcurrency: config.maxRequestConcurrency,
    rejectRateLimitedCalls: config.rejectRateLimitedCalls,
  };

  // Create client manager dependencies
  const clientManagerDependencies: ClientManagerDependencies = {
    botToken: config.botToken,
    userToken: config.userToken,
    useUserTokenForRead: config.useUserTokenForRead,
    enableRateLimit: config.enableRateLimit,
    clientConfig,
  };

  // Create client manager
  const clientManager = createSlackClientManager(clientManagerDependencies, rateLimitService);

  // Create Consolidated User Service using enhanced domain service with Infrastructure pattern
  // This eliminates duplication by using the domain service with getClient injection
  // Provides both lightweight utilities and TypeSafeAPI methods in a single service
  // Used by: thread-service, reaction-service, workspace-service, etc.
  // Role: Dual-purpose service supporting both Infrastructure utilities and Domain operations
  const userService = createUserService({
    getClient: () => clientManager.getClientForOperation('read'),
  });

  // Create request handler (uses existing validation functions)
  const requestHandler = createRequestHandler({
    validateInput,
    formatResponse: defaultResponseFormatter,
    formatError: defaultErrorFormatter,
  });

  // Create cache service (optional, controlled by configuration)
  let cacheService: CacheService | null = null;
  if (config.cacheEnabled) {
    try {
      // Create cache service with simplified dependencies for demonstration
      // In production, you would properly align the interfaces
      cacheService = CacheServiceFactory.createWithDefaults({
        clientManager: {
          getBotClient: () => clientManager.getClientForOperation('write'),
          getUserClient: () => clientManager.getClientForOperation('read'),
          getClientForOperation: (operation: string) =>
            clientManager.getClientForOperation(operation as 'read' | 'write'),
        },
        rateLimitService: {
          trackRequest: (_tier: string) => {
            /* stub for demo */
          },
          getMetrics: () => rateLimitService.getMetrics(),
        },
        requestHandler: {
          validateInput: <T>(schema: unknown, input: unknown) =>
            validateInput(schema as z.ZodSchema<T>, input),
          handleRequest: async <T>(fn: () => Promise<T>) => await fn(),
        },
        userService: {
          getUser: async (userId: string) => await userService.getUserInfoDirect(userId),
          getUserDisplayName: async (userId: string) => await userService.getDisplayName(userId),
        },
        config: {
          botToken: config.botToken,
          userToken: config.userToken,
          enableRateLimit: config.enableRateLimit,
        },
      });
    } catch (error) {
      // Log error but continue without cache to maintain backward compatibility
      console.warn('Failed to initialize cache service, continuing without caching:', error);
      cacheService = null;
    }
  }

  // Create relevance scorer (optional, controlled by configuration)
  // The relevance scorer provides advanced search ranking with TF-IDF, time decay, and engagement metrics
  let relevanceScorer: RelevanceScorer | null = null;
  if (config.searchRankingEnabled) {
    try {
      const scorerConfig = createRelevanceScorerConfig(config);
      relevanceScorer = new RelevanceScorer(scorerConfig);
    } catch (error) {
      // Log error but continue without relevance scoring to maintain backward compatibility
      // This ensures the application remains functional even if search ranking configuration is invalid
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.warn(
        `Failed to initialize relevance scorer: ${errorMessage}. Continuing without advanced search ranking.`
      );
      relevanceScorer = null;
    }
  }

  return {
    clientManager,
    rateLimitService,
    userService,
    requestHandler,
    cacheService,
    relevanceScorer,
    config: {
      maxRequestConcurrency: config.maxRequestConcurrency,
      cacheEnabled: config.cacheEnabled && cacheService !== null,
    },
  };
};
