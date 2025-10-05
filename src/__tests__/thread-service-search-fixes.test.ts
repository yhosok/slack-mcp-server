/**
 * TDD Green Phase: Tests that verify the fixes for critical thread search bugs
 *
 * This test suite validates that the three critical bugs have been fixed:
 * 1. **Channel reference fix**: Uses proper `in:#channel_name` syntax
 * 2. **Participant logic fix**: Correctly handles AND vs OR logic for participants
 * 3. **Thread identification fix**: Properly identifies thread parent timestamps
 *
 * These tests should PASS with the current implementation to prove the bugs are fixed.
 */

import { jest } from '@jest/globals';
import type { SearchAllResponse } from '@slack/web-api';

// Mock the logger
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
  validateInput: jest.fn((schema, input) => input),
}));

// Mock the config
const mockConfig = {
  SLACK_BOT_TOKEN: 'xoxb-test-bot-token',
  SLACK_USER_TOKEN: 'xoxp-test-user-token',
  USE_USER_TOKEN_FOR_READ: true,
  SLACK_ENABLE_RATE_LIMIT_RETRY: true,
  SLACK_RATE_LIMIT_RETRIES: 3,
  SLACK_MAX_REQUEST_CONCURRENCY: 3,
  SLACK_REJECT_RATE_LIMITED_CALLS: false,
  LOG_LEVEL: 'info',
  MCP_SERVER_NAME: 'slack-mcp-server',
  MCP_SERVER_VERSION: '1.0.0',
  PORT: 3000,
};

jest.mock('../config/index', () => ({
  getConfig: jest.fn(() => mockConfig),
  CONFIG: mockConfig,
}));

// Create a shared mock WebClient instance
const createMockWebClient = (): any => ({
  conversations: {
    history: jest.fn(),
    replies: jest.fn(),
    info: jest.fn(),
  },
  search: {
    all: jest.fn(),
  },
  users: {
    info: jest.fn(),
  },
  auth: {
    test: jest.fn(),
  },
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
}));

// Import after mocks are set up
import { createThreadServiceMCPAdapter } from '../slack/services/threads/thread-service-mcp-adapter.js';
import { createInfrastructureServices } from '../slack/infrastructure/index.js';
import type { MCPTextContent, MCPToolResult } from '../mcp/types.js';

