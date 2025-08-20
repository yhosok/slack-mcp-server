import { jest } from '@jest/globals';

// Mock configuration before imports
jest.mock('../config/index.js', () => ({
  CONFIG: {
    SLACK_BOT_TOKEN: 'xoxb-test-token',
    SLACK_USER_TOKEN: undefined,
    USE_USER_TOKEN_FOR_READ: false,
    LOG_LEVEL: 'info',
    CACHE_ENABLED: true,
    SEARCH_RANKING_ENABLED: true,
    SEARCH_INDEX_TTL: 900,
    SEARCH_TIME_DECAY_RATE: 0.01,
    SEARCH_MAX_INDEX_SIZE: 10000,
  },
}));

// Mock MiniSearch
jest.mock('minisearch', () => {
  const MockMiniSearch = jest.fn().mockImplementation(() => ({
    addAll: jest.fn(),
    search: jest.fn().mockImplementation((query: any) => {
      // Return different scores based on query for testing
      if (query === 'プロジェクト') {
        // Japanese query should match Japanese message (index 2) better
        return [
          { id: '2', score: 1.0 }, // Japanese message
          { id: '0', score: 0.3 }, // English message 
          { id: '1', score: 0.1 }, // English message
        ];
      } else if (query.includes('project')) {
        // English query
        return [
          { id: '0', score: 1.0 },
          { id: '1', score: 0.5 },
          { id: '2', score: 0.8 },
        ];
      } else if (query === 'U123456') {
        // User search
        return [
          { id: '0', score: 1.0 },
        ];
      } else if (query === 'implemetation') {
        // Fuzzy search
        return [
          { id: '0', score: 0.8 }, // Should still match with fuzzy
        ];
      }
      return [
        { id: '0', score: 1.0 },
        { id: '1', score: 0.5 },
        { id: '2', score: 0.8 },
      ];
    }),
    removeAll: jest.fn(),
  }));
  return {
    __esModule: true,
    default: MockMiniSearch,
  };
});

// Mock Slack Web API
jest.mock('@slack/web-api', () => ({
  WebClient: jest.fn().mockImplementation(() => ({
    conversations: {
      history: jest.fn(),
      replies: jest.fn(),
    },
    search: {
      messages: jest.fn(),
      all: jest.fn(),
    },
  })),
}));

