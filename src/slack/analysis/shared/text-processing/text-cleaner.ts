/**
 * Pure text cleaning utilities
 * Extracted from topic-extraction.ts and relevance-scorer.ts for reuse across analysis functions
 * No side effects, fully testable and functional
 */

/**
 * Clean text by removing URLs, mentions, and emojis
 * Standardized version used across all analysis functions
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
 * More aggressive text cleaning for search and relevance scoring
 * @param text - Raw text to clean
 * @returns Aggressively cleaned text
 */
export function cleanTextAggressive(text: string): string {
  return text
    .replace(/<[^>]+>/g, ' ') // Remove Slack-style links/mentions
    .replace(/:[a-z_]+:/g, ' ') // Remove emoji codes
    .replace(/https?:\/\/[^\s]+/g, ' ') // Remove URLs
    .replace(/[^\w\s\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]/g, ' ') // Keep only word chars and Japanese
    .replace(/\s+/g, ' ') // Normalize whitespace
    .trim()
    .toLowerCase();
}

/**
 * Remove common Slack formatting patterns
 * @param text - Text with Slack formatting
 * @returns Text with Slack formatting removed
 */
export function removeSlackFormatting(text: string): string {
  return text
    .replace(/<@[UW][A-Z0-9]+(\|[^>]+)?>/g, '') // User mentions
    .replace(/<#[CD][A-Z0-9]+(\|[^>]+)?>/g, '') // Channel mentions
    .replace(/<![^>]+>/g, '') // Special mentions (!here, !channel, etc.)
    .replace(/<[^|>]+\|([^>]+)>/g, '$1') // Links with labels
    .replace(/<([^>]+)>/g, '$1') // Simple links
    .replace(/\*([^*]+)\*/g, '$1') // Bold
    .replace(/_([^_]+)_/g, '$1') // Italic
    .replace(/~([^~]+)~/g, '$1') // Strikethrough
    .replace(/`([^`]+)`/g, '$1') // Code
    .replace(/```[^```]*```/g, '') // Code blocks
    .replace(/&gt;(.+)/g, '$1') // Quotes
    .trim();
}

/**
 * Normalize text for consistent processing
 * @param text - Text to normalize
 * @returns Normalized text
 */
export function normalizeText(text: string): string {
  return text
    .replace(/\u3000/g, ' ') // Replace Japanese full-width space
    .replace(/\uff01/g, '!') // Normalize full-width exclamation
    .replace(/\uff1f/g, '?') // Normalize full-width question mark
    .replace(/\uff08/g, '(') // Normalize full-width parentheses
    .replace(/\uff09/g, ')')
    .replace(/[\u2018\u2019]/g, "'") // Normalize smart quotes
    .replace(/[\u201c\u201d]/g, '"')
    .replace(/\u2013|\u2014/g, '-') // Normalize dashes
    .replace(/\u2026/g, '...') // Normalize ellipsis
    .trim();
}

/**
 * Extract plain text from Slack message content
 * Combines all cleaning operations for message text processing
 * @param text - Raw Slack message text
 * @returns Clean, normalized plain text
 */
export function extractPlainText(text: string): string {
  if (!text || typeof text !== 'string') {
    return '';
  }

  return normalizeText(removeSlackFormatting(cleanText(text)));
}

/**
 * Check if text appears to be mostly code or technical content
 * @param text - Text to analyze
 * @returns True if text appears to be code
 */
export function isCodeLikeText(text: string): boolean {
  const codeIndicators = [
    /\{[^}]*\}/g, // Curly braces
    /\[[^\]]*\]/g, // Square brackets
    /\([^)]*\)/g, // Parentheses
    /[=<>]+/g, // Operators
    /\w+\.\w+/g, // Dot notation
    /[;{}()]/g, // Code punctuation
  ];

  let indicatorCount = 0;
  for (const pattern of codeIndicators) {
    const matches = text.match(pattern);
    if (matches) {
      indicatorCount += matches.length;
    }
  }

  const textLength = text.length;
  const indicatorRatio = indicatorCount / Math.max(textLength / 10, 1);

  return indicatorRatio > 0.3;
}

/**
 * Remove code blocks and inline code from text
 * @param text - Text containing code
 * @returns Text with code removed
 */
export function removeCodeContent(text: string): string {
  return text
    .replace(/```[\s\S]*?```/g, '') // Remove code blocks
    .replace(/`[^`\n]+`/g, '') // Remove inline code
    .replace(/\n\s{4,}.*$/gm, '') // Remove indented code lines
    .replace(/^\s*[>#]\s+.*$/gm, '') // Remove command lines
    .trim();
}