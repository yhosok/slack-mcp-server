/**
 * Pure file analysis formatting functions
 * No side effects, fully testable and functional
 */

import type { FileAnalysis } from '../../types/index.js';
import type { FormattedResult, FileAnalysisFormatterOptions } from './types.js';
import { DEFAULT_FORMATTER_CONFIG } from './types.js';
import {
  createFormattedResult,
  createSectionHeader,
  createListItem,
  joinSections,
  formatBytes,
  formatNumber,
} from './general-formatters.js';

/**
 * Default file analysis formatting options
 */
export const DEFAULT_FILE_ANALYSIS_OPTIONS: FileAnalysisFormatterOptions = {
  ...DEFAULT_FORMATTER_CONFIG,
  includeTypeBreakdown: true,
  includeUserStats: true,
  includeLargeFiles: true,
  includeOldFiles: false,
  maxItems: 10,
} as const;

/**
 * Format file analysis into human-readable text
 * @param analysis - File analysis data
 * @param options - Formatting options
 * @returns Formatted file analysis result
 */
export function formatFileAnalysis(
  analysis: FileAnalysis,
  options: FileAnalysisFormatterOptions = DEFAULT_FILE_ANALYSIS_OPTIONS
): FormattedResult {
  const sections: string[] = [];

  // Header
  sections.push('File Analysis Report');

  // Overview section
  const overviewLines = [
    createListItem(`Total Files: ${formatNumber(analysis.total_files, 0)}`),
    createListItem(`Total Size: ${formatBytes(analysis.total_size_bytes)}`),
    createListItem(`Large Files (>10MB): ${analysis.large_files.length}`),
    createListItem(`Old Files (>90 days): ${analysis.old_files.length}`),
  ];
  sections.push(
    createSectionHeader('Overview', options.includeEmojis ? '📊' : '', options.includeEmojis) +
      overviewLines.join('\n')
  );

  // File type breakdown
  if (options.includeTypeBreakdown && Object.keys(analysis.by_type).length > 0) {
    const typeEntries = Object.entries(analysis.by_type)
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, options.maxItems);

    const typeLines = typeEntries.map(([type, stats]) =>
      createListItem(
        `${type}: ${formatNumber(stats.count, 0)} files (${formatBytes(stats.size_bytes)})`
      )
    );

    sections.push(
      createSectionHeader(
        'By File Type',
        options.includeEmojis ? '📁' : '',
        options.includeEmojis
      ) + typeLines.join('\n')
    );
  }

  // User statistics
  if (options.includeUserStats && Object.keys(analysis.by_user).length > 0) {
    const userEntries = Object.entries(analysis.by_user)
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, Math.min(5, options.maxItems));

    const userLines = userEntries.map(([user, stats]) =>
      createListItem(
        `${user}: ${formatNumber(stats.count, 0)} files (${formatBytes(stats.size_bytes)})`
      )
    );

    sections.push(
      createSectionHeader(
        'Top Uploaders',
        options.includeEmojis ? '👤' : '',
        options.includeEmojis
      ) + userLines.join('\n')
    );
  }

  // Large files
  if (options.includeLargeFiles && analysis.large_files.length > 0) {
    const largeFileLines = analysis.large_files
      .slice(0, Math.min(5, options.maxItems))
      .map((file) => createListItem(`${file.name}: ${formatBytes(file.size)}`));

    sections.push(
      createSectionHeader('Large Files', options.includeEmojis ? '🐘' : '', options.includeEmojis) +
        largeFileLines.join('\n')
    );
  }

  // Old files (if requested)
  if (options.includeOldFiles && analysis.old_files.length > 0) {
    const oldFileLines = analysis.old_files
      .slice(0, Math.min(5, options.maxItems))
      .map((file) => createListItem(`${file.name}: ${formatBytes(file.size)}`));

    sections.push(
      createSectionHeader('Old Files', options.includeEmojis ? '📜' : '', options.includeEmojis) +
        oldFileLines.join('\n')
    );
  }

  const content = joinSections(sections, 2);
  return createFormattedResult(content, options.includeEmojis);
}

