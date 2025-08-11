/**
 * Infrastructure services integration tests
 */

import {
  createInfrastructureServices,
  type InfrastructureConfig,
} from '../slack/infrastructure/index.js';

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
  };

  describe('createInfrastructureServices', () => {
    it('should create all services with proper dependencies', () => {
      const services = createInfrastructureServices(mockConfig);

      expect(services).toBeDefined();
      expect(services.clientManager).toBeDefined();
      expect(services.rateLimitService).toBeDefined();
      expect(services.userService).toBeDefined();
      expect(services.requestHandler).toBeDefined();
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
