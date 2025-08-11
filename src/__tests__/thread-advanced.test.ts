/**
 * Comprehensive test suite for Advanced Thread Features
 *
 * Tests the advanced thread analysis methods:
 * - getThreadMetrics
 * - exportThread
 * - findRelatedThreads
 * - getThreadsByParticipants
 */

import { jest } from '@jest/globals';
import type { SlackMessage } from '../slack/types.js';
import { SlackAPIError } from '../utils/errors.js';

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
  validateInput: jest.fn((schema, input) => input),
}));

// Mock the config
jest.mock('../config/index', () => ({
  CONFIG: {
    SLACK_BOT_TOKEN: 'xoxb-test-bot-token',
    SLACK_USER_TOKEN: 'xoxp-test-user-token',
    USE_USER_TOKEN_FOR_READ: true,
    ENABLE_RATE_LIMIT: true,
    RATE_LIMIT_RETRIES: 3,
    MAX_REQUEST_CONCURRENCY: 3,
    REJECT_RATE_LIMITED_CALLS: false,
    LOG_LEVEL: 'info',
  },
}));

// Mock the analysis functions
jest.mock('../slack/analysis/index.js', () => ({
  performQuickAnalysis: jest.fn(),
  performComprehensiveAnalysis: jest.fn(),
  formatThreadMetrics: jest.fn(),
}));

