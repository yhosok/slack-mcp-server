/**
 * Architecture Consistency - Post-TDD Validation
 * 
 * This test suite validates that all critical architectural violations have been
 * properly resolved and maintains regression prevention for future development.
 * All tests should pass, confirming correct architectural patterns.
 */

import { existsSync } from 'fs';
import { readFileSync } from 'fs';
import path from 'path';

// Mock the configuration to prevent import errors
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

describe('Architecture Consistency - Post-TDD Validation', () => {
  const srcRoot = path.join(process.cwd(), 'src');

  describe('Domain Separation Compliance', () => {
    it('user-transformers should be correctly placed in users domain', () => {
      // VERIFIED: user-transformers.ts is correctly placed in users domain
      const wrongPath = path.join(srcRoot, 'slack/services/messages/user-transformers.ts');
      const correctPath = path.join(srcRoot, 'slack/services/users/user-transformers.ts');
      
      // Verify correct placement
      expect(existsSync(correctPath)).toBe(true);
      expect(existsSync(wrongPath)).toBe(false);
    });
    
    it('UserInfoOutput should be correctly placed in users outputs', () => {
      // VERIFIED: UserInfoOutput type is correctly defined in users.ts
      const messagesOutputsPath = path.join(srcRoot, 'slack/types/outputs/messages.ts');
      const usersOutputsPath = path.join(srcRoot, 'slack/types/outputs/users.ts');
      
      // Verify UserInfoOutput is NOT in messages outputs
      const messagesContent = readFileSync(messagesOutputsPath, 'utf-8');
      expect(messagesContent).not.toContain('export interface UserInfoOutput');
      
      // Verify UserInfoOutput IS in users outputs
      expect(existsSync(usersOutputsPath)).toBe(true);
      const usersContent = readFileSync(usersOutputsPath, 'utf-8');
      expect(usersContent).toContain('export interface UserInfoOutput');
    });
  });

  describe('MCP Adapter Pattern Compliance', () => {
    it('user service should have MCP adapter consistent with other services', () => {
      // VERIFIED: user service has MCP adapter pattern consistency
      const userMCPAdapterPath = path.join(srcRoot, 'slack/services/users/user-service-mcp-adapter.ts');
      
      // Verify all services have MCP adapters
      const messagesMCPAdapter = path.join(srcRoot, 'slack/services/messages/message-service-mcp-adapter.ts');
      const threadsMCPAdapter = path.join(srcRoot, 'slack/services/threads/thread-service-mcp-adapter.ts');
      const filesMCPAdapter = path.join(srcRoot, 'slack/services/files/file-service-mcp-adapter.ts');
      const reactionsMCPAdapter = path.join(srcRoot, 'slack/services/reactions/reaction-service-mcp-adapter.ts');
      const workspaceMCPAdapter = path.join(srcRoot, 'slack/services/workspace/workspace-service-mcp-adapter.ts');
      
      expect(existsSync(messagesMCPAdapter)).toBe(true);
      expect(existsSync(threadsMCPAdapter)).toBe(true);
      expect(existsSync(filesMCPAdapter)).toBe(true);
      expect(existsSync(reactionsMCPAdapter)).toBe(true);
      expect(existsSync(workspaceMCPAdapter)).toBe(true);
      expect(existsSync(userMCPAdapterPath)).toBe(true);
    });
    
    it('service factory should register user MCP adapter', () => {
      // VERIFIED: service factory imports and creates user MCP adapter
      const serviceFactoryPath = path.join(srcRoot, 'slack/service-factory.ts');
      const factoryContent = readFileSync(serviceFactoryPath, 'utf-8');
      
      // Verify all services are imported and created
      expect(factoryContent).toContain('createMessageServiceMCPAdapter');
      expect(factoryContent).toContain('createThreadServiceMCPAdapter');
      expect(factoryContent).toContain('createFileServiceMCPAdapter');
      expect(factoryContent).toContain('createReactionServiceMCPAdapter');
      expect(factoryContent).toContain('createWorkspaceServiceMCPAdapter');
      expect(factoryContent).toContain('createUserServiceMCPAdapter');
    });
  });

  describe('Service Responsibility Compliance', () => {
    it('getUserInfo should be properly placed in user service', () => {
      // VERIFIED: getUserInfo is implemented in user service, not message service
      const messageServicePath = path.join(srcRoot, 'slack/services/messages/message-service.ts');
      const userServicePath = path.join(srcRoot, 'slack/services/users/user-service.ts');
      
      // Check if getUserInfo exists in message service (should NOT exist)
      let messageServiceHasGetUserInfo = false;
      if (existsSync(messageServicePath)) {
        const messageContent = readFileSync(messageServicePath, 'utf-8');
        messageServiceHasGetUserInfo = messageContent.includes('getUserInfo');
      }
      
      // Check if getUserInfo exists in user service (should exist)
      let userServiceHasGetUserInfo = false;
      if (existsSync(userServicePath)) {
        const userContent = readFileSync(userServicePath, 'utf-8');
        userServiceHasGetUserInfo = userContent.includes('getUserInfo');
      }
      
      // Verify correct responsibility assignment
      expect(messageServiceHasGetUserInfo).toBe(false);
      expect(userServiceHasGetUserInfo).toBe(true);
    });
    
    it('MCP routing should go directly to user service', () => {
      // VERIFIED: MCP routing correctly goes to user service for getUserInfo
      const serviceFactoryPath = path.join(srcRoot, 'slack/service-factory.ts');
      const factoryContent = readFileSync(serviceFactoryPath, 'utf-8');
      
      // Verify correct routing: getUserInfo routed to userService
      expect(factoryContent).toContain('getUserInfo: userService.getUserInfo');
      expect(factoryContent).not.toContain('getUserInfo: messageService.getUserInfo');
    });
  });

  describe('Import Dependency Compliance', () => {
    it('user service should not import from messages domain', () => {
      // VERIFIED: user service correctly imports from users domain only
      const userServiceTypesPath = path.join(srcRoot, 'slack/services/users/types.ts');
      
      if (existsSync(userServiceTypesPath)) {
        const userTypesContent = readFileSync(userServiceTypesPath, 'utf-8');
        
        // Verify no cross-domain imports: NOT importing from messages outputs
        const hasMessagesImport = userTypesContent.includes("from '../../types/outputs/messages.js'");
        expect(hasMessagesImport).toBe(false);
      }
    });

    it('user-transformers imports UserInfoOutput from correct domain', () => {
      // VERIFIED: user-transformers correctly imports UserInfoOutput from users domain
      const userTransformersPath = path.join(srcRoot, 'slack/services/users/user-transformers.ts');
      
      if (existsSync(userTransformersPath)) {
        const transformersContent = readFileSync(userTransformersPath, 'utf-8');
        
        // Verify correct imports: importing from users outputs
        const hasUsersImport = transformersContent.includes("from '../../types/outputs/users.js'");
        const hasMessagesImport = transformersContent.includes("from '../../types/outputs/messages.js'");
        
        expect(hasUsersImport).toBe(true);
        expect(hasMessagesImport).toBe(false);
      }
    });
  });

  describe('Architectural Pattern Consistency Compliance', () => {
    it('all domain services should follow same MCP adapter pattern', () => {
      // VERIFIED: Consistent MCP adapter pattern implementation across all domains
      const adapterPaths = {
        messages: path.join(srcRoot, 'slack/services/messages/message-service-mcp-adapter.ts'),
        threads: path.join(srcRoot, 'slack/services/threads/thread-service-mcp-adapter.ts'),
        files: path.join(srcRoot, 'slack/services/files/file-service-mcp-adapter.ts'),
        reactions: path.join(srcRoot, 'slack/services/reactions/reaction-service-mcp-adapter.ts'),
        workspace: path.join(srcRoot, 'slack/services/workspace/workspace-service-mcp-adapter.ts'),
        users: path.join(srcRoot, 'slack/services/users/user-service-mcp-adapter.ts')
      };
      
      const mcpAdapterFiles: Record<string, boolean> = {};
      Object.entries(adapterPaths).forEach(([domain, adapterPath]) => {
        mcpAdapterFiles[domain] = existsSync(adapterPath);
      });
      
      // Verify all domains have adapters
      expect(mcpAdapterFiles.messages).toBe(true);
      expect(mcpAdapterFiles.threads).toBe(true);
      expect(mcpAdapterFiles.files).toBe(true);
      expect(mcpAdapterFiles.reactions).toBe(true);
      expect(mcpAdapterFiles.workspace).toBe(true);
      expect(mcpAdapterFiles.users).toBe(true);
    });

    it('service factory should have consistent service creation pattern', () => {
      // VERIFIED: Consistent service creation pattern in factory
      const serviceFactoryPath = path.join(srcRoot, 'slack/service-factory.ts');
      const factoryContent = readFileSync(serviceFactoryPath, 'utf-8');
      
      // Count service creations
      const serviceCreations = [
        'createMessageServiceMCPAdapter',
        'createThreadServiceMCPAdapter', 
        'createFileServiceMCPAdapter',
        'createReactionServiceMCPAdapter',
        'createWorkspaceServiceMCPAdapter',
        'createUserServiceMCPAdapter'
      ];
      
      const existingCreations = serviceCreations.filter(creation => 
        factoryContent.includes(creation)
      );
      
      // Verify all 6 services are created consistently
      expect(existingCreations.length).toBe(6);
    });
  });

  describe('Type Safety and Domain Boundary Compliance', () => {
    it('user domain types should be self-contained', () => {
      // VERIFIED: User domain correctly maintains type boundaries
      const userTypesPath = path.join(srcRoot, 'slack/services/users/types.ts');
      
      if (existsSync(userTypesPath)) {
        const userTypesContent = readFileSync(userTypesPath, 'utf-8');
        
        // Count imports from other domains (should be zero for proper separation)
        const messagesDomainImports = (userTypesContent.match(/from '.*messages.*'/g) || []).length;
        const threadsDomainImports = (userTypesContent.match(/from '.*threads.*'/g) || []).length;
        const filesDomainImports = (userTypesContent.match(/from '.*files.*'/g) || []).length;
        
        const totalCrossDomainImports = messagesDomainImports + threadsDomainImports + filesDomainImports;
        
        // Verify proper domain boundary isolation
        expect(totalCrossDomainImports).toBe(0);
      }
    });

    it('getUserInfo operation should have consistent type implementation', () => {
      // VERIFIED: getUserInfo is properly implemented only in user service with correct types
      const messageTypesPath = path.join(srcRoot, 'slack/services/messages/types.ts');
      const userTypesPath = path.join(srcRoot, 'slack/services/users/types.ts');
      
      let messageServiceHasGetUserInfo = false;
      let userServiceHasGetUserInfo = false;
      
      if (existsSync(messageTypesPath)) {
        const messageContent = readFileSync(messageTypesPath, 'utf-8');
        messageServiceHasGetUserInfo = messageContent.includes('getUserInfo');
      }
      
      if (existsSync(userTypesPath)) {
        const userContent = readFileSync(userTypesPath, 'utf-8');
        userServiceHasGetUserInfo = userContent.includes('getUserInfo');
      }
      
      // Verify getUserInfo is only in user service types, not in message service
      expect(messageServiceHasGetUserInfo).toBe(false);
      expect(userServiceHasGetUserInfo).toBe(true);
    });
  });
});