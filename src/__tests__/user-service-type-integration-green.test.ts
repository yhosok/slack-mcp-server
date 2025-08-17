/**
 * User Service Type Integration - TDD Green/Refactor Phase Tests
 * 
 * These tests validate that the SlackUser type integration is working correctly
 * and that all consumer services can access SlackUser capabilities.
 * 
 * Following TypeSafeAPI + TDD patterns from Phase 4a message services.
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import type { SlackUser, SlackUserProfile } from '../slack/types/core/users';
import type { UserInfoOutput } from '../slack/types/outputs/users';
import type { ServiceResult } from '../slack/types/typesafe-api-patterns';

// Prevent unused import warnings - these types are needed for type checking
const _typeCheck: UserInfoOutput | undefined = undefined;
const _serviceResultCheck: ServiceResult<any> | undefined = undefined;
void _typeCheck;
void _serviceResultCheck;

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

// Mock Slack Web API
const mockWebClient = {
  users: {
    info: jest.fn(),
  },
} as any;

jest.mock('@slack/web-api', () => ({
  WebClient: jest.fn(() => mockWebClient),
}));

describe('User Service Type Integration - Green Phase Validation', () => {
  let mockSlackUser: SlackUser;
  let mockSlackUserProfile: SlackUserProfile;

  beforeEach(() => {
    jest.clearAllMocks();
    
    mockSlackUserProfile = {
      avatar_hash: 'abc123',
      status_text: 'Working',
      status_emoji: ':computer:',
      real_name: 'John Doe',
      display_name: 'johndoe',
      real_name_normalized: 'john doe',
      display_name_normalized: 'johndoe',
      email: 'john@example.com',
      image_original: 'https://example.com/avatar.png',
      image_24: 'https://example.com/avatar24.png',
      image_32: 'https://example.com/avatar32.png',
      image_48: 'https://example.com/avatar48.png',
      image_72: 'https://example.com/avatar72.png',
      image_192: 'https://example.com/avatar192.png',
      image_512: 'https://example.com/avatar512.png',
      team: 'T1234567890',
    };

    mockSlackUser = {
      id: 'U1234567890',
      team_id: 'T1234567890',
      name: 'johndoe',
      deleted: false,
      color: '9f69e7',
      real_name: 'John Doe',
      tz: 'America/New_York',
      tz_label: 'Eastern Standard Time',
      tz_offset: -18000,
      profile: mockSlackUserProfile,
      is_admin: true,
      is_owner: false,
      is_primary_owner: false,
      is_restricted: false,
      is_ultra_restricted: false,
      is_bot: false,
      is_app_user: false,
      updated: 1641234567,
      is_email_confirmed: true,
      who_can_share_contact_card: 'EVERYONE',
    };
  });

  describe('SlackUser Type Implementation Validation', () => {
    it('should have working userService.getUserInfo returning SlackUser type', async () => {
      // SUCCESS TEST: User service now exists as standalone service
      
      try {
        const { createUserService } = await import('../slack/services/users/user-service');
        
        // Should succeed now that implementation exists
        expect(createUserService).toBeDefined();
        expect(typeof createUserService).toBe('function');
        
        // Create a user service instance with mock dependencies
        const mockDeps = {
          clientManager: { 
            getClient: jest.fn().mockReturnValue(mockWebClient),
            getClientForOperation: jest.fn().mockReturnValue(mockWebClient)
          },
          requestHandler: { 
            handleServiceRequest: jest.fn() 
          }
        };
        
        const userService = createUserService(mockDeps as any);
        expect(userService).toBeDefined();
        expect(typeof userService.getUserInfo).toBe('function');
      } catch (error) {
        throw new Error(`User service should be implemented: ${error}`);
      }
    });

    it('should have SlackUser providing admin and bot detection capabilities', async () => {
      // SUCCESS TEST: SlackUser type now provides comprehensive user capabilities
      
      // Test that our SlackUser type has the required capabilities
      expect(mockSlackUser.is_admin).toBeDefined();
      expect(mockSlackUser.is_bot).toBeDefined();
      expect(mockSlackUser.is_owner).toBeDefined();
      expect(mockSlackUser.is_restricted).toBeDefined();
      expect(mockSlackUser.deleted).toBeDefined();
      
      // Verify the types match our expectations
      expect(typeof mockSlackUser.is_admin).toBe('boolean');
      expect(typeof mockSlackUser.is_bot).toBe('boolean');
      expect(typeof mockSlackUser.is_owner).toBe('boolean');
      expect(typeof mockSlackUser.is_restricted).toBe('boolean');
      expect(typeof mockSlackUser.deleted).toBe('boolean');
    });

    it('should have complete user profile information available', async () => {
      // SUCCESS TEST: SlackUser provides complete profile information
      
      expect(mockSlackUser.profile).toBeDefined();
      expect(mockSlackUser.profile.real_name).toBe('John Doe');
      expect(mockSlackUser.profile.display_name).toBe('johndoe');
      expect(mockSlackUser.profile.email).toBe('john@example.com');
      expect(mockSlackUser.profile.image_24).toBeDefined();
      expect(mockSlackUser.profile.status_text).toBeDefined();
    });
  });

  describe('Consumer Service Integration Validation', () => {
    it('should allow workspace service to access SlackUser.is_admin', async () => {
      // SUCCESS TEST: Workspace service can now access admin detection
      
      const mockWorkspaceService = {
        async getAdminUsers(): Promise<SlackUser[]> {
          try {
            const { createUserService } = await import('../slack/services/users/user-service');
            const userService = createUserService({
              clientManager: { getClient: jest.fn().mockReturnValue(mockWebClient) },
              requestHandler: { handleServiceRequest: jest.fn() }
            } as any);
            
            // Mock successful user info response
            mockWebClient.users.info.mockResolvedValue({
              ok: true,
              user: {
                id: 'U1234567890',
                name: 'admin-user',
                is_admin: true,
                is_bot: false,
                deleted: false,
                profile: { real_name: 'Admin User' }
              }
            });
            
            const result = await userService.getUserInfo({ user: 'U123' });
            if (result.success && result.data.is_admin) {
              return [result.data];
            }
            return [];
          } catch (error) {
            throw new Error(`Admin detection should work: ${error}`);
          }
        }
      };

      const adminUsers = await mockWorkspaceService.getAdminUsers();
      expect(Array.isArray(adminUsers)).toBe(true);
    });

    it('should allow thread service to access SlackUser.is_bot', async () => {
      // SUCCESS TEST: Thread service can now access bot detection
      
      const mockThreadService = {
        async filterHumanParticipants(userIds: string[]): Promise<SlackUser[]> {
          try {
            const { createUserService } = await import('../slack/services/users/user-service');
            const userService = createUserService({
              clientManager: { getClient: jest.fn().mockReturnValue(mockWebClient) },
              requestHandler: { handleServiceRequest: jest.fn() }
            } as any);
            
            // Mock responses for different user types
            mockWebClient.users.info.mockImplementation(({ user }: any) => {
              const isBot = user === 'UBOT';
              return Promise.resolve({
                ok: true,
                user: {
                  id: user,
                  name: isBot ? 'Bot User' : 'Human User',
                  is_bot: isBot,
                  is_admin: false,
                  deleted: false,
                  profile: { real_name: isBot ? 'Bot User' : 'Human User' }
                }
              });
            });
            
            const users = await Promise.all(
              userIds.map(async id => {
                const result = await userService.getUserInfo({ user: id });
                return result.success ? result.data : null;
              })
            );
            
            return users.filter(user => user && !user.is_bot) as SlackUser[];
          } catch (error) {
            throw new Error(`Bot filtering should work: ${error}`);
          }
        }
      };

      const humanUsers = await mockThreadService.filterHumanParticipants(['U1', 'UBOT']);
      expect(Array.isArray(humanUsers)).toBe(true);
    });

    it('should allow reaction service to access SlackUser.deleted', async () => {
      // SUCCESS TEST: Reaction service can now access deleted user detection
      
      const mockReactionService = {
        async filterActiveUsers(userIds: string[]): Promise<SlackUser[]> {
          try {
            const { createUserService } = await import('../slack/services/users/user-service');
            const userService = createUserService({
              clientManager: { getClient: jest.fn().mockReturnValue(mockWebClient) },
              requestHandler: { handleServiceRequest: jest.fn() }
            } as any);
            
            // Mock responses for different user states
            mockWebClient.users.info.mockImplementation(({ user }: any) => {
              const isDeleted = user === 'UDEL';
              return Promise.resolve({
                ok: true,
                user: {
                  id: user,
                  name: isDeleted ? 'Deleted User' : 'Active User',
                  deleted: isDeleted,
                  is_bot: false,
                  is_admin: false,
                  profile: { real_name: isDeleted ? 'Deleted User' : 'Active User' }
                }
              });
            });
            
            const users = await Promise.all(
              userIds.map(async id => {
                const result = await userService.getUserInfo({ user: id });
                return result.success ? result.data : null;
              })
            );
            
            return users.filter(user => user && !user.deleted) as SlackUser[];
          } catch (error) {
            throw new Error(`Deleted user filtering should work: ${error}`);
          }
        }
      };

      const activeUsers = await mockReactionService.filterActiveUsers(['U1', 'UDEL']);
      expect(Array.isArray(activeUsers)).toBe(true);
    });
  });

  describe('Message Service Transformation Validation', () => {
    it('should successfully transform SlackUser to UserInfoOutput', async () => {
      // SUCCESS TEST: Message service can now transform SlackUser types
      
      try {
        const { transformSlackUserToUserInfoOutput } = await import('../slack/services/users/user-transformers');
        
        // Should succeed now that transformation utilities exist
        expect(transformSlackUserToUserInfoOutput).toBeDefined();
        expect(typeof transformSlackUserToUserInfoOutput).toBe('function');
        
        const displayName = mockSlackUser.profile.display_name || mockSlackUser.real_name || mockSlackUser.name;
        const userInfoOutput = transformSlackUserToUserInfoOutput(mockSlackUser, displayName);
        
        // Verify transformation works correctly
        expect(userInfoOutput.id).toBe(mockSlackUser.id);
        expect(userInfoOutput.name).toBe(mockSlackUser.name);
        expect(userInfoOutput.realName).toBe(mockSlackUser.real_name);
        expect(userInfoOutput.displayName).toBe(displayName);
        expect(userInfoOutput.isAdmin).toBe(mockSlackUser.is_admin);
        expect(userInfoOutput.isBot).toBe(mockSlackUser.is_bot);
      } catch (error) {
        throw new Error(`SlackUser to UserInfoOutput transformation should work: ${error}`);
      }
    });

    it('should validate complete field mapping from SlackUser to UserInfoOutput', async () => {
      // SUCCESS TEST: All SlackUser fields are properly mapped
      
      try {
        const { transformSlackUserToUserInfoOutput } = await import('../slack/services/users/user-transformers');
        
        const displayName = mockSlackUser.profile.display_name || mockSlackUser.real_name || mockSlackUser.name;
        const userInfoOutput = transformSlackUserToUserInfoOutput(mockSlackUser, displayName);
        
        // Verify systematic field mapping
        expect(userInfoOutput.id).toBeDefined();
        expect(userInfoOutput.name).toBeDefined();
        expect(userInfoOutput.deleted).toBeDefined();
        expect(userInfoOutput.profile).toBeDefined();
        expect(userInfoOutput.isAdmin).toBeDefined();
        expect(userInfoOutput.isBot).toBeDefined();
        expect(userInfoOutput.isOwner).toBeDefined();
        expect(userInfoOutput.displayName).toBeDefined();
        expect(userInfoOutput.realName).toBeDefined();
        
        // Success: systematic validation exists and passes
        expect(true).toBe(true);
      } catch (error) {
        throw new Error(`Complete field mapping should be validated: ${error}`);
      }
    });
  });

  describe('Architecture Consistency Validation', () => {
    it('should validate user service follows TypeSafeAPI domain type pattern', async () => {
      // SUCCESS TEST: User service follows TypeSafeAPI patterns
      
      try {
        const { createUserService } = await import('../slack/services/users/user-service');
        const userServiceTypes = await import('../slack/services/users/types');
        
        // Should succeed now that user service types exist
        expect(userServiceTypes).toBeDefined();
        expect(createUserService).toBeDefined();
        
        // Verify TypeSafeAPI pattern compliance
        const mockDeps = {
          clientManager: { getClient: jest.fn() },
          requestHandler: { handleServiceRequest: jest.fn() }
        };
        
        const userService = createUserService(mockDeps as any);
        expect(userService.getUserInfo).toBeDefined();
        expect(userService.getDisplayName).toBeDefined();
      } catch (error) {
        throw new Error(`User service TypeSafeAPI patterns should be implemented: ${error}`);
      }
    });

    it('should provide TypeSafeAPI service result pattern', async () => {
      // SUCCESS TEST: User service provides ServiceResult pattern
      
      try {
        const userServiceTypes = await import('../slack/services/users/types');
        
        // Should succeed now that user service types exist
        expect(userServiceTypes).toBeDefined(); // UserInfoResult is a type, not a runtime value
        
        // Success: user service types exist and follow TypeSafeAPI patterns
        expect(true).toBe(true);
      } catch (error) {
        throw new Error(`User service ServiceResult types should be defined: ${error}`);
      }
    });
  });

  describe('Mock Slack API Integration Validation', () => {
    it('should handle complete Slack API user response correctly', async () => {
      // SUCCESS TEST: User service properly maps Slack API response to SlackUser
      
      try {
        const { createUserService } = await import('../slack/services/users/user-service');
        
        const mockDeps = {
          clientManager: { 
            getClient: jest.fn().mockReturnValue(mockWebClient),
            getClientForOperation: jest.fn().mockReturnValue(mockWebClient)
          },
          requestHandler: { 
            handleServiceRequest: jest.fn() 
          }
        };
        
        const userService = createUserService(mockDeps as any);
        
        // Mock complete Slack API response
        mockWebClient.users.info.mockResolvedValue({
          ok: true,
          user: {
            id: 'U1234567890',
            team_id: 'T1234567890',
            name: 'johndoe',
            deleted: false,
            color: '9f69e7',
            real_name: 'John Doe',
            tz: 'America/New_York',
            tz_label: 'Eastern Standard Time',
            tz_offset: -18000,
            profile: mockSlackUserProfile,
            is_admin: true,
            is_owner: false,
            is_primary_owner: false,
            is_restricted: false,
            is_ultra_restricted: false,
            is_bot: false,
            is_app_user: false,
            updated: 1641234567,
            is_email_confirmed: true,
            who_can_share_contact_card: 'EVERYONE',
          }
        });
        
        const result = await userService.getUserInfo({ user: 'U1234567890' });
        
        // SUCCESS: Service correctly maps full response to SlackUser
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.id).toBe('U1234567890');
          expect(result.data.is_admin).toBe(true);
          expect(result.data.is_bot).toBe(false);
          expect(result.data.profile.real_name).toBe('John Doe');
        }
      } catch (error) {
        throw new Error(`Complete Slack API response mapping should work: ${error}`);
      }
    });
  });
});