/**
 * Create a condensed file analysis summary (one-line format)
 * @param analysis - File analysis data
 * @param maxLength - Maximum length of summary
 * @returns Condensed summary string
 */
export function createFileAnalysisSummary(analysis: FileAnalysis, maxLength: number = 100): string {
  const totalFiles = analysis.total_files;
  const totalSize = formatBytes(analysis.total_size_bytes);
  const largeFiles = analysis.large_files.length;
  const oldFiles = analysis.old_files.length;

  const summary = `${totalFiles} files, ${totalSize} | ${largeFiles} large, ${oldFiles} old`;

  return summary.length > maxLength ? summary.slice(0, maxLength - 3) + '...' : summary;
}

/**
 * Format file type distribution
 * @param byType - File type statistics
 * @param maxTypes - Maximum types to show
 * @param includePercentages - Whether to include percentages
 * @returns Formatted file type distribution
 */
export function formatFileTypeDistribution(
  byType: Record<string, { count: number; size_bytes: number }>,
  maxTypes: number = 10,
  includePercentages: boolean = true
): string {
  const totalFiles = Object.values(byType).reduce((sum, stats) => sum + stats.count, 0);
  const totalSize = Object.values(byType).reduce((sum, stats) => sum + stats.size_bytes, 0);

  if (totalFiles === 0) return 'No files';

  const typeEntries = Object.entries(byType)
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, maxTypes);

  const lines = typeEntries.map(([type, stats]) => {
    const countPercent = ((stats.count / totalFiles) * 100).toFixed(1);
    const sizePercent = ((stats.size_bytes / totalSize) * 100).toFixed(1);

    const baseText = `${type}: ${formatNumber(stats.count, 0)} files, ${formatBytes(stats.size_bytes)}`;

    if (includePercentages) {
      return createListItem(`${baseText} (${countPercent}% files, ${sizePercent}% size)`);
    } else {
      return createListItem(baseText);
    }
  });

  return lines.join('\n');
}

/**
 * Format user upload statistics
 * @param byUser - User upload statistics
 * @param maxUsers - Maximum users to show
 * @param includePercentages - Whether to include percentages
 * @returns Formatted user statistics
 */
export function formatUserUploadStats(
  byUser: Record<string, { count: number; size_bytes: number }>,
  maxUsers: number = 10,
  includePercentages: boolean = true
): string {
  const totalFiles = Object.values(byUser).reduce((sum, stats) => sum + stats.count, 0);
  const totalSize = Object.values(byUser).reduce((sum, stats) => sum + stats.size_bytes, 0);

  if (totalFiles === 0) return 'No uploads';

  const userEntries = Object.entries(byUser)
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, maxUsers);

  const lines = userEntries.map(([user, stats]) => {
    const countPercent = ((stats.count / totalFiles) * 100).toFixed(1);
    const sizePercent = ((stats.size_bytes / totalSize) * 100).toFixed(1);

    const baseText = `${user}: ${formatNumber(stats.count, 0)} files, ${formatBytes(stats.size_bytes)}`;

    if (includePercentages) {
      return createListItem(`${baseText} (${countPercent}% files, ${sizePercent}% size)`);
    } else {
      return createListItem(baseText);
    }
  });

  return lines.join('\n');
}

/**
 * Format channel file distribution
 * @param byChannel - Channel file statistics
 * @param maxChannels - Maximum channels to show
 * @returns Formatted channel distribution
 */
export function formatChannelFileDistribution(
  byChannel: Record<string, { count: number; size_bytes: number }>,
  maxChannels: number = 10
): string {
  if (Object.keys(byChannel).length === 0) return 'No channel data';

  const channelEntries = Object.entries(byChannel)
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, maxChannels);

  const lines = channelEntries.map(([channel, stats]) =>
    createListItem(
      `${channel}: ${formatNumber(stats.count, 0)} files (${formatBytes(stats.size_bytes)})`
    )
  );

  return lines.join('\n');
}

