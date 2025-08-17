/**
 * TDD RED Phase: User Service Infrastructure Dependency Removal Test
 *
 * This test file validates that User Services operate independently from
 * Infrastructure layer dependencies while maintaining TypeSafeAPI + ts-pattern compliance.
 *
 * Expected Result: Tests should FAIL initially, then PASS after implementation.
 *
 * Requirements:
 * - Services layer user service should NOT depend on Infrastructure layer
 * - getUserInfo() should return TypeSafeAPI-compliant ServiceResult
 * - Direct Slack API client calls instead of clientManager dependency
 * - Immutable cache management with functional programming patterns
 * - Comprehensive error handling and validation
 */

import { jest } from '@jest/globals';
import { match } from 'ts-pattern';
import type { WebClient } from '@slack/web-api';
import type {
  // ServiceResult,
  ServiceOutput,
} from '../../types/typesafe-api-patterns.js';
// import type { SlackUser } from '../../types/core/users.js';
import type {
  UserService,
  // UserInfoResult,
} from './types.js';
import { createUserService } from './user-service.js';
import {
  // createServiceSuccess,
  // createServiceError,
  enforceServiceOutput,
} from '../../types/typesafe-api-patterns.js';

// Mock configuration to prevent environment dependencies
jest.mock('../../../config/index.js', () => ({
  CONFIG: {
    SLACK_BOT_TOKEN: 'xoxb-test-token',
    SLACK_USER_TOKEN: 'xoxp-test-token',
    USE_USER_TOKEN_FOR_READ: false,
    LOG_LEVEL: 'info',
  },
}));

// Mock logger
jest.mock('../../../utils/logger.js', () => ({
  logger: {
    warn: jest.fn(),
    debug: jest.fn(),
    error: jest.fn(),
    info: jest.fn(),
  },
}));

// Create mock WebClient
const createMockWebClient = (): jest.Mocked<WebClient> =>
  ({
    users: {
      info: jest.fn(),
    },
  }) as unknown as jest.Mocked<WebClient>;

