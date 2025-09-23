/**
 * Pure action item extraction functions for thread analysis
 * No side effects, fully testable and functional
 */

import type { SlackMessage, ActionItem } from '../../types/index.js';
import type {
  ActionItemExtractionResult,
  PriorityAnalysisResult,
  StatusAnalysisResult,
  ActionItemConfig,
  BulletPointConfig,
  BulletPointInfo,
  RequestPatternInfo,
  LineScoreInfo,
} from './types.js';
import { normalizeConjugation } from '../shared/text-processing/japanese-text-processor.js';

/**
 * Default bullet point configuration
 */
export const DEFAULT_BULLET_POINT_CONFIG: BulletPointConfig = {
  japaneseBullets: ['・', '‐', '－', '●', '○', '□', '■'] as const,
  westernBullets: ['-', '*', '+', '>'] as const,
  numberedPatterns: [
    /^\d+[.)]/,     // 1. or 1)
    /^[①②③④⑤⑥⑦⑧⑨⑩]/,  // Japanese numbers
  ] as const,
  bulletPointWeight: 2.0,
} as const;

/**
 * Enhanced action indicators including Japanese request patterns
 */
export const ENHANCED_ACTION_INDICATORS = [
  // Original English indicators
  'todo',
  'action item',
  'need to',
  'should',
  'will',
  'task',
  'follow up',
  'next step',
  'assign',
  'assigned',
  'do',
  'implement',
  'fix',
  'update',
  'create',
  'add',
  'remove',
  'delete',
  'check',
  'verify',
  'test',
  'review',
  
  // Basic Japanese action words
  'やる',
  'する',
  'しなければ',
  'タスク',
  'やること',
  '対応',
  '作業',
  '実装',
  '修正',
  '確認',
  'レビュー',
  
  // Enhanced Japanese request patterns
  'お願いします',
  'ください',
  'していただけますか',
  'お願いいたします',
  '対応お願いします',
  '確認ください',
  'レビューお願いします',
  'チェックお願いします',
  '修正お願いします',
  'テストお願いします',
  '実装お願いします',
  '更新お願いします',
  '削除お願いします',
  '追加お願いします',
  '作成お願いします',
  'を担当してください',
  'の件でお願いします',
  'をお願いできますか',
  'していただきたく',
  'をしていただけると',
] as const;

/**
 * Default action item extraction configuration
 */
export const DEFAULT_ACTION_ITEM_CONFIG: ActionItemConfig = {
  actionIndicators: ENHANCED_ACTION_INDICATORS,
  priorityKeywords: {
    high: [
      'urgent',
      'critical',
      'immediately',
      'asap',
      'priority',
      'blocker',
      'blocking',
      'emergency',
      'now',
      'today',
      '緊急',
      '至急',
      '重要',
      'すぐ',
      '今すぐ',
    ] as const,
    medium: [
      'important',
      'soon',
      'this week',
      'by friday',
      'deadline',
      'schedule',
      'planned',
      '今週',
      '重要',
      '期限',
    ] as const,
  },
  statusKeywords: {
    completed: [
      'done',
      'completed',
      'finished',
      'resolved',
      'closed',
      'fixed',
      'solved',
      'complete',
      'ready',
      'delivered',
      '完了',
      '終了',
      '解決',
      '修正済み',
      '対応済み',
    ] as const,
    inProgress: [
      'working on',
      'in progress',
      'started',
      'began',
      'ongoing',
      'processing',
      'handling',
      'implementing',
      'developing',
      '作業中',
      '進行中',
      '実装中',
      '対応中',
      '開発中',
    ] as const,
  },
  bulletPointConfig: DEFAULT_BULLET_POINT_CONFIG,
  enableLineScoring: true,
  enableConjugationNormalization: true,
} as const;

/**
 * Detect bullet points in a line of text
 * @param line - Text line to analyze
 * @param config - Bullet point configuration
 * @returns Bullet point detection information
 */
export function detectBulletPoint(line: string, config: BulletPointConfig): BulletPointInfo {
  const trimmedLine = line.trim();
  
  // Check Japanese bullet points
  for (const bullet of config.japaneseBullets) {
    if (trimmedLine.startsWith(bullet)) {
      return {
        hasBulletPoint: true,
        bulletType: `japanese:${bullet}`,
        weight: config.bulletPointWeight,
      };
    }
  }
  
  // Check Western bullet points
  for (const bullet of config.westernBullets) {
    if (trimmedLine.startsWith(bullet + ' ')) {
      return {
        hasBulletPoint: true,
        bulletType: `western:${bullet}`,
        weight: config.bulletPointWeight,
      };
    }
  }
  
  // Check numbered patterns
  for (const pattern of config.numberedPatterns) {
    if (pattern.test(trimmedLine)) {
      return {
        hasBulletPoint: true,
        bulletType: 'numbered',
        weight: config.bulletPointWeight,
      };
    }
  }
  
  return {
    hasBulletPoint: false,
    bulletType: '',
    weight: 0,
  };
}

