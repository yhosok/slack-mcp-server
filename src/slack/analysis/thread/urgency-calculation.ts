/**
 * Pure urgency and importance scoring functions for thread analysis
 * No side effects, fully testable and functional
 */

import type { SlackMessage, ThreadParticipant } from '../../types/index.js';
import type {
  UrgencyScore,
  ImportanceScore,
  UrgencyConfig,
  ImportanceConfig,
  PunctuationInfo,
  TimeUrgencyInfo,
} from './types.js';

/**
 * Default urgency calculation configuration
 */
export const DEFAULT_URGENCY_CONFIG: UrgencyConfig = {
  urgentKeywords: [
    // English urgent keywords
    'urgent',
    'asap',
    'immediately',
    'emergency',
    'critical',
    'now',
    'today',
    'deadline',
    'blocker',
    'blocking',
    'priority',
    'rush',
    'fast',
    'quick',
    'hurry',
    // Basic Japanese urgent keywords
    '緊急',
    '至急',
    '急ぎ',
    'すぐ',
    '今すぐ',
    // Enhanced Japanese urgent keywords
    '大至急',
    '緊急対応',
    '急ぎです',
    '優先',
    '重要',
    'エスカレーション',
    '上長確認',
    '承認急ぎ',
  ] as const,
  keywordWeight: 0.2,
  messageCountThresholds: {
    medium: 10,
    high: 20,
  },
  messageCountWeight: 0.3,
  consecutivePunctuationWeight: 0.03,
  maxPunctuationBonus: 0.1,
  timeBasedKeywords: [
    // English time-based urgency
    'deadline',
    'due by',
    'before 5pm',
    'end of day',
    'eod',
    'before meeting',
    'call前',
    'meeting前',
    // Japanese time-based urgency
    '本日中',
    '明日まで',
    '今日中',
    '午前中',
    '夕方まで',
    '期限',
    '会議前',
    '週末まで',
    '月末まで',
  ] as const,
  timeBasedWeight: 0.15,
} as const;

/**
 * Default importance calculation configuration
 */
export const DEFAULT_IMPORTANCE_CONFIG: ImportanceConfig = {
  importantKeywords: [
    'decision',
    'approve',
    'budget',
    'launch',
    'release',
    'client',
    'customer',
    'revenue',
    'milestone',
    'strategic',
    'executive',
    'board',
    'ceo',
    'director',
    'manager',
    'contract',
    'agreement',
    'legal',
    'compliance',
    'audit',
    '決定',
    '承認',
    '予算',
    'リリース',
    'クライアント',
    '顧客',
    '売上',
    'マイルストーン',
    '戦略的',
    '重要',
  ] as const,
  participantWeight: 0.05,
  messageWeight: 0.02,
  keywordWeight: 0.1,
  maxParticipantScore: 0.3,
  maxMessageScore: 0.4,
} as const;

/**
 * Extract and combine text from messages for keyword analysis
 * @param messages - Array of Slack messages
 * @returns Combined text string in lowercase
 */
export function extractCombinedText(messages: readonly SlackMessage[]): string {
  return messages
    .map((message) => message.text || '')
    .join(' ')
    .toLowerCase()
    .trim();
}

/**
 * Count keyword occurrences in text with word boundary matching
 * @param text - Text to search in
 * @param keywords - Keywords to count
 * @returns Map of keyword counts
 */
export function countKeywords(text: string, keywords: readonly string[]): Map<string, number> {
  const counts = new Map<string, number>();

  for (const keyword of keywords) {
    const lowerKeyword = keyword.toLowerCase();

    // Use word boundary matching for English, character matching for Japanese
    const isJapanese = /[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]/.test(keyword);
    const regex = isJapanese
      ? new RegExp(lowerKeyword, 'g')
      : new RegExp(`\\b${lowerKeyword}\\b`, 'g');

    const matches = text.match(regex);
    if (matches && matches.length > 0) {
      counts.set(keyword, matches.length);
    }
  }

  return counts;
}

/**
 * Calculate total keyword score from keyword counts
 * @param keywordCounts - Map of keyword counts
 * @param weight - Weight per keyword occurrence
 * @returns Total weighted score
 */
export function calculateKeywordScore(keywordCounts: Map<string, number>, weight: number): number {
  let score = 0;
  for (const count of keywordCounts.values()) {
    score += count * weight;
  }
  return score;
}

/**
 * Calculate message count factor based on thresholds
 * @param messageCount - Number of messages
 * @param thresholds - Threshold configuration
 * @param weight - Weight for message count factor
 * @returns Message count contribution to score
 */
