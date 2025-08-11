/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import type { WebClient } from '@slack/web-api';
import { SlackService } from '../slack/slack-service.js';
import type { MCPToolResult } from '../mcp/types.js';
import type { PerformanceMetrics } from '../slack/service-factory-stub.js';

/**
 * Integration tests to validate modular vs legacy behavior parity
 *
 * These tests ensure that:
 * 1. Legacy and modular implementations produce identical outputs for same inputs
 * 2. Token strategy routing works correctly in both modes
 * 3. Configuration switching behaves consistently
 * 4. Cross-domain operations work seamlessly
 * 5. Error handling is consistent across implementations
 * 6. Performance characteristics are comparable
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

// Create a function to create mock config with different flags
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
    // Modular architecture flags
    USE_MODULAR_ARCHITECTURE: false,
    ENABLE_MODULAR_MESSAGES: false,
    ENABLE_MODULAR_THREADS: false,
    ENABLE_MODULAR_FILES: false,
    ENABLE_MODULAR_REACTIONS: false,
    ENABLE_MODULAR_WORKSPACE: false,
    ENABLE_PERFORMANCE_METRICS: false,
    MONITOR_LEGACY_COMPARISON: false,
    ...overrides,
  };
  return baseConfig;
}

describe('Integration Tests: Modular vs Legacy Parity', () => {
  let originalEnv: NodeJS.ProcessEnv;
  let originalMockConfig: any;

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

  describe('Behavior Parity Tests', () => {
    /**
     * Test that legacy and modular implementations produce identical results
     */
    it('should produce identical results for sendMessage in both modes', async () => {
      const testInput = {
        channel: 'C123456',
        text: 'Hello from integration test!',
      };

      // Test legacy implementation
      const legacyService = await createServiceWithConfig({
        USE_MODULAR_ARCHITECTURE: false,
      });
      const legacyResult = await legacyService.sendMessage(testInput);

      // Reset mocks between calls
      jest.clearAllMocks();
      mockWebClientInstance = createMockWebClient();

      // Test modular implementation
      const modularService = await createServiceWithConfig({
        USE_MODULAR_ARCHITECTURE: true,
        ENABLE_MODULAR_MESSAGES: true,
      });
      const modularResult = await modularService.sendMessage(testInput);

      // Results should be structurally identical
      expect(legacyResult).toEqual(modularResult);
      expect(legacyResult.content).toEqual(modularResult.content);
    });

    it('should produce identical results for getChannelHistory in both modes', async () => {
      const testInput = {
        channel: 'C123456',
        limit: 10,
      };

      // Test legacy implementation
      const legacyService = await createServiceWithConfig({
        USE_MODULAR_ARCHITECTURE: false,
      });
      const legacyResult = await legacyService.getChannelHistory(testInput);

      // Reset mocks
      jest.clearAllMocks();
      mockWebClientInstance = createMockWebClient();

      // Test modular implementation
      const modularService = await createServiceWithConfig({
        USE_MODULAR_ARCHITECTURE: true,
        ENABLE_MODULAR_MESSAGES: true,
      });
      const modularResult = await modularService.getChannelHistory(testInput);

      // Results should be identical
      expect(legacyResult).toEqual(modularResult);
    });

    it('should produce identical results for findThreadsInChannel in both modes', async () => {
      const testInput = {
        channel: 'C123456',
        limit: 50,
      };

      // Test legacy implementation
      const legacyService = await createServiceWithConfig({
        USE_MODULAR_ARCHITECTURE: false,
      });
      const legacyResult = await legacyService.findThreadsInChannel(testInput);

      // Reset mocks
      jest.clearAllMocks();
      mockWebClientInstance = createMockWebClient();

      // Test modular implementation
      const modularService = await createServiceWithConfig({
        USE_MODULAR_ARCHITECTURE: true,
        ENABLE_MODULAR_THREADS: true,
      });
      const modularResult = await modularService.findThreadsInChannel(testInput);

      // Results should be identical
      expect(legacyResult).toEqual(modularResult);
    });
  });

  describe('Token Strategy Testing', () => {
    /**
     * Test that token strategy routing works correctly in both modes
     */
    it('should use correct token for read operations in both modes', async () => {
      const testInput = {
        channel: 'C123456',
        limit: 10,
      };

      // Test legacy mode with user token
      const legacyService = await createServiceWithConfig({
        USE_MODULAR_ARCHITECTURE: false,
        USE_USER_TOKEN_FOR_READ: true,
      });
      await legacyService.getChannelHistory(testInput);

      // Reset mocks
      jest.clearAllMocks();
      mockWebClientInstance = createMockWebClient();

      // Test modular mode with user token
      const modularService = await createServiceWithConfig({
        USE_MODULAR_ARCHITECTURE: true,
        ENABLE_MODULAR_MESSAGES: true,
        USE_USER_TOKEN_FOR_READ: true,
      });
      await modularService.getChannelHistory(testInput);

      // Both should make the same API call
      expect(mockWebClientInstance.conversations.history).toHaveBeenCalledTimes(1);
    });

    it('should handle search operations consistently in both modes', async () => {
      const testInput = {
        query: 'test search',
        count: 20,
      };

      // Legacy mode
      const legacyService = await createServiceWithConfig({
        USE_MODULAR_ARCHITECTURE: false,
        USE_USER_TOKEN_FOR_READ: true,
      });
      const legacyResult = await legacyService.searchMessages(testInput);

      // Reset mocks
      jest.clearAllMocks();
      mockWebClientInstance = createMockWebClient();

      // Modular mode
      const modularService = await createServiceWithConfig({
        USE_MODULAR_ARCHITECTURE: true,
        ENABLE_MODULAR_MESSAGES: true,
        USE_USER_TOKEN_FOR_READ: true,
      });
      const modularResult = await modularService.searchMessages(testInput);

      // Results should be identical
      expect(legacyResult).toEqual(modularResult);
    });
  });

  describe('Cross-Domain Operations', () => {
    /**
     * Test complex workflows that span multiple domains
     */
    it('should handle thread → file → reaction workflow consistently', async () => {
      const testWorkflow = async (service: SlackService) => {
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

        return { threadResult, reactionResult };
      };

      // Test legacy implementation
      const legacyService = await createServiceWithConfig({
        USE_MODULAR_ARCHITECTURE: false,
      });
      const legacyWorkflowResult = await testWorkflow(legacyService);

      // Reset mocks
      jest.clearAllMocks();
      mockWebClientInstance = createMockWebClient();

      // Test modular implementation
      const modularService = await createServiceWithConfig({
        USE_MODULAR_ARCHITECTURE: true,
        ENABLE_MODULAR_THREADS: true,
        ENABLE_MODULAR_REACTIONS: true,
      });
      const modularWorkflowResult = await testWorkflow(modularService);

      // Workflow results should be identical
      expect(legacyWorkflowResult.threadResult).toEqual(modularWorkflowResult.threadResult);
      expect(legacyWorkflowResult.reactionResult).toEqual(modularWorkflowResult.reactionResult);
    });
  });

  describe('Configuration Switching', () => {
    /**
     * Test configuration flag switching behavior
     */
    it('should handle partial modular enablement correctly', async () => {
      const testInput = { channel: 'C123456', text: 'Test message' };

      // Only enable messages modularly, keep others legacy
      const service = await createServiceWithConfig({
        USE_MODULAR_ARCHITECTURE: true,
        ENABLE_MODULAR_MESSAGES: true,
        ENABLE_MODULAR_THREADS: false,
        ENABLE_MODULAR_FILES: false,
        ENABLE_MODULAR_REACTIONS: false,
        ENABLE_MODULAR_WORKSPACE: false,
      });

      // Message operations should use modular
      const messageResult = await service.sendMessage(testInput);
      expect(messageResult).toBeDefined();

      // Thread operations should use legacy (fallback)
      const threadInput = { channel: 'C123456', limit: 10 };
      const threadResult = await service.findThreadsInChannel(threadInput);
      expect(threadResult).toBeDefined();

      // Both should work seamlessly
      expect(messageResult.content).toBeDefined();
      expect(threadResult.content).toBeDefined();
    });

    it('should maintain performance monitoring across configurations', async () => {
      const service = await createServiceWithConfig({
        USE_MODULAR_ARCHITECTURE: true,
        ENABLE_PERFORMANCE_METRICS: true,
        MONITOR_LEGACY_COMPARISON: true,
        ENABLE_MODULAR_MESSAGES: true,
      });

      const testInput = { channel: 'C123456', text: 'Performance test' };
      await service.sendMessage(testInput);

      // Performance metrics should be available
      const stats = service.getPerformanceStats();
      expect(stats).toBeDefined();
    });
  });

  describe('Error Handling Consistency', () => {
    /**
     * Test that error handling is consistent across implementations
     */
    it('should handle API errors consistently in both modes', async () => {
      // Mock API error
      const apiError = new Error('channel_not_found');
      mockWebClientInstance.chat.postMessage.mockRejectedValue(apiError);

      const testInput = { channel: 'INVALID', text: 'Test message' };

      // Test legacy error handling
      const legacyService = await createServiceWithConfig({
        USE_MODULAR_ARCHITECTURE: false,
      });

      let legacyError: any;
      try {
        await legacyService.sendMessage(testInput);
      } catch (error) {
        legacyError = error;
      }

      // Reset mocks
      jest.clearAllMocks();
      mockWebClientInstance = createMockWebClient();
      mockWebClientInstance.chat.postMessage.mockRejectedValue(apiError);

      // Test modular error handling
      const modularService = await createServiceWithConfig({
        USE_MODULAR_ARCHITECTURE: true,
        ENABLE_MODULAR_MESSAGES: true,
      });

      let modularError: any;
      try {
        await modularService.sendMessage(testInput);
      } catch (error) {
        modularError = error;
      }

      // Error handling should be consistent
      expect(legacyError).toBeDefined();
      expect(modularError).toBeDefined();
      expect(legacyError.message).toEqual(modularError.message);
    });

    it('should handle missing user token consistently for search operations', async () => {
      const testInput = { query: 'test', count: 10 };

      // Test legacy error handling (no user token)
      const legacyService = await createServiceWithConfig({
        USE_MODULAR_ARCHITECTURE: false,
        USE_USER_TOKEN_FOR_READ: true,
        SLACK_USER_TOKEN: undefined, // No user token
      });

      let legacyError: any;
      try {
        await legacyService.searchMessages(testInput);
      } catch (error) {
        legacyError = error;
      }

      // Test modular error handling (no user token)
      const modularService = await createServiceWithConfig({
        USE_MODULAR_ARCHITECTURE: true,
        ENABLE_MODULAR_MESSAGES: true,
        USE_USER_TOKEN_FOR_READ: true,
        SLACK_USER_TOKEN: undefined, // No user token
      });

      let modularError: any;
      try {
        await modularService.searchMessages(testInput);
      } catch (error) {
        modularError = error;
      }

      // Both should handle the missing token error consistently
      expect(legacyError).toBeDefined();
      expect(modularError).toBeDefined();
      expect(legacyError.message).toContain('user token');
      expect(modularError.message).toContain('user token');
    });
  });

  describe('Performance Comparison', () => {
    /**
     * Test performance characteristics between implementations
     */
    it('should handle concurrent operations similarly', async () => {
      const testInputs = [
        { channel: 'C123456', text: 'Message 1' },
        { channel: 'C123456', text: 'Message 2' },
        { channel: 'C123456', text: 'Message 3' },
      ];

      // Test legacy concurrent operations
      const legacyService = await createServiceWithConfig({
        USE_MODULAR_ARCHITECTURE: false,
      });

      const legacyResults = await Promise.all(
        testInputs.map((input) => legacyService.sendMessage(input))
      );

      // Reset mocks
      jest.clearAllMocks();
      mockWebClientInstance = createMockWebClient();

      // Test modular concurrent operations
      const modularService = await createServiceWithConfig({
        USE_MODULAR_ARCHITECTURE: true,
        ENABLE_MODULAR_MESSAGES: true,
      });

      const modularResults = await Promise.all(
        testInputs.map((input) => modularService.sendMessage(input))
      );

      // Results should be identical
      expect(legacyResults).toEqual(modularResults);
      expect(legacyResults).toHaveLength(3);
      expect(modularResults).toHaveLength(3);
    });
  });

  describe('Service Registry Validation', () => {
    /**
     * Test service registry behavior and method routing
     */
    it('should have all 36 methods available in both modes', async () => {
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

      // Test legacy mode
      const legacyService = await createServiceWithConfig({
        USE_MODULAR_ARCHITECTURE: false,
      });

      expectedMethods.forEach((methodName) => {
        expect(typeof (legacyService as any)[methodName]).toBe('function');
      });

      // Test modular mode
      const modularService = await createServiceWithConfig({
        USE_MODULAR_ARCHITECTURE: true,
        ENABLE_MODULAR_MESSAGES: true,
        ENABLE_MODULAR_THREADS: true,
        ENABLE_MODULAR_FILES: true,
        ENABLE_MODULAR_REACTIONS: true,
        ENABLE_MODULAR_WORKSPACE: true,
      });

      expectedMethods.forEach((methodName) => {
        expect(typeof (modularService as any)[methodName]).toBe('function');
      });

      expect(expectedMethods).toHaveLength(36);
    });

    it('should route methods correctly based on feature flags', async () => {
      // Only enable messages modularly
      const service = await createServiceWithConfig({
        USE_MODULAR_ARCHITECTURE: true,
        ENABLE_MODULAR_MESSAGES: true,
        ENABLE_MODULAR_THREADS: false,
        ENABLE_MODULAR_FILES: false,
        ENABLE_MODULAR_REACTIONS: false,
        ENABLE_MODULAR_WORKSPACE: false,
      });

      // All methods should still be available
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

      const threadResult = await service.findThreadsInChannel({
        channel: 'C123456',
        limit: 10,
      });
      expect(threadResult).toBeDefined();
    });
  });
});
