/**
 * Test suite for enhanced urgency calculation features
 * Tests Japanese keywords, consecutive punctuation, and time-based urgency
 */

import {
  calculateUrgencyScore,
  detectConsecutivePunctuation,
  calculatePunctuationScore,
  detectTimeBasedUrgency,
  DEFAULT_URGENCY_CONFIG,
  explainPriorityAnalysis,
  calculateImportanceScore,
} from '../slack/analysis/thread/urgency-calculation.js';

import type { SlackMessage, ThreadParticipant } from '../slack/types/index.js';
import type { UrgencyConfig } from '../slack/analysis/thread/types.js';

// Test helper to create mock messages
function createMockMessage(text: string, user: string = 'user1', ts: string = '1699564800.000100'): SlackMessage {
  return {
    type: 'message',
    user,
    text,
    ts,
  };
}

// Mock participants for testing
const mockParticipants: ThreadParticipant[] = [
  {
    user_id: 'user1',
    username: 'alice',
    message_count: 1,
    first_message_ts: '1699564800.000100',
    last_message_ts: '1699564800.000100',
  },
];

describe('Enhanced Urgency Calculation', () => {
  describe('Enhanced Japanese Keywords', () => {
    test('should detect basic Japanese urgent keywords', () => {
      const messages = [
        createMockMessage('これは緊急の問題です'),
        createMockMessage('至急対応お願いします'),
        createMockMessage('急ぎで確認してください'),
      ];

      const result = calculateUrgencyScore(messages);

      expect(result.score).toBeGreaterThan(0.2);
      expect(result.urgentKeywords).toContain('緊急');
      expect(result.urgentKeywords).toContain('至急');
      expect(result.urgentKeywords).toContain('急ぎ');
    });

    test('should detect enhanced Japanese urgent keywords', () => {
      const messages = [
        createMockMessage('大至急対応が必要です'),
        createMockMessage('緊急対応をお願いします'),
        createMockMessage('優先して処理してください'),
        createMockMessage('エスカレーションが必要です'),
        createMockMessage('上長確認を急ぎでお願いします'),
        createMockMessage('承認急ぎでお願いします'),
      ];

      const result = calculateUrgencyScore(messages);

      expect(result.score).toBeGreaterThan(0.5);
      expect(result.urgentKeywords).toContain('大至急');
      expect(result.urgentKeywords).toContain('緊急対応');
      expect(result.urgentKeywords).toContain('優先');
      expect(result.urgentKeywords).toContain('エスカレーション');
      expect(result.urgentKeywords).toContain('上長確認');
      expect(result.urgentKeywords).toContain('承認急ぎ');
    });

    test('should handle mixed Japanese and English urgent keywords', () => {
      const messages = [
        createMockMessage('This is urgent! 緊急対応が必要です!!'),
        createMockMessage('ASAP please! 大至急お願いします'),
      ];

      const result = calculateUrgencyScore(messages);

      expect(result.score).toBeGreaterThan(0.4);
      expect(result.urgentKeywords).toContain('urgent');
      expect(result.urgentKeywords).toContain('緊急対応');
      expect(result.urgentKeywords).toContain('asap');
      expect(result.urgentKeywords).toContain('大至急');
    });
  });

  describe('Consecutive Punctuation Detection', () => {
    test('should detect consecutive exclamation marks', () => {
      const result = detectConsecutivePunctuation('This is urgent!!');

      expect(result.hasConsecutivePunctuation).toBe(true);
      expect(result.maxConsecutiveCount).toBe(2);
      expect(result.punctuationTypes).toContain('!');
      expect(result.totalPunctuationCount).toBe(2);
    });

    test('should detect consecutive question marks', () => {
      const result = detectConsecutivePunctuation('What is happening???');

      expect(result.hasConsecutivePunctuation).toBe(true);
      expect(result.maxConsecutiveCount).toBe(3);
      expect(result.punctuationTypes).toContain('?');
      expect(result.totalPunctuationCount).toBe(3);
    });

    test('should detect mixed consecutive punctuation', () => {
      const result = detectConsecutivePunctuation('Why is this broken?!?!');

      expect(result.hasConsecutivePunctuation).toBe(true);
      expect(result.maxConsecutiveCount).toBe(4);
      expect(result.punctuationTypes.length).toBeGreaterThan(0);
      expect(result.totalPunctuationCount).toBe(4);
    });

    test('should detect Japanese consecutive punctuation', () => {
      const result = detectConsecutivePunctuation('これは大変だ！！');

      expect(result.hasConsecutivePunctuation).toBe(true);
      expect(result.maxConsecutiveCount).toBe(2);
      expect(result.punctuationTypes).toContain('！');
      expect(result.totalPunctuationCount).toBe(2);
    });

    test('should handle no consecutive punctuation', () => {
      const result = detectConsecutivePunctuation('This is normal text.');

      expect(result.hasConsecutivePunctuation).toBe(false);
      expect(result.maxConsecutiveCount).toBe(0);
      expect(result.punctuationTypes).toHaveLength(0);
      expect(result.totalPunctuationCount).toBe(0);
    });

    test('should handle single punctuation marks', () => {
      const result = detectConsecutivePunctuation('This is urgent! But not too urgent?');

      expect(result.hasConsecutivePunctuation).toBe(false);
      expect(result.maxConsecutiveCount).toBe(0);
    });
  });

  describe('Punctuation Score Calculation', () => {
    test('should calculate correct score for 2 consecutive punctuation', () => {
      const punctuationInfo = {
        hasConsecutivePunctuation: true,
        maxConsecutiveCount: 2,
        punctuationTypes: ['!'],
        totalPunctuationCount: 2,
      };

      const score = calculatePunctuationScore(punctuationInfo, 0.03, 0.1);

      expect(score).toBe(0.03);
    });

    test('should calculate correct score for 3 consecutive punctuation', () => {
      const punctuationInfo = {
        hasConsecutivePunctuation: true,
        maxConsecutiveCount: 3,
        punctuationTypes: ['!'],
        totalPunctuationCount: 3,
      };

      const score = calculatePunctuationScore(punctuationInfo, 0.03, 0.1);

      expect(score).toBe(0.06);
    });

    test('should calculate maximum score for 4+ consecutive punctuation', () => {
      const punctuationInfo = {
        hasConsecutivePunctuation: true,
        maxConsecutiveCount: 5,
        punctuationTypes: ['!'],
        totalPunctuationCount: 5,
      };

      const score = calculatePunctuationScore(punctuationInfo, 0.03, 0.1);

      expect(score).toBe(0.1);
    });

    test('should return 0 for no consecutive punctuation', () => {
      const punctuationInfo = {
        hasConsecutivePunctuation: false,
        maxConsecutiveCount: 0,
        punctuationTypes: [],
        totalPunctuationCount: 0,
      };

      const score = calculatePunctuationScore(punctuationInfo, 0.03, 0.1);

      expect(score).toBe(0);
    });
  });

  describe('Time-based Urgency Detection', () => {
    test('should detect English time-based urgency keywords', () => {
      const timeKeywords = DEFAULT_URGENCY_CONFIG.timeBasedKeywords || [];
      const result = detectTimeBasedUrgency('Need this by end of day deadline', timeKeywords);

      expect(result.hasTimeBasedUrgency).toBe(true);
      expect(result.timeKeywords).toContain('deadline');
      expect(result.deadlineIndicators).toContain('deadline');
    });

    test('should detect Japanese time-based urgency keywords', () => {
      const timeKeywords = DEFAULT_URGENCY_CONFIG.timeBasedKeywords || [];
      const result = detectTimeBasedUrgency('本日中に完了してください', timeKeywords);

      expect(result.hasTimeBasedUrgency).toBe(true);
      expect(result.timeKeywords).toContain('本日中');
      expect(result.deadlineIndicators).toContain('本日中');
    });

    test('should categorize meeting urgency keywords', () => {
      const timeKeywords = DEFAULT_URGENCY_CONFIG.timeBasedKeywords || [];
      const result = detectTimeBasedUrgency('Need this before meeting starts', timeKeywords);

      expect(result.hasTimeBasedUrgency).toBe(true);
      expect(result.timeKeywords).toContain('before meeting');
      expect(result.meetingUrgency).toContain('before meeting');
    });

    test('should detect Japanese meeting urgency', () => {
      const timeKeywords = DEFAULT_URGENCY_CONFIG.timeBasedKeywords || [];
      const result = detectTimeBasedUrgency('会議前に準備してください', timeKeywords);

      expect(result.hasTimeBasedUrgency).toBe(true);
      expect(result.timeKeywords).toContain('会議前');
      expect(result.meetingUrgency).toContain('会議前');
    });

    test('should handle multiple time keywords', () => {
      const timeKeywords = DEFAULT_URGENCY_CONFIG.timeBasedKeywords || [];
      const result = detectTimeBasedUrgency('Need this by deadline 本日中 before meeting', timeKeywords);

      expect(result.hasTimeBasedUrgency).toBe(true);
      expect(result.timeKeywords.length).toBeGreaterThanOrEqual(2);
      expect(result.deadlineIndicators.length).toBeGreaterThan(0);
      expect(result.meetingUrgency.length).toBeGreaterThan(0);
    });

    test('should handle no time-based urgency', () => {
      const timeKeywords = DEFAULT_URGENCY_CONFIG.timeBasedKeywords || [];
      const result = detectTimeBasedUrgency('This is a normal message', timeKeywords);

      expect(result.hasTimeBasedUrgency).toBe(false);
      expect(result.timeKeywords).toHaveLength(0);
      expect(result.deadlineIndicators).toHaveLength(0);
      expect(result.meetingUrgency).toHaveLength(0);
    });
  });

  describe('Integrated Urgency Scoring', () => {
    test('should include punctuation score in urgency calculation', () => {
      const messages = [createMockMessage('This is urgent!!!')];

      const result = calculateUrgencyScore(messages);

      expect(result.score).toBeGreaterThan(0.2);
      expect(result.punctuationScore).toBeDefined();
      expect(result.punctuationScore).toBeGreaterThan(0);
      expect(result.punctuationInfo).toBeDefined();
      expect(result.punctuationInfo?.hasConsecutivePunctuation).toBe(true);
    });

    test('should include time-based score in urgency calculation', () => {
      const messages = [createMockMessage('Need this by deadline today')];

      const result = calculateUrgencyScore(messages);

      expect(result.score).toBeGreaterThan(0.2);
      expect(result.timeBasedScore).toBeDefined();
      expect(result.timeBasedScore).toBeGreaterThan(0);
      expect(result.timeUrgencyInfo).toBeDefined();
      expect(result.timeUrgencyInfo?.hasTimeBasedUrgency).toBe(true);
    });

    test('should combine all scoring factors', () => {
      const messages = [
        createMockMessage('This is urgent!!! Need by deadline 本日中 緊急対応'),
      ];

      const result = calculateUrgencyScore(messages);

      expect(result.score).toBeGreaterThan(0.5);
      expect(result.urgentKeywords.length).toBeGreaterThan(0);
      expect(result.punctuationScore).toBeGreaterThan(0);
      expect(result.timeBasedScore).toBeGreaterThan(0);
      expect(result.punctuationInfo?.hasConsecutivePunctuation).toBe(true);
      expect(result.timeUrgencyInfo?.hasTimeBasedUrgency).toBe(true);
    });

    test('should respect maximum score cap of 1.0', () => {
      // Create a highly urgent message with all factors
      const messages = Array.from({ length: 25 }, (_, i) => 
        createMockMessage(`URGENT!!! CRITICAL!!! 緊急対応!!! 大至急!!! deadline 本日中 急ぎ!!! Message ${i}`)
      );

      const result = calculateUrgencyScore(messages);

      expect(result.score).toBeLessThanOrEqual(1.0);
      expect(result.score).toBeGreaterThan(0.9); // Should be very high but capped
    });

    test('should handle custom configuration', () => {
      const customConfig: UrgencyConfig = {
        ...DEFAULT_URGENCY_CONFIG,
        consecutivePunctuationWeight: 0.05,
        maxPunctuationBonus: 0.15,
        timeBasedWeight: 0.2,
      };

      const messages = [createMockMessage('Urgent!!! deadline today')];

      const result = calculateUrgencyScore(messages, customConfig);

      expect(result.score).toBeGreaterThan(0.3);
      expect(result.punctuationScore).toBeGreaterThan(0.05); // Higher weight
      expect(result.timeBasedScore).toBeGreaterThan(0.15); // Higher weight
    });
  });

  describe('Enhanced Priority Analysis Explanation', () => {
    test('should include punctuation information in explanation', () => {
      const messages = [createMockMessage('This is urgent!!!')];
      const urgencyScore = calculateUrgencyScore(messages);
      const importanceScore = calculateImportanceScore(messages, mockParticipants);

      const explanation = explainPriorityAnalysis(urgencyScore, importanceScore);

      expect(explanation).toContain('Emphasis detected');
      expect(explanation).toContain('consecutive punctuation');
      expect(explanation).toContain('urgency');
    });

    test('should include time-based urgency in explanation', () => {
      const messages = [createMockMessage('Need this by deadline today 本日中')];
      const urgencyScore = calculateUrgencyScore(messages);
      const importanceScore = calculateImportanceScore(messages, mockParticipants);

      const explanation = explainPriorityAnalysis(urgencyScore, importanceScore);

      expect(explanation).toContain('Time sensitivity');
      expect(explanation).toContain('deadline');
      expect(explanation).toContain('Deadline indicators');
    });

    test('should include meeting urgency in explanation', () => {
      const messages = [createMockMessage('Need this before meeting starts 会議前')];
      const urgencyScore = calculateUrgencyScore(messages);
      const importanceScore = calculateImportanceScore(messages, mockParticipants);

      const explanation = explainPriorityAnalysis(urgencyScore, importanceScore);

      expect(explanation).toContain('Time sensitivity');
      expect(explanation).toContain('Meeting urgency');
      expect(explanation).toContain('before meeting');
    });

    test('should include all enhancements in comprehensive explanation', () => {
      const messages = [createMockMessage('URGENT!!! Need by deadline 本日中 before meeting 緊急対応!!!')];
      const urgencyScore = calculateUrgencyScore(messages);
      const importanceScore = calculateImportanceScore(messages, mockParticipants);

      const explanation = explainPriorityAnalysis(urgencyScore, importanceScore);

      expect(explanation).toContain('Overall Priority');
      expect(explanation).toContain('Urgent keywords found');
      expect(explanation).toContain('Emphasis detected');
      expect(explanation).toContain('Time sensitivity');
      expect(explanation).toContain('Deadline indicators');
      expect(explanation).toContain('Meeting urgency');
    });
  });

  describe('Backward Compatibility', () => {
    test('should work with minimal configuration (backward compatibility)', () => {
      const minimalConfig: UrgencyConfig = {
        urgentKeywords: ['urgent', 'critical'],
        keywordWeight: 0.2,
        messageCountThresholds: { medium: 10, high: 20 },
        messageCountWeight: 0.3,
      };

      const messages = [createMockMessage('This is urgent')];
      const result = calculateUrgencyScore(messages, minimalConfig);

      expect(result.score).toBeGreaterThan(0);
      expect(result.urgentKeywords).toContain('urgent');
      expect(result.punctuationScore).toBeUndefined();
      expect(result.timeBasedScore).toBeUndefined();
      expect(result.punctuationInfo).toBeUndefined();
      expect(result.timeUrgencyInfo).toBeUndefined();
    });

    test('should handle default configuration without new features', () => {
      const messages = [createMockMessage('This is urgent but normal')];
      const result = calculateUrgencyScore(messages);

      expect(result.score).toBeGreaterThan(0);
      expect(result.urgentKeywords).toContain('urgent');
      // These should be undefined since there's no punctuation or time urgency
      expect(result.punctuationScore).toBeUndefined();
      expect(result.timeBasedScore).toBeUndefined();
      expect(result.punctuationInfo).toBeUndefined();
      expect(result.timeUrgencyInfo).toBeUndefined();
    });
  });

  describe('Edge Cases and Error Handling', () => {
    test('should handle empty messages array', () => {
      const result = calculateUrgencyScore([]);

      expect(result.score).toBe(0);
      expect(result.urgentKeywords).toHaveLength(0);
      expect(result.messageCountFactor).toBe(0);
      expect(result.punctuationScore).toBeUndefined();
      expect(result.timeBasedScore).toBeUndefined();
    });

    test('should handle messages with empty text', () => {
      const messages = [createMockMessage('')];
      const result = calculateUrgencyScore(messages);

      expect(result.score).toBeGreaterThanOrEqual(0);
      expect(result.urgentKeywords).toHaveLength(0);
      expect(result.punctuationScore).toBeUndefined();
      expect(result.timeBasedScore).toBeUndefined();
    });

    test('should handle messages with only punctuation', () => {
      const messages = [createMockMessage('!!!')];
      const result = calculateUrgencyScore(messages);

      expect(result.score).toBeGreaterThan(0);
      expect(result.punctuationScore).toBeGreaterThan(0);
      expect(result.punctuationInfo?.hasConsecutivePunctuation).toBe(true);
    });

    test('should handle messages with mixed content types', () => {
      const messages = [
        createMockMessage('Normal message'),
        createMockMessage('URGENT!!!'),
        createMockMessage('deadline today'),
        createMockMessage('緊急対応が必要です！！'),
      ];

      const result = calculateUrgencyScore(messages);

      expect(result.score).toBeGreaterThan(0.5);
      expect(result.urgentKeywords.length).toBeGreaterThan(0);
      expect(result.punctuationScore).toBeGreaterThan(0);
      expect(result.timeBasedScore).toBeGreaterThan(0);
    });
  });
});