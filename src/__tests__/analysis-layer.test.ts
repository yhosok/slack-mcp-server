/**
 * Test suite for the analysis layer functions
 */

import {
  analyzeSentiment,
  extractTopicsFromThread,
  calculateUrgencyScore,
  calculateImportanceScore,
  extractActionItemsFromMessages,
  buildThreadTimeline,
  performComprehensiveAnalysis,
  performQuickAnalysis,
  formatBytes,
  formatDuration,
  formatThreadAnalysis,
} from '../slack/analysis/index.js';

import type { SlackMessage, ThreadParticipant } from '../slack/types/index.js';

// Mock messages for testing
const mockMessages: SlackMessage[] = [
  {
    type: 'message',
    user: 'user1',
    text: 'This is urgent! We need to fix the critical bug immediately.',
    ts: '1699564800.000100', // Nov 9, 2023 16:00:00 GMT
  },
  {
    type: 'message',
    user: 'user2',
    text: 'I agree, this is very important for the client launch.',
    ts: '1699564860.000200', // Nov 9, 2023 16:01:00 GMT
  },
  {
    type: 'message',
    user: 'user1',
    text: 'TODO: Need to update the database schema and test the new endpoint.',
    ts: '1699564920.000300', // Nov 9, 2023 16:02:00 GMT
  },
];

const mockParticipants: ThreadParticipant[] = [
  {
    user_id: 'user1',
    username: 'alice',
    message_count: 2,
    first_message_ts: '1699564800.000100',
    last_message_ts: '1699564920.000300',
  },
  {
    user_id: 'user2',
    username: 'bob',
    message_count: 1,
    first_message_ts: '1699564860.000200',
    last_message_ts: '1699564860.000200',
  },
];

