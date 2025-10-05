/**
 * TDD Red Phase: DisplayName Conversion Tests
 *
 * These tests verify that searchMessages and searchThreads properly convert
 * user IDs to display names, following the successful pattern from getChannelHistory.
 *
 * This test file is designed to FAIL with the current implementation to demonstrate
 * the missing displayName conversion functionality.
 */

import { jest } from '@jest/globals';
import { SlackService } from '../slack/slack-service.js';
import { extractTextContent } from '../utils/helpers.js';

// Create a shared mock WebClient instance
const createMockWebClient = (): any => ({
  chat: {
    postMessage: jest.fn(),
  },
  conversations: {
    list: jest.fn(),
    history: jest.fn(),
    replies: jest.fn(),
    info: jest.fn(),
  },
  users: {
    info: jest.fn(),
    list: jest.fn(),
  },
  search: {
    messages: jest.fn(),
    all: jest.fn(),
  },
  reactions: {
    add: jest.fn(),
  },
  files: {
    upload: jest.fn(),
    list: jest.fn(),
    info: jest.fn(),
    delete: jest.fn(),
    share: jest.fn(),
  },
  auth: {
    test: jest.fn(),
  },
  on: jest.fn(),
  apiCall: jest.fn(),
});

let mockWebClientInstance = createMockWebClient();

// Mock the WebClient
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

// Mock the config
jest.mock('../config/index', () => {
  const mockConfig = {
    SLACK_BOT_TOKEN: 'xoxb-test-token',
    SLACK_USER_TOKEN: 'xoxp-test-token',
    USE_USER_TOKEN_FOR_READ: true,
    SLACK_RATE_LIMIT_RETRIES: 3,
    SLACK_MAX_REQUEST_CONCURRENCY: 3,
    SLACK_REJECT_RATE_LIMITED_CALLS: false,
    SLACK_ENABLE_RATE_LIMIT_RETRY: true,
    LOG_LEVEL: 'info',
    MCP_SERVER_NAME: 'test-server',
    MCP_SERVER_VERSION: '1.0.0',
    PORT: 3000,
  };
  return {
    CONFIG: mockConfig,
    getConfig: () => mockConfig,
  };
});

