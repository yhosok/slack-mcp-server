/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { jest } from '@jest/globals';
import { SlackService } from '../slack/slack-service';
import { SlackAPIError } from '../utils/errors';

// Create a shared mock WebClient instance
const createMockWebClient = (): any => ({
  // eslint-disable-line @typescript-eslint/no-explicit-any
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
  },
  search: {
    messages: jest.fn(),
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
  const originalModule = jest.requireActual('../utils/validation') as any; // eslint-disable-line @typescript-eslint/no-explicit-any
  return {
    ...originalModule,
    validateInput: jest.fn((schema: any, input: any) => {
      // eslint-disable-line @typescript-eslint/no-explicit-any
      return originalModule.validateInput(schema, input);
    }),
  };
});

describe('SlackService', () => {
  let slackService: SlackService;

  beforeEach(() => {
    // Clear all mocks before each test
    jest.clearAllMocks();

    // Reset the mock WebClient instance
    mockWebClientInstance = createMockWebClient();

    slackService = new SlackService();
  });

  describe('sendMessage', () => {
    it('should send a message successfully', async () => {
      // Arrange
      const mockResult = { ok: true, ts: '1234567890.123456' };
      mockWebClientInstance.chat.postMessage.mockResolvedValue(mockResult);

      const args = {
        channel: 'C1234567890',
        text: 'Hello, world!',
      };

      // Act
      const result = await slackService.sendMessage(args);

      // Assert
      expect(mockWebClientInstance.chat.postMessage).toHaveBeenCalledWith({
        channel: 'C1234567890',
        text: 'Hello, world!',
        thread_ts: undefined,
      });

      expect(result).toEqual({
        content: [
          {
            type: 'text',
            text: 'Message sent successfully to C1234567890. Timestamp: 1234567890.123456',
          },
        ],
      });
    });

    it('should throw SlackAPIError when Slack API returns error', async () => {
      // Arrange
      const mockResult = { ok: false, error: 'channel_not_found' };
      mockWebClientInstance.chat.postMessage.mockResolvedValue(mockResult);

      const args = {
        channel: 'C1234567890',
        text: 'Hello, world!',
      };

      // Act & Assert
      await expect(slackService.sendMessage(args)).rejects.toThrow(SlackAPIError);
    });

    it('should validate input parameters', async () => {
      // Arrange
      const args = {
        channel: '',
        text: 'Hello, world!',
      };

      // Act & Assert
      await expect(slackService.sendMessage(args)).rejects.toThrow('Validation failed');
    });
  });

  describe('listChannels', () => {
    it('should list channels successfully', async () => {
      // Arrange
      const mockChannels = [
        {
          id: 'C1234567890',
          name: 'general',
          is_channel: true,
          is_group: false,
          is_im: false,
          is_private: false,
          num_members: 10,
        },
        {
          id: 'C0987654321',
          name: 'random',
          is_channel: true,
          is_group: false,
          is_im: false,
          is_private: false,
          num_members: 5,
        },
      ];

      const mockResult = { ok: true, channels: mockChannels };
      mockWebClientInstance.conversations.list.mockResolvedValue(mockResult);

      const args = {};

      // Act
      const result = await slackService.listChannels(args);

      // Assert
      expect(mockWebClientInstance.conversations.list).toHaveBeenCalledWith({
        types: 'public_channel,private_channel',
        exclude_archived: true,
      });

      expect(result.content[0]?.text).toContain('Found 2 channels');
      expect(result.content[0]?.text).toContain('general (C1234567890)');
      expect(result.content[0]?.text).toContain('random (C0987654321)');
    });
  });

  describe('getChannelHistory', () => {
    it('should get channel history successfully', async () => {
      // Arrange
      const mockMessages = [
        {
          user: 'U1234567890',
          text: 'Hello!',
          ts: '1234567890.123456',
        },
        {
          user: 'U0987654321',
          text: 'Hi there!',
          ts: '1234567891.123456',
        },
      ];

      const mockResult = { ok: true, messages: mockMessages };
      mockWebClientInstance.conversations.history.mockResolvedValue(mockResult);

      const args = {
        channel: 'C1234567890',
        limit: 10,
      };

      // Act
      const result = await slackService.getChannelHistory(args);

      // Assert
      expect(mockWebClientInstance.conversations.history).toHaveBeenCalledWith({
        channel: 'C1234567890',
        limit: 10,
      });

      expect(result.content[0]?.text).toContain('Channel history (2 messages)');
      expect(result.content[0]?.text).toContain('U1234567890: Hello!');
      expect(result.content[0]?.text).toContain('U0987654321: Hi there!');
    });
  });

  describe('getUserInfo', () => {
    it('should get user info successfully', async () => {
      // Arrange
      const mockUser = {
        id: 'U1234567890',
        name: 'john.doe',
        real_name: 'John Doe',
        profile: {
          display_name: 'Johnny',
          email: 'john@example.com',
        },
        is_bot: false,
        is_admin: false,
        is_owner: false,
        tz: 'America/New_York',
      };

      const mockResult = { ok: true, user: mockUser };
      mockWebClientInstance.users.info.mockResolvedValue(mockResult);

      const args = {
        user: 'U1234567890',
      };

      // Act
      const result = await slackService.getUserInfo(args);

      // Assert
      expect(mockWebClientInstance.users.info).toHaveBeenCalledWith({
        user: 'U1234567890',
      });

      expect(result.content[0]?.text).toContain('User Information:');
      expect(result.content[0]?.text).toContain('ID: U1234567890');
      expect(result.content[0]?.text).toContain('Name: john.doe');
      expect(result.content[0]?.text).toContain('Real Name: John Doe');
    });
  });

  // ================================
  // THREAD MANAGEMENT TESTS
  // ================================

  describe('Thread Detection and Retrieval', () => {
    describe('findThreadsInChannel', () => {
      it('should find threads in channel successfully', async () => {
        // Arrange
        const mockMessages = [
          {
            ts: '1234567890.123456',
            thread_ts: '1234567890.123456',
            reply_count: 3,
            text: 'This is a threaded message',
            user: 'U1234567890',
          },
          {
            ts: '1234567891.123456',
            text: 'This is not threaded',
            user: 'U0987654321',
          },
        ];

        const mockReplies = [
          {
            ts: '1234567890.123456',
            text: 'Parent message',
            user: 'U1234567890',
          },
          {
            ts: '1234567890.234567',
            text: 'Reply 1',
            user: 'U0987654321',
          },
          {
            ts: '1234567890.345678',
            text: 'Reply 2',
            user: 'U1111111111',
          },
        ];

        mockWebClientInstance.conversations.history.mockResolvedValue({
          ok: true,
          messages: mockMessages,
        });

        mockWebClientInstance.conversations.replies.mockResolvedValue({
          ok: true,
          messages: mockReplies,
        });

        const args = {
          channel: 'C1234567890',
          limit: 50,
        };

        // Act
        const result = await slackService.findThreadsInChannel(args);

        // Assert
        expect(mockWebClientInstance.conversations.history).toHaveBeenCalledWith({
          channel: 'C1234567890',
          limit: 50,
          cursor: undefined,
          oldest: undefined,
          latest: undefined,
          include_all_metadata: false,
        });

        expect(result.content[0]?.text).toContain('Found 1 threads');
        expect(result.content[0]?.text).toContain('Thread 1234567890.123456');
      });
    });

    describe('getThreadReplies', () => {
      it('should get thread replies successfully', async () => {
        // Arrange
        const mockMessages = [
          {
            ts: '1234567890.123456',
            text: 'Parent message',
            user: 'U1234567890',
          },
          {
            ts: '1234567890.234567',
            text: 'Reply 1',
            user: 'U0987654321',
          },
          {
            ts: '1234567890.345678',
            text: 'Reply 2',
            user: 'U1111111111',
          },
        ];

        mockWebClientInstance.conversations.replies.mockResolvedValue({
          ok: true,
          messages: mockMessages,
        });

        const args = {
          channel: 'C1234567890',
          thread_ts: '1234567890.123456',
          limit: 100,
        };

        // Act
        const result = await slackService.getThreadReplies(args);

        // Assert
        expect(mockWebClientInstance.conversations.replies).toHaveBeenCalledWith({
          channel: 'C1234567890',
          ts: '1234567890.123456',
          limit: 100,
          cursor: undefined,
          oldest: undefined,
          latest: undefined,
          inclusive: true,
        });

        expect(result.content[0]?.text).toContain('Thread 1234567890.123456');
        expect(result.content[0]?.text).toContain('2 replies from 2 users');
        expect(result.content[0]?.text).toContain('🧵');
        expect(result.content[0]?.text).toContain('Parent message');
      });
    });

    describe('searchThreads', () => {
      it('should search threads successfully', async () => {
        // Arrange
        const mockSearchResults = {
          ok: true,
          messages: {
            matches: [
              {
                ts: '1234567890.123456',
                thread_ts: '1234567890.123456',
                text: 'Matching thread message',
                channel: { id: 'C1234567890' },
                score: 0.95,
              },
            ],
          },
        };

        const mockThreadReplies = [
          {
            ts: '1234567890.123456',
            text: 'Parent message with keyword',
            user: 'U1234567890',
          },
          {
            ts: '1234567890.234567',
            text: 'Reply with keyword',
            user: 'U0987654321',
          },
        ];

        mockWebClientInstance.search.messages.mockResolvedValue(mockSearchResults);
        mockWebClientInstance.conversations.replies.mockResolvedValue({
          ok: true,
          messages: mockThreadReplies,
        });

        const args = {
          query: 'keyword',
          limit: 20,
        };

        // Act
        const result = await slackService.searchThreads(args);

        // Assert
        expect(mockWebClientInstance.search.messages).toHaveBeenCalledWith({
          query: 'keyword',
          sort: 'score', // searchThreads converts 'relevance' to 'score' for Slack API
          sort_dir: 'desc',
          count: 20,
        });

        expect(result.content[0]?.text).toContain('Found 1 threads matching "keyword"');
      });
    });
  });

  describe('Thread Analysis', () => {
    describe('analyzeThread', () => {
      it('should analyze thread successfully', async () => {
        // Arrange
        const mockMessages = [
          {
            ts: '1234567890.123456',
            text: 'This is urgent and needs immediate attention',
            user: 'U1234567890',
          },
          {
            ts: '1234567890.234567',
            text: 'I agree, this is important',
            user: 'U0987654321',
          },
        ];

        mockWebClientInstance.conversations.replies.mockResolvedValue({
          ok: true,
          messages: mockMessages,
        });

        const args = {
          channel: 'C1234567890',
          thread_ts: '1234567890.123456',
          include_sentiment_analysis: true,
          include_action_items: true,
          include_timeline: true,
          extract_topics: true,
        };

        // Act
        const result = await slackService.analyzeThread(args);

        // Assert
        expect(result.content[0]?.text).toContain('Thread Analysis: 1234567890.123456');
        expect(result.content[0]?.text).toContain('Participants: 2');
        expect(result.content[0]?.text).toContain('Messages: 2');
        expect(result.content[0]?.text).toContain('Importance:');
        expect(result.content[0]?.text).toContain('Urgency:');
      });
    });

    describe('summarizeThread', () => {
      it('should summarize thread successfully', async () => {
        // Arrange
        const mockMessages = [
          {
            ts: '1234567890.123456',
            text: 'We need to decide on the project timeline',
            user: 'U1234567890',
          },
          {
            ts: '1234567890.234567',
            text: 'I think we should launch next month',
            user: 'U0987654321',
          },
          {
            ts: '1234567890.345678',
            text: 'Agreed, lets finalize the plan',
            user: 'U1111111111',
          },
        ];

        mockWebClientInstance.conversations.replies.mockResolvedValue({
          ok: true,
          messages: mockMessages,
        });

        const args = {
          channel: 'C1234567890',
          thread_ts: '1234567890.123456',
          summary_length: 'detailed',
        };

        // Act
        const result = await slackService.summarizeThread(args);

        // Assert
        expect(result.content[0]?.text).toContain('Thread Summary:');
        expect(result.content[0]?.text).toContain('Status:');
        expect(result.content[0]?.text).toContain('Participants: 3');
        expect(result.content[0]?.text).toContain('Messages: 3');
      });
    });

    describe('extractActionItems', () => {
      it('should extract action items successfully', async () => {
        // Arrange
        const mockMessages = [
          {
            ts: '1234567890.123456',
            text: 'We need to create the documentation',
            user: 'U1234567890',
          },
          {
            ts: '1234567890.234567',
            text: 'Action item: <@U0987654321> will handle the testing',
            user: 'U1111111111',
          },
          {
            ts: '1234567890.345678',
            text: 'TODO: finalize the deployment plan',
            user: 'U1234567890',
          },
        ];

        mockWebClientInstance.conversations.replies.mockResolvedValue({
          ok: true,
          messages: mockMessages,
        });

        const args = {
          channel: 'C1234567890',
          thread_ts: '1234567890.123456',
          include_completed: false,
          priority_threshold: 'low',
        };

        // Act
        const result = await slackService.extractActionItems(args);

        // Assert
        expect(result.content[0]?.text).toContain('Action Items from Thread');
        expect(result.content[0]?.text).toContain('Priority:');
        expect(result.content[0]?.text).toContain('Status:');
      });
    });

    describe('identifyImportantThreads', () => {
      it('should identify important threads successfully', async () => {
        // Arrange
        const mockMessages = [
          {
            ts: '1234567890.123456',
            thread_ts: '1234567890.123456',
            reply_count: 10,
            text: 'Critical issue needs immediate attention',
            user: 'U1234567890',
          },
        ];

        const mockThreadReplies = Array.from({ length: 11 }, (_, i) => ({
          ts: `1234567890.${123456 + i}`,
          text: `Message ${i + 1} with critical keywords`,
          user: i % 2 === 0 ? 'U1234567890' : 'U0987654321',
        }));

        mockWebClientInstance.conversations.history.mockResolvedValue({
          ok: true,
          messages: mockMessages,
        });

        mockWebClientInstance.conversations.replies.mockResolvedValue({
          ok: true,
          messages: mockThreadReplies,
        });

        const args = {
          channel: 'C1234567890',
          time_range_hours: 24,
          importance_threshold: 0.5,
          limit: 10,
        };

        // Act
        const result = await slackService.identifyImportantThreads(args);

        // Assert
        expect(result.content[0]?.text).toContain('Important threads found');
      });
    });
  });

  describe('Thread Management', () => {
    describe('postThreadReply', () => {
      it('should post thread reply successfully', async () => {
        // Arrange
        const mockResult = { ok: true, ts: '1234567890.456789' };
        mockWebClientInstance.chat.postMessage.mockResolvedValue(mockResult);

        const args = {
          channel: 'C1234567890',
          thread_ts: '1234567890.123456',
          text: 'This is a reply to the thread',
          reply_broadcast: false,
        };

        // Act
        const result = await slackService.postThreadReply(args);

        // Assert
        expect(mockWebClientInstance.chat.postMessage).toHaveBeenCalledWith({
          channel: 'C1234567890',
          text: 'This is a reply to the thread',
          thread_ts: '1234567890.123456',
          reply_broadcast: false,
        });

        expect(result.content[0]?.text).toContain('Reply posted successfully to thread');
        expect(result.content[0]?.text).toContain('1234567890.456789');
      });
    });

    describe('createThread', () => {
      it('should create thread successfully', async () => {
        // Arrange
        const mockParentResult = { ok: true, ts: '1234567890.123456' };
        const mockReplyResult = { ok: true, ts: '1234567890.234567' };

        mockWebClientInstance.chat.postMessage
          .mockResolvedValueOnce(mockParentResult)
          .mockResolvedValueOnce(mockReplyResult);

        const args = {
          channel: 'C1234567890',
          text: 'Starting a new discussion',
          reply_text: 'This is the first reply',
          broadcast: false,
        };

        // Act
        const result = await slackService.createThread(args);

        // Assert
        expect(mockWebClientInstance.chat.postMessage).toHaveBeenCalledTimes(2);
        expect(result.content[0]?.text).toContain('Thread created successfully');
        expect(result.content[0]?.text).toContain('Parent message: 1234567890.123456');
        expect(result.content[0]?.text).toContain('Reply: 1234567890.234567');
      });

      it('should create thread without reply', async () => {
        // Arrange
        const mockParentResult = { ok: true, ts: '1234567890.123456' };
        mockWebClientInstance.chat.postMessage.mockResolvedValue(mockParentResult);

        const args = {
          channel: 'C1234567890',
          text: 'Starting a new discussion',
        };

        // Act
        const result = await slackService.createThread(args);

        // Assert
        expect(mockWebClientInstance.chat.postMessage).toHaveBeenCalledTimes(1);
        expect(result.content[0]?.text).toContain('Thread created successfully');
        expect(result.content[0]?.text).toContain('Parent message: 1234567890.123456');
        expect(result.content[0]?.text).not.toContain('Reply:');
      });
    });

    describe('markThreadImportant', () => {
      it('should mark thread as important successfully', async () => {
        // Arrange
        const mockReactionResult = { ok: true };
        const mockMessageResult = { ok: true, ts: '1234567890.456789' };

        mockWebClientInstance.reactions.add.mockResolvedValue(mockReactionResult);
        mockWebClientInstance.chat.postMessage.mockResolvedValue(mockMessageResult);

        const args = {
          channel: 'C1234567890',
          thread_ts: '1234567890.123456',
          importance_level: 'high',
          reason: 'Critical for project completion',
          notify_participants: true,
        };

        // Act
        const result = await slackService.markThreadImportant(args);

        // Assert
        expect(mockWebClientInstance.reactions.add).toHaveBeenCalledWith({
          channel: 'C1234567890',
          timestamp: '1234567890.123456',
          name: 'exclamation',
        });

        expect(mockWebClientInstance.chat.postMessage).toHaveBeenCalledWith({
          channel: 'C1234567890',
          text: '📌 Thread marked as **high** importance - Critical for project completion',
          thread_ts: '1234567890.123456',
          reply_broadcast: true,
        });

        expect(result.content[0]?.text).toContain(
          'Thread 1234567890.123456 marked as high importance'
        );
      });
    });
  });

  describe('Advanced Thread Features', () => {
    describe('exportThread', () => {
      it('should export thread in markdown format successfully', async () => {
        // Arrange
        const mockMessages = [
          {
            ts: '1234567890.123456',
            text: 'Parent message',
            user: 'U1234567890',
          },
          {
            ts: '1234567890.234567',
            text: 'Reply message',
            user: 'U0987654321',
          },
        ];

        mockWebClientInstance.conversations.replies.mockResolvedValue({
          ok: true,
          messages: mockMessages,
        });

        const args = {
          channel: 'C1234567890',
          thread_ts: '1234567890.123456',
          format: 'markdown',
          include_metadata: true,
        };

        // Act
        const result = await slackService.exportThread(args);

        // Assert
        expect(result.content[0]?.text).toContain('Thread exported successfully');
        expect(result.content[0]?.text).toContain('Format: markdown');
        expect(result.content[0]?.text).toContain('Size:');
        expect(result.content[0]?.text).toContain('Filename:');
      });
    });

    describe('findRelatedThreads', () => {
      it('should find related threads successfully', async () => {
        // Arrange
        const mockSourceMessages = [
          {
            ts: '1234567890.123456',
            text: 'Discussion about project timeline',
            user: 'U1234567890',
          },
        ];

        const mockSearchResults = {
          ok: true,
          messages: {
            matches: [
              {
                ts: '1234567891.123456',
                text: 'Another project timeline discussion',
                channel: { id: 'C0987654321' },
              },
            ],
          },
        };

        mockWebClientInstance.conversations.replies.mockResolvedValueOnce({
          ok: true,
          messages: mockSourceMessages,
        });

        mockWebClientInstance.search.messages.mockResolvedValue(mockSearchResults);

        const args = {
          channel: 'C1234567890',
          thread_ts: '1234567890.123456',
          similarity_threshold: 0.3,
          max_results: 10,
        };

        // Act
        const result = await slackService.findRelatedThreads(args);

        // Assert
        expect(result.content[0]?.text).toContain('related threads');
        expect(result.content[0]?.text).toContain('Similarity:');
      });
    });

    describe('getThreadsByParticipants', () => {
      it('should get threads by participants successfully', async () => {
        // Arrange
        const mockSearchResults = {
          ok: true,
          messages: {
            matches: [
              {
                ts: '1234567890.123456',
                thread_ts: '1234567890.123456',
                text: 'Thread with specific participants',
                channel: { id: 'C1234567890' },
              },
            ],
          },
        };

        mockWebClientInstance.search.messages.mockResolvedValue(mockSearchResults);

        const args = {
          participants: ['U1234567890', 'U0987654321'],
          channel: 'C1234567890',
          limit: 20,
          require_all_participants: false,
        };

        // Act
        const result = await slackService.getThreadsByParticipants(args);

        // Assert
        expect(mockWebClientInstance.search.messages).toHaveBeenCalledWith({
          query: 'from:U1234567890 OR from:U0987654321 in:C1234567890',
          count: 20,
        });

        expect(result.content[0]?.text).toContain('Found 1 threads with specified participants');
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle API errors gracefully in thread operations', async () => {
      // Arrange
      mockWebClientInstance.conversations.replies.mockResolvedValue({
        ok: false,
        error: 'thread_not_found',
      });

      const args = {
        channel: 'C1234567890',
        thread_ts: '1234567890.123456',
      };

      // Act & Assert
      await expect(slackService.getThreadReplies(args)).rejects.toThrow(SlackAPIError);
      await expect(slackService.getThreadReplies(args)).rejects.toThrow('thread_not_found');
    });

    it('should validate thread input parameters', async () => {
      // Arrange
      const args = {
        channel: '',
        thread_ts: '1234567890.123456',
      };

      // Act & Assert
      await expect(slackService.getThreadReplies(args)).rejects.toThrow('Validation failed');
    });

    it('should handle network errors in thread operations', async () => {
      // Arrange
      mockWebClientInstance.conversations.replies.mockRejectedValue(new Error('Network error'));

      const args = {
        channel: 'C1234567890',
        thread_ts: '1234567890.123456',
      };

      // Act & Assert
      await expect(slackService.getThreadReplies(args)).rejects.toThrow(
        'Failed to get thread replies'
      );
    });
  });
});
