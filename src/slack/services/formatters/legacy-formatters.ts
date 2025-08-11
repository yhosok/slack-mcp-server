/**
 * Legacy-compatible formatters to ensure parity between legacy and modular implementations
 * These formatters produce the exact same text output as the legacy SlackService methods
 */

import type { MCPToolResult } from '../../../mcp/types.js';
import type { SlackMessage } from '../../types.js';

/**
 * Format sendMessage response to match legacy format
 */
export const formatSendMessageResponse = (result: {
  success: boolean;
  timestamp?: string;
  channel?: string;
  message?: any;
}): MCPToolResult => ({
  content: [
    {
      type: 'text',
      text: `Message sent successfully to ${result.channel}. Timestamp: ${result.timestamp}`,
    },
  ],
});

/**
 * Format getChannelHistory response to match legacy format
 */
export const formatChannelHistoryResponse = async (
  result: {
    messages: any[];
    hasMore?: boolean;
    cursor?: string;
  },
  getUserDisplayName: (userId: string) => Promise<string>
): Promise<MCPToolResult> => {
  const formattedMessages = await Promise.all(
    result.messages.map(async (msg: any) => {
      const displayName = await getUserDisplayName(msg.user || 'unknown');
      return {
        user: displayName,
        text: msg.text || '',
        timestamp: msg.timestamp,
      };
    })
  );

  return {
    content: [
      {
        type: 'text',
        text: `Channel history (${result.messages.length} messages):\n\n${formattedMessages
          .map((msg) => `[${msg.timestamp}] ${msg.user}: ${msg.text}`)
          .join('\n')}`,
      },
    ],
  };
};

/**
 * Format findThreadsInChannel response to match legacy format
 */
export const formatFindThreadsResponse = (result: {
  threads: any[];
  total: number;
  hasMore?: boolean;
}): MCPToolResult => ({
  content: [
    {
      type: 'text',
      text: `Found ${result.threads.length} threads in channel:\n\n${result.threads
        .map(
          (thread, idx) =>
            `${idx + 1}. Thread ${thread.threadTs}\n` +
            `   └─ ${thread.replyCount} replies from ${thread.participants?.length || 0} users\n` +
            `   └─ Last reply: ${thread.lastReply}\n` +
            `   └─ Parent: ${thread.parentMessage?.text?.substring(0, 100) || ''}...`
        )
        .join('\n\n')}`,
    },
  ],
});

/**
 * Format createThread response to match legacy format
 */
export const formatCreateThreadResponse = (result: {
  success: boolean;
  threadTs?: string;
  parentMessage?: any;
  reply?: any;
}): MCPToolResult => ({
  content: [
    {
      type: 'text',
      text: `Thread created successfully!\nParent message: ${result.threadTs}\nChannel: ${result.parentMessage?.channel}`,
    },
  ],
});

/**
 * Format addReaction response to match legacy format
 */
export const formatAddReactionResponse = (result: {
  success: boolean;
  reaction?: string;
  channel?: string;
  timestamp?: string;
}): MCPToolResult => ({
  content: [
    {
      type: 'text',
      text: result.success 
        ? `Reaction :${result.reaction}: added successfully to message ${result.timestamp}.`
        : `Failed to add reaction :${result.reaction}: to message ${result.timestamp}.`,
    },
  ],
});

/**
 * Format searchMessages response to match legacy format
 */
export const formatSearchMessagesResponse = async (
  result: {
    results: any[];
    total: number;
    query: string;
    page?: number;
    pages?: number;
  },
  getUserDisplayName: (userId: string) => Promise<string>
): Promise<MCPToolResult> => {
  const formattedMatches = await Promise.all(
    result.results.map(async (match: any) => {
      const displayName = await getUserDisplayName(match.user || '');
      return {
        user: displayName,
        text: match.text || '',
        timestamp: match.ts || '',
        channel: match.channel,
        permalink: match.permalink || '',
      };
    })
  );

  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify(
          {
            query: result.query,
            total: result.total,
            page: result.page || 1,
            pages: result.pages || 1,
            matches: formattedMatches,
          },
          null,
          2
        ),
      },
    ],
  };
};