describe('Thread Service Search Fixes - TDD Green Phase', () => {
  let threadService: any;
  let mockInfrastructure: any;

  // Helper function to parse MCP response content
  const parseResponse = (response: MCPToolResult) => {
    const textContent = response?.content?.[0] as MCPTextContent;
    if (textContent?.text) {
      try {
        const parsed = JSON.parse(textContent.text);
        return parsed.data || parsed;
      } catch {
        return textContent.text;
      }
    }
    return response;
  };

  // Test data
  const testChannel = 'C1234567890';
  const testChannelName = 'general';
  const testUserId1 = 'U1234567890';
  const testUserId2 = 'U0987654321';
  const testUserId3 = 'U1111111111';

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();
    mockWebClientInstance = createMockWebClient();

    // Create infrastructure services
    mockInfrastructure = createInfrastructureServices({
      botToken: 'xoxb-test-bot-token',
      userToken: 'xoxp-test-user-token',
      useUserTokenForRead: true,
      enableRateLimit: false,
      rateLimitRetries: 3,
      maxRequestConcurrency: 3,
      rejectRateLimitedCalls: false,
      logLevel: 'info',
      cacheEnabled: false,
      cacheConfig: {
        channels: { max: 100, ttl: 300000, updateAgeOnGet: true },
        users: { max: 100, ttl: 300000, updateAgeOnGet: true },
        search: {
          maxQueries: 10,
          maxResults: 10,
          queryTTL: 300000,
          resultTTL: 300000,
          adaptiveTTL: false,
          enablePatternInvalidation: false,
        },
        files: { max: 50, ttl: 300000 },
        threads: { max: 50, ttl: 300000, updateAgeOnGet: true },
        enableMetrics: false,
      },
      searchRankingEnabled: false,
      searchIndexTTL: 900,
      searchTimeDecayRate: 0.01,
      searchMaxIndexSize: 1000,
    });

    // Create thread service with MCP adapter
    threadService = createThreadServiceMCPAdapter(mockInfrastructure);

    // Setup default user info mock
    mockWebClientInstance.users.info.mockResolvedValue({
      ok: true,
      user: {
        id: testUserId1,
        name: 'alice',
        real_name: 'Alice Smith',
        profile: {
          display_name: 'Alice',
          real_name: 'Alice Smith',
        },
      },
    });

    // Setup channel info mock to return proper channel name
    mockWebClientInstance.conversations.info.mockResolvedValue({
      ok: true,
      channel: {
        id: testChannel,
        name: testChannelName,
      },
    });
  });

  describe('Fix 1: Proper Channel Reference Syntax', () => {
    it('should use channel names instead of channel IDs in search queries', async () => {
      // Mock search API call to capture the actual query sent
      let capturedQuery = '';
      mockWebClientInstance.search.all.mockImplementation((args: any) => {
        capturedQuery = args.query;
        return Promise.resolve({
          ok: true,
          messages: { matches: [] },
        });
      });

      await threadService.searchThreads({
        query: 'test query',
        channel: testChannel,
      });

      // FIXED: Should now use channel name without angle brackets
      expect(capturedQuery).toContain(`in:#${testChannelName}`);
      expect(capturedQuery).not.toContain(`in:<#${testChannel}>`);
      expect(capturedQuery).not.toContain('in:<#');
    });

    it('should resolve channel IDs to names in searchThreads', async () => {
      let capturedQuery = '';
      mockWebClientInstance.search.all.mockImplementation((args: any) => {
        capturedQuery = args.query;
        return Promise.resolve({
          ok: true,
          messages: { matches: [] },
        });
      });

      // Test channel resolution in searchThreads (which always uses search API)
      await threadService.searchThreads({
        query: 'test query',
        channel: testChannel,
      });

      // FIXED: Should now use channel name without angle brackets
      expect(capturedQuery).toContain(`in:#${testChannelName}`);
      expect(capturedQuery).not.toContain(`in:<#${testChannel}>`);
      expect(capturedQuery).not.toContain('in:<#');
    });

    it('should handle channel resolution failures gracefully', async () => {
      // Mock channel info to fail
      mockWebClientInstance.conversations.info.mockRejectedValue(new Error('Channel not found'));

      let capturedQuery = '';
      mockWebClientInstance.search.all.mockImplementation((args: any) => {
        capturedQuery = args.query;
        return Promise.resolve({
          ok: true,
          messages: { matches: [] },
        });
      });

      await threadService.searchThreads({
        query: 'test query',
        channel: testChannel,
      });

      // Should fallback to channel ID if resolution fails
      expect(capturedQuery).toContain(`in:#${testChannel}`);
    });
  });

  describe('Fix 2: Correct Participant Logic', () => {
    it('should use proper AND logic for require_all_participants=true', async () => {
      let capturedQuery = '';
      mockWebClientInstance.search.all.mockImplementation((args: any) => {
        capturedQuery = args.query;
        return Promise.resolve({
          ok: true,
          messages: { matches: [] },
        });
      });

      await threadService.getThreadsByParticipants({
        participants: [testUserId1, testUserId2, testUserId3],
        require_all_participants: true,
      });

      // FIXED: Should now search for first participant only, then filter programmatically
      expect(capturedQuery).toContain(`from:<@${testUserId1}>`);
      // Should NOT contain all participants in the search query
      expect(capturedQuery).not.toContain(`from:<@${testUserId2}>`);
      expect(capturedQuery).not.toContain(`from:<@${testUserId3}>`);
    });

    it('should use proper OR logic for require_all_participants=false', async () => {
      let capturedQuery = '';
      mockWebClientInstance.search.all.mockImplementation((args: any) => {
        capturedQuery = args.query;
        return Promise.resolve({
          ok: true,
          messages: { matches: [] },
        });
      });

      await threadService.getThreadsByParticipants({
        participants: [testUserId1, testUserId2],
        require_all_participants: false,
      });

      // FIXED: Should now use proper OR without extra parentheses
      expect(capturedQuery).toContain(`from:<@${testUserId1}> OR from:<@${testUserId2}>`);
      // Should NOT have extra parentheses
      expect(capturedQuery).not.toContain('(');
      expect(capturedQuery).not.toContain(')');
    });

    it('should correctly filter results for require_all_participants=true', async () => {
      // Mock search to return a result that should be filtered out
      const mockSearchResults: any[] = [
        {
          type: 'message',
          user: testUserId1,
          text: 'Thread with only some participants',
          ts: '1699564860.000200',
          channel: { id: testChannel, name: testChannelName },
        },
      ];

      mockWebClientInstance.search.all.mockResolvedValue({
        ok: true,
        messages: { matches: mockSearchResults },
      } as SearchAllResponse);

      // Mock thread replies to show only 2 of 3 required participants
      mockWebClientInstance.conversations.replies.mockResolvedValue({
        ok: true,
        messages: [
          { ts: '1699564860.000200', user: testUserId1, text: 'Message 1' },
          { ts: '1699564920.000300', user: testUserId2, text: 'Message 2' },
          // testUserId3 is missing - should be filtered out
        ],
      });

      const result = await threadService.getThreadsByParticipants({
        participants: [testUserId1, testUserId2, testUserId3],
        require_all_participants: true,
      });

      const parsedResult = parseResponse(result);

      // FIXED: Should correctly filter out threads that don't have ALL participants
      expect(parsedResult.threads).toEqual([]);
    });
  });

  describe('Fix 3: Correct Thread Identification', () => {
    it('should correctly identify thread parent from search results with thread_ts', async () => {
      const threadParentTs = '1699564800.000100';
      const replyTs = '1699564860.000200';

      // Mock search result that is a reply (has thread_ts)
      const mockSearchResults: any[] = [
        {
          type: 'message',
          user: testUserId1,
          text: 'This is a reply in a thread',
          ts: replyTs,
          thread_ts: threadParentTs, // This indicates it's a reply
          channel: { id: testChannel, name: testChannelName },
        },
      ];

      mockWebClientInstance.search.all.mockResolvedValue({
        ok: true,
        messages: { matches: mockSearchResults },
      } as SearchAllResponse);

      // Mock thread replies to return the complete thread
      mockWebClientInstance.conversations.replies.mockImplementation((args: any) => {
        if (args.ts === threadParentTs) {
          // FIXED: Should now call with the correct thread parent timestamp
          return Promise.resolve({
            ok: true,
            messages: [
              { ts: threadParentTs, user: testUserId2, text: 'Thread parent' },
              { ts: replyTs, user: testUserId1, text: 'This is a reply in a thread' },
            ],
          });
        }
        return Promise.resolve({ ok: false, error: 'thread_not_found' });
      });

      const result = await threadService.getThreadsByParticipants({
        participants: [testUserId1],
      });

      const parsedResult = parseResponse(result);

      // FIXED: Should now successfully find the thread using correct thread timestamp
      expect(parsedResult.threads).toHaveLength(1);
      expect(parsedResult.threads[0].threadTs).toBe(threadParentTs);

      // Verify it called conversations.replies with the correct thread parent timestamp
      expect(mockWebClientInstance.conversations.replies).toHaveBeenCalledWith(
        expect.objectContaining({
          ts: threadParentTs, // Should use thread_ts, not message ts
        })
      );
    });

    it('should handle search results without thread_ts (thread parents)', async () => {
      const threadParentTs = '1699564800.000100';

      // Mock search result that is a thread parent (no thread_ts)
      const mockSearchResults: any[] = [
        {
          type: 'message',
          user: testUserId1,
          text: 'This is a thread parent',
          ts: threadParentTs,
          // No thread_ts - indicates this is the parent
          channel: { id: testChannel, name: testChannelName },
        },
      ];

      mockWebClientInstance.search.all.mockResolvedValue({
        ok: true,
        messages: { matches: mockSearchResults },
      } as SearchAllResponse);

      // Mock thread replies - must include parent + at least one reply to be a valid thread
      mockWebClientInstance.conversations.replies.mockResolvedValue({
        ok: true,
        messages: [
          { ts: threadParentTs, user: testUserId1, text: 'This is a thread parent' },
          {
            ts: '1699564801.000100',
            user: testUserId2,
            text: 'This is a reply',
            thread_ts: threadParentTs,
          },
        ],
      });

      const result = await threadService.getThreadsByParticipants({
        participants: [testUserId1],
      });

      const parsedResult = parseResponse(result);

      // FIXED: Should successfully handle thread parents (messages without thread_ts)
      expect(parsedResult.threads).toHaveLength(1);
      expect(parsedResult.threads[0].threadTs).toBe(threadParentTs);

      // Should call with the message timestamp when no thread_ts is present
      expect(mockWebClientInstance.conversations.replies).toHaveBeenCalledWith(
        expect.objectContaining({
          ts: threadParentTs,
        })
      );
    });
  });

  describe('Integration: All Fixes Working Together', () => {
    it('should handle a realistic scenario with all fixes applied', async () => {
      const threadParentTs = '1699564800.000100';
      const reply1Ts = '1699564860.000200';
      const reply2Ts = '1699564920.000300';

      // Realistic search result: user searched and got a thread reply
      const mockSearchResult = {
        ok: true,
        messages: {
          matches: [
            {
              type: 'message',
              user: testUserId1,
              text: 'The deployment is ready for review',
              ts: reply1Ts,
              thread_ts: threadParentTs, // Points to the actual thread parent
              channel: { id: testChannel, name: testChannelName },
            },
          ],
        },
      };

      let capturedQuery = '';
      mockWebClientInstance.search.all.mockImplementation((args: any) => {
        capturedQuery = args.query;
        return Promise.resolve(mockSearchResult);
      });

      // Mock thread replies to return complete thread
      mockWebClientInstance.conversations.replies.mockImplementation((args: any) => {
        if (args.ts === threadParentTs) {
          // Should be called with correct thread parent timestamp
          return Promise.resolve({
            ok: true,
            messages: [
              { ts: threadParentTs, user: testUserId2, text: 'Starting deployment process' },
              { ts: reply1Ts, user: testUserId1, text: 'The deployment is ready for review' },
              { ts: reply2Ts, user: testUserId3, text: 'LGTM, approving' },
            ],
          });
        }
        return Promise.resolve({ ok: false, error: 'thread_not_found' });
      });

      const result = await threadService.getThreadsByParticipants({
        participants: [testUserId1, testUserId2, testUserId3],
        require_all_participants: true,
        // Removed channel to force search strategy (cross-channel search)
      });

      const parsedResult = parseResponse(result);

      // All fixes working together - user now gets correct results
      expect(parsedResult.threads).toHaveLength(1);

      // Fix 1: Correct participant query (no channel filter in this cross-channel test)
      expect(capturedQuery).toContain('from:<@');
      expect(capturedQuery).not.toContain('in:<#'); // No channel in cross-channel search

      // Fix 2: Correct participant logic (search for first, filter programmatically)
      expect(capturedQuery).toContain(`from:<@${testUserId1}>`);
      expect(capturedQuery).not.toContain(`from:<@${testUserId2}>`);

      // Fix 3: Correct thread identification (uses thread_ts, not reply ts)
      expect(mockWebClientInstance.conversations.replies).toHaveBeenCalledWith(
        expect.objectContaining({ ts: threadParentTs })
      );

      // Result contains the expected thread with all participants
      const foundThread = parsedResult.threads[0];
      expect(foundThread.threadTs).toBe(threadParentTs);
      expect(foundThread.participants).toContain(testUserId1);
      expect(foundThread.participants).toContain(testUserId2);
      expect(foundThread.participants).toContain(testUserId3);
    });
  });

  describe('Performance and Edge Cases', () => {
    it('should handle channel resolution cache efficiently', async () => {
      // Call multiple times to test caching behavior
      const calls = [
        threadService.searchThreads({ query: 'test1', channel: testChannel }),
        threadService.searchThreads({ query: 'test2', channel: testChannel }),
      ];

      mockWebClientInstance.search.all.mockResolvedValue({
        ok: true,
        messages: { matches: [] },
      });

      await Promise.all(calls);

      // Should call conversations.info multiple times (no caching implemented yet)
      // This is acceptable for now, caching can be added as optimization later
      expect(mockWebClientInstance.conversations.info).toHaveBeenCalledTimes(2);
    });

    it('should handle malformed search results gracefully', async () => {
      // Mock search result with missing/invalid data
      const mockSearchResults: any[] = [
        {
          // Missing required fields
          ts: undefined,
          channel: null,
        },
        {
          // Valid result
          type: 'message',
          user: testUserId1,
          text: 'Valid message',
          ts: '1699564860.000200',
          channel: { id: testChannel, name: testChannelName },
        },
      ];

      mockWebClientInstance.search.all.mockResolvedValue({
        ok: true,
        messages: { matches: mockSearchResults },
      } as SearchAllResponse);

      mockWebClientInstance.conversations.replies.mockResolvedValue({
        ok: true,
        messages: [
          { ts: '1699564860.000200', user: testUserId1, text: 'Valid message' },
          {
            ts: '1699564861.000201',
            user: testUserId2,
            text: 'Reply message',
            thread_ts: '1699564860.000200',
          },
        ],
      });

      const result = await threadService.getThreadsByParticipants({
        participants: [testUserId1],
      });

      const parsedResult = parseResponse(result);

      // Should handle malformed results gracefully and return valid ones
      expect(parsedResult.threads).toHaveLength(1);
    });
  });
});