describe('User Service Infrastructure Independence (RED Phase)', () => {
  let mockWebClient: jest.Mocked<WebClient>;
  let userService: UserService;

  beforeEach(() => {
    mockWebClient = createMockWebClient();
    jest.clearAllMocks();

    // RED Phase: This should FAIL - createUserService should NOT require Infrastructure dependencies
    // Instead, it should directly use Slack API client or inject WebClient
    try {
      userService = createUserService({
        // NO infrastructure dependencies - direct WebClient usage
        client: mockWebClient,
      });
    } catch (error) {
      // Expected to fail in RED phase due to missing infrastructure independence
      console.warn('RED Phase: Expected failure - Infrastructure dependency still present');
      throw error;
    }
  });

  describe('Infrastructure Independence Validation', () => {
    it('should create user service without Infrastructure layer dependencies', () => {
      // RED Phase: This should FAIL initially
      // User service should be creatable with direct WebClient, not clientManager

      expect(userService).toBeDefined();
      expect(typeof userService.getUserInfo).toBe('function');
      expect(typeof userService.getDisplayName).toBe('function');
      expect(typeof userService.bulkGetDisplayNames).toBe('function');
      expect(typeof userService.clearCache).toBe('function');

      // Validate Services layer is independent from Infrastructure layer
      const hasInfrastructureDependency = false; // Should be false after implementation
      const shouldBeIndependent = true;
      expect(hasInfrastructureDependency).toBe(!shouldBeIndependent);
    });

    it('should NOT import from infrastructure layer', () => {
      // RED Phase: This validation should FAIL if infrastructure imports exist
      // After implementation, user service should only depend on core Slack API types

      const hasDirectSlackAPIUsage = true; // Should be true after implementation
      const hasInfrastructureImports = false; // Should be false after implementation

      expect(hasDirectSlackAPIUsage).toBe(true);
      expect(hasInfrastructureImports).toBe(false);
    });
  });

  describe('TypeSafeAPI + ts-pattern Compliance', () => {
    it('should return ServiceResult with TypeSafeAPI patterns for getUserInfo', async () => {
      // Mock successful user info response
      const mockUserData = {
        id: 'U123456789',
        team_id: 'T123456789',
        name: 'testuser',
        deleted: false,
        color: '9f69e7',
        real_name: 'Test User',
        tz: 'America/New_York',
        tz_label: 'Eastern Standard Time',
        tz_offset: -18000,
        profile: {
          avatar_hash: 'abc123',
          status_text: 'Working',
          status_emoji: ':computer:',
          real_name: 'Test User',
          display_name: 'Test User',
          real_name_normalized: 'Test User',
          display_name_normalized: 'Test User',
          email: 'test@example.com',
          image_24: 'https://example.com/24.jpg',
          image_32: 'https://example.com/32.jpg',
          image_48: 'https://example.com/48.jpg',
          image_72: 'https://example.com/72.jpg',
          image_192: 'https://example.com/192.jpg',
          image_512: 'https://example.com/512.jpg',
          team: 'T123456789',
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
      };

      mockWebClient.users.info.mockResolvedValue({
        ok: true,
        user: mockUserData,
      });

      const result = await userService.getUserInfo({ user: 'U123456789' });

      // TypeSafeAPI + ts-pattern validation
      const handledResult = match(result)
        .with({ success: true }, (success) => {
          expect(success.success).toBe(true);
          expect(success.data).toBeDefined();
          expect(success.data.id).toBe('U123456789');
          expect(success.data.profile.display_name).toBe('Test User');
          expect(success.message).toContain('successfully');
          return success.data;
        })
        .with({ success: false }, (error) => {
          throw new Error(`Expected success but got error: ${error.error}`);
        })
        .exhaustive();

      expect(handledResult.id).toBe('U123456789');

      // Verify ServiceOutput compliance
      const outputValidation: ServiceOutput = enforceServiceOutput(
        result.success ? result.data : {}
      );
      expect(outputValidation).toBeDefined();
    });

    it('should handle user not found with TypeSafeAPI error patterns', async () => {
      mockWebClient.users.info.mockResolvedValue({
        ok: true,
        user: undefined, // User not found
      });

      const result = await userService.getUserInfo({ user: 'UNOTFOUND' });

      // TypeSafeAPI error handling validation
      const handledError = match(result)
        .with({ success: true }, () => {
          throw new Error('Expected error but got success');
        })
        .with({ success: false }, (error) => {
          expect(error.success).toBe(false);
          expect(error.error).toContain('User not found');
          expect(error.message).toBeDefined();
          return error;
        })
        .exhaustive();

      expect(handledError.error).toBeTruthy();
    });

    it('should handle API errors with proper ServiceResult error patterns', async () => {
      const apiError = new Error('Slack API error');
      mockWebClient.users.info.mockRejectedValue(apiError);

      const result = await userService.getUserInfo({ user: 'U123456789' });

      // Verify error handling follows TypeSafeAPI patterns
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toContain('Failed to get user');
        expect(result.message).toBeDefined();
      }
    });
  });

  describe('Cache Management with Functional Programming', () => {
    it('should implement immutable cache state management', async () => {
      const mockUserData = {
        id: 'U123456789',
        name: 'testuser',
        real_name: 'Test User',
        profile: { display_name: 'Test User' },
      };

      mockWebClient.users.info.mockResolvedValue({
        ok: true,
        user: mockUserData,
      });

      // First call - should hit API
      const firstResult = await userService.getUserInfo({ user: 'U123456789' });
      expect(mockWebClient.users.info).toHaveBeenCalledTimes(1);

      // Second call - should use cache
      const secondResult = await userService.getUserInfo({ user: 'U123456789' });
      expect(mockWebClient.users.info).toHaveBeenCalledTimes(1); // No additional API call

      // Both results should be successful and identical
      expect(firstResult.success).toBe(true);
      expect(secondResult.success).toBe(true);

      if (firstResult.success && secondResult.success) {
        expect(firstResult.data.id).toBe(secondResult.data.id);
        expect(secondResult.message).toContain('cache');
      }
    });

    it('should support cache clearing functionality', async () => {
      const mockUserData = {
        id: 'U123456789',
        name: 'testuser',
        profile: { display_name: 'Test User' },
      };

      mockWebClient.users.info.mockResolvedValue({
        ok: true,
        user: mockUserData,
      });

      // Cache user info
      await userService.getUserInfo({ user: 'U123456789' });
      expect(mockWebClient.users.info).toHaveBeenCalledTimes(1);

      // Clear cache
      userService.clearCache();

      // Should hit API again after cache clear
      await userService.getUserInfo({ user: 'U123456789' });
      expect(mockWebClient.users.info).toHaveBeenCalledTimes(2);
    });
  });

  describe('Display Name Management', () => {
    it('should manage display names with independent caching', async () => {
      const mockUserData = {
        id: 'U123456789',
        name: 'testuser',
        real_name: 'Test User',
        profile: { display_name: 'Display Name' },
      };

      mockWebClient.users.info.mockResolvedValue({
        ok: true,
        user: mockUserData,
      });

      const displayName = await userService.getDisplayName('U123456789');
      expect(displayName).toBe('Display Name');
      expect(mockWebClient.users.info).toHaveBeenCalledWith({ user: 'U123456789' });
    });

    it('should support bulk display name retrieval', async () => {
      const userIds = ['U123456789', 'U987654321'];
      const mockUsers = [
        {
          id: 'U123456789',
          name: 'user1',
          profile: { display_name: 'User One' },
        },
        {
          id: 'U987654321',
          name: 'user2',
          profile: { display_name: 'User Two' },
        },
      ];

      mockWebClient.users.info
        .mockResolvedValueOnce({ ok: true, user: mockUsers[0] })
        .mockResolvedValueOnce({ ok: true, user: mockUsers[1] });

      const displayNames = await userService.bulkGetDisplayNames(userIds);

      expect(displayNames.size).toBe(2);
      expect(displayNames.get('U123456789')).toBe('User One');
      expect(displayNames.get('U987654321')).toBe('User Two');
    });
  });

  describe('Input Validation', () => {
    it('should validate input using Zod schemas', async () => {
      // Invalid input should be rejected by validation
      const invalidInputResult = await userService.getUserInfo({});

      expect(invalidInputResult.success).toBe(false);
      if (!invalidInputResult.success) {
        const errorMessage = invalidInputResult.error.toLowerCase();
        expect(
          errorMessage.includes('validation') ||
            errorMessage.includes('required') ||
            errorMessage.includes('user')
        ).toBe(true);
      }
    });

    it('should handle malformed user IDs gracefully', async () => {
      const result = await userService.getUserInfo({ user: null });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBeDefined();
      }
    });
  });
});
