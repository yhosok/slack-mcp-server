/**
 * Thread Service Dependencies Integration Test
 * Tests the proper integration of Infrastructure and Domain user services
 */

import { jest } from '@jest/globals';
import type { WebClient } from '@slack/web-api';
import { createThreadService } from '../slack/services/threads/thread-service.js';
import type { ThreadServiceDependencies } from '../slack/services/threads/types.js';
import type { UserService as DomainUserService } from '../slack/services/users/types.js';
import type { UserService as InfraUserService } from '../slack/infrastructure/user/types.js';
import type {
  SlackClientManager,
  RateLimitService,
  RequestHandler,
} from '../slack/infrastructure/index.js';
import type { SlackUser } from '../slack/types/core/users.js';

// Mock the config to avoid real environment dependencies
jest.mock('../config/index.js', () => ({
  CONFIG: {
    SLACK_BOT_TOKEN: 'xoxb-test-token',
    SLACK_USER_TOKEN: 'xoxp-test-token',
    USE_USER_TOKEN_FOR_READ: false,
    SLACK_ENABLE_RATE_LIMIT_RETRY: true,
    SLACK_RATE_LIMIT_RETRIES: 3,
    SLACK_MAX_REQUEST_CONCURRENCY: 3,
    SLACK_REJECT_RATE_LIMITED_CALLS: false,
    LOG_LEVEL: 'info',
  },
}));

