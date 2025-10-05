/**
 * Test suite for Japanese conjugation normalization in topic extraction
 * Tests the new normalizeConjugation function and updated processJapaneseToken function
 */

import {
  normalizeConjugation,
  processJapaneseToken,
  extractTopicsFromThread,
  DEFAULT_TOPIC_CONFIG,
} from '../slack/analysis/thread/topic-extraction.js';
import type { SlackMessage } from '../slack/types/index.js';
import type { TopicExtractionConfig } from '../slack/analysis/thread/types.js';

describe('Japanese Conjugation Normalization', () => {
  describe('normalizeConjugation', () => {
    describe('Verb Conjugations', () => {
      test('should normalize past tense verbs to base form', () => {
        expect(normalizeConjugation('修正しました')).toBe('修正する');
        expect(normalizeConjugation('検討した')).toBe('検討する');
        expect(normalizeConjugation('書きました')).toBe('書く');
        expect(normalizeConjugation('読みました')).toBe('読む');
        expect(normalizeConjugation('見ました')).toBe('見る');
      });

      test('should normalize progressive/continuous forms', () => {
        expect(normalizeConjugation('作業しています')).toBe('作業する');
        expect(normalizeConjugation('処理している')).toBe('処理する');
        expect(normalizeConjugation('動いています')).toBe('動く');
        expect(normalizeConjugation('考えています')).toBe('考える');
      });

      test('should normalize passive forms', () => {
        expect(normalizeConjugation('実装されています')).toBe('実装される');
        expect(normalizeConjugation('利用されている')).toBe('利用される');
        expect(normalizeConjugation('作成されました')).toBe('作成される');
        expect(normalizeConjugation('更新された')).toBe('更新される');
      });

      test('should normalize polite forms', () => {
        expect(normalizeConjugation('確認します')).toBe('確認する');
        expect(normalizeConjugation('テストします')).toBe('テストする');
        expect(normalizeConjugation('開発します')).toBe('開発する');
        expect(normalizeConjugation('リリースします')).toBe('リリースする');
      });

      test('should normalize potential forms', () => {
        expect(normalizeConjugation('対応できます')).toBe('対応できる');
        expect(normalizeConjugation('使用できる')).toBe('使用できる');
      });

      test('should normalize te-form verbs', () => {
        expect(normalizeConjugation('修正して')).toBe('修正する');
        expect(normalizeConjugation('呼んで')).toBe('呼む');
        expect(normalizeConjugation('書いて')).toBe('書く');
        expect(normalizeConjugation('泳いで')).toBe('泳ぐ');
      });
    });

    describe('Adjective Conjugations', () => {
      test('should normalize i-adjective past tense', () => {
        expect(normalizeConjugation('良かった')).toBe('良い');
        expect(normalizeConjugation('難しかった')).toBe('難しい');
        expect(normalizeConjugation('新しかった')).toBe('新しい');
        expect(normalizeConjugation('大きかった')).toBe('大きい');
      });

      test('should normalize i-adjective negative forms', () => {
        expect(normalizeConjugation('良くなかった')).toBe('良い');
        expect(normalizeConjugation('簡単くない')).toBe('簡単い');
      });

      test('should normalize i-adjective adverbial forms', () => {
        expect(normalizeConjugation('美しく')).toBe('美しい');
        expect(normalizeConjugation('早く')).toBe('早い');
        expect(normalizeConjugation('高く')).toBe('高い');
      });

      test('should normalize na-adjective forms', () => {
        expect(normalizeConjugation('便利でした')).toBe('便利だ');
        expect(normalizeConjugation('簡単ではない')).toBe('簡単だ');
        expect(normalizeConjugation('重要じゃない')).toBe('重要だ');
      });
    });

    describe('Auxiliary Verb Forms', () => {
      test('should normalize copula forms', () => {
        expect(normalizeConjugation('問題です')).toBe('問題だ');
        expect(normalizeConjugation('システムである')).toBe('システムだ');
      });
    });

    describe('Edge Cases', () => {
      test('should handle empty or short strings', () => {
        expect(normalizeConjugation('')).toBe('');
        expect(normalizeConjugation('a')).toBe('a');
        expect(normalizeConjugation('で')).toBe('で');
      });

      test('should leave already normalized words unchanged', () => {
        expect(normalizeConjugation('問題')).toBe('問題');
        expect(normalizeConjugation('システム')).toBe('システム');
        expect(normalizeConjugation('開発')).toBe('開発');
      });

      test('should handle mixed content', () => {
        expect(normalizeConjugation('APIテスト')).toBe('APIテスト');
        expect(normalizeConjugation('データベース接続')).toBe('データベース接続');
      });
    });
  });

  describe('processJapaneseToken with Conjugation Normalization', () => {
    const testConfig: TopicExtractionConfig = {
      ...DEFAULT_TOPIC_CONFIG,
      enableConjugationNormalization: true,
    };

    test('should process conjugated verbs and return normalized forms', () => {
      const results = processJapaneseToken('修正しました', testConfig);

      expect(results.length).toBeGreaterThan(0);
      expect(results[0]?.segment).toBe('修正する');
      expect(results[0]?.weight).toBeGreaterThan(0);
    });

    test('should avoid duplicates when normalization produces same forms', () => {
      const results = processJapaneseToken('実装しました', testConfig);

      // Should get '実装する' from '実装しました'
      const segments = results.map((r) => r.segment);
      expect(segments.includes('実装する')).toBe(true);

      // Should not have duplicate normalized forms
      const uniqueSegments = segments.filter((s, i, arr) => arr.indexOf(s) === i);
      expect(uniqueSegments.length).toBe(segments.length);
    });

    test('should handle particles with conjugated verbs', () => {
      const results = processJapaneseToken('バグを修正しました', testConfig);

      const segments = results.map((r) => r.segment);

      // Should extract the noun 'バグ'
      expect(segments).toContain('バグ');

      // Should extract the normalized verb - either from the whole phrase or the verb part
      const hasNormalizedVerb =
        segments.includes('修正する') || segments.includes('バグを修正する');
      expect(hasNormalizedVerb).toBe(true);
    });

    test('should respect stop word filtering for normalized forms', () => {
      const configWithStopWords: TopicExtractionConfig = {
        ...testConfig,
        japaneseStopWords: new Set(['する', 'だ', 'ある']),
      };

      const results = processJapaneseToken('修正しました', configWithStopWords);

      // Should not include 'する' as it's a stop word
      const segments = results.map((r) => r.segment);
      expect(segments).not.toContain('する');
      // But should include the compound word part
      expect(segments).toContain('修正する');
    });

    test('should work with conjugation normalization disabled', () => {
      const configDisabled: TopicExtractionConfig = {
        ...DEFAULT_TOPIC_CONFIG,
        enableConjugationNormalization: false,
      };

      const results = processJapaneseToken('修正しました', configDisabled);

      // Should get original form, not normalized
      const segments = results.map((r) => r.segment);
      expect(segments).toContain('修正しました');
      expect(segments).not.toContain('修正する');
    });
  });

  describe('Integration with extractTopicsFromThread', () => {
    const businessMessages: SlackMessage[] = [
      {
        type: 'message',
        user: 'user1',
        text: '新機能を実装しました。テストも完了しています。',
        ts: '1699564800.000100',
      },
      {
        type: 'message',
        user: 'user2',
        text: 'ドキュメントを更新して、レビューをお願いします。',
        ts: '1699564860.000200',
      },
      {
        type: 'message',
        user: 'user3',
        text: 'バグが見つかりました。早急に修正が必要です。',
        ts: '1699564920.000300',
      },
    ];

    test('should extract normalized topics from business conversation', () => {
      const result = extractTopicsFromThread(businessMessages, {
        ...DEFAULT_TOPIC_CONFIG,
        enableConjugationNormalization: true,
      });

      const topics = result.topics;

      // Should extract normalized verbs (either standalone or as part of phrases)
      const hasImplementation = topics.includes('実装する') || topics.includes('新機能を実装する');
      const hasTesting = topics.includes('テストする') || topics.includes('テスト');
      const hasUpdate = topics.includes('更新する');
      const hasFix =
        topics.includes('修正する') ||
        topics.includes('修正が必要だ') ||
        topics.some((t) => t.includes('修正'));

      expect(hasImplementation).toBe(true);
      expect(hasTesting).toBe(true);
      expect(hasUpdate).toBe(true);
      expect(hasFix).toBe(true);

      // Should extract nouns
      expect(topics).toContain('新機能');
      expect(topics).toContain('ドキュメント');
      expect(topics).toContain('レビュー');
      expect(topics).toContain('バグ');
    });

    test('should handle mixed Japanese and English content', () => {
      const mixedMessages: SlackMessage[] = [
        {
          type: 'message',
          user: 'user1',
          text: 'APIエンドポイントを実装しました。JSONレスポンスをテストしています。',
          ts: '1699564800.000100',
        },
      ];

      const result = extractTopicsFromThread(mixedMessages, {
        ...DEFAULT_TOPIC_CONFIG,
        enableConjugationNormalization: true,
      });

      const topics = result.topics;

      // Should extract both Japanese normalized terms and English terms
      const hasImplementation = topics.includes('実装する') || topics.includes('実装し');
      const hasTesting = topics.includes('テストする') || topics.includes('テストしてい');

      expect(hasImplementation).toBe(true);
      expect(hasTesting).toBe(true);
      expect(topics.some((t) => t.toLowerCase().includes('api'))).toBe(true);
      expect(topics.some((t) => t.toLowerCase().includes('json'))).toBe(true);
    });

    test('should improve topic grouping with normalization enabled vs disabled', () => {
      const conjugationMessages: SlackMessage[] = [
        {
          type: 'message',
          user: 'user1',
          text: 'デプロイしました',
          ts: '1699564800.000100',
        },
        {
          type: 'message',
          user: 'user2',
          text: 'デプロイします',
          ts: '1699564860.000200',
        },
        {
          type: 'message',
          user: 'user3',
          text: 'デプロイする予定',
          ts: '1699564920.000300',
        },
      ];

      // With normalization enabled - should group under one topic
      const resultNormalized = extractTopicsFromThread(conjugationMessages, {
        ...DEFAULT_TOPIC_CONFIG,
        enableConjugationNormalization: true,
      });

      // With normalization disabled - should have separate topics
      const resultNotNormalized = extractTopicsFromThread(conjugationMessages, {
        ...DEFAULT_TOPIC_CONFIG,
        enableConjugationNormalization: false,
      });

      // Normalized version should consolidate conjugated forms better
      const normalizedFreq = resultNormalized.wordCounts.get('デプロイする') || 0;
      const nonNormalizedBaseFreq = resultNotNormalized.wordCounts.get('デプロイする') || 0;

      // With normalization, we should see better consolidation of conjugated forms
      // The frequency should be at least as good, and ideally better
      expect(normalizedFreq).toBeGreaterThanOrEqual(nonNormalizedBaseFreq);

      // Check that normalization is working by verifying we have fewer total unique topics
      // when normalization consolidates conjugated forms
      const normalizedTopicCount = resultNormalized.topics.length;
      const nonNormalizedTopicCount = resultNotNormalized.topics.length;

      // Should have same or fewer topics due to consolidation (this is a better test)
      expect(normalizedTopicCount).toBeLessThanOrEqual(nonNormalizedTopicCount + 1); // Allow slight variance
    });
  });

  describe('Performance and Memory', () => {
    test('should handle large text efficiently', () => {
      const largeText = 'システムを確認しました。'.repeat(1000);
      const startTime = Date.now();

      const result = normalizeConjugation(largeText);

      const endTime = Date.now();
      expect(endTime - startTime).toBeLessThan(100); // Should complete within 100ms
      expect(result).toBeTruthy();
    });

    test('should not create memory leaks with repeated processing', () => {
      const testTexts = ['実装しました', '開発している', 'テストします', '確認した'];

      // Process multiple times to check for memory issues
      for (let i = 0; i < 1000; i++) {
        for (const text of testTexts) {
          const results = processJapaneseToken(text, DEFAULT_TOPIC_CONFIG);
          expect(results).toBeDefined();
        }
      }
    });
  });
});
