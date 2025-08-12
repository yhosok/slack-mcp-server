/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { describe, it, expect, jest, beforeEach } from '@jest/globals';

// Mock pagination helper for tests
jest.mock('../slack/infrastructure/pagination-helper.js', () => ({
  paginateSlackAPI: jest.fn(),
  collectAllPages: jest.fn(() => Promise.resolve({ items: [], pageCount: 1 })),
  processBatch: jest.fn(),
}));

import { SlackService } from '../slack/slack-service';
import { WebClient } from '@slack/web-api';
import { extractTextContent } from '../utils/helpers';

jest.mock('@slack/web-api', () => ({
  WebClient: jest.fn(),
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

// Mock the config module
jest.mock('../config/index', () => {
  const mockConfig = {
    SLACK_BOT_TOKEN: 'xoxb-test-token',
    SLACK_USER_TOKEN: 'xoxp-test-token',
    USE_USER_TOKEN_FOR_READ: true,
    LOG_LEVEL: 'info',
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

// Mock validation to pass through the input with defaults
jest.mock('../utils/validation', () => ({
  validateInput: jest.fn((schema, input) => {
    // Apply defaults for SearchMessages
    if (input && typeof input === 'object') {
      return {
        sort: 'score',
        sort_dir: 'desc',
        count: 20,
        page: 1,
        highlight: false,
        ...input,
      };
    }
    return input;
  }),
}));

describe('SlackService.searchMessages', () => {
  let slackService: SlackService;
  let mockBotClient: jest.Mocked<WebClient>;
  let mockUserClient: jest.Mocked<WebClient>;

  beforeEach(() => {
    jest.clearAllMocks();

    // Mock for bot client (second call)
    mockBotClient = {
      users: {
        info: jest.fn(),
      },
      auth: {
        test: jest.fn(),
      },
      on: jest.fn(),
      apiCall: jest.fn(),
    } as any; // eslint-disable-line @typescript-eslint/no-explicit-any

    // Mock for user client (first call)
    mockUserClient = {
      search: {
        messages: jest.fn(),
      },
      users: {
        info: jest.fn(),
      },
      auth: {
        test: jest.fn(),
      },
      on: jest.fn(),
      apiCall: jest.fn(),
    } as any; // eslint-disable-line @typescript-eslint/no-explicit-any

    // Mock WebClient constructor to return different instances
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (WebClient as any).mockImplementation((token: string) => {
      if (token === 'xoxp-test-token') {
        return mockUserClient;
      } else {
        return mockBotClient;
      }
    });

    slackService = new SlackService();
  });

  it('should search messages successfully', async () => {
    const mockSearchResult = {
      ok: true,
      messages: {
        total: 2,
        paging: {
          page: 1,
          pages: 1,
        },
        matches: [
          {
            user: 'U123456',
            text: 'Hello world',
            ts: '1234567890.123456',
            channel: { id: 'C123456', name: 'general' },
            permalink: 'https://slack.com/archives/C123456/p1234567890123456',
          },
          {
            user: 'U789012',
            text: 'Test message',
            ts: '1234567891.123456',
            channel: { id: 'C123456', name: 'general' },
            permalink: 'https://slack.com/archives/C123456/p1234567891123456',
          },
        ],
      },
    };

    mockUserClient.search.messages.mockResolvedValue(mockSearchResult);
    mockUserClient.users.info.mockImplementation((options: any) => {
      // eslint-disable-line @typescript-eslint/no-explicit-any
      if (options.user === 'U123456') {
        return Promise.resolve({
          ok: true,
          user: {
            profile: { display_name: 'John Doe' },
            real_name: 'John Doe',
            name: 'john',
          },
        });
      } else if (options.user === 'U789012') {
        return Promise.resolve({
          ok: true,
          user: {
            profile: { display_name: 'Jane Smith' },
            real_name: 'Jane Smith',
            name: 'jane',
          },
        });
      }
      return Promise.resolve({ ok: false, error: 'user_not_found' });
    });

    const result = await slackService.searchMessages({
      query: 'hello',
      sort: 'timestamp',
      sort_dir: 'desc',
      count: 20,
      page: 1,
      highlight: false,
    });

    expect(mockUserClient.search.messages).toHaveBeenCalledWith({
      query: 'hello',
      sort: 'timestamp',
      sort_dir: 'desc',
      count: 20,
      page: 1,
      highlight: false,
    });

    const content = JSON.parse(extractTextContent(result.content[0]) || '{}');
    expect(content.query).toBe('hello');
    expect(content.total).toBe(2);
    expect(content.matches).toHaveLength(2);
    expect(content.matches[0].user).toBe('John Doe');
  });

  it('should handle search with minimal parameters', async () => {
    const mockSearchResult = {
      ok: true,
      messages: {
        total: 0,
        paging: {
          page: 1,
          pages: 1,
        },
        matches: [],
      },
    };

    mockUserClient.search.messages.mockResolvedValue(mockSearchResult);

    const result = await slackService.searchMessages({
      query: 'nonexistent',
    });

    expect(mockUserClient.search.messages).toHaveBeenCalledWith({
      query: 'nonexistent',
      sort: 'score',
      sort_dir: 'desc',
      count: 20,
      page: 1,
      highlight: false,
    });

    const content = JSON.parse(extractTextContent(result.content[0]) || '{}');
    expect(content.query).toBe('nonexistent');
    expect(content.total).toBe(0);
    expect(content.matches).toHaveLength(0);
  });

  it('should handle API errors', async () => {
    mockUserClient.search.messages.mockResolvedValue({
      ok: false,
      error: 'rate_limited',
    });

    const result = await slackService.searchMessages({ query: 'test' });

    // When API returns error without messages, it should return empty results
    const content = JSON.parse(extractTextContent(result.content[0]) || '{}');
    expect(content.query).toBe('test');
    expect(content.total).toBe(0);
    expect(content.matches).toEqual([]);
  });

  it('should handle network errors', async () => {
    mockUserClient.search.messages.mockRejectedValue(new Error('Network error'));

    const result = await slackService.searchMessages({ query: 'test' });

    expect(result.isError).toBe(true);
    expect(extractTextContent(result.content?.[0])).toContain('Network error');
  });

  it('should validate required parameters', async () => {
    const result = await slackService.searchMessages({});

    expect(result.isError).toBe(true);
    expect(extractTextContent(result.content?.[0])).toContain('Error');
  });

  it('should handle search with special operators', async () => {
    const mockSearchResult = {
      ok: true,
      messages: {
        total: 1,
        paging: {
          page: 1,
          pages: 1,
        },
        matches: [
          {
            user: 'U123456',
            text: 'Portal team daily report',
            ts: '1234567890.123456',
            channel: { id: 'C3BVD6FPB', name: 'dev-portal' },
            permalink: 'https://slack.com/archives/C3BVD6FPB/p1234567890123456',
          },
        ],
      },
    };

    mockUserClient.search.messages.mockResolvedValue(mockSearchResult);
    mockBotClient.users.info.mockResolvedValue({
      ok: true,
      user: { profile: { display_name: 'Alice' } },
    });

    const result = await slackService.searchMessages({
      query: '日報 in:dev-portal after:2024-12-01',
      count: 50,
    });

    expect(mockUserClient.search.messages).toHaveBeenCalledWith({
      query: '日報 in:dev-portal after:2024-12-01',
      sort: 'score',
      sort_dir: 'desc',
      count: 50,
      page: 1,
      highlight: false,
    });

    const content = JSON.parse(extractTextContent(result.content[0]) || '{}');
    expect(content.matches[0].channel.name).toBe('dev-portal');
  });
});

// Note: Additional test for missing SLACK_USER_TOKEN would require more complex mock setup
// The error handling is tested in the main service implementation
