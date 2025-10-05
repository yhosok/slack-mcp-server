/**
 * Pure sentiment analysis functions for thread messages
 * No side effects, fully testable and functional
 * Refactored to use shared text processing utilities
 */

import type { SlackMessage } from '../../types/index.js';
import type { SentimentScore, SentimentAnalysisResult, SentimentConfig } from './types.js';
import {
  detectLanguageContent,
  countWordsInText,
} from '../shared/text-processing/multilingual-processor.js';

/**
 * Default sentiment analysis configuration with Japanese support
 */
export const DEFAULT_SENTIMENT_CONFIG: SentimentConfig = {
  positiveWords: [
    'good',
    'great',
    'excellent',
    'awesome',
    'perfect',
    'love',
    'like',
    'happy',
    'yes',
    'agree',
    'amazing',
    'fantastic',
    'wonderful',
    'brilliant',
    'outstanding',
    'success',
    'achieved',
    'completed',
    'solved',
    'resolved',
  ] as const,
  negativeWords: [
    'bad',
    'terrible',
    'awful',
    'hate',
    'dislike',
    'angry',
    'no',
    'disagree',
    'problem',
    'issue',
    'error',
    'bug',
    'broken',
    'failed',
    'wrong',
    'difficult',
    'hard',
    'stuck',
    'blocked',
    'frustrated',
  ] as const,
  japanesePositiveWords: [
    '良い',
    '素晴らしい',
    '最高',
    '嬉しい',
    '助かる',
    'ありがとう',
    'いいね',
    '成功',
    '完璧',
    '満足',
    'すごい',
    'よかった',
    '感謝',
    '賛成',
    '同感',
    '解決',
    '改善',
    '効果的',
    'スムーズ',
    '順調',
  ] as const,
  japaneseNegativeWords: [
    '悪い',
    'ひどい',
    '困る',
    '問題',
    '面倒',
    '微妙',
    '大変',
    'ダメ',
    '失敗',
    '不満',
    'バグ',
    'エラー',
    '難しい',
    '厳しい',
    '心配',
    '不安',
    '残念',
    '遅れ',
    '課題',
    '改善必要',
    '改善',
    '必要',
    '修正',
    '直す',
    'トラブル',
    '解決',
  ] as const,
  negationPatterns: [
    'ない',
    'ません',
    'じゃない',
    'ではない',
    'なかった',
    'ませんでした',
    'じゃなかった',
    'ではなかった',
  ] as const,
  emphasisPatterns: new Map([
    ['めちゃ', 1.5],
    ['めちゃくちゃ', 1.5],
    ['すごく', 1.5],
    ['かなり', 1.3],
    ['とても', 1.2],
    ['非常に', 1.4],
    ['本当に', 1.3],
    ['絶対', 1.4],
    ['完全に', 1.4],
    ['超', 1.5],
  ]),
  mitigationPatterns: new Map([
    ['少し', 0.8],
    ['やや', 0.8],
    ['まあまあ', 0.9],
    ['それなり', 0.9],
    ['ちょっと', 0.8],
    ['多少', 0.8],
    ['若干', 0.8],
  ]),
  threshold: 1.2, // Ratio threshold for determining sentiment
  enableJapaneseProcessing: true,
} as const;

/**
 * Extract and combine text from messages for analysis
 * @param messages - Array of Slack messages
 * @returns Combined text string in lowercase
 */
export function extractTextFromMessages(messages: readonly SlackMessage[]): string {
  return messages
    .map((message) => message.text || '')
    .join(' ')
    .toLowerCase()
    .trim();
}

/**
 * Count occurrences of words in text
 * @param text - Text to analyze
 * @param words - Array of words to count
 * @returns Total count of all word occurrences
 */
export function countWordOccurrences(text: string, words: readonly string[]): number {
  let count = 0;

  for (const word of words) {
    const regex = new RegExp(`\\b${word.toLowerCase()}\\b`, 'g');
    const matches = text.match(regex);
    if (matches) {
      count += matches.length;
    }
  }

  return count;
}