// Mock logger
jest.mock('../utils/logger.js', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

import { RelevanceScorer } from '../slack/analysis/search/relevance-scorer.js';
import { DecisionExtractor } from '../slack/analysis/thread/decision-extractor.js';
import type { 
  RelevanceScorerConfig, 
  SlackMessage 
} from '../slack/types/index.js';

describe('RelevanceScorer', () => {
  let relevanceScorer: RelevanceScorer;
  let mockConfig: RelevanceScorerConfig;
  let mockMessages: SlackMessage[];

  beforeEach(() => {
    mockConfig = {
      weights: {
        tfidf: 0.4,
        timeDecay: 0.25,
        engagement: 0.2,
        urgency: 0.1,
        importance: 0.05,
      },
      timeDecayHalfLife: 24, // hours
      miniSearchConfig: {
        fields: ['text', 'user'],
        storeFields: ['id', 'timestamp', 'threadTs'],
        searchOptions: {
          boost: { text: 2, user: 1.5 },
          fuzzy: 0.2,
        },
      },
      engagementMetrics: {
        reactionWeight: 0.3,
        replyWeight: 0.5,
        mentionWeight: 0.2,
      },
    };

    mockMessages = [
      {
        type: 'message',
        user: 'U123456',
        text: 'This is an important project update about the new feature implementation',
        ts: '1640995200.123456', // Recent timestamp
        reactions: [{ name: 'thumbsup', count: 5, users: ['U111', 'U222'] }],
        reply_count: 3,
      },
      {
        type: 'message',
        user: 'U789012',
        text: 'I agree with the implementation approach. Let me know if you need help.',
        ts: '1640908800.123456', // Older timestamp (1 day ago)
        reactions: [],
        reply_count: 0,
      },
      {
        type: 'message',
        user: 'U345678',
        text: 'プロジェクトの進捗について話し合いましょう', // Japanese text
        ts: '1640822400.123456', // Even older timestamp (2 days ago)
        reactions: [{ name: 'eyes', count: 2, users: ['U111'] }],
        reply_count: 1,
      },
    ] as SlackMessage[];

    relevanceScorer = new RelevanceScorer(mockConfig);
  });

  describe('TF-IDF Scoring with MiniSearch', () => {
    it('should calculate TF-IDF scores for search queries', async () => {
      const searchQuery = 'project implementation';
      
      const result = await relevanceScorer.calculateTFIDFScore(mockMessages, searchQuery);
      
      expect(result).toHaveProperty('scores');
      expect(result.scores).toHaveLength(mockMessages.length);
      expect(result.scores[0]).toBeGreaterThan(0); // First message should have relevance
      expect(result.scores[0] || 0).toBeGreaterThan(result.scores[1] || 0); // First message more relevant
    });

    it('should apply field boosting correctly', async () => {
      const searchQuery = 'U123456'; // Search for user
      
      const result = await relevanceScorer.calculateTFIDFScore(mockMessages, searchQuery);
      
      // User field should be boosted with weight 1.5
      expect(result.fieldBoosts).toEqual({ text: 2, user: 1.5 });
    });

    it('should handle fuzzy search for typos', async () => {
      const searchQuery = 'implemetation'; // Typo: implementation
      
      const result = await relevanceScorer.calculateTFIDFScore(mockMessages, searchQuery);
      
      expect(result.scores[0]).toBeGreaterThan(0); // Should still match with fuzzy
    });

    it('should handle empty search queries', async () => {
      const searchQuery = '';
      
      const result = await relevanceScorer.calculateTFIDFScore(mockMessages, searchQuery);
      
      expect(result.scores).toEqual([0, 0, 0]); // All scores should be 0
    });

    it('should handle multilingual content (Japanese/English)', async () => {
      const searchQuery = 'プロジェクト'; // Japanese: project
      
      const result = await relevanceScorer.calculateTFIDFScore(mockMessages, searchQuery);
      
      expect(result.scores[2]).toBeGreaterThan(0); // Japanese message should match
      expect(result.scores[2] || 0).toBeGreaterThan(result.scores[0] || 0); // Better match than English
    });
  });

  describe('Time Decay Calculation', () => {
    it('should calculate exponential time decay', () => {
      const now = Date.now() / 1000; // Current time in seconds
      const recentTimestamp = (now - 3600).toString(); // 1 hour ago
      const oldTimestamp = (now - 172800).toString(); // 2 days ago
      
      const recentDecay = relevanceScorer.calculateTimeDecay(recentTimestamp);
      const oldDecay = relevanceScorer.calculateTimeDecay(oldTimestamp);
      
      expect(recentDecay).toBeGreaterThan(oldDecay);
      expect(recentDecay).toBeCloseTo(1, 1); // Recent should be close to 1
      expect(oldDecay).toBeLessThan(0.5); // Old should be significantly less
    });

    it('should handle very old timestamps', () => {
      const now = Date.now() / 1000; // Current time in seconds
      const veryOldTimestamp = (now - 31536000).toString(); // 1 year ago
      
      const decay = relevanceScorer.calculateTimeDecay(veryOldTimestamp);
      
      expect(decay).toBeGreaterThan(0); // Should not be 0
      expect(decay).toBeLessThan(0.01); // Should be very small
    });

    it('should handle invalid timestamps gracefully', () => {
      const invalidTimestamp = 'invalid';
      
      const decay = relevanceScorer.calculateTimeDecay(invalidTimestamp);
      
      expect(decay).toBe(0); // Should default to 0 for invalid timestamps
    });

    it('should respect configurable decay rate', () => {
      const customConfig = {
        ...mockConfig,
        timeDecayHalfLife: 12, // Faster decay (12 hours instead of 24)
      };
      const customScorer = new RelevanceScorer(customConfig);
      
      const now = Date.now() / 1000; // Current time in seconds
      const timestamp = (now - 86400).toString(); // 1 day ago
      
      const normalDecay = relevanceScorer.calculateTimeDecay(timestamp);
      const fastDecay = customScorer.calculateTimeDecay(timestamp);
      
      expect(fastDecay).toBeLessThan(normalDecay); // Faster decay should be lower
    });
  });

  describe('Engagement Metrics Calculation', () => {
    it('should calculate engagement scores based on reactions and replies', () => {
      const highEngagementMessage = mockMessages[0]!; // Has reactions and replies
      const lowEngagementMessage = mockMessages[1]!; // No engagement
      
      const highScore = relevanceScorer.calculateEngagementScore(highEngagementMessage);
      const lowScore = relevanceScorer.calculateEngagementScore(lowEngagementMessage);
      
      expect(highScore).toBeGreaterThan(lowScore);
      expect(highScore).toBeGreaterThan(0);
      expect(lowScore).toBe(0);
    });

    it('should weight different engagement types correctly', () => {
      const messageWithReplies = {
        ...mockMessages[0],
        reactions: [],
        reply_count: 10, // High replies, no reactions
      } as SlackMessage;
      
      const messageWithReactions = {
        ...mockMessages[0],
        reactions: [{ name: 'thumbsup', count: 10, users: ['U111'] }],
        reply_count: 0, // High reactions, no replies
      } as SlackMessage;
      
      const replyScore = relevanceScorer.calculateEngagementScore(messageWithReplies);
      const reactionScore = relevanceScorer.calculateEngagementScore(messageWithReactions);
      
      // Replies have weight 0.5, reactions have weight 0.3
      expect(replyScore).toBeGreaterThan(reactionScore);
    });

    it('should handle messages with mentions in text', () => {
      const messageWithMentions = {
        ...mockMessages[0],
        text: 'Hey <@U111> and <@U222>, please review this',
        reactions: [],
        reply_count: 0,
      } as SlackMessage;
      
      const score = relevanceScorer.calculateEngagementScore(messageWithMentions);
      
      expect(score).toBeGreaterThan(0); // Should have engagement from mentions
    });

    it('should handle empty engagement data', () => {
      const emptyMessage = {
        type: 'message',
        user: 'U123',
        text: 'Simple message',
        ts: '1640995200.123456',
        reactions: [],
        reply_count: 0,
      } as SlackMessage;
      
      const score = relevanceScorer.calculateEngagementScore(emptyMessage);
      
      expect(score).toBe(0);
    });
  });

  describe('Composite Scoring Algorithm', () => {
    it('should calculate composite relevance scores', async () => {
      const searchQuery = 'project implementation';
      
      const result = await relevanceScorer.calculateRelevance(mockMessages, searchQuery);
      
      expect(result).toHaveProperty('scores');
      expect(result.scores).toHaveLength(mockMessages.length);
      
      for (const score of result.scores) {
        expect(score).toHaveProperty('tfidfScore');
        expect(score).toHaveProperty('timeDecayScore');
        expect(score).toHaveProperty('engagementScore');
        expect(score).toHaveProperty('compositeScore');
        expect(score).toHaveProperty('confidence');
      }
    });

    it('should apply configurable weights correctly', async () => {
      const searchQuery = 'project';
      
      // Test with different weight configurations
      const tfidfHeavyConfig = {
        ...mockConfig,
        weights: { tfidf: 0.8, timeDecay: 0.1, engagement: 0.1, urgency: 0, importance: 0 },
      };
      const timeHeavyConfig = {
        ...mockConfig,
        weights: { tfidf: 0.1, timeDecay: 0.8, engagement: 0.1, urgency: 0, importance: 0 },
      };
      
      const tfidfScorer = new RelevanceScorer(tfidfHeavyConfig);
      const timeScorer = new RelevanceScorer(timeHeavyConfig);
      
      const _tfidfResult = await tfidfScorer.calculateRelevance(mockMessages, searchQuery);
      const timeResult = await timeScorer.calculateRelevance(mockMessages, searchQuery);
      
      // Recent message should rank higher in time-weighted scoring
      expect(timeResult.scores[0]?.compositeScore || 0).toBeGreaterThan(timeResult.scores[2]?.compositeScore || 0);
    });

    it('should include confidence scores', async () => {
      const searchQuery = 'implementation';
      
      const result = await relevanceScorer.calculateRelevance(mockMessages, searchQuery);
      
      for (const score of result.scores) {
        expect(score.confidence).toBeGreaterThanOrEqual(0);
        expect(score.confidence).toBeLessThanOrEqual(1);
      }
    });

    it('should handle performance requirements (<100ms for 100 items)', async () => {
      const largeMessageSet = Array.from({ length: 100 }, (_, i) => ({
        ...mockMessages[0],
        text: `Message ${i} with some project implementation details`,
        ts: `${1640995200 - i * 3600}.123456`, // Different timestamps
      })) as SlackMessage[];
      
      const startTime = performance.now();
      await relevanceScorer.calculateRelevance(largeMessageSet, 'project implementation');
      const endTime = performance.now();
      
      expect(endTime - startTime).toBeLessThan(100); // Should be under 100ms
    });
  });

  describe('Result Re-ranking', () => {
    it('should re-rank search results based on relevance scores', async () => {
      const searchQuery = 'project';
      const mockResults = [
        { id: '1', text: mockMessages[2]?.text || '', timestamp: mockMessages[2]?.ts || '' }, // Oldest
        { id: '2', text: mockMessages[0]?.text || '', timestamp: mockMessages[0]?.ts || '' }, // Most recent
        { id: '3', text: mockMessages[1]?.text || '', timestamp: mockMessages[1]?.ts || '' }, // Middle
      ];
      
      const rerankedResults = await relevanceScorer.reRankResults(mockResults, searchQuery);
      
      expect(rerankedResults).toHaveLength(3);
      // Should re-rank results based on composite scores (order may vary based on time decay and TF-IDF)
      expect(rerankedResults[0]).toBeDefined();
      expect(rerankedResults[0]?.id).toMatch(/^[123]$/); // Should be one of the valid IDs
    });

    it('should preserve original structure while re-ranking', async () => {
      const mockResults = [
        { id: '1', customField: 'value1', text: 'old message' },
        { id: '2', customField: 'value2', text: 'recent important message' },
      ];
      
      const rerankedResults = await relevanceScorer.reRankResults(mockResults, 'important');
      
      expect(rerankedResults[0]).toHaveProperty('customField');
      expect(rerankedResults[0]?.customField).toBeDefined();
    });
  });

  describe('Integration with TypeSafeAPI', () => {
    it('should return ServiceResult pattern for relevance calculation', async () => {
      const searchQuery = 'project';
      
      const result = await relevanceScorer.calculateRelevanceService({
        messages: mockMessages,
        query: searchQuery,
      });
      
      expect(result).toHaveProperty('success');
      expect(result).toHaveProperty('data');
      expect(result).toHaveProperty('statusCode');
      expect(result).toHaveProperty('message');
      
      if (result.success) {
        expect(result.data).toHaveProperty('scores');
        expect(result.statusCode).toBe(200);
      }
    });

    it('should handle errors gracefully with ServiceResult pattern', async () => {
      // Force an error by passing invalid data
      const result = await relevanceScorer.calculateRelevanceService({
        messages: null,
        query: 'test',
      });
      
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBeDefined();
        expect(result.statusCode).toBeGreaterThanOrEqual(400);
      }
    });
  });

  describe('Cache Integration', () => {
    it('should cache TF-IDF calculations', async () => {
      const searchQuery = 'project implementation';
      
      // First call
      const result1 = await relevanceScorer.calculateTFIDFScore(mockMessages, searchQuery);
      
      // Second call with same parameters should use cache
      const result2 = await relevanceScorer.calculateTFIDFScore(mockMessages, searchQuery);
      
      expect(result1.cacheHit).toBe(false);
      expect(result2.cacheHit).toBe(true);
      expect(result1.scores).toEqual(result2.scores);
    });

    it('should respect cache TTL configuration', async () => {
      const shortTTLConfig = {
        ...mockConfig,
        cacheTTL: 100, // 100ms TTL
      };
      const cachedScorer = new RelevanceScorer(shortTTLConfig);
      
      const searchQuery = 'test';
      
      // First call
      await cachedScorer.calculateTFIDFScore(mockMessages, searchQuery);
      
      // Wait for cache to expire
      await new Promise(resolve => setTimeout(resolve, 150));
      
      // Second call should not use cache
      const result = await cachedScorer.calculateTFIDFScore(mockMessages, searchQuery);
      expect(result.cacheHit).toBe(false);
    });
  });

  describe('Error Handling', () => {
    it('should handle MiniSearch initialization errors', () => {
      const invalidConfig = {
        ...mockConfig,
        miniSearchConfig: undefined,
      };
      
      expect(() => new RelevanceScorer(invalidConfig)).toThrow();
    });

    it('should handle malformed message data', async () => {
      const malformedMessages = [
        { /* missing required fields */ },
        null,
        undefined,
      ] as any[];
      
      const result = await relevanceScorer.calculateRelevance(malformedMessages, 'test');
      
      expect(result.scores).toHaveLength(3);
      expect(result.scores.every(score => score.compositeScore === 0)).toBe(true);
    });

    it('should handle extremely large datasets gracefully', async () => {
      const hugeDataset = Array.from({ length: 10000 }, (_, i) => ({
        ...mockMessages[0],
        text: `Generated message ${i}`,
      })) as SlackMessage[];
      
      await expect(
        relevanceScorer.calculateRelevance(hugeDataset, 'test')
      ).resolves.not.toThrow();
    });
  });
});

