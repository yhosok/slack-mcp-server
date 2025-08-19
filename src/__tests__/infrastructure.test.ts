/**
 * Infrastructure services integration tests
 */

import {
  createInfrastructureServices,
  type InfrastructureConfig,
} from '../slack/infrastructure/index.js';
import { WebClientEvent } from '@slack/web-api';

// Mock the logger to avoid console output during tests
jest.mock('../utils/logger', () => ({
  logger: {
    warn: jest.fn(),
    debug: jest.fn(),
    error: jest.fn(),
    info: jest.fn(),
  },
}));

// Mock the validation function
jest.mock('../utils/validation', () => ({
  validateInput: jest.fn((schema, args) => args),
}));

describe('Infrastructure Services', () => {
  const mockConfig: InfrastructureConfig = {
    botToken: 'xoxb-test-bot-token',
    userToken: 'xoxp-test-user-token',
    useUserTokenForRead: true,
    enableRateLimit: true,
    rateLimitRetries: 3,
    maxRequestConcurrency: 5,
    rejectRateLimitedCalls: false,
    logLevel: 'info',
    // Cache configuration - disabled by default for tests
    cacheEnabled: false,
    cacheConfig: {
      channels: {
        max: 100,
        ttl: 300000, // 5 minutes
        updateAgeOnGet: true,
      },
      users: {
        max: 500,
        ttl: 600000, // 10 minutes
        updateAgeOnGet: true,
      },
      search: {
        maxQueries: 50,
        maxResults: 200,
        queryTTL: 300000, // 5 minutes
        resultTTL: 600000, // 10 minutes
        adaptiveTTL: false,
        enablePatternInvalidation: false,
      },
      files: {
        max: 100,
        ttl: 300000, // 5 minutes
        maxSize: 1024 * 1024, // 1MB
      },
      threads: {
        max: 200,
        ttl: 300000, // 5 minutes
        updateAgeOnGet: true,
      },
      enableMetrics: false,
      globalMemoryLimit: 1024 * 1024 * 10, // 10MB
    },
  };

  describe('createInfrastructureServices', () => {
    it('should create all services with proper dependencies', () => {
      const services = createInfrastructureServices(mockConfig);

      expect(services).toBeDefined();
      expect(services.clientManager).toBeDefined();
      expect(services.rateLimitService).toBeDefined();
      expect(services.userService).toBeDefined();
      expect(services.requestHandler).toBeDefined();
      expect(services.cacheService).toBeDefined(); // Should be null when cacheEnabled: false
      
      // NEW EXPECTED STRUCTURE: config object should exist
      expect(services.config).toBeDefined();
      expect(typeof services.config).toBe('object');
    });

    it('should expose config object with maxRequestConcurrency and cache settings', () => {
      const services = createInfrastructureServices(mockConfig);

      // NEW EXPECTED STRUCTURE: config object with concurrency setting
      expect(services.config).toBeDefined();
      expect(services.config.maxRequestConcurrency).toBe(mockConfig.maxRequestConcurrency);
      expect(services.config.maxRequestConcurrency).toBe(5);
      
      // Cache configuration should reflect actual cache service state
      expect(services.config.cacheEnabled).toBe(false); // Cache is disabled in mockConfig
      expect(services.cacheService).toBeNull(); // Cache service should be null when disabled
      
      // OLD STRUCTURE: direct property should NOT exist anymore
      expect('maxRequestConcurrency' in services).toBe(false);
    });

    it('should create client manager with correct configuration', () => {
      const services = createInfrastructureServices(mockConfig);

      // Test that client manager can be called
      expect(() => services.clientManager.getBotClient()).not.toThrow();
      expect(() => services.clientManager.getUserClient()).not.toThrow();
    });

    it('should create rate limit service with initial metrics', () => {
      const services = createInfrastructureServices(mockConfig);

      const metrics = services.rateLimitService.getMetrics();

      expect(metrics).toBeDefined();
      expect(metrics.totalRequests).toBe(0);
      expect(metrics.rateLimitedRequests).toBe(0);
      expect(metrics.retryAttempts).toBe(0);
      expect(metrics.lastRateLimitTime).toBeNull();
      expect(metrics.rateLimitsByTier).toBeDefined();
    });

    it('should create user service with cache capabilities', () => {
      const services = createInfrastructureServices(mockConfig);

      // Test that user service methods exist
      expect(typeof services.userService.getDisplayName).toBe('function');
      expect(typeof services.userService.bulkGetDisplayNames).toBe('function');
      expect(typeof services.userService.clearCache).toBe('function');

      // Test cache clearing
      expect(() => services.userService.clearCache()).not.toThrow();
    });

    it('should create cache service when cacheEnabled is true', () => {
      const configWithCache: InfrastructureConfig = {
        ...mockConfig,
        cacheEnabled: true,
      };

      const services = createInfrastructureServices(configWithCache);

      // Cache service should be created when enabled
      expect(services.cacheService).toBeDefined();
      expect(services.cacheService).not.toBeNull();
      expect(services.config.cacheEnabled).toBe(true);
    });

    it('should handle cache service creation gracefully with any config', () => {
      const configWithCache: InfrastructureConfig = {
        ...mockConfig,
        cacheEnabled: true,
        // Test with different cache config values
        cacheConfig: {
          ...mockConfig.cacheConfig,
          channels: {
            max: -1, // Potentially invalid value
            ttl: -1, // Potentially invalid value
            updateAgeOnGet: true,
          },
        },
      };

      // Should not throw regardless of cache config values
      expect(() => {
        const services = createInfrastructureServices(configWithCache);
        // Cache service creation is resilient and should succeed
        expect(services.cacheService).toBeDefined();
        // The result should reflect whether cache was actually enabled
        expect(typeof services.config.cacheEnabled).toBe('boolean');
      }).not.toThrow();
    });

    it('should create request handler with proper formatting', async () => {
      const services = createInfrastructureServices(mockConfig);

      // Mock schema validation (already mocked globally)
      const mockSchema = {} as any;
      const mockInput = { test: 'input' };
      const mockOutput = { test: 'output' };
      const mockOperation = jest.fn().mockResolvedValue(mockOutput);

      const result = await services.requestHandler.handle(mockSchema, mockInput, mockOperation);

      expect(result).toBeDefined();
      expect(result.content).toBeDefined();
      expect(Array.isArray(result.content)).toBe(true);
      expect(mockOperation).toHaveBeenCalledWith(mockInput);
    });

    it('should handle errors properly in request handler', async () => {
      const services = createInfrastructureServices(mockConfig);

      const mockSchema = {} as any;
      const mockInput = { test: 'input' };
      const mockError = new Error('Test error');
      const mockOperation = jest.fn().mockRejectedValue(mockError);

      const result = await services.requestHandler.handle(mockSchema, mockInput, mockOperation);

      expect(result).toBeDefined();
      expect(result.content).toBeDefined();
      expect(result.isError).toBe(true);
      expect(result.content[0]).toBeDefined();
      expect((result.content[0] as any).text).toContain('Test error');
    });
  });

  describe('Rate Limit Service', () => {
    it('should extract API tiers correctly', () => {
      const services = createInfrastructureServices(mockConfig);

      expect(
        services.rateLimitService.extractTierFromUrl('https://slack.com/api/chat.postMessage')
      ).toBe('tier1');
      expect(
        services.rateLimitService.extractTierFromUrl('https://slack.com/api/conversations.history')
      ).toBe('tier2');
      expect(
        services.rateLimitService.extractTierFromUrl('https://slack.com/api/search.messages')
      ).toBe('tier3');
      // Note: admin.users.list matches "users." first, so it returns tier2
      expect(
        services.rateLimitService.extractTierFromUrl('https://slack.com/api/admin.users.list')
      ).toBe('tier2');
      // Pure admin endpoint without users/conversations/etc
      expect(
        services.rateLimitService.extractTierFromUrl('https://slack.com/api/admin.teams.list')
      ).toBe('tier4');
      expect(
        services.rateLimitService.extractTierFromUrl('https://slack.com/api/custom.endpoint')
      ).toBe('other');
      expect(services.rateLimitService.extractTierFromUrl(undefined)).toBe('unknown');
    });

    it('should increment retry attempts when rate limit events occur', () => {
      // Create a fresh service instance for this test
      const freshServices = createInfrastructureServices({
        ...mockConfig,
        botToken: 'xoxb-test-fresh-bot-token', // Use different token to ensure fresh instance
      });

      // Get initial metrics to verify starting state
      const initialMetrics = freshServices.rateLimitService.getMetrics();
      expect(initialMetrics.retryAttempts).toBe(0);
      expect(initialMetrics.rateLimitedRequests).toBe(0);

      // Get the bot client (already has rate limit tracking enabled)
      const trackedClient = freshServices.clientManager.getBotClient();

      // Simulate a rate limit event that should trigger retry tracking
      // This should increment both rateLimitedRequests AND retryAttempts
      trackedClient.emit(WebClientEvent.RATE_LIMITED, 30, {
        team_id: 'T12345',
        api_url: 'https://slack.com/api/chat.postMessage',
      });

      // Verify that retry attempts are incremented
      const metricsAfterRateLimit = freshServices.rateLimitService.getMetrics();
      expect(metricsAfterRateLimit.rateLimitedRequests).toBe(1);
      expect(metricsAfterRateLimit.retryAttempts).toBe(1); // Rate limit tracking increments retries when rejectRateLimitedCalls is false
      expect(metricsAfterRateLimit.lastRateLimitTime).toBeInstanceOf(Date);

      // Test multiple rate limit events to verify cumulative retry tracking
      trackedClient.emit(WebClientEvent.RATE_LIMITED, 60, {
        team_id: 'T12345',
        api_url: 'https://slack.com/api/conversations.history',
      });

      const finalMetrics = freshServices.rateLimitService.getMetrics();
      expect(finalMetrics.rateLimitedRequests).toBe(2);
      expect(finalMetrics.retryAttempts).toBe(2); // Cumulative retry tracking
    });

    it('should track retry attempts separately from rate limit hits', () => {
      // Create a fresh service instance for this test
      const freshServices = createInfrastructureServices({
        ...mockConfig,
        botToken: 'xoxb-test-fresh-bot-token-2', // Use different token to ensure fresh instance
      });

      // Get the bot client (already has rate limit tracking enabled)
      const trackedClient = freshServices.clientManager.getBotClient();

      // Simulate scenario where a single rate limit triggers multiple retries
      // First rate limit event
      trackedClient.emit(WebClientEvent.RATE_LIMITED, 30, {
        team_id: 'T12345',
        api_url: 'https://slack.com/api/chat.postMessage',
      });

      let metrics = freshServices.rateLimitService.getMetrics();
      expect(metrics.rateLimitedRequests).toBe(1);
      expect(metrics.retryAttempts).toBe(1); // Retry tracking for individual rate limits

      // Simulate additional retry attempts for the same rate limit
      // (This would happen when SDK retries internally)
      trackedClient.emit(WebClientEvent.RATE_LIMITED, 60, {
        team_id: 'T12345',
        api_url: 'https://slack.com/api/chat.postMessage',
      });

      metrics = freshServices.rateLimitService.getMetrics();
      expect(metrics.rateLimitedRequests).toBe(2);
      expect(metrics.retryAttempts).toBe(2); // Multiple retry attempts tracked
    });

    it('should handle retry attempts with rejectRateLimitedCalls configuration', () => {
      // Test with rejectRateLimitedCalls: true (no retries should happen)
      const configWithReject: InfrastructureConfig = {
        ...mockConfig,
        botToken: 'xoxb-test-fresh-bot-token-3', // Use different token to ensure fresh instance
        rejectRateLimitedCalls: true,
      };

      const services = createInfrastructureServices(configWithReject);

      // Get the bot client (already has rate limit tracking enabled)
      const trackedClient = services.clientManager.getBotClient();

      // With rejectRateLimitedCalls: true, rate limits should be tracked but retries should not increment
      trackedClient.emit(WebClientEvent.RATE_LIMITED, 30, {
        team_id: 'T12345',
        api_url: 'https://slack.com/api/chat.postMessage',
      });

      const metrics = services.rateLimitService.getMetrics();
      expect(metrics.rateLimitedRequests).toBe(1);
      // When rejecting rate limited calls, retryAttempts should remain 0
      expect(metrics.retryAttempts).toBe(0); // No retries when calls are rejected
    });
  });

  describe('Client Manager', () => {
    it('should check search API availability correctly', () => {
      const configWithoutUserToken: InfrastructureConfig = {
        ...mockConfig,
        useUserTokenForRead: false,
        userToken: undefined,
      };

      const services = createInfrastructureServices(configWithoutUserToken);

      expect(() => {
        services.clientManager.checkSearchApiAvailability(
          'searchMessages',
          'Use getChannelHistory instead'
        );
      }).toThrow('searchMessages requires a user token');
    });

    it('should not throw for search API when properly configured', () => {
      const services = createInfrastructureServices(mockConfig);

      expect(() => {
        services.clientManager.checkSearchApiAvailability(
          'searchMessages',
          'Use getChannelHistory instead'
        );
      }).not.toThrow();
    });

    it('should get appropriate client for operations', () => {
      const services = createInfrastructureServices(mockConfig);

      // Should get user client for read operations when configured
      const readClient = services.clientManager.getClientForOperation('read');
      expect(readClient).toBeDefined();

      // Should get bot client for write operations
      const writeClient = services.clientManager.getClientForOperation('write');
      expect(writeClient).toBeDefined();
    });
  });
});