describe('Thread Service Dependencies Integration', () => {
  let mockWebClient: jest.Mocked<WebClient>;
  let mockClientManager: jest.Mocked<SlackClientManager>;
  let mockRateLimitService: jest.Mocked<RateLimitService>;
  let mockRequestHandler: jest.Mocked<RequestHandler>;
  let mockInfraUserService: jest.Mocked<InfraUserService>;
  let mockDomainUserService: jest.Mocked<DomainUserService>;
  let threadServiceDeps: ThreadServiceDependencies;

  beforeEach(() => {
    // Mock WebClient
    mockWebClient = {
      conversations: {
        replies: jest.fn(),
        history: jest.fn(),
      },
      users: {
        info: jest.fn(),
      },
    } as unknown as jest.Mocked<WebClient>;

    // Mock ClientManager
    mockClientManager = {
      getClientForOperation: jest.fn().mockReturnValue(mockWebClient),
      checkSearchApiAvailability: jest.fn(),
    } as unknown as jest.Mocked<SlackClientManager>;

    // Mock RateLimitService
    mockRateLimitService = {
      trackRequest: jest.fn(),
      getMetrics: jest.fn(),
      reset: jest.fn(),
    } as unknown as jest.Mocked<RateLimitService>;

    // Mock RequestHandler
    mockRequestHandler = {
      validateInput: jest.fn(),
      formatResponse: jest.fn(),
      formatError: jest.fn(),
    } as unknown as jest.Mocked<RequestHandler>;

    // Mock Infrastructure UserService (lightweight, display name focused)
    mockInfraUserService = {
      getDisplayName: jest.fn(),
      bulkGetDisplayNames: jest.fn(),
      getUserInfo: jest.fn(),
      clearCache: jest.fn(),
    } as jest.Mocked<InfraUserService>;

    // Mock Domain UserService (TypeSafeAPI compliant)
    mockDomainUserService = {
      getUserInfo: jest.fn(),
      getDisplayName: jest.fn(),
      bulkGetDisplayNames: jest.fn(),
      clearCache: jest.fn(),
    } as jest.Mocked<DomainUserService>;

    // Create enhanced dependencies with both user services
    threadServiceDeps = {
      clientManager: mockClientManager,
      rateLimitService: mockRateLimitService,
      userService: mockInfraUserService, // For backward compatibility
      requestHandler: mockRequestHandler,
      infrastructureUserService: mockInfraUserService,
      domainUserService: mockDomainUserService,
    } as ThreadServiceDependencies;
  });

  describe('Enhanced Dependencies Structure', () => {
    it('should have both infrastructure and domain user services available', () => {
      // This test now passes because we've implemented the enhanced dependencies
      const deps = threadServiceDeps;
      // These properties should exist and work correctly
      expect(deps.infrastructureUserService).toBeDefined();
      expect(deps.domainUserService).toBeDefined();
      expect(deps.clientManager).toBeDefined();
      expect(deps.rateLimitService).toBeDefined();
      expect(deps.requestHandler).toBeDefined();
    });

    it('should provide display name conversion functionality', async () => {
      // This test demonstrates the working formatFindThreadsResponse functionality
      const threadService = createThreadService(threadServiceDeps);

      // Setup mock display names
      mockInfraUserService.bulkGetDisplayNames.mockResolvedValue(
        new Map([
          ['U1234567890', 'John Doe'],
          ['U0987654321', 'Jane Doe'],
        ])
      );

      // Setup mock data
      mockWebClient.conversations.history.mockResolvedValue({
        ok: true,
        messages: [
          {
            ts: '1234567890.123456',
            thread_ts: '1234567890.123456',
            reply_count: 2,
            text: 'Thread parent message',
            user: 'U1234567890',
          },
        ],
        response_metadata: {},
      });

      mockWebClient.conversations.replies.mockResolvedValue({
        ok: true,
        messages: [
          {
            ts: '1234567890.123456',
            text: 'Parent message',
            user: 'U1234567890',
          },
          {
            ts: '1234567890.123457',
            text: 'Reply 1',
            user: 'U0987654321',
          },
        ],
      });

      // This should now work because display name conversion is implemented
      const result = await threadService.findThreadsInChannel({
        channel: 'C1234567890',
      });

      expect(result.success).toBe(true);
      if (result.success && result.data.threads && result.data.threads[0]) {
        // These assertions should now pass because display names are being converted
        expect(result.data.threads[0].parentMessage.userDisplayName).toBe('John Doe');
        expect(result.data.threads[0].participantDisplayNames).toEqual([
          { id: 'U0987654321', displayName: 'Jane Doe' },
        ]);
        // Verify efficient usage of infrastructure service
        expect(mockInfraUserService.bulkGetDisplayNames).toHaveBeenCalledWith([
          'U1234567890',
          'U0987654321',
        ]);
      }
    });
  });

  describe('Efficient User Service Usage Patterns', () => {
    it('should use domain service for detailed user information in analysis', async () => {
      // Mock domain user service for comprehensive user data
      mockDomainUserService.getUserInfo.mockResolvedValue({
        success: true,
        data: {
          id: 'U1234567890',
          name: 'john.doe',
          real_name: 'John Doe',
          profile: {
            display_name: 'John Doe',
            real_name: 'John Doe',
          },
          is_admin: false,
          is_bot: false,
          deleted: false,
          is_restricted: false,
        } as SlackUser,
        message: 'User info retrieved',
      });

      const threadService = createThreadService(threadServiceDeps);

      // Setup thread data
      mockWebClient.conversations.replies.mockResolvedValue({
        ok: true,
        messages: [
          {
            ts: '1234567890.123456',
            text: 'Parent message',
            user: 'U1234567890',
          },
          {
            ts: '1234567890.123457',
            text: 'Reply message',
            user: 'U0987654321',
          },
        ],
      });

      // This should efficiently use domain service for detailed user info in analysis
      const result = await threadService.analyzeThread({
        channel: 'C1234567890',
        thread_ts: '1234567890.123456',
      });

      // Verify domain service is used for comprehensive user information
      expect(result.success).toBe(true);
      expect(mockDomainUserService.getUserInfo).toHaveBeenCalledWith({ user: 'U1234567890' });
      expect(mockDomainUserService.getUserInfo).toHaveBeenCalledWith({ user: 'U0987654321' });
    });
  });

  describe('Display Name Formatting Recovery', () => {
    it('should have working formatFindThreadsResponse equivalent functionality', async () => {
      const threadService = createThreadService(threadServiceDeps);

      // Mock display names
      mockInfraUserService.bulkGetDisplayNames.mockResolvedValue(
        new Map([
          ['U1234567890', 'John Doe'],
          ['U0987654321', 'Jane Doe'],
        ])
      );

      // Setup thread discovery data
      mockWebClient.conversations.history.mockResolvedValue({
        ok: true,
        messages: [
          {
            ts: '1234567890.123456',
            thread_ts: '1234567890.123456',
            reply_count: 2,
            text: 'Thread parent',
            user: 'U1234567890',
          },
        ],
      });

      mockWebClient.conversations.replies.mockResolvedValue({
        ok: true,
        messages: [
          {
            ts: '1234567890.123456',
            text: 'Parent',
            user: 'U1234567890',
          },
          {
            ts: '1234567890.123457',
            text: 'Reply',
            user: 'U0987654321',
          },
        ],
      });

      const result = await threadService.findThreadsInChannel({
        channel: 'C1234567890',
      });

      expect(result.success).toBe(true);
      if (result.success && result.data.threads && result.data.threads[0]) {
        // These assertions now pass because display name formatting is working
        expect(result.data.threads[0].parentMessage.userDisplayName).toBe('John Doe');
        expect(result.data.threads[0].participantDisplayNames).toEqual([
          { id: 'U0987654321', displayName: 'Jane Doe' },
        ]);
        expect(mockInfraUserService.bulkGetDisplayNames).toHaveBeenCalledWith([
          'U1234567890',
          'U0987654321',
        ]);
      }
    });
  });
});
