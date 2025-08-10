/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { SlackService } from '../slack/slack-service';
import { WebClient } from '@slack/web-api';

jest.mock('@slack/web-api');

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
      include_locale: true,
      include_num_members: true,
    });

    const content = JSON.parse(result.content[0]?.text || '{}');
    expect(content.id).toBe('C1234567890');
    expect(content.name).toBe('general');
    expect(content.is_general).toBe(true);
    expect(content.num_members).toBe(179);
    expect(content.topic).toEqual({
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

    const content = JSON.parse(result.content[0]?.text || '{}');
    expect(content.id).toBe('G1234567890');
    expect(content.name).toBe('private-team');
    expect(content.is_private).toBe(true);
    expect(content.is_group).toBe(true);
    expect(content.num_members).toBe(5);
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

    const content = JSON.parse(result.content[0]?.text || '{}');
    expect(content.is_archived).toBe(true);
    expect(content.is_member).toBe(false);
  });

  it('should handle channel not found error', async () => {
    mockWebClient.conversations.info.mockResolvedValue({
      ok: false,
      error: 'channel_not_found',
    });

    await expect(
      slackService.getChannelInfo({ channel: 'C999999999' })
    ).rejects.toThrow('Failed to get channel info: channel_not_found');
  });

  it('should handle missing channel in response', async () => {
    mockWebClient.conversations.info.mockResolvedValue({
      ok: true,
      // channel is missing
    });

    await expect(
      slackService.getChannelInfo({ channel: 'C1234567890' })
    ).rejects.toThrow('Channel not found');
  });

  it('should handle API errors', async () => {
    mockWebClient.conversations.info.mockResolvedValue({
      ok: false,
      error: 'missing_scope',
    });

    await expect(
      slackService.getChannelInfo({ channel: 'C1234567890' })
    ).rejects.toThrow('Failed to get channel info: missing_scope');
  });

  it('should handle network errors', async () => {
    mockWebClient.conversations.info.mockRejectedValue(new Error('Network error'));

    await expect(
      slackService.getChannelInfo({ channel: 'C1234567890' })
    ).rejects.toThrow('Failed to get channel info: Error: Network error');
  });

  it('should validate required parameters', async () => {
    await expect(
      slackService.getChannelInfo({})
    ).rejects.toThrow();

    await expect(
      slackService.getChannelInfo({ channel: '' })
    ).rejects.toThrow();
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

    const content = JSON.parse(result.content[0]?.text || '{}');
    expect(content.is_im).toBe(true);
    expect(content.is_private).toBe(true);
  });
});