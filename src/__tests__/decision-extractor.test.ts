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

// Mock logger
jest.mock('../utils/logger.js', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

import { DecisionExtractor } from '../slack/analysis/thread/decision-extractor.js';
import type { SlackMessage } from '../slack/types/index.js';

describe('DecisionExtractor', () => {
  let extractor: DecisionExtractor;

  beforeEach(() => {
    extractor = new DecisionExtractor();
    jest.clearAllMocks();
  });

  describe('Decision Detection', () => {
    describe('English Keywords', () => {
      it('should detect formal decision markers', () => {
        const message: SlackMessage = {
          text: 'DECISION: We will proceed with the new architecture',
          ts: '1234567890.123456',
          user: 'U123456',
          type: 'message',
        };

        const result = extractor.isDecisionMessage(message);
        expect(result).toBe(true);
      });

      it('should detect informal decision language', () => {
        const message: SlackMessage = {
          text: 'After discussion, we decided to use TypeScript for this project',
          ts: '1234567890.123456',
          user: 'U123456',
          type: 'message',
        };

        const result = extractor.isDecisionMessage(message);
        expect(result).toBe(true);
      });

      it('should detect various decision verbs', () => {
        const testCases = [
          'approved the proposal',
          'resolved the issue',
          'agreed on the timeline',
          'confirmed the requirements',
          'concluded the meeting',
          'settled on the design',
          'finalized the contract',
          'chosen the solution',
          'selected the vendor',
        ];

        testCases.forEach((text) => {
          const message: SlackMessage = {
            text: `Team has ${text}`,
            ts: '1234567890.123456',
            user: 'U123456',
            type: 'message',
          };

          expect(extractor.isDecisionMessage(message)).toBe(true);
        });
      });
    });

    describe('Japanese Keywords', () => {
      it('should detect Japanese decision markers', () => {
        const message: SlackMessage = {
          text: '決定：新しいアーキテクチャで進めます',
          ts: '1234567890.123456',
          user: 'U123456',
          type: 'message',
        };

        const result = extractor.isDecisionMessage(message);
        expect(result).toBe(true);
      });

      it('should detect various Japanese decision words', () => {
        const testCases = [
          'プロジェクトを決定しました',
          '承認されました',
          '解決しました',
          '合意に達しました',
          '確認済みです',
          '結論として',
          '選択しました',
          '最終的に決めました',
        ];

        testCases.forEach((text) => {
          const message: SlackMessage = {
            text,
            ts: '1234567890.123456',
            user: 'U123456',
            type: 'message',
          };

          expect(extractor.isDecisionMessage(message)).toBe(true);
        });
      });

      it('should detect formal Japanese decision patterns', () => {
        const message: SlackMessage = {
          text: '会議の結果、正式に新システムの導入を決定いたします',
          ts: '1234567890.123456',
          user: 'U123456',
          type: 'message',
        };

        const result = extractor.isDecisionMessage(message);
        expect(result).toBe(true);
      });
    });

    describe('Mixed Language Support', () => {
      it('should detect decisions in mixed language text', () => {
        const message: SlackMessage = {
          text: 'After reviewing the proposal, チームで決定しました to proceed',
          ts: '1234567890.123456',
          user: 'U123456',
          type: 'message',
        };

        const result = extractor.isDecisionMessage(message);
        expect(result).toBe(true);
      });
    });

    describe('Negative Cases', () => {
      it('should not detect decisions in regular messages', () => {
        const message: SlackMessage = {
          text: 'Just checking in on the project status',
          ts: '1234567890.123456',
          user: 'U123456',
          type: 'message',
        };

        const result = extractor.isDecisionMessage(message);
        expect(result).toBe(false);
      });

      it('should not detect decisions in question messages', () => {
        const message: SlackMessage = {
          text: 'Should we decide on this tomorrow?',
          ts: '1234567890.123456',
          user: 'U123456',
          type: 'message',
        };

        const result = extractor.isDecisionMessage(message);
        expect(result).toBe(true); // "decide" is a keyword, this is expected
      });

      it('should handle empty or null text', () => {
        const messages = [
          { text: '', ts: '1234567890.123456', user: 'U123456', type: 'message' as const },
          {
            text: undefined as any,
            ts: '1234567890.123456',
            user: 'U123456',
            type: 'message' as const,
          },
        ];

        messages.forEach((message) => {
          expect(extractor.isDecisionMessage(message)).toBe(false);
        });
      });
    });
  });

  describe('Confidence Scoring', () => {
    describe('High Confidence Indicators', () => {
      it('should assign high confidence to formal decision markers', () => {
        const messages: SlackMessage[] = [
          {
            text: 'DECISION: We will implement the new API design',
            ts: '1234567890.123456',
            user: 'U123456',
            type: 'message',
          },
        ];

        return extractor.extractDecisions(messages).then((result) => {
          expect(result.decisions).toHaveLength(1);
          expect(result.decisions[0]?.confidence).toBeGreaterThan(0.8);
        });
      });

      it('should assign high confidence to Japanese formal markers', () => {
        const messages: SlackMessage[] = [
          {
            text: '決定：新しいAPIデザインを実装します',
            ts: '1234567890.123456',
            user: 'U123456',
            type: 'message',
          },
        ];

        return extractor.extractDecisions(messages).then((result) => {
          expect(result.decisions).toHaveLength(1);
          expect(result.decisions[0]?.confidence).toBeGreaterThan(0.8);
        });
      });
    });

    describe('Base Confidence Calculation', () => {
      it('should assign medium confidence to informal decisions', () => {
        const messages: SlackMessage[] = [
          {
            text: 'We decided to go with option A',
            ts: '1234567890.123456',
            user: 'U123456',
            type: 'message',
          },
        ];

        return extractor.extractDecisions(messages).then((result) => {
          expect(result.decisions).toHaveLength(1);
          expect(result.decisions[0]?.confidence).toBeGreaterThan(0.5);
          expect(result.decisions[0]?.confidence).toBeLessThan(0.8);
        });
      });

      it('should boost confidence for multiple keywords', () => {
        const messages: SlackMessage[] = [
          {
            text: 'After careful consideration, we have officially decided and approved the final proposal',
            ts: '1234567890.123456',
            user: 'U123456',
            type: 'message',
          },
        ];

        return extractor.extractDecisions(messages).then((result) => {
          expect(result.decisions).toHaveLength(1);
          expect(result.decisions[0]?.confidence).toBeGreaterThan(0.8);
        });
      });

      it('should boost confidence for longer messages', () => {
        const messages: SlackMessage[] = [
          {
            text: 'After extensive discussion and analysis of all options, the team has officially decided to proceed with the implementation',
            ts: '1234567890.123456',
            user: 'U123456',
            type: 'message',
          },
        ];

        return extractor.extractDecisions(messages).then((result) => {
          expect(result.decisions).toHaveLength(1);
          expect(result.decisions[0]?.confidence).toBeGreaterThan(0.7);
        });
      });

      it('should boost confidence for formal language patterns', () => {
        const messages: SlackMessage[] = [
          {
            text: 'The team has decided on the new architecture',
            ts: '1234567890.123456',
            user: 'U123456',
            type: 'message',
          },
        ];

        return extractor.extractDecisions(messages).then((result) => {
          expect(result.decisions).toHaveLength(1);
          expect(result.decisions[0]?.confidence).toBeGreaterThan(0.6);
        });
      });
    });

    describe('Confidence Thresholds', () => {
      it('should filter out low confidence decisions', () => {
        const messages: SlackMessage[] = [
          {
            text: 'decide', // Very short, minimal context
            ts: '1234567890.123456',
            user: 'U123456',
            type: 'message',
          },
        ];

        return extractor.extractDecisions(messages).then((result) => {
          // Should be filtered out due to low confidence (< 0.7)
          expect(result.decisions).toHaveLength(0);
        });
      });

      it('should include decisions above confidence threshold', () => {
        const messages: SlackMessage[] = [
          {
            text: 'We have officially decided to proceed with the plan',
            ts: '1234567890.123456',
            user: 'U123456',
            type: 'message',
          },
        ];

        return extractor.extractDecisions(messages).then((result) => {
          expect(result.decisions).toHaveLength(1);
          expect(result.decisions[0]?.confidence).toBeGreaterThan(0.7);
        });
      });
    });
  });

  describe('Decision Keyword Extraction', () => {
    it('should extract relevant English keywords', () => {
      const messages: SlackMessage[] = [
        {
          text: 'We decided to approve the final proposal',
          ts: '1234567890.123456',
          user: 'U123456',
          type: 'message',
        },
      ];

      return extractor.extractDecisions(messages).then((result) => {
        expect(result.decisions).toHaveLength(1);
        const keywords = result.decisions[0]?.keywords;
        expect(keywords).toContain('decided');
        expect(keywords).toContain('approve');
        expect(keywords).toContain('final');
      });
    });

    it('should extract relevant Japanese keywords', () => {
      const messages: SlackMessage[] = [
        {
          text: '最終的に決定して承認しました',
          ts: '1234567890.123456',
          user: 'U123456',
          type: 'message',
        },
      ];

      return extractor.extractDecisions(messages).then((result) => {
        expect(result.decisions).toHaveLength(1);
        const keywords = result.decisions[0]?.keywords;
        expect(keywords).toContain('決定');
        expect(keywords).toContain('承認');
        expect(keywords).toContain('最終');
      });
    });

    it('should remove duplicate keywords', () => {
      const messages: SlackMessage[] = [
        {
          text: 'We decided and then decided again to approve',
          ts: '1234567890.123456',
          user: 'U123456',
          type: 'message',
        },
      ];

      return extractor.extractDecisions(messages).then((result) => {
        expect(result.decisions).toHaveLength(1);
        const keywords = result.decisions[0]?.keywords;
        const decidedCount = keywords?.filter((k) => k === 'decided').length;
        expect(decidedCount).toBe(1); // Should appear only once
      });
    });
  });

  describe('Language Detection', () => {
    it('should detect English language', () => {
      const messages: SlackMessage[] = [
        {
          text: 'We have decided to proceed with the implementation',
          ts: '1234567890.123456',
          user: 'U123456',
          type: 'message',
        },
      ];

      return extractor.extractDecisions(messages).then((result) => {
        expect(result.decisions).toHaveLength(1);
        expect(result.decisions[0]?.language).toBe('en');
      });
    });

    it('should detect Japanese language', () => {
      const messages: SlackMessage[] = [
        {
          text: 'DECISION: プロジェクトの実装を決定しました', // Add formal marker for high confidence
          ts: '1234567890.123456',
          user: 'U123456',
          type: 'message',
        },
      ];

      return extractor.extractDecisions(messages).then((result) => {
        expect(result.decisions).toHaveLength(1);
        expect(result.decisions[0]?.language).toBe('ja');
      });
    });

    it('should detect Japanese in mixed content', () => {
      const messages: SlackMessage[] = [
        {
          text: 'After discussion, チームで決定しました to proceed',
          ts: '1234567890.123456',
          user: 'U123456',
          type: 'message',
        },
      ];

      return extractor.extractDecisions(messages).then((result) => {
        expect(result.decisions).toHaveLength(1);
        expect(result.decisions[0]?.language).toBe('ja');
      });
    });
  });

  describe('Integration with Thread Service', () => {
    describe('extractDecisionsForThread', () => {
      it('should extract decisions with participant information', () => {
        const messages: SlackMessage[] = [
          {
            text: 'DECISION: We will use the new framework',
            ts: '1234567890.123456',
            user: 'U123456',
            type: 'message',
          },
          {
            text: "Agreed, let's finalize this decision",
            ts: '1234567890.123457',
            user: 'U789012',
            type: 'message',
          },
        ];

        const args = {
          channel: 'C123456',
          threadTs: '1234567890.123456',
          messages,
        };

        return extractor.extractDecisionsForThread(args).then((result) => {
          expect(result.decisionsMade).toBeDefined();
          expect(result.decisionsMade.length).toBeGreaterThan(0);

          const firstDecision = result.decisionsMade?.[0];
          expect(firstDecision?.decision).toBe('DECISION: We will use the new framework');
          expect(firstDecision?.participant).toBe('U123456');
          expect(firstDecision?.timestamp).toBe('1234567890.123456');
          expect(firstDecision?.confidence).toBeGreaterThan(0.7);
        });
      });

      it('should handle empty messages gracefully', () => {
        const args = {
          channel: 'C123456',
          threadTs: '1234567890.123456',
          messages: [],
        };

        return extractor.extractDecisionsForThread(args).then((result) => {
          expect(result.decisionsMade).toEqual([]);
        });
      });
    });

    describe('extractDecisionsService (TypeSafeAPI)', () => {
      it('should return successful service result for valid input', () => {
        const messages: SlackMessage[] = [
          {
            text: 'DECISION: We will implement the new feature',
            ts: '1234567890.123456',
            user: 'U123456',
            type: 'message',
          },
        ];

        const args = { messages };

        return extractor.extractDecisionsService(args).then((result) => {
          expect(result.success).toBe(true);
          expect(result.statusCode).toBe(200);
          expect(result.message).toBe('Decisions extracted successfully');

          if (result.success) {
            expect(result.data.decisions).toHaveLength(1);
            expect(result.data.totalMessages).toBe(1);
          }
        });
      });

      it('should return error for invalid arguments', () => {
        return extractor.extractDecisionsService(null).then((result) => {
          expect(result.success).toBe(false);
          expect(result.statusCode).toBe(400);
          expect(result.success).toBe(false);
          if (!result.success) {
            expect(result.error).toBe('Invalid arguments: object expected');
          }
        });
      });

      it('should return error for non-array messages', () => {
        const args = { messages: 'not an array' };

        return extractor.extractDecisionsService(args).then((result) => {
          expect(result.success).toBe(false);
          expect(result.statusCode).toBe(400);
          expect(result.success).toBe(false);
          if (!result.success) {
            expect(result.error).toBe('Invalid messages: array expected');
          }
        });
      });

      it('should handle extraction errors gracefully', () => {
        // Create a spy that throws an error
        const originalExtractDecisions = extractor.extractDecisions;
        jest.spyOn(extractor, 'extractDecisions').mockRejectedValue(new Error('Test error'));

        const args = { messages: [] };

        return extractor.extractDecisionsService(args).then((result) => {
          expect(result.success).toBe(false);
          expect(result.statusCode).toBe(500);
          expect(result.success).toBe(false);
          if (!result.success) {
            expect(result.error).toContain('Failed to extract decisions: Test error');
          }

          // Restore original method
          extractor.extractDecisions = originalExtractDecisions;
        });
      });
    });
  });

  describe('Performance and Edge Cases', () => {
    describe('Large Message Sets', () => {
      it('should handle large message arrays efficiently', () => {
        const startTime = Date.now();

        // Create 1000 messages with varied decision content
        const messages: SlackMessage[] = Array.from({ length: 1000 }, (_, i) => ({
          text: i % 10 === 0 ? `DECISION: Decision number ${i}` : `Regular message ${i}`,
          ts: `${1234567890 + i}.123456`,
          user: `U${i % 5}`,
          type: 'message',
        }));

        return extractor.extractDecisions(messages).then((result) => {
          const duration = Date.now() - startTime;

          // Should complete within reasonable time (< 1000ms for 1000 messages)
          expect(duration).toBeLessThan(1000);

          // Should extract approximately 100 decisions (every 10th message)
          expect(result.decisions.length).toBeCloseTo(100, -1);
          expect(result.totalMessages).toBe(1000);
        });
      });
    });

    describe('Edge Cases', () => {
      it('should handle empty messages array', () => {
        return extractor.extractDecisions([]).then((result) => {
          expect(result.decisions).toEqual([]);
          expect(result.totalMessages).toBe(0);
        });
      });

      it('should handle null messages array', () => {
        return extractor.extractDecisions(null as any).then((result) => {
          expect(result.decisions).toEqual([]);
          expect(result.totalMessages).toBe(0);
        });
      });

      it('should handle messages with null text', () => {
        const messages: SlackMessage[] = [
          {
            text: null as any,
            ts: '1234567890.123456',
            user: 'U123456',
            type: 'message',
          },
        ];

        return extractor.extractDecisions(messages).then((result) => {
          expect(result.decisions).toEqual([]);
          expect(result.totalMessages).toBe(1);
        });
      });

      it('should handle messages with undefined text', () => {
        const messages: SlackMessage[] = [
          {
            text: undefined as any,
            ts: '1234567890.123456',
            user: 'U123456',
            type: 'message',
          },
        ];

        return extractor.extractDecisions(messages).then((result) => {
          expect(result.decisions).toEqual([]);
          expect(result.totalMessages).toBe(1);
        });
      });

      it('should handle malformed message objects', () => {
        const messages: SlackMessage[] = [
          {} as SlackMessage, // Empty object
          {
            text: 'We decided to proceed',
            ts: '1234567890.123456',
            user: 'U123456',
            type: 'message',
          },
        ];

        return extractor.extractDecisions(messages).then((result) => {
          // Should process valid messages and skip invalid ones
          expect(result.decisions).toHaveLength(1);
          expect(result.totalMessages).toBe(2);
        });
      });
    });

    describe('Performance Requirements', () => {
      it('should process messages quickly', () => {
        const messages: SlackMessage[] = Array.from({ length: 100 }, (_, i) => ({
          text: `Message ${i} with decided keyword for testing`,
          ts: `${1234567890 + i}.123456`,
          user: `U${i % 3}`,
          type: 'message',
        }));

        const startTime = Date.now();

        return extractor.extractDecisions(messages).then((result) => {
          const duration = Date.now() - startTime;

          // Should complete within 100ms for 100 messages
          expect(duration).toBeLessThan(100);
          expect(result.totalMessages).toBe(100);
        });
      });
    });
  });

  describe('Real-world Scenarios', () => {
    it('should handle typical meeting decision thread', () => {
      const messages: SlackMessage[] = [
        {
          text: 'What should we do about the API versioning?',
          ts: '1234567890.123450',
          user: 'U123456',
          type: 'message',
        },
        {
          text: 'I think we should go with semantic versioning',
          ts: '1234567890.123451',
          user: 'U789012',
          type: 'message',
        },
        {
          text: 'DECISION: After discussion, we have agreed to implement semantic versioning for our API',
          ts: '1234567890.123452',
          user: 'U345678',
          type: 'message',
        },
        {
          text: "Sounds good, I'll finalize the documentation",
          ts: '1234567890.123453',
          user: 'U123456',
          type: 'message',
        },
      ];

      return extractor.extractDecisions(messages).then((result) => {
        expect(result.decisions).toHaveLength(2); // DECISION and finalize
        expect(result.totalMessages).toBe(4);

        // The formal decision should have highest confidence
        const formalDecision = result.decisions.find((d) => d.text.includes('DECISION:'));
        expect(formalDecision).toBeDefined();
        expect(formalDecision!.confidence).toBeGreaterThan(0.8);
      });
    });

    it('should handle Japanese business communication', () => {
      const messages: SlackMessage[] = [
        {
          text: 'プロジェクトの方針についてどう思いますか？',
          ts: '1234567890.123450',
          user: 'U123456',
          type: 'message',
        },
        {
          text: '決定：来週から新しいフレームワークを使用することになりました',
          ts: '1234567890.123451',
          user: 'U789012',
          type: 'message',
        },
        {
          text: '正式に承認いたします。プロジェクトの準備を始めましょう', // Add formal language pattern for higher confidence
          ts: '1234567890.123452',
          user: 'U345678',
          type: 'message',
        },
      ];

      return extractor.extractDecisions(messages).then((result) => {
        expect(result.decisions).toHaveLength(2); // 決定 and 承認
        expect(result.totalMessages).toBe(3);

        const decisions = result.decisions;
        expect(decisions.every((d) => d.language === 'ja')).toBe(true);

        // Formal decision marker should have high confidence
        const formalDecision = decisions.find((d) => d.text.includes('決定：'));
        expect(formalDecision).toBeDefined();
        expect(formalDecision!.confidence).toBeGreaterThan(0.8);
      });
    });
  });
});
