/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { jest } from '@jest/globals';
import { SlackService } from '../slack/slack-service.js';
import { extractTextContent } from '../utils/helpers';

// Mock WebClient with comprehensive workspace API methods
const createMockWebClient = (): any => ({
  team: {
    info: jest.fn(() =>
      Promise.resolve({
        ok: true,
        team: {
          id: 'T123456789',
          name: 'Test Workspace',
          domain: 'test-workspace',
          email_domain: 'example.com',
          icon: {
            image_34: 'https://example.com/icon34.png',
            image_44: 'https://example.com/icon44.png',
            image_68: 'https://example.com/icon68.png',
            image_88: 'https://example.com/icon88.png',
            image_102: 'https://example.com/icon102.png',
            image_132: 'https://example.com/icon132.png',
            image_230: 'https://example.com/icon230.png',
          },
          enterprise_id: 'E123456789',
          enterprise_name: 'Test Enterprise',
        },
      })
    ),
  },
  users: {
    list: jest.fn(() =>
      Promise.resolve({
        ok: true,
        members: [
          {
            id: 'U123456789',
            name: 'admin',
            real_name: 'Admin User',
            deleted: false,
            is_bot: false,
            is_admin: true,
            is_owner: true,
            is_primary_owner: false,
            is_restricted: false,
            is_ultra_restricted: false,
            profile: {
              display_name: 'Admin',
              email: 'admin@example.com',
              title: 'Administrator',
              image_24: 'https://example.com/admin24.png',
              status_text: 'Working',
              status_emoji: ':computer:',
            },
            tz: 'America/New_York',
            tz_label: 'Eastern Standard Time',
            tz_offset: -18000,
            updated: 1234567890,
          },
          {
            id: 'B123456789',
            name: 'slackbot',
            real_name: 'Slackbot',
            deleted: false,
            is_bot: true,
            is_admin: false,
            is_owner: false,
            is_primary_owner: false,
            is_restricted: false,
            is_ultra_restricted: false,
            profile: {
              display_name: 'Slackbot',
            },
            updated: 1234567892,
          },
        ],
        response_metadata: {
          next_cursor: 'dXNlcjpVMDYxTkZUVDI=',
        },
      })
    ),
    info: jest.fn(() =>
      Promise.resolve({
        ok: true,
        user: { id: 'U123', name: 'testuser', real_name: 'Test User' },
      })
    ),
  },
  conversations: {
    list: jest.fn(() =>
      Promise.resolve({
        ok: true,
        channels: [
          { id: 'C123456789', name: 'general', is_archived: false },
          { id: 'C987654321', name: 'random', is_archived: false },
        ],
      })
    ),
    history: jest.fn(() =>
      Promise.resolve({
        ok: true,
        messages: [
          {
            ts: '1234567890.123456',
            user: 'U123456789',
            text: 'Hello everyone!',
            reply_count: 2,
          },
          {
            ts: '1234567891.123456',
            user: 'U987654321',
            text: 'Good morning!',
            reply_count: 0,
          },
        ],
      })
    ),
  },
  auth: {
    test: jest.fn(() => Promise.resolve({ ok: true })),
  },
  on: jest.fn(),
});

let mockWebClientInstance = createMockWebClient();

// Mock the WebClient - IMPORTANT: Return the same instance so API calls can be tracked
jest.mock('@slack/web-api', () => ({
  WebClient: jest.fn().mockImplementation(() => {
    // Return the shared mock instance so all API calls go through our mocked methods
    return mockWebClientInstance;
  }),
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

// Mock configuration
jest.mock('../config/index.js', () => {
  const mockConfig = {
    SLACK_BOT_TOKEN: 'xoxb-test-token',
    SLACK_USER_TOKEN: 'xoxp-test-token',
    USE_USER_TOKEN_FOR_READ: false,
    LOG_LEVEL: 'error',
    MCP_SERVER_NAME: 'test-server',
    MCP_SERVER_VERSION: '1.0.0',
    PORT: 3000,
    SLACK_ENABLE_RATE_LIMIT_RETRY: true,
    SLACK_RATE_LIMIT_RETRIES: 3,
    SLACK_MAX_REQUEST_CONCURRENCY: 3,
    SLACK_REJECT_RATE_LIMITED_CALLS: false,
  };
  return {
    CONFIG: mockConfig,
    getConfig: () => mockConfig,
    loadConfig: () => mockConfig,
  };
});

// Mock logger
jest.mock('../utils/logger.js', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  },
}));

