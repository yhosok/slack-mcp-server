/**
 * Pure statistical formatting utilities
 * Shared utilities for statistical display patterns across analysis functions
 * No side effects, fully testable and functional
 */

import { createListItem, formatBytes, formatNumber } from '../../formatters/general-formatters.js';

/**
 * File information interface for statistical formatting
 */
export interface FileInfo {
  name: string;
  size: number;
  created?: number;
  user?: string;
}

/**
 * Size range statistics
 */
export interface SizeRangeStats {
  range: string;
  count: number;
  percentage: number;
}

/**
 * Format file list with size and metadata
 * Centralized implementation for consistent file list formatting
 * @param files - Array of files to format
 * @param maxFiles - Maximum files to show
 * @param includeTimestamps - Whether to include timestamps
 * @returns Formatted file list
 */
export function formatFileList(
  files: readonly FileInfo[],
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
 * Standardized size ranges for consistent analysis
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
 * Get size range statistics for detailed analysis
 * @param files - Array of files with sizes
 * @returns Array of size range statistics
 */
export function getSizeRangeStats(files: readonly { size: number }[]): SizeRangeStats[] {
  if (files.length === 0) return [];

  const ranges = [
    { min: 0, max: 1, label: 'Small (< 1MB)' },
    { min: 1, max: 10, label: 'Medium (1MB - 10MB)' },
    { min: 10, max: 100, label: 'Large (10MB - 100MB)' },
    { min: 100, max: Infinity, label: 'Very Large (> 100MB)' },
  ];

  const stats = ranges.map((range) => {
    const count = files.filter((file) => {
      const sizeMB = file.size / (1024 * 1024);
      return sizeMB >= range.min && sizeMB < range.max;
    }).length;

    return {
      range: range.label,
      count,
      percentage: (count / files.length) * 100,
    };
  });

  return stats.filter((stat) => stat.count > 0);
}

/**
 * Format storage usage summary with projections
 * Centralized storage analysis formatting
 * @param analysis - Analysis data with storage information
 * @param includeProjections - Whether to include growth projections
 * @returns Formatted storage summary
 */
export function formatStorageUsageSummary(
  analysis: {
    total_size_bytes: number;
    total_files: number;
    by_type?: Record<string, { size_bytes: number; count: number }>;
    recent_activity?: Array<{ size_bytes: number; date: string }>;
  },
  includeProjections: boolean = false
): string {
  const lines = [
    createListItem(`Total Storage: ${formatBytes(analysis.total_size_bytes)}`),
    createListItem(`Files: ${formatNumber(analysis.total_files, 0)}`),
    createListItem(
      `Average File Size: ${formatBytes(
        analysis.total_files > 0 ? analysis.total_size_bytes / analysis.total_files : 0
      )}`
    ),
  ];

  // Add top storage consumers
  if (analysis.by_type) {
    const topTypes = Object.entries(analysis.by_type)
      .sort((a, b) => b[1].size_bytes - a[1].size_bytes)
      .slice(0, 3);

    if (topTypes.length > 0 && topTypes[0]) {
      lines.push(
        createListItem(`Largest Type: ${topTypes[0][0]} (${formatBytes(topTypes[0][1].size_bytes)})`)
      );
    }
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

/**
 * Calculate and format data quality metrics
 * @param data - Array of data items to analyze
 * @param validators - Object with validation functions
 * @returns Formatted quality metrics
 */
export function formatDataQualityMetrics<T>(
  data: readonly T[],
  validators: Record<string, (item: T) => boolean>
): string {
  if (data.length === 0) return 'No data to analyze';

  const metrics = Object.entries(validators).map(([name, validator]) => {
    const validCount = data.filter(validator).length;
    const percentage = ((validCount / data.length) * 100).toFixed(1);
    return createListItem(`${name}: ${validCount}/${data.length} (${percentage}%)`);
  });

  return metrics.join('\n');
}

/**
 * Format time-based statistics
 * @param timeData - Array of time-stamped data
 * @param timeGetter - Function to extract timestamp from data
 * @returns Formatted time statistics
 */
export function formatTimeStatistics<T>(
  timeData: readonly T[],
  timeGetter: (item: T) => number
): string {
  if (timeData.length === 0) return 'No time data';

  const timestamps = timeData.map(timeGetter).filter((ts) => ts > 0);
  if (timestamps.length === 0) return 'No valid timestamps';

  const oldest = Math.min(...timestamps);
  const newest = Math.max(...timestamps);
  const timeSpan = newest - oldest;

  const lines = [
    createListItem(`Time Span: ${Math.round(timeSpan / 86400)} days`),
    createListItem(`Oldest: ${new Date(oldest * 1000).toLocaleDateString()}`),
    createListItem(`Newest: ${new Date(newest * 1000).toLocaleDateString()}`),
    createListItem(`Items with Timestamps: ${timestamps.length}/${timeData.length}`),
  ];

  return lines.join('\n');
}

/**
 * Create a condensed summary (one-line format) for any analysis
 * @param data - Analysis data object
 * @param keyMetrics - Array of key metric functions
 * @param maxLength - Maximum length of summary
 * @returns Condensed summary string
 */
export function createAnalysisSummary(
  data: Record<string, unknown>,
  keyMetrics: Array<(data: Record<string, unknown>) => string>,
  maxLength: number = 100
): string {
  const metrics = keyMetrics.map((fn) => fn(data)).filter(Boolean);
  const summary = metrics.join(' | ');

  return summary.length > maxLength ? summary.slice(0, maxLength - 3) + '...' : summary;
}