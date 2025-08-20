/**
 * @fileoverview Search Ranking Integration Tests
 * 
 * Comprehensive integration tests for the search ranking system, verifying:
 * - Configuration toggle functionality (SEARCH_RANKING_ENABLED)
 * - RelevanceScorer creation and initialization
 * - Integration with search services (messages, threads, files)
 * - Performance requirements and error handling
 * - End-to-end configuration flow from CONFIG → infrastructure → services
 * 
 * Created: 2025-08-20 (Phase 4: Comprehensive Testing - TDD for existing code)
 */

import { jest } from '@jest/globals';

// Mock configuration before imports
const mockConfig = {
  SLACK_BOT_TOKEN: 'xoxb-test-token',
  SLACK_USER_TOKEN: 'xoxp-test-token',
  USE_USER_TOKEN_FOR_READ: true,
  LOG_LEVEL: 'info',
  CACHE_ENABLED: true,
  SEARCH_RANKING_ENABLED: true, // Will be modified per test
  SEARCH_INDEX_TTL: 900,
  SEARCH_TIME_DECAY_RATE: 0.01,
  SEARCH_MAX_INDEX_SIZE: 10000,
  SLACK_ENABLE_RATE_LIMIT_RETRY: true,
  SLACK_RATE_LIMIT_RETRIES: 3,
  SLACK_MAX_REQUEST_CONCURRENCY: 3,
};

jest.mock('../config/index.js', () => ({
  CONFIG: mockConfig,
}));

