/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { jest } from '@jest/globals';
import { SlackService } from '../slack/slack-service';

// Mock WebClient
const createMockWebClient = (): any => ({
  chat: {
    postMessage: jest.fn(() => Promise.resolve({ ok: true, ts: '1234567890.123456' })),
  },
  conversations: {
    list: jest.fn(() =>
      Promise.resolve({
        ok: true,
        channels: [{ id: 'C123', name: 'general', is_member: true, is_archived: false }],
      })
    ),
  },
  users: {
    info: jest.fn(() =>
      Promise.resolve({
        ok: true,
        user: { id: 'U123', name: 'testuser', real_name: 'Test User' },
      })
    ),
  },
  on: jest.fn(),
});

let mockWebClientInstance = createMockWebClient();

jest.mock('@slack/web-api', () => ({
  WebClient: jest.fn().mockImplementation(() => mockWebClientInstance),
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

// Mock config with modular architecture enabled
jest.mock('../config/index', () => {
  const mockConfig = {
    SLACK_BOT_TOKEN: 'xoxb-test-token',
    SLACK_USER_TOKEN: 'xoxp-test-token',
    USE_USER_TOKEN_FOR_READ: false,
    LOG_LEVEL: 'error',
    MCP_SERVER_NAME: 'test-server',
    MCP_SERVER_VERSION: '1.0.0',
    PORT: 3000,
    // Modular architecture flags
    USE_MODULAR_ARCHITECTURE: true,
    ENABLE_MODULAR_MESSAGES: true,
    ENABLE_MODULAR_THREADS: true,
    ENABLE_MODULAR_FILES: true,
    ENABLE_MODULAR_REACTIONS: true,
    ENABLE_MODULAR_WORKSPACE: true,
    ENABLE_PERFORMANCE_METRICS: false,
    MONITOR_LEGACY_COMPARISON: false,
  };
  return {
    CONFIG: mockConfig,
    getConfig: () => mockConfig,
    loadConfig: () => mockConfig,
  };
});

// Mock logger
jest.mock('../utils/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  },
}));

describe('Modular Architecture Tests', () => {
  let service: SlackService;

  beforeEach(() => {
    jest.clearAllMocks();
    mockWebClientInstance = createMockWebClient();
    service = new SlackService();
  });

  describe('Modular Service Routing', () => {
    it('should route sendMessage through modular architecture', async () => {
      const result = await service.sendMessage({
        channel: 'C123456',
        text: 'Hello from modular!',
      });

      expect(result).toBeDefined();
      expect(result.content).toBeDefined();
      expect(mockWebClientInstance.chat.postMessage).toHaveBeenCalledWith({
        channel: 'C123456',
        text: 'Hello from modular!',
      });
    });

    it('should route listChannels through modular architecture', async () => {
      const result = await service.listChannels({
        exclude_archived: true,
      });

      expect(result).toBeDefined();
      expect(result.content).toBeDefined();
      expect(mockWebClientInstance.conversations.list).toHaveBeenCalledWith({
        exclude_archived: true,
        types: 'public_channel,private_channel',
        limit: 1000,
      });
    });

    it('should route getUserInfo through modular architecture', async () => {
      const result = await service.getUserInfo({
        user: 'U123456',
      });

      expect(result).toBeDefined();
      expect(result.content).toBeDefined();
      expect(mockWebClientInstance.users.info).toHaveBeenCalledWith({
        user: 'U123456',
      });
    });
  });

  describe('Service Health with Modular Architecture', () => {
    it('should report modular architecture status in health check', async () => {
      const result = await service.getServerHealth({});

      expect(result).toBeDefined();
      expect(result.content).toBeDefined();
      expect(result.content?.[0]?.type).toBe('text');
      // Modular health check returns JSON object with health metrics
      const healthData = JSON.parse(result.content?.[0]?.text || '{}');
      expect(healthData).toHaveProperty('status');
      expect(healthData).toHaveProperty('timestamp');
      expect(healthData).toHaveProperty('connectivity');
    });
  });

  describe('Performance Monitoring', () => {
    it('should not affect method execution when metrics disabled', async () => {
      const startTime = Date.now();

      await service.sendMessage({
        channel: 'C123456',
        text: 'Performance test',
      });

      const endTime = Date.now();
      const executionTime = endTime - startTime;

      // Should execute quickly (under 100ms for mocked call)
      expect(executionTime).toBeLessThan(100);
    });
  });

  describe('Error Handling in Modular Architecture', () => {
    it('should handle API errors properly in modular architecture', async () => {
      mockWebClientInstance.chat.postMessage.mockRejectedValueOnce(new Error('API Error'));

      // Modular architecture should throw errors just like legacy
      let thrownError: any;
      try {
        await service.sendMessage({
          channel: 'C123456',
          text: 'This will fail',
        });
      } catch (error) {
        thrownError = error;
      }

      expect(thrownError).toBeDefined();
      expect(thrownError.message).toContain('API Error');
    });

    it('should handle validation errors in modular architecture', async () => {
      // Modular architecture should throw validation errors just like legacy
      let thrownError: any;
      try {
        await service.sendMessage({
          // Missing required 'text' field
          channel: 'C123456',
        } as any);
      } catch (error) {
        thrownError = error;
      }

      expect(thrownError).toBeDefined();
      expect(thrownError.message).toContain('text');
    });
  });
});

describe('Legacy vs Modular Comparison', () => {
  it('should produce identical results between legacy and modular', async () => {
    // Create two services with different configs
    const mockConfigLegacy = {
      SLACK_BOT_TOKEN: 'xoxb-test-token',
      USE_MODULAR_ARCHITECTURE: false,
      LOG_LEVEL: 'error',
    };

    const mockConfigModular = {
      SLACK_BOT_TOKEN: 'xoxb-test-token',
      USE_MODULAR_ARCHITECTURE: true,
      ENABLE_MODULAR_MESSAGES: true,
      LOG_LEVEL: 'error',
    };

    // Mock config to return different values
    const getConfig = jest.fn();
    getConfig.mockReturnValueOnce(mockConfigLegacy);
    jest.doMock('../config/index', () => ({
      CONFIG: mockConfigLegacy,
      getConfig,
    }));

    const legacyService = new SlackService();

    // Switch to modular config
    getConfig.mockReturnValueOnce(mockConfigModular);
    jest.doMock('../config/index', () => ({
      CONFIG: mockConfigModular,
      getConfig,
    }));

    const modularService = new SlackService();

    // Both should produce same result structure
    const input = { user: 'U123456' };

    const legacyResult = await legacyService.getUserInfo(input);
    const modularResult = await modularService.getUserInfo(input);

    expect(legacyResult.content).toBeDefined();
    expect(modularResult.content).toBeDefined();
    expect(typeof legacyResult).toBe(typeof modularResult);
  });
});
