/**
 * Pure topic extraction functions with multilingual support (Japanese/English)
 * No side effects, fully testable and functional
 */

import type { SlackMessage } from '../../types/index.js';
import type {
  TopicExtractionResult,
  TopicExtractionConfig,
  MultilingualContent,
  KeywordAnalysis,
} from './types.js';

/**
 * Japanese stop words (particles and common words)
 */
export const JAPANESE_STOP_WORDS = new Set([
  'の',
  'に',
  'は',
  'を',
  'た',
  'が',
  'で',
  'て',
  'と',
  'し',
  'れ',
  'さ',
  'ある',
  'いる',
  'も',
  'する',
  'から',
  'な',
  'こと',
  'として',
  'い',
  'や',
  'など',
  'なり',
  'へ',
  'か',
  'だ',
  'これ',
  'それ',
  'あれ',
  'この',
  'その',
  'もの',
  'ため',
  'なっ',
  'なる',
  'でも',
  'です',
  'ます',
  'ました',
  'でした',
] as const);

/**
 * English stop words
 */
export const ENGLISH_STOP_WORDS = new Set([
  'the',
  'a',
  'an',
  'and',
  'or',
  'but',
  'in',
  'on',
  'at',
  'to',
  'for',
  'of',
  'with',
  'by',
  'is',
  'are',
  'was',
  'were',
  'be',
  'been',
  'being',
  'have',
  'has',
  'had',
  'do',
  'does',
  'did',
  'will',
  'would',
  'could',
  'should',
  'may',
  'might',
  'can',
  'cannot',
  'this',
  'that',
  'these',
  'those',
  'i',
  'you',
  'he',
  'she',
  'it',
  'we',
  'they',
  'what',
  'which',
  'who',
  'when',
  'where',
  'why',
  'how',
  'all',
  'each',
  'every',
  'both',
  'few',
  'more',
  'most',
  'other',
  'some',
  'such',
  'no',
  'not',
  'only',
  'own',
  'same',
  'so',
  'than',
  'too',
  'very',
  'just',
  'as',
] as const);

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
} as const;

/**
 * Clean text by removing URLs, mentions, and emojis
 * @param text - Raw text to clean
 * @returns Cleaned text
 */
export function cleanText(text: string): string {
  return text
    .replace(/<[^>]+>/g, ' ') // Remove Slack-style links/mentions
    .replace(/:[a-z_]+:/g, ' ') // Remove emoji codes
    .replace(/https?:\/\/[^\s]+/g, ' ') // Remove URLs
    .replace(/\s+/g, ' ') // Normalize whitespace
    .trim();
}

/**
 * Detect language content in text
 * @param text - Text to analyze
 * @returns Language content analysis
 */
export function detectLanguageContent(text: string): MultilingualContent {
  const hasJapanese = /[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]/.test(text);
  const hasEnglish = /[a-zA-Z]/.test(text);
  const mixedLanguage = hasJapanese && hasEnglish;

  let primaryLanguage: 'japanese' | 'english' | 'mixed' = 'mixed';
  if (hasJapanese && !hasEnglish) {
    primaryLanguage = 'japanese';
  } else if (hasEnglish && !hasJapanese) {
    primaryLanguage = 'english';
  }

  return {
    hasJapanese,
    hasEnglish,
    mixedLanguage,
    primaryLanguage,
  };
}

/**
 * Check if a character is a Japanese character
 * @param char - Character to check
 * @returns True if character is Japanese
 */
export function isJapaneseChar(char: string): boolean {
  return /[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]/.test(char);
}

/**
 * Check if text contains Kanji characters
 * @param text - Text to check
 * @returns True if text contains Kanji
 */
export function hasKanji(text: string): boolean {
  return /[\u4E00-\u9FAF]/.test(text);
}

/**
 * Check if text is all Katakana
 * @param text - Text to check
 * @returns True if text is all Katakana
 */
