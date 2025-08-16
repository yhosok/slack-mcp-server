/**
 * Helper utility functions for Slack operations
 */

import type { MCPContent } from '../mcp/types.js';

/**
 * Format a Slack timestamp to a human-readable date string
 */
export function formatTimestamp(timestamp: string): string {
  const date = new Date(parseFloat(timestamp) * 1000);
  return date.toISOString();
}

/**
 * Check if a string is a valid Slack ID format
 */
export function isValidSlackId(id: string): boolean {
  // Slack IDs are typically 9-11 characters starting with a letter
  // Channel IDs start with C, User IDs with U, etc.
  return /^[A-Z][A-Z0-9]{8,10}$/.test(id);
}

/**
 * Parse a Slack mention to extract the user ID
 */
export function parseSlackMention(mention: string): string | null {
  // Slack mentions look like <@U1234567890> or <@U1234567890|username>
  const match = mention.match(/^<@([A-Z0-9]+)(?:\|[^>]+)?>$/);
  return match?.[1] ?? null;
}

/**
 * Parse a Slack channel mention to extract the channel ID
 */
export function parseSlackChannelMention(mention: string): string | null {
  // Slack channel mentions look like <#C1234567890> or <#C1234567890|channelname>
  const match = mention.match(/^<#([A-Z0-9]+)(?:\|[^>]+)?>$/);
  return match?.[1] ?? null;
}

/**
 * Convert a channel name to a channel ID format if needed
 */
export function normalizeChannelId(channel: string): string {
  // If it's already a proper ID, return as-is
  if (isValidSlackId(channel)) {
    return channel;
  }

  // If it's a channel mention, extract the ID
  const channelId = parseSlackChannelMention(channel);
  if (channelId) {
    return channelId;
  }

  // If it starts with #, remove it (we'll let Slack API handle the lookup)
  if (channel.startsWith('#')) {
    return channel.slice(1);
  }

  return channel;
}

/**
 * Convert a user mention to a user ID format if needed
 */
export function normalizeUserId(user: string): string {
  // If it's already a proper ID, return as-is
  if (isValidSlackId(user)) {
    return user;
  }

  // If it's a user mention, extract the ID
  const userId = parseSlackMention(user);
  if (userId) {
    return userId;
  }

  // If it starts with @, remove it (we'll let Slack API handle the lookup)
  if (user.startsWith('@')) {
    return user.slice(1);
  }

  return user;
}

/**
 * Truncate text to a maximum length with ellipsis
 */
export function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) {
    return text;
  }
  return text.slice(0, maxLength - 3) + '...';
}

/**
 * Escape special characters for Slack message formatting
 */
export function escapeSlackText(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/**
 * Create a Slack-formatted link
 */
export function createSlackLink(url: string, text?: string): string {
  if (text) {
    return `<${url}|${text}>`;
  }
  return `<${url}>`;
}

/**
 * Format a list of items for display in Slack
 */
export function formatSlackList(items: string[], bullet: string = '•'): string {
  return items.map((item) => `${bullet} ${item}`).join('\n');
}

/**
 * Convert seconds to human-readable duration
 */
export function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  if (hours > 0) {
    return `${hours}h ${minutes}m ${secs}s`;
  } else if (minutes > 0) {
    return `${minutes}m ${secs}s`;
  } else {
    return `${secs}s`;
  }
}

/**
 * Safely extract text content from MCPContent union type
 */
export function extractTextContent(content: MCPContent | undefined): string {
  if (content?.type === 'text') {
    return content.text;
  }
  return '';
}

/**
 * Parse JSON response from Context7-style services and extract data
 * Returns parsed object for success responses (statusCode: "10000")
 * Returns error object for error responses (statusCode: "10001")
 */
export function parseJsonResponse(content: MCPContent | undefined): {
  success: boolean;
  statusCode?: string;
  message?: string;
  data?: any;
  error?: string;
} {
  const textContent = extractTextContent(content);
  if (!textContent) {
    return { success: false };
  }

  try {
    const parsed = JSON.parse(textContent);
    return {
      success: parsed.statusCode === "10000",
      statusCode: parsed.statusCode,
      message: parsed.message,
      data: parsed.data,
      error: parsed.error,
    };
  } catch {
    // Fallback for non-JSON responses (backward compatibility)
    return { success: true, data: textContent };
  }
}

/**
 * Extract data from Context7-style JSON responses
 * For tests that need to check specific data fields
 */
export function extractJsonData(content: MCPContent | undefined): any {
  const parsed = parseJsonResponse(content);
  return parsed.data;
}