// Mock the logger
jest.mock('../utils/logger', () => ({
  logger: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

describe('TDD Red Phase: DisplayName Conversion', () => {
  let slackService: SlackService;

  beforeEach(() => {
    jest.clearAllMocks();
    mockWebClientInstance = createMockWebClient();

    // Mock auth test for both tokens
    mockWebClientInstance.auth.test.mockResolvedValue({
      ok: true,
      user_id: 'U12345',
      team: 'T12345',
    });

    // Mock users.info for display name resolution
    mockWebClientInstance.users.info.mockImplementation((args: any) => {
      const userMap: Record<string, string> = {
        U123456: 'John Doe',
        U789012: 'Jane Smith',
        U345678: 'Bob Wilson',
      };

      const userId = args.user;
      const displayName = userMap[userId] || `User ${userId}`;

      return Promise.resolve({
        ok: true,
        user: {
          id: userId,
          name: displayName.toLowerCase().replace(' ', '.'),
          real_name: displayName,
          display_name: displayName,
          profile: {
            display_name: displayName,
            real_name: displayName,
          },
        },
      });
    });

    slackService = new SlackService();
  });

  describe('searchMessages displayName conversion', () => {
    it('should include userDisplayName field in search results', async () => {
      // Arrange: Mock search.messages response
      mockWebClientInstance.search.messages.mockResolvedValue({
        ok: true,
        messages: {
          total: 2,
          matches: [
            {
              text: 'Hello world',
              user: 'U123456',
              ts: '1234567890.123456',
              channel: { id: 'C123456789' },
              permalink: 'https://test.slack.com/message1',
            },
            {
              text: 'How are you?',
              user: 'U789012',
              ts: '1234567890.654321',
              channel: { id: 'C123456789' },
              permalink: 'https://test.slack.com/message2',
            },
          ],
          paging: { page: 1, pages: 1 },
        },
      } as any);

      // Act: Perform search
      const result = await slackService.searchMessages({
        query: 'hello',
        count: 20,
      });

      // Assert: Parse the JSON response
      const responseText = extractTextContent(result.content?.[0]);
      const parsedResult = JSON.parse(responseText);

      // TDD Red: These assertions should FAIL with current implementation
      expect(parsedResult.data.messages).toHaveLength(2);

      // This will fail because userDisplayName is not being added
      expect(parsedResult.data.messages[0]).toHaveProperty('userDisplayName');
      expect(parsedResult.data.messages[0].userDisplayName).toBe('John Doe');

      expect(parsedResult.data.messages[1]).toHaveProperty('userDisplayName');
      expect(parsedResult.data.messages[1].userDisplayName).toBe('Jane Smith');
    });

    it('should handle users without display names gracefully', async () => {
      // Arrange: Mock search with unknown user
      mockWebClientInstance.search.messages.mockResolvedValue({
        ok: true,
        messages: {
          total: 1,
          matches: [
            {
              text: 'Message from unknown user',
              user: 'U999999',
              ts: '1234567890.123456',
              channel: { id: 'C123456789' },
              permalink: 'https://test.slack.com/message',
            },
          ],
          paging: { page: 1, pages: 1 },
        },
      } as any);

      // Act
      const result = await slackService.searchMessages({
        query: 'unknown',
        count: 20,
      });

      // Assert
      const responseText = extractTextContent(result.content?.[0]);
      const parsedResult = JSON.parse(responseText);

      // This should fail because userDisplayName is not implemented
      expect(parsedResult.data.messages[0]).toHaveProperty('userDisplayName');
      expect(parsedResult.data.messages[0].userDisplayName).toBe('User U999999'); // Fallback
    });
  });

  describe('searchThreads displayName conversion', () => {
    it('should include userDisplayName field in thread search results', async () => {
      // Arrange: Mock search.all response
      mockWebClientInstance.search.all.mockResolvedValue({
        ok: true,
        messages: {
          total: 1,
          matches: [
            {
              text: 'Thread starter message',
              user: 'U123456',
              ts: '1234567890.123456',
              channel: { id: 'C123456789' },
              permalink: 'https://test.slack.com/thread',
              thread_ts: '1234567890.123456',
            },
          ],
        },
      } as any);

      // Mock conversations.replies for thread validation
      mockWebClientInstance.conversations.replies.mockResolvedValue({
        ok: true,
        messages: [
          {
            text: 'Thread starter message',
            user: 'U123456',
            ts: '1234567890.123456',
          },
          {
            text: 'Reply message',
            user: 'U789012',
            ts: '1234567890.654321',
          },
        ],
      } as any);

      // Mock conversations.info for channel name resolution
      mockWebClientInstance.conversations.info.mockResolvedValue({
        ok: true,
        channel: {
          id: 'C123456789',
          name: 'general',
        },
      } as any);

      // Act: Search for threads
      const result = await slackService.searchThreads({
        query: 'thread',
        limit: 10,
      });

      // Assert: Parse the result
      const responseText = extractTextContent(result.content?.[0]);
      const parsedResult = JSON.parse(responseText);

      // TDD Red: These assertions should FAIL with current implementation
      expect(parsedResult.data.results).toHaveLength(1);

      // This will fail because userDisplayName is not being added to search results
      expect(parsedResult.data.results[0]).toHaveProperty('userDisplayName');
      expect(parsedResult.data.results[0].userDisplayName).toBe('John Doe');

      // Verify parentMessage also has userDisplayName
      if (parsedResult.data.results[0].parentMessage?.user) {
        expect(parsedResult.data.results[0].parentMessage).toHaveProperty('userDisplayName');
        expect(parsedResult.data.results[0].parentMessage.userDisplayName).toBe('John Doe');
      }
    });
  });

  describe('Comparison with working getChannelHistory pattern', () => {
    it('should demonstrate that getChannelHistory correctly includes userDisplayName', async () => {
      // Arrange: Mock channel history response
      mockWebClientInstance.conversations.history.mockResolvedValue({
        ok: true,
        messages: [
          {
            type: 'message',
            user: 'U123456',
            text: 'Working example with display name',
            ts: '1234567890.123456',
          },
          {
            type: 'message',
            user: 'U789012',
            text: 'Another message',
            ts: '1234567890.654321',
          },
        ],
        has_more: false,
      } as any);

      // Act: Get channel history (this should work correctly)
      const result = await slackService.getChannelHistory({
        channel: 'C123456789',
        limit: 100,
      });

      // Assert: This should PASS (demonstrating the correct pattern)
      const responseText = extractTextContent(result.content?.[0]);
      const parsedResult = JSON.parse(responseText);

      // This should pass because getChannelHistory implements displayName conversion
      expect(parsedResult.data.messages).toHaveLength(2);
      expect(parsedResult.data.messages[0]).toHaveProperty('userDisplayName');
      expect(parsedResult.data.messages[0].userDisplayName).toBe('John Doe');
      expect(parsedResult.data.messages[1].userDisplayName).toBe('Jane Smith');

      // This demonstrates the pattern that searchMessages and searchThreads should follow
    });
  });
});
