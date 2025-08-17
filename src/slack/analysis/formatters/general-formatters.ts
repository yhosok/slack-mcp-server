/**
 * Pure general formatting functions
 * No side effects, fully testable and functional
 */

import type { SlackMessage } from '../../types/index.js';
import type { FormattedResult, DurationFormatterOptions, ByteFormatterOptions } from './types.js';

/**
 * Default duration formatting options
 */
export const DEFAULT_DURATION_OPTIONS: DurationFormatterOptions = {
  units: 'auto',
  precision: 1,
  includeSeconds: false,
} as const;

/**
 * Default byte formatting options
 */
export const DEFAULT_BYTE_OPTIONS: ByteFormatterOptions = {
  units: 'auto',
  precision: 1,
  binary: true,
} as const;

/**
 * Format bytes into human-readable string
 * @param bytes - Number of bytes
 * @param options - Formatting options
 * @returns Formatted byte string
 */
export function formatBytes(
  bytes: number,
  options: ByteFormatterOptions = DEFAULT_BYTE_OPTIONS
): string {
  if (bytes === 0) return '0 Bytes';

  const base = options.binary ? 1024 : 1000;
  const sizes = options.binary
    ? ['Bytes', 'KiB', 'MiB', 'GiB', 'TiB']
    : ['Bytes', 'KB', 'MB', 'GB', 'TB'];

  if (options.units !== 'auto') {
    const unitMap = {
      bytes: 0,
      kb: 1,
      mb: 2,
      gb: 3,
    };

    const unitIndex = unitMap[options.units] || 0;
    const value = bytes / Math.pow(base, unitIndex);
    return `${value.toFixed(options.precision)} ${sizes[unitIndex]}`;
  }

  const i = Math.floor(Math.log(bytes) / Math.log(base));
  const value = bytes / Math.pow(base, i);

  return `${value.toFixed(options.precision)} ${sizes[i]}`;
}

/**
 * Calculate duration in minutes from Slack messages
 * @param messages - Array of Slack messages
 * @returns Duration in minutes
 */
export function calculateDurationFromMessages(messages: readonly SlackMessage[]): number {
  if (messages.length < 2) return 0;

  const startTime = parseFloat(messages[0]?.ts || '0');
  const endTime = parseFloat(messages[messages.length - 1]?.ts || '0');

  if (isNaN(startTime) || isNaN(endTime)) return 0;

  return (endTime - startTime) / 60; // Convert seconds to minutes
}

/**
 * Format duration in minutes into human-readable string
 * @param durationMinutes - Duration in minutes
 * @param options - Formatting options
 * @returns Formatted duration string
 */
export function formatDuration(
  durationMinutes: number,
  options: DurationFormatterOptions = DEFAULT_DURATION_OPTIONS
): string {
  if (durationMinutes <= 0) return '0 minutes';

  const seconds = Math.round(durationMinutes * 60);
  const minutes = Math.round(durationMinutes);
  const hours = durationMinutes / 60;
  const days = durationMinutes / (24 * 60);

  if (options.units !== 'auto') {
    switch (options.units) {
      case 'minutes':
        return `${minutes} minute${minutes !== 1 ? 's' : ''}`;
      case 'hours':
        return `${hours.toFixed(options.precision)} hour${hours >= 2 ? 's' : ''}`;
      case 'days':
        return `${days.toFixed(options.precision)} day${days >= 2 ? 's' : ''}`;
    }
  }

  // Auto format based on magnitude
  if (options.includeSeconds && durationMinutes < 1) {
    return `${seconds} second${seconds !== 1 ? 's' : ''}`;
  } else if (durationMinutes < 60) {
    return `${minutes} minute${minutes !== 1 ? 's' : ''}`;
  } else if (durationMinutes < 1440) {
    // 24 hours
    return `${hours.toFixed(options.precision)} hour${hours >= 2 ? 's' : ''}`;
  } else {
    return `${days.toFixed(options.precision)} day${days >= 2 ? 's' : ''}`;
  }
}

/**
 * Format duration from messages
 * @param messages - Array of Slack messages
 * @param options - Formatting options
 * @returns Formatted duration string
 */
export function formatDurationFromMessages(
  messages: readonly SlackMessage[],
  options: DurationFormatterOptions = DEFAULT_DURATION_OPTIONS
): string {
  const duration = calculateDurationFromMessages(messages);
  return formatDuration(duration, options);
}

/**
 * Format percentage with proper precision
 * @param value - Value to convert to percentage (0-1)
 * @param precision - Decimal precision
 * @returns Formatted percentage string
 */
export function formatPercentage(value: number, precision: number = 1): string {
  const percentage = value * 100;
  return `${percentage.toFixed(precision)}%`;
}