describe('Analysis Layer Functions', () => {
  describe('Sentiment Analysis', () => {
    test('should analyze positive sentiment correctly', () => {
      const positiveMessages: SlackMessage[] = [
        {
          type: 'message',
          user: 'user1',
          text: 'Great job! This is excellent work.',
          ts: '1699564800.000100',
        },
      ];

      const result = analyzeSentiment(positiveMessages);

      expect(result.sentiment).toBe('positive');
      expect(result.positiveCount).toBeGreaterThan(0);
      expect(result.totalWords).toBeGreaterThan(0);
    });

    test('should analyze negative sentiment correctly', () => {
      const negativeMessages: SlackMessage[] = [
        {
          type: 'message',
          user: 'user1',
          text: 'This is terrible and awful, I hate this bug.',
          ts: '1699564800.000100',
        },
      ];

      const result = analyzeSentiment(negativeMessages);

      expect(result.sentiment).toBe('negative');
      expect(result.negativeCount).toBeGreaterThan(0);
    });

    test('should handle empty messages', () => {
      const result = analyzeSentiment([]);

      expect(result.sentiment).toBe('neutral');
      expect(result.totalWords).toBe(0);
    });
  });

  describe('Topic Extraction', () => {
    test('should extract topics from messages', () => {
      const result = extractTopicsFromThread(mockMessages);

      expect(result.topics).toBeDefined();
      expect(Array.isArray(result.topics)).toBe(true);
      expect(result.hasJapaneseContent).toBe(false);
      expect(result.hasEnglishContent).toBe(true);
    });

    test('should handle multilingual content', () => {
      const multilingualMessages: SlackMessage[] = [
        {
          type: 'message',
          user: 'user1',
          text: 'Hello world こんにちは世界',
          ts: '1699564800.000100',
        },
      ];

      const result = extractTopicsFromThread(multilingualMessages);

      expect(result.hasJapaneseContent).toBe(true);
      expect(result.hasEnglishContent).toBe(true);
    });
  });

  describe('Urgency Calculation', () => {
    test('should calculate urgency score correctly', () => {
      const result = calculateUrgencyScore(mockMessages);

      expect(result.score).toBeGreaterThan(0);
      expect(result.urgentKeywords.length).toBeGreaterThan(0);
      expect(result.urgentKeywords).toContain('urgent');
    });

    test('should handle low urgency messages', () => {
      const lowUrgencyMessages: SlackMessage[] = [
        {
          type: 'message',
          user: 'user1',
          text: 'This is a regular update.',
          ts: '1699564800.000100',
        },
      ];

      const result = calculateUrgencyScore(lowUrgencyMessages);

      expect(result.score).toBeGreaterThanOrEqual(0);
      expect(result.urgentKeywords.length).toBe(0);
    });
  });

  describe('Importance Calculation', () => {
    test('should calculate importance score correctly', () => {
      const result = calculateImportanceScore(mockMessages, mockParticipants);

      expect(result.score).toBeGreaterThan(0);
      expect(result.participantFactor).toBeGreaterThan(0);
      expect(result.messageFactor).toBeGreaterThan(0);
    });
  });

  describe('Action Item Extraction', () => {
    test('should extract action items from messages', () => {
      const result = extractActionItemsFromMessages(mockMessages);

      expect(result.actionItems.length).toBeGreaterThan(0);
      expect(result.actionIndicatorsFound.length).toBeGreaterThan(0);

      const actionItem = result.actionItems[0];
      expect(actionItem).toBeDefined();
      if (actionItem) {
        expect(actionItem.text).toBeDefined();
        expect(['low', 'medium', 'high']).toContain(actionItem.priority);
        expect(['open', 'in_progress', 'completed']).toContain(actionItem.status);
      }
    });
  });

  describe('Timeline Building', () => {
    test('should build timeline from messages', () => {
      const result = buildThreadTimeline(mockMessages);

      expect(result.events.length).toBe(mockMessages.length);
      expect(result.totalDuration).toBeGreaterThan(0);
      expect(result.messageVelocity).toBeGreaterThan(0);
    });
  });

  describe('Comprehensive Analysis', () => {
    test('should perform comprehensive analysis', async () => {
      const result = await performComprehensiveAnalysis(mockMessages, mockParticipants);

      expect(result.sentiment).toBeDefined();
      expect(result.topics).toBeDefined();
      expect(result.urgency).toBeDefined();
      expect(result.importance).toBeDefined();
      expect(result.actionItems).toBeDefined();
      expect(result.timeline).toBeDefined();
      expect(result.metadata.messageCount).toBe(mockMessages.length);
      expect(result.metadata.participantCount).toBe(mockParticipants.length);
    });

    test('should perform quick analysis', async () => {
      const result = await performQuickAnalysis(mockMessages);

      expect(result.sentiment).toBeDefined();
      expect(result.topicCount).toBeGreaterThanOrEqual(0);
      expect(['low', 'medium', 'high', 'critical']).toContain(result.urgencyLevel);
      expect(result.actionItemCount).toBeGreaterThanOrEqual(0);
      expect(result.duration).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Formatting Functions', () => {
    test('should format bytes correctly', () => {
      expect(formatBytes(1024)).toMatch(/1\.0 KiB/);
      expect(formatBytes(1024 * 1024)).toMatch(/1\.0 MiB/);
      expect(formatBytes(0)).toBe('0 Bytes');
    });

    test('should format duration correctly', () => {
      expect(formatDuration(60)).toMatch(/1\.0 hour/);
      expect(formatDuration(30)).toMatch(/30 minutes/);
      expect(formatDuration(1440)).toMatch(/1\.0 day/);
    });

    test('should format thread analysis', async () => {
      const comprehensiveResult = await performComprehensiveAnalysis(mockMessages, mockParticipants);

      // Create mock ThreadAnalysis object
      const mockAnalysis = {
        thread_ts: '1699564800.000100',
        channel_id: 'test-channel',
        participants: mockParticipants,
        timeline: [...comprehensiveResult.timeline.events], // Convert readonly array to mutable
        key_topics: [...comprehensiveResult.topics.topics], // Convert readonly array to mutable
        urgency_score: comprehensiveResult.urgency.score,
        importance_score: comprehensiveResult.importance.score,
        sentiment: comprehensiveResult.sentiment.sentiment,
        action_items: [...comprehensiveResult.actionItems.actionItems], // Convert readonly array to mutable
        summary: 'Test thread analysis',
        word_count: 100,
        duration_hours: comprehensiveResult.timeline.totalDuration / 60,
      };

      const formatted = formatThreadAnalysis(mockAnalysis);

      expect(formatted.content).toContain('Thread Analysis');
      expect(formatted.content).toContain('Overview');
      expect(formatted.content).toContain('Scores');
      expect(formatted.characterCount).toBeGreaterThan(0);
      expect(formatted.lineCount).toBeGreaterThan(0);
    });
  });

  describe('Pure Function Properties', () => {
    test('all functions should be deterministic (same input = same output)', () => {
      // Test sentiment analysis determinism
      const result1 = analyzeSentiment(mockMessages);
      const result2 = analyzeSentiment(mockMessages);
      expect(result1).toEqual(result2);

      // Test topic extraction determinism
      const topics1 = extractTopicsFromThread(mockMessages);
      const topics2 = extractTopicsFromThread(mockMessages);
      expect(topics1.topics).toEqual(topics2.topics);

      // Test urgency calculation determinism
      const urgency1 = calculateUrgencyScore(mockMessages);
      const urgency2 = calculateUrgencyScore(mockMessages);
      expect(urgency1).toEqual(urgency2);
    });

    test('functions should not mutate input data', () => {
      const originalMessages = [...mockMessages];
      const originalParticipants = [...mockParticipants];

      // Run various analysis functions
      analyzeSentiment(mockMessages);
      extractTopicsFromThread(mockMessages);
      calculateUrgencyScore(mockMessages);
      calculateImportanceScore(mockMessages, mockParticipants);
      extractActionItemsFromMessages(mockMessages);
      buildThreadTimeline(mockMessages);

      // Verify original data is unchanged
      expect(mockMessages).toEqual(originalMessages);
      expect(mockParticipants).toEqual(originalParticipants);
    });

    test('functions should handle edge cases gracefully', () => {
      // Test with empty arrays
      expect(() => analyzeSentiment([])).not.toThrow();
      expect(() => extractTopicsFromThread([])).not.toThrow();
      expect(() => calculateUrgencyScore([])).not.toThrow();
      expect(() => calculateImportanceScore([], [])).not.toThrow();
      expect(() => extractActionItemsFromMessages([])).not.toThrow();
      expect(() => buildThreadTimeline([])).not.toThrow();

      // Test with malformed data
      const malformedMessages: SlackMessage[] = [
        { type: 'message', user: undefined, text: undefined, ts: '' },
      ];

      expect(() => analyzeSentiment(malformedMessages)).not.toThrow();
      expect(() => extractTopicsFromThread(malformedMessages)).not.toThrow();
      expect(() => buildThreadTimeline(malformedMessages)).not.toThrow();
    });
  });
});