/**
 * Detect Japanese request patterns in text
 * @param line - Text line to analyze
 * @returns Request pattern detection information
 */
export function detectJapaneseRequests(line: string): RequestPatternInfo {
  const lowerLine = line.toLowerCase();
  const foundPatterns: string[] = [];
  
  // Define Japanese request patterns with weights
  const requestPatterns = [
    // Polite requests
    { pattern: 'お願いします', weight: 1.5 },
    { pattern: 'ください', weight: 1.5 },
    { pattern: 'していただけますか', weight: 1.5 },
    { pattern: 'お願いいたします', weight: 1.5 },
    { pattern: 'していただきたく', weight: 1.5 },
    { pattern: 'をしていただけると', weight: 1.5 },
    { pattern: 'をお願いできますか', weight: 1.5 },
    
    // Specific action requests
    { pattern: '対応お願いします', weight: 1.8 },
    { pattern: '確認ください', weight: 1.8 },
    { pattern: 'レビューお願いします', weight: 1.8 },
    { pattern: 'チェックお願いします', weight: 1.8 },
    { pattern: '修正お願いします', weight: 1.8 },
    { pattern: 'テストお願いします', weight: 1.8 },
    { pattern: '実装お願いします', weight: 1.8 },
    { pattern: '更新お願いします', weight: 1.8 },
    { pattern: '削除お願いします', weight: 1.8 },
    { pattern: '追加お願いします', weight: 1.8 },
    { pattern: '作成お願いします', weight: 1.8 },
    
    // Task assignments
    { pattern: 'を担当してください', weight: 1.8 },
    { pattern: 'の件でお願いします', weight: 1.8 },
  ];
  
  let maxWeight = 0;
  for (const { pattern, weight } of requestPatterns) {
    if (lowerLine.includes(pattern.toLowerCase())) {
      foundPatterns.push(pattern);
      maxWeight = Math.max(maxWeight, weight);
    }
  }
  
  return {
    hasRequestPattern: foundPatterns.length > 0,
    patterns: foundPatterns,
    weight: maxWeight,
  };
}

/**
 * Score a line for action item likelihood using multiple factors
 * @param line - Text line to score
 * @param config - Action item configuration
 * @returns Line scoring information
 */
export function scoreActionLine(line: string, config: ActionItemConfig): LineScoreInfo {
  let score = 1.0; // Base score
  
  // Bullet point detection
  const bulletPointInfo = config.bulletPointConfig 
    ? detectBulletPoint(line, config.bulletPointConfig)
    : { hasBulletPoint: false, bulletType: '', weight: 0 };
    
  if (bulletPointInfo.hasBulletPoint) {
    score += bulletPointInfo.weight;
  }
  
  // Japanese request pattern detection
  const requestPatternInfo = detectJapaneseRequests(line);
  if (requestPatternInfo.hasRequestPattern) {
    score += requestPatternInfo.weight;
  }
  
  // User mention detection
  const mentions = extractMentions(line);
  const hasMentions = mentions.length > 0;
  if (hasMentions) {
    score += 1.2;
  }
  
  // Urgency keyword detection
  const urgencyKeywords = findActionIndicators(line, config.priorityKeywords.high);
  const hasUrgencyKeywords = urgencyKeywords.length > 0;
  if (hasUrgencyKeywords) {
    score += 1.8;
  }
  
  return {
    score,
    bulletPointInfo,
    requestPatternInfo,
    hasMentions,
    hasUrgencyKeywords,
    urgencyKeywords,
  };
}

/**
 * Apply conjugation normalization to action indicators if enabled
 * @param text - Text to normalize
 * @param config - Action item configuration
 * @returns Normalized text
 */
export function normalizeActionText(text: string, config: ActionItemConfig): string {
  if (!config.enableConjugationNormalization) {
    return text;
  }
  
  // Split into words and normalize Japanese words
  const words = text.split(/\s+/);
  const normalizedWords = words.map(word => {
    // Only normalize Japanese words
    if (/[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]/.test(word)) {
      return normalizeConjugation(word);
    }
    return word;
  });
  
  return normalizedWords.join(' ');
}

