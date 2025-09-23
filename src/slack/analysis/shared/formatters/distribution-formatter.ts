/**
 * Pure distribution formatting utilities
 * Extracted to eliminate 98% similarity between formatFileTypeDistribution and formatUserUploadStats
 * No side effects, fully testable and functional
 */

import { createListItem, formatBytes, formatNumber } from '../../formatters/general-formatters.js';

/**
 * Statistics for a distribution entry (file type, user, channel, etc.)
 */
export interface DistributionStats {
  count: number;
  size_bytes: number;
}

/**
 * Configuration for distribution formatting
 */
export interface DistributionFormatterConfig {
  maxItems: number;
  includePercentages: boolean;
  emptyMessage: string;
  sortBy: 'count' | 'size';
}

/**
 * Default distribution formatter configuration
 */
export const DEFAULT_DISTRIBUTION_CONFIG: DistributionFormatterConfig = {
  maxItems: 10,
  includePercentages: true,
  emptyMessage: 'No data',
  sortBy: 'count',
} as const;

/**
 * Generic function to format any distribution statistics
 * Eliminates duplication between file type and user upload statistics
 * @param distribution - Record of distribution statistics
 * @param config - Configuration for formatting
 * @returns Formatted distribution string
 */
export function formatDistributionStats(
  distribution: Record<string, DistributionStats>,
  config: DistributionFormatterConfig = DEFAULT_DISTRIBUTION_CONFIG
): string {
  const totalFiles = Object.values(distribution).reduce((sum, stats) => sum + stats.count, 0);
  const totalSize = Object.values(distribution).reduce((sum, stats) => sum + stats.size_bytes, 0);

  if (totalFiles === 0) return config.emptyMessage;

  // Sort by count or size as specified
  const sortFn = config.sortBy === 'size'
    ? (a: [string, DistributionStats], b: [string, DistributionStats]): number => b[1].size_bytes - a[1].size_bytes
    : (a: [string, DistributionStats], b: [string, DistributionStats]): number => b[1].count - a[1].count;

  const entries = Object.entries(distribution)
    .sort(sortFn)
    .slice(0, config.maxItems);

  const lines = entries.map(([key, stats]) => {
    const baseText = `${key}: ${formatNumber(stats.count, 0)} files, ${formatBytes(stats.size_bytes)}`;

    if (config.includePercentages) {
      const countPercent = ((stats.count / totalFiles) * 100).toFixed(1);
      const sizePercent = ((stats.size_bytes / totalSize) * 100).toFixed(1);
      return createListItem(`${baseText} (${countPercent}% files, ${sizePercent}% size)`);
    } else {
      return createListItem(baseText);
    }
  });

  return lines.join('\n');
}

/**
 * Format file type distribution (replaces original formatFileTypeDistribution)
 * @param byType - File type statistics
 * @param maxTypes - Maximum types to show
 * @param includePercentages - Whether to include percentages
 * @returns Formatted file type distribution
 */
export function formatFileTypeDistribution(
  byType: Record<string, DistributionStats>,
  maxTypes: number = 10,
  includePercentages: boolean = true
): string {
  return formatDistributionStats(byType, {
    maxItems: maxTypes,
    includePercentages,
    emptyMessage: 'No files',
    sortBy: 'count',
  });
}

/**
 * Format user upload statistics (replaces original formatUserUploadStats)
 * @param byUser - User upload statistics
 * @param maxUsers - Maximum users to show
 * @param includePercentages - Whether to include percentages
 * @returns Formatted user statistics
 */
export function formatUserUploadStats(
  byUser: Record<string, DistributionStats>,
  maxUsers: number = 10,
  includePercentages: boolean = true
): string {
  return formatDistributionStats(byUser, {
    maxItems: maxUsers,
    includePercentages,
    emptyMessage: 'No uploads',
    sortBy: 'count',
  });
}

/**
 * Format channel distribution statistics
 * @param byChannel - Channel statistics
 * @param maxChannels - Maximum channels to show
 * @param sortBy - Sort by 'count' or 'size'
 * @returns Formatted channel distribution
 */
export function formatChannelDistribution(
  byChannel: Record<string, DistributionStats>,
  maxChannels: number = 10,
  sortBy: 'count' | 'size' = 'count'
): string {
  return formatDistributionStats(byChannel, {
    maxItems: maxChannels,
    includePercentages: false,
    emptyMessage: 'No channel data',
    sortBy,
  });
}

/**
 * Format any generic distribution with custom labels
 * @param distribution - Distribution statistics
 * @param config - Configuration including custom labels
 * @returns Formatted distribution
 */
export function formatGenericDistribution(
  distribution: Record<string, DistributionStats>,
  config: DistributionFormatterConfig & {
    itemLabel?: string; // e.g., "types", "users", "channels"
    sizeLabel?: string; // e.g., "storage", "data", "content"
  }
): string {
  const _itemLabel = config.itemLabel || 'items';
  const baseConfig = {
    maxItems: config.maxItems,
    includePercentages: config.includePercentages,
    emptyMessage: config.emptyMessage,
    sortBy: config.sortBy,
  };

  return formatDistributionStats(distribution, baseConfig);
}

/**
 * Calculate distribution summary statistics
 * @param distribution - Distribution statistics
 * @returns Summary statistics
 */
export function getDistributionSummary(distribution: Record<string, DistributionStats>): {
  totalEntries: number;
  totalCount: number;
  totalSize: number;
  averageCount: number;
  averageSize: number;
  topEntry: { key: string; stats: DistributionStats } | null;
} {
  const entries = Object.entries(distribution);
  const totalEntries = entries.length;

  if (totalEntries === 0) {
    return {
      totalEntries: 0,
      totalCount: 0,
      totalSize: 0,
      averageCount: 0,
      averageSize: 0,
      topEntry: null,
    };
  }

  const totalCount = entries.reduce((sum, [, stats]) => sum + stats.count, 0);
  const totalSize = entries.reduce((sum, [, stats]) => sum + stats.size_bytes, 0);

  const topEntry = entries.reduce((max, current) =>
    current[1].count > max[1].count ? current : max
  );

  return {
    totalEntries,
    totalCount,
    totalSize,
    averageCount: totalCount / totalEntries,
    averageSize: totalSize / totalEntries,
    topEntry: { key: topEntry[0], stats: topEntry[1] },
  };
}