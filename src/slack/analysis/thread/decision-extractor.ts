/**
 * DecisionExtractor - Extract decisions from thread messages
 * 
 * This class implements sophisticated decision detection using:
 * - Keyword-based decision pattern matching
 * - Multi-language support (English and Japanese)
 * - Confidence scoring based on context
 * - Integration with thread analysis services
 */

import type { SlackMessage } from '../../types/index.js';
import type { DecisionExtractionResult } from '../../types/index.js';
import type { ServiceResult } from '../../types/typesafe-api-patterns.js';

/**
 * Decision keywords for English
 */
const ENGLISH_DECISION_KEYWORDS = [
  'decided', 'decide', 'decision',
  'approved', 'approve', 'approval',
  'resolved', 'resolve', 'resolution',
  'agreed', 'agree', 'agreement',
  'confirmed', 'confirm', 'confirmation',
  'concluded', 'conclude', 'conclusion',
  'settled', 'settle', 'settlement',
  'finalized', 'finalize', 'final',
  'chosen', 'choose', 'choice',
  'selected', 'select', 'selection',
] as const;

/**
 * Decision keywords for Japanese
 */
const JAPANESE_DECISION_KEYWORDS = [
  '決定', '決めた', '決める',
  '承認', '許可', '認める',
  '解決', '解決した',
  '合意', '同意', '賛成',
  '確認', '確定',
  '結論', '結果',
  '選択', '選んだ',
  '最終', '最終的',
] as const;

/**
 * High confidence indicators
 */
const HIGH_CONFIDENCE_INDICATORS = [
  'DECISION:', 'DECISION -',
  '決定：', '結論：',
  'officially', 'formally',
  '正式に', '公式に',
] as const;

/**
 * DecisionExtractor class for extracting decisions from messages
 */
export class DecisionExtractor {
  
  /**
   * Extract decisions from an array of messages
   */
  async extractDecisions(messages: SlackMessage[]): Promise<DecisionExtractionResult> {
    if (!messages || messages.length === 0) {
      return {
        decisions: [],
        totalMessages: 0,
      };
    }

    const decisions: DecisionExtractionResult['decisions'] = [];

    messages.forEach((message, index) => {
      if (!message || !message.text) return;

      const _text = message.text.toLowerCase();
      const originalText = message.text;
      
      // Check if this message contains decision indicators
      if (this.isDecisionMessage(message)) {
        const confidence = this.calculateDecisionConfidence(originalText);
        
        // Only include decisions with sufficient confidence (filter out low confidence)
        if (confidence > 0.7) {
          const keywords = this.extractDecisionKeywords(originalText);
          const language = this.detectLanguage(originalText);

          decisions.push({
            text: originalText,
            confidence,
            keywords,
            messageIndex: index,
            timestamp: message.ts,
            language,
          });
        }
      }
    });

    return {
      decisions,
      totalMessages: messages.length,
    };
  }

  /**
   * Check if a message contains decision indicators
   */
  isDecisionMessage(message: SlackMessage): boolean {
    if (!message.text) return false;

    const text = message.text.toLowerCase();

    // Check English keywords
    for (const keyword of ENGLISH_DECISION_KEYWORDS) {
      if (text.includes(keyword.toLowerCase())) {
        return true;
      }
    }

    // Check Japanese keywords
    for (const keyword of JAPANESE_DECISION_KEYWORDS) {
      if (text.includes(keyword)) {
        return true;
      }
    }

    return false;
  }

  /**
   * Calculate confidence score for a decision
   */
  private calculateDecisionConfidence(text: string): number {
    let confidence = 0.4; // Base confidence

    // High confidence indicators
    for (const indicator of HIGH_CONFIDENCE_INDICATORS) {
      if (text.toLowerCase().includes(indicator.toLowerCase())) {
        confidence += 0.4;
        break;
      }
    }

    // Multiple decision keywords increase confidence
    let keywordCount = 0;
    
    // Count English keywords
    for (const keyword of ENGLISH_DECISION_KEYWORDS) {
      if (text.toLowerCase().includes(keyword.toLowerCase())) {
        keywordCount++;
      }
    }

    // Count Japanese keywords
    for (const keyword of JAPANESE_DECISION_KEYWORDS) {
      if (text.includes(keyword)) {
        keywordCount++;
      }
    }

    // Add confidence for keywords (boost for any keyword found)
    if (keywordCount > 0) {
      confidence += Math.min(0.3, keywordCount * 0.15);
    }

    // Length and structure boost
    if (text.length > 20) { // Reduced threshold for Japanese
      confidence += 0.1;
    }

    // Formal language patterns (English and Japanese)
    if (text.includes('we have') || text.includes('it has been') || text.includes('team has') ||
        text.includes('しました') || text.includes('ます') || text.includes('決定')) {
      confidence += 0.1;
    }

    return Math.min(1.0, confidence);
  }

  /**
   * Extract decision keywords from text
   */
  private extractDecisionKeywords(text: string): string[] {
    const keywords: string[] = [];
    const lowerText = text.toLowerCase();

    // Find English keywords
    for (const keyword of ENGLISH_DECISION_KEYWORDS) {
      if (lowerText.includes(keyword.toLowerCase())) {
        keywords.push(keyword);
      }
    }

    // Find Japanese keywords
    for (const keyword of JAPANESE_DECISION_KEYWORDS) {
      if (text.includes(keyword)) {
        keywords.push(keyword);
      }
    }

    return [...new Set(keywords)]; // Remove duplicates
  }

  /**
   * Detect language of the text
   */
  private detectLanguage(text: string): 'en' | 'ja' {
    // Simple heuristic: if contains Japanese characters, classify as Japanese
    const hasJapanese = /[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]/.test(text);
    return hasJapanese ? 'ja' : 'en';
  }

  /**
   * Extract decisions for a specific thread
   */
  async extractDecisionsForThread(args: {
    channel: string;
    threadTs: string;
    messages: SlackMessage[];
  }): Promise<{ decisionsMade: Array<{ decision: string; confidence: number; participant?: string; timestamp: string }> }> {
    const decisions = await this.extractDecisions(args.messages);

    const decisionsMade = decisions.decisions.map(decision => ({
      decision: decision.text,
      confidence: decision.confidence,
      participant: args.messages[decision.messageIndex]?.user,
      timestamp: decision.timestamp,
    }));

    return { decisionsMade };
  }

  /**
   * TypeSafeAPI service wrapper for decision extraction
   */
  async extractDecisionsService(args: unknown): Promise<ServiceResult<DecisionExtractionResult> & { statusCode: number }> {
    try {
      // Basic validation
      if (!args || typeof args !== 'object') {
        return {
          success: false,
          error: 'Invalid arguments: object expected',
          message: 'Invalid request parameters',
          statusCode: 400,
        };
      }

      const { messages } = args as { messages: unknown };

      if (!Array.isArray(messages)) {
        return {
          success: false,
          error: 'Invalid messages: array expected',
          message: 'Invalid request parameters',
          statusCode: 400,
        };
      }

      // Extract decisions
      const result = await this.extractDecisions(messages as SlackMessage[]);

      return {
        success: true,
        data: result,
        message: 'Decisions extracted successfully',
        statusCode: 200,
      };
    } catch (error) {
      return {
        success: false,
        error: `Failed to extract decisions: ${error instanceof Error ? error.message : 'Unknown error'}`,
        message: 'Decision extraction failed',
        statusCode: 500,
      };
    }
  }
}