/**
 * Format number with proper precision and thousand separators
 * @param value - Number to format
 * @param precision - Decimal precision
 * @param useThousandSeparator - Whether to include thousand separators
 * @returns Formatted number string
 */
export function formatNumber(
  value: number,
  precision: number = 1,
  useThousandSeparator: boolean = true
): string {
  const formatted = value.toFixed(precision);

  if (useThousandSeparator && Math.abs(value) >= 1000) {
    return parseFloat(formatted).toLocaleString(undefined, {
      minimumFractionDigits: precision,
      maximumFractionDigits: precision,
    });
  }

  return formatted;
}

/**
 * Wrap text to specified line length
 * @param text - Text to wrap
 * @param maxLength - Maximum line length
 * @param preserveIndent - Whether to preserve indentation
 * @returns Array of wrapped lines
 */
export function wrapText(
  text: string,
  maxLength: number = 80,
  preserveIndent: boolean = true
): string[] {
  if (text.length <= maxLength) return [text];

  const lines: string[] = [];
  const words = text.split(' ');
  let currentLine = '';
  let indent = '';

  if (preserveIndent) {
    const match = text.match(/^(\s*)/);
    indent = match ? match[1] || '' : '';
  }

  for (const word of words) {
    const testLine = currentLine ? `${currentLine} ${word}` : word;

    if (testLine.length <= maxLength) {
      currentLine = testLine;
    } else {
      if (currentLine) {
        lines.push(currentLine);
        currentLine = `${indent}${word}`;
      } else {
        // Word is longer than max length, force break
        lines.push(word);
      }
    }
  }

  if (currentLine) {
    lines.push(currentLine);
  }

  return lines;
}

/**
 * Create a formatted result object
 * @param content - Formatted content string
 * @param includesEmojis - Whether content includes emojis
 * @returns Formatted result object
 */
export function createFormattedResult(
  content: string,
  includesEmojis: boolean = false
): FormattedResult {
  const lines = content.split('\n');

  return {
    content,
    lineCount: lines.length,
    characterCount: content.length,
    includesEmojis,
  };
}

/**
 * Add emoji prefix to text based on condition
 * @param text - Text to prefix
 * @param emoji - Emoji to add
 * @param condition - Whether to add emoji
 * @returns Text with optional emoji prefix
 */
export function addEmojiPrefix(text: string, emoji: string, condition: boolean = true): string {
  return condition ? `${emoji} ${text}` : text;
}

/**
 * Create a section header with optional emoji
 * @param title - Section title
 * @param emoji - Optional emoji
 * @param includeEmoji - Whether to include emoji
 * @returns Formatted section header
 */
export function createSectionHeader(
  title: string,
  emoji: string = '',
  includeEmoji: boolean = true
): string {
  const header = includeEmoji && emoji ? `${emoji} ${title}` : title;
  return `${header}:\n`;
}

/**
 * Create a bulleted list item
 * @param text - Item text
 * @param bullet - Bullet character (default: '•')
 * @returns Formatted list item
 */
export function createListItem(text: string, bullet: string = '•'): string {
  return `${bullet} ${text}`;
}

/**
 * Join multiple formatted sections with proper spacing
 * @param sections - Array of section strings
 * @param sectionSpacing - Number of newlines between sections
 * @returns Joined sections string
 */
export function joinSections(sections: readonly string[], sectionSpacing: number = 2): string {
  const separator = '\n'.repeat(sectionSpacing);
  return sections.filter((section) => section.trim()).join(separator);
}

/**
 * Truncate text with ellipsis if it exceeds max length
 * @param text - Text to truncate
 * @param maxLength - Maximum length
 * @param ellipsis - Ellipsis string (default: '...')
 * @returns Truncated text
 */
export function truncateText(text: string, maxLength: number, ellipsis: string = '...'): string {
  if (text.length <= maxLength) return text;

  const truncateLength = maxLength - ellipsis.length;
  return text.slice(0, Math.max(0, truncateLength)) + ellipsis;
}

/**
 * Pluralize a word based on count
 * @param word - Word to pluralize
 * @param count - Count to check
 * @param pluralForm - Custom plural form (optional)
 * @returns Singular or plural form
 */
export function pluralize(word: string, count: number, pluralForm?: string): string {
  if (count === 1) return word;
  return pluralForm || `${word}s`;
}

/**
 * Format a count with word (e.g., "1 message", "5 messages")
 * @param count - Number count
 * @param word - Word to pluralize
 * @param pluralForm - Custom plural form
 * @returns Formatted count string
 */
export function formatCount(count: number, word: string, pluralForm?: string): string {
  const pluralizedWord = pluralize(word, count, pluralForm);
  return `${formatNumber(count, 0)} ${pluralizedWord}`;
}
