/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { describe, it, expect, beforeEach, jest } from '@jest/globals';

// Mock WebClient
const createMockWebClient = (): any => ({
  chat: {
    postMessage: jest.fn(() => Promise.resolve({ ok: true, ts: '1234567890.123456' })),
  },
  conversations: {
    list: jest.fn(() =>
      Promise.resolve({
        ok: true,
        channels: [{ id: 'C123', name: 'general', is_member: true, is_archived: false }],
      })
    ),
  },
  users: {
    info: jest.fn(() =>
      Promise.resolve({
        ok: true,
        user: { id: 'U123', name: 'testuser', real_name: 'Test User' },
      })
    ),
  },
  on: jest.fn(),
});

let mockWebClientInstance = createMockWebClient();

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
}));

// Mock config
jest.mock('../config/index', () => {
  const mockConfig = {
    SLACK_BOT_TOKEN: 'xoxb-test-token',
    SLACK_USER_TOKEN: 'xoxp-test-token',
    USE_USER_TOKEN_FOR_READ: false,
    LOG_LEVEL: 'error',
    MCP_SERVER_NAME: 'test-server',
    MCP_SERVER_VERSION: '1.0.0',
    PORT: 3000,
  };
  return {
    CONFIG: mockConfig,
    getConfig: () => mockConfig,
    loadConfig: () => mockConfig,
  };
});

// Mock logger
jest.mock('../utils/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  },
}));

describe('SlackService Method Availability', () => {
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    // Save original env
    originalEnv = { ...process.env };
    // Clear module cache to ensure fresh config
    jest.resetModules();
    jest.clearAllMocks();
    mockWebClientInstance = createMockWebClient();
  });

  afterEach(() => {
    // Restore original env
    process.env = originalEnv;
  });

  it('should have SlackService available with all methods', async () => {
    process.env.SLACK_BOT_TOKEN = 'xoxb-test-token';

    const { SlackService } = await import('../slack/slack-service');
    const service = new SlackService();

    // Check that service is created (basic smoke test)
    expect(service).toBeDefined();
    expect(typeof service.sendMessage).toBe('function');
    expect(typeof service.listChannels).toBe('function');
    expect(typeof service.getUserInfo).toBe('function');
  });

  it('should have all 36 methods available', async () => {
    const expectedMethods = [
      'sendMessage',
      'listChannels',
      'getChannelHistory',
      'getUserInfo',
      'searchMessages',
      'getChannelInfo',
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
      'uploadFile',
      'listFiles',
      'getFileInfo',
      'deleteFile',
      'shareFile',
      'analyzeFiles',
      'searchFiles',
      'addReaction',
      'removeReaction',
      'getReactions',
      'getReactionStatistics',
      'findMessagesByReactions',
      'getWorkspaceInfo',
      'listTeamMembers',
      'getWorkspaceActivity',
      'getServerHealth',
    ];

    process.env.SLACK_BOT_TOKEN = 'xoxb-test-token';

    const { SlackService } = await import('../slack/slack-service');
    const service = new SlackService();

    for (const method of expectedMethods) {
      expect(typeof (service as any)[method]).toBe('function');
    }

    expect(expectedMethods).toHaveLength(36);
  });

  it('should be able to call methods successfully', async () => {
    process.env.SLACK_BOT_TOKEN = 'xoxb-test-token';

    const { SlackService } = await import('../slack/slack-service');
    const service = new SlackService();

    // Test a few core methods work
    const messageResult = await service.sendMessage({
      channel: 'C123456',
      text: 'Test message',
    });
    expect(messageResult).toBeDefined();
    expect(messageResult.content).toBeDefined();

    const channelsResult = await service.listChannels({
      exclude_archived: true,
    });
    expect(channelsResult).toBeDefined();
    expect(channelsResult.content).toBeDefined();

    const userResult = await service.getUserInfo({
      user: 'U123456',
    });
    expect(userResult).toBeDefined();
    expect(userResult.content).toBeDefined();
  });
});