// Mock the infrastructure services for modular architecture
jest.mock('../slack/infrastructure/factory.js', () => ({
  createInfrastructureServices: jest.fn((config) => ({
    clientManager: {
      getClientForOperation: jest.fn(() => mockWebClientInstance),
      getBotClient: jest.fn(() => mockWebClientInstance),
      getUserClient: jest.fn(() => mockWebClientInstance),
      checkSearchApiAvailability: jest.fn(),
    },
    rateLimitService: {
      getMetrics: jest.fn(() => ({
        totalRequests: 100,
        rateLimitedRequests: 5,
        retryAttempts: 2,
        lastRateLimitTime: new Date().toISOString(),
        rateLimitsByTier: { Tier1: 2, Tier2: 3 },
      })),
      createClientWithMetrics: jest.fn((client) => client),
    },
    userService: {
      getUserInfo: jest.fn(async (userId) => ({
        displayName: `User ${userId}`,
      })),
    },
    requestHandler: {
      handle: jest.fn(async (schema: any, args: any, handler: any) => {
        // Simulate validation - check for obviously invalid values
        try {
          const validatedArgs = typeof args === 'object' ? args : {};

          // Simulate validation errors for invalid limit values
          if (
            'limit' in validatedArgs &&
            typeof validatedArgs.limit === 'number' &&
            validatedArgs.limit <= 0
          ) {
            throw new Error('Validation failed: limit must be greater than 0');
          }

          // Simulate validation errors for invalid top_count values
          if (
            'top_count' in validatedArgs &&
            typeof validatedArgs.top_count === 'number' &&
            validatedArgs.top_count < 0
          ) {
            throw new Error('Validation failed: top_count must be non-negative');
          }

          const result = await handler(validatedArgs);
          return {
            content: [{ type: 'text', text: JSON.stringify(result) }],
          };
        } catch (error) {
          return {
            content: [{ type: 'text', text: `Error: ${(error as Error).message}` }],
            isError: true,
          };
        }
      }),
    },
  })),
}));

