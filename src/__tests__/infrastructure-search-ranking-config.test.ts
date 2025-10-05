/**
 * Infrastructure Search Ranking Configuration Integration Tests
 *
 * Tests the integration of search ranking configuration into the infrastructure layer
 * following TDD Red-Green-Refactor cycle.
 *
 * Phase 1: Infrastructure Configuration Integration
 * - Tests that InfrastructureConfig accepts search ranking configuration
 * - Tests that RelevanceScorerConfig factory transforms configuration properly
 * - Tests that RelevanceScorer is created when enabled and null when disabled
 */

import { jest } from '@jest/globals';
import type {
  InfrastructureConfig,
  InfrastructureServices,
} from '../slack/infrastructure/index.js';
import type { RelevanceScorerConfig } from '../slack/types/index.js';

// Mock all dependencies
jest.mock('../config/index.js', () => ({
  CONFIG: {
    SLACK_BOT_TOKEN: 'xoxb-test',
    SLACK_USER_TOKEN: 'xoxp-test',
    USE_USER_TOKEN_FOR_READ: false,
    SLACK_ENABLE_RATE_LIMIT_RETRY: true,
    SLACK_RATE_LIMIT_RETRIES: 3,
    SLACK_MAX_REQUEST_CONCURRENCY: 3,
    SLACK_REJECT_RATE_LIMITED_CALLS: false,
    LOG_LEVEL: 'info',
    CACHE_ENABLED: true,
    SEARCH_RANKING_ENABLED: true,
    SEARCH_INDEX_TTL: 900,
    SEARCH_TIME_DECAY_RATE: 0.01,
    SEARCH_MAX_INDEX_SIZE: 10000,
    // Cache config values
    CACHE_CHANNELS_MAX: 1000,
    CACHE_CHANNELS_TTL: 3600,
    CACHE_USERS_MAX: 500,
    CACHE_USERS_TTL: 1800,
    CACHE_SEARCH_MAX_QUERIES: 100,
    CACHE_SEARCH_MAX_RESULTS: 1000,
    CACHE_SEARCH_QUERY_TTL: 300,
    CACHE_SEARCH_RESULT_TTL: 900,
    CACHE_FILES_MAX: 500,
    CACHE_FILES_TTL: 1800,
    CACHE_THREADS_MAX: 200,
    CACHE_THREADS_TTL: 1800,
  },
}));

jest.mock('@slack/web-api', () => ({
  WebClient: jest.fn().mockImplementation(() => ({
    on: jest.fn(),
    apiCall: jest.fn(),
    auth: {
      test: jest.fn(),
    },
  })),
  LogLevel: {
    DEBUG: 'debug',
    INFO: 'info',
    WARN: 'warn',
    ERROR: 'error',
  },
  WebClientEvent: {
    RATE_LIMITED: 'rate_limited',
  },
}));

