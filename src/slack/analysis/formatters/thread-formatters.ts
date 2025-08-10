/**
 * Pure thread formatting functions  
 * No side effects, fully testable and functional
 */

import type { 
  ThreadAnalysis, 
  ThreadSummary, 
  ThreadMetrics 
} from '../../types.js';
import type { 
  FormattedResult,
  ThreadAnalysisFormatterOptions,
  ThreadSummaryFormatterOptions,
  ThreadMetricsFormatterOptions
} from './types.js';
import { DEFAULT_FORMATTER_CONFIG } from './types.js';
import {
  createFormattedResult,
  createSectionHeader,
  createListItem,
  joinSections,
  formatPercentage,
  formatCount,
  formatNumber
} from './general-formatters.js';

/**
 * Default thread analysis formatting options
 */
export const DEFAULT_THREAD_ANALYSIS_OPTIONS: ThreadAnalysisFormatterOptions = {
  ...DEFAULT_FORMATTER_CONFIG,
  includeSummary: true,
  includeParticipants: true,
  includeTimeline: false,
  includeActionItems: true,
  includeTopics: true
} as const;

/**
 * Default thread summary formatting options
 */
export const DEFAULT_THREAD_SUMMARY_OPTIONS: ThreadSummaryFormatterOptions = {
  ...DEFAULT_FORMATTER_CONFIG,
  includeDetails: true,
  includeKeyPoints: true,
  includeActionItems: true,
  includeDecisions: true
} as const;

/**
 * Default thread metrics formatting options
 */
export const DEFAULT_THREAD_METRICS_OPTIONS: ThreadMetricsFormatterOptions = {
  ...DEFAULT_FORMATTER_CONFIG,
  includeAverages: true,
  includeBreakdown: true,
  includeComparisons: false
} as const;

/**
 * Format thread analysis into human-readable text
 * @param analysis - Thread analysis data
 * @param options - Formatting options
 * @returns Formatted thread analysis
 */
export function formatThreadAnalysis(
  analysis: ThreadAnalysis,
  options: ThreadAnalysisFormatterOptions = DEFAULT_THREAD_ANALYSIS_OPTIONS
): FormattedResult {
  const sections: string[] = [];
  
  // Header
  sections.push(`Thread Analysis: ${analysis.thread_ts}`);
  
  // Overview section
  const overviewLines = [
    createListItem(`Participants: ${analysis.participants.length}`),
    createListItem(`Messages: ${analysis.timeline.length}`),
    createListItem(`Duration: ${(analysis.duration_hours).toFixed(options.precision)} hours`),
    createListItem(`Word Count: ${formatNumber(analysis.word_count, 0)}`)
  ];
  sections.push(
    createSectionHeader('Overview', options.includeEmojis ? '📊' : '', options.includeEmojis) + 
    overviewLines.join('\n')
  );
  
  // Scores section
  const scoresLines = [
    createListItem(`Importance: ${formatPercentage(analysis.importance_score, options.precision)}`),
    createListItem(`Urgency: ${formatPercentage(analysis.urgency_score, options.precision)}`),
    createListItem(`Sentiment: ${analysis.sentiment}`)
  ];
  sections.push(
    createSectionHeader('Scores', options.includeEmojis ? '🎯' : '', options.includeEmojis) + 
    scoresLines.join('\n')
  );
  
  // Key Topics
  if (options.includeTopics && analysis.key_topics.length > 0) {
    const topicsText = analysis.key_topics.join(', ');
    sections.push(
      createSectionHeader('Key Topics', options.includeEmojis ? '🔑' : '', options.includeEmojis) + 
      topicsText
    );
  }
  
  // Summary
  if (options.includeSummary && analysis.summary) {
    sections.push(
      createSectionHeader('Summary', options.includeEmojis ? '📝' : '', options.includeEmojis) + 
      analysis.summary
    );
  }
  
  // Action Items
  if (options.includeActionItems) {
    sections.push(
      createSectionHeader('Action Items', options.includeEmojis ? '✅' : '', options.includeEmojis) + 
      formatCount(analysis.action_items.length, 'item')
    );
  }
  
  const content = joinSections(sections, 2);
  return createFormattedResult(content, options.includeEmojis);
}

/**
 * Format thread summary into human-readable text
 * @param summary - Thread summary data
 * @param options - Formatting options  
 * @returns Formatted thread summary
 */
