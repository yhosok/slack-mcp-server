/**
 * Comprehensive test suite for Japanese sentiment analysis improvements
 */

import {
  analyzeSentiment,
  countJapaneseWordOccurrences,
  processNegationPatterns,
  processEmphasisMitigation,
  explainSentiment,
  DEFAULT_SENTIMENT_CONFIG,
} from '../slack/analysis/thread/sentiment-analysis.js';

import type { SlackMessage } from '../slack/types/index.js';
import type { SentimentConfig } from '../slack/analysis/thread/types.js';

// Test message factory
const createMessage = (text: string, user = 'user1', ts = '1699564800.000100'): SlackMessage => ({
  type: 'message',
  user,
  text,
  ts,
});

describe('Japanese Sentiment Analysis', () => {
  describe('Basic Japanese Word Detection', () => {
    test('should detect positive Japanese words', () => {
      const messages = [createMessage('これは良いですね！素晴らしい仕事です。')];
      const result = analyzeSentiment(messages);

      expect(result.sentiment).toBe('positive');
      expect(result.japanesePositiveCount).toBeGreaterThan(0);
      expect(result.languageContent?.hasJapanese).toBe(true);
    });

    test('should detect negative Japanese words', () => {
      const messages = [createMessage('これは悪いですね。ひどい問題があります。')];
      const result = analyzeSentiment(messages);

      expect(result.sentiment).toBe('negative');
      expect(result.japaneseNegativeCount).toBeGreaterThan(0);
      expect(result.languageContent?.hasJapanese).toBe(true);
    });

    test('should handle mixed Japanese and English', () => {
      const messages = [createMessage('Good job! これは素晴らしいです。Great work!')];
      const result = analyzeSentiment(messages);

      expect(result.sentiment).toBe('positive');
      expect(result.positiveCount).toBeGreaterThan(0);
      expect(result.japanesePositiveCount).toBeGreaterThan(0);
      expect(result.languageContent?.hasJapanese).toBe(true);
      expect(result.languageContent?.hasEnglish).toBe(true);
      expect(result.languageContent?.mixedLanguage).toBe(true);
    });

    test('should handle Japanese business communication terms', () => {
      const messages = [createMessage('お疲れ様です。助かります。ありがとうございます。')];
      const result = analyzeSentiment(messages);

      expect(result.sentiment).toBe('positive');
      expect(result.japanesePositiveCount).toBeGreaterThan(0);
    });
  });

  describe('Japanese Word Counting', () => {
    test('countJapaneseWordOccurrences should count correctly', () => {
      const text = '良い良い素晴らしい';
      const words = ['良い', '素晴らしい', '最高'];

      const count = countJapaneseWordOccurrences(text, words);
      expect(count).toBe(3); // 良い appears twice, 素晴らしい once
    });

    test('should handle overlapping Japanese words', () => {
      const text = '素晴らしい素晴らしい作業';
      const words = ['素晴らしい'];

      const count = countJapaneseWordOccurrences(text, words);
      expect(count).toBe(2);
    });

    test('should not count non-existent words', () => {
      const text = '良い仕事です';
      const words = ['悪い', 'ひどい'];

      const count = countJapaneseWordOccurrences(text, words);
      expect(count).toBe(0);
    });
  });

  describe('Negation Pattern Processing', () => {
    test('should detect simple negation patterns', () => {
      const messages = [createMessage('良くないです。問題があります。悪いです。ひどいです。')];
      const result = analyzeSentiment(messages);

      expect(result.negationAdjustments || 0).toBeGreaterThan(0);
      // Should have negative sentiment due to multiple negative words and negation
      expect(result.sentiment).toBe('negative');
      expect(result.japaneseNegativeCount || 0).toBeGreaterThan(0);
    });

    test('should handle various negation forms', () => {
      const text = '良くない、素晴らしくありません、最高じゃない、完璧ではない';
      const negationPatterns = ['ない', 'ません', 'じゃない', 'ではない'];

      const result = processNegationPatterns(text, negationPatterns, 4, 0);
      // Note: The text has overlapping patterns (e.g., 'じゃない' contains 'ない')
      // so the count will be higher than 4
      expect(result.negationAdjustments).toBeGreaterThan(4);
      expect(result.adjustedNegativeCount).toBeGreaterThan(0);
    });

    test('should not over-adjust for minor negations', () => {
      const text = '良いですが、少し問題があります';
      const negationPatterns = ['ない'];

      const result = processNegationPatterns(text, negationPatterns, 1, 1);
      // Should not flip sentiment for minor negation
      expect(result.adjustedPositiveCount).toBe(1);
      expect(result.adjustedNegativeCount).toBe(1);
    });

    test('processNegationPatterns should flip sentiment appropriately', () => {
      const result = processNegationPatterns('良くない悪くない', ['ない'], 3, 1);

      // 2 negation patterns, should reduce positive and increase negative
      expect(result.negationAdjustments).toBe(2);
      expect(result.adjustedPositiveCount).toBeLessThan(3); // Should be reduced
      expect(result.adjustedNegativeCount).toBeGreaterThan(1); // Should be increased
    });
  });

  describe('Emphasis and Mitigation Processing', () => {
    test('should amplify sentiment with emphasis patterns', () => {
      const messages = [createMessage('めちゃくちゃ良いです！すごく素晴らしい！')];
      const result = analyzeSentiment(messages);

      expect(result.emphasisAdjustments).toBeGreaterThan(0);
      expect(result.positiveCount).toBeGreaterThan(result.japanesePositiveCount || 0);
    });

    test('should reduce sentiment with mitigation patterns', () => {
      const messages = [createMessage('少し良いですが、まあまあです。')];
      const result = analyzeSentiment(messages);

      expect(result.mitigationAdjustments).toBeGreaterThan(0);
      // Mitigation should reduce the positive count
      expect(result.positiveCount).toBeLessThanOrEqual(result.japanesePositiveCount || 1);
    });

    test('processEmphasisMitigation should apply correct multipliers', () => {
      const emphasisPatterns = new Map([
        ['めちゃ', 1.5],
        ['すごく', 1.5],
      ]);
      const mitigationPatterns = new Map([
        ['少し', 0.8],
        ['まあまあ', 0.9],
      ]);

      // Test emphasis only
      const emphasisResult = processEmphasisMitigation(
        'めちゃ良い',
        emphasisPatterns,
        new Map(),
        2,
        1
      );
      expect(emphasisResult.adjustedPositiveCount).toBe(3); // 2 * 1.5 = 3
      expect(emphasisResult.emphasisAdjustments).toBe(1);

      // Test mitigation only
      const mitigationResult = processEmphasisMitigation(
        '少し良い',
        new Map(),
        mitigationPatterns,
        2,
        1
      );
      expect(mitigationResult.adjustedPositiveCount).toBe(2); // 2 * 0.8 = 1.6, rounded to 2
      expect(mitigationResult.mitigationAdjustments).toBe(1);

      // Test both emphasis and mitigation
      const combinedResult = processEmphasisMitigation(
        'めちゃ少し良い',
        emphasisPatterns,
        mitigationPatterns,
        2,
        1
      );
      // 1.5 * 0.8 = 1.2, so 2 * 1.2 = 2.4, rounded to 2
      expect(combinedResult.adjustedPositiveCount).toBe(2);
      expect(combinedResult.emphasisAdjustments).toBe(1);
      expect(combinedResult.mitigationAdjustments).toBe(1);
    });

    test('should handle multiple emphasis patterns', () => {
      const text = 'めちゃくちゃすごく良い';
      const emphasisPatterns = new Map([
        ['めちゃくちゃ', 1.5],
        ['すごく', 1.5],
      ]);

      const result = processEmphasisMitigation(text, emphasisPatterns, new Map(), 1, 0);
      expect(result.emphasisAdjustments).toBe(2);
      expect(result.adjustedPositiveCount).toBe(2); // Max multiplier of 1.5 applied
    });
  });

  describe('Edge Cases and Error Handling', () => {
    test('should handle empty Japanese text', () => {
      const messages = [createMessage('')];
      const result = analyzeSentiment(messages);

      expect(result.sentiment).toBe('neutral');
      expect(result.japanesePositiveCount).toBe(0);
      expect(result.japaneseNegativeCount).toBe(0);
    });

    test('should handle text without sentiment words', () => {
      const messages = [createMessage('これはテストです。今日は晴れです。')];
      const result = analyzeSentiment(messages);

      expect(result.sentiment).toBe('neutral');
      expect(result.totalWords).toBeGreaterThan(0);
    });

    test('should handle mixed script with punctuation', () => {
      const messages = [createMessage('Good！良い！Excellent！素晴らしい！')];
      const result = analyzeSentiment(messages);

      expect(result.sentiment).toBe('positive');
      expect(result.positiveCount).toBeGreaterThan(0);
      expect(result.japanesePositiveCount).toBeGreaterThan(0);
    });

    test('should handle text with only negation patterns', () => {
      const messages = [createMessage('ない、ません、じゃない、ではない')];
      const result = analyzeSentiment(messages);

      expect(result.sentiment).toBe('neutral');
      expect(result.negationAdjustments).toBeGreaterThan(0);
    });

    test('should be backwards compatible with English-only config', () => {
      const englishOnlyConfig: SentimentConfig = {
        positiveWords: ['good', 'great'],
        negativeWords: ['bad', 'terrible'],
        threshold: 1.2,
        enableJapaneseProcessing: false,
      };

      const messages = [createMessage('Good job! 良いですね！')];
      const result = analyzeSentiment(messages, englishOnlyConfig);

      expect(result.sentiment).toBe('positive');
      expect(result.japanesePositiveCount).toBe(0); // Should not process Japanese
      expect(result.positiveCount).toBe(1); // Only English 'Good'
    });
  });

  describe('Business Communication Scenarios', () => {
    test('should handle formal Japanese business communication', () => {
      const messages = [
        createMessage('お疲れ様です。'),
        createMessage('素晴らしい成果ですね。ありがとうございます。'),
        createMessage('完璧な仕上がりで満足しています。'),
      ];
      const result = analyzeSentiment(messages);

      expect(result.sentiment).toBe('positive');
      expect(result.japanesePositiveCount).toBeGreaterThan(0);
    });

    test('should handle problem reporting in Japanese', () => {
      const messages = [
        createMessage('申し訳ございませんが、問題があります。'),
        createMessage('バグが発見されました。大変困っています。'),
        createMessage('修正が必要な課題があります。'),
      ];
      const result = analyzeSentiment(messages);

      expect(result.sentiment).toBe('negative');
      expect(result.japaneseNegativeCount).toBeGreaterThan(0);
    });

    test('should handle mixed feedback with nuance', () => {
      const messages = [
        createMessage('とても良いアイデアですが、少し改善が必要かもしれません。'),
        createMessage('完璧ではありませんが、良い進歩だと思います。'),
      ];
      const result = analyzeSentiment(messages);

      // Should detect positive elements and mitigation patterns
      expect(result.japanesePositiveCount).toBeGreaterThan(0);
      expect(result.japaneseNegativeCount).toBeGreaterThan(0); // '改善' and '必要' are negative words
      expect(result.mitigationAdjustments).toBeGreaterThan(0);
    });

    test('should handle enthusiasm with emphasis patterns', () => {
      const messages = [
        createMessage('めちゃくちゃ嬉しいです！'),
        createMessage('すごく助かりました！'),
        createMessage('非常に素晴らしい結果です！'),
      ];
      const result = analyzeSentiment(messages);

      expect(result.sentiment).toBe('positive');
      expect(result.emphasisAdjustments).toBeGreaterThan(0);
      expect(result.positiveCount).toBeGreaterThan(result.japanesePositiveCount || 0);
    });
  });

  describe('Sentiment Explanation with Japanese Features', () => {
    test('should include Japanese analysis in explanation', () => {
      const messages = [createMessage('Good job! 素晴らしいです！')];
      const result = analyzeSentiment(messages);
      const explanation = explainSentiment(result);

      expect(explanation).toContain('Japanese analysis');
      expect(explanation).toContain('positive');
    });

    test('should include adjustment information in explanation', () => {
      const messages = [createMessage('めちゃくちゃ良くないです。とても悪いです。')];
      const result = analyzeSentiment(messages);
      const explanation = explainSentiment(result);

      // Should have some sentiment words to generate meaningful explanation
      expect(result.totalWords).toBeGreaterThan(1);

      if ((result.negationAdjustments || 0) > 0 || (result.emphasisAdjustments || 0) > 0) {
        expect(explanation).toContain('Applied adjustments');
      }

      // Verify it processes the text correctly
      expect(result.negationAdjustments || 0).toBeGreaterThan(0); // Should detect 'ない'
      expect(result.emphasisAdjustments || 0).toBeGreaterThan(0); // Should detect 'めちゃくちゃ' and 'とても'
    });

    test('should handle explanation for neutral Japanese text', () => {
      const messages = [createMessage('今日は会議があります。資料を準備します。')];
      const result = analyzeSentiment(messages);
      const explanation = explainSentiment(result);

      expect(explanation).toContain('Neutral sentiment');
      expect(explanation).toContain('no clear positive or negative indicators');
    });
  });

  describe('Configuration Validation', () => {
    test('should work with default configuration', () => {
      const messages = [createMessage('良いです！')];
      const result = analyzeSentiment(messages, DEFAULT_SENTIMENT_CONFIG);

      expect(result.sentiment).toBe('positive');
      expect(result.japanesePositiveCount).toBeGreaterThan(0);
      expect(DEFAULT_SENTIMENT_CONFIG.enableJapaneseProcessing).toBe(true);
    });

    test('should validate Japanese word arrays', () => {
      expect(DEFAULT_SENTIMENT_CONFIG.japanesePositiveWords).toBeDefined();
      expect(DEFAULT_SENTIMENT_CONFIG.japaneseNegativeWords).toBeDefined();
      expect(DEFAULT_SENTIMENT_CONFIG.japanesePositiveWords!.length).toBeGreaterThan(0);
      expect(DEFAULT_SENTIMENT_CONFIG.japaneseNegativeWords!.length).toBeGreaterThan(0);
    });

    test('should validate pattern maps', () => {
      expect(DEFAULT_SENTIMENT_CONFIG.emphasisPatterns).toBeInstanceOf(Map);
      expect(DEFAULT_SENTIMENT_CONFIG.mitigationPatterns).toBeInstanceOf(Map);
      expect(DEFAULT_SENTIMENT_CONFIG.emphasisPatterns!.size).toBeGreaterThan(0);
      expect(DEFAULT_SENTIMENT_CONFIG.mitigationPatterns!.size).toBeGreaterThan(0);
    });

    test('should validate negation patterns', () => {
      expect(DEFAULT_SENTIMENT_CONFIG.negationPatterns).toBeDefined();
      expect(DEFAULT_SENTIMENT_CONFIG.negationPatterns!.length).toBeGreaterThan(0);
      expect(DEFAULT_SENTIMENT_CONFIG.negationPatterns).toContain('ない');
    });
  });

  describe('Performance and Determinism', () => {
    test('should be deterministic with same input', () => {
      const messages = [createMessage('めちゃくちゃ良いですが、少し問題があります。')];

      const result1 = analyzeSentiment(messages);
      const result2 = analyzeSentiment(messages);

      expect(result1).toEqual(result2);
    });

    test('should handle large Japanese text efficiently', () => {
      const largeText = '良い '.repeat(1000) + '悪い '.repeat(500) + 'めちゃくちゃ'.repeat(100);
      const messages = [createMessage(largeText)];

      const start = Date.now();
      const result = analyzeSentiment(messages);
      const duration = Date.now() - start;

      expect(duration).toBeLessThan(1000); // Should complete within 1 second
      expect(result.sentiment).toBe('positive'); // Should handle large text correctly
      expect(result.japanesePositiveCount).toBeGreaterThan(0);
    });

    test('should not mutate input configuration', () => {
      const originalConfig = { ...DEFAULT_SENTIMENT_CONFIG };
      const messages = [createMessage('良いです')];

      analyzeSentiment(messages, DEFAULT_SENTIMENT_CONFIG);

      // Check that configuration hasn't been mutated
      expect(DEFAULT_SENTIMENT_CONFIG.threshold).toBe(originalConfig.threshold);
      expect(DEFAULT_SENTIMENT_CONFIG.enableJapaneseProcessing).toBe(
        originalConfig.enableJapaneseProcessing
      );
    });
  });
});
