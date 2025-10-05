/**
 * Pure multilingual text processing utilities
 * Extracted from topic-extraction.ts for reuse across analysis functions
 * No side effects, fully testable and functional
 */

/**
 * English stop words
 * Exported for reuse across analysis functions
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
 * Multilingual content analysis result
 */
export interface MultilingualContent {
  hasJapanese: boolean;
  hasEnglish: boolean;
  mixedLanguage: boolean;
  primaryLanguage: 'japanese' | 'english' | 'mixed';
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
 * Count words in text with multilingual support (English and Japanese)
 *
 * Uses the same tokenization logic as topic extraction for consistency.
 * This function properly handles:
 * - English words separated by spaces
 * - Japanese text including Hiragana, Katakana, and Kanji
 * - Mixed language content
 * - Slack-specific formatting (links, mentions, emoji codes)
 *
 * @param text - Text to count words in
 * @returns Number of meaningful words/tokens
 */
export function countWordsInText(text: string): number {
  if (!text || typeof text !== 'string') {
    return 0;
  }

  // Use existing tokenization for consistency
  const tokens = tokenizeText(text);

  // Filter out empty tokens and single characters (except for valid single-character words)
  const meaningfulTokens = tokens.filter((token: string) => {
    if (!token || token.length === 0) {
      return false;
    }

    // Allow single character tokens if they are meaningful (numbers, letters, or Japanese characters)
    if (token.length === 1) {
      return /[a-zA-Z0-9\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]/.test(token);
    }

    return true;
  });

  return meaningfulTokens.length;
}

/**
 * Process English tokens with stop word filtering
 * @param token - English token to process
 * @param config - Configuration for processing
 * @returns Processing result with weight
 */
export function processEnglishToken(
  token: string,
  config: {
    minWordLength: number;
    englishStopWords: ReadonlySet<string>;
  }
): { segment: string; weight: number } | null {
  const lowerToken = token.toLowerCase();

  // Filter by length and stop words
  if (lowerToken.length > 3 && !config.englishStopWords.has(lowerToken)) {
    return { segment: lowerToken, weight: 1.0 };
  }

  return null;
}

/**
 * Extract special patterns from text (technical identifiers, acronyms)
 * @param text - Text to extract patterns from
 * @param englishStopWords - English stop words to filter
 * @returns Map of pattern to weight
 */
export function extractSpecialPatterns(
  text: string,
  englishStopWords: ReadonlySet<string>
): Map<string, number> {
  const patternCounts = new Map<string, number>();

  const specialPatterns = [
    /[a-zA-Z][a-zA-Z0-9_-]{3,}/g, // Technical identifiers
    /[A-Z]{2,}/g, // Acronyms
  ];

  for (const pattern of specialPatterns) {
    const matches = text.match(pattern) || [];
    for (const match of matches) {
      const lowerMatch = match.toLowerCase();
      if (!englishStopWords.has(lowerMatch) && match.length <= 20) {
        patternCounts.set(lowerMatch, (patternCounts.get(lowerMatch) || 0) + 0.5);
      }
    }
  }

  return patternCounts;
}
