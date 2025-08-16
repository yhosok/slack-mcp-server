/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { describe, it, expect, jest, beforeEach } from '@jest/globals';
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

// Mock validation to pass through the input
jest.mock('../utils/validation', () => ({
  validateInput: jest.fn((schema, input) => input),
}));

describe('SlackService.getChannelInfo', () => {
  let slackService: SlackService;
  let mockWebClient: jest.Mocked<WebClient>;

  beforeEach(() => {
    jest.clearAllMocks();
    mockWebClient = {
      conversations: {
        info: jest.fn(),
      },
      auth: {
        test: jest.fn(),
      },
      on: jest.fn(),
      apiCall: jest.fn(),
    } as any; // eslint-disable-line @typescript-eslint/no-explicit-any

    (WebClient as any).mockImplementation(() => mockWebClient); // eslint-disable-line @typescript-eslint/no-explicit-any
    slackService = new SlackService();
  });

  it('should get channel info successfully', async () => {
    const mockChannelInfo = {
      ok: true,
      channel: {
        id: 'C1234567890',
        name: 'general',
        is_channel: true,
        is_group: false,
        is_im: false,
        is_mpim: false,
        is_private: false,
        is_archived: false,
        is_general: true,
        created: 1234567890,
        creator: 'U1234567890',
        name_normalized: 'general',
        is_shared: false,
        is_org_shared: false,
        is_member: true,
        topic: {
          value: 'Company-wide announcements and work-based matters',
          creator: 'U1234567890',
          last_set: 1234567890,
        },
        purpose: {
          value: 'This channel is for workspace-wide communication and announcements.',
          creator: 'U1234567890',
          last_set: 1234567890,
        },
        num_members: 179,
      },
    };

    mockWebClient.conversations.info.mockResolvedValue(mockChannelInfo);

    const result = await slackService.getChannelInfo({
      channel: 'C1234567890',
    });

    expect(mockWebClient.conversations.info).toHaveBeenCalledWith({
      channel: 'C1234567890',
    });

    // Parse TypeSafeAPI JSON response
    const content = JSON.parse(extractTextContent(result.content[0]) || '{}');
    expect(content.statusCode).toBe('10000');
    expect(content.message).toBe('Channel information retrieved successfully');
    expect(content.data.id).toBe('C1234567890');
    expect(content.data.name).toBe('general');
    expect(content.data.isChannel).toBe(true);
    expect(content.data.memberCount).toBe(179);
    expect(content.data.topic).toEqual({
      value: 'Company-wide announcements and work-based matters',
      creator: 'U1234567890',
      last_set: 1234567890,
    });
  });

  it('should handle private channel info', async () => {
    const mockPrivateChannel = {
      ok: true,
      channel: {
        id: 'G1234567890',
        name: 'private-team',
        is_channel: false,
        is_group: true,
        is_im: false,
        is_mpim: false,
        is_private: true,
        is_archived: false,
        is_general: false,
        created: 1234567890,
        creator: 'U1234567890',
        name_normalized: 'private-team',
        is_shared: false,
        is_org_shared: false,
        is_member: true,
        topic: {
          value: 'Private team discussions',
          creator: 'U1234567890',
          last_set: 1234567890,
        },
        purpose: {
          value: 'For internal team discussions',
          creator: 'U1234567890',
          last_set: 1234567890,
        },
        num_members: 5,
      },
    };

    mockWebClient.conversations.info.mockResolvedValue(mockPrivateChannel);

    const result = await slackService.getChannelInfo({
      channel: 'G1234567890',
    });

    // Parse TypeSafeAPI JSON response
    const content = JSON.parse(extractTextContent(result.content[0]) || '{}');
    expect(content.statusCode).toBe('10000');
    expect(content.message).toBe('Channel information retrieved successfully');
    expect(content.data.id).toBe('G1234567890');
    expect(content.data.name).toBe('private-team');
    expect(content.data.isPrivate).toBe(true);
    expect(content.data.isGroup).toBe(true);
    expect(content.data.memberCount).toBe(5);
  });

  it('should handle archived channel', async () => {
    const mockArchivedChannel = {
      ok: true,
      channel: {
        id: 'C0987654321',
        name: 'old-project',
        is_channel: true,
        is_group: false,
        is_im: false,
        is_mpim: false,
        is_private: false,
        is_archived: true,
        is_general: false,
        created: 1234567890,
        creator: 'U1234567890',
        name_normalized: 'old-project',
        is_shared: false,
        is_org_shared: false,
        is_member: false,
        topic: {
          value: 'Archived project channel',
          creator: 'U1234567890',
          last_set: 1234567890,
        },
        purpose: {
          value: 'This channel has been archived',
          creator: 'U1234567890',
          last_set: 1234567890,
        },
        num_members: 0,
      },
    };

    mockWebClient.conversations.info.mockResolvedValue(mockArchivedChannel);

    const result = await slackService.getChannelInfo({
      channel: 'C0987654321',
    });

    // Parse TypeSafeAPI JSON response
    const content = JSON.parse(extractTextContent(result.content[0]) || '{}');
    expect(content.statusCode).toBe('10000');
    expect(content.message).toBe('Channel information retrieved successfully');
    expect(content.data.isArchived).toBe(true);
    expect(content.data.memberCount).toBe(0);
  });

  it('should handle channel not found error', async () => {
    mockWebClient.conversations.info.mockResolvedValue({
      ok: false,
      error: 'channel_not_found',
    });

    const result = await slackService.getChannelInfo({ channel: 'C999999999' });

    expect(result.isError).toBe(true);
    // Parse TypeSafeAPI JSON error response
    const content = JSON.parse(extractTextContent(result.content[0]) || '{}');
    expect(content.statusCode).toBe('10001');
    expect(content.message).toBe('Requested channel does not exist');
    expect(content.error).toBe('Channel not found');
  });

  it('should handle missing channel in response', async () => {
    mockWebClient.conversations.info.mockResolvedValue({
      ok: true,
      // channel is missing
    });

    const result = await slackService.getChannelInfo({ channel: 'C1234567890' });

    expect(result.isError).toBe(true);
    expect(extractTextContent(result.content[0])).toContain('Channel not found');
  });

  it('should handle API errors', async () => {
    mockWebClient.conversations.info.mockResolvedValue({
      ok: false,
      error: 'missing_scope',
    });

    const result = await slackService.getChannelInfo({ channel: 'C1234567890' });

    expect(result.isError).toBe(true);
    // Parse TypeSafeAPI JSON error response
    const content = JSON.parse(extractTextContent(result.content[0]) || '{}');
    expect(content.statusCode).toBe('10001');
    expect(content.message).toBe('Requested channel does not exist');
    expect(content.error).toBe('Channel not found');
  });

  it('should handle network errors', async () => {
    mockWebClient.conversations.info.mockRejectedValue(new Error('Network error'));

    const result = await slackService.getChannelInfo({ channel: 'C1234567890' });

    expect(result.isError).toBe(true);
    expect(extractTextContent(result.content[0])).toContain('Error: Network error');
  });

  it('should validate required parameters', async () => {
    const result1 = await slackService.getChannelInfo({});
    expect(result1.isError).toBe(true);
    expect(extractTextContent(result1.content[0])).toContain('Cannot read properties of undefined');

    const result2 = await slackService.getChannelInfo({ channel: '' });
    expect(result2.isError).toBe(true);
    expect(extractTextContent(result2.content[0])).toContain('Error');
  });

  it('should handle direct message channel', async () => {
    const mockDMChannel = {
      ok: true,
      channel: {
        id: 'D1234567890',
        is_channel: false,
        is_group: false,
        is_im: true,
        is_mpim: false,
        is_private: true,
        is_archived: false,
        is_general: false,
        created: 1234567890,
        is_shared: false,
        is_org_shared: false,
        is_member: true,
      },
    };

    mockWebClient.conversations.info.mockResolvedValue(mockDMChannel);

    const result = await slackService.getChannelInfo({
      channel: 'D1234567890',
    });

    // Parse TypeSafeAPI JSON response
    const content = JSON.parse(extractTextContent(result.content[0]) || '{}');
    expect(content.statusCode).toBe('10000');
    expect(content.message).toBe('Channel information retrieved successfully');
    expect(content.data.id).toBe('D1234567890');
    expect(content.data.isChannel).toBe(false);
    expect(content.data.isPrivate).toBe(true);
  });
});
