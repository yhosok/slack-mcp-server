/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { jest } from '@jest/globals';
import { createReactionService } from '../slack/services/reactions/reaction-service.js';
import { SlackAPIError } from '../utils/errors.js';

// Create a shared mock WebClient instance with all reaction operations
const createMockWebClient = (): any => ({
  reactions: {
    add: jest.fn(),
    remove: jest.fn(),
    get: jest.fn(),
    list: jest.fn(),
  },
  conversations: {
    history: jest.fn(),
    list: jest.fn(),
    info: jest.fn(),
  },
  users: {
    info: jest.fn(),
  },
  search: {
    messages: jest.fn(),
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

// Mock the config with both bot and user tokens for comprehensive testing
jest.mock('../config/index', () => {
  const mockConfig = {
    SLACK_BOT_TOKEN: 'xoxb-test-token',
    SLACK_USER_TOKEN: 'xoxp-test-token',
    USE_USER_TOKEN_FOR_READ: true,
    ENABLE_RATE_LIMIT_RETRY: true,
    RATE_LIMIT_RETRIES: 3,
    MAX_REQUEST_CONCURRENCY: 3,
    REJECT_RATE_LIMITED_CALLS: false,
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

// Mock validation to use actual validation but allow jest to spy on it
jest.mock('../utils/validation', () => {
  const originalModule = jest.requireActual('../utils/validation') as any;
  return {
    ...originalModule,
    validateInput: jest.fn((schema: any, input: any) => {
      return originalModule.validateInput(schema, input);
    }),
  };
});

describe('ReactionService - Reaction Operations', () => {
  let reactionService: any;

  beforeEach(() => {
    // Clear all mocks before each test
    jest.clearAllMocks();

    // Reset the mock WebClient instance
    mockWebClientInstance = createMockWebClient();

    // Create mock infrastructure with simple structure
    const mockInfrastructure = {
      clientManager: {
        getBotClient: () => mockWebClientInstance,
        getUserClient: () => mockWebClientInstance,
        getClientForOperation: () => mockWebClientInstance,
        checkSearchApiAvailability: jest.fn(),
      },
      rateLimitService: {
        getMetrics: () => ({
          totalRequests: 0,
          rateLimitedRequests: 0,
          retryAttempts: 0,
          lastRateLimitTime: null,
          rateLimitsByTier: {},
        }),
      },
      userService: {
        getUserInfo: jest.fn(() =>
          Promise.resolve({
            id: 'U1234567890',
            name: 'testuser',
            real_name: 'Test User',
            displayName: 'Test User',
          })
        ),
        getDisplayName: jest.fn(() => Promise.resolve('Test User')),
        bulkGetDisplayNames: jest.fn(),
        clearCache: jest.fn(),
      },
      requestHandler: {
        handle: jest.fn().mockImplementation(async (schema: any, args: any, operation: any) => {
          const result = await operation(args);
          return {
            content: [
              {
                type: 'text' as const,
                text: JSON.stringify(result, null, 2),
              },
            ],
          };
        }) as any,
        handleWithCustomFormat: jest
          .fn()
          .mockImplementation(async (schema: any, args: any, operation: any) => {
            return await operation(args);
          }) as any,
      },
    } as any;

    // Create the reaction service
    reactionService = createReactionService(mockInfrastructure);
  });

  describe('addReaction', () => {
    const validArgs = {
      channel: 'C1234567890',
      message_ts: '1234567890.123456',
      reaction_name: 'thumbsup',
    };

    it('should add a reaction successfully', async () => {
      // Arrange
      const mockResult = { ok: true };
      mockWebClientInstance.reactions.add.mockResolvedValue(mockResult);

      // Act
      const result = await reactionService.addReaction(validArgs);

      // Assert
      expect(mockWebClientInstance.reactions.add).toHaveBeenCalledWith({
        channel: 'C1234567890',
        timestamp: '1234567890.123456',
        name: 'thumbsup',
      });

      expect(result.content).toBeDefined();
      expect(result.content[0].text).toContain('Reaction :thumbsup: added successfully');
      expect(result.content[0].text).toContain('1234567890.123456');
    });

    it('should handle reaction addition failure', async () => {
      // Arrange
      const mockResult = { ok: false };
      mockWebClientInstance.reactions.add.mockResolvedValue(mockResult);

      // Act
      const result = await reactionService.addReaction(validArgs);

      // Assert
      expect(result.content[0].text).toContain('Failed to add reaction :thumbsup:');
      expect(result.content[0].text).toContain('1234567890.123456');
    });

    it('should handle invalid reaction name', async () => {
      // Arrange
      const invalidArgs = { ...validArgs, reaction_name: 'invalid:emoji' };
      mockWebClientInstance.reactions.add.mockRejectedValue(new Error('invalid_name'));

      // Act & Assert
      await expect(reactionService.addReaction(invalidArgs)).rejects.toThrow('invalid_name');
    });

    it('should handle already reacted error', async () => {
      // Arrange
      mockWebClientInstance.reactions.add.mockRejectedValue(new Error('already_reacted'));

      // Act & Assert
      await expect(reactionService.addReaction(validArgs)).rejects.toThrow('already_reacted');
    });

    it('should handle message not found error', async () => {
      // Arrange
      mockWebClientInstance.reactions.add.mockRejectedValue(new Error('message_not_found'));

      // Act & Assert
      await expect(reactionService.addReaction(validArgs)).rejects.toThrow('message_not_found');
    });

    it('should validate required parameters', async () => {
      // Act & Assert - missing channel
      await expect(
        reactionService.addReaction({
          message_ts: '1234567890.123456',
          reaction_name: 'thumbsup',
        })
      ).rejects.toThrow();

      // Act & Assert - missing message_ts
      await expect(
        reactionService.addReaction({
          channel: 'C1234567890',
          reaction_name: 'thumbsup',
        })
      ).rejects.toThrow();

      // Act & Assert - missing reaction_name
      await expect(
        reactionService.addReaction({
          channel: 'C1234567890',
          message_ts: '1234567890.123456',
        })
      ).rejects.toThrow();
    });
  });

  describe('removeReaction', () => {
    const validArgs = {
      channel: 'C1234567890',
      message_ts: '1234567890.123456',
      reaction_name: 'thumbsup',
    };

    it('should remove a reaction successfully', async () => {
      // Arrange
      const mockResult = { ok: true };
      mockWebClientInstance.reactions.remove.mockResolvedValue(mockResult);

      // Act
      const result = await reactionService.removeReaction(validArgs);

      // Assert
      expect(mockWebClientInstance.reactions.remove).toHaveBeenCalledWith({
        channel: 'C1234567890',
        timestamp: '1234567890.123456',
        name: 'thumbsup',
      });

      expect(result.content[0].text).toContain('"success": true');
      expect(result.content[0].text).toContain('"reaction": "thumbsup"');
      expect(result.content[0].text).toContain('Reaction removed successfully');
    });

    it('should handle reaction removal failure', async () => {
      // Arrange
      const mockResult = { ok: false };
      mockWebClientInstance.reactions.remove.mockResolvedValue(mockResult);

      // Act
      const result = await reactionService.removeReaction(validArgs);

      // Assert
      expect(result.content[0].text).toContain('"success": false');
      expect(result.content[0].text).toContain('Failed to remove reaction');
    });

    it('should handle no reaction error', async () => {
      // Arrange
      mockWebClientInstance.reactions.remove.mockRejectedValue(new Error('no_reaction'));

      // Act & Assert
      await expect(reactionService.removeReaction(validArgs)).rejects.toThrow('no_reaction');
    });

    it('should handle permission denied error', async () => {
      // Arrange
      mockWebClientInstance.reactions.remove.mockRejectedValue(new Error('not_allowed'));

      // Act & Assert
      await expect(reactionService.removeReaction(validArgs)).rejects.toThrow('not_allowed');
    });
  });

  describe('getReactions', () => {
    const validArgs = {
      channel: 'C1234567890',
      message_ts: '1234567890.123456',
      full: false,
    };

    it('should get reactions without full user details', async () => {
      // Arrange
      const mockMessage = {
        reactions: [
          {
            name: 'thumbsup',
            count: 2,
            users: ['U1234567890', 'U1234567891'],
          },
          {
            name: 'heart',
            count: 1,
            users: ['U1234567890'],
          },
        ],
      };
      mockWebClientInstance.reactions.get.mockResolvedValue({ ok: true, message: mockMessage });

      // Act
      const result = await reactionService.getReactions(validArgs);

      // Assert
      expect(mockWebClientInstance.reactions.get).toHaveBeenCalledWith({
        channel: 'C1234567890',
        timestamp: '1234567890.123456',
        full: false,
      });

      const response = JSON.parse(result.content[0].text);
      expect(response.reactions).toHaveLength(2);
      expect(response.reactions[0].name).toBe('thumbsup');
      expect(response.reactions[0].count).toBe(2);
      expect(response.reactions[0].users).toEqual(['U1234567890', 'U1234567891']);
      expect(response.totalReactions).toBe(3);
    });

    it('should get reactions with full user details', async () => {
      // Arrange
      const argsWithFull = { ...validArgs, full: true };
      const mockMessage = {
        reactions: [
          {
            name: 'thumbsup',
            count: 1,
            users: ['U1234567890'],
          },
        ],
      };
      mockWebClientInstance.reactions.get.mockResolvedValue({ ok: true, message: mockMessage });

      // Act
      const result = await reactionService.getReactions(argsWithFull);

      // Assert
      expect(mockWebClientInstance.reactions.get).toHaveBeenCalledWith({
        channel: 'C1234567890',
        timestamp: '1234567890.123456',
        full: true,
      });

      const response = JSON.parse(result.content[0].text);
      expect(response.reactions[0].users).toEqual(['Test User']); // From mocked userService
    });

    it('should handle message with no reactions', async () => {
      // Arrange
      const mockMessage = { reactions: [] };
      mockWebClientInstance.reactions.get.mockResolvedValue({ ok: true, message: mockMessage });

      // Act
      const result = await reactionService.getReactions(validArgs);

      // Assert
      const response = JSON.parse(result.content[0].text);
      expect(response.reactions).toEqual([]);
      expect(response.totalReactions).toBe(0);
    });

    it('should handle message not found', async () => {
      // Arrange
      mockWebClientInstance.reactions.get.mockResolvedValue({ ok: true, message: undefined });

      // Act & Assert
      await expect(reactionService.getReactions(validArgs)).rejects.toThrow(SlackAPIError);
      await expect(reactionService.getReactions(validArgs)).rejects.toThrow(
        'Message not found or no reactions'
      );
    });
  });

  describe('getReactionStatistics', () => {
    const validArgs = {
      days_back: 7,
      include_trends: true,
      top_count: 5,
    };

    it('should get workspace-wide reaction statistics', async () => {
      // Arrange
      const mockChannels = [
        { id: 'C1234567890', name: 'general' },
        { id: 'C1234567891', name: 'random' },
      ];
      const mockMessagesChannel1 = [
        {
          type: 'message',
          user: 'U1234567890',
          text: 'Hello world',
          ts: '1234567890',
          reactions: [
            { name: 'thumbsup', count: 2, users: ['U1', 'U2'] },
            { name: 'heart', count: 1, users: ['U1'] },
          ],
        },
      ];
      const mockMessagesChannel2 = [
        {
          type: 'message',
          user: 'U1234567891',
          text: 'Great job!',
          ts: '1234567891',
          reactions: [
            { name: 'thumbsup', count: 1, users: ['U2'] },
            { name: 'fire', count: 3, users: ['U1', 'U2', 'U3'] },
          ],
        },
      ];

      mockWebClientInstance.conversations.list.mockResolvedValue({
        ok: true,
        channels: mockChannels,
      });
      // Mock different responses for each channel
      mockWebClientInstance.conversations.history
        .mockResolvedValueOnce({ ok: true, messages: mockMessagesChannel1 })
        .mockResolvedValueOnce({ ok: true, messages: mockMessagesChannel2 });

      // Act
      const result = await reactionService.getReactionStatistics(validArgs);

      // Assert
      expect(mockWebClientInstance.conversations.list).toHaveBeenCalledWith({
        exclude_archived: true,
        limit: 100,
      });

      const response = JSON.parse(result.content[0].text);
      expect(response.summary.totalMessages).toBe(2);
      expect(response.summary.messagesWithReactions).toBe(2);
      expect(response.summary.totalReactions).toBe(7); // 2+1+1+3
      expect(response.summary.uniqueReactions).toBe(3); // thumbsup, heart, fire
      expect(response.topReactions).toBeDefined();
      expect(response.topReactors).toBeDefined();
      expect(response.dailyTrends).toBeDefined();
    });

    it('should get channel-specific reaction statistics', async () => {
      // Arrange
      const argsWithChannel = { ...validArgs, channel: 'C1234567890' };
      const mockMessages = [
        {
          type: 'message',
          user: 'U1234567890',
          text: 'Test message',
          ts: '1234567890',
          reactions: [{ name: 'thumbsup', count: 1, users: ['U1'] }],
        },
      ];

      mockWebClientInstance.conversations.history.mockResolvedValue({
        ok: true,
        messages: mockMessages,
      });

      // Act
      const result = await reactionService.getReactionStatistics(argsWithChannel);

      // Assert
      expect(mockWebClientInstance.conversations.history).toHaveBeenCalledWith({
        channel: 'C1234567890',
        oldest: expect.any(String),
        limit: 1000,
      });

      const response = JSON.parse(result.content[0].text);
      expect(response.summary.totalMessages).toBe(1);
      expect(response.summary.messagesWithReactions).toBe(1);
      expect(response.analysisperiod.channel).toBe('C1234567890');
    });

    it('should handle empty message list', async () => {
      // Arrange
      mockWebClientInstance.conversations.list.mockResolvedValue({
        ok: true,
        channels: [],
      });

      // Act
      const result = await reactionService.getReactionStatistics(validArgs);

      // Assert
      const response = JSON.parse(result.content[0].text);
      expect(response.summary.totalMessages).toBe(0);
      expect(response.summary.messagesWithReactions).toBe(0);
      expect(response.summary.totalReactions).toBe(0);
    });
  });

  describe('findMessagesByReactions', () => {
    const validArgs = {
      reactions: ['thumbsup', 'heart'],
      match_type: 'any' as const,
      min_reaction_count: 1,
      limit: 10,
    };

    it('should find messages with any of the specified reactions', async () => {
      // Arrange
      const mockMessages = [
        {
          type: 'message',
          user: 'U1234567890',
          text: 'Message with thumbsup',
          ts: '1234567890.123456',
          reactions: [{ name: 'thumbsup', count: 2, users: ['U1', 'U2'] }],
        },
        {
          type: 'message',
          user: 'U1234567891',
          text: 'Message with heart',
          ts: '1234567891.123456',
          reactions: [{ name: 'heart', count: 1, users: ['U1'] }],
        },
        {
          type: 'message',
          user: 'U1234567892',
          text: 'Message with different reaction',
          ts: '1234567892.123456',
          reactions: [{ name: 'fire', count: 1, users: ['U1'] }],
        },
      ];

      mockWebClientInstance.conversations.history.mockResolvedValue({
        ok: true,
        messages: mockMessages,
      });

      // Act
      const result = await reactionService.findMessagesByReactions({
        ...validArgs,
        channel: 'C1234567890',
      });

      // Assert
      expect(mockWebClientInstance.conversations.history).toHaveBeenCalledWith({
        channel: 'C1234567890',
        limit: 1000,
        oldest: undefined,
        latest: undefined,
      });

      const response = JSON.parse(result.content[0].text);
      expect(response.messages).toHaveLength(2); // Only messages with thumbsup or heart
      expect(response.total).toBe(2);
      expect(response.criteria.reactions).toEqual(['thumbsup', 'heart']);
      expect(response.criteria.matchType).toBe('any');
    });

    it('should find messages with all specified reactions', async () => {
      // Arrange
      const argsWithAll = { ...validArgs, match_type: 'all' as const };
      const mockMessages = [
        {
          type: 'message',
          user: 'U1234567890',
          text: 'Message with both reactions',
          ts: '1234567890.123456',
          reactions: [
            { name: 'thumbsup', count: 1, users: ['U1'] },
            { name: 'heart', count: 1, users: ['U2'] },
          ],
        },
        {
          type: 'message',
          user: 'U1234567891',
          text: 'Message with only one reaction',
          ts: '1234567891.123456',
          reactions: [{ name: 'thumbsup', count: 1, users: ['U1'] }],
        },
      ];

      mockWebClientInstance.conversations.history.mockResolvedValue({
        ok: true,
        messages: mockMessages,
      });

      // Act
      const result = await reactionService.findMessagesByReactions({
        ...argsWithAll,
        channel: 'C1234567890',
      });

      // Assert
      const response = JSON.parse(result.content[0].text);
      expect(response.messages).toHaveLength(1); // Only message with both reactions
      expect(response.criteria.matchType).toBe('all');
    });

    it('should filter by minimum reaction count', async () => {
      // Arrange
      const argsWithMinCount = { ...validArgs, min_reaction_count: 3 };
      const mockMessages = [
        {
          type: 'message',
          user: 'U1',
          text: 'Popular message',
          ts: '1234567890.123456',
          reactions: [{ name: 'thumbsup', count: 3, users: ['U1', 'U2', 'U3'] }],
        },
        {
          type: 'message',
          user: 'U2',
          text: 'Less popular message',
          ts: '1234567891.123456',
          reactions: [{ name: 'thumbsup', count: 1, users: ['U1'] }],
        },
      ];

      mockWebClientInstance.conversations.history.mockResolvedValue({
        ok: true,
        messages: mockMessages,
      });

      // Act
      const result = await reactionService.findMessagesByReactions({
        ...argsWithMinCount,
        channel: 'C1234567890',
      });

      // Assert
      const response = JSON.parse(result.content[0].text);
      expect(response.messages).toHaveLength(1); // Only message with 3+ total reactions
      expect(response.criteria.minReactionCount).toBe(3);
    });

    it('should handle messages with no reactions', async () => {
      // Arrange
      const mockMessages = [
        {
          type: 'message',
          user: 'U1',
          text: 'Message with no reactions',
          ts: '1234567890.123456',
          reactions: undefined,
        },
        {
          type: 'message',
          user: 'U2',
          text: 'Message with empty reactions',
          ts: '1234567891.123456',
          reactions: [],
        },
      ];

      mockWebClientInstance.conversations.history.mockResolvedValue({
        ok: true,
        messages: mockMessages,
      });

      // Act
      const result = await reactionService.findMessagesByReactions({
        ...validArgs,
        channel: 'C1234567890',
      });

      // Assert
      const response = JSON.parse(result.content[0].text);
      expect(response.messages).toHaveLength(0);
    });

    it('should validate required reactions parameter', async () => {
      // Act & Assert
      await expect(
        reactionService.findMessagesByReactions({
          match_type: 'any',
        })
      ).rejects.toThrow();
    });

    it('should handle empty reactions array', async () => {
      // Act & Assert
      await expect(
        reactionService.findMessagesByReactions({
          reactions: [],
          match_type: 'any',
        })
      ).rejects.toThrow();
    });
  });
});