describe('Workspace Management Operations', () => {
  let service: SlackService;

  beforeEach(() => {
    jest.clearAllMocks();
    // Reset the mock WebClient instance with fresh mocks
    mockWebClientInstance = createMockWebClient();
    // Note: The WebClient constructor will return the same mockWebClientInstance
    service = new SlackService();
  });

  describe('Workspace Service Integration', () => {
    it('should handle getWorkspaceInfo correctly', async () => {
      const result = await service.getWorkspaceInfo({});

      expect(result).toBeDefined();
      expect(result.content).toBeDefined();
      expect(mockWebClientInstance.team.info).toHaveBeenCalled();
    });

    it('should handle listTeamMembers correctly', async () => {
      const result = await service.listTeamMembers({
        exclude_archived: true,
        include_bots: true,
      });

      expect(result).toBeDefined();
      expect(result.content).toBeDefined();
      expect(mockWebClientInstance.users.list).toHaveBeenCalled();
    });

    it('should handle getWorkspaceActivity correctly', async () => {
      const result = await service.getWorkspaceActivity({
        include_user_details: true,
        include_channel_details: true,
      });

      expect(result).toBeDefined();
      expect(result.content).toBeDefined();
      expect(mockWebClientInstance.conversations.list).toHaveBeenCalled();
    });

    it('should handle getServerHealth correctly', async () => {
      // Mock process methods for health check
      jest.spyOn(process, 'uptime').mockReturnValue(3600);
      jest.spyOn(process, 'memoryUsage').mockReturnValue({
        rss: 50 * 1024 * 1024,
        heapTotal: 30 * 1024 * 1024,
        heapUsed: 20 * 1024 * 1024,
        external: 5 * 1024 * 1024,
        arrayBuffers: 2 * 1024 * 1024,
      });

      const result = await service.getServerHealth({});

      expect(result).toBeDefined();
      expect(result.content).toBeDefined();
      expect(result.content?.[0]?.type).toBe('text');

      // Parse health data to verify structure
      const healthData = JSON.parse(extractTextContent(result.content?.[0]) || '{}');
      expect(healthData).toHaveProperty('status');
      expect(healthData).toHaveProperty('timestamp');
      expect(healthData).toHaveProperty('uptime');
      expect(healthData).toHaveProperty('connectivity');
      expect(healthData).toHaveProperty('memory');

      jest.restoreAllMocks();
    });
  });

  describe('Workspace API Method Coverage', () => {
    it('should call team.info API for workspace information', async () => {
      await service.getWorkspaceInfo({});
      expect(mockWebClientInstance.team.info).toHaveBeenCalledTimes(1);
    });

    it('should call users.list API for team members', async () => {
      await service.listTeamMembers({ limit: 50 });
      expect(mockWebClientInstance.users.list).toHaveBeenCalledTimes(1);
    });

    it('should call conversations.list API for workspace activity', async () => {
      await service.getWorkspaceActivity({});
      expect(mockWebClientInstance.conversations.list).toHaveBeenCalledTimes(1);
      expect(mockWebClientInstance.conversations.history).toHaveBeenCalled();
    });

    it('should call auth.test API for server health connectivity check', async () => {
      await service.getServerHealth({});
      expect(mockWebClientInstance.auth.test).toHaveBeenCalled();
    });
  });

  describe('Error Handling', () => {
    it('should handle workspace API errors gracefully', async () => {
      mockWebClientInstance.team.info.mockRejectedValueOnce(new Error('API Error'));

      const result = await service.getWorkspaceInfo({});

      expect(result).toBeDefined();
      expect('isError' in result ? result.isError : false).toBe(true);
      expect(extractTextContent(result.content?.[0])).toContain('Error');
    });

    it('should handle team members API errors gracefully', async () => {
      mockWebClientInstance.users.list.mockRejectedValueOnce(new Error('API Error'));

      const result = await service.listTeamMembers({});

      expect(result).toBeDefined();
      expect('isError' in result ? result.isError : false).toBe(true);
      expect(extractTextContent(result.content?.[0])).toContain('Error');
    });

    it('should handle workspace activity API errors gracefully', async () => {
      mockWebClientInstance.conversations.list.mockRejectedValueOnce(new Error('API Error'));

      const result = await service.getWorkspaceActivity({});

      expect(result).toBeDefined();
      expect('isError' in result ? result.isError : false).toBe(true);
      expect(extractTextContent(result.content?.[0])).toContain('Error');
    });

    it('should handle server health connectivity errors gracefully', async () => {
      mockWebClientInstance.auth.test.mockRejectedValueOnce(new Error('Network Error'));

      const result = await service.getServerHealth({});

      expect(result).toBeDefined();
      // Health check should still return status even with connectivity errors
      expect(result.content).toBeDefined();
      expect(result.content?.[0]?.type).toBe('text');
    });
  });

  describe('Validation Error Handling', () => {
    it('should handle invalid parameters for listTeamMembers', async () => {
      const result = await service.listTeamMembers({ limit: 0 });

      expect(result).toBeDefined();
      expect('isError' in result ? result.isError : false).toBe(true);
      expect(extractTextContent(result.content?.[0])).toContain('Error');
    });

    it('should handle invalid parameters for getWorkspaceActivity', async () => {
      const result = await service.getWorkspaceActivity({ top_count: -1 });

      expect(result).toBeDefined();
      expect('isError' in result ? result.isError : false).toBe(true);
      expect(extractTextContent(result.content?.[0])).toContain('Error');
    });
  });

  describe('Rate Limiting Scenarios', () => {
    it('should handle rate limiting for workspace operations', async () => {
      const rateLimitError = new Error('Rate limited');
      (rateLimitError as any).code = 'SLACK_RATE_LIMITED';

      mockWebClientInstance.team.info.mockRejectedValueOnce(rateLimitError);
      mockWebClientInstance.users.list.mockRejectedValueOnce(rateLimitError);

      const workspaceResult = await service.getWorkspaceInfo({});
      const membersResult = await service.listTeamMembers({});

      expect('isError' in workspaceResult ? workspaceResult.isError : false).toBe(true);
      expect('isError' in membersResult ? membersResult.isError : false).toBe(true);
      expect(extractTextContent(workspaceResult.content?.[0])).toContain('Rate limited');
      expect(extractTextContent(membersResult.content?.[0])).toContain('Rate limited');
    });
  });

  describe('Edge Cases and Boundary Conditions', () => {
    it('should handle empty workspace team response', async () => {
      mockWebClientInstance.team.info.mockResolvedValueOnce({ ok: true });

      const result = await service.getWorkspaceInfo({});

      expect(result).toBeDefined();
      expect('isError' in result ? result.isError : false).toBe(true);
    });

    it('should handle empty team members list', async () => {
      mockWebClientInstance.users.list.mockResolvedValueOnce({
        ok: true,
        members: [],
      });

      const result = await service.listTeamMembers({});

      expect(result).toBeDefined();
      // Empty members list should be handled as success, not error
      if (!('isError' in result && result.isError)) {
        const membersData = JSON.parse(extractTextContent(result.content?.[0]) || '{}');
        expect(Array.isArray(membersData.members)).toBe(true);
        expect(membersData.members).toHaveLength(0);
      }
    });

    it('should handle channels with no message history', async () => {
      mockWebClientInstance.conversations.history.mockResolvedValue({
        ok: true,
        messages: [],
      });

      const result = await service.getWorkspaceActivity({});

      expect(result).toBeDefined();
      // No messages should be handled as success with zero activity
      if (!('isError' in result && result.isError)) {
        const activityData = JSON.parse(extractTextContent(result.content?.[0]) || '{}');
        expect(activityData.summary).toBeDefined();
      }
    });
  });

  describe('Performance and Memory Usage', () => {
    it('should complete workspace operations within reasonable time', async () => {
      const startTime = Date.now();

      await Promise.all([
        service.getWorkspaceInfo({}),
        service.listTeamMembers({}),
        service.getWorkspaceActivity({}),
        service.getServerHealth({}),
      ]);

      const endTime = Date.now();
      const executionTime = endTime - startTime;

      // Should execute quickly with mocked calls (under 100ms)
      expect(executionTime).toBeLessThan(100);
    });

    it('should handle memory reporting in server health', async () => {
      jest.spyOn(process, 'memoryUsage').mockReturnValue({
        rss: 100 * 1024 * 1024, // 100MB
        heapTotal: 50 * 1024 * 1024, // 50MB
        heapUsed: 40 * 1024 * 1024, // 40MB
        external: 5 * 1024 * 1024,
        arrayBuffers: 2 * 1024 * 1024,
      });

      const result = await service.getServerHealth({});

      expect(result).toBeDefined();
      expect(result.content).toBeDefined();

      const healthData = JSON.parse(extractTextContent(result.content?.[0]) || '{}');
      expect(healthData.memory).toBeDefined();
      expect(healthData.memory.heapUsed).toBe(40); // Should be in MB
      expect(healthData.memory.heapTotal).toBe(50);

      jest.restoreAllMocks();
    });
  });

  describe('Service Integration', () => {
    it('should provide service information in health check', async () => {
      const result = await service.getServerHealth({});

      expect(result).toBeDefined();
      const healthData = JSON.parse(extractTextContent(result.content?.[0]) || '{}');
      expect(healthData.status).toBeDefined();
      expect(healthData.connectivity).toBeDefined();
    });

    it('should utilize correct Slack API client for operations', async () => {
      // All workspace operations should use appropriate client
      await service.getWorkspaceInfo({});
      await service.listTeamMembers({});
      await service.getWorkspaceActivity({});

      // Verify all expected API calls were made
      expect(mockWebClientInstance.team.info).toHaveBeenCalled();
      expect(mockWebClientInstance.users.list).toHaveBeenCalled();
      expect(mockWebClientInstance.conversations.list).toHaveBeenCalled();
    });
  });
});