export function isKatakana(text: string): boolean {
  return /^[\u30A0-\u30FF]+$/.test(text);
}

/**
 * Tokenize text into words considering Japanese and English boundaries
 * @param text - Text to tokenize
 * @returns Array of tokens
 */
export function tokenizeText(text: string): string[] {
  // Split on spaces and Japanese punctuation
  return text
    .split(
      /[\s\u3000\u3001\u3002\uff01\uff1f\u300c\u300d\uff08\uff09\u3010\u3011\u3008\u3009\u300a\u300b\u3014\u3015\u300e\u300f\uff5b\uff5d[\]]+/
    )
    .filter((token) => token && token.length > 0);
}

/**
 * Process Japanese tokens by splitting on particles
 * @param token - Japanese token to process
 * @param config - Configuration for processing
 * @returns Array of processed segments
 */
export function processJapaneseToken(
  token: string,
  config: TopicExtractionConfig
): Array<{ segment: string; weight: number }> {
  const results: Array<{ segment: string; weight: number }> = [];

  // Split by common particles but keep the segments
  const segments = token.split(
    /(?=[\u3092\u306b\u3067\u3068\u306f\u304c\u3082\u3084\u304b\u3089\u307e\u3067\u3078\u3088\u308a])|(?<=[\u3092\u306b\u3067\u3068\u306f\u304c\u3082\u3084\u304b\u3089\u307e\u3067\u3078\u3088\u308a])/
  );

  for (const segment of segments) {
    if (segment.length >= config.minWordLength && !config.japaneseStopWords.has(segment)) {
      const segmentHasKanji = hasKanji(segment);
      const segmentIsKatakana = isKatakana(segment);

      if (
        (segmentHasKanji && segment.length >= 2) ||
        (segmentIsKatakana && segment.length >= 2) ||
        segment.length >= 3
      ) {
        let weight = 1;

        // Boost weight for preferred patterns
        if (segmentHasKanji && config.preferKanji) weight += 0.5;
        if (segmentIsKatakana && config.preferKatakana) weight += 0.5;

        results.push({ segment, weight });
      }
    }
  }

  // Also consider the whole token if it's meaningful
  if (
    token.length >= config.minWordLength &&
    token.length <= 10 &&
    !config.japaneseStopWords.has(token)
  ) {
    const tokenHasKanji = hasKanji(token);
    const tokenIsKatakana = isKatakana(token);

    if (tokenHasKanji || tokenIsKatakana) {
      let weight = 1.5; // Whole words get higher weight
      if (tokenHasKanji && config.preferKanji) weight += 0.5;
      if (tokenIsKatakana && config.preferKatakana) weight += 0.5;

      results.push({ segment: token, weight });
    }
  }

  return results;
}

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

    const lowerToken = token.toLowerCase();
    const containsJapanese = isJapaneseChar(token);

    if (containsJapanese) {
      // Process Japanese token
      const segments = processJapaneseToken(token, config);
      for (const { segment, weight } of segments) {
        wordCounts.set(segment, (wordCounts.get(segment) || 0) + weight);
      }
    } else {
      // Process English/alphanumeric token
      if (lowerToken.length > 3 && !config.englishStopWords.has(lowerToken)) {
        wordCounts.set(lowerToken, (wordCounts.get(lowerToken) || 0) + 1);
      }
    }
  }

  // Extract special patterns (technical identifiers, acronyms)
  const specialPatterns = [
    /[a-zA-Z][a-zA-Z0-9_-]{3,}/g, // Technical identifiers
    /[A-Z]{2,}/g, // Acronyms
  ];

  for (const pattern of specialPatterns) {
    const matches = cleanedText.match(pattern) || [];
    for (const match of matches) {
      const lowerMatch = match.toLowerCase();
      if (!config.englishStopWords.has(lowerMatch) && match.length <= 20) {
        wordCounts.set(lowerMatch, (wordCounts.get(lowerMatch) || 0) + 0.5);
      }
    }
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
