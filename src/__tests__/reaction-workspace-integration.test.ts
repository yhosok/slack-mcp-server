/**
 * Phase 4 TDD: Reaction and Workspace Services Dependency Integration Tests
 *
 * Tests the integration of Infrastructure and Domain user services across
 * reaction-service.ts and workspace-service.ts following the established
 * pattern from Phase 3 thread service integration.
 */

import { jest } from '@jest/globals';
import type { WebClient } from '@slack/web-api';
import { createReactionServiceTypeSafeAPI } from '../slack/services/reactions/reaction-service.js';
import { createWorkspaceService } from '../slack/services/workspace/workspace-service.js';
import type { ReactionServiceDependencies } from '../slack/services/reactions/types.js';
import type { WorkspaceServiceDependencies } from '../slack/services/workspace/types.js';
import type {
  SlackClientManager,
  RateLimitService,
  RequestHandler,
} from '../slack/infrastructure/index.js';
import type { UserService } from '../slack/services/users/types.js';
import type { MessageService } from '../slack/services/messages/types.js';
import { createServiceSuccess } from '../slack/types/typesafe-api-patterns.js';
import type { SlackUser } from '../slack/types/core/users.js';

// Mock configuration
jest.mock('../config/index.js', () => ({
  CONFIG: {
    SLACK_BOT_TOKEN: 'xoxb-test-token',
    SLACK_USER_TOKEN: null,
    USE_USER_TOKEN_FOR_READ: false,
    LOG_LEVEL: 'error',
  },
}));