export function calculateMessageCountFactor(
  messageCount: number,
  thresholds: { medium: number; high: number },
  weight: number
): number {
  let factor = 0;

  if (messageCount > thresholds.high) {
    factor += weight * 2; // High activity
  } else if (messageCount > thresholds.medium) {
    factor += weight; // Medium activity
  }

  return factor;
}

/**
 * Detect consecutive punctuation patterns in text
 * @param text - Text to analyze
 * @returns Information about consecutive punctuation found
 */
export function detectConsecutivePunctuation(text: string): PunctuationInfo {
  // Find all consecutive punctuation runs (2 or more)
  const consecutivePunctuationRegex = /[!?！？]{2,}/g;

  let hasConsecutivePunctuation = false;
  let maxConsecutiveCount = 0;
  const punctuationTypes: string[] = [];
  let totalPunctuationCount = 0;

  let match;
  while ((match = consecutivePunctuationRegex.exec(text)) !== null) {
    hasConsecutivePunctuation = true;
    const matchText = match[0];
    const matchLength = matchText.length;

    totalPunctuationCount += matchLength;
    maxConsecutiveCount = Math.max(maxConsecutiveCount, matchLength);

    // Collect unique punctuation types from this match
    const uniqueChars = [...new Set(matchText.split(''))];
    for (const char of uniqueChars) {
      if (!punctuationTypes.includes(char)) {
        punctuationTypes.push(char);
      }
    }
  }

  return {
    hasConsecutivePunctuation,
    maxConsecutiveCount,
    punctuationTypes,
    totalPunctuationCount,
  };
}

/**
 * Calculate punctuation urgency score based on consecutive punctuation
 * @param punctuationInfo - Information about detected punctuation
 * @param weight - Weight per consecutive punctuation level
 * @param maxBonus - Maximum bonus score from punctuation
 * @returns Punctuation contribution to urgency score
 */
export function calculatePunctuationScore(
  punctuationInfo: PunctuationInfo,
  weight: number,
  maxBonus: number
): number {
  if (!punctuationInfo.hasConsecutivePunctuation) {
    return 0;
  }

  // Calculate bonus based on consecutive count
  let bonus = 0;
  const { maxConsecutiveCount } = punctuationInfo;

  if (maxConsecutiveCount >= 4) {
    bonus = maxBonus; // Maximum bonus for 4+ consecutive
  } else if (maxConsecutiveCount === 3) {
    bonus = weight * 2; // 0.06 for 3 consecutive
  } else if (maxConsecutiveCount === 2) {
    bonus = weight; // 0.03 for 2 consecutive
  }

  return Math.min(maxBonus, bonus);
}

/**
 * Detect time-based urgency patterns in text
 * @param text - Text to analyze
 * @param timeKeywords - Time-based urgency keywords
 * @returns Information about time-based urgency found
 */
export function detectTimeBasedUrgency(
  text: string,
  timeKeywords: readonly string[]
): TimeUrgencyInfo {
  const lowerText = text.toLowerCase();

  const timeKeywordsFound: string[] = [];
  const deadlineIndicators: string[] = [];
  const meetingUrgency: string[] = [];

  // Categorize time-based keywords
  const deadlinePatterns = [
    'deadline',
    'due by',
    '期限',
    '本日中',
    '明日まで',
    '今日中',
    '午前中',
    '夕方まで',
    '週末まで',
    '月末まで',
  ];
  const meetingPatterns = ['before meeting', 'call前', 'meeting前', '会議前'];

  for (const keyword of timeKeywords) {
    const lowerKeyword = keyword.toLowerCase();

    // Use word boundary matching for English, character matching for Japanese
    const isJapanese = /[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]/.test(keyword);
    const regex = isJapanese
      ? new RegExp(lowerKeyword, 'g')
      : new RegExp(`\\b${lowerKeyword}\\b`, 'g');

    if (regex.test(lowerText)) {
      timeKeywordsFound.push(keyword);

      // Categorize the keyword
      if (deadlinePatterns.some((pattern) => pattern.toLowerCase() === lowerKeyword)) {
        deadlineIndicators.push(keyword);
      } else if (meetingPatterns.some((pattern) => pattern.toLowerCase() === lowerKeyword)) {
        meetingUrgency.push(keyword);
      }
    }
  }

  return {
    hasTimeBasedUrgency: timeKeywordsFound.length > 0,
    timeKeywords: timeKeywordsFound,
    deadlineIndicators,
    meetingUrgency,
  };
}

/**
 * Calculate urgency score for thread messages
 * @param messages - Array of messages to analyze
 * @param config - Configuration for urgency calculation
 * @returns Detailed urgency score analysis
 */
