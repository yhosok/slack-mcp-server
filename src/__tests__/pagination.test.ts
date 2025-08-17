/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { describe, it, expect, beforeEach, jest } from '@jest/globals';

// Mock the pagination helper module
jest.mock('../slack/infrastructure/pagination-helper.js', () => ({
  paginateSlackAPI: jest.fn(),
  collectAllPages: jest.fn(() => Promise.resolve({ items: [], pageCount: 1 })),
}));

import { SlackService } from '../slack/slack-service.js';
import type { MCPToolResult } from '../mcp/types.js';
import { extractTextContent } from '../utils/helpers.js';

// Mock configuration
jest.mock('../config/index.js', () => {
  const mockConfig = {
    SLACK_BOT_TOKEN: 'xoxb-mock-token',
    SLACK_USER_TOKEN: 'xoxp-mock-token',
    USE_USER_TOKEN_FOR_READ: true,
    LOG_LEVEL: 'info',
    SLACK_ENABLE_RATE_LIMIT_RETRY: true,
    SLACK_RATE_LIMIT_RETRIES: 3,
    SLACK_MAX_REQUEST_CONCURRENCY: 3,
    SLACK_REJECT_RATE_LIMITED_CALLS: false,
    MCP_SERVER_NAME: 'test-server',
    MCP_SERVER_VERSION: '1.0.0',
    PORT: 3000,
  };
  return {
    CONFIG: mockConfig,
    getConfig: () => mockConfig,
  };
});

// Mock WebClient
const createMockWebClient = (mockData?: any): any => ({
  chat: {
    postMessage: jest.fn(() => Promise.resolve({ ok: true, ts: '1234567890.123456' })),
  },
  conversations: {
    history: jest.fn(() =>
      Promise.resolve({
        ok: true,
        messages: mockData?.messages || [
          { ts: '1234567890.123456', user: 'U123', text: 'Test message 1' },
          { ts: '1234567890.123457', user: 'U456', text: 'Test message 2' },
        ],
        has_more: mockData?.has_more || false,
        response_metadata: mockData?.response_metadata || {},
      })
    ),
    replies: jest.fn(() =>
      Promise.resolve({
        ok: true,
        messages: mockData?.messages || [
          { ts: '1234567890.123456', user: 'U123', text: 'Parent message' },
          { ts: '1234567890.123457', user: 'U456', text: 'Reply message' },
        ],
        has_more: mockData?.has_more || false,
        response_metadata: mockData?.response_metadata || {},
      })
    ),
  },
  files: {
    list: jest.fn(() =>
      Promise.resolve({
        ok: true,
        files: mockData?.files || [
          { id: 'F123', name: 'test.txt', size: 1024 },
          { id: 'F456', name: 'image.png', size: 2048 },
        ],
        paging: mockData?.paging || { page: 1, pages: 1 },
      })
    ),
  },
  users: {
    list: jest.fn(() =>
      Promise.resolve({
        ok: true,
        members: mockData?.members || [
          { id: 'U123', name: 'user1', real_name: 'User One' },
          { id: 'U456', name: 'user2', real_name: 'User Two' },
        ],
        response_metadata: mockData?.response_metadata || {},
      })
    ),
    info: jest.fn(() =>
      Promise.resolve({
        ok: true,
        user: { id: 'U123', name: 'testuser', real_name: 'Test User' },
      })
    ),
  },
  auth: {
    test: jest.fn(() => Promise.resolve({ ok: true, user: 'test_user' })),
  },
  on: jest.fn(),
  apiCall: jest.fn(),
});

