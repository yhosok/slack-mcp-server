/**
 * Pure topic extraction functions with multilingual support (Japanese/English)
 * No side effects, fully testable and functional
 * Refactored to use shared text processing utilities
 */

import type { SlackMessage } from '../../types/index.js';
import type {
  TopicExtractionResult,
  TopicExtractionConfig,
  KeywordAnalysis,
} from './types.js';
import {
  JAPANESE_STOP_WORDS,
  isJapaneseChar,
  processJapaneseToken,
} from '../shared/text-processing/japanese-text-processor.js';
import {
  ENGLISH_STOP_WORDS,
  detectLanguageContent,
  tokenizeText,
  processEnglishToken,
  extractSpecialPatterns,
} from '../shared/text-processing/multilingual-processor.js';
import { cleanText } from '../shared/text-processing/text-cleaner.js';

/**
 * Default topic extraction configuration
 */
export const DEFAULT_TOPIC_CONFIG: TopicExtractionConfig = {
  maxTopics: 20,
  minWordLength: 2,
  japaneseStopWords: JAPANESE_STOP_WORDS,
  englishStopWords: ENGLISH_STOP_WORDS,
  preferKanji: true,
  preferKatakana: true,
  enableConjugationNormalization: true,
} as const;

// Note: Functions moved to shared utilities for reuse but re-exported here for backward compatibility
// Re-export core functions that were originally in this module
export {
  cleanText,
} from '../shared/text-processing/text-cleaner.js';

export {
  detectLanguageContent,
  tokenizeText,
  ENGLISH_STOP_WORDS,
} from '../shared/text-processing/multilingual-processor.js';

export {
  isJapaneseChar,
  processJapaneseToken,
  normalizeConjugation,
  JAPANESE_STOP_WORDS,
} from '../shared/text-processing/japanese-text-processor.js';

/**
 * Extract keywords from text with frequency counting
 * @param text - Text to analyze
 * @param config - Configuration for extraction
 * @returns Keyword analysis result
 */
export function extractKeywords(text: string, config: TopicExtractionConfig): KeywordAnalysis {
  const cleanedText = cleanText(text);
  const languageContent = detectLanguageContent(cleanedText);
  const tokens = tokenizeText(cleanedText);
  const wordCounts = new Map<string, number>();

  for (const token of tokens) {
    if (!token || token.length < config.minWordLength) continue;

    const _lowerToken = token.toLowerCase();
    const containsJapanese = isJapaneseChar(token);

    if (containsJapanese) {
      // Process Japanese token
      const segments = processJapaneseToken(token, {
        minWordLength: config.minWordLength,
        japaneseStopWords: config.japaneseStopWords,
        preferKanji: config.preferKanji,
        preferKatakana: config.preferKatakana,
        enableConjugationNormalization: config.enableConjugationNormalization,
      });
      for (const { segment, weight } of segments) {
        wordCounts.set(segment, (wordCounts.get(segment) || 0) + weight);
      }
    } else {
      // Process English/alphanumeric token
      const result = processEnglishToken(token, {
        minWordLength: config.minWordLength,
        englishStopWords: config.englishStopWords,
      });
      if (result) {
        wordCounts.set(result.segment, (wordCounts.get(result.segment) || 0) + result.weight);
      }
    }
  }

  // Extract special patterns using shared utility
  const specialPatterns = extractSpecialPatterns(cleanedText, config.englishStopWords);
  for (const [pattern, weight] of specialPatterns) {
    wordCounts.set(pattern, (wordCounts.get(pattern) || 0) + weight);
  }

  // Sort and limit keywords
  const keywords = Array.from(wordCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, config.maxTopics)
    .map(([word]) => word);

  return {
    keywords,
    frequency: new Map(wordCounts),
    normalizedText: cleanedText,
    language: languageContent.primaryLanguage,
  };
}

/**
 * Extract topics from thread messages
 * @param messages - Array of messages to analyze
 * @param config - Configuration for topic extraction
 * @returns Topic extraction result
 */
export function extractTopicsFromThread(
  messages: readonly SlackMessage[],
  config: TopicExtractionConfig = DEFAULT_TOPIC_CONFIG
): TopicExtractionResult {
  const text = messages.map((message) => message.text || '').join(' ');

  if (!text.trim()) {
    return {
      topics: [],
      wordCounts: new Map(),
      hasJapaneseContent: false,
      hasEnglishContent: false,
    };
  }

  const keywordAnalysis = extractKeywords(text, config);
  const languageContent = detectLanguageContent(text);

  return {
    topics: keywordAnalysis.keywords,
    wordCounts: keywordAnalysis.frequency,
    hasJapaneseContent: languageContent.hasJapanese,
    hasEnglishContent: languageContent.hasEnglish,
  };
}

/**
 * Get topic relevance score for a specific topic
 * @param topic - Topic to score
 * @param analysis - Topic extraction result
 * @returns Relevance score between 0 and 1
 */
export function getTopicRelevance(topic: string, analysis: TopicExtractionResult): number {
  const frequency = analysis.wordCounts.get(topic) || 0;
  if (frequency === 0) return 0;

  const maxFrequency = Math.max(...Array.from(analysis.wordCounts.values()));
  if (maxFrequency === 0) return 0;

  return frequency / maxFrequency;
}

/**
 * Filter topics by minimum relevance threshold
 * @param analysis - Topic extraction result
 * @param minRelevance - Minimum relevance score (0-1)
 * @returns Filtered topics array
 */
export function filterTopicsByRelevance(
  analysis: TopicExtractionResult,
  minRelevance: number = 0.1
): string[] {
  return analysis.topics.filter((topic) => getTopicRelevance(topic, analysis) >= minRelevance);
}

/**
 * Get topic summary statistics
 * @param analysis - Topic extraction result
 * @returns Summary statistics
 */
export function getTopicSummary(analysis: TopicExtractionResult): {
  totalTopics: number;
  totalFrequency: number;
  averageRelevance: number;
  languageDistribution: {
    japanese: number;
    english: number;
    mixed: number;
  };
} {
  const totalTopics = analysis.topics.length;
  const totalFrequency = Array.from(analysis.wordCounts.values()).reduce(
    (sum, count) => sum + count,
    0
  );

  let japaneseCount = 0;
  let englishCount = 0;
  let mixedCount = 0;

  for (const topic of analysis.topics) {
    const hasJap = isJapaneseChar(topic);
    const hasEng = /[a-zA-Z]/.test(topic);

    if (hasJap && hasEng) {
      mixedCount++;
    } else if (hasJap) {
      japaneseCount++;
    } else {
      englishCount++;
    }
  }

  const averageRelevance =
    totalTopics > 0
      ? analysis.topics
          .map((topic) => getTopicRelevance(topic, analysis))
          .reduce((sum, score) => sum + score, 0) / totalTopics
      : 0;

  return {
    totalTopics,
    totalFrequency,
    averageRelevance,
    languageDistribution: {
      japanese: japaneseCount,
      english: englishCount,
      mixed: mixedCount,
    },
  };
}
