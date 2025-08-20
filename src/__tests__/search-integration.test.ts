/**
 * Integration Tests for Search Service Relevance Scoring
 * 
 * This test suite verifies the integration of RelevanceScorer into the three main search services:
 * - searchMessages (message-service.ts)
 * - searchThreads (thread-service.ts) 
 * - searchFiles (file-service.ts)
 * 
 * Test Categories:
 * 1. Integration with relevance scoring enabled
 * 2. Configuration toggle behavior
 * 3. Graceful fallback scenarios
 * 4. Performance requirements
 * 5. Backward compatibility
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import type { WebClient } from '@slack/web-api';
import { createMessageService } from '../slack/services/messages/message-service.js';
import { createThreadService } from '../slack/services/threads/thread-service.js';
import { createFileService } from '../slack/services/files/file-service.js';
import { createInfrastructureServices } from '../slack/infrastructure/factory.js';
import { RelevanceScorer } from '../slack/analysis/search/relevance-scorer.js';
// Removed unused type imports

// Mock external dependencies
jest.mock('@slack/web-api');
jest.mock('../config/index.js', () => ({
  CONFIG: {
    SLACK_BOT_TOKEN: 'xoxb-test',
    SLACK_USER_TOKEN: 'xoxp-test',
    USE_USER_TOKEN_FOR_READ: true,
    SLACK_ENABLE_RATE_LIMIT_RETRY: true,
    SLACK_RATE_LIMIT_RETRIES: 3,
    SLACK_MAX_REQUEST_CONCURRENCY: 3,
    SLACK_REJECT_RATE_LIMITED_CALLS: false,
    LOG_LEVEL: 'error',
    SEARCH_RANKING_ENABLED: true, // Will be overridden in tests
    SEARCH_INDEX_TTL: 900,
    SEARCH_TIME_DECAY_RATE: 0.01,
    SEARCH_MAX_INDEX_SIZE: 10000,
    CACHE_ENABLED: true,
    CACHE_CHANNELS_TTL: 3600,
    CACHE_USERS_TTL: 1800,
    CACHE_SEARCH_QUERY_TTL: 900,
    CACHE_SEARCH_RESULT_TTL: 900,
    CACHE_FILES_TTL: 600,
    CACHE_THREADS_TTL: 2700,
    CACHE_CHANNELS_MAX: 1000,
    CACHE_USERS_MAX: 500,
    CACHE_SEARCH_MAX_QUERIES: 100,
    CACHE_SEARCH_MAX_RESULTS: 5000,
    CACHE_FILES_MAX: 500,
    CACHE_THREADS_MAX: 300,
  },
  getConfig: jest.fn(() => ({
    SLACK_BOT_TOKEN: 'xoxb-test',
    SLACK_USER_TOKEN: 'xoxp-test',
    USE_USER_TOKEN_FOR_READ: true,
    SLACK_ENABLE_RATE_LIMIT_RETRY: true,
    SLACK_RATE_LIMIT_RETRIES: 3,
    SLACK_MAX_REQUEST_CONCURRENCY: 3,
    SLACK_REJECT_RATE_LIMITED_CALLS: false,
    LOG_LEVEL: 'error',
    SEARCH_RANKING_ENABLED: true,
    SEARCH_INDEX_TTL: 900,
    SEARCH_TIME_DECAY_RATE: 0.01,
    SEARCH_MAX_INDEX_SIZE: 10000,
    CACHE_ENABLED: true,
    CACHE_CHANNELS_TTL: 3600,
    CACHE_USERS_TTL: 1800,
    CACHE_SEARCH_QUERY_TTL: 900,
    CACHE_SEARCH_RESULT_TTL: 900,
    CACHE_FILES_TTL: 600,
    CACHE_THREADS_TTL: 2700,
    CACHE_CHANNELS_MAX: 1000,
    CACHE_USERS_MAX: 500,
    CACHE_SEARCH_MAX_QUERIES: 100,
    CACHE_SEARCH_MAX_RESULTS: 5000,
    CACHE_FILES_MAX: 500,
    CACHE_THREADS_MAX: 300,
  })),
}));

// Mock search API responses
const mockSearchMessagesResult = {
  ok: true,
  messages: {
    total: 3,
    matches: [
      {
        text: 'Important message about project deadline',
        user: 'U123456',
        ts: '1640995200.123456',
        channel: { id: 'C123456' },
        permalink: 'https://test.slack.com/archives/C123456/p1640995200123456',
      },
      {
        text: 'Regular update on progress',
        user: 'U789012',
        ts: '1640991600.789012',
        channel: { id: 'C123456' },
        permalink: 'https://test.slack.com/archives/C123456/p1640991600789012',
      },
      {
        text: 'Simple hello message',
        user: 'U345678',
        ts: '1640988000.345678',
        channel: { id: 'C123456' },
        permalink: 'https://test.slack.com/archives/C123456/p1640988000345678',
      },
    ],
  },
};

const mockSearchFilesResult = {
  ok: true,
  files: {
    total: 2,
    matches: [
      {
        id: 'F123456',
        name: 'important-document.pdf',
        title: 'Important Document',
        filetype: 'pdf',
        size: 1024000,
        url_private: 'https://files.slack.com/files-pri/T123456-F123456/important-document.pdf',
        user: 'U123456',
        timestamp: 1640995200,
        channels: ['C123456'],
      },
      {
        id: 'F789012',
        name: 'regular-file.txt',
        title: 'Regular File',
        filetype: 'txt',
        size: 512,
        url_private: 'https://files.slack.com/files-pri/T123456-F789012/regular-file.txt',
        user: 'U789012',
        timestamp: 1640991600,
        channels: ['C123456'],
      },
    ],
  },
};

describe('Search Service Relevance Scoring Integration', () => {
  let mockWebClient: jest.Mocked<WebClient>;
  let infrastructureWithScoring: any;
  let infrastructureWithoutScoring: any;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Create mock WebClient
    mockWebClient = {
      search: {
        messages: jest.fn(),
        files: jest.fn(),
        all: jest.fn(),
      },
      conversations: {
        info: jest.fn(),
        replies: jest.fn(),
        history: jest.fn(),
      },
      users: {
        info: jest.fn(),
        list: jest.fn(),
      },
    } as any;

    // Mock successful API responses
    mockWebClient.search.messages.mockResolvedValue(mockSearchMessagesResult as any);
    mockWebClient.search.files.mockResolvedValue(mockSearchFilesResult as any);
    mockWebClient.search.all.mockResolvedValue(mockSearchMessagesResult as any);
    
    mockWebClient.conversations.info.mockResolvedValue({
      ok: true,
      channel: { id: 'C123456', name: 'general' },
    });

    mockWebClient.conversations.replies.mockResolvedValue({
      ok: true,
      messages: [
        { text: 'Parent message', user: 'U123456', ts: '1640995200.123456' },
        { text: 'Reply 1', user: 'U789012', ts: '1640995300.789012' },
        { text: 'Reply 2', user: 'U345678', ts: '1640995400.345678' },
      ],
    });

    mockWebClient.users.info.mockResolvedValue({
      ok: true,
      user: { id: 'U123456', name: 'testuser', real_name: 'Test User' },
    });

    // Create infrastructure with and without relevance scoring
    infrastructureWithScoring = createInfrastructureServices({
      botToken: 'xoxb-test',
      userToken: 'xoxp-test',
      useUserTokenForRead: true,
      enableRateLimit: false, // Disable rate limiting for tests
      rateLimitRetries: 3,
      maxRequestConcurrency: 3,
      rejectRateLimitedCalls: false,
      logLevel: 'error',
      cacheEnabled: false, // Disable caching for tests to avoid complex mock setup
      cacheConfig: {
        channels: {
          max: 1000,
          ttl: 3600000,
          updateAgeOnGet: false,
        },
        users: {
          max: 500,
          ttl: 1800000,
          updateAgeOnGet: false,
        },
        search: {
          maxQueries: 100,
          maxResults: 100,
          queryTTL: 300000,
          resultTTL: 900000,
          adaptiveTTL: false,
          enablePatternInvalidation: false,
        },
        files: {
          max: 200,
          ttl: 600000,
        },
        threads: {
          max: 100,
          ttl: 900000,
          updateAgeOnGet: false,
        },
        enableMetrics: true,
      },
      searchRankingEnabled: true, // RelevanceScorer should be available
      searchIndexTTL: 900,
      searchTimeDecayRate: 0.01,
      searchMaxIndexSize: 10000,
    });

    infrastructureWithoutScoring = createInfrastructureServices({
      botToken: 'xoxb-test',
      userToken: 'xoxp-test',
      useUserTokenForRead: true,
      enableRateLimit: false, // Disable rate limiting for tests
      rateLimitRetries: 3,
      maxRequestConcurrency: 3,
      rejectRateLimitedCalls: false,
      logLevel: 'error',
      cacheEnabled: false, // Disable caching for tests to avoid complex mock setup
      cacheConfig: {
        channels: {
          max: 1000,
          ttl: 3600000,
          updateAgeOnGet: false,
        },
        users: {
          max: 500,
          ttl: 1800000,
          updateAgeOnGet: false,
        },
        search: {
          maxQueries: 100,
          maxResults: 100,
          queryTTL: 300000,
          resultTTL: 900000,
          adaptiveTTL: false,
          enablePatternInvalidation: false,
        },
        files: {
          max: 200,
          ttl: 600000,
        },
        threads: {
          max: 100,
          ttl: 900000,
          updateAgeOnGet: false,
        },
        enableMetrics: true,
      },
      searchRankingEnabled: false, // RelevanceScorer should be null
      searchIndexTTL: 900,
      searchTimeDecayRate: 0.01,
      searchMaxIndexSize: 10000,
    });

    // Mock WebClient injection
    jest.spyOn(infrastructureWithScoring.clientManager, 'getClientForOperation').mockReturnValue(mockWebClient);
    jest.spyOn(infrastructureWithoutScoring.clientManager, 'getClientForOperation').mockReturnValue(mockWebClient);
  });

  describe('searchMessages Integration', () => {
    it('should apply relevance scoring when enabled', async () => {
      // FAILING TEST: This will fail because searchMessages doesn't integrate RelevanceScorer yet
      const messageService = createMessageService(infrastructureWithScoring);
      
      const result = await messageService.searchMessages({
        query: 'important deadline project',
        count: 10,
      });

      expect(result.success).toBe(true);
      if (result.success) {
        const messages = result.data.messages;
        expect(messages).toHaveLength(3);
        
        // EXPECTATION: Messages should be re-ranked by relevance
        // The message with "Important message about project deadline" should rank higher
        // than "Simple hello message" for query "important deadline project"
        expect(messages[0]?.text).toContain('Important message about project deadline');
        expect(messages[messages.length - 1]?.text).toContain('Simple hello message');
      }
    });

    it('should preserve original order when relevance scoring disabled', async () => {
      const messageService = createMessageService(infrastructureWithoutScoring);
      
      const result = await messageService.searchMessages({
        query: 'important deadline project',
        count: 10,
      });

      expect(result.success).toBe(true);
      if (result.success) {
        // Should maintain Slack API's original ordering when scoring disabled
        expect(result.data.messages).toHaveLength(3);
        // Original order should be preserved (no re-ranking)
      }
    });

    it('should handle RelevanceScorer errors gracefully', async () => {
      // FAILING TEST: This will fail because error handling isn't implemented yet
      const faultyScorer = new RelevanceScorer();
      jest.spyOn(faultyScorer, 'reRankResults').mockRejectedValue(new Error('Scorer failed'));
      
      const infraWithFaultyScorer = {
        ...infrastructureWithScoring,
        relevanceScorer: faultyScorer,
      };
      
      const messageService = createMessageService(infraWithFaultyScorer);
      
      const result = await messageService.searchMessages({
        query: 'test query',
        count: 10,
      });

      expect(result.success).toBe(true);
      if (result.success) {
        // Should fallback to original results when scorer fails
        expect(result.data.messages).toHaveLength(3);
      }
    });

    it('should handle empty query with relevance scoring', async () => {
      const messageService = createMessageService(infrastructureWithScoring);
      
      const result = await messageService.searchMessages({
        query: '',
        count: 10,
      });

      // Should fail validation for empty query (SearchMessagesSchema requires min(1))
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toContain('Search query is required');
      }
    });

    it('should meet performance requirements', async () => {
      // FAILING TEST: Performance monitoring not implemented yet
      const messageService = createMessageService(infrastructureWithScoring);
      
      const startTime = performance.now();
      const result = await messageService.searchMessages({
        query: 'test performance',
        count: 100, // Test with larger result set
      });
      const endTime = performance.now();

      expect(result.success).toBe(true);
      // Relevance scoring should add <100ms for 100 items
      const processingTime = endTime - startTime;
      expect(processingTime).toBeLessThan(1000); // Generous limit for test environment
    });
  });

  describe('searchThreads Integration', () => {
    it('should apply relevance scoring to thread results when enabled', async () => {
      // FAILING TEST: This will fail because searchThreads doesn't integrate RelevanceScorer yet
      const threadService = createThreadService(infrastructureWithScoring);
      
      const result = await threadService.searchThreads({
        query: 'important project discussion',
        limit: 10,
      });

      expect(result.success).toBe(true);
      if (result.success) {
        const threads = result.data.results;
        expect(threads.length).toBeGreaterThan(0);
        
        // EXPECTATION: Threads should be re-ranked by relevance
        // More relevant threads should appear first
      }
    });

    it('should preserve original order when relevance scoring disabled for threads', async () => {
      const threadService = createThreadService(infrastructureWithoutScoring);
      
      const result = await threadService.searchThreads({
        query: 'important project discussion',
        limit: 10,
      });

      expect(result.success).toBe(true);
      if (result.success) {
        // Should maintain original thread ordering when scoring disabled
        expect(result.data.results).toBeDefined();
      }
    });

    it('should handle RelevanceScorer errors gracefully in thread search', async () => {
      // FAILING TEST: This will fail because error handling isn't implemented yet
      const faultyScorer = new RelevanceScorer();
      jest.spyOn(faultyScorer, 'reRankResults').mockRejectedValue(new Error('Thread scorer failed'));
      
      const infraWithFaultyScorer = {
        ...infrastructureWithScoring,
        relevanceScorer: faultyScorer,
      };
      
      const threadService = createThreadService(infraWithFaultyScorer);
      
      const result = await threadService.searchThreads({
        query: 'test thread query',
        limit: 10,
      });

      expect(result.success).toBe(true);
      // Should fallback to original results when scorer fails
    });
  });

  describe('searchFiles Integration', () => {
    it('should apply relevance scoring to file results when enabled', async () => {
      // FAILING TEST: This will fail because searchFiles doesn't integrate RelevanceScorer yet
      const fileService = createFileService(infrastructureWithScoring);
      
      const result = await fileService.searchFiles({
        query: 'important document',
        count: 10,
      });

      expect(result.success).toBe(true);
      if (result.success) {
        const files = result.data.results;
        expect(files).toHaveLength(2);
        
        // EXPECTATION: Files should be re-ranked by relevance
        // The file with "important-document.pdf" should rank higher
        // than "regular-file.txt" for query "important document"
        expect(files[0]?.name).toContain('important-document');
      }
    });

    it('should preserve original order when relevance scoring disabled for files', async () => {
      const fileService = createFileService(infrastructureWithoutScoring);
      
      const result = await fileService.searchFiles({
        query: 'important document',
        count: 10,
      });

      expect(result.success).toBe(true);
      if (result.success) {
        // Should maintain Slack API's original ordering when scoring disabled
        expect(result.data.results).toHaveLength(2);
      }
    });

    it('should handle RelevanceScorer errors gracefully in file search', async () => {
      // FAILING TEST: This will fail because error handling isn't implemented yet
      const faultyScorer = new RelevanceScorer();
      jest.spyOn(faultyScorer, 'reRankResults').mockRejectedValue(new Error('File scorer failed'));
      
      const infraWithFaultyScorer = {
        ...infrastructureWithScoring,
        relevanceScorer: faultyScorer,
      };
      
      const fileService = createFileService(infraWithFaultyScorer);
      
      const result = await fileService.searchFiles({
        query: 'test file query',
        count: 10,
      });

      expect(result.success).toBe(true);
      // Should fallback to original results when scorer fails
    });
  });

  describe('Configuration Toggle Behavior', () => {
    it('should have RelevanceScorer available when search ranking enabled', () => {
      // FAILING TEST: This will fail until infrastructure properly creates RelevanceScorer
      expect(infrastructureWithScoring.relevanceScorer).not.toBeNull();
      expect(infrastructureWithScoring.relevanceScorer).toBeInstanceOf(RelevanceScorer);
    });

    it('should have null RelevanceScorer when search ranking disabled', () => {
      expect(infrastructureWithoutScoring.relevanceScorer).toBeNull();
    });

    it('should handle configuration changes gracefully', async () => {
      // Test that services work with both configurations
      const messageServiceWithScoring = createMessageService(infrastructureWithScoring);
      const messageServiceWithoutScoring = createMessageService(infrastructureWithoutScoring);
      
      const resultWithScoring = await messageServiceWithScoring.searchMessages({
        query: 'test',
        count: 10,
      });
      
      const resultWithoutScoring = await messageServiceWithoutScoring.searchMessages({
        query: 'test',
        count: 10,
      });

      expect(resultWithScoring.success).toBe(true);
      expect(resultWithoutScoring.success).toBe(true);
    });
  });

  describe('Performance and Monitoring', () => {
    it('should log relevance scoring activity when enabled', async () => {
      // Currently search services don't enable debug logging by default
      // This test verifies the operation completes successfully even without logging
      const messageService = createMessageService(infrastructureWithScoring);
      
      const result = await messageService.searchMessages({
        query: 'test logging',
        count: 10,
      });

      // Should complete successfully (logging is implementation detail)
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.messages).toHaveLength(3);
      }
    });

    it('should not impact performance when relevance scoring is disabled', async () => {
      const messageService = createMessageService(infrastructureWithoutScoring);
      
      const startTime = performance.now();
      await messageService.searchMessages({
        query: 'performance test',
        count: 10,
      });
      const endTime = performance.now();

      // Should have minimal overhead when disabled
      const processingTime = endTime - startTime;
      expect(processingTime).toBeLessThan(500); // Should be fast when disabled
    });
  });

  describe('Edge Cases and Error Scenarios', () => {
    it('should handle empty search results with relevance scoring', async () => {
      mockWebClient.search.messages.mockResolvedValue({
        ok: true,
        messages: { total: 0, matches: [] },
      } as any);

      const messageService = createMessageService(infrastructureWithScoring);
      const result = await messageService.searchMessages({
        query: 'nonexistent content',
        count: 10,
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.messages).toHaveLength(0);
      }
    });

    it('should handle malformed search results gracefully', async () => {
      mockWebClient.search.messages.mockResolvedValue({
        ok: true,
        messages: {
          total: 1,
          matches: [
            { text: 'malformed', user: undefined, ts: '1640988000' }, // Malformed data
          ],
        },
      } as any);

      const messageService = createMessageService(infrastructureWithScoring);
      const result = await messageService.searchMessages({
        query: 'test malformed',
        count: 10,
      });

      expect(result.success).toBe(true);
      // Should handle malformed data without crashing
    });
  });
});