describe('Infrastructure Search Ranking Configuration Integration', () => {
  let createInfrastructureServices: (config: InfrastructureConfig) => InfrastructureServices;
  let createRelevanceScorerConfig: (config: InfrastructureConfig) => RelevanceScorerConfig;

  beforeEach(async () => {
    jest.clearAllMocks();

    // Import the functions we're testing
    const { createInfrastructureServices: createInfrastructureServicesImpl } = await import(
      '../slack/infrastructure/index.js'
    );
    createInfrastructureServices = createInfrastructureServicesImpl;

    const { createRelevanceScorerConfig: createRelevanceScorerConfigImpl } = await import(
      '../slack/infrastructure/index.js'
    );
    createRelevanceScorerConfig = createRelevanceScorerConfigImpl;
  });

  describe('InfrastructureConfig interface extension', () => {
    it('should accept search ranking configuration properties', () => {
      // This test will fail initially because InfrastructureConfig doesn't have these properties
      const config: InfrastructureConfig = {
        botToken: 'xoxb-test',
        userToken: 'xoxp-test',
        useUserTokenForRead: false,
        enableRateLimit: true,
        rateLimitRetries: 3,
        maxRequestConcurrency: 3,
        rejectRateLimitedCalls: false,
        logLevel: 'info',
        cacheEnabled: true,
        cacheConfig: {} as any,
        // These properties should be added to InfrastructureConfig
        searchRankingEnabled: true,
        searchIndexTTL: 900,
        searchTimeDecayRate: 0.01,
        searchMaxIndexSize: 10000,
      };

      // This should compile without TypeScript errors once interface is extended
      expect(config.searchRankingEnabled).toBe(true);
      expect(config.searchIndexTTL).toBe(900);
      expect(config.searchTimeDecayRate).toBe(0.01);
      expect(config.searchMaxIndexSize).toBe(10000);
    });
  });

  describe('InfrastructureServices interface extension', () => {
    it('should include relevanceScorer property', () => {
      // Create a minimal config for testing
      const config: InfrastructureConfig = {
        botToken: 'xoxb-test',
        useUserTokenForRead: false,
        enableRateLimit: true,
        rateLimitRetries: 3,
        maxRequestConcurrency: 3,
        rejectRateLimitedCalls: false,
        logLevel: 'info',
        cacheEnabled: false,
        cacheConfig: {} as any,
        // These will fail initially
        searchRankingEnabled: true,
        searchIndexTTL: 900,
        searchTimeDecayRate: 0.01,
        searchMaxIndexSize: 10000,
      } as InfrastructureConfig;

      // This will fail initially because createInfrastructureServices doesn't handle search config
      const services = createInfrastructureServices(config);

      // This property should be added to InfrastructureServices interface
      expect('relevanceScorer' in services).toBe(true);
    });
  });

  describe('createRelevanceScorerConfig factory function', () => {
    it('should transform infrastructure config to RelevanceScorer config', () => {
      const infrastructureConfig: InfrastructureConfig = {
        botToken: 'xoxb-test',
        useUserTokenForRead: false,
        enableRateLimit: true,
        rateLimitRetries: 3,
        maxRequestConcurrency: 3,
        rejectRateLimitedCalls: false,
        logLevel: 'info',
        cacheEnabled: false,
        cacheConfig: {} as any,
        searchRankingEnabled: true,
        searchIndexTTL: 900,
        searchTimeDecayRate: 0.01,
        searchMaxIndexSize: 10000,
      } as InfrastructureConfig;

      // This will fail initially because function doesn't exist
      const scorerConfig = createRelevanceScorerConfig(infrastructureConfig);

      // Verify the transformation
      expect(scorerConfig).toEqual({
        weights: {
          tfidf: 0.4,
          timeDecay: 0.25,
          engagement: 0.2,
          urgency: 0.1,
          importance: 0.05,
        },
        timeDecayHalfLife: 24, // Default value based on searchTimeDecayRate
        miniSearchConfig: {
          fields: ['text', 'user'],
          storeFields: ['id', 'timestamp', 'threadTs'],
          searchOptions: {
            boost: { text: 2, user: 1.5 },
            fuzzy: 0.2,
          },
        },
        engagementMetrics: {
          reactionWeight: 0.3,
          replyWeight: 0.5,
          mentionWeight: 0.2,
        },
        cacheTTL: 900000, // searchIndexTTL * 1000 (convert seconds to milliseconds)
      });
    });

    it('should handle custom time decay rate conversion', () => {
      const infrastructureConfig: InfrastructureConfig = {
        botToken: 'xoxb-test',
        useUserTokenForRead: false,
        enableRateLimit: true,
        rateLimitRetries: 3,
        maxRequestConcurrency: 3,
        rejectRateLimitedCalls: false,
        logLevel: 'info',
        cacheEnabled: false,
        cacheConfig: {} as any,
        searchRankingEnabled: true,
        searchIndexTTL: 1200,
        searchTimeDecayRate: 0.05, // Custom rate
        searchMaxIndexSize: 5000,
      } as InfrastructureConfig;

      const scorerConfig = createRelevanceScorerConfig(infrastructureConfig);

      // Verify time decay conversion: rate 0.05 should result in shorter half-life
      expect(scorerConfig.timeDecayHalfLife).toBeLessThan(24);
      expect(scorerConfig.cacheTTL).toBe(1200000); // 1200 * 1000
    });
  });

  describe('createInfrastructureServices RelevanceScorer creation', () => {
    it('should create RelevanceScorer when searchRankingEnabled is true', () => {
      const config: InfrastructureConfig = {
        botToken: 'xoxb-test',
        useUserTokenForRead: false,
        enableRateLimit: true,
        rateLimitRetries: 3,
        maxRequestConcurrency: 3,
        rejectRateLimitedCalls: false,
        logLevel: 'info',
        cacheEnabled: false,
        cacheConfig: {} as any,
        searchRankingEnabled: true,
        searchIndexTTL: 900,
        searchTimeDecayRate: 0.01,
        searchMaxIndexSize: 10000,
      } as InfrastructureConfig;

      const services = createInfrastructureServices(config);

      // This will fail initially
      expect(services.relevanceScorer).not.toBeNull();
      expect(services.relevanceScorer).toBeDefined();
    });

    it('should set relevanceScorer to null when searchRankingEnabled is false', () => {
      const config: InfrastructureConfig = {
        botToken: 'xoxb-test',
        useUserTokenForRead: false,
        enableRateLimit: true,
        rateLimitRetries: 3,
        maxRequestConcurrency: 3,
        rejectRateLimitedCalls: false,
        logLevel: 'info',
        cacheEnabled: false,
        cacheConfig: {} as any,
        searchRankingEnabled: false,
        searchIndexTTL: 900,
        searchTimeDecayRate: 0.01,
        searchMaxIndexSize: 10000,
      } as InfrastructureConfig;

      const services = createInfrastructureServices(config);

      // This will fail initially
      expect(services.relevanceScorer).toBeNull();
    });

    it('should handle RelevanceScorer creation errors gracefully', () => {
      const config: InfrastructureConfig = {
        botToken: 'xoxb-test',
        useUserTokenForRead: false,
        enableRateLimit: true,
        rateLimitRetries: 3,
        maxRequestConcurrency: 3,
        rejectRateLimitedCalls: false,
        logLevel: 'info',
        cacheEnabled: false,
        cacheConfig: {} as any,
        searchRankingEnabled: true,
        searchIndexTTL: -1, // Invalid value to trigger error
        searchTimeDecayRate: 0.01,
        searchMaxIndexSize: 10000,
      } as InfrastructureConfig;

      // Should not throw error, but set relevanceScorer to null
      const services = createInfrastructureServices(config);
      expect(services.relevanceScorer).toBeNull();
    });
  });

  describe('Service factory integration', () => {
    it('should pass search ranking config from CONFIG to infrastructureConfig', async () => {
      // This test verifies that service-factory.ts properly passes search config
      const { createSlackServiceRegistry } = await import('../slack/service-factory.js');

      // This should not throw and should create services with search ranking config
      expect(() => createSlackServiceRegistry()).not.toThrow();
    });
  });
});