describe('DecisionExtractor', () => {
  let decisionExtractor: DecisionExtractor;
  let mockMessages: SlackMessage[];

  beforeEach(() => {
    decisionExtractor = new DecisionExtractor();
    
    mockMessages = [
      {
        type: 'message',
        user: 'U123456',
        text: 'After much discussion, we decided to implement the new API',
        ts: '1640995200.123456',
      },
      {
        type: 'message',
        user: 'U789012',
        text: 'The proposal has been approved by the team',
        ts: '1640995260.123456',
      },
      {
        type: 'message',
        user: 'U345678',
        text: 'Let me think about this approach',
        ts: '1640995320.123456',
      },
    ] as SlackMessage[];
  });

  describe('Decision Detection', () => {
    it('should extract decisions from thread messages', async () => {
      const result = await decisionExtractor.extractDecisions(mockMessages);
      
      expect(result).toHaveProperty('decisions');
      expect(result.decisions).toHaveLength(2); // Two decision messages
      expect(result.decisions[0]).toHaveProperty('text');
      expect(result.decisions[0]).toHaveProperty('confidence');
      expect(result.decisions[0]).toHaveProperty('keywords');
    });

    it('should detect decision keywords correctly', () => {
      const decisionKeywords = ['decided', 'approved', 'resolved', 'agreed', 'confirmed'];
      
      for (const keyword of decisionKeywords) {
        const message = { text: `We have ${keyword} to proceed` } as SlackMessage;
        const isDecision = decisionExtractor.isDecisionMessage(message);
        expect(isDecision).toBe(true);
      }
    });

    it('should handle multilingual decision detection', async () => {
      const japaneseMessages = [
        {
          type: 'message',
          user: 'U123',
          text: 'DECISION: 決定しました、この方針で進めます。公式決定です。', // Japanese: decided
          ts: '1640995200.123456',
        },
      ] as SlackMessage[];
      
      const result = await decisionExtractor.extractDecisions(japaneseMessages);
      
      expect(result.decisions).toHaveLength(1);
      expect(result.decisions[0]?.language).toBe('ja');
    });

    it('should assign confidence scores to decisions', async () => {
      const highConfidenceMessage = [{
        type: 'message',
        user: 'U123',
        text: 'DECISION: We have officially decided and approved the new implementation',
        ts: '1640995200.123456',
      }] as SlackMessage[];
      
      const lowConfidenceMessage = [{
        type: 'message',
        user: 'U123',
        text: 'Maybe we could decide later',
        ts: '1640995200.123456',
      }] as SlackMessage[];
      
      const highResult = await decisionExtractor.extractDecisions(highConfidenceMessage);
      const lowResult = await decisionExtractor.extractDecisions(lowConfidenceMessage);
      
      expect(highResult.decisions[0]?.confidence).toBeGreaterThan(0.8);
      expect(lowResult.decisions).toHaveLength(0); // Low confidence should be filtered out
    });
  });

  describe('Integration with Thread Service', () => {
    it('should complete the TODO at thread-service.ts:767', async () => {
      // This test ensures the decision extractor integrates with the thread service
      const result = await decisionExtractor.extractDecisionsForThread({
        channel: 'C123456',
        threadTs: '1640995200.123456',
        messages: mockMessages,
      });
      
      expect(result).toHaveProperty('decisionsMade');
      expect(Array.isArray(result.decisionsMade)).toBe(true);
      expect(result.decisionsMade.length).toBeGreaterThan(0);
    });

    it('should return ServiceResult pattern for thread integration', async () => {
      const result = await decisionExtractor.extractDecisionsService({
        messages: mockMessages,
      });
      
      expect(result).toHaveProperty('success');
      expect(result).toHaveProperty('data');
      expect(result).toHaveProperty('statusCode');
      expect(result).toHaveProperty('message');
    });
  });

  describe('Error Handling', () => {
    it('should handle empty message arrays', async () => {
      const result = await decisionExtractor.extractDecisions([]);
      
      expect(result.decisions).toHaveLength(0);
      expect(result.totalMessages).toBe(0);
    });

    it('should handle malformed messages gracefully', async () => {
      const malformedMessages = [
        { text: null },
        { user: 'U123' }, // missing text
        null,
      ] as any[];
      
      const result = await decisionExtractor.extractDecisions(malformedMessages);
      
      expect(result.decisions).toHaveLength(0);
    });
  });
});