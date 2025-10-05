/**
 * Pure file analysis formatting functions
 * No side effects, fully testable and functional
 * Refactored to use shared formatter utilities to eliminate duplication
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
import { formatChannelDistribution } from '../shared/formatters/distribution-formatter.js';
import {
  formatFileList as formatFileListShared,
  formatStorageUsageSummary as formatStorageUsageSummaryShared,
  type FileInfo,
} from '../shared/formatters/statistical-formatter.js';

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

// Note: formatFileTypeDistribution and formatUserUploadStats are available from shared utilities
// Re-export for backward compatibility
export {
  formatFileTypeDistribution,
  formatUserUploadStats,
} from '../shared/formatters/distribution-formatter.js';

/**
 * Format channel file distribution (using shared formatter)
 * @param byChannel - Channel file statistics
 * @param maxChannels - Maximum channels to show
 * @returns Formatted channel distribution
 */
export function formatChannelFileDistribution(
  byChannel: Record<string, { count: number; size_bytes: number }>,
  maxChannels: number = 10
): string {
  return formatChannelDistribution(byChannel, maxChannels);
}

// Note: formatFileList is now imported from shared utilities
// Re-export for backward compatibility with adapted signature
export function formatFileList(
  files: readonly { name: string; size: number; created?: number; user?: string }[],
  maxFiles: number = 10,
  includeTimestamps: boolean = false
): string {
  return formatFileListShared(files as readonly FileInfo[], maxFiles, includeTimestamps);
}

// Note: formatFileSizeDistribution is available from shared utilities
// Re-export for backward compatibility
export { formatFileSizeDistribution } from '../shared/formatters/statistical-formatter.js';

// Note: formatStorageUsageSummary is now imported from shared utilities
// Re-export for backward compatibility with adapted signature
export function formatStorageUsageSummary(
  analysis: FileAnalysis,
  includeProjections: boolean = false
): string {
  return formatStorageUsageSummaryShared(analysis, includeProjections);
}
