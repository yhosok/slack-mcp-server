/**
 * Consolidated User Service Tests
 * Tests the consolidated user service supporting both Infrastructure and Domain patterns
 */

import { jest } from '@jest/globals';
// import type { WebClient } from '@slack/web-api';
import { createUserService } from '../slack/services/users/user-service.js';
import type { UserService, UserServiceDependencies } from '../slack/services/users/types.js';

// Mock the configuration
const mockConfig = {
  SLACK_BOT_TOKEN: 'xoxb-test-token',
  SLACK_USER_TOKEN: undefined,
  USE_USER_TOKEN_FOR_READ: false,
  LOG_LEVEL: 'info',
  SLACK_ENABLE_RATE_LIMIT_RETRY: true,
  SLACK_RATE_LIMIT_RETRIES: 3,
  SLACK_MAX_REQUEST_CONCURRENCY: 3,
  SLACK_REJECT_RATE_LIMITED_CALLS: false,
  MCP_SERVER_NAME: 'slack-mcp-server',
  MCP_SERVER_VERSION: '1.0.0',
  PORT: 3000,
};

jest.mock('../config/index', () => ({
  getConfig: jest.fn(() => mockConfig),
  CONFIG: mockConfig,
}));

// Mock logger
jest.mock('../utils/logger', () => ({
  logger: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

// Mock WebClient with proper typing
const mockUsersInfo = jest.fn() as jest.MockedFunction<any>;
const mockWebClient = {
  users: {
    info: mockUsersInfo,
  },
} as any;

const mockGetClient = jest.fn(() => mockWebClient);

describe('Consolidated User Service - Infrastructure Pattern Tests', () => {
  let userService: UserService;
  let dependencies: UserServiceDependencies;

  beforeEach(() => {
    jest.clearAllMocks();
    dependencies = {
      getClient: mockGetClient,
    };
    userService = createUserService(dependencies);
  });

  describe('Consolidated Interface', () => {
    test('should provide all required methods (Infrastructure + Domain patterns)', () => {
      // Infrastructure pattern methods
      expect(userService).toHaveProperty('getDisplayName');
      expect(userService).toHaveProperty('bulkGetDisplayNames');
      expect(userService).toHaveProperty('getUserInfoDirect');
      expect(userService).toHaveProperty('clearCache');

      // Domain pattern methods
      expect(userService).toHaveProperty('getUserInfo');

      expect(typeof userService.getDisplayName).toBe('function');
      expect(typeof userService.bulkGetDisplayNames).toBe('function');
      expect(typeof userService.getUserInfoDirect).toBe('function');
      expect(typeof userService.getUserInfo).toBe('function');
      expect(typeof userService.clearCache).toBe('function');
    });

    test('should be stateless and independent', () => {
      // Each service instance should be independent
      const service1 = createUserService(dependencies);
      const service2 = createUserService(dependencies);

      expect(service1).not.toBe(service2);
      expect(service1.getDisplayName).not.toBe(service2.getDisplayName);
    });
  });

  describe('Display Name Utilities', () => {
    test('should cache display names efficiently', async () => {
      const mockUserResponse = {
        user: {
          id: 'U123',
          name: 'john.doe',
          real_name: 'John Doe',
          profile: {
            display_name: 'Johnny',
          },
        },
      };

      mockUsersInfo.mockResolvedValue(mockUserResponse);

      // First call should hit API
      const result1 = await userService.getDisplayName('U123');
      expect(result1).toBe('Johnny');
      expect(mockUsersInfo).toHaveBeenCalledWith({ user: 'U123' });
      expect(mockUsersInfo).toHaveBeenCalledTimes(1);

      // Second call should use cache
      const result2 = await userService.getDisplayName('U123');
      expect(result2).toBe('Johnny');
      expect(mockUsersInfo).toHaveBeenCalledTimes(1); // No additional call
    });

    test('should handle bulk display name operations efficiently', async () => {
      const mockUserResponses = [
        {
          user: {
            id: 'U1',
            name: 'user1',
            real_name: 'User One',
            profile: { display_name: 'U1' },
          },
        },
        {
          user: {
            id: 'U2',
            name: 'user2',
            real_name: 'User Two',
            profile: { display_name: 'U2' },
          },
        },
      ];

      mockUsersInfo
        .mockResolvedValueOnce(mockUserResponses[0])
        .mockResolvedValueOnce(mockUserResponses[1]);

      const userIds = ['U1', 'U2'];
      const result = await userService.bulkGetDisplayNames(userIds);

      expect(result).toBeInstanceOf(Map);
      expect(result.get('U1')).toBe('U1');
      expect(result.get('U2')).toBe('U2');
      expect(mockUsersInfo).toHaveBeenCalledTimes(2);
    });

    test('should optimize bulk operations with partial caching', async () => {
      // Pre-populate cache with one user
      const mockUserResponse1 = {
        user: {
          id: 'U1',
          name: 'cached-user',
          real_name: 'Cached User',
          profile: { display_name: 'Cached' },
        },
      };

      mockUsersInfo.mockResolvedValue(mockUserResponse1);
      await userService.getDisplayName('U1'); // Cache U1

      // Now test bulk operation with mixed cached/uncached users
      const mockUserResponse2 = {
        user: {
          id: 'U2',
          name: 'new-user',
          real_name: 'New User',
          profile: { display_name: 'New' },
        },
      };

      mockUsersInfo.mockResolvedValue(mockUserResponse2);

      const result = await userService.bulkGetDisplayNames(['U1', 'U2']);

      expect(result.get('U1')).toBe('Cached'); // From cache
      expect(result.get('U2')).toBe('New'); // From API
      expect(mockUsersInfo).toHaveBeenCalledTimes(2); // Only for U1 initially and U2
    });
  });

  describe('Shared Utility Usage Pattern', () => {
    test('should support multiple services using the same instance', async () => {
      // Simulate multiple services sharing the same user utility
      const threadService = { userService };
      const reactionService = { userService };
      const workspaceService = { userService };

      const mockUserResponse = {
        user: {
          id: 'U123',
          name: 'shared.user',
          real_name: 'Shared User',
          profile: { display_name: 'Shared' },
        },
      };

      mockUsersInfo.mockResolvedValue(mockUserResponse);

      // All services should be able to use the utility
      const result1 = await threadService.userService.getDisplayName('U123');
      const result2 = await reactionService.userService.getDisplayName('U123');
      const result3 = await workspaceService.userService.getDisplayName('U123');

      expect(result1).toBe('Shared');
      expect(result2).toBe('Shared');
      expect(result3).toBe('Shared');
      expect(mockUsersInfo).toHaveBeenCalledTimes(1); // Cached after first call
    });

    test('should be compatible with Infrastructure Services pattern', () => {
      // Infrastructure layer user service should integrate properly with InfrastructureServices
      const mockInfrastructureServices = {
        clientManager: {} as any,
        rateLimitService: {} as any,
        userService: userService, // Infrastructure user service
        requestHandler: {} as any,
      };

      // Verify the infrastructure services pattern
      expect(mockInfrastructureServices.userService).toBe(userService);
      expect(typeof mockInfrastructureServices.userService.getDisplayName).toBe('function');
      expect(typeof mockInfrastructureServices.userService.bulkGetDisplayNames).toBe('function');
      expect(typeof mockInfrastructureServices.userService.getUserInfo).toBe('function');
      expect(typeof mockInfrastructureServices.userService.clearCache).toBe('function');
    });

    test('should provide cache management for testing scenarios', () => {
      // Cache some data
      const _promise = userService.getDisplayName('U123');

      // Clear cache should be available for testing
      expect(() => userService.clearCache()).not.toThrow();

      // Should be able to clear cache independently
      userService.clearCache();

      // This ensures cache management is properly exposed
      expect(typeof userService.clearCache).toBe('function');
    });
  });

  describe('Error Handling and Fallbacks', () => {
    test('should handle API errors gracefully', async () => {
      mockUsersInfo.mockRejectedValue(new Error('API Error'));

      const result = await userService.getDisplayName('U999');
      expect(result).toBe('U999'); // Should fallback to user ID
    });

    test('should handle special cases appropriately', async () => {
      const unknownResult = await userService.getDisplayName('unknown');
      expect(unknownResult).toBe('Unknown');

      const emptyResult = await userService.getDisplayName('');
      expect(emptyResult).toBe('Unknown');
    });
  });

  describe('Full User Information Utility', () => {
    test('should provide complete user information when needed', async () => {
      const mockFullUserResponse = {
        user: {
          id: 'U123',
          team_id: 'T123',
          name: 'john.doe',
          deleted: false,
          color: '9f69e7',
          real_name: 'John Doe',
          tz: 'America/New_York',
          tz_label: 'Eastern Standard Time',
          tz_offset: -18000,
          profile: {
            display_name: 'Johnny',
            real_name: 'John Doe',
            email: 'john@example.com',
          },
          is_admin: false,
          is_owner: false,
          is_primary_owner: false,
          is_restricted: false,
          is_ultra_restricted: false,
          is_bot: false,
          is_app_user: false,
          updated: 1234567890,
          is_email_confirmed: true,
          who_can_share_contact_card: 'EVERYONE',
        },
      };

      mockUsersInfo.mockResolvedValue(mockFullUserResponse);

      const result = await userService.getUserInfoDirect('U123');

      // Should return complete SlackUser with all required fields
      expect(result.id).toBe('U123');
      expect(result.team_id).toBe('T123');
      expect(result.name).toBe('john.doe');
      expect(result.real_name).toBe('John Doe');
      expect(result.profile.display_name).toBe('Johnny');
      expect(result.profile.real_name).toBe('John Doe');
      expect(result.profile.email).toBe('john@example.com');
      expect(result.is_admin).toBe(false);
      expect(result.is_bot).toBe(false);
    });

    test('should handle getUserInfo API errors', async () => {
      mockUsersInfo.mockRejectedValue(new Error('User not found'));

      await expect(userService.getUserInfoDirect('U999')).rejects.toThrow('User not found');
    });

    test('should return plain SlackUser objects (not ServiceResult)', async () => {
      const mockUserResponse = {
        user: {
          id: 'U456',
          team_id: 'T456',
          name: 'plain.user',
          real_name: 'Plain User',
          profile: {
            display_name: 'Plain',
          },
        },
      };

      mockUsersInfo.mockResolvedValue(mockUserResponse);

      const result = await userService.getUserInfoDirect('U456');

      // Infrastructure layer should return plain SlackUser objects, NOT ServiceResult
      expect(result).not.toHaveProperty('success');
      expect(result).not.toHaveProperty('data');
      expect(result).not.toHaveProperty('error');

      // Should be a plain SlackUser object
      expect(result).toHaveProperty('id');
      expect(result).toHaveProperty('name');
      expect(result.id).toBe('U456');
      expect(result.name).toBe('plain.user');
    });
  });

  describe('Domain Pattern Integration', () => {
    test('should support TypeSafeAPI pattern with getUserInfo', async () => {
      const mockUserResponse = {
        user: {
          id: 'U789',
          team_id: 'T789',
          name: 'domain.user',
          real_name: 'Domain User',
          profile: {
            display_name: 'Domain',
          },
        },
      };

      mockUsersInfo.mockResolvedValue(mockUserResponse);

      const result = await userService.getUserInfo({ user: 'U789' });

      // Domain pattern should return ServiceResult
      expect(result).toHaveProperty('success');
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toHaveProperty('id', 'U789');
        expect(result.data).toHaveProperty('name', 'domain.user');
      }
    });

    test('should handle domain pattern validation errors', async () => {
      const result = await userService.getUserInfo({}); // Missing user field

      expect(result).toHaveProperty('success');
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toContain('user');
      }
    });
  });

  describe('Dual Pattern Support', () => {
    test('should provide both Infrastructure and Domain interfaces', () => {
      // Infrastructure pattern methods (direct access)
      expect(typeof userService.getDisplayName).toBe('function');
      expect(typeof userService.bulkGetDisplayNames).toBe('function');
      expect(typeof userService.getUserInfoDirect).toBe('function');
      expect(typeof userService.clearCache).toBe('function');

      // Domain pattern methods (ServiceResult wrapper)
      expect(typeof userService.getUserInfo).toBe('function');
    });

    test('should be designed for both Infrastructure and Domain consumption', () => {
      // Consolidated user service supports both usage patterns:
      // - Infrastructure services for display name resolution and utilities
      // - Domain services for MCP tool implementation with TypeSafeAPI

      const infrastructureServices = {
        userService, // Consolidated user service for infrastructure usage
        // ... other infrastructure services
      };

      const domainServices = {
        userService, // Same consolidated service for domain usage with different methods
        // ... other domain services
      };

      // Should integrate cleanly with both patterns
      expect(infrastructureServices.userService.getDisplayName).toBeDefined();
      expect(infrastructureServices.userService.bulkGetDisplayNames).toBeDefined();
      expect(domainServices.userService.getUserInfo).toBeDefined();
    });
  });
});
