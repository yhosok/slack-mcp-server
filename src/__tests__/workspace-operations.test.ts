/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { jest } from '@jest/globals';

// Mock pagination helper for tests
jest.mock('../slack/infrastructure/pagination-helper.js', () => ({
  paginateSlackAPI: jest.fn(),
  collectAllPages: jest.fn(() => Promise.resolve({ items: [], pageCount: 1 })),
  processBatch: jest.fn(),
}));

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
  createInfrastructureServices: jest.fn(() => ({
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

      // Parse health data to verify TypeSafeAPI response structure
      const apiResponse = JSON.parse(extractTextContent(result.content?.[0]) || '{}');
      expect(apiResponse).toHaveProperty('statusCode');
      expect(apiResponse).toHaveProperty('message');
      expect(apiResponse).toHaveProperty('data');
      expect(apiResponse.statusCode).toBe('10000');

      // Verify the health data structure within the TypeSafeAPI response
      const healthData = apiResponse.data;
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

      // Parse TypeSafeAPI error response
      const apiResponse = JSON.parse(extractTextContent(result.content?.[0]) || '{}');
      expect(apiResponse).toHaveProperty('statusCode');
      expect(apiResponse).toHaveProperty('message');
      expect(apiResponse).toHaveProperty('error');
      expect(apiResponse.statusCode).toBe('10001');
    });

    it('should handle team members API errors gracefully', async () => {
      mockWebClientInstance.users.list.mockRejectedValueOnce(new Error('API Error'));

      const result = await service.listTeamMembers({});

      expect(result).toBeDefined();
      expect('isError' in result ? result.isError : false).toBe(true);

      // Parse TypeSafeAPI error response
      const apiResponse = JSON.parse(extractTextContent(result.content?.[0]) || '{}');
      expect(apiResponse).toHaveProperty('statusCode');
      expect(apiResponse).toHaveProperty('message');
      expect(apiResponse).toHaveProperty('error');
      expect(apiResponse.statusCode).toBe('10001');
    });

    it('should handle workspace activity API errors gracefully', async () => {
      mockWebClientInstance.conversations.list.mockRejectedValueOnce(new Error('API Error'));

      const result = await service.getWorkspaceActivity({});

      expect(result).toBeDefined();
      expect('isError' in result ? result.isError : false).toBe(true);

      // Parse TypeSafeAPI error response
      const apiResponse = JSON.parse(extractTextContent(result.content?.[0]) || '{}');
      expect(apiResponse).toHaveProperty('statusCode');
      expect(apiResponse).toHaveProperty('message');
      expect(apiResponse).toHaveProperty('error');
      expect(apiResponse.statusCode).toBe('10001');
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

      // Parse TypeSafeAPI error response
      const apiResponse = JSON.parse(extractTextContent(result.content?.[0]) || '{}');
      expect(apiResponse).toHaveProperty('statusCode');
      expect(apiResponse).toHaveProperty('message');
      expect(apiResponse).toHaveProperty('error');
      expect(apiResponse.statusCode).toBe('10001');
    });

    it('should handle invalid parameters for getWorkspaceActivity', async () => {
      const result = await service.getWorkspaceActivity({ top_count: -1 });

      expect(result).toBeDefined();
      // TypeSafeAPI validation passes negative numbers, so this should succeed
      expect('isError' in result ? result.isError : false).toBe(false);

      // Parse TypeSafeAPI success response
      const apiResponse = JSON.parse(extractTextContent(result.content?.[0]) || '{}');
      expect(apiResponse).toHaveProperty('statusCode');
      expect(apiResponse).toHaveProperty('message');
      expect(apiResponse).toHaveProperty('data');
      expect(apiResponse.statusCode).toBe('10000');
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
      // Parse TypeSafeAPI error responses for rate limiting
      const workspaceApiResponse = JSON.parse(
        extractTextContent(workspaceResult.content?.[0]) || '{}'
      );
      const membersApiResponse = JSON.parse(extractTextContent(membersResult.content?.[0]) || '{}');

      expect(workspaceApiResponse.error).toContain('Rate limited');
      expect(membersApiResponse.error).toContain('Rate limited');
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
        const apiResponse = JSON.parse(extractTextContent(result.content?.[0]) || '{}');
        expect(apiResponse).toHaveProperty('statusCode');
        expect(apiResponse).toHaveProperty('data');
        expect(apiResponse.statusCode).toBe('10000');

        const membersData = apiResponse.data;
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
        const apiResponse = JSON.parse(extractTextContent(result.content?.[0]) || '{}');
        expect(apiResponse).toHaveProperty('statusCode');
        expect(apiResponse).toHaveProperty('data');
        expect(apiResponse.statusCode).toBe('10000');

        const activityData = apiResponse.data;
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

      const apiResponse = JSON.parse(extractTextContent(result.content?.[0]) || '{}');
      expect(apiResponse).toHaveProperty('statusCode');
      expect(apiResponse).toHaveProperty('data');
      expect(apiResponse.statusCode).toBe('10000');

      const healthData = apiResponse.data;
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

      const apiResponse = JSON.parse(extractTextContent(result.content?.[0]) || '{}');
      expect(apiResponse).toHaveProperty('statusCode');
      expect(apiResponse).toHaveProperty('data');
      expect(apiResponse.statusCode).toBe('10000');

      const healthData = apiResponse.data;
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

  describe('TDD Red Phase: listTeamMembers Response Size Optimization', () => {
    describe('New Parameter Validation - include_profile_details', () => {
      it('should accept include_profile_details as boolean parameter', async () => {
        // This test will FAIL until the parameter is added to the schema
        const result = await service.listTeamMembers({
          include_profile_details: true,
          limit: 10
        });

        expect(result).toBeDefined();
        expect('isError' in result ? result.isError : false).toBe(false);
      });

      it('should default include_profile_details to true for backward compatibility', async () => {
        // This test will FAIL until the parameter is added with proper default
        const result = await service.listTeamMembers({
          limit: 10
        });

        expect(result).toBeDefined();
        if (!('isError' in result && result.isError)) {
          const apiResponse = JSON.parse(extractTextContent(result.content?.[0]) || '{}');
          expect(apiResponse.statusCode).toBe('10000');

          const membersData = apiResponse.data;
          // Should include full profile data by default (backward compatibility)
          if (membersData.members && membersData.members.length > 0) {
            const firstMember = membersData.members[0];
            expect(firstMember.profile).toBeDefined();
            expect(firstMember.profile.image24).toBeDefined();
            expect(firstMember.profile.statusText).toBeDefined();
            expect(firstMember.title).toBeDefined();
            expect(firstMember.email).toBeDefined();
          }
        }
      });

      it('should reject non-boolean values for include_profile_details', async () => {
        // This test will FAIL until proper validation is implemented
        const result = await service.listTeamMembers({
          include_profile_details: 'invalid',
          limit: 10
        });

        expect(result).toBeDefined();
        expect('isError' in result ? result.isError : false).toBe(true);

        const apiResponse = JSON.parse(extractTextContent(result.content?.[0]) || '{}');
        expect(apiResponse.statusCode).toBe('10001');
        expect(apiResponse.error).toContain('include_profile_details');
      });

      it('should reject numeric values for include_profile_details', async () => {
        // This test will FAIL until proper validation is implemented
        const result = await service.listTeamMembers({
          include_profile_details: 1,
          limit: 10
        });

        expect(result).toBeDefined();
        expect('isError' in result ? result.isError : false).toBe(true);

        const apiResponse = JSON.parse(extractTextContent(result.content?.[0]) || '{}');
        expect(apiResponse.statusCode).toBe('10001');
      });
    });

    describe('Response Structure Tests', () => {
      beforeEach(() => {
        // Mock a more comprehensive user response for testing
        mockWebClientInstance.users.list.mockResolvedValue({
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
                image_32: 'https://example.com/admin32.png',
                image_48: 'https://example.com/admin48.png',
                image_72: 'https://example.com/admin72.png',
                image_192: 'https://example.com/admin192.png',
                image_512: 'https://example.com/admin512.png',
                status_text: 'Working',
                status_emoji: ':computer:',
                status_expiration: 1234567890,
                phone: '+1-555-0123',
                skype: 'admin.skype',
              },
              tz: 'America/New_York',
              tz_label: 'Eastern Standard Time',
              tz_offset: -18000,
              updated: 1234567890,
            },
            {
              id: 'U987654321',
              name: 'regular',
              real_name: 'Regular User',
              deleted: false,
              is_bot: false,
              is_admin: false,
              is_owner: false,
              is_primary_owner: false,
              is_restricted: false,
              is_ultra_restricted: false,
              profile: {
                display_name: 'Regular',
                email: 'regular@example.com',
                title: 'Developer',
                image_24: 'https://example.com/regular24.png',
                image_32: 'https://example.com/regular32.png',
                image_48: 'https://example.com/regular48.png',
                image_72: 'https://example.com/regular72.png',
                image_192: 'https://example.com/regular192.png',
                image_512: 'https://example.com/regular512.png',
                status_text: 'Available',
                status_emoji: ':green_heart:',
                phone: '+1-555-0456',
                skype: 'regular.skype',
              },
              tz: 'America/Los_Angeles',
              tz_label: 'Pacific Standard Time',
              tz_offset: -28800,
              updated: 1234567891,
            },
          ],
        });
      });

      it('should return full response when include_profile_details is true', async () => {
        // This test will FAIL until the feature is implemented
        const result = await service.listTeamMembers({
          include_profile_details: true,
          limit: 10
        });

        expect(result).toBeDefined();
        if (!('isError' in result && result.isError)) {
          const apiResponse = JSON.parse(extractTextContent(result.content?.[0]) || '{}');
          expect(apiResponse.statusCode).toBe('10000');

          const membersData = apiResponse.data;
          expect(membersData.members).toHaveLength(2);

          const firstMember = membersData.members[0];
          
          // Core fields should always be present
          expect(firstMember.id).toBe('U123456789');
          expect(firstMember.name).toBe('admin');
          expect(firstMember.displayName).toBe('Admin');
          expect(firstMember.isAdmin).toBe(true);
          expect(firstMember.isOwner).toBe(true);
          expect(firstMember.isBot).toBe(false);
          
          // Full profile details should be included
          expect(firstMember.profile).toBeDefined();
          expect(firstMember.profile.image24).toBe('https://example.com/admin24.png');
          expect(firstMember.profile.image32).toBe('https://example.com/admin32.png');
          expect(firstMember.profile.image48).toBe('https://example.com/admin48.png');
          expect(firstMember.profile.image72).toBe('https://example.com/admin72.png');
          expect(firstMember.profile.image192).toBe('https://example.com/admin192.png');
          expect(firstMember.profile.image512).toBe('https://example.com/admin512.png');
          expect(firstMember.profile.statusText).toBe('Working');
          expect(firstMember.profile.statusEmoji).toBe(':computer:');
          expect(firstMember.profile.statusExpiration).toBe(1234567890);
          expect(firstMember.profile.phone).toBe('+1-555-0123');
          expect(firstMember.profile.skype).toBe('admin.skype');

          // Extended fields should be included
          expect(firstMember.email).toBe('admin@example.com');
          expect(firstMember.title).toBe('Administrator');
          expect(firstMember.timezone).toBe('America/New_York');
          expect(firstMember.timezoneLabel).toBe('Eastern Standard Time');
          expect(firstMember.timezoneOffset).toBe(-18000);
          expect(firstMember.updated).toBe(1234567890);
        }
      });

      it('should return lightweight response when include_profile_details is false', async () => {
        // This test will FAIL until the feature is implemented
        const result = await service.listTeamMembers({
          include_profile_details: false,
          limit: 10
        });

        expect(result).toBeDefined();
        if (!('isError' in result && result.isError)) {
          const apiResponse = JSON.parse(extractTextContent(result.content?.[0]) || '{}');
          expect(apiResponse.statusCode).toBe('10000');

          const membersData = apiResponse.data;
          expect(membersData.members).toHaveLength(2);

          const firstMember = membersData.members[0];
          
          // Core fields should always be present
          expect(firstMember.id).toBe('U123456789');
          expect(firstMember.name).toBe('admin');
          expect(firstMember.displayName).toBe('Admin');
          expect(firstMember.isAdmin).toBe(true);
          expect(firstMember.isOwner).toBe(true);
          expect(firstMember.isBot).toBe(false);
          expect(firstMember.deleted).toBe(false);
          
          // Lightweight mode: profile should contain only essential image
          expect(firstMember.profile).toBeDefined();
          expect(firstMember.profile.image24).toBe('https://example.com/admin24.png');
          
          // Lightweight mode: extended profile details should be excluded
          expect(firstMember.profile.image32).toBeUndefined();
          expect(firstMember.profile.image48).toBeUndefined();
          expect(firstMember.profile.image72).toBeUndefined();
          expect(firstMember.profile.image192).toBeUndefined();
          expect(firstMember.profile.image512).toBeUndefined();
          expect(firstMember.profile.statusText).toBeUndefined();
          expect(firstMember.profile.statusEmoji).toBeUndefined();
          expect(firstMember.profile.statusExpiration).toBeUndefined();
          expect(firstMember.profile.phone).toBeUndefined();
          expect(firstMember.profile.skype).toBeUndefined();

          // Lightweight mode: extended user fields should be excluded
          expect(firstMember.email).toBeUndefined();
          expect(firstMember.title).toBeUndefined();
          expect(firstMember.timezone).toBeUndefined();
          expect(firstMember.timezoneLabel).toBeUndefined();
          expect(firstMember.timezoneOffset).toBeUndefined();
          expect(firstMember.updated).toBeUndefined();
        }
      });

      it('should maintain all core fields in both response modes', async () => {
        // This test will FAIL until the feature ensures core fields consistency
        const fullResult = await service.listTeamMembers({
          include_profile_details: true,
          limit: 10
        });

        const lightResult = await service.listTeamMembers({
          include_profile_details: false,
          limit: 10
        });

        expect(fullResult).toBeDefined();
        expect(lightResult).toBeDefined();

        if (!('isError' in fullResult && fullResult.isError) && 
            !('isError' in lightResult && lightResult.isError)) {
          
          const fullResponse = JSON.parse(extractTextContent(fullResult.content?.[0]) || '{}');
          const lightResponse = JSON.parse(extractTextContent(lightResult.content?.[0]) || '{}');
          
          expect(fullResponse.statusCode).toBe('10000');
          expect(lightResponse.statusCode).toBe('10000');

          const fullMember = fullResponse.data.members[0];
          const lightMember = lightResponse.data.members[0];

          // Core fields must be identical in both modes
          const coreFields = ['id', 'name', 'displayName', 'isAdmin', 'isOwner', 'isBot', 'deleted', 'isPrimaryOwner', 'isRestricted', 'isUltraRestricted', 'hasFiles'];
          
          coreFields.forEach(field => {
            expect(fullMember[field]).toBe(lightMember[field]);
          });

          // Profile.image24 should be present in both modes
          expect(fullMember.profile.image24).toBe(lightMember.profile.image24);
        }
      });
    });

    describe('Backward Compatibility Tests', () => {
      it('should maintain existing response structure when parameter not provided', async () => {
        // This test will FAIL if backward compatibility is broken
        const result = await service.listTeamMembers({
          limit: 10,
          include_bots: true
        });

        expect(result).toBeDefined();
        if (!('isError' in result && result.isError)) {
          const apiResponse = JSON.parse(extractTextContent(result.content?.[0]) || '{}');
          expect(apiResponse.statusCode).toBe('10000');

          const membersData = apiResponse.data;
          
          // Should match current full response structure
          if (membersData.members && membersData.members.length > 0) {
            const member = membersData.members[0];
            
            // All current fields should be present (backward compatibility)
            expect(member.id).toBeDefined();
            expect(member.name).toBeDefined();
            expect(member.displayName).toBeDefined();
            expect(member.profile).toBeDefined();
            expect(member.profile.image24).toBeDefined();
          }
        }
      });

      it('should handle existing API calls without parameter changes', async () => {
        // This test will FAIL if existing call signatures are broken
        const legacyCalls = [
          {},
          { limit: 50 },
          { include_bots: false },
          { include_deleted: true },
          { cursor: 'test-cursor' },
          { fetch_all_pages: true },
          { fetch_all_pages: true, max_pages: 5, max_items: 100 }
        ];

        for (const args of legacyCalls) {
          const result = await service.listTeamMembers(args);
          expect(result).toBeDefined();
          
          // All existing calls should continue to work
          if (!('isError' in result && result.isError)) {
            const apiResponse = JSON.parse(extractTextContent(result.content?.[0]) || '{}');
            expect(apiResponse.statusCode).toBe('10000');
            expect(apiResponse.data).toHaveProperty('members');
            expect(apiResponse.data).toHaveProperty('total');
            expect(apiResponse.data).toHaveProperty('hasMore');
          }
        }
      });
    });

    describe('Response Size Validation Tests', () => {
      it('should produce measurably smaller response in lightweight mode', async () => {
        // This test will FAIL until response size optimization is implemented
        const fullResult = await service.listTeamMembers({
          include_profile_details: true,
          limit: 10
        });

        const lightResult = await service.listTeamMembers({
          include_profile_details: false,
          limit: 10
        });

        expect(fullResult).toBeDefined();
        expect(lightResult).toBeDefined();

        if (!('isError' in fullResult && fullResult.isError) && 
            !('isError' in lightResult && lightResult.isError)) {
          
          const fullContent = extractTextContent(fullResult.content?.[0]) || '';
          const lightContent = extractTextContent(lightResult.content?.[0]) || '';
          
          const fullSize = new Blob([fullContent]).size;
          const lightSize = new Blob([lightContent]).size;
          
          // Lightweight response should be at least 20% smaller
          const compressionRatio = (fullSize - lightSize) / fullSize;
          expect(compressionRatio).toBeGreaterThan(0.2);
          
          // Both should be valid JSON
          expect(() => JSON.parse(fullContent)).not.toThrow();
          expect(() => JSON.parse(lightContent)).not.toThrow();
        }
      });

      it('should preserve essential data integrity in lightweight mode', async () => {
        // This test will FAIL if essential data is lost in optimization
        const result = await service.listTeamMembers({
          include_profile_details: false,
          limit: 10
        });

        expect(result).toBeDefined();
        if (!('isError' in result && result.isError)) {
          const apiResponse = JSON.parse(extractTextContent(result.content?.[0]) || '{}');
          expect(apiResponse.statusCode).toBe('10000');

          const membersData = apiResponse.data;
          
          // Essential pagination metadata must be preserved
          expect(membersData.total).toBeGreaterThanOrEqual(0);
          expect(membersData.hasMore).toBeDefined();
          expect(Array.isArray(membersData.members)).toBe(true);
          
          // Each member must have core identification fields
          membersData.members.forEach((member: any) => {
            expect(member.id).toBeDefined();
            expect(member.name).toBeDefined();
            expect(member.displayName).toBeDefined();
            expect(typeof member.isBot).toBe('boolean');
            expect(typeof member.deleted).toBe('boolean');
            expect(typeof member.isAdmin).toBe('boolean');
          });
        }
      });

      it('should maintain consistent pagination metadata regardless of profile detail level', async () => {
        // This test will FAIL if pagination metadata is affected by the optimization
        const fullResult = await service.listTeamMembers({
          include_profile_details: true,
          limit: 5
        });

        const lightResult = await service.listTeamMembers({
          include_profile_details: false,
          limit: 5
        });

        expect(fullResult).toBeDefined();
        expect(lightResult).toBeDefined();

        if (!('isError' in fullResult && fullResult.isError) && 
            !('isError' in lightResult && lightResult.isError)) {
          
          const fullResponse = JSON.parse(extractTextContent(fullResult.content?.[0]) || '{}');
          const lightResponse = JSON.parse(extractTextContent(lightResult.content?.[0]) || '{}');
          
          // Pagination metadata should be identical
          expect(fullResponse.data.total).toBe(lightResponse.data.total);
          expect(fullResponse.data.hasMore).toBe(lightResponse.data.hasMore);
          expect(fullResponse.data.members.length).toBe(lightResponse.data.members.length);
          
          // Cursor information should match
          if (fullResponse.data.cursor || lightResponse.data.cursor) {
            expect(fullResponse.data.cursor).toBe(lightResponse.data.cursor);
          }
        }
      });
    });

    describe('TypeSafeAPI Response Validation', () => {
      it('should return valid ServiceResult structure for both response modes', async () => {
        // This test will FAIL if TypeSafeAPI patterns are broken
        const testCases = [
          { include_profile_details: true },
          { include_profile_details: false },
          {} // default case
        ];

        for (const testCase of testCases) {
          const result = await service.listTeamMembers(testCase);
          expect(result).toBeDefined();
          
          if (!('isError' in result && result.isError)) {
            const apiResponse = JSON.parse(extractTextContent(result.content?.[0]) || '{}');
            
            // Valid TypeSafeAPI success response structure
            expect(apiResponse).toHaveProperty('statusCode');
            expect(apiResponse).toHaveProperty('message');
            expect(apiResponse).toHaveProperty('data');
            expect(apiResponse.statusCode).toBe('10000');
            
            // Valid TeamMembersOutput structure
            const data = apiResponse.data;
            expect(data).toHaveProperty('members');
            expect(data).toHaveProperty('total');
            expect(data).toHaveProperty('hasMore');
            expect(Array.isArray(data.members)).toBe(true);
            expect(typeof data.total).toBe('number');
            expect(typeof data.hasMore).toBe('boolean');
          }
        }
      });

      it('should maintain TypeSafeAPI error response structure for validation failures', async () => {
        // This test will FAIL if error handling is inconsistent
        const result = await service.listTeamMembers({
          include_profile_details: 'invalid_value'
        });

        expect(result).toBeDefined();
        expect('isError' in result ? result.isError : false).toBe(true);

        const apiResponse = JSON.parse(extractTextContent(result.content?.[0]) || '{}');
        
        // Valid TypeSafeAPI error response structure
        expect(apiResponse).toHaveProperty('statusCode');
        expect(apiResponse).toHaveProperty('message');
        expect(apiResponse).toHaveProperty('error');
        expect(apiResponse.statusCode).toBe('10001');
        expect(apiResponse.error).toContain('include_profile_details');
      });
    });
  });
});