/**
 * Count occurrences of Japanese words in text using substring matching
 * @param text - Text to analyze
 * @param words - Array of Japanese words to count
 * @returns Total count of all word occurrences
 */
export function countJapaneseWordOccurrences(text: string, words: readonly string[]): number {
  let count = 0;

  for (const word of words) {
    // Use simple substring matching for Japanese words
    let index = 0;
    while ((index = text.indexOf(word, index)) !== -1) {
      count++;
      index += word.length;
    }
  }

  return count;
}

/**
 * Detect negation patterns and calculate adjustments
 * @param text - Text to analyze
 * @param negationPatterns - Array of negation patterns
 * @param positiveCount - Current positive word count
 * @param negativeCount - Current negative word count
 * @returns Object with adjusted counts and negation count
 */
export function processNegationPatterns(
  text: string,
  negationPatterns: readonly string[],
  positiveCount: number,
  negativeCount: number
): {
  adjustedPositiveCount: number;
  adjustedNegativeCount: number;
  negationAdjustments: number;
} {
  let negationCount = 0;
  let adjustedPositiveCount = positiveCount;
  let adjustedNegativeCount = negativeCount;

  // Count total negation patterns in text
  for (const pattern of negationPatterns) {
    let index = 0;
    while ((index = text.indexOf(pattern, index)) !== -1) {
      negationCount++;
      index += pattern.length;
    }
  }

  // More aggressive negation handling: each negation pattern can flip sentiment
  // If there are more negation patterns than positive words, it becomes negative
  if (negationCount > 0) {
    // Strong negation effect: if negation patterns >= sentiment words, reverse the sentiment
    const totalSentimentWords = positiveCount + negativeCount;

    if (negationCount >= totalSentimentWords && totalSentimentWords > 0) {
      // Complete flip when negation dominates
      const temp = adjustedPositiveCount;
      adjustedPositiveCount = adjustedNegativeCount + negationCount;
      adjustedNegativeCount = temp;
    } else if (negationCount > 0 && positiveCount > 0) {
      // Partial negation: reduce positive sentiment
      const reductionFactor = Math.min(0.8, negationCount * 0.3);
      adjustedPositiveCount = Math.max(0, Math.floor(positiveCount * (1 - reductionFactor)));
      adjustedNegativeCount = negativeCount + Math.floor(negationCount * 0.5);
    }
  }

  return {
    adjustedPositiveCount,
    adjustedNegativeCount,
    negationAdjustments: negationCount,
  };
}

/**
 * Apply emphasis and mitigation patterns to sentiment scores
 * @param text - Text to analyze
 * @param emphasisPatterns - Map of emphasis patterns to multipliers
 * @param mitigationPatterns - Map of mitigation patterns to multipliers
 * @param positiveCount - Current positive count
 * @param negativeCount - Current negative count
 * @returns Object with adjusted counts and pattern counts
 */
export function processEmphasisMitigation(
  text: string,
  emphasisPatterns: ReadonlyMap<string, number>,
  mitigationPatterns: ReadonlyMap<string, number>,
  positiveCount: number,
  negativeCount: number
): {
  adjustedPositiveCount: number;
  adjustedNegativeCount: number;
  emphasisAdjustments: number;
  mitigationAdjustments: number;
} {
  let emphasisMultiplier = 1.0;
  let mitigationMultiplier = 1.0;
  let emphasisCount = 0;
  let mitigationCount = 0;

  // Check for emphasis patterns
  for (const [pattern, multiplier] of emphasisPatterns) {
    if (text.includes(pattern)) {
      emphasisMultiplier = Math.max(emphasisMultiplier, multiplier);
      emphasisCount++;
    }
  }

  // Check for mitigation patterns
  for (const [pattern, multiplier] of mitigationPatterns) {
    if (text.includes(pattern)) {
      mitigationMultiplier = Math.min(mitigationMultiplier, multiplier);
      mitigationCount++;
    }
  }

  // Apply combined multiplier (emphasis first, then mitigation)
  const finalMultiplier = emphasisMultiplier * mitigationMultiplier;

  const adjustedPositiveCount = Math.round(positiveCount * finalMultiplier);
  const adjustedNegativeCount = Math.round(negativeCount * finalMultiplier);

  return {
    adjustedPositiveCount,
    adjustedNegativeCount,
    emphasisAdjustments: emphasisCount,
    mitigationAdjustments: mitigationCount,
  };
}

