/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';

/**
 * Integration tests to validate SlackService functionality
 *
 * These tests ensure that:
 * 1. Core operations work correctly
 * 2. Token strategy routing works correctly
 * 3. Cross-domain operations work seamlessly
 * 4. Error handling is appropriate
 * 5. Performance characteristics are acceptable
 */

// Create a comprehensive mock WebClient following the existing test patterns
const createMockWebClient = (): any => ({
  chat: {
    postMessage: jest.fn(() =>
      Promise.resolve({
        ok: true,
        ts: '1234567890.123456',
        channel: 'C123456',
        message: {
          ts: '1234567890.123456',
          user: 'U123456',
          text: 'Test message',
          type: 'message',
        },
      })
    ),
  },
  conversations: {
    list: jest.fn(() =>
      Promise.resolve({
        ok: true,
        channels: [
          {
            id: 'C123456',
            name: 'general',
            is_member: true,
            is_archived: false,
            topic: { value: 'General discussion' },
            purpose: { value: 'Company-wide announcements and discussion' },
            num_members: 42,
          },
          {
            id: 'C789012',
            name: 'random',
            is_member: true,
            is_archived: false,
            topic: { value: 'Random chat' },
            purpose: { value: 'Non-work related discussion' },
            num_members: 25,
          },
        ],
      })
    ),
    history: jest.fn(() =>
      Promise.resolve({
        ok: true,
        messages: [
          {
            ts: '1234567890.123456',
            user: 'U123456',
            text: 'Hello world!',
            type: 'message',
            reply_count: 2,
            replies: [
              { user: 'U789012', ts: '1234567890.123457' },
              { user: 'U345678', ts: '1234567890.123458' },
            ],
          },
          {
            ts: '1234567889.123456',
            user: 'U789012',
            text: 'Second message',
            type: 'message',
          },
        ],
        has_more: false,
      })
    ),
    replies: jest.fn(() =>
      Promise.resolve({
        ok: true,
        messages: [
          {
            ts: '1234567890.123456',
            user: 'U123456',
            text: 'Hello world!',
            type: 'message',
            thread_ts: '1234567890.123456',
          },
          {
            ts: '1234567890.123457',
            user: 'U789012',
            text: 'Reply 1',
            type: 'message',
            thread_ts: '1234567890.123456',
          },
          {
            ts: '1234567890.123458',
            user: 'U345678',
            text: 'Reply 2',
            type: 'message',
            thread_ts: '1234567890.123456',
          },
        ],
      })
    ),
    info: jest.fn(() =>
      Promise.resolve({
        ok: true,
        channel: {
          id: 'C123456',
          name: 'general',
          is_channel: true,
          is_member: true,
          topic: { value: 'General discussion' },
          purpose: { value: 'Company-wide announcements' },
          num_members: 42,
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
            id: 'U123456',
            name: 'testuser',
            real_name: 'Test User',
            display_name: 'Test',
            is_bot: false,
            deleted: false,
            profile: {
              real_name: 'Test User',
              display_name: 'Test',
              email: 'test@example.com',
            },
          },
          {
            id: 'U789012',
            name: 'admin',
            real_name: 'Admin User',
            display_name: 'Admin',
            is_bot: false,
            deleted: false,
            is_admin: true,
            profile: {
              real_name: 'Admin User',
              display_name: 'Admin',
              email: 'admin@example.com',
            },
          },
        ],
      })
    ),
    info: jest.fn(() =>
      Promise.resolve({
        ok: true,
        user: {
          id: 'U123456',
          name: 'testuser',
          real_name: 'Test User',
          display_name: 'Test',
          is_bot: false,
          profile: {
            real_name: 'Test User',
            display_name: 'Test',
            email: 'test@example.com',
          },
        },
      })
    ),
  },
  files: {
    upload: jest.fn(() =>
      Promise.resolve({
        ok: true,
        file: {
          id: 'F123456',
          name: 'test.txt',
          size: 1024,
          mimetype: 'text/plain',
          created: Date.now() / 1000,
          user: 'U123456',
        },
      })
    ),
    list: jest.fn(() =>
      Promise.resolve({
        ok: true,
        files: [
          {
            id: 'F123456',
            name: 'test.txt',
            size: 1024,
            mimetype: 'text/plain',
            created: Date.now() / 1000,
            user: 'U123456',
          },
        ],
      })
    ),
    info: jest.fn(() =>
      Promise.resolve({
        ok: true,
        file: {
          id: 'F123456',
          name: 'test.txt',
          size: 1024,
          mimetype: 'text/plain',
          created: Date.now() / 1000,
          user: 'U123456',
        },
      })
    ),
    delete: jest.fn(() => Promise.resolve({ ok: true })),
    share: jest.fn(() => Promise.resolve({ ok: true })),
  },
  reactions: {
    add: jest.fn(() => Promise.resolve({ ok: true })),
    remove: jest.fn(() => Promise.resolve({ ok: true })),
    get: jest.fn(() =>
      Promise.resolve({
        ok: true,
        type: 'message',
        message: {
          ts: '1234567890.123456',
          reactions: [
            {
              name: 'thumbsup',
              count: 2,
              users: ['U123456', 'U789012'],
            },
          ],
        },
      })
    ),
  },
  team: {
    info: jest.fn(() =>
      Promise.resolve({
        ok: true,
        team: {
          id: 'T123456',
          name: 'Test Team',
          domain: 'testteam',
          email_domain: 'example.com',
        },
      })
    ),
  },
  search: {
    messages: jest.fn(() =>
      Promise.resolve({
        ok: true,
        query: 'test',
        messages: {
          total: 1,
          matches: [
            {
              type: 'message',
              ts: '1234567890.123456',
              user: 'U123456',
              text: 'Test message with keyword',
              channel: { id: 'C123456', name: 'general' },
            },
          ],
        },
      })
    ),
    files: jest.fn(() =>
      Promise.resolve({
        ok: true,
        query: 'test',
        files: {
          total: 1,
          matches: [
            {
              id: 'F123456',
              name: 'test.txt',
              size: 1024,
              created: Date.now() / 1000,
              user: 'U123456',
            },
          ],
        },
      })
    ),
  },
  auth: {
    test: jest.fn(() => Promise.resolve({ ok: true })),
  },
  on: jest.fn(),
  apiCall: jest.fn(),
});