export function formatThreadSummary(
  summary: ThreadSummary,
  options: ThreadSummaryFormatterOptions = DEFAULT_THREAD_SUMMARY_OPTIONS
): FormattedResult {
  const sections: string[] = [];
  
  // Header
  sections.push(`Thread Summary: ${summary.title}`);
  
  // Details section
  if (options.includeDetails) {
    const detailsLines = [
      createListItem(`Status: ${summary.status}`),
      createListItem(`Participants: ${summary.participants.length}`),
      createListItem(`Messages: ${summary.message_count}`),
      createListItem(`Duration: ${summary.duration}`)
    ];
    sections.push(
      createSectionHeader('Details', options.includeEmojis ? '📋' : '', options.includeEmojis) + 
      detailsLines.join('\n')
    );
  }
  
  // Summary
  if (summary.brief_summary) {
    sections.push(
      createSectionHeader('Summary', options.includeEmojis ? '💬' : '', options.includeEmojis) + 
      summary.brief_summary
    );
  }
  
  // Key Points
  if (options.includeKeyPoints && summary.key_points.length > 0) {
    const keyPointsLines = summary.key_points.map(point => createListItem(point));
    sections.push(
      createSectionHeader('Key Points', options.includeEmojis ? '🎯' : '', options.includeEmojis) + 
      keyPointsLines.join('\n')
    );
  }
  
  // Action Items
  if (options.includeActionItems) {
    sections.push(
      createSectionHeader('Action Items', options.includeEmojis ? '✅' : '', options.includeEmojis) + 
      formatCount(summary.action_items.length, 'item')
    );
  }
  
  // Decisions
  if (options.includeDecisions) {
    sections.push(
      createSectionHeader('Decisions', options.includeEmojis ? '📋' : '', options.includeEmojis) + 
      formatCount(summary.decisions_made.length, 'decision')
    );
  }
  
  const content = joinSections(sections, 2);
  return createFormattedResult(content, options.includeEmojis);
}

/**
 * Format thread metrics into human-readable text
 * @param metrics - Thread metrics data
 * @param options - Formatting options
 * @returns Formatted thread metrics
 */
export function formatThreadMetrics(
  metrics: ThreadMetrics,
  options: ThreadMetricsFormatterOptions = DEFAULT_THREAD_METRICS_OPTIONS
): FormattedResult {
  const sections: string[] = [];
  
  // Header
  sections.push('Thread Metrics');
  
  // Overview section
  const overviewLines = [
    createListItem(`Total Threads: ${formatNumber(metrics.total_threads, 0)}`),
    createListItem(`Active: ${formatNumber(metrics.active_threads, 0)}`),
    createListItem(`Resolved: ${formatNumber(metrics.resolved_threads, 0)}`),
    createListItem(`Stale: ${formatNumber(metrics.stale_threads, 0)}`)
  ];
  sections.push(
    createSectionHeader('Overview', options.includeEmojis ? '📊' : '', options.includeEmojis) + 
    overviewLines.join('\n')
  );
  
  // Averages section
  if (options.includeAverages) {
    const averagesLines = [
      createListItem(`Messages per thread: ${formatNumber(metrics.avg_messages_per_thread, options.precision)}`),
      createListItem(`Participants per thread: ${formatNumber(metrics.avg_participants_per_thread, options.precision)}`),
      createListItem(`Duration: ${formatNumber(metrics.avg_duration_hours, options.precision)} hours`)
    ];
    sections.push(
      createSectionHeader('Averages', options.includeEmojis ? '📈' : '', options.includeEmojis) + 
      averagesLines.join('\n')
    );
  }
  
  // Top participants breakdown
  if (options.includeBreakdown && metrics.top_participants.length > 0) {
    const participantLines = metrics.top_participants
      .slice(0, 5)
      .map(p => createListItem(`${p.user_id}: ${p.thread_count} threads`));
    sections.push(
      createSectionHeader('Top Participants', options.includeEmojis ? '👥' : '', options.includeEmojis) + 
      participantLines.join('\n')
    );
  }
  
  // Busiest channels breakdown
  if (options.includeBreakdown && metrics.busiest_channels.length > 0) {
    const channelLines = metrics.busiest_channels
      .slice(0, 5)
      .map(c => createListItem(`${c.channel_id}: ${c.thread_count} threads`));
    sections.push(
      createSectionHeader('Busiest Channels', options.includeEmojis ? '📍' : '', options.includeEmojis) + 
      channelLines.join('\n')
    );
  }
  
  const content = joinSections(sections, 2);
  return createFormattedResult(content, options.includeEmojis);
}