// Note: countWordsInText is now imported from shared utilities
// Re-export for backward compatibility
export { countWordsInText } from '../shared/text-processing/multilingual-processor.js';

/**
 * Count total words in an array of Slack messages with multilingual support
 *
 * Aggregates word counts from all message texts using the same tokenization
 * logic as other analysis functions for consistency.
 *
 * @param messages - Array of Slack messages to count words in
 * @returns Total number of words across all messages
 */
export function countWordsInMessages(messages: readonly SlackMessage[]): number {
  if (!messages || messages.length === 0) {
    return 0;
  }

  // Use functional approach for better performance and immutability
  return messages
    .filter((message) => message.text)
    .reduce((totalWords, message) => totalWords + countWordsInText(message.text!), 0);
}

/**
 * Analyze sentiment of messages using keyword-based approach with Japanese support
 * @param messages - Array of messages to analyze
 * @param config - Configuration for sentiment analysis
 * @returns Detailed sentiment analysis result
 */
export function analyzeSentiment(
  messages: readonly SlackMessage[],
  config: SentimentConfig = DEFAULT_SENTIMENT_CONFIG
): SentimentAnalysisResult {
  const text = extractTextFromMessages(messages);

  if (!text) {
    return {
      sentiment: 'neutral',
      positiveCount: 0,
      negativeCount: 0,
      totalWords: 0,
      japanesePositiveCount: 0,
      japaneseNegativeCount: 0,
      negationAdjustments: 0,
      emphasisAdjustments: 0,
      mitigationAdjustments: 0,
      languageContent: {
        hasJapanese: false,
        hasEnglish: false,
        mixedLanguage: false,
        primaryLanguage: 'english',
      },
    };
  }

  // Detect language content
  const languageContent = detectLanguageContent(text);

  // Count English sentiment words
  let positiveCount = countWordOccurrences(text, config.positiveWords);
  let negativeCount = countWordOccurrences(text, config.negativeWords);

  // Count Japanese sentiment words if Japanese processing is enabled
  let japanesePositiveCount = 0;
  let japaneseNegativeCount = 0;

  if (config.enableJapaneseProcessing && languageContent.hasJapanese) {
    if (config.japanesePositiveWords) {
      japanesePositiveCount = countJapaneseWordOccurrences(text, config.japanesePositiveWords);
      positiveCount += japanesePositiveCount;
    }
    if (config.japaneseNegativeWords) {
      japaneseNegativeCount = countJapaneseWordOccurrences(text, config.japaneseNegativeWords);
      negativeCount += japaneseNegativeCount;
    }
  }

  // Process negation patterns
  let negationAdjustments = 0;
  if (config.enableJapaneseProcessing && config.negationPatterns && languageContent.hasJapanese) {
    const negationResult = processNegationPatterns(
      text,
      config.negationPatterns,
      positiveCount,
      negativeCount
    );
    positiveCount = negationResult.adjustedPositiveCount;
    negativeCount = negationResult.adjustedNegativeCount;
    negationAdjustments = negationResult.negationAdjustments;
  }

  // Process emphasis and mitigation patterns
  let emphasisAdjustments = 0;
  let mitigationAdjustments = 0;
  if (config.enableJapaneseProcessing && languageContent.hasJapanese) {
    if (config.emphasisPatterns && config.mitigationPatterns) {
      const emphasisResult = processEmphasisMitigation(
        text,
        config.emphasisPatterns,
        config.mitigationPatterns,
        positiveCount,
        negativeCount
      );
      positiveCount = emphasisResult.adjustedPositiveCount;
      negativeCount = emphasisResult.adjustedNegativeCount;
      emphasisAdjustments = emphasisResult.emphasisAdjustments;
      mitigationAdjustments = emphasisResult.mitigationAdjustments;
    }
  }

  // Calculate total words using shared multilingual word counting
  const totalWords = countWordsInText(text);

  let sentiment: SentimentScore = 'neutral';

  // Apply threshold-based sentiment determination
  if (positiveCount > negativeCount * config.threshold) {
    sentiment = 'positive';
  } else if (negativeCount > positiveCount * config.threshold) {
    sentiment = 'negative';
  }

  return {
    sentiment,
    positiveCount,
    negativeCount,
    totalWords,
    japanesePositiveCount,
    japaneseNegativeCount,
    negationAdjustments,
    emphasisAdjustments,
    mitigationAdjustments,
    languageContent,
  };
}