// Create a shared mock WebClient instance
const createMockWebClient = (): any => ({
  conversations: {
    history: jest.fn(),
    replies: jest.fn(),
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
import { createThreadService } from '../slack/services/threads/thread-service.js';
import { createInfrastructureServices } from '../slack/infrastructure/index.js';
import {
  performQuickAnalysis,
  performComprehensiveAnalysis,
  formatThreadMetrics,
} from '../slack/analysis/index.js';
import type { MCPTextContent, MCPToolResult } from '../mcp/types.js';

describe('Advanced Thread Features', () => {
  let threadService: any;
  let mockInfrastructure: any;

  // Helper function to parse MCP response content
  const parseResponse = (response: MCPToolResult) => {
    const textContent = response?.content?.[0] as MCPTextContent;
    if (textContent?.text) {
      try {
        return JSON.parse(textContent.text);
      } catch {
        return textContent.text;
      }
    }
    return response;
  };

  // Helper function to get error text from response
  const getErrorText = (response: MCPToolResult): string => {
    const textContent = response?.content?.[0] as MCPTextContent;
    return textContent?.text || '';
  };

  // Test data
  const testChannel = 'C1234567890';
  const testThreadTs = '1699564800.000100';
  const testUserId1 = 'U1234567890';
  const testUserId2 = 'U0987654321';

  const mockMessages: SlackMessage[] = [
    {
      type: 'message',
      user: testUserId1,
      text: 'This is an urgent issue that needs immediate attention!',
      ts: '1699564800.000100',
      reactions: [{ name: 'fire', count: 3, users: [testUserId1, testUserId2] }],
    },
    {
      type: 'message',
      user: testUserId2,
      text: 'I agree, lets prioritize this for the sprint.',
      ts: '1699564860.000200',
      reactions: [{ name: 'thumbsup', count: 1, users: [testUserId1] }],
    },
    {
      type: 'message',
      user: testUserId1,
      text: 'TODO: Update documentation and run tests',
      ts: '1699564920.000300',
    },
  ];

  // Mock participants for thread analysis - currently not used in these tests

  const mockUserInfo = {
    id: testUserId1,
    name: 'alice',
    real_name: 'Alice Smith',
    profile: {
      display_name: 'Alice',
      real_name: 'Alice Smith',
    },
  };

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
    });

    // Create thread service
    threadService = createThreadService(mockInfrastructure);

    // Setup default mock responses
    mockWebClientInstance.conversations.replies.mockResolvedValue({
      ok: true,
      messages: mockMessages,
    });

    mockWebClientInstance.conversations.history.mockResolvedValue({
      ok: true,
      messages: [
        {
          ts: '1699564800.000100',
          reply_count: 2,
          text: 'Thread parent message',
          user: testUserId1,
        },
        {
          ts: '1699565000.000100',
          reply_count: 3,
          text: 'Another thread parent',
          user: testUserId2,
        },
      ],
    });

    mockWebClientInstance.users.info.mockResolvedValue({
      ok: true,
      user: mockUserInfo,
    });

    mockWebClientInstance.search.all.mockResolvedValue({
      ok: true,
      messages: {
        matches: [
          {
            channel: { id: testChannel },
            ts: testThreadTs,
            thread_ts: testThreadTs,
            text: 'Search result message',
            user: testUserId1,
          },
        ],
      },
    });

    // Setup analysis mocks
    (performQuickAnalysis as jest.MockedFunction<typeof performQuickAnalysis>).mockReturnValue({
      urgencyLevel: 'high' as const,
      sentiment: {
        sentiment: 'neutral' as const,
        positiveCount: 1,
        negativeCount: 0,
        totalWords: 10,
      },
      topicCount: 3,
      actionItemCount: 1,
      duration: 120, // 2 minutes
    });

    (
      performComprehensiveAnalysis as jest.MockedFunction<typeof performComprehensiveAnalysis>
    ).mockReturnValue({
      timeline: {
        events: [
          {
            timestamp: '1699564800.000100',
            event_type: 'message' as const,
            user_id: testUserId1,
            content: 'Thread started',
            messageIndex: 0,
            timeSinceStart: 0,
          },
        ],
        totalDuration: 2,
        averageResponseTime: 1,
        messageVelocity: 1.5,
      },
      topics: {
        topics: ['urgent', 'sprint', 'documentation'],
        wordCounts: new Map([
          ['urgent', 2],
          ['sprint', 1],
        ]),
        hasJapaneseContent: false,
        hasEnglishContent: true,
      },
      sentiment: {
        sentiment: 'neutral' as const,
        positiveCount: 1,
        negativeCount: 0,
        totalWords: 10,
      },
      urgency: {
        score: 0.8,
        urgentKeywords: ['urgent', 'immediate'],
        messageCountFactor: 0.3,
      },
      importance: {
        score: 0.7,
        participantFactor: 0.4,
        messageFactor: 0.3,
        keywordFactor: 0.3,
        importantKeywords: ['critical', 'important'],
      },
      actionItems: {
        actionItems: [
          {
            text: 'Update documentation and run tests',
            mentioned_users: [],
            priority: 'medium' as const,
            status: 'open' as const,
            extracted_from_message_ts: '1699564920.000300',
          },
        ],
        totalActionIndicators: 1,
        actionIndicatorsFound: ['TODO'],
      },
      metadata: {
        messageCount: 3,
        participantCount: 2,
        hasMultilingualContent: false,
        analysisTimestamp: Date.now(),
      },
    });

    (formatThreadMetrics as jest.MockedFunction<typeof formatThreadMetrics>).mockReturnValue({
      content: 'Thread metrics analysis complete',
      lineCount: 10,
      characterCount: 200,
      includesEmojis: false,
    });
  });

  describe('getThreadMetrics', () => {
    it('should calculate basic thread metrics for a channel', async () => {
      const response = await threadService.getThreadMetrics({
        channel: testChannel,
        after: '2023-11-01',
        before: '2023-11-30',
      });

      expect(response).toBeDefined();
      const result = parseResponse(response);

      expect(result).toBeDefined();
      expect(result.summary).toBeDefined();
      expect(result.summary.totalThreads).toBe(2);
      expect(result.summary.averageReplies).toBe(2); // Based on actual calculation in implementation
      expect(result.summary.totalMessages).toBe(6); // Messages from replies fetched

      expect(mockWebClientInstance.conversations.history).toHaveBeenCalledWith({
        channel: testChannel,
        limit: 1000,
        oldest: expect.any(String),
        latest: expect.any(String),
      });
    });

    it('should include participant statistics when requested', async () => {
      // Mock a more detailed thread reply for participant analysis
      mockWebClientInstance.conversations.replies.mockResolvedValue({
        ok: true,
        messages: mockMessages,
      });

      const response = await threadService.getThreadMetrics({
        channel: testChannel,
        include_participant_stats: true,
      });

      const result = parseResponse(response);
      expect(result.topParticipants).toBeDefined();
      expect(Array.isArray(result.topParticipants)).toBe(true);
    });

    it('should include activity patterns when requested', async () => {
      const response = await threadService.getThreadMetrics({
        channel: testChannel,
        include_activity_patterns: true,
      });

      const result = parseResponse(response);
      expect(result.activityPatterns).toBeDefined();
      expect(Array.isArray(result.activityPatterns)).toBe(true);
    });

    it('should handle empty channel history', async () => {
      mockWebClientInstance.conversations.history.mockResolvedValue({
        ok: true,
        messages: [],
      });

      const response = await threadService.getThreadMetrics({
        channel: testChannel,
      });

      const result = parseResponse(response);
      expect(result.summary.totalThreads).toBe(0);
      expect(result.summary.averageReplies).toBe(0);
      expect(result.summary.totalMessages).toBe(0);
    });
  });

  describe('exportThread', () => {
    it('should export thread in markdown format by default', async () => {
      const response = await threadService.exportThread({
        channel: testChannel,
        thread_ts: testThreadTs,
      });

      const result = parseResponse(response);
      expect(result.format).toBe('markdown');
      expect(result.threadInfo).toBeDefined();
      expect(result.threadInfo.channel).toBe(testChannel);
      expect(result.threadInfo.threadTs).toBe(testThreadTs);
      expect(result.threadInfo.messageCount).toBe(3);
      expect(result.messages).toBeDefined();
      expect(result.messages.length).toBe(3);
    });

    it('should export thread in JSON format', async () => {
      const response = await threadService.exportThread({
        channel: testChannel,
        thread_ts: testThreadTs,
        format: 'json',
      });

      const result = parseResponse(response);
      expect(result.format).toBe('json');
      expect(result.messages).toBeDefined();
      expect(Array.isArray(result.messages)).toBe(true);
    });

    it('should include reactions when requested', async () => {
      const response = await threadService.exportThread({
        channel: testChannel,
        thread_ts: testThreadTs,
        include_reactions: true,
      });

      const result = parseResponse(response);
      expect(result.messages[0].reactions).toBeDefined();
      expect(result.messages[0].reactions).toEqual([
        { name: 'fire', count: 3, users: [testUserId1, testUserId2] },
      ]);
    });

    it('should exclude reactions when not requested', async () => {
      const response = await threadService.exportThread({
        channel: testChannel,
        thread_ts: testThreadTs,
        include_reactions: false,
      });

      const result = parseResponse(response);
      expect(result.messages[0].reactions).toBeUndefined();
    });

    it('should handle thread not found error', async () => {
      mockWebClientInstance.conversations.replies.mockResolvedValue({
        ok: true,
        messages: null,
      });

      const response = await threadService.exportThread({
        channel: testChannel,
        thread_ts: testThreadTs,
      });

      // Should return error response
      expect(response.isError).toBe(true);
      expect(getErrorText(response)).toContain('Thread not found');
    });
  });

  describe('findRelatedThreads', () => {
    beforeEach(() => {
      // Mock additional threads for comparison
      const relatedThreads = [
        {
          ts: '1699565000.000100',
          reply_count: 2,
          text: 'Another urgent task that needs attention',
          user: testUserId1,
        },
        {
          ts: '1699565100.000100',
          reply_count: 1,
          text: 'Meeting notes from yesterday',
          user: testUserId2,
        },
      ];

      mockWebClientInstance.conversations.history.mockResolvedValue({
        ok: true,
        messages: relatedThreads,
      });
    });

    it('should find related threads based on keyword overlap', async () => {
      // Mock replies for related threads
      mockWebClientInstance.conversations.replies
        .mockResolvedValueOnce({
          ok: true,
          messages: mockMessages,
        })
        .mockResolvedValueOnce({
          ok: true,
          messages: [
            {
              type: 'message',
              user: testUserId1,
              text: 'Another urgent task that needs immediate attention',
              ts: '1699565000.000100',
            },
          ],
        })
        .mockResolvedValueOnce({
          ok: true,
          messages: [
            {
              type: 'message',
              user: testUserId2,
              text: 'Meeting notes from yesterday',
              ts: '1699565100.000100',
            },
          ],
        });

      const response = await threadService.findRelatedThreads({
        channel: testChannel,
        thread_ts: testThreadTs,
        relationship_types: ['keyword_overlap'],
        similarity_threshold: 0.2,
      });

      const result = parseResponse(response);
      expect(result.relatedThreads).toBeDefined();
      expect(result.total).toBeGreaterThanOrEqual(0);
      expect(result.referenceThread).toBe(testThreadTs);
      expect(result.similarityThreshold).toBe(0.2);

      // Should have called conversations.replies for reference thread and comparison threads
      expect(mockWebClientInstance.conversations.replies).toHaveBeenCalledWith({
        channel: testChannel,
        ts: testThreadTs,
        limit: 1000,
      });
    });

    it('should handle thread not found error', async () => {
      mockWebClientInstance.conversations.replies.mockResolvedValue({
        ok: true,
        messages: null,
      });

      const response = await threadService.findRelatedThreads({
        channel: testChannel,
        thread_ts: testThreadTs,
      });

      // Should return error response
      expect(response.isError).toBe(true);
      expect(getErrorText(response)).toContain('Reference thread not found');
    });
  });

  describe('getThreadsByParticipants', () => {
    it('should find threads with any of the specified participants', async () => {
      const response = await threadService.getThreadsByParticipants({
        participants: [testUserId1, testUserId2],
        require_all_participants: false,
      });

      const result = parseResponse(response);
      expect(result.threads).toBeDefined();
      expect(result.total).toBeDefined();
      expect(result.searchedParticipants).toEqual([testUserId1, testUserId2]);
      expect(result.requireAllParticipants).toBe(false);

      expect(mockWebClientInstance.search.all).toHaveBeenCalledWith({
        query: expect.stringContaining('from:<@U1234567890>'),
        count: 20,
        sort: 'timestamp',
        sort_dir: 'desc',
      });
    });

    it('should find threads with all specified participants', async () => {
      const response = await threadService.getThreadsByParticipants({
        participants: [testUserId1, testUserId2],
        require_all_participants: true,
      });

      const result = parseResponse(response);
      expect(result.requireAllParticipants).toBe(true);
      expect(mockWebClientInstance.search.all).toHaveBeenCalledWith({
        query: expect.stringContaining('from:<@U1234567890>'),
        count: 20,
        sort: 'timestamp',
        sort_dir: 'desc',
      });
    });

    it('should filter by channel when provided', async () => {
      await threadService.getThreadsByParticipants({
        participants: [testUserId1],
        channel: testChannel,
      });

      expect(mockWebClientInstance.search.all).toHaveBeenCalledWith({
        query: expect.stringContaining(`in:<#${testChannel}>`),
        count: 20,
        sort: 'timestamp',
        sort_dir: 'desc',
      });
    });

    it('should apply date filters', async () => {
      await threadService.getThreadsByParticipants({
        participants: [testUserId1],
        after: '2023-11-01',
        before: '2023-11-30',
      });

      expect(mockWebClientInstance.search.all).toHaveBeenCalledWith({
        query: expect.stringMatching(/after:2023-11-01.*before:2023-11-30/),
        count: 20,
        sort: 'timestamp',
        sort_dir: 'desc',
      });
    });

    it('should respect limit parameter', async () => {
      await threadService.getThreadsByParticipants({
        participants: [testUserId1],
        limit: 50,
      });

      expect(mockWebClientInstance.search.all).toHaveBeenCalledWith({
        query: expect.any(String),
        count: 50,
        sort: 'timestamp',
        sort_dir: 'desc',
      });
    });

    it('should handle search results without matches', async () => {
      mockWebClientInstance.search.all.mockResolvedValue({
        ok: true,
        messages: null,
      });

      const response = await threadService.getThreadsByParticipants({
        participants: [testUserId1],
      });

      const result = parseResponse(response);
      expect(result.threads).toEqual([]);
      expect(result.total).toBe(0);
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle API errors gracefully in getThreadMetrics', async () => {
      mockWebClientInstance.conversations.history.mockRejectedValue(new Error('API Error'));

      const response = await threadService.getThreadMetrics({ channel: testChannel });

      // Should return error response, not throw
      expect(response.isError).toBe(true);
      expect(getErrorText(response)).toContain('Error: API Error');
    });

    it('should handle API errors gracefully in exportThread', async () => {
      mockWebClientInstance.conversations.replies.mockRejectedValue(new Error('API Error'));

      const response = await threadService.exportThread({
        channel: testChannel,
        thread_ts: testThreadTs,
      });

      // Should return error response, not throw
      expect(response.isError).toBe(true);
      expect(getErrorText(response)).toContain('Error: API Error');
    });

    it('should handle API errors gracefully in findRelatedThreads', async () => {
      mockWebClientInstance.conversations.replies.mockRejectedValue(new Error('API Error'));

      const response = await threadService.findRelatedThreads({
        channel: testChannel,
        thread_ts: testThreadTs,
      });

      // Should return error response, not throw
      expect(response.isError).toBe(true);
      expect(getErrorText(response)).toContain('Error: API Error');
    });

    it('should handle search API unavailable in getThreadsByParticipants', async () => {
      // Mock the checkSearchApiAvailability to throw
      const mockCheckSearchApi = jest.fn(() => {
        throw new SlackAPIError('Search API requires user token');
      });

      const infrastructureWithBadSearch = {
        ...mockInfrastructure,
        clientManager: {
          ...mockInfrastructure.clientManager,
          checkSearchApiAvailability: mockCheckSearchApi,
        },
      };

      const serviceWithBadSearch = createThreadService(infrastructureWithBadSearch);

      const response = await serviceWithBadSearch.getThreadsByParticipants({
        participants: [testUserId1],
      });

      // Should return error response, not throw
      expect(response.isError).toBe(true);
      expect(getErrorText(response)).toContain('Slack API Error: Search API requires user token');
    });

    it('should handle malformed search results', async () => {
      mockWebClientInstance.search.all.mockResolvedValue({
        ok: true,
        messages: {
          matches: [
            {
              // Missing required fields
              text: 'Malformed result',
            },
          ],
        },
      });

      const response = await threadService.getThreadsByParticipants({
        participants: [testUserId1],
      });

      const result = parseResponse(response);
      expect(result.threads).toEqual([]);
      expect(result.total).toBe(0);
    });

    it('should handle threads with no participants', async () => {
      mockWebClientInstance.conversations.replies.mockResolvedValue({
        ok: true,
        messages: [
          {
            type: 'message',
            text: 'System message with no user',
            ts: testThreadTs,
          },
        ],
      });

      const response = await threadService.exportThread({
        channel: testChannel,
        thread_ts: testThreadTs,
        include_user_profiles: true,
      });

      const result = parseResponse(response);
      expect(result.messages).toBeDefined();
      expect(result.userProfiles).toBeDefined();
    });
  });
});