/**
 * Create a condensed thread analysis summary (one-line format)
 * @param analysis - Thread analysis data
 * @param maxLength - Maximum length of summary
 * @returns Condensed summary string
 */
export function createThreadAnalysisSummary(
  analysis: ThreadAnalysis,
  maxLength: number = 100
): string {
  const participants = analysis.participants.length;
  const messages = analysis.timeline.length;
  const hours = analysis.duration_hours.toFixed(1);
  const importance = Math.round(analysis.importance_score * 100);
  const urgency = Math.round(analysis.urgency_score * 100);
  
  const summary = `${participants}p, ${messages}m, ${hours}h | I:${importance}% U:${urgency}% | ${analysis.sentiment} | ${analysis.action_items.length} actions`;
  
  return summary.length > maxLength 
    ? summary.slice(0, maxLength - 3) + '...'
    : summary;
}

/**
 * Create a condensed thread summary (one-line format)
 * @param summary - Thread summary data
 * @param maxLength - Maximum length of summary
 * @returns Condensed summary string
 */
export function createThreadSummarySummary(
  summary: ThreadSummary,
  maxLength: number = 100
): string {
  const participants = summary.participants.length;
  const messages = summary.message_count;
  const status = summary.status;
  const actions = summary.action_items.length;
  const decisions = summary.decisions_made.length;
  
  const summaryText = `${participants}p, ${messages}m | ${status} | ${actions}a, ${decisions}d`;
  
  return summaryText.length > maxLength 
    ? summaryText.slice(0, maxLength - 3) + '...'
    : summaryText;
}

/**
 * Format thread participants list
 * @param participants - Array of thread participants
 * @param includeStats - Whether to include participation statistics
 * @param maxParticipants - Maximum participants to show
 * @returns Formatted participants string
 */
export function formatThreadParticipants(
  participants: readonly { user_id: string; username: string; message_count: number }[],
  includeStats: boolean = true,
  maxParticipants: number = 10
): string {
  if (participants.length === 0) return 'No participants';
  
  const displayParticipants = participants.slice(0, maxParticipants);
  const lines = displayParticipants.map(p => {
    const name = p.username || p.user_id;
    return includeStats 
      ? createListItem(`${name} (${p.message_count} messages)`)
      : createListItem(name);
  });
  
  if (participants.length > maxParticipants) {
    lines.push(createListItem(`... and ${participants.length - maxParticipants} more`));
  }
  
  return lines.join('\n');
}

/**
 * Format action items list with priority and status
 * @param actionItems - Array of action items
 * @param maxItems - Maximum items to show
 * @param groupByPriority - Whether to group by priority
 * @returns Formatted action items string
 */
export function formatActionItemsList(
  actionItems: readonly { text: string; priority: string; status: string }[],
  maxItems: number = 10,
  groupByPriority: boolean = false
): string {
  if (actionItems.length === 0) return 'No action items';
  
  if (groupByPriority) {
    const byPriority = {
      high: actionItems.filter(item => item.priority === 'high'),
      medium: actionItems.filter(item => item.priority === 'medium'),
      low: actionItems.filter(item => item.priority === 'low')
    };
    
    const sections: string[] = [];
    
    for (const [priority, items] of Object.entries(byPriority)) {
      if (items.length > 0) {
        const itemLines = items
          .slice(0, Math.ceil(maxItems / 3))
          .map(item => createListItem(`${item.text} (${item.status})`));
        sections.push(`${priority.toUpperCase()} Priority:\n${itemLines.join('\n')}`);
      }
    }
    
    return sections.join('\n\n');
  } else {
    const displayItems = actionItems.slice(0, maxItems);
    const lines = displayItems.map(item => 
      createListItem(`[${item.priority.toUpperCase()}] ${item.text} (${item.status})`)
    );
    
    if (actionItems.length > maxItems) {
      lines.push(createListItem(`... and ${actionItems.length - maxItems} more`));
    }
    
    return lines.join('\n');
  }
}