/**
 * Comprehensive Search Query Construction Fixes Test
 * 
 * This test suite validates that all search-related functions use consistent,
 * properly escaped query construction with correct Slack API syntax.
 * 
 * Fixes implemented:
 * 1. Channel reference syntax: `in:#channel_name` (not `in:<#CHANNEL_ID>`)
 * 2. Query escaping: Proper handling of special characters
 * 3. Consistent patterns: All search functions use same query building logic
 * 4. Edge case handling: Malformed inputs, empty queries, etc.
 */

import { jest } from '@jest/globals';
import { SearchAllResponse } from '@slack/web-api';

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
    messages: jest.fn(),
    files: jest.fn(),
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
import { createFileServiceMCPAdapter } from '../slack/services/files/file-service-mcp-adapter.js';
import { createInfrastructureServices } from '../slack/infrastructure/index.js';

describe('Comprehensive Search Query Construction Fixes', () => {
  let threadService: any;
  let fileService: any;
  let mockInfrastructure: any;

  // Test data
  const testChannel = 'C1234567890';
  const testChannelName = 'general';
  const testUserId1 = 'U1234567890';
  const testUserId2 = 'U0987654321';

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
        search: { maxQueries: 10, maxResults: 10, queryTTL: 300000, resultTTL: 300000, adaptiveTTL: false, enablePatternInvalidation: false },
        files: { max: 50, ttl: 300000 },
        threads: { max: 50, ttl: 300000, updateAgeOnGet: true },
        enableMetrics: false,
      },
    });

    // Create services with MCP adapter
    threadService = createThreadServiceMCPAdapter(mockInfrastructure);
    fileService = createFileServiceMCPAdapter(mockInfrastructure);

    // Setup channel info mock to return proper channel name
    mockWebClientInstance.conversations.info.mockResolvedValue({
      ok: true,
      channel: {
        id: testChannel,
        name: testChannelName,
      },
    });

    // Setup default empty search responses
    mockWebClientInstance.search.all.mockResolvedValue({
      ok: true,
      messages: { matches: [] },
    } as SearchAllResponse);

    mockWebClientInstance.search.files.mockResolvedValue({
      ok: true,
      files: { matches: [] },
    });
  });

  describe('Channel Reference Syntax Consistency', () => {
    it('should use correct channel syntax in searchThreads', async () => {
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

      expect(capturedQuery).toContain(`in:#${testChannelName}`);
      expect(capturedQuery).not.toContain('in:<#');
      expect(capturedQuery).not.toContain('in:<#C');
    });

    it('should use correct channel syntax in getThreadsByParticipants (cross-channel search)', async () => {
      let capturedQuery = '';
      mockWebClientInstance.search.all.mockImplementation((args: any) => {
        capturedQuery = args.query;
        return Promise.resolve({
          ok: true,
          messages: { matches: [] },
        });
      });

      // Test cross-channel search by NOT specifying a channel
      // This forces the function to use search API instead of findThreadsInChannel
      await threadService.getThreadsByParticipants({
        participants: [testUserId1],
        // No channel specified - forces search strategy
      });

      // Should contain participant filter but no channel filter for cross-channel search
      expect(capturedQuery).toContain(`from:<@${testUserId1}>`);
      expect(capturedQuery).not.toContain('in:<#');
      // Should not contain the problematic channel syntax
      expect(capturedQuery).not.toContain('in:<#C');
    });

    it('should use correct channel syntax in searchFiles', async () => {
      let capturedQuery = '';
      mockWebClientInstance.search.files.mockImplementation((args: any) => {
        capturedQuery = args.query;
        return Promise.resolve({
          ok: true,
          files: { matches: [] },
        });
      });

      await fileService.searchFiles({
        query: 'document',
        channel: testChannel,
      });

      expect(capturedQuery).toContain(`in:#${testChannelName}`);
      expect(capturedQuery).not.toContain('in:<#');
      expect(capturedQuery).not.toContain('in:<#C');
    });
  });

  describe('Query Escaping and Validation', () => {
    it('should properly escape quotes in search queries', async () => {
      let capturedQuery = '';
      mockWebClientInstance.search.all.mockImplementation((args: any) => {
        capturedQuery = args.query;
        return Promise.resolve({
          ok: true,
          messages: { matches: [] },
        });
      });

      await threadService.searchThreads({
        query: 'test "quoted" query',
      });

      // Should escape quotes properly
      expect(capturedQuery).toContain('\\"quoted\\"');
      expect(capturedQuery).not.toContain('"quoted"');
    });

    it('should handle newlines in search queries', async () => {
      let capturedQuery = '';
      mockWebClientInstance.search.files.mockImplementation((args: any) => {
        capturedQuery = args.query;
        return Promise.resolve({
          ok: true,
          files: { matches: [] },
        });
      });

      await fileService.searchFiles({
        query: 'line1\nline2\rline3',  // Use actual newline characters
      });

      // Should replace newlines with spaces
      expect(capturedQuery).toContain('line1 line2 line3');
      expect(capturedQuery).not.toContain('\n');
      expect(capturedQuery).not.toContain('\r');
    });

    it('should handle empty queries gracefully', async () => {
      let capturedQuery = '';
      mockWebClientInstance.search.all.mockImplementation((args: any) => {
        capturedQuery = args.query;
        return Promise.resolve({
          ok: true,
          messages: { matches: [] },
        });
      });

      await threadService.searchThreads({
        query: '',
        channel: testChannel,
      });

      // Should still include channel filter even with empty base query
      expect(capturedQuery).toContain(`in:#${testChannelName}`);
    });
  });

  describe('Date Filter Consistency', () => {
    it('should apply date filters consistently across all search functions', async () => {
      const testAfter = '2023-01-01';
      const testBefore = '2023-12-31';
      
      const queries: string[] = [];

      // Capture queries from different search functions
      mockWebClientInstance.search.all.mockImplementation((args: any) => {
        queries.push(args.query);
        return Promise.resolve({
          ok: true,
          messages: { matches: [] },
        });
      });

      mockWebClientInstance.search.files.mockImplementation((args: any) => {
        queries.push(args.query);
        return Promise.resolve({
          ok: true,
          files: { matches: [] },
        });
      });

      // Test thread search
      await threadService.searchThreads({
        query: 'test',
        after: testAfter,
        before: testBefore,
      });

      // Test thread by participants
      await threadService.getThreadsByParticipants({
        participants: [testUserId1],
        after: testAfter,
        before: testBefore,
      });

      // Test file search
      await fileService.searchFiles({
        query: 'document',
        after: testAfter,
        before: testBefore,
      });

      // All queries should have consistent date filter format
      queries.forEach(query => {
        expect(query).toContain(`after:${testAfter}`);
        expect(query).toContain(`before:${testBefore}`);
      });
    });
  });

  describe('User Filter Consistency', () => {
    it('should apply user filters consistently', async () => {
      const queries: string[] = [];

      mockWebClientInstance.search.all.mockImplementation((args: any) => {
        queries.push(args.query);
        return Promise.resolve({
          ok: true,
          messages: { matches: [] },
        });
      });

      mockWebClientInstance.search.files.mockImplementation((args: any) => {
        queries.push(args.query);
        return Promise.resolve({
          ok: true,
          files: { matches: [] },
        });
      });

      // Test thread search with user filter
      await threadService.searchThreads({
        query: 'test',
        user: testUserId1,
      });

      // Test file search with user filter
      await fileService.searchFiles({
        query: 'document',
        user: testUserId1,
      });

      // All queries should have consistent user filter format
      queries.forEach(query => {
        expect(query).toContain(`from:<@${testUserId1}>`);
      });
    });
  });

  describe('Channel Resolution Fallback', () => {
    it('should fallback to channel ID when resolution fails', async () => {
      // Mock channel resolution to fail
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
        query: 'test',
        channel: testChannel,
      });

      // Should fallback to channel ID
      expect(capturedQuery).toContain(`in:#${testChannel}`);
    });
  });

  describe('Complex Query Building', () => {
    it('should build complex queries with all filters correctly', async () => {
      let capturedQuery = '';
      mockWebClientInstance.search.files.mockImplementation((args: any) => {
        capturedQuery = args.query;
        return Promise.resolve({
          ok: true,
          files: { matches: [] },
        });
      });

      await fileService.searchFiles({
        query: 'important document',
        types: 'pdf,docx,txt',
        channel: testChannel,
        user: testUserId1,
        after: '2023-01-01',
        before: '2023-12-31',
      });

      // Should contain all components
      expect(capturedQuery).toContain('important document');
      expect(capturedQuery).toContain('(filetype:pdf OR filetype:docx OR filetype:txt)');
      expect(capturedQuery).toContain(`in:#${testChannelName}`);
      expect(capturedQuery).toContain(`from:<@${testUserId1}>`);
      expect(capturedQuery).toContain('after:2023-01-01');
      expect(capturedQuery).toContain('before:2023-12-31');
    });
  });

  describe('Participant Logic Fixes', () => {
    it('should use correct AND logic for require_all_participants=true', async () => {
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
        require_all_participants: true,
      });

      // Should search for first participant only, filter programmatically
      expect(capturedQuery).toContain(`from:<@${testUserId1}>`);
      expect(capturedQuery).not.toContain(`from:<@${testUserId2}>`);
      expect(capturedQuery).not.toContain('OR');
    });

    it('should use correct OR logic for require_all_participants=false', async () => {
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

      // Should use OR logic for multiple participants
      expect(capturedQuery).toContain(`from:<@${testUserId1}> OR from:<@${testUserId2}>`);
    });
  });
});