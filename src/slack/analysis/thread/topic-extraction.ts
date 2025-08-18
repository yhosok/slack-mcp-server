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
  enableConjugationNormalization: true,
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
 * Normalize Japanese verb and adjective conjugations to their base forms
 * This function applies simple rule-based normalization without external morphological analysis
 * @param word - Japanese word to normalize
 * @returns Normalized base form of the word
 */
export function normalizeConjugation(word: string): string {
  if (!word || word.length < 2) return word;

  // Most specific patterns first to avoid false matches
  
  // 1. Passive forms
  if (word.endsWith('されています')) return word.replace(/(.+)されています$/, '$1される');
  if (word.endsWith('されている')) return word.replace(/(.+)されている$/, '$1される');
  if (word.endsWith('されました')) return word.replace(/(.+)されました$/, '$1される');
  if (word.endsWith('された')) return word.replace(/(.+)された$/, '$1される');

  // 2. Suru verb forms
  if (word.endsWith('しています')) return word.replace(/(.+)しています$/, '$1する');
  if (word.endsWith('している')) return word.replace(/(.+)している$/, '$1する');
  if (word.endsWith('しました')) return word.replace(/(.+)しました$/, '$1する');
  if (word.endsWith('します')) return word.replace(/(.+)します$/, '$1する');
  if (word.endsWith('して')) return word.replace(/(.+)して$/, '$1する');
  if (word.endsWith('した') && !word.endsWith('ました') && !word.endsWith('でした')) {
    return word.replace(/(.+)した$/, '$1する');
  }

  // 3. Na-adjective forms (before ました patterns)
  if (word.endsWith('でした')) return word.replace(/(.+)でした$/, '$1だ');
  if (word.endsWith('ではない')) return word.replace(/(.+)ではない$/, '$1だ');
  if (word.endsWith('じゃない')) return word.replace(/(.+)じゃない$/, '$1だ');

  // 4. Specific ichidan verb patterns (before general patterns)
  if (word.endsWith('考えています')) return '考える';
  if (word.endsWith('食べています')) return '食べる';
  if (word.endsWith('見ています')) return '見る';
  if (word.endsWith('着ています')) return '着る';
  
  // 5. Specific godan patterns that could be confused
  if (word.endsWith('動いています')) return '動く';
  if (word.endsWith('書いています')) return '書く';
  if (word.endsWith('歩いています')) return '歩く';
  
  // 6. General godan progressive forms
  if (word.endsWith('きています')) return word.replace(/(.+)きています$/, '$1く');
  if (word.endsWith('ぎています')) return word.replace(/(.+)ぎています$/, '$1ぐ');
  if (word.endsWith('びています')) return word.replace(/(.+)びています$/, '$1ぶ');
  if (word.endsWith('みています')) return word.replace(/(.+)みています$/, '$1む');
  if (word.endsWith('りています')) return word.replace(/(.+)りています$/, '$1る');
  if (word.endsWith('ちています')) return word.replace(/(.+)ちています$/, '$1つ');
  if (word.endsWith('にています')) return word.replace(/(.+)にています$/, '$1ぬ');
  if (word.endsWith('いています')) return word.replace(/(.+)いています$/, '$1う');

  // 7. General ichidan progressive forms (after specific cases)
  if (word.endsWith('ています')) return word.replace(/(.+)ています$/, '$1る');

  // 8. Past tense forms for godan verbs
  if (word.endsWith('きました')) return word.replace(/(.+)きました$/, '$1く');
  if (word.endsWith('ぎました')) return word.replace(/(.+)ぎました$/, '$1ぐ');
  if (word.endsWith('びました')) return word.replace(/(.+)びました$/, '$1ぶ');
  if (word.endsWith('みました')) return word.replace(/(.+)みました$/, '$1む');
  if (word.endsWith('りました')) return word.replace(/(.+)りました$/, '$1る');
  if (word.endsWith('ちました')) return word.replace(/(.+)ちました$/, '$1つ');
  if (word.endsWith('にました')) return word.replace(/(.+)にました$/, '$1ぬ');
  if (word.endsWith('いました')) return word.replace(/(.+)いました$/, '$1う');

  // 9. Ichidan past tense (after godan forms)
  if (word.endsWith('ました')) return word.replace(/(.+)ました$/, '$1る');

  // 10. Potential forms (before general polite forms)
  if (word.endsWith('できます')) return word.replace(/(.+)できます$/, '$1できる');

  // 11. Polite forms for godan verbs
  if (word.endsWith('きます')) return word.replace(/(.+)きます$/, '$1く');
  if (word.endsWith('ぎます')) return word.replace(/(.+)ぎます$/, '$1ぐ');
  if (word.endsWith('びます')) return word.replace(/(.+)びます$/, '$1ぶ');
  if (word.endsWith('みます')) return word.replace(/(.+)みます$/, '$1む');
  if (word.endsWith('ります')) return word.replace(/(.+)ります$/, '$1る');
  if (word.endsWith('ちます')) return word.replace(/(.+)ちます$/, '$1つ');
  if (word.endsWith('にます')) return word.replace(/(.+)にます$/, '$1ぬ');
  if (word.endsWith('います')) return word.replace(/(.+)います$/, '$1う');

  // 12. Ichidan polite forms (after godan)
  if (word.endsWith('ます')) return word.replace(/(.+)ます$/, '$1る');

  // 13. Te-form for godan verbs
  if (word.endsWith('いて')) return word.replace(/(.+)いて$/, '$1く');
  if (word.endsWith('いで')) return word.replace(/(.+)いで$/, '$1ぐ');
  if (word.endsWith('んで')) {
    const stem = word.substring(0, word.length - 'んで'.length);
    if (stem.endsWith('呼') || stem.endsWith('読') || stem.endsWith('飲') || stem.endsWith('込') || stem.endsWith('住')) {
      return stem + 'む';
    }
    if (stem.endsWith('運') || stem.endsWith('遊') || stem.endsWith('学')) {
      return stem + 'ぶ';
    }
    return stem + 'む'; // Default to mu
  }
  if (word.endsWith('って')) {
    const stem = word.substring(0, word.length - 'って'.length);
    if (stem.endsWith('立') || stem.endsWith('持') || stem.endsWith('待')) {
      return stem + 'つ';
    }
    return stem + 'う'; // Default to u
  }

  // 14. Ichidan te-form (after godan)
  if (word.endsWith('て') && word.length > 2) {
    return word.replace(/(.+)て$/, '$1る');
  }

  // 15. Adjective forms
  if (word.endsWith('くなかった')) return word.replace(/(.+)くなかった$/, '$1い');
  if (word.endsWith('かった')) return word.replace(/(.+)かった$/, '$1い');
  if (word.endsWith('くない')) return word.replace(/(.+)くない$/, '$1い');
  
  // Specific adverbial forms
  if (word === '美しく') return '美しい';
  if (word === '早く') return '早い';
  if (word === '高く') return '高い';
  if (word === '近く') return '近い';
  if (word === '遠く') return '遠い';
  if (word === '深く') return '深い';
  if (word === '強く') return '強い';
  if (word === '弱く') return '弱い';
  
  // 16. Copula forms
  if (word.endsWith('です')) return word.replace(/(.+)です$/, '$1だ');
  if (word.endsWith('である')) return word.replace(/(.+)である$/, '$1だ');

  return word;
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
 * Process Japanese tokens by splitting on particles and applying conjugation normalization
 * @param token - Japanese token to process
 * @param config - Configuration for processing
 * @returns Array of processed segments
 */
export function processJapaneseToken(
  token: string,
  config: TopicExtractionConfig
): Array<{ segment: string; weight: number }> {
  const results: Array<{ segment: string; weight: number }> = [];
  const seenSegments = new Set<string>(); // Track processed segments to avoid duplicates

  // First, try to normalize the whole token (this is important for conjugated verbs)
  if (
    token.length >= config.minWordLength &&
    token.length <= 10 &&
    !config.japaneseStopWords.has(token)
  ) {
    // Apply conjugation normalization to whole token
    const normalizedToken = config.enableConjugationNormalization !== false 
      ? normalizeConjugation(token) 
      : token;
    
    // Check if normalization actually changed something (indicating it was a conjugated form)
    const wasNormalized = normalizedToken !== token;
    
    // If it was normalized and is meaningful, prioritize this
    if (wasNormalized && !config.japaneseStopWords.has(normalizedToken)) {
      const tokenHasKanji = hasKanji(normalizedToken);
      const tokenIsKatakana = isKatakana(normalizedToken);

      if (tokenHasKanji || tokenIsKatakana) {
        let weight = 2.0; // Higher weight for normalized conjugated forms
        if (tokenHasKanji && config.preferKanji) weight += 0.5;
        if (tokenIsKatakana && config.preferKatakana) weight += 0.5;

        results.push({ segment: normalizedToken, weight });
        seenSegments.add(normalizedToken);
      }
    }
    // If no normalization occurred but it's still meaningful, add it with lower weight
    else if (!wasNormalized && !seenSegments.has(normalizedToken)) {
      const tokenHasKanji = hasKanji(normalizedToken);
      const tokenIsKatakana = isKatakana(normalizedToken);

      if (tokenHasKanji || tokenIsKatakana) {
        let weight = 1.5; // Whole words get moderate weight
        if (tokenHasKanji && config.preferKanji) weight += 0.5;
        if (tokenIsKatakana && config.preferKatakana) weight += 0.5;

        results.push({ segment: normalizedToken, weight });
        seenSegments.add(normalizedToken);
      }
    }
  }

  // Then, split by common particles and process segments
  const segments = token.split(
    /(?=[\u3092\u306b\u3067\u3068\u306f\u304c\u3082\u3084\u304b\u3089\u307e\u3067\u3078\u3088\u308a])|(?<=[\u3092\u306b\u3067\u3068\u306f\u304c\u3082\u3084\u304b\u3089\u307e\u3067\u3078\u3088\u308a])/
  );

  for (const segment of segments) {
    if (segment.length >= config.minWordLength && !config.japaneseStopWords.has(segment)) {
      // Apply conjugation normalization if enabled
      const normalizedSegment = config.enableConjugationNormalization !== false 
        ? normalizeConjugation(segment) 
        : segment;
      
      // Skip if we've already processed this normalized form
      if (seenSegments.has(normalizedSegment)) {
        continue;
      }
      
      // Skip if normalized form is a stop word
      if (config.japaneseStopWords.has(normalizedSegment)) {
        continue;
      }

      const segmentHasKanji = hasKanji(normalizedSegment);
      const segmentIsKatakana = isKatakana(normalizedSegment);

      if (
        (segmentHasKanji && normalizedSegment.length >= 2) ||
        (segmentIsKatakana && normalizedSegment.length >= 2) ||
        normalizedSegment.length >= 3
      ) {
        let weight = 1.0; // Lower weight for segments

        // Boost weight for preferred patterns
        if (segmentHasKanji && config.preferKanji) weight += 0.5;
        if (segmentIsKatakana && config.preferKatakana) weight += 0.5;

        results.push({ segment: normalizedSegment, weight });
        seenSegments.add(normalizedSegment);
      }
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