/**
 * Format file list with size and metadata
 * @param files - Array of files to format
 * @param maxFiles - Maximum files to show
 * @param includeTimestamps - Whether to include timestamps
 * @returns Formatted file list
 */
export function formatFileList(
  files: readonly { name: string; size: number; created?: number; user?: string }[],
  maxFiles: number = 10,
  includeTimestamps: boolean = false
): string {
  if (files.length === 0) return 'No files';

  const displayFiles = files.slice(0, maxFiles);
  const lines = displayFiles.map((file) => {
    let text = `${file.name}: ${formatBytes(file.size)}`;

    if (file.user) {
      text += ` (by ${file.user})`;
    }

    if (includeTimestamps && file.created) {
      const date = new Date(file.created * 1000).toLocaleDateString();
      text += ` [${date}]`;
    }

    return createListItem(text);
  });

  if (files.length > maxFiles) {
    lines.push(createListItem(`... and ${files.length - maxFiles} more files`));
  }

  return lines.join('\n');
}

/**
 * Calculate and format file size distribution
 * @param files - Array of files with sizes
 * @returns Formatted size distribution
 */
export function formatFileSizeDistribution(files: readonly { size: number }[]): string {
  if (files.length === 0) return 'No files';

  const sizeRanges = {
    'Small (< 1MB)': 0,
    'Medium (1MB - 10MB)': 0,
    'Large (10MB - 100MB)': 0,
    'Very Large (> 100MB)': 0,
  };

  for (const file of files) {
    const sizeMB = file.size / (1024 * 1024);

    if (sizeMB < 1) {
      sizeRanges['Small (< 1MB)']++;
    } else if (sizeMB < 10) {
      sizeRanges['Medium (1MB - 10MB)']++;
    } else if (sizeMB < 100) {
      sizeRanges['Large (10MB - 100MB)']++;
    } else {
      sizeRanges['Very Large (> 100MB)']++;
    }
  }

  const lines = Object.entries(sizeRanges)
    .filter(([, count]) => count > 0)
    .map(([range, count]) => {
      const percentage = ((count / files.length) * 100).toFixed(1);
      return createListItem(`${range}: ${formatNumber(count, 0)} files (${percentage}%)`);
    });

  return lines.length > 0 ? lines.join('\n') : 'No size distribution data';
}

/**
 * Format storage usage summary
 * @param analysis - File analysis data
 * @param includeProjections - Whether to include growth projections
 * @returns Formatted storage summary
 */
export function formatStorageUsageSummary(
  analysis: FileAnalysis,
  includeProjections: boolean = false
): string {
  const lines = [
    createListItem(`Total Storage: ${formatBytes(analysis.total_size_bytes)}`),
    createListItem(`Files: ${formatNumber(analysis.total_files, 0)}`),
    createListItem(
      `Average File Size: ${formatBytes(analysis.total_files > 0 ? analysis.total_size_bytes / analysis.total_files : 0)}`
    ),
  ];

  // Add top storage consumers
  const topTypes = Object.entries(analysis.by_type)
    .sort((a, b) => b[1].size_bytes - a[1].size_bytes)
    .slice(0, 3);

  if (topTypes.length > 0 && topTypes[0]) {
    lines.push(
      createListItem(`Largest Type: ${topTypes[0][0]} (${formatBytes(topTypes[0][1].size_bytes)})`)
    );
  }

  // Simple growth projection based on recent activity
  if (includeProjections && analysis.recent_activity && analysis.recent_activity.length > 0) {
    const recentGrowth = analysis.recent_activity.reduce((sum, day) => sum + day.size_bytes, 0);
    const avgDailyGrowth = recentGrowth / analysis.recent_activity.length;
    const monthlyProjection = avgDailyGrowth * 30;

    lines.push(createListItem(`Projected Monthly Growth: ${formatBytes(monthlyProjection)}`));
  }

  return lines.join('\n');
}
