/**
 * Pure action item extraction functions for thread analysis
 * No side effects, fully testable and functional
 */

import type { SlackMessage, ActionItem } from '../../types.js';
import type {
  ActionItemExtractionResult,
  PriorityAnalysisResult,
  StatusAnalysisResult,
  ActionItemConfig,
} from './types.js';

/**
 * Default action item extraction configuration
 */
export const DEFAULT_ACTION_ITEM_CONFIG: ActionItemConfig = {
  actionIndicators: [
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
  ] as const,
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
} as const;

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
 * Check if line contains action indicators
 * @param line - Text line to check
 * @param indicators - Array of action indicators
 * @returns True if line contains action indicators
 */
export function containsActionIndicators(line: string, indicators: readonly string[]): boolean {
  const lowerLine = line.toLowerCase();
  return indicators.some((indicator) => {
    const lowerIndicator = indicator.toLowerCase();

    // For Japanese, use simple includes; for English, prefer word boundaries
    const isJapanese = /[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]/.test(indicator);

    if (isJapanese) {
      return lowerLine.includes(lowerIndicator);
    } else {
      // Try word boundary first, fallback to includes for compound terms
      const wordBoundaryMatch = new RegExp(`\\b${lowerIndicator}\\b`).test(lowerLine);
      return wordBoundaryMatch || lowerLine.includes(lowerIndicator);
    }
  });
}

/**
 * Find action indicators present in text
 * @param text - Text to analyze
 * @param indicators - Array of action indicators
 * @returns Array of indicators found in text
 */
export function findActionIndicators(text: string, indicators: readonly string[]): string[] {
  const lowerText = text.toLowerCase();
  const found: string[] = [];

  for (const indicator of indicators) {
    const lowerIndicator = indicator.toLowerCase();
    const isJapanese = /[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]/.test(indicator);

    if (isJapanese) {
      if (lowerText.includes(lowerIndicator)) {
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
 * @returns Priority analysis result
 */
export function analyzePriority(
  text: string,
  config: ActionItemConfig['priorityKeywords']
): PriorityAnalysisResult {
  const lowerText = text.toLowerCase();
  const highKeywords = findActionIndicators(text, config.high);
  const mediumKeywords = findActionIndicators(text, config.medium);

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
 * @returns Status analysis result
 */
export function analyzeStatus(
  text: string,
  config: ActionItemConfig['statusKeywords']
): StatusAnalysisResult {
  const completedKeywords = findActionIndicators(text, config.completed);
  const inProgressKeywords = findActionIndicators(text, config.inProgress);

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
 * Extract action items from a single message
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

  for (const line of lines) {
    if (containsActionIndicators(line, config.actionIndicators)) {
      const mentions = extractMentions(line);
      const priorityAnalysis = analyzePriority(line, config.priorityKeywords);
      const statusAnalysis = analyzeStatus(line, config.statusKeywords);
      const cleanedText = cleanActionItemText(line);

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
      const foundInMessage = findActionIndicators(message.text, config.actionIndicators);
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
