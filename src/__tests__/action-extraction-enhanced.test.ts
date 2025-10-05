/**
 * Test suite for enhanced Japanese action item extraction features
 * Tests bullet point detection, Japanese request patterns, conjugation normalization, and line scoring
 */

import {
  detectBulletPoint,
  detectJapaneseRequests,
  scoreActionLine,
  normalizeActionText,
  containsActionIndicators,
  findActionIndicators,
  extractActionItemsFromMessage,
  extractActionItemsFromMessages,
  DEFAULT_ACTION_ITEM_CONFIG,
  DEFAULT_BULLET_POINT_CONFIG,
  ENHANCED_ACTION_INDICATORS,
} from '../slack/analysis/thread/action-extraction.js';

import type { SlackMessage } from '../slack/types/index.js';
import type { ActionItemConfig } from '../slack/analysis/thread/types.js';

describe('Enhanced Japanese Action Extraction', () => {
  describe('Bullet Point Detection', () => {
    const config = DEFAULT_BULLET_POINT_CONFIG;

    test('should detect Japanese bullet points', () => {
      const testCases = [
        '・タスクを完了する',
        '● 重要な会議に参加',
        '○ レビューを実施',
        '■ ドキュメント更新',
        '□ テスト実行',
        '‐ 修正作業',
        '－ システム確認',
      ];

      for (const line of testCases) {
        const result = detectBulletPoint(line, config);
        expect(result.hasBulletPoint).toBe(true);
        expect(result.bulletType).toMatch(/^japanese:/);
        expect(result.weight).toBe(config.bulletPointWeight);
      }
    });

    test('should detect Western bullet points', () => {
      const testCases = [
        '- Complete the task',
        '* Important meeting',
        '+ Review code',
        '> Update documentation',
      ];

      for (const line of testCases) {
        const result = detectBulletPoint(line, config);
        expect(result.hasBulletPoint).toBe(true);
        expect(result.bulletType).toMatch(/^western:/);
        expect(result.weight).toBe(config.bulletPointWeight);
      }
    });

    test('should detect numbered patterns', () => {
      const testCases = [
        '1. First task',
        '2) Second task',
        '① 最初のタスク',
        '② 二番目のタスク',
        '③ 三番目のタスク',
      ];

      for (const line of testCases) {
        const result = detectBulletPoint(line, config);
        expect(result.hasBulletPoint).toBe(true);
        expect(result.bulletType).toBe('numbered');
        expect(result.weight).toBe(config.bulletPointWeight);
      }
    });

    test('should not detect bullet points in regular text', () => {
      const testCases = [
        'Regular text without bullets',
        'Text with - dash inside',
        'Text with ・ inside the sentence',
        'Numbers like 1 and 2 in text',
      ];

      for (const line of testCases) {
        const result = detectBulletPoint(line, config);
        expect(result.hasBulletPoint).toBe(false);
        expect(result.weight).toBe(0);
      }
    });
  });

  describe('Japanese Request Pattern Detection', () => {
    test('should detect polite request patterns', () => {
      const testCases = [
        'タスクをお願いします',
        '確認をお願いいたします',
        'レビューしていただけますか',
        '修正をしていただきたく思います',
        'テストをお願いできますか',
      ];

      for (const line of testCases) {
        const result = detectJapaneseRequests(line);
        expect(result.hasRequestPattern).toBe(true);
        expect(result.patterns.length).toBeGreaterThan(0);
        expect(result.weight).toBeGreaterThan(0);
      }
    });

    test('should detect specific action request patterns', () => {
      const testCases = [
        '対応お願いします',
        '確認ください',
        'レビューお願いします',
        'チェックお願いします',
        '修正お願いします',
        'テストお願いします',
        '実装お願いします',
        '更新お願いします',
        '削除お願いします',
        '追加お願いします',
        '作成お願いします',
      ];

      for (const line of testCases) {
        const result = detectJapaneseRequests(line);
        expect(result.hasRequestPattern).toBe(true);
        expect(result.weight).toBe(1.8); // Higher weight for specific actions
      }
    });

    test('should detect task assignment patterns', () => {
      const testCases = ['このタスクを担当してください', 'バグ修正の件でお願いします'];

      for (const line of testCases) {
        const result = detectJapaneseRequests(line);
        expect(result.hasRequestPattern).toBe(true);
        expect(result.weight).toBe(1.8);
      }
    });

    test('should not detect request patterns in regular text', () => {
      const testCases = [
        'Regular English text',
        '普通の日本語テキスト',
        'お疲れ様です',
        'ありがとうございます',
      ];

      for (const line of testCases) {
        const result = detectJapaneseRequests(line);
        expect(result.hasRequestPattern).toBe(false);
        expect(result.weight).toBe(0);
      }
    });
  });

  describe('Line Scoring', () => {
    const config = DEFAULT_ACTION_ITEM_CONFIG;

    test('should score bullet points highly', () => {
      const line = '・タスクを完了お願いします';
      const result = scoreActionLine(line, config);

      expect(result.score).toBeGreaterThan(1.0);
      expect(result.bulletPointInfo.hasBulletPoint).toBe(true);
      expect(result.requestPatternInfo.hasRequestPattern).toBe(true);
    });

    test('should score mentions and urgency keywords', () => {
      const urgentLine = '<@U123456> urgent task needs immediate attention!';
      const result = scoreActionLine(urgentLine, config);

      expect(result.score).toBeGreaterThan(1.0);
      expect(result.hasMentions).toBe(true);
      expect(result.hasUrgencyKeywords).toBe(true);
      expect(result.urgencyKeywords.length).toBeGreaterThan(0);
    });

    test('should give higher scores to lines with multiple factors', () => {
      const highScoreLine = '・ <@U123456> 緊急対応お願いします！';
      const lowScoreLine = 'regular text without special patterns';

      const highResult = scoreActionLine(highScoreLine, config);
      const lowResult = scoreActionLine(lowScoreLine, config);

      expect(highResult.score).toBeGreaterThan(lowResult.score);
    });
  });

  describe('Conjugation Normalization Integration', () => {
    test('should normalize Japanese conjugated verbs in action text', () => {
      const config = DEFAULT_ACTION_ITEM_CONFIG;
      const testCases = [
        { input: '修正しました', expected: '修正する' },
        { input: 'テストしています', expected: 'テストする' },
        { input: '実装しました', expected: '実装する' },
        { input: '確認します', expected: '確認する' },
      ];

      for (const { input } of testCases) {
        const result = normalizeActionText(input, config);
        expect(result).toContain('する'); // Should be normalized to base form
      }
    });

    test('should preserve English text during normalization', () => {
      const config = DEFAULT_ACTION_ITEM_CONFIG;
      const input = 'Complete the task and update documentation';
      const result = normalizeActionText(input, config);
      expect(result).toBe(input); // Should remain unchanged
    });

    test('should handle mixed language content', () => {
      const config = DEFAULT_ACTION_ITEM_CONFIG;
      const input = 'Update the API 修正しました documentation';
      const result = normalizeActionText(input, config);
      expect(result).toContain('API');
      expect(result).toContain('documentation');
      expect(result).toContain('修正する'); // Japanese part should be normalized
    });
  });

  describe('Enhanced Action Indicator Matching', () => {
    test('should find conjugated Japanese action indicators', () => {
      const enableNormalization = true;
      const text = 'バグを修正しました。レビューしています。';
      const indicators = ['修正', 'レビュー']; // Use the base forms that are in ENHANCED_ACTION_INDICATORS

      const found = findActionIndicators(text, indicators, enableNormalization);
      expect(found.length).toBeGreaterThan(0);
    });

    test('should detect action indicators in business Japanese context', () => {
      const enableNormalization = true;
      const businessTexts = [
        'この件について対応お願いします',
        'レビューの確認をお願いいたします',
        'システムの修正を担当してください',
        'テストの実装をしていただけますか',
      ];

      for (const text of businessTexts) {
        const hasAction = containsActionIndicators(
          text,
          ENHANCED_ACTION_INDICATORS,
          enableNormalization
        );
        expect(hasAction).toBe(true);
      }
    });

    test('should handle English action indicators normally', () => {
      const enableNormalization = true;
      const text = 'TODO: fix the bug and update documentation';
      const hasAction = containsActionIndicators(
        text,
        ENHANCED_ACTION_INDICATORS,
        enableNormalization
      );
      expect(hasAction).toBe(true);
    });
  });

  describe('Full Message Processing', () => {
    test('should extract action items from business Japanese messages', () => {
      const message: SlackMessage = {
        type: 'message',
        user: 'user1',
        text: `会議の議事録です：
・ <@U123456> APIの修正をお願いします（緊急）
・ <@U789012> ドキュメント更新の件でお願いします
・ 来週までにテスト実装を完了してください`,
        ts: '1699564800.000100',
      };

      const config = DEFAULT_ACTION_ITEM_CONFIG;
      const actionItems = extractActionItemsFromMessage(message, config);

      expect(actionItems.length).toBeGreaterThan(0);

      // Check that mentions were extracted
      expect(actionItems.some((item) => item.mentioned_users.length > 0)).toBe(true);

      // Check that priority was detected (緊急 = urgent)
      expect(actionItems.some((item) => item.priority === 'high')).toBe(true);
    });

    test('should prioritize lines with bullet points when scoring is enabled', () => {
      const message: SlackMessage = {
        type: 'message',
        user: 'user1',
        text: `プロジェクトの進捗：
普通のテキストで作業について説明
・重要なタスクをお願いします
また普通のテキスト`,
        ts: '1699564800.000100',
      };

      const config = {
        ...DEFAULT_ACTION_ITEM_CONFIG,
        enableLineScoring: true,
      };
      const actionItems = extractActionItemsFromMessage(message, config);

      // Should extract the bullet point line as action item
      expect(actionItems.length).toBeGreaterThan(0);
      expect(actionItems[0]?.text).toContain('重要なタスク');
    });

    test('should extract action items from multiple messages', () => {
      const messages: SlackMessage[] = [
        {
          type: 'message',
          user: 'user1',
          text: '・バグ修正をお願いします',
          ts: '1699564800.000100',
        },
        {
          type: 'message',
          user: 'user2',
          text: 'TODO: Update the documentation',
          ts: '1699564860.000200',
        },
        {
          type: 'message',
          user: 'user3',
          text: '① テスト実装 ② レビュー実施',
          ts: '1699564920.000300',
        },
      ];

      const config = DEFAULT_ACTION_ITEM_CONFIG;
      const result = extractActionItemsFromMessages(messages, config);

      expect(result.actionItems.length).toBeGreaterThan(0);
      expect(result.totalActionIndicators).toBeGreaterThan(0);
      expect(result.actionIndicatorsFound.length).toBeGreaterThan(0);
    });
  });

  describe('Backward Compatibility', () => {
    test('should work with minimal configuration', () => {
      const minimalConfig: ActionItemConfig = {
        actionIndicators: ['todo', 'task'],
        priorityKeywords: {
          high: ['urgent'],
          medium: ['important'],
        },
        statusKeywords: {
          completed: ['done'],
          inProgress: ['working'],
        },
      };

      const message: SlackMessage = {
        type: 'message',
        user: 'user1',
        text: 'TODO: fix this urgent issue',
        ts: '1699564800.000100',
      };

      const actionItems = extractActionItemsFromMessage(message, minimalConfig);
      expect(actionItems.length).toBeGreaterThan(0);
      expect(actionItems[0]?.priority).toBe('high');
    });

    test('should work without enhanced features enabled', () => {
      const basicConfig: ActionItemConfig = {
        ...DEFAULT_ACTION_ITEM_CONFIG,
        enableLineScoring: false,
        enableConjugationNormalization: false,
      };

      const message: SlackMessage = {
        type: 'message',
        user: 'user1',
        text: '・修正しました TODO complete',
        ts: '1699564800.000100',
      };

      const actionItems = extractActionItemsFromMessage(message, basicConfig);
      expect(actionItems.length).toBeGreaterThan(0);
    });
  });
});
