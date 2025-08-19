/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { jest } from '@jest/globals';
import { SlackService } from '../slack/slack-service';
import { extractTextContent } from '../utils/helpers';

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

// Mock config
jest.mock('../config/index', () => {
  const mockConfig = {
    SLACK_BOT_TOKEN: 'xoxb-test-token',
    SLACK_USER_TOKEN: 'xoxp-test-token',
    USE_USER_TOKEN_FOR_READ: false,
    LOG_LEVEL: 'error',
    MCP_SERVER_NAME: 'test-server',
    MCP_SERVER_VERSION: '1.0.0',
    PORT: 3000,
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

describe('SlackService Functionality Tests', () => {
  let service: SlackService;

  beforeEach(() => {
    jest.clearAllMocks();
    mockWebClientInstance = createMockWebClient();
    service = new SlackService();
  });

  describe('Service Method Routing', () => {
    it('should handle sendMessage correctly', async () => {
      const result = await service.sendMessage({
        channel: 'C123456',
        text: 'Hello World!',
      });

      expect(result).toBeDefined();
      expect(result.content).toBeDefined();
      expect(mockWebClientInstance.chat.postMessage).toHaveBeenCalledWith({
        channel: 'C123456',
        text: 'Hello World!',
      });
    });

    it('should handle listChannels correctly', async () => {
      const result = await service.listChannels({
        exclude_archived: true,
      });

      expect(result).toBeDefined();
      expect(result.content).toBeDefined();
      expect(mockWebClientInstance.conversations.list).toHaveBeenCalledWith({
        exclude_archived: true,
        types: 'public_channel,private_channel',
        limit: 100,
        cursor: undefined,
      });
    });

    it('should handle getUserInfo correctly', async () => {
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

  describe('Service Health', () => {
    it('should provide health check information', async () => {
      const result = await service.getServerHealth({});

      expect(result).toBeDefined();
      expect(result.content).toBeDefined();
      expect(result.content?.[0]?.type).toBe('text');
      // Health check returns TypeSafeAPI response with health metrics
      const apiResponse = JSON.parse(extractTextContent(result.content?.[0]) || '{}');
      expect(apiResponse).toHaveProperty('statusCode');
      expect(apiResponse).toHaveProperty('data');
      expect(apiResponse.statusCode).toBe('10000');

      const healthData = apiResponse.data;
      expect(healthData).toHaveProperty('status');
      expect(healthData).toHaveProperty('timestamp');
      expect(healthData).toHaveProperty('connectivity');
    });
  });

  describe('Performance', () => {
    it('should execute methods efficiently', async () => {
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

  describe('Error Handling', () => {
    it('should handle API errors properly', async () => {
      mockWebClientInstance.chat.postMessage.mockRejectedValueOnce(new Error('API Error'));

      const result = await service.sendMessage({
        channel: 'C123456',
        text: 'This will fail',
      });

      expect(result.isError).toBe(true);
      expect(extractTextContent(result.content?.[0])).toContain('API Error');
    });

    it('should handle validation errors properly', async () => {
      const result = await service.sendMessage({
        // Missing required 'text' field
        channel: 'C123456',
      } as any);

      expect(result.isError).toBe(true);
      expect(extractTextContent(result.content?.[0])).toContain('text');
    });
  });
});
