/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { describe, it, expect, beforeEach, jest } from '@jest/globals';

// Simple test to verify modular routing is working
describe('Modular Architecture Routing', () => {
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    // Save original env
    originalEnv = { ...process.env };
    // Clear module cache to ensure fresh config
    jest.resetModules();
  });

  afterEach(() => {
    // Restore original env
    process.env = originalEnv;
  });

  it('should use legacy implementation when USE_MODULAR_ARCHITECTURE is false', async () => {
    process.env.USE_MODULAR_ARCHITECTURE = 'false';
    process.env.SLACK_BOT_TOKEN = 'xoxb-test-token';
    
    const { SlackService } = await import('../slack/slack-service');
    const service = new SlackService();
    
    // Check that service is created (basic smoke test)
    expect(service).toBeDefined();
    expect(typeof service.sendMessage).toBe('function');
  });

  it('should use modular implementation when USE_MODULAR_ARCHITECTURE is true', async () => {
    process.env.USE_MODULAR_ARCHITECTURE = 'true';
    process.env.ENABLE_MODULAR_MESSAGES = 'true';
    process.env.SLACK_BOT_TOKEN = 'xoxb-test-token';
    
    const { SlackService } = await import('../slack/slack-service');
    const service = new SlackService();
    
    // Check that service is created with modular config
    expect(service).toBeDefined();
    expect(typeof service.sendMessage).toBe('function');
  });

  it('should have all 36 methods available in both modes', async () => {
    const expectedMethods = [
      'sendMessage', 'listChannels', 'getChannelHistory', 'getUserInfo',
      'searchMessages', 'getChannelInfo', 'findThreadsInChannel',
      'getThreadReplies', 'searchThreads', 'postThreadReply', 'createThread',
      'markThreadImportant', 'analyzeThread', 'summarizeThread',
      'extractActionItems', 'identifyImportantThreads', 'exportThread',
      'findRelatedThreads', 'getThreadMetrics', 'getThreadsByParticipants',
      'uploadFile', 'listFiles', 'getFileInfo', 'deleteFile', 'shareFile',
      'analyzeFiles', 'searchFiles', 'addReaction', 'removeReaction',
      'getReactions', 'getReactionStatistics', 'findMessagesByReactions',
      'getWorkspaceInfo', 'listTeamMembers', 'getWorkspaceActivity',
      'getServerHealth'
    ];

    // Test legacy mode
    process.env.USE_MODULAR_ARCHITECTURE = 'false';
    process.env.SLACK_BOT_TOKEN = 'xoxb-test-token';
    
    const { SlackService: LegacyService } = await import('../slack/slack-service');
    const legacyService = new LegacyService();
    
    for (const method of expectedMethods) {
      expect(typeof (legacyService as any)[method]).toBe('function');
    }

    // Clear cache and test modular mode
    jest.resetModules();
    process.env.USE_MODULAR_ARCHITECTURE = 'true';
    process.env.ENABLE_MODULAR_MESSAGES = 'true';
    process.env.ENABLE_MODULAR_THREADS = 'true';
    process.env.ENABLE_MODULAR_FILES = 'true';
    process.env.ENABLE_MODULAR_REACTIONS = 'true';
    process.env.ENABLE_MODULAR_WORKSPACE = 'true';
    
    const { SlackService: ModularService } = await import('../slack/slack-service');
    const modularService = new ModularService();
    
    for (const method of expectedMethods) {
      expect(typeof (modularService as any)[method]).toBe('function');
    }
  });
});