/**
 * User transformers test suite
 * Tests SlackUser to UserInfoOutput transformation utilities
 */

import {
  transformSlackUserToUserInfoOutput,
  extractUserCapabilities,
  extractUserProfile,
} from '../slack/services/users/user-transformers.js';
import type { SlackUser } from '../slack/types/core/users.js';

describe('User Transformers', () => {
  const mockSlackUser: SlackUser = {
    id: 'U1234567890',
    team_id: 'T1234567890',
    name: 'john.doe',
    deleted: false,
    color: '9f69e7',
    real_name: 'John Doe',
    tz: 'America/New_York',
    tz_label: 'Eastern Standard Time',
    tz_offset: -18000,
    profile: {
      avatar_hash: 'g1234567890',
      status_text: 'Working remotely',
      status_emoji: ':house:',
      real_name: 'John Doe',
      display_name: 'johndoe',
      real_name_normalized: 'John Doe',
      display_name_normalized: 'johndoe',
      email: 'john.doe@example.com',
      image_original: 'https://example.com/avatar_original.jpg',
      image_24: 'https://example.com/avatar_24.jpg',
      image_32: 'https://example.com/avatar_32.jpg',
      image_48: 'https://example.com/avatar_48.jpg',
      image_72: 'https://example.com/avatar_72.jpg',
      image_192: 'https://example.com/avatar_192.jpg',
      image_512: 'https://example.com/avatar_512.jpg',
      team: 'T1234567890',
      title: 'Senior Developer',
    },
    is_admin: true,
    is_owner: false,
    is_primary_owner: false,
    is_restricted: false,
    is_ultra_restricted: false,
    is_bot: false,
    is_app_user: false,
    updated: 1671234567,
    is_email_confirmed: true,
    who_can_share_contact_card: 'EVERYONE',
  };

  const mockBotUser: SlackUser = {
    id: 'B9876543210',
    team_id: 'T1234567890',
    name: 'testbot',
    deleted: false,
    color: '3aa3e3',
    real_name: 'Test Bot',
    tz: 'UTC',
    tz_label: 'UTC',
    tz_offset: 0,
    profile: {
      avatar_hash: 'bot123',
      status_text: '',
      status_emoji: '',
      real_name: 'Test Bot',
      display_name: 'Test Bot',
      real_name_normalized: 'Test Bot',
      display_name_normalized: 'Test Bot',
      image_24: 'https://example.com/bot_24.jpg',
      image_32: 'https://example.com/bot_32.jpg',
      image_48: 'https://example.com/bot_48.jpg',
      image_72: 'https://example.com/bot_72.jpg',
      image_192: 'https://example.com/bot_192.jpg',
      image_512: 'https://example.com/bot_512.jpg',
      team: 'T1234567890',
    },
    is_admin: false,
    is_owner: false,
    is_primary_owner: false,
    is_restricted: false,
    is_ultra_restricted: false,
    is_bot: true,
    is_app_user: true,
    updated: 1671234567,
    is_email_confirmed: false,
    who_can_share_contact_card: 'NONE',
  };

  describe('transformSlackUserToUserInfoOutput', () => {
    it('should transform complete SlackUser to UserInfoOutput correctly', () => {
      const displayName = 'John D.';
      const result = transformSlackUserToUserInfoOutput(mockSlackUser, displayName);

      expect(result.id).toBe('U1234567890');
      expect(result.name).toBe('john.doe');
      expect(result.displayName).toBe('John D.');
      expect(result.realName).toBe('John Doe');
      expect(result.email).toBe('john.doe@example.com');
      expect(result.isBot).toBe(false);
      expect(result.isAdmin).toBe(true);
      expect(result.isOwner).toBe(false);
      expect(result.deleted).toBe(false);

      // Check profile transformation
      expect(result.profile.image24).toBe('https://example.com/avatar_24.jpg');
      expect(result.profile.image32).toBe('https://example.com/avatar_32.jpg');
      expect(result.profile.image48).toBe('https://example.com/avatar_48.jpg');
      expect(result.profile.image72).toBe('https://example.com/avatar_72.jpg');
      expect(result.profile.image192).toBe('https://example.com/avatar_192.jpg');
      expect(result.profile.image512).toBe('https://example.com/avatar_512.jpg');
      expect(result.profile.statusText).toBe('Working remotely');
      expect(result.profile.statusEmoji).toBe(':house:');
      expect(result.profile.title).toBe('Senior Developer');
    });

    it('should transform bot user correctly', () => {
      const displayName = 'Test Bot Display';
      const result = transformSlackUserToUserInfoOutput(mockBotUser, displayName);

      expect(result.id).toBe('B9876543210');
      expect(result.name).toBe('testbot');
      expect(result.displayName).toBe('Test Bot Display');
      expect(result.realName).toBe('Test Bot');
      expect(result.email).toBeUndefined();
      expect(result.isBot).toBe(true);
      expect(result.isAdmin).toBe(false);
      expect(result.isOwner).toBe(false);
      expect(result.deleted).toBe(false);

      // Check profile transformation for bot
      expect(result.profile.statusText).toBe('');
      expect(result.profile.statusEmoji).toBe('');
      expect(result.profile.title).toBeUndefined();
    });

    it('should handle missing optional fields gracefully', () => {
      const minimalUser: SlackUser = {
        ...mockSlackUser,
        profile: {
          ...mockSlackUser.profile,
          email: undefined,
          title: undefined,
          status_text: '',
          status_emoji: '',
        },
      };

      const result = transformSlackUserToUserInfoOutput(minimalUser, 'Display Name');

      expect(result.email).toBeUndefined();
      expect(result.profile.title).toBeUndefined();
      expect(result.profile.statusText).toBe('');
      expect(result.profile.statusEmoji).toBe('');
    });
  });

  describe('extractUserCapabilities', () => {
    it('should extract admin user capabilities correctly', () => {
      const capabilities = extractUserCapabilities(mockSlackUser);

      expect(capabilities.isAdmin).toBe(true);
      expect(capabilities.isOwner).toBe(false);
      expect(capabilities.isPrimaryOwner).toBe(false);
      expect(capabilities.isBot).toBe(false);
      expect(capabilities.isAppUser).toBe(false);
      expect(capabilities.isRestricted).toBe(false);
      expect(capabilities.isUltraRestricted).toBe(false);
      expect(capabilities.deleted).toBe(false);
    });

    it('should extract bot user capabilities correctly', () => {
      const capabilities = extractUserCapabilities(mockBotUser);

      expect(capabilities.isAdmin).toBe(false);
      expect(capabilities.isOwner).toBe(false);
      expect(capabilities.isPrimaryOwner).toBe(false);
      expect(capabilities.isBot).toBe(true);
      expect(capabilities.isAppUser).toBe(true);
      expect(capabilities.isRestricted).toBe(false);
      expect(capabilities.isUltraRestricted).toBe(false);
      expect(capabilities.deleted).toBe(false);
    });

    it('should extract owner capabilities correctly', () => {
      const ownerUser: SlackUser = {
        ...mockSlackUser,
        is_admin: true,
        is_owner: true,
        is_primary_owner: true,
      };

      const capabilities = extractUserCapabilities(ownerUser);

      expect(capabilities.isAdmin).toBe(true);
      expect(capabilities.isOwner).toBe(true);
      expect(capabilities.isPrimaryOwner).toBe(true);
    });
  });

  describe('extractUserProfile', () => {
    it('should extract complete user profile correctly', () => {
      const profile = extractUserProfile(mockSlackUser);

      expect(profile.displayName).toBe('johndoe');
      expect(profile.realName).toBe('John Doe');
      expect(profile.email).toBe('john.doe@example.com');
      expect(profile.statusText).toBe('Working remotely');
      expect(profile.statusEmoji).toBe(':house:');
      expect(profile.title).toBe('Senior Developer');

      // Check timezone information
      expect(profile.timezone.tz).toBe('America/New_York');
      expect(profile.timezone.label).toBe('Eastern Standard Time');
      expect(profile.timezone.offset).toBe(-18000);

      // Check image URLs
      expect(profile.images.image24).toBe('https://example.com/avatar_24.jpg');
      expect(profile.images.image32).toBe('https://example.com/avatar_32.jpg');
      expect(profile.images.image48).toBe('https://example.com/avatar_48.jpg');
      expect(profile.images.image72).toBe('https://example.com/avatar_72.jpg');
      expect(profile.images.image192).toBe('https://example.com/avatar_192.jpg');
      expect(profile.images.image512).toBe('https://example.com/avatar_512.jpg');
      expect(profile.images.imageOriginal).toBe('https://example.com/avatar_original.jpg');

      // Check normalized fields
      expect(profile.normalized.realName).toBe('John Doe');
      expect(profile.normalized.displayName).toBe('johndoe');
    });

    it('should fallback to available display name when display_name is missing', () => {
      const userWithoutDisplayName: SlackUser = {
        ...mockSlackUser,
        profile: {
          ...mockSlackUser.profile,
          display_name: '',
        },
      };

      const profile = extractUserProfile(userWithoutDisplayName);

      expect(profile.displayName).toBe('John Doe'); // Falls back to real_name
    });

    it('should fallback to name when both display_name and real_name are missing', () => {
      const userWithMinimalInfo: SlackUser = {
        ...mockSlackUser,
        real_name: '',
        profile: {
          ...mockSlackUser.profile,
          display_name: '',
        },
      };

      const profile = extractUserProfile(userWithMinimalInfo);

      expect(profile.displayName).toBe('john.doe'); // Falls back to name
    });
  });
});