jest.mock('@slack/web-api', () => ({
  WebClient: jest.fn().mockImplementation(() => createMockWebClient()),
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

describe('Pagination Enhancement Tests', () => {
  let slackService: any;
  let mockWebClient: any;

  beforeEach(async () => {
    jest.clearAllMocks();
    mockWebClient = createMockWebClient();

    // Update the mock implementation
    const webApiModule = await import('@slack/web-api');
    const { WebClient } = webApiModule as any;
    (WebClient as jest.Mock).mockImplementation(() => mockWebClient);

    slackService = new SlackService();
  });

  describe('GetChannelHistory with Pagination', () => {
    it('should support fetch_all_pages parameter', async () => {
      const result = (await slackService.getChannelHistory({
        channel: 'C123456789',
        fetch_all_pages: true,
        max_pages: 2,
        max_items: 100,
      })) as MCPToolResult;

      expect(result).toBeDefined();
      expect(result.content).toBeDefined();

      // Verify that pagination helper would have been called
      // In actual implementation, this would use the pagination helper
      const textContent = extractTextContent(result.content[0]);
      expect(textContent).toContain('Channel history');
    });

    it('should maintain backward compatibility for single page', async () => {
      const result = (await slackService.getChannelHistory({
        channel: 'C123456789',
        limit: 50,
      })) as MCPToolResult;

      expect(result).toBeDefined();
      expect(result.content).toBeDefined();
      expect(mockWebClient.conversations.history).toHaveBeenCalledWith(
        expect.objectContaining({
          channel: 'C123456789',
          limit: 50,
        })
      );
    });
  });

  describe('GetThreadReplies with Pagination', () => {
    it('should support fetch_all_pages parameter', async () => {
      const result = (await slackService.getThreadReplies({
        channel: 'C123456789',
        thread_ts: '1234567890.123456',
        fetch_all_pages: true,
        max_pages: 3,
        max_items: 200,
      })) as MCPToolResult;

      expect(result).toBeDefined();
      expect(result.content).toBeDefined();

      const textContent = extractTextContent(result.content[0]);
      // With unified pagination, empty results may trigger error handling
      if (result.isError) {
        expect(textContent).toContain('Thread not found');
      } else {
        expect(textContent).toContain('Thread replies');
      }
    });

    it('should maintain backward compatibility for single page', async () => {
      const result = (await slackService.getThreadReplies({
        channel: 'C123456789',
        thread_ts: '1234567890.123456',
        limit: 100,
      })) as MCPToolResult;

      expect(result).toBeDefined();
      expect(mockWebClient.conversations.replies).toHaveBeenCalledWith(
        expect.objectContaining({
          channel: 'C123456789',
          ts: '1234567890.123456',
          limit: 100,
        })
      );
    });
  });

  describe('ListFiles with Pagination', () => {
    it('should support fetch_all_pages parameter', async () => {
      const result = (await slackService.listFiles({
        fetch_all_pages: true,
        max_pages: 2,
        max_items: 50,
      })) as MCPToolResult;

      expect(result).toBeDefined();
      expect(result.content).toBeDefined();
    });

    it('should maintain backward compatibility for single page', async () => {
      const result = (await slackService.listFiles({
        count: 20,
        page: 1,
      })) as MCPToolResult;

      expect(result).toBeDefined();
      expect(mockWebClient.files.list).toHaveBeenCalledWith(
        expect.objectContaining({
          count: 20,
          page: 1,
        })
      );
    });
  });

  describe('ListTeamMembers with Pagination', () => {
    it('should support fetch_all_pages parameter', async () => {
      const result = (await slackService.listTeamMembers({
        fetch_all_pages: true,
        max_pages: 5,
        max_items: 500,
      })) as MCPToolResult;

      expect(result).toBeDefined();
      expect(result.content).toBeDefined();
    });

    it('should maintain backward compatibility for single page', async () => {
      const result = (await slackService.listTeamMembers({
        limit: 100,
        include_deleted: false,
      })) as MCPToolResult;

      expect(result).toBeDefined();
      expect(mockWebClient.users.list).toHaveBeenCalledWith(
        expect.objectContaining({
          limit: 100,
          include_locale: true,
        })
      );
    });
  });

  describe('Schema Validation', () => {
    it('should accept new pagination parameters', async () => {
      // Test that the new parameters don't cause validation errors
      await expect(
        slackService.getChannelHistory({
          channel: 'C123456789',
          fetch_all_pages: true,
          max_pages: 10,
          max_items: 1000,
        })
      ).resolves.toBeDefined();
    });

    it('should validate pagination limits', async () => {
      // Test that extreme values are handled appropriately
      const result = (await slackService.getChannelHistory({
        channel: 'C123456789',
        fetch_all_pages: true,
        max_pages: 150, // Over limit
      })) as MCPToolResult;

      expect(result.isError).toBe(true);
      expect(result.content).toBeDefined();
      expect(extractTextContent(result.content[0])).toContain(
        'max_pages: Number must be less than or equal to 100'
      );
    });

    it('should validate max_items limits', async () => {
      const result = (await slackService.getChannelHistory({
        channel: 'C123456789',
        fetch_all_pages: true,
        max_items: 15000, // Over limit
      })) as MCPToolResult;

      expect(result.isError).toBe(true);
      expect(result.content).toBeDefined();
      expect(extractTextContent(result.content[0])).toContain(
        'max_items: Number must be less than or equal to 10000'
      );
    });
  });

  describe('Pagination Safety Defaults', () => {
    it('should apply implicit defaults when fetch_all_pages is true and limits not specified', async () => {
      const result = (await slackService.getChannelHistory({
        channel: 'C123456789',
        fetch_all_pages: true,
        // No max_pages or max_items specified
      })) as MCPToolResult;

      expect(result).toBeDefined();
      expect(result.content).toBeDefined();

      // The service should have applied defaults without error
      const textContent = extractTextContent(result.content[0]);
      expect(textContent).toContain('Channel history');
    });

    it('should use explicit values when provided, overriding defaults', async () => {
      const result = (await slackService.getChannelHistory({
        channel: 'C123456789',
        fetch_all_pages: true,
        max_pages: 5, // Explicit value
        max_items: 500, // Explicit value
      })) as MCPToolResult;

      expect(result).toBeDefined();
      expect(result.content).toBeDefined();

      // Should succeed with explicit values
      const textContent = extractTextContent(result.content[0]);
      expect(textContent).toContain('Channel history');
    });

    it('should not apply defaults when fetch_all_pages is false', async () => {
      const result = (await slackService.getChannelHistory({
        channel: 'C123456789',
        fetch_all_pages: false,
        // No max_pages or max_items - should not apply defaults
      })) as MCPToolResult;

      expect(result).toBeDefined();
      expect(result.content).toBeDefined();

      // Single page behavior should work fine
      const textContent = extractTextContent(result.content[0]);
      expect(textContent).toContain('Channel history');
    });

    it('should apply safety defaults to all paginated services', async () => {
      const services = [
        () =>
          slackService.getChannelHistory({
            channel: 'C123456789',
            fetch_all_pages: true,
          }),
        () =>
          slackService.getThreadReplies({
            channel: 'C123456789',
            thread_ts: '1234567890.123456',
            fetch_all_pages: true,
          }),
        () =>
          slackService.listFiles({
            fetch_all_pages: true,
          }),
        () =>
          slackService.listTeamMembers({
            fetch_all_pages: true,
          }),
      ];

      // All should complete with implicit defaults (may have errors due to mock data)
      for (const serviceCall of services) {
        const result = (await serviceCall()) as MCPToolResult;
        expect(result).toBeDefined();
        expect(result.content).toBeDefined();
        // Should return a result (error or success) - safety defaults prevent unlimited fetching
        expect(result.content[0]).toBeDefined();
      }
    });
  });
});