export function calculateUrgencyScore(
  messages: readonly SlackMessage[],
  config: UrgencyConfig = DEFAULT_URGENCY_CONFIG
): UrgencyScore {
  const text = extractCombinedText(messages);
  const keywordCounts = countKeywords(text, config.urgentKeywords);
  const keywordScore = calculateKeywordScore(keywordCounts, config.keywordWeight);

  const messageCountFactor = calculateMessageCountFactor(
    messages.length,
    config.messageCountThresholds,
    config.messageCountWeight
  );

  // New punctuation analysis
  const punctuationInfo = detectConsecutivePunctuation(text);
  const punctuationScore = calculatePunctuationScore(
    punctuationInfo,
    config.consecutivePunctuationWeight ?? 0.03,
    config.maxPunctuationBonus ?? 0.1
  );

  // New time-based urgency analysis
  const timeUrgencyInfo = config.timeBasedKeywords
    ? detectTimeBasedUrgency(text, config.timeBasedKeywords)
    : {
        hasTimeBasedUrgency: false,
        timeKeywords: [],
        deadlineIndicators: [],
        meetingUrgency: [],
      };

  const timeBasedScore = timeUrgencyInfo.hasTimeBasedUrgency
    ? timeUrgencyInfo.timeKeywords.length * (config.timeBasedWeight ?? 0.15)
    : 0;

  // Combine all scores with cap at 1.0
  const totalScore = Math.min(
    1,
    keywordScore + messageCountFactor + punctuationScore + timeBasedScore
  );
  const urgentKeywords = Array.from(keywordCounts.keys());

  return {
    score: totalScore,
    urgentKeywords,
    messageCountFactor,
    punctuationScore: punctuationScore > 0 ? punctuationScore : undefined,
    timeBasedScore: timeBasedScore > 0 ? timeBasedScore : undefined,
    punctuationInfo: punctuationInfo.hasConsecutivePunctuation ? punctuationInfo : undefined,
    timeUrgencyInfo: timeUrgencyInfo.hasTimeBasedUrgency ? timeUrgencyInfo : undefined,
  };
}

/**
 * Calculate participant factor for importance scoring
 * @param participantCount - Number of participants
 * @param weight - Weight per participant
 * @param maxScore - Maximum score from participants
 * @returns Participant contribution to importance
 */
export function calculateParticipantFactor(
  participantCount: number,
  weight: number,
  maxScore: number
): number {
  return Math.min(maxScore, participantCount * weight);
}

/**
 * Calculate message factor for importance scoring
 * @param messageCount - Number of messages
 * @param weight - Weight per message
 * @param maxScore - Maximum score from messages
 * @returns Message contribution to importance
 */
export function calculateMessageFactor(
  messageCount: number,
  weight: number,
  maxScore: number
): number {
  return Math.min(maxScore, messageCount * weight);
}

/**
 * Calculate importance score for thread
 * @param messages - Array of messages to analyze
 * @param participants - Array of thread participants
 * @param config - Configuration for importance calculation
 * @returns Detailed importance score analysis
 */
export function calculateImportanceScore(
  messages: readonly SlackMessage[],
  participants: readonly ThreadParticipant[],
  config: ImportanceConfig = DEFAULT_IMPORTANCE_CONFIG
): ImportanceScore {
  const text = extractCombinedText(messages);
  const keywordCounts = countKeywords(text, config.importantKeywords);

  const participantFactor = calculateParticipantFactor(
    participants.length,
    config.participantWeight,
    config.maxParticipantScore
  );

  const messageFactor = calculateMessageFactor(
    messages.length,
    config.messageWeight,
    config.maxMessageScore
  );

  const keywordFactor = calculateKeywordScore(keywordCounts, config.keywordWeight);
  const totalScore = Math.min(1, participantFactor + messageFactor + keywordFactor);
  const importantKeywords = Array.from(keywordCounts.keys());

  return {
    score: totalScore,
    participantFactor,
    messageFactor,
    keywordFactor,
    importantKeywords,
  };
}

/**
 * Get urgency level based on score
 * @param score - Urgency score (0-1)
 * @returns Urgency level classification
 */
export function getUrgencyLevel(score: number): 'low' | 'medium' | 'high' | 'critical' {
  if (score >= 0.8) return 'critical';
  if (score >= 0.6) return 'high';
  if (score >= 0.3) return 'medium';
  return 'low';
}

/**
 * Get importance level based on score
 * @param score - Importance score (0-1)
 * @returns Importance level classification
 */
export function getImportanceLevel(score: number): 'low' | 'medium' | 'high' | 'critical' {
  if (score >= 0.8) return 'critical';
  if (score >= 0.6) return 'high';
  if (score >= 0.4) return 'medium';
  return 'low';
}

/**
 * Calculate combined priority score from urgency and importance
 * @param urgencyScore - Urgency score result
 * @param importanceScore - Importance score result
 * @param urgencyWeight - Weight for urgency (default 0.6)
 * @param importanceWeight - Weight for importance (default 0.4)
 * @returns Combined priority score (0-1)
 */