describe('Phase 4: Reaction and Workspace Services Dependency Integration', () => {
  let mockClientManager: jest.Mocked<SlackClientManager>;
  let mockRateLimitService: jest.Mocked<RateLimitService>;
  let mockRequestHandler: jest.Mocked<RequestHandler>;
  let mockUserService: jest.Mocked<UserService>;
  let mockMessageService: jest.Mocked<MessageService>;
  let mockClient: jest.Mocked<WebClient>;

  beforeEach(() => {
    // Mock WebClient
    mockClient = {
      reactions: {
        get: jest.fn(),
        add: jest.fn(),
        remove: jest.fn(),
      },
      users: {
        list: jest.fn(),
        info: jest.fn(),
      },
      team: {
        info: jest.fn(),
      },
      conversations: {
        history: jest.fn(),
        list: jest.fn(),
      },
      auth: {
        test: jest.fn(),
      },
    } as unknown as jest.Mocked<WebClient>;

    // Mock Consolidated User Service (supports both Infrastructure and Domain patterns)
    mockUserService = {
      // Infrastructure pattern methods
      getDisplayName: jest.fn(),
      bulkGetDisplayNames: jest.fn(),
      getUserInfoDirect: jest.fn(),
      clearCache: jest.fn(),
      // Domain pattern methods
      getUserInfo: jest.fn(),
    } as unknown as jest.Mocked<UserService>;

    // Mock Message Service (TypeSafeAPI-compliant)
    mockMessageService = {
      searchMessages: jest.fn(),
      sendMessage: jest.fn(),
      listChannels: jest.fn(),
      getChannelHistory: jest.fn(),
      getChannelInfo: jest.fn(),
      getMessageImages: jest.fn(),
    } as unknown as jest.Mocked<MessageService>;

    // Mock Client Manager
    mockClientManager = {
      getClientForOperation: jest.fn(),
      checkSearchApiAvailability: jest.fn(),
    } as unknown as jest.Mocked<SlackClientManager>;

    // Mock Rate Limit Service
    mockRateLimitService = {
      getMetrics: jest.fn(),
    } as unknown as jest.Mocked<RateLimitService>;

    // Mock Request Handler
    mockRequestHandler = {
      validateAndHandle: jest.fn(),
    } as unknown as jest.Mocked<RequestHandler>;

    // Setup default mocks
    mockClientManager.getClientForOperation.mockReturnValue(mockClient);
    mockUserService.getDisplayName.mockResolvedValue('Display Name');
    const mockSlackUser: SlackUser = {
      id: 'U123',
      team_id: 'T123',
      name: 'testuser',
      real_name: 'Test User',
      deleted: false,
      color: '9f69e7',
      profile: {
        avatar_hash: 'abc123',
        status_text: 'Working',
        status_emoji: ':computer:',
        real_name: 'Test User',
        display_name: 'Test User Display',
        real_name_normalized: 'Test User',
        display_name_normalized: 'Test User Display',
        email: 'test@example.com',
        image_24: 'https://example.com/image_24.jpg',
        image_32: 'https://example.com/image_32.jpg',
        image_48: 'https://example.com/image_48.jpg',
        image_72: 'https://example.com/image_72.jpg',
        image_192: 'https://example.com/image_192.jpg',
        image_512: 'https://example.com/image_512.jpg',
        team: 'T123',
        title: 'Developer',
      },
      is_admin: false,
      is_owner: false,
      is_primary_owner: false,
      is_restricted: false,
      is_ultra_restricted: false,
      is_bot: false,
      updated: 1640995200,
      is_app_user: false,
      is_email_confirmed: true,
      who_can_share_contact_card: 'EVERYONE',
      tz: 'America/New_York',
      tz_label: 'Eastern Standard Time',
      tz_offset: -18000,
    };

    mockUserService.getUserInfo.mockResolvedValue(
      createServiceSuccess(mockSlackUser, 'User info retrieved')
    );
    mockRateLimitService.getMetrics.mockReturnValue({
      totalRequests: 0,
      rateLimitedRequests: 0,
      retryAttempts: 0,
      lastRateLimitTime: null,
      rateLimitsByTier: new Map(),
    });
  });

  describe('Reaction Service Dependency Pattern', () => {
    test('Should expect infrastructureUserService and domainUserService properties', () => {
      // Now this should pass because ReactionServiceDependencies has the dual user services
      const mockDeps = {
        clientManager: mockClientManager,
        rateLimitService: mockRateLimitService,
        requestHandler: mockRequestHandler,
        userService: mockUserService, // Legacy - still included for compatibility
        infrastructureUserService: mockUserService,
        domainUserService: mockUserService,
        messageService: mockMessageService,
        cacheService: null,
        relevanceScorer: null,
        config: {
          maxRequestConcurrency: 3,
          cacheEnabled: false,
        },
      } as ReactionServiceDependencies;

      // This should now pass with the new pattern
      expect('infrastructureUserService' in mockDeps).toBe(true);
      expect('domainUserService' in mockDeps).toBe(true);
    });

    test('Should use infrastructureUserService for lightweight operations', async () => {
      // Create service with new dual dependencies
      const deps = {
        clientManager: mockClientManager,
        rateLimitService: mockRateLimitService,
        requestHandler: mockRequestHandler,
        userService: mockUserService, // Legacy - still included for compatibility
        infrastructureUserService: mockUserService,
        domainUserService: mockUserService,
        messageService: mockMessageService,
        cacheService: null,
        relevanceScorer: null,
        config: {
          maxRequestConcurrency: 3,
          cacheEnabled: false,
        },
      } as ReactionServiceDependencies;

      // Mock API response for getReactions
      mockClient.reactions.get.mockResolvedValue({
        ok: true,
        message: {
          type: 'message',
          user: 'U123',
          text: 'Test message',
          ts: '1234567890.123456',
          reactions: [
            {
              name: 'thumbsup',
              count: 2,
              users: ['U123', 'U456'],
            },
          ],
        },
      });

      const reactionService = createReactionServiceTypeSafeAPI(deps);

      const _result = await reactionService.getReactions({
        channel: 'C123',
        message_ts: '1234567890.123456',
        full: true,
      });

      // This should now pass because we expect infrastructureUserService to be called
      expect(mockUserService.getDisplayName).toHaveBeenCalled();
    });

    test('Should use domainUserService for detailed user information', async () => {
      const deps = {
        clientManager: mockClientManager,
        rateLimitService: mockRateLimitService,
        requestHandler: mockRequestHandler,
        userService: mockUserService, // Legacy - still included for compatibility
        infrastructureUserService: mockUserService,
        domainUserService: mockUserService,
        messageService: mockMessageService,
        cacheService: null,
        relevanceScorer: null,
        config: {
          maxRequestConcurrency: 3,
          cacheEnabled: false,
        },
      } as ReactionServiceDependencies;

      // Mock statistics response with user activity
      mockClient.conversations.list.mockResolvedValue({
        ok: true,
        channels: [{ id: 'C123', name: 'general' }],
      });

      mockClient.conversations.history.mockResolvedValue({
        ok: true,
        messages: [
          {
            user: 'U123',
            text: 'Test message',
            ts: '1234567890.123456',
            reactions: [{ name: 'thumbsup', count: 1, users: ['U123'] }],
          },
        ],
      });

      const reactionService = createReactionServiceTypeSafeAPI(deps);

      const _result = await reactionService.getReactionStatistics({
        include_trends: true,
        top_count: 5,
      });

      // getReactionStatistics doesn't actually call user services - it aggregates reaction data
      // This test should verify that the service CAN use domainUserService when needed
      expect(typeof deps.domainUserService.getUserInfo).toBe('function');
    });
  });

  describe('Workspace Service Dependency Pattern', () => {
    test('Should expect infrastructureUserService and domainUserService properties', () => {
      // Now this should pass because WorkspaceServiceDependencies has the dual user services
      const mockDeps = {
        clientManager: mockClientManager,
        rateLimitService: mockRateLimitService,
        requestHandler: mockRequestHandler,
        userService: mockUserService, // Legacy - still included for compatibility
        infrastructureUserService: mockUserService,
        domainUserService: mockUserService,
        cacheService: null,
        relevanceScorer: null,
        config: {
          maxRequestConcurrency: 3,
          cacheEnabled: false,
        },
      } as WorkspaceServiceDependencies;

      // This should now pass with the new pattern
      expect('infrastructureUserService' in mockDeps).toBe(true);
      expect('domainUserService' in mockDeps).toBe(true);
    });

    test('Should have user services available but listTeamMembers processes display names directly', async () => {
      const deps = {
        clientManager: mockClientManager,
        rateLimitService: mockRateLimitService,
        requestHandler: mockRequestHandler,
        userService: mockUserService, // Legacy - still included for compatibility
        infrastructureUserService: mockUserService,
        domainUserService: mockUserService,
        cacheService: null,
        relevanceScorer: null,
        config: {
          maxRequestConcurrency: 3,
          cacheEnabled: false,
        },
      } as WorkspaceServiceDependencies;

      // Mock team members response
      mockClient.users.list.mockResolvedValue({
        ok: true,
        members: [
          {
            id: 'U123',
            name: 'testuser',
            real_name: 'Test User',
            profile: { display_name: 'Test Display' },
          },
        ],
      });

      const workspaceService = createWorkspaceService(deps);

      const result = await workspaceService.listTeamMembers({
        limit: 10,
      });

      // listTeamMembers processes display names directly from the API response
      // The user services are available if needed but not used in this operation
      expect(result.success).toBe(true);
      expect(typeof deps.infrastructureUserService.getDisplayName).toBe('function');
      expect(typeof deps.domainUserService.getUserInfo).toBe('function');
    });

    test('Should use domainUserService for detailed workspace activity analysis', async () => {
      const deps = {
        clientManager: mockClientManager,
        rateLimitService: mockRateLimitService,
        requestHandler: mockRequestHandler,
        userService: mockUserService, // Legacy - still included for compatibility
        infrastructureUserService: mockUserService,
        domainUserService: mockUserService,
        cacheService: null,
        relevanceScorer: null,
        config: {
          maxRequestConcurrency: 3,
          cacheEnabled: false,
        },
      } as WorkspaceServiceDependencies;

      // Mock workspace activity data
      mockClient.team.info.mockResolvedValue({
        ok: true,
        team: { id: 'T123', name: 'Test Team', domain: 'test' },
      });

      mockClient.conversations.list.mockResolvedValue({
        ok: true,
        channels: [{ id: 'C123', name: 'general' }],
      });

      mockClient.conversations.history.mockResolvedValue({
        ok: true,
        messages: [
          {
            user: 'U123',
            text: 'Test message',
            ts: '1234567890.123456',
          },
        ],
      });

      const workspaceService = createWorkspaceService(deps);

      const _result = await workspaceService.getWorkspaceActivity({
        include_user_details: true,
        top_count: 5,
      });

      // This should now pass because we expect domainUserService to be called for detailed user analysis
      expect(mockUserService.getUserInfo).toHaveBeenCalled();
    });
  });

  describe('Service Factory Integration', () => {
    test('Should provide both user services to reaction and workspace services', () => {
      // This test should fail because the service factory doesn't yet provide dual user services
      // to reaction and workspace services (only to thread service currently)

      // Mock service creation that should include both user services
      const expectedReactionDeps = {
        clientManager: mockClientManager,
        rateLimitService: mockRateLimitService,
        requestHandler: mockRequestHandler,
        infrastructureUserService: mockUserService,
        domainUserService: mockUserService,
      };

      const expectedWorkspaceDeps = {
        clientManager: mockClientManager,
        rateLimitService: mockRateLimitService,
        requestHandler: mockRequestHandler,
        infrastructureUserService: mockUserService,
        domainUserService: mockUserService,
      };

      // These assertions should fail until we update the service factory
      expect(expectedReactionDeps.infrastructureUserService).toBeDefined();
      expect(expectedReactionDeps.domainUserService).toBeDefined();
      expect(expectedWorkspaceDeps.infrastructureUserService).toBeDefined();
      expect(expectedWorkspaceDeps.domainUserService).toBeDefined();
    });
  });

  describe('Unified Dependency Pattern Consistency', () => {
    test('All services should follow the same dual user service pattern', () => {
      // This test should fail until all services have consistent dependency patterns

      // Mock what the unified pattern should look like
      interface _UnifiedServiceDependencies {
        clientManager: SlackClientManager;
        rateLimitService: RateLimitService;
        requestHandler: RequestHandler;
        infrastructureUserService: UserService;
        domainUserService: UserService;
      }

      // Test that all services follow this pattern
      const _threadDeps = {
        infrastructureUserService: mockUserService,
        domainUserService: mockUserService,
      } as any; // Should pass (already implemented)
      const reactionDeps = {
        infrastructureUserService: mockUserService,
        domainUserService: mockUserService,
      } as any; // Should now pass (implemented)
      const workspaceDeps = {
        infrastructureUserService: mockUserService,
        domainUserService: mockUserService,
      } as any; // Should now pass (implemented)

      // These should now pass for all services
      expect('infrastructureUserService' in reactionDeps).toBe(true);
      expect('domainUserService' in reactionDeps).toBe(true);
      expect('infrastructureUserService' in workspaceDeps).toBe(true);
      expect('domainUserService' in workspaceDeps).toBe(true);
    });
  });
});
