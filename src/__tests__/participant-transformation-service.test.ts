/**
 * Tests for ParticipantTransformationService
 *
 * Validates the centralized participant building logic that replaces
 * duplicated code across multiple thread service functions.
 */

import { createParticipantTransformationService } from '../slack/services/threads/participant-transformation-service.js';
import type { SlackMessage, SlackUser } from '../slack/types/index.js';
import type { ServiceResult } from '../slack/types/typesafe-api-patterns.js';
import { jest } from '@jest/globals';

// Mock the configuration before importing anything else
jest.mock('../config/index.js', () => ({
  CONFIG: {
    SLACK_BOT_TOKEN: 'test-bot-token',
    SLACK_USER_TOKEN: 'test-user-token',
    USE_USER_TOKEN_FOR_READ: false,
    LOG_LEVEL: 'error',
    SLACK_ENABLE_RATE_LIMIT_RETRY: true,
    SLACK_RATE_LIMIT_RETRIES: 3,
    SLACK_MAX_REQUEST_CONCURRENCY: 3,
    SLACK_REJECT_RATE_LIMITED_CALLS: false,
  },
}));

// Mock the logger to prevent configuration issues
jest.mock('../utils/logger.js', () => ({
  logger: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

describe('ParticipantTransformationService', () => {
  const mockDomainUserService = {
    getUserInfo: jest.fn<(args: { user: string }) => Promise<ServiceResult<SlackUser>>>(),
  };

  const mockInfrastructureUserService = {
    bulkGetDisplayNames: jest.fn<(userIds: string[]) => Promise<ReadonlyMap<string, string>>>(),
    getUserInfoDirect: jest.fn<(userId: string) => Promise<SlackUser>>(),
  };

  const participantTransformationService = createParticipantTransformationService({
    domainUserService: mockDomainUserService,
    infrastructureUserService: mockInfrastructureUserService,
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('buildParticipantsFromMessages', () => {
    const mockMessages: SlackMessage[] = [
      {
        type: 'message',
        user: 'U1234567890',
        text: 'Hello, this is the first message',
        ts: '1627846261.001',
        thread_ts: '1627846261.001',
      },
      {
        type: 'message',
        user: 'U0987654321',
        text: 'This is a reply',
        ts: '1627846262.002',
        thread_ts: '1627846261.001',
      },
      {
        type: 'message',
        user: 'U1234567890',
        text: 'Another message from the first user',
        ts: '1627846263.003',
        thread_ts: '1627846261.001',
      },
    ];

    const mockUser1: SlackUser = {
      id: 'U1234567890',
      team_id: 'T1234567890',
      name: 'john.doe',
      deleted: false,
      color: '9f69e7',
      real_name: 'John Doe',
      tz: 'America/New_York',
      tz_label: 'Eastern Daylight Time',
      tz_offset: -14400,
      profile: {
        avatar_hash: 'abc123',
        status_text: 'Working remotely',
        status_emoji: ':house:',
        real_name: 'John Doe',
        display_name: 'johndoe',
        real_name_normalized: 'John Doe',
        display_name_normalized: 'johndoe',
        email: 'john.doe@example.com',
        image_24: 'https://avatars.slack-edge.com/2021-05-07/image_24.jpg',
        image_32: 'https://avatars.slack-edge.com/2021-05-07/image_32.jpg',
        image_48: 'https://avatars.slack-edge.com/2021-05-07/image_48.jpg',
        image_72: 'https://avatars.slack-edge.com/2021-05-07/image_72.jpg',
        image_192: 'https://avatars.slack-edge.com/2021-05-07/image_192.jpg',
        image_512: 'https://avatars.slack-edge.com/2021-05-07/image_512.jpg',
        team: 'T1234567890',
      },
      is_admin: true,
      is_owner: false,
      is_primary_owner: false,
      is_restricted: false,
      is_ultra_restricted: false,
      is_bot: false,
      is_app_user: false,
      updated: 1627846261,
      is_email_confirmed: true,
      who_can_share_contact_card: 'EVERYONE',
    };

    const mockUser2: SlackUser = {
      id: 'U0987654321',
      team_id: 'T1234567890',
      name: 'jane.smith',
      deleted: false,
      color: '4bbe2e',
      real_name: 'Jane Smith',
      tz: 'America/Los_Angeles',
      tz_label: 'Pacific Daylight Time',
      tz_offset: -25200,
      profile: {
        avatar_hash: 'def456',
        status_text: '',
        status_emoji: '',
        real_name: 'Jane Smith',
        display_name: 'janesmith',
        real_name_normalized: 'Jane Smith',
        display_name_normalized: 'janesmith',
        email: 'jane.smith@example.com',
        image_24: 'https://avatars.slack-edge.com/2021-05-07/image_24.jpg',
        image_32: 'https://avatars.slack-edge.com/2021-05-07/image_32.jpg',
        image_48: 'https://avatars.slack-edge.com/2021-05-07/image_48.jpg',
        image_72: 'https://avatars.slack-edge.com/2021-05-07/image_72.jpg',
        image_192: 'https://avatars.slack-edge.com/2021-05-07/image_192.jpg',
        image_512: 'https://avatars.slack-edge.com/2021-05-07/image_512.jpg',
        team: 'T1234567890',
      },
      is_admin: false,
      is_owner: false,
      is_primary_owner: false,
      is_restricted: false,
      is_ultra_restricted: false,
      is_bot: false,
      is_app_user: false,
      updated: 1627846261,
      is_email_confirmed: true,
      who_can_share_contact_card: 'EVERYONE',
    };

    it('should successfully build participants from messages with bulk operations', async () => {
      // Mock bulk display names
      mockInfrastructureUserService.bulkGetDisplayNames.mockResolvedValue(
        new Map([
          ['U1234567890', 'johndoe'],
          ['U0987654321', 'janesmith'],
        ])
      );

      // Mock domain user service responses
      mockDomainUserService.getUserInfo
        .mockResolvedValueOnce({ success: true, data: mockUser1, message: 'User retrieved' })
        .mockResolvedValueOnce({ success: true, data: mockUser2, message: 'User retrieved' });

      const result =
        await participantTransformationService.buildParticipantsFromMessages(mockMessages);

      expect(result.success).toBe(true);
      if (result.success) {
        const { participants, metadata } = result.data;

        // Should have 2 unique participants
        expect(participants).toHaveLength(2);
        expect(metadata.totalUsers).toBe(2);
        expect(metadata.successfulLookups).toBe(2);
        expect(metadata.fallbackUsers).toBe(0);

        // Check first participant (U1234567890 - has 2 messages)
        const participant1 = participants.find((p) => p.user_id === 'U1234567890');
        expect(participant1).toBeDefined();
        expect(participant1?.username).toBe('john.doe');
        expect(participant1?.real_name).toBe('John Doe');
        expect(participant1?.message_count).toBe(2);
        expect(participant1?.is_admin).toBe(true);
        expect(participant1?.is_bot).toBe(false);

        // Check second participant (U0987654321 - has 1 message)
        const participant2 = participants.find((p) => p.user_id === 'U0987654321');
        expect(participant2).toBeDefined();
        expect(participant2?.username).toBe('jane.smith');
        expect(participant2?.real_name).toBe('Jane Smith');
        expect(participant2?.message_count).toBe(1);
        expect(participant2?.is_admin).toBe(false);
        expect(participant2?.is_bot).toBe(false);
      }

      // Verify bulk operations were used
      expect(mockInfrastructureUserService.bulkGetDisplayNames).toHaveBeenCalledWith([
        'U1234567890',
        'U0987654321',
      ]);
      expect(mockDomainUserService.getUserInfo).toHaveBeenCalledTimes(2);
    });

    it('should handle partial user lookup failures gracefully', async () => {
      // Mock bulk display names
      mockInfrastructureUserService.bulkGetDisplayNames.mockResolvedValue(
        new Map([
          ['U1234567890', 'johndoe'],
          ['U0987654321', 'U0987654321'], // Fallback to user ID
        ])
      );

      // Mock one successful and one failed user lookup
      mockDomainUserService.getUserInfo
        .mockResolvedValueOnce({ success: true, data: mockUser1, message: 'User retrieved' })
        .mockResolvedValueOnce({
          success: false,
          error: 'User not found',
          message: 'User not found',
        });

      const result =
        await participantTransformationService.buildParticipantsFromMessages(mockMessages);

      expect(result.success).toBe(true);
      if (result.success) {
        const { participants, metadata } = result.data;

        expect(participants).toHaveLength(2);
        expect(metadata.totalUsers).toBe(2);
        expect(metadata.successfulLookups).toBe(1);
        expect(metadata.fallbackUsers).toBe(1);

        // First user should have complete info
        const participant1 = participants.find((p) => p.user_id === 'U1234567890');
        expect(participant1?.username).toBe('john.doe');
        expect(participant1?.is_admin).toBe(true);

        // Second user should have fallback info
        const participant2 = participants.find((p) => p.user_id === 'U0987654321');
        expect(participant2?.username).toBe('U0987654321');
        expect(participant2?.is_admin).toBe(false);
        expect(participant2?.real_name).toBe('');
      }
    });

    it('should return empty participants for empty messages', async () => {
      const result = await participantTransformationService.buildParticipantsFromMessages([]);

      expect(result.success).toBe(true);
      if (result.success) {
        const { participants, metadata } = result.data;
        expect(participants).toHaveLength(0);
        expect(metadata.totalUsers).toBe(0);
        expect(metadata.successfulLookups).toBe(0);
        expect(metadata.fallbackUsers).toBe(0);
      }
    });

    it('should handle bulk operation failures by falling back to individual lookups', async () => {
      // Mock bulk display names to fail
      mockInfrastructureUserService.bulkGetDisplayNames.mockRejectedValue(
        new Error('Bulk operation failed')
      );

      // Mock individual user lookups to succeed
      mockDomainUserService.getUserInfo
        .mockResolvedValueOnce({ success: true, data: mockUser1, message: 'User retrieved' })
        .mockResolvedValueOnce({ success: true, data: mockUser2, message: 'User retrieved' });

      const result =
        await participantTransformationService.buildParticipantsFromMessages(mockMessages);

      expect(result.success).toBe(true);
      if (result.success) {
        const { participants, metadata } = result.data;
        expect(participants).toHaveLength(2);
        expect(metadata.successfulLookups).toBe(2);
      }
    });
  });

  describe('getEnhancedUserInfoForExport', () => {
    const userIds = ['U1234567890', 'U0987654321'];

    const mockUser1: SlackUser = {
      id: 'U1234567890',
      team_id: 'T1234567890',
      name: 'john.doe',
      deleted: false,
      color: '9f69e7',
      real_name: 'John Doe',
      tz: 'America/New_York',
      tz_label: 'Eastern Daylight Time',
      tz_offset: -14400,
      profile: {
        avatar_hash: 'abc123',
        status_text: 'Working remotely',
        status_emoji: ':house:',
        real_name: 'John Doe',
        display_name: 'johndoe',
        real_name_normalized: 'John Doe',
        display_name_normalized: 'johndoe',
        email: 'john.doe@example.com',
        image_24: 'https://avatars.slack-edge.com/2021-05-07/image_24.jpg',
        image_32: 'https://avatars.slack-edge.com/2021-05-07/image_32.jpg',
        image_48: 'https://avatars.slack-edge.com/2021-05-07/image_48.jpg',
        image_72: 'https://avatars.slack-edge.com/2021-05-07/image_72.jpg',
        image_192: 'https://avatars.slack-edge.com/2021-05-07/image_192.jpg',
        image_512: 'https://avatars.slack-edge.com/2021-05-07/image_512.jpg',
        team: 'T1234567890',
      },
      is_admin: true,
      is_owner: false,
      is_primary_owner: false,
      is_restricted: false,
      is_ultra_restricted: false,
      is_bot: false,
      is_app_user: false,
      updated: 1627846261,
      is_email_confirmed: true,
      who_can_share_contact_card: 'EVERYONE',
    };

    it('should successfully get enhanced user info for export', async () => {
      // Mock bulk display names
      mockInfrastructureUserService.bulkGetDisplayNames.mockResolvedValue(
        new Map([
          ['U1234567890', 'johndoe'],
          ['U0987654321', 'janesmith'],
        ])
      );

      // Mock domain user service responses
      mockDomainUserService.getUserInfo
        .mockResolvedValueOnce({ success: true, data: mockUser1, message: 'User retrieved' })
        .mockResolvedValueOnce({
          success: false,
          error: 'User not found',
          message: 'User not found',
        });

      const result = await participantTransformationService.getEnhancedUserInfoForExport(userIds);

      expect(result.success).toBe(true);
      if (result.success) {
        const userInfoMap = result.data.userInfoMap;

        expect(Object.keys(userInfoMap)).toHaveLength(2);

        // Check successful user
        const user1Info = userInfoMap['U1234567890'];
        expect(user1Info).toBeDefined();
        expect(user1Info?.displayName).toBe('johndoe');
        expect(user1Info?.isAdmin).toBe(true);
        expect(user1Info?.isBot).toBe(false);

        // Check fallback user
        const user2Info = userInfoMap['U0987654321'];
        expect(user2Info).toBeDefined();
        expect(user2Info?.displayName).toBe('janesmith');
        expect(user2Info?.isAdmin).toBe(false);
        expect(user2Info?.isBot).toBe(false);
      }
    });

    it('should return empty map for empty user IDs', async () => {
      const result = await participantTransformationService.getEnhancedUserInfoForExport([]);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(Object.keys(result.data.userInfoMap)).toHaveLength(0);
      }

      // Should not call any user services
      expect(mockInfrastructureUserService.bulkGetDisplayNames).not.toHaveBeenCalled();
      expect(mockDomainUserService.getUserInfo).not.toHaveBeenCalled();
    });

    it('should handle all user lookup failures gracefully', async () => {
      // Mock bulk display names - when domain service fails, fallback uses bulk display names
      mockInfrastructureUserService.bulkGetDisplayNames.mockResolvedValue(
        new Map([
          ['U1234567890', 'johndoe'], // Bulk lookup can still succeed
          ['U0987654321', 'janesmith'],
        ])
      );

      // Mock all user lookups to fail
      mockDomainUserService.getUserInfo.mockResolvedValue({
        success: false,
        error: 'User not found',
        message: 'User not found',
      });

      const result = await participantTransformationService.getEnhancedUserInfoForExport(userIds);

      expect(result.success).toBe(true);
      if (result.success) {
        const userInfoMap = result.data.userInfoMap;

        expect(Object.keys(userInfoMap)).toHaveLength(2);

        // All users should have fallback info with display names from bulk lookup
        const user1Info = userInfoMap['U1234567890'];
        expect(user1Info).toBeDefined();
        expect(user1Info?.displayName).toBe('johndoe'); // From bulk lookup which still works
        expect(user1Info?.isAdmin).toBe(false);
        expect(user1Info?.isBot).toBe(false);

        const user2Info = userInfoMap['U0987654321'];
        expect(user2Info).toBeDefined();
        expect(user2Info?.displayName).toBe('janesmith'); // From bulk lookup which still works
        expect(user2Info?.isAdmin).toBe(false);
        expect(user2Info?.isBot).toBe(false);
      }
    });
  });
});