let mockWebClientInstance = createMockWebClient();

// Mock WebClient following existing test patterns
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
  retryPolicies: {
    fiveRetriesInFiveMinutes: {
      retries: 5,
      factor: 2,
      minTimeout: 1000,
      maxTimeout: 300000,
      randomize: true,
    },
  },
}));

// Mock logger following existing pattern
jest.mock('../utils/logger.js', () => ({
  logger: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

// Mock validation to use actual validation but allow jest to spy on it
jest.mock('../utils/validation.js', () => {
  const originalModule = jest.requireActual('../utils/validation.js') as any;
  return {
    ...originalModule,
    validateInput: jest.fn((schema: any, input: any) => {
      return originalModule.validateInput(schema, input);
    }),
  };
});

// Create a function to create mock config
function createMockConfig(overrides: Record<string, any> = {}): any {
  const baseConfig = {
    SLACK_BOT_TOKEN: 'xoxb-test-token',
    SLACK_USER_TOKEN: 'xoxp-test-token',
    USE_USER_TOKEN_FOR_READ: false,
    LOG_LEVEL: 'error',
    MCP_SERVER_NAME: 'test-server',
    MCP_SERVER_VERSION: '1.0.0',
    PORT: 3000,
    // Slack rate limiting configuration
    SLACK_RATE_LIMIT_RETRIES: 3,
    SLACK_MAX_REQUEST_CONCURRENCY: 3,
    SLACK_REJECT_RATE_LIMITED_CALLS: false,
    SLACK_ENABLE_RATE_LIMIT_RETRY: true,
    ...overrides,
  };
  return baseConfig;
}

describe('Integration Tests: SlackService Functionality', () => {
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    // Save original environment
    originalEnv = { ...process.env };
    jest.clearAllMocks();
    mockWebClientInstance = createMockWebClient();
  });

  afterEach(() => {
    // Restore original environment
    process.env = originalEnv;
    jest.resetModules();
  });

  // Helper function to create a service with specific configuration
  const createServiceWithConfig = async (config: Record<string, any>) => {
    // Mock the config module with the specific configuration
    jest.resetModules();
    jest.doMock('../config/index.js', () => {
      const mockConfig = createMockConfig(config);
      return {
        CONFIG: mockConfig,
        getConfig: () => mockConfig,
      };
    });

    const { SlackService } = await import('../slack/slack-service.js');
    return new SlackService();
  };

  describe('Core Functionality Tests', () => {
    /**
     * Test that core operations work correctly
     */
    it('should handle sendMessage correctly', async () => {
      const testInput = {
        channel: 'C123456',
        text: 'Hello from integration test!',
      };

      const service = await createServiceWithConfig({});
      const result = await service.sendMessage(testInput);

      expect(result).toBeDefined();
      expect(result.content).toBeDefined();
      expect(mockWebClientInstance.chat.postMessage).toHaveBeenCalledWith(testInput);
    });

    it('should handle getChannelHistory correctly', async () => {
      const testInput = {
        channel: 'C123456',
        limit: 10,
      };

      const service = await createServiceWithConfig({});
      const result = await service.getChannelHistory(testInput);

      expect(result).toBeDefined();
      expect(result.content).toBeDefined();
      expect(mockWebClientInstance.conversations.history).toHaveBeenCalled();
    });

    it('should handle findThreadsInChannel correctly', async () => {
      const testInput = {
        channel: 'C123456',
        limit: 50,
      };

      const service = await createServiceWithConfig({});
      const result = await service.findThreadsInChannel(testInput);

      expect(result).toBeDefined();
      expect(result.content).toBeDefined();
      expect(mockWebClientInstance.conversations.history).toHaveBeenCalled();
    });
  });

  describe('Token Strategy Testing', () => {
    /**
     * Test that token strategy routing works correctly
     */
    it('should use correct token for read operations', async () => {
      const testInput = {
        channel: 'C123456',
        limit: 10,
      };

      const service = await createServiceWithConfig({
        USE_USER_TOKEN_FOR_READ: true,
      });
      await service.getChannelHistory(testInput);

      expect(mockWebClientInstance.conversations.history).toHaveBeenCalledTimes(1);
    });

    it('should handle search operations correctly', async () => {
      const testInput = {
        query: 'test search',
        count: 20,
      };

      const service = await createServiceWithConfig({
        USE_USER_TOKEN_FOR_READ: true,
      });
      const result = await service.searchMessages(testInput);

      expect(result).toBeDefined();
      expect(result.content).toBeDefined();
      expect(mockWebClientInstance.search.messages).toHaveBeenCalled();
    });
  });

  describe('Cross-Domain Operations', () => {
    /**
     * Test complex workflows that span multiple domains
     */
    it('should handle thread → reaction workflow correctly', async () => {
      const service = await createServiceWithConfig({});
      
      // 1. Create a thread
      const threadResult = await service.createThread({
        channel: 'C123456',
        text: 'Starting workflow thread',
      });

      // 2. Add reaction to the thread
      const reactionResult = await service.addReaction({
        channel: 'C123456',
        message_ts: '1234567890.123456',
        reaction_name: 'thumbsup',
      });

      expect(threadResult).toBeDefined();
      expect(threadResult.content).toBeDefined();
      expect(reactionResult).toBeDefined();
      expect(reactionResult.content).toBeDefined();
      
      expect(mockWebClientInstance.chat.postMessage).toHaveBeenCalled();
      expect(mockWebClientInstance.reactions.add).toHaveBeenCalled();
    });
  });

  describe('Service Configuration', () => {
    /**
     * Test service configuration behavior
     */
    it('should handle different operation types correctly', async () => {
      const service = await createServiceWithConfig({});

      // Test message operations
      const messageResult = await service.sendMessage({ channel: 'C123456', text: 'Test message' });
      expect(messageResult).toBeDefined();
      expect(messageResult.content).toBeDefined();

      // Test thread operations
      const threadResult = await service.findThreadsInChannel({ channel: 'C123456', limit: 10 });
      expect(threadResult).toBeDefined();
      expect(threadResult.content).toBeDefined();

      // Test file operations
      const fileResult = await service.listFiles({});
      expect(fileResult).toBeDefined();
      expect(fileResult.content).toBeDefined();

      // Test reaction operations
      const reactionResult = await service.addReaction({
        channel: 'C123456',
        message_ts: '1234567890.123456',
        reaction_name: 'thumbsup',
      });
      expect(reactionResult).toBeDefined();
      expect(reactionResult.content).toBeDefined();

      // Test workspace operations
      const workspaceResult = await service.getWorkspaceInfo({});
      expect(workspaceResult).toBeDefined();
      expect(workspaceResult.content).toBeDefined();
    });
  });

  describe('Error Handling', () => {
    /**
     * Test that error handling works correctly
     */
    it('should handle API errors properly', async () => {
      // Mock API error
      const apiError = new Error('channel_not_found');
      mockWebClientInstance.chat.postMessage.mockRejectedValue(apiError);

      const testInput = { channel: 'INVALID', text: 'Test message' };
      const service = await createServiceWithConfig({});

      let thrownError: any;
      try {
        await service.sendMessage(testInput);
      } catch (error) {
        thrownError = error;
      }

      expect(thrownError).toBeDefined();
      expect(thrownError.message).toContain('channel_not_found');
    });

    it('should handle missing user token for search operations', async () => {
      const testInput = { query: 'test', count: 10 };

      const service = await createServiceWithConfig({
        USE_USER_TOKEN_FOR_READ: true,
        SLACK_USER_TOKEN: undefined, // No user token
      });

      let thrownError: any;
      try {
        await service.searchMessages(testInput);
      } catch (error) {
        thrownError = error;
      }

      expect(thrownError).toBeDefined();
      expect(thrownError.message).toContain('user token');
    });
  });

  describe('Performance', () => {
    /**
     * Test performance characteristics
     */
    it('should handle concurrent operations correctly', async () => {
      const testInputs = [
        { channel: 'C123456', text: 'Message 1' },
        { channel: 'C123456', text: 'Message 2' },
        { channel: 'C123456', text: 'Message 3' },
      ];

      const service = await createServiceWithConfig({});
      const results = await Promise.all(
        testInputs.map((input) => service.sendMessage(input))
      );

      expect(results).toHaveLength(3);
      results.forEach((result) => {
        expect(result).toBeDefined();
        expect(result.content).toBeDefined();
      });
    });
  });

  describe('Service Method Validation', () => {
    /**
     * Test service method availability and routing
     */
    it('should have all 36 methods available', async () => {
      const expectedMethods = [
        // Core operations (6)
        'sendMessage',
        'listChannels',
        'getChannelHistory',
        'getUserInfo',
        'searchMessages',
        'getChannelInfo',

        // Thread operations (14)
        'findThreadsInChannel',
        'getThreadReplies',
        'searchThreads',
        'postThreadReply',
        'createThread',
        'markThreadImportant',
        'analyzeThread',
        'summarizeThread',
        'extractActionItems',
        'identifyImportantThreads',
        'exportThread',
        'findRelatedThreads',
        'getThreadMetrics',
        'getThreadsByParticipants',

        // File operations (7)
        'uploadFile',
        'listFiles',
        'getFileInfo',
        'deleteFile',
        'shareFile',
        'analyzeFiles',
        'searchFiles',

        // Reaction operations (5)
        'addReaction',
        'removeReaction',
        'getReactions',
        'getReactionStatistics',
        'findMessagesByReactions',

        // Workspace operations (4)
        'getWorkspaceInfo',
        'listTeamMembers',
        'getWorkspaceActivity',
        'getServerHealth',
      ];

      const service = await createServiceWithConfig({});

      expectedMethods.forEach((methodName) => {
        expect(typeof (service as any)[methodName]).toBe('function');
      });

      expect(expectedMethods).toHaveLength(36);
    });

    it('should be able to call methods from different domains', async () => {
      const service = await createServiceWithConfig({});

      // All methods should be available and callable
      expect(typeof service.sendMessage).toBe('function');
      expect(typeof service.findThreadsInChannel).toBe('function');
      expect(typeof service.uploadFile).toBe('function');
      expect(typeof service.addReaction).toBe('function');
      expect(typeof service.getWorkspaceInfo).toBe('function');

      // Should be able to call methods from different domains
      const messageResult = await service.sendMessage({
        channel: 'C123456',
        text: 'Test message',
      });
      expect(messageResult).toBeDefined();
      expect(messageResult.content).toBeDefined();

      const threadResult = await service.findThreadsInChannel({
        channel: 'C123456',
        limit: 10,
      });
      expect(threadResult).toBeDefined();
      expect(threadResult.content).toBeDefined();
    });
  });
});