export function calculatePriorityScore(
  urgencyScore: UrgencyScore,
  importanceScore: ImportanceScore,
  urgencyWeight: number = 0.6,
  importanceWeight: number = 0.4
): number {
  return urgencyScore.score * urgencyWeight + importanceScore.score * importanceWeight;
}

/**
 * Get comprehensive analysis explanation
 * @param urgencyScore - Urgency score result
 * @param importanceScore - Importance score result
 * @returns Human-readable analysis explanation
 */
export function explainPriorityAnalysis(
  urgencyScore: UrgencyScore,
  importanceScore: ImportanceScore
): string {
  const urgencyLevel = getUrgencyLevel(urgencyScore.score);
  const importanceLevel = getImportanceLevel(importanceScore.score);
  const priorityScore = calculatePriorityScore(urgencyScore, importanceScore);

  let explanation = `Priority Analysis:\n`;
  explanation += `• Overall Priority: ${(priorityScore * 100).toFixed(1)}%\n`;
  explanation += `• Urgency: ${urgencyLevel} (${(urgencyScore.score * 100).toFixed(1)}%)\n`;
  explanation += `• Importance: ${importanceLevel} (${(importanceScore.score * 100).toFixed(1)}%)\n`;

  if (urgencyScore.urgentKeywords.length > 0) {
    explanation += `• Urgent keywords found: ${urgencyScore.urgentKeywords.join(', ')}\n`;
  }

  if (importanceScore.importantKeywords.length > 0) {
    explanation += `• Important keywords found: ${importanceScore.importantKeywords.join(', ')}\n`;
  }

  // Add new punctuation analysis information
  if (urgencyScore.punctuationInfo?.hasConsecutivePunctuation) {
    const punctInfo = urgencyScore.punctuationInfo;
    explanation += `• Emphasis detected: ${punctInfo.maxConsecutiveCount} consecutive punctuation (${punctInfo.punctuationTypes.join(', ')}) - `;
    explanation += `+${((urgencyScore.punctuationScore ?? 0) * 100).toFixed(1)}% urgency\n`;
  }

  // Add new time-based urgency information
  if (urgencyScore.timeUrgencyInfo?.hasTimeBasedUrgency) {
    const timeInfo = urgencyScore.timeUrgencyInfo;
    explanation += `• Time sensitivity: ${timeInfo.timeKeywords.join(', ')} - `;
    explanation += `+${((urgencyScore.timeBasedScore ?? 0) * 100).toFixed(1)}% urgency\n`;

    if (timeInfo.deadlineIndicators.length > 0) {
      explanation += `• Deadline indicators: ${timeInfo.deadlineIndicators.join(', ')}\n`;
    }
    if (timeInfo.meetingUrgency.length > 0) {
      explanation += `• Meeting urgency: ${timeInfo.meetingUrgency.join(', ')}\n`;
    }
  }

  explanation += `• Message activity factor: ${(urgencyScore.messageCountFactor * 100).toFixed(1)}%\n`;
  explanation += `• Participant factor: ${(importanceScore.participantFactor * 100).toFixed(1)}%`;

  return explanation;
}

/**
 * Check if thread meets urgency threshold
 * @param urgencyScore - Urgency score result
 * @param threshold - Minimum threshold (default 0.5)
 * @returns True if thread is considered urgent
 */
export function isThreadUrgent(urgencyScore: UrgencyScore, threshold: number = 0.5): boolean {
  return urgencyScore.score >= threshold;
}

/**
 * Check if thread meets importance threshold
 * @param importanceScore - Importance score result
 * @param threshold - Minimum threshold (default 0.4)
 * @returns True if thread is considered important
 */
export function isThreadImportant(
  importanceScore: ImportanceScore,
  threshold: number = 0.4
): boolean {
  return importanceScore.score >= threshold;
}

/**
 * Calculate thread priority classification
 * @param urgencyScore - Urgency score result
 * @param importanceScore - Importance score result
 * @returns Priority classification
 */
export function getThreadPriority(
  urgencyScore: UrgencyScore,
  importanceScore: ImportanceScore
): 'low' | 'normal' | 'high' | 'critical' {
  const isUrgent = isThreadUrgent(urgencyScore);
  const isImportant = isThreadImportant(importanceScore);
  const priorityScore = calculatePriorityScore(urgencyScore, importanceScore);

  if (priorityScore >= 0.8 || (isUrgent && isImportant)) return 'critical';
  if (priorityScore >= 0.6 || isUrgent || isImportant) return 'high';
  if (priorityScore >= 0.3) return 'normal';
  return 'low';
}