/**
 * Get sentiment score as a number between -1 and 1
 * @param result - Sentiment analysis result
 * @returns Numeric sentiment score (-1 = negative, 0 = neutral, 1 = positive)
 */
export function getSentimentScore(result: SentimentAnalysisResult): number {
  const { positiveCount, negativeCount, totalWords } = result;

  if (totalWords === 0) return 0;

  // Normalize by total words to get relative sentiment strength
  const positiveRatio = positiveCount / totalWords;
  const negativeRatio = negativeCount / totalWords;

  // Calculate net sentiment
  const netSentiment = positiveRatio - negativeRatio;

  // Clamp to [-1, 1] range
  return Math.max(-1, Math.min(1, netSentiment * 10));
}

/**
 * Check if sentiment analysis has sufficient data for reliable results
 * @param result - Sentiment analysis result
 * @returns True if analysis is based on sufficient data
 */
export function isSentimentReliable(result: SentimentAnalysisResult): boolean {
  const { positiveCount, negativeCount, totalWords } = result;
  const totalSentimentWords = positiveCount + negativeCount;

  // Consider reliable if we have sentiment words and sufficient total text
  return totalSentimentWords >= 2 && totalWords >= 10;
}

/**
 * Get detailed sentiment explanation with Japanese processing information
 * @param result - Sentiment analysis result
 * @returns Human-readable explanation of the sentiment analysis
 */
export function explainSentiment(result: SentimentAnalysisResult): string {
  const {
    sentiment,
    positiveCount,
    negativeCount,
    totalWords,
    japanesePositiveCount = 0,
    japaneseNegativeCount = 0,
    negationAdjustments = 0,
    emphasisAdjustments = 0,
    mitigationAdjustments = 0,
    languageContent,
  } = result;

  const totalSentimentWords = positiveCount + negativeCount;

  if (totalWords === 0) {
    return 'No text available for sentiment analysis.';
  }

  if (totalSentimentWords === 0) {
    return `Neutral sentiment - no clear positive or negative indicators found in ${totalWords} words.`;
  }

  const reliability = isSentimentReliable(result) ? 'reliable' : 'limited';
  const ratio = negativeCount > 0 ? (positiveCount / negativeCount).toFixed(1) : 'infinite';

  let explanation =
    `${sentiment.charAt(0).toUpperCase() + sentiment.slice(1)} sentiment (${reliability} analysis) - ` +
    `${positiveCount} positive vs ${negativeCount} negative indicators ` +
    `(ratio: ${ratio}) in ${totalWords} total words.`;

  // Add Japanese processing details if applicable
  if (languageContent?.hasJapanese && (japanesePositiveCount > 0 || japaneseNegativeCount > 0)) {
    explanation += ` Japanese analysis: ${japanesePositiveCount} positive, ${japaneseNegativeCount} negative words.`;
  }

  // Add processing adjustments if any were applied
  if (negationAdjustments > 0 || emphasisAdjustments > 0 || mitigationAdjustments > 0) {
    const adjustments = [];
    if (negationAdjustments > 0) adjustments.push(`${negationAdjustments} negation patterns`);
    if (emphasisAdjustments > 0) adjustments.push(`${emphasisAdjustments} emphasis patterns`);
    if (mitigationAdjustments > 0) adjustments.push(`${mitigationAdjustments} mitigation patterns`);

    explanation += ` Applied adjustments: ${adjustments.join(', ')}.`;
  }

  return explanation;
}