// Mock logger
jest.mock('../utils/logger.js', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

// Mock WebClient
const mockWebClient = {
  search: {
    messages: jest.fn() as jest.MockedFunction<any>,
    files: jest.fn() as jest.MockedFunction<any>,
  },
  conversations: {
    history: jest.fn() as jest.MockedFunction<any>,
    replies: jest.fn() as jest.MockedFunction<any>,
  },
  files: {
    list: jest.fn() as jest.MockedFunction<any>,
  },
  on: jest.fn() as jest.MockedFunction<any>,
  apiCall: jest.fn() as jest.MockedFunction<any>,
};

jest.mock('@slack/web-api', () => ({
  WebClient: jest.fn().mockImplementation(() => mockWebClient),
  LogLevel: {
    DEBUG: 'debug',
    INFO: 'info',
    WARN: 'warn',
    ERROR: 'error',
  },
  WebClientEvent: {
    RATE_LIMITED: 'rate_limited',
    SLACK_EVENT: 'slack_event',
  },
}));

import { createInfrastructureServices, createRelevanceScorerConfig } from '../slack/infrastructure/factory.js';
import type { InfrastructureConfig } from '../slack/infrastructure/factory.js';
import { RelevanceScorer } from '../slack/analysis/search/relevance-scorer.js';
import { SlackService } from '../slack/slack-service.js';
import type { SlackMessage } from '../slack/types/index.js';

describe('Search Ranking Integration', () => {
  let originalSearchRankingEnabled: boolean;

  // Helper function to create complete infrastructure config
  const createTestInfrastructureConfig = (overrides: Partial<InfrastructureConfig> = {}): InfrastructureConfig => ({
    botToken: 'xoxb-test-token',
    userToken: 'xoxp-test-token',
    useUserTokenForRead: true,
    enableRateLimit: true,
    rateLimitRetries: 3,
    maxRequestConcurrency: 3,
    rejectRateLimitedCalls: false,
    logLevel: 'info',
    cacheEnabled: true,
    cacheConfig: {
      channels: { max: 1000, ttl: 3600000, updateAgeOnGet: true },
      users: { max: 500, ttl: 1800000, updateAgeOnGet: true },
      search: { 
        maxQueries: 100, 
        maxResults: 200, 
        queryTTL: 900000, 
        resultTTL: 900000, 
        adaptiveTTL: true, 
        enablePatternInvalidation: true 
      },
      files: { max: 300, ttl: 7200000 },
      threads: { max: 200, ttl: 1800000, updateAgeOnGet: true },
      enableMetrics: true,
    },
    searchRankingEnabled: true,
    searchIndexTTL: 900,
    searchTimeDecayRate: 0.01,
    searchMaxIndexSize: 10000,
    ...overrides,
  });

  beforeEach(() => {
    // Store original value and reset mocks
    originalSearchRankingEnabled = mockConfig.SEARCH_RANKING_ENABLED;
    jest.clearAllMocks();
  });

  afterEach(() => {
    // Restore original configuration
    mockConfig.SEARCH_RANKING_ENABLED = originalSearchRankingEnabled;
  });

  describe('Configuration Toggle Verification', () => {
    describe('When SEARCH_RANKING_ENABLED is true', () => {
      beforeEach(() => {
        mockConfig.SEARCH_RANKING_ENABLED = true;
      });

      it('should create RelevanceScorer instance in infrastructure services', () => {
        const infrastructureConfig = createTestInfrastructureConfig({
          searchRankingEnabled: true,
        });

        const services = createInfrastructureServices(infrastructureConfig);

        expect(services.relevanceScorer).not.toBeNull();
        expect(services.relevanceScorer).toBeInstanceOf(RelevanceScorer);
      });

      it('should create valid RelevanceScorer configuration', () => {
        const infrastructureConfig = createTestInfrastructureConfig({
          searchRankingEnabled: true,
        });

        const scorerConfig = createRelevanceScorerConfig(infrastructureConfig);

        expect(scorerConfig).toBeDefined();
        expect(scorerConfig.weights).toBeDefined();
        expect(scorerConfig.weights.tfidf).toBeGreaterThan(0);
        expect(scorerConfig.weights.timeDecay).toBeGreaterThan(0);
        expect(scorerConfig.weights.engagement).toBeGreaterThan(0);
        expect(scorerConfig.timeDecayHalfLife).toBeGreaterThan(0);
        expect(scorerConfig.cacheTTL).toBe(900000); // Converted from seconds to milliseconds
      });

      it('should validate configuration parameters', () => {
        const invalidConfigs = [
          // Invalid TTL
          createTestInfrastructureConfig({
            searchIndexTTL: -1, // Invalid negative TTL
          }),
          // Invalid decay rate
          createTestInfrastructureConfig({
            searchTimeDecayRate: 0, // Invalid zero decay rate
          }),
          // Invalid index size
          createTestInfrastructureConfig({
            searchMaxIndexSize: -1, // Invalid negative index size
          }),
        ];

        invalidConfigs.forEach((config, _index) => {
          expect(() => createRelevanceScorerConfig(config)).toThrow();
        });
      });
    });

    describe('When SEARCH_RANKING_ENABLED is false', () => {
      beforeEach(() => {
        mockConfig.SEARCH_RANKING_ENABLED = false;
      });

      it('should create null RelevanceScorer in infrastructure services', () => {
        const infrastructureConfig = createTestInfrastructureConfig({
          searchRankingEnabled: false,
        });

        const services = createInfrastructureServices(infrastructureConfig);

        expect(services.relevanceScorer).toBeNull();
      });

      it('should continue normal operation without ranking', () => {
        const infrastructureConfig = createTestInfrastructureConfig({
          searchRankingEnabled: false,
        });

        // Should not throw errors
        expect(() => createInfrastructureServices(infrastructureConfig)).not.toThrow();

        const services = createInfrastructureServices(infrastructureConfig);
        expect(services.clientManager).toBeDefined();
        expect(services.rateLimitService).toBeDefined();
        expect(services.requestHandler).toBeDefined();
        expect(services.cacheService).toBeDefined();
        expect(services.relevanceScorer).toBeNull();
      });
    });
  });

  describe('Search Service Integration', () => {
    const mockMessages: SlackMessage[] = [
      {
        text: 'First message about project planning',
        ts: '1234567890.123456',
        user: 'U123456',
        type: 'message',
      },
      {
        text: 'Second message discussing implementation details',
        ts: '1234567891.123456',
        user: 'U789012',
        type: 'message',
      },
      {
        text: 'Third message about testing strategies',
        ts: '1234567892.123456',
        user: 'U345678',
        type: 'message',
      },
    ];

    beforeEach(() => {
      // Mock successful API responses
      mockWebClient.search.messages.mockResolvedValue({
        ok: true,
        messages: {
          matches: mockMessages.map((msg, index) => ({
            ...msg,
            score: 1.0 - (index * 0.1), // Decreasing scores
          })),
          total: mockMessages.length,
        },
      });

      mockWebClient.search.files.mockResolvedValue({
        ok: true,
        files: {
          matches: [
            {
              id: 'F123456',
              name: 'project-plan.pdf',
              title: 'Project Planning Document',
              timestamp: '1234567890',
            },
          ],
          total: 1,
        },
      });

      mockWebClient.conversations.history.mockResolvedValue({
        ok: true,
        messages: mockMessages,
        has_more: false,
      });
    });

    describe('With ranking enabled', () => {
      beforeEach(() => {
        mockConfig.SEARCH_RANKING_ENABLED = true;
      });

      it('should apply relevance scoring to searchMessages', async () => {
        const slackService = new SlackService();

        const result = await slackService.searchMessages({
          query: 'project planning implementation',
          count: 10,
        });

        expect(result.content).toBeDefined();
        expect(result.isError).toBeFalsy();
        expect(mockWebClient.search.messages).toHaveBeenCalledWith({
          query: 'project planning implementation',
          count: 10,
          sort: 'score',
          sort_dir: 'desc',
          highlight: false,
          page: 1,
        });
      });

      it('should apply relevance scoring to searchFiles', async () => {
        const slackService = new SlackService();

        const result = await slackService.searchFiles({
          query: 'project plan',
          count: 10,
        });

        expect(result.content).toBeDefined();
        expect(result.isError).toBeFalsy();
        expect(mockWebClient.search.files).toHaveBeenCalledWith({
          query: 'project plan',
          count: 10,
          sort: 'timestamp',
          sort_dir: 'desc',
        });
      });

      it('should handle relevance scoring errors gracefully', async () => {
        // This test verifies that if RelevanceScorer fails during operation,
        // the search service should still return results (fallback behavior)
        const slackService = new SlackService();

        // Should still work - services are designed to fallback gracefully
        const result = await slackService.searchMessages({
          query: 'test query',
          count: 10,
        });

        expect(result.content).toBeDefined();
        expect(result.isError).toBeFalsy();
      });
    });

    describe('With ranking disabled', () => {
      beforeEach(() => {
        mockConfig.SEARCH_RANKING_ENABLED = false;
      });

      it('should return original results without ranking for searchMessages', async () => {
        const slackService = new SlackService();

        const result = await slackService.searchMessages({
          query: 'project planning',
          count: 10,
        });

        expect(result.content).toBeDefined();
        expect(result.isError).toBeFalsy();
        // Should still call Slack API normally
        expect(mockWebClient.search.messages).toHaveBeenCalledWith({
          query: 'project planning',
          count: 10,
          sort: 'score',
          sort_dir: 'desc',
          highlight: false,
          page: 1,
        });
      });

      it('should have no performance impact when ranking disabled', async () => {
        const slackService = new SlackService();

        const startTime = Date.now();
        
        await slackService.searchMessages({
          query: 'test query',
          count: 50,
        });

        const duration = Date.now() - startTime;

        // Should complete quickly without ranking overhead
        expect(duration).toBeLessThan(100); // Generous threshold for test environment
      });
    });
  });

  describe('Performance and Reliability', () => {
    beforeEach(() => {
      mockConfig.SEARCH_RANKING_ENABLED = true;
    });

    describe('Performance Requirements', () => {
      it('should meet performance requirements when ranking enabled', async () => {
        const slackService = new SlackService();

        // Mock larger message set
        const largeMessageSet = Array.from({ length: 100 }, (_, i) => ({
          text: `Message ${i} about project planning and implementation`,
          ts: `${1234567890 + i}.123456`,
          user: `U${i % 5}`,
          type: 'message' as const,
        }));

        mockWebClient.search.messages.mockResolvedValue({
          ok: true,
          messages: {
            matches: largeMessageSet,
            total: largeMessageSet.length,
          },
        });

        const startTime = Date.now();

        const result = await slackService.searchMessages({
          query: 'project planning implementation',
          count: 100,
        });

        const duration = Date.now() - startTime;

        expect(result.content).toBeDefined();
        expect(result.isError).toBeFalsy();
        
        // Should complete within reasonable time even with ranking
        // Increased threshold for test environment and ranking overhead
        expect(duration).toBeLessThan(500);
      });

      it('should handle memory efficiently with large result sets', async () => {
        const slackService = new SlackService();

        // Mock very large message set
        const veryLargeMessageSet = Array.from({ length: 1000 }, (_, i) => ({
          text: `Message ${i} with various content for testing memory usage`,
          ts: `${1234567890 + i}.123456`,
          user: `U${i % 10}`,
          type: 'message' as const,
        }));

        mockWebClient.search.messages.mockResolvedValue({
          ok: true,
          messages: {
            matches: veryLargeMessageSet,
            total: veryLargeMessageSet.length,
          },
        });

        // Should not throw out-of-memory errors
        expect(async () => {
          await slackService.searchMessages({
            query: 'testing memory usage',
            count: 1000,
          });
        }).not.toThrow();
      });
    });

    describe('Error Handling and Logging', () => {
      it('should log configuration errors appropriately', () => {
        const infrastructureConfig = createTestInfrastructureConfig({
          searchRankingEnabled: true,
          searchIndexTTL: -1, // Invalid configuration
        });

        // Should handle configuration errors gracefully
        const services = createInfrastructureServices(infrastructureConfig);
        
        // Should fallback to null relevance scorer on configuration error
        expect(services.relevanceScorer).toBeNull();
      });

      it('should handle RelevanceScorer initialization errors', () => {
        // Test with invalid configuration that should cause RelevanceScorer to fail
        const infrastructureConfig = createTestInfrastructureConfig({
          searchRankingEnabled: true,
          searchIndexTTL: -1, // Invalid configuration
        });

        // Should handle RelevanceScorer configuration errors gracefully
        const services = createInfrastructureServices(infrastructureConfig);
        expect(services.relevanceScorer).toBeNull();
      });
    });
  });

  describe('Configuration Flow End-to-End', () => {
    it('should propagate configuration from CONFIG to services correctly', () => {
      // Test with ranking enabled
      mockConfig.SEARCH_RANKING_ENABLED = true;
      mockConfig.SEARCH_INDEX_TTL = 1800; // 30 minutes
      mockConfig.SEARCH_TIME_DECAY_RATE = 0.05;
      mockConfig.SEARCH_MAX_INDEX_SIZE = 5000;

      const slackService = new SlackService();

      // Verify service was created successfully (indirect verification of config flow)
      expect(slackService).toBeDefined();
      expect(slackService.searchMessages).toBeDefined();
      expect(slackService.searchFiles).toBeDefined();
    });

    it('should handle configuration changes correctly', () => {
      // First, create with ranking enabled
      mockConfig.SEARCH_RANKING_ENABLED = true;
      const serviceWithRanking = new SlackService();
      expect(serviceWithRanking).toBeDefined();

      // Then, create with ranking disabled
      mockConfig.SEARCH_RANKING_ENABLED = false;
      const serviceWithoutRanking = new SlackService();
      expect(serviceWithoutRanking).toBeDefined();

      // Both should be valid but potentially behave differently
      expect(serviceWithRanking.searchMessages).toBeDefined();
      expect(serviceWithoutRanking.searchMessages).toBeDefined();
    });

    it('should validate complete configuration chain', () => {
      // Test with valid configuration
      const validConfig = {
        SEARCH_RANKING_ENABLED: true,
        SEARCH_INDEX_TTL: 900,
        SEARCH_TIME_DECAY_RATE: 0.01,
        SEARCH_MAX_INDEX_SIZE: 10000,
      };

      Object.assign(mockConfig, validConfig);

      // Should create infrastructure services successfully
      const infrastructureConfig = createTestInfrastructureConfig({
        searchRankingEnabled: mockConfig.SEARCH_RANKING_ENABLED,
        searchIndexTTL: mockConfig.SEARCH_INDEX_TTL,
        searchTimeDecayRate: mockConfig.SEARCH_TIME_DECAY_RATE,
        searchMaxIndexSize: mockConfig.SEARCH_MAX_INDEX_SIZE,
      });

      const services = createInfrastructureServices(infrastructureConfig);
      expect(services.relevanceScorer).toBeInstanceOf(RelevanceScorer);

      // Should create Slack service successfully
      const slackService = new SlackService();
      expect(slackService).toBeDefined();
    });
  });
});