/**
 * Extract mentions from text (Slack user mentions)
 * @param text - Text to extract mentions from
 * @returns Array of user IDs mentioned
 */
export function extractMentions(text: string): string[] {
  const mentionPattern = /<@(\w+)>/g;
  const mentions: string[] = [];
  let match;

  while ((match = mentionPattern.exec(text)) !== null) {
    if (match[1]) {
      mentions.push(match[1]);
    }
  }

  return mentions;
}

/**
 * Check if line contains action indicators with optional conjugation normalization
 * @param line - Text line to check
 * @param indicators - Array of action indicators
 * @param enableNormalization - Whether to apply conjugation normalization
 * @returns True if line contains action indicators
 */
export function containsActionIndicators(
  line: string, 
  indicators: readonly string[], 
  enableNormalization: boolean = false
): boolean {
  const lowerLine = line.toLowerCase();
  const normalizedLine = enableNormalization ? normalizeConjugation(lowerLine) : lowerLine;
  
  return indicators.some((indicator) => {
    const lowerIndicator = indicator.toLowerCase();
    const normalizedIndicator = enableNormalization ? normalizeConjugation(lowerIndicator) : lowerIndicator;

    // For Japanese, use simple includes; for English, prefer word boundaries
    const isJapanese = /[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]/.test(indicator);

    if (isJapanese) {
      // Check both original and normalized forms
      return normalizedLine.includes(normalizedIndicator) || lowerLine.includes(lowerIndicator);
    } else {
      // Try word boundary first, fallback to includes for compound terms
      const wordBoundaryMatch = new RegExp(`\\b${lowerIndicator}\\b`).test(lowerLine);
      return wordBoundaryMatch || lowerLine.includes(lowerIndicator);
    }
  });
}

/**
 * Find action indicators present in text with optional conjugation normalization
 * @param text - Text to analyze
 * @param indicators - Array of action indicators
 * @param enableNormalization - Whether to apply conjugation normalization
 * @returns Array of indicators found in text
 */
export function findActionIndicators(
  text: string, 
  indicators: readonly string[], 
  enableNormalization: boolean = false
): string[] {
  const lowerText = text.toLowerCase();
  const normalizedText = enableNormalization ? normalizeConjugation(lowerText) : lowerText;
  const found: string[] = [];

  for (const indicator of indicators) {
    const lowerIndicator = indicator.toLowerCase();
    const normalizedIndicator = enableNormalization ? normalizeConjugation(lowerIndicator) : lowerIndicator;
    const isJapanese = /[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]/.test(indicator);

    if (isJapanese) {
      // Check both original and normalized forms
      if (normalizedText.includes(normalizedIndicator) || lowerText.includes(lowerIndicator)) {
        found.push(indicator);
      }
    } else {
      const wordBoundaryMatch = new RegExp(`\\b${lowerIndicator}\\b`).test(lowerText);
      if (wordBoundaryMatch || lowerText.includes(lowerIndicator)) {
        found.push(indicator);
      }
    }
  }

  return found;
}

/**
 * Determine priority level from text content
 * @param text - Text to analyze for priority keywords
 * @param config - Configuration for priority keywords
 * @param enableNormalization - Whether to apply conjugation normalization
 * @returns Priority analysis result
 */
export function analyzePriority(
  text: string,
  config: ActionItemConfig['priorityKeywords'],
  enableNormalization: boolean = false
): PriorityAnalysisResult {
  const highKeywords = findActionIndicators(text, config.high, enableNormalization);
  const mediumKeywords = findActionIndicators(text, config.medium, enableNormalization);

  let priority: 'low' | 'medium' | 'high' = 'low';
  let priorityLevel = 0;
  const keywordsFound: string[] = [];

  if (highKeywords.length > 0) {
    priority = 'high';
    priorityLevel = 3;
    keywordsFound.push(...highKeywords);
  } else if (mediumKeywords.length > 0) {
    priority = 'medium';
    priorityLevel = 2;
    keywordsFound.push(...mediumKeywords);
  } else {
    priority = 'low';
    priorityLevel = 1;
  }

  return {
    priority,
    keywordsFound,
    priorityLevel,
  };
}

/**
 * Determine status from text content
 * @param text - Text to analyze for status keywords
 * @param config - Configuration for status keywords
 * @param enableNormalization - Whether to apply conjugation normalization
 * @returns Status analysis result
 */
export function analyzeStatus(
  text: string,
  config: ActionItemConfig['statusKeywords'],
  enableNormalization: boolean = false
): StatusAnalysisResult {
  const completedKeywords = findActionIndicators(text, config.completed, enableNormalization);
  const inProgressKeywords = findActionIndicators(text, config.inProgress, enableNormalization);

  let status: 'open' | 'in_progress' | 'completed' = 'open';
  let confidence = 0.5; // Default confidence for open status
  const keywordsFound: string[] = [];

  if (completedKeywords.length > 0) {
    status = 'completed';
    confidence = Math.min(1.0, 0.7 + completedKeywords.length * 0.1);
    keywordsFound.push(...completedKeywords);
  } else if (inProgressKeywords.length > 0) {
    status = 'in_progress';
    confidence = Math.min(1.0, 0.6 + inProgressKeywords.length * 0.1);
    keywordsFound.push(...inProgressKeywords);
  }

  return {
    status,
    keywordsFound,
    confidence,
  };
}

/**
 * Clean and normalize action item text
 * @param text - Raw action item text
 * @returns Cleaned and normalized text
 */
export function cleanActionItemText(text: string): string {
  return text
    .trim()
    .replace(/\s+/g, ' ') // Normalize whitespace
    .replace(/^[-•*]\s*/, '') // Remove list markers
    .replace(/^\d+\.\s*/, '') // Remove numbered list markers
    .slice(0, 500); // Limit length to prevent very long action items
}

/**
 * Extract action items from a single message with enhanced capabilities
 * @param message - Slack message to analyze
 * @param config - Configuration for action item extraction
 * @returns Array of action items found in the message
 */
export function extractActionItemsFromMessage(
  message: SlackMessage,
  config: ActionItemConfig
): ActionItem[] {
  if (!message.text) return [];

  const lines = message.text
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line);
  const actionItems: ActionItem[] = [];
  const enableNormalization = config.enableConjugationNormalization !== false;

  // Process lines with scoring if enabled
  const lineScores: Array<{ line: string; scoreInfo: LineScoreInfo }> = [];
  
  if (config.enableLineScoring) {
    for (const line of lines) {
      const scoreInfo = scoreActionLine(line, config);
      lineScores.push({ line, scoreInfo });
    }
    
    // Sort by score in descending order to prioritize high-scoring lines
    lineScores.sort((a, b) => b.scoreInfo.score - a.scoreInfo.score);
  }

  // Process lines in score order if scoring is enabled, otherwise process in original order
  const processOrder = config.enableLineScoring ? lineScores.map(ls => ls.line) : lines;

  for (const line of processOrder) {
    // Enhanced action indicator detection with normalization
    if (containsActionIndicators(line, config.actionIndicators, enableNormalization)) {
      const mentions = extractMentions(line);
      const priorityAnalysis = analyzePriority(line, config.priorityKeywords, enableNormalization);
      const statusAnalysis = analyzeStatus(line, config.statusKeywords, enableNormalization);
      
      // Apply conjugation normalization to the cleaned text if enabled
      let cleanedText = cleanActionItemText(line);
      if (enableNormalization) {
        cleanedText = normalizeActionText(cleanedText, config);
      }

      if (cleanedText.length > 5) {
        // Minimum meaningful length
        actionItems.push({
          text: cleanedText,
          mentioned_users: mentions,
          priority: priorityAnalysis.priority,
          status: statusAnalysis.status,
          extracted_from_message_ts: message.ts || '',
        });
      }
    }
  }

  return actionItems;
}

/**
 * Extract action items from multiple messages
 * @param messages - Array of Slack messages
 * @param config - Configuration for action item extraction
 * @returns Action item extraction result
 */
export function extractActionItemsFromMessages(
  messages: readonly SlackMessage[],
  config: ActionItemConfig = DEFAULT_ACTION_ITEM_CONFIG
): ActionItemExtractionResult {
  const allActionItems: ActionItem[] = [];
  const indicatorsFound = new Set<string>();

  for (const message of messages) {
    const messageActionItems = extractActionItemsFromMessage(message, config);
    allActionItems.push(...messageActionItems);

    // Track which indicators were found
    if (message.text) {
      const enableNormalization = config.enableConjugationNormalization !== false;
      const foundInMessage = findActionIndicators(message.text, config.actionIndicators, enableNormalization);
      foundInMessage.forEach((indicator) => indicatorsFound.add(indicator));
    }
  }

  return {
    actionItems: allActionItems,
    totalActionIndicators: indicatorsFound.size,
    actionIndicatorsFound: Array.from(indicatorsFound),
  };
}

/**
 * Group action items by priority level
 * @param actionItems - Array of action items
 * @returns Action items grouped by priority
 */
export function groupActionItemsByPriority(actionItems: readonly ActionItem[]): {
  high: ActionItem[];
  medium: ActionItem[];
  low: ActionItem[];
} {
  return {
    high: actionItems.filter((item) => item.priority === 'high'),
    medium: actionItems.filter((item) => item.priority === 'medium'),
    low: actionItems.filter((item) => item.priority === 'low'),
  };
}

/**
 * Group action items by status
 * @param actionItems - Array of action items
 * @returns Action items grouped by status
 */
export function groupActionItemsByStatus(actionItems: readonly ActionItem[]): {
  open: ActionItem[];
  in_progress: ActionItem[];
  completed: ActionItem[];
} {
  return {
    open: actionItems.filter((item) => item.status === 'open'),
    in_progress: actionItems.filter((item) => item.status === 'in_progress'),
    completed: actionItems.filter((item) => item.status === 'completed'),
  };
}

/**
 * Get action items assigned to specific users
 * @param actionItems - Array of action items
 * @param userIds - Array of user IDs to filter by
 * @returns Action items assigned to specified users
 */
export function getActionItemsForUsers(
  actionItems: readonly ActionItem[],
  userIds: readonly string[]
): ActionItem[] {
  return actionItems.filter((item) =>
    item.mentioned_users.some((userId) => userIds.includes(userId))
  );
}

/**
 * Get action item statistics
 * @param actionItems - Array of action items
 * @returns Statistics about action items
 */
export function getActionItemStatistics(actionItems: readonly ActionItem[]): {
  total: number;
  byPriority: { high: number; medium: number; low: number };
  byStatus: { open: number; in_progress: number; completed: number };
  assignedCount: number;
  unassignedCount: number;
  completionRate: number;
} {
  const priorityGroups = groupActionItemsByPriority(actionItems);
  const statusGroups = groupActionItemsByStatus(actionItems);

  const assignedCount = actionItems.filter((item) => item.mentioned_users.length > 0).length;
  const unassignedCount = actionItems.length - assignedCount;
  const completionRate =
    actionItems.length > 0 ? statusGroups.completed.length / actionItems.length : 0;

  return {
    total: actionItems.length,
    byPriority: {
      high: priorityGroups.high.length,
      medium: priorityGroups.medium.length,
      low: priorityGroups.low.length,
    },
    byStatus: {
      open: statusGroups.open.length,
      in_progress: statusGroups.in_progress.length,
      completed: statusGroups.completed.length,
    },
    assignedCount,
    unassignedCount,
    completionRate,
  };
}

/**
 * Filter action items by minimum priority level
 * @param actionItems - Array of action items
 * @param minPriority - Minimum priority ('low', 'medium', 'high')
 * @returns Filtered action items
 */
export function filterActionItemsByPriority(
  actionItems: readonly ActionItem[],
  minPriority: 'low' | 'medium' | 'high'
): ActionItem[] {
  const priorityOrder = { low: 1, medium: 2, high: 3 };
  const minLevel = priorityOrder[minPriority];

  return actionItems.filter((item) => priorityOrder[item.priority] >= minLevel);
}

/**
 * Get action items that are incomplete (open or in progress)
 * @param actionItems - Array of action items
 * @returns Incomplete action items
 */
export function getIncompleteActionItems(actionItems: readonly ActionItem[]): ActionItem[] {
  return actionItems.filter((item) => item.status !== 'completed');
}

/**
 * Generate action item summary text
 * @param extraction - Action item extraction result
 * @returns Summary text
 */
export function generateActionItemSummary(extraction: ActionItemExtractionResult): string {
  const stats = getActionItemStatistics(extraction.actionItems);

  return `Action Items Summary:
• Total: ${stats.total}
• Priority Distribution: ${stats.byPriority.high} high, ${stats.byPriority.medium} medium, ${stats.byPriority.low} low
• Status: ${stats.byStatus.open} open, ${stats.byStatus.in_progress} in progress, ${stats.byStatus.completed} completed
• Assignment: ${stats.assignedCount} assigned, ${stats.unassignedCount} unassigned
• Completion Rate: ${(stats.completionRate * 100).toFixed(1)}%
• Action Indicators Found: ${extraction.actionIndicatorsFound.join(', ')}`;
}
