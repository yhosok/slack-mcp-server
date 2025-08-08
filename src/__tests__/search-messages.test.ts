import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { SlackService } from '../slack/slack-service.js';
import { WebClient } from '@slack/web-api';

jest.mock('@slack/web-api');

// Mock the config module
const mockConfig = {
  SLACK_BOT_TOKEN: 'xoxb-test-token',
  SLACK_USER_TOKEN: 'xoxp-test-token',
  LOG_LEVEL: 'info',
};

jest.unstable_mockModule('../config/index.js', () => ({
  CONFIG: mockConfig,
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
    } as any;
    
    // Mock for user client (first call)
    mockUserClient = {
      search: {
        messages: jest.fn(),
      },
      users: {
        info: jest.fn(),
      },
    } as any;
    
    // Mock WebClient constructor to return different instances
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

    const mockUserInfo = {
      ok: true,
      user: {
        profile: { display_name: 'John Doe' },
        real_name: 'John Doe',
        name: 'john',
      },
    };

    mockUserClient.search.messages.mockResolvedValue(mockSearchResult);
    mockBotClient.users.info.mockResolvedValue(mockUserInfo);

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

    const content = JSON.parse(result.content[0]?.text || '{}');
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

    const content = JSON.parse(result.content[0]?.text || '{}');
    expect(content.query).toBe('nonexistent');
    expect(content.total).toBe(0);
    expect(content.matches).toHaveLength(0);
  });

  it('should handle API errors', async () => {
    mockUserClient.search.messages.mockResolvedValue({
      ok: false,
      error: 'rate_limited',
    });

    await expect(
      slackService.searchMessages({ query: 'test' })
    ).rejects.toThrow('Failed to search messages: rate_limited');
  });

  it('should handle network errors', async () => {
    mockUserClient.search.messages.mockRejectedValue(new Error('Network error'));

    await expect(
      slackService.searchMessages({ query: 'test' })
    ).rejects.toThrow('Failed to search messages: Network error');
  });

  it('should validate required parameters', async () => {
    await expect(
      slackService.searchMessages({})
    ).rejects.toThrow();
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

    const content = JSON.parse(result.content[0]?.text || '{}');
    expect(content.matches[0].channel.name).toBe('dev-portal');
  });
});

// Note: Additional test for missing SLACK_USER_TOKEN would require more complex mock setup
// The error handling is tested in the main service implementation