/**
 * Text formatters for consistent API response formatting across modular architecture
 * These formatters ensure standard text-based output formats for all service methods
 */

import type { MCPToolResult } from '../../../mcp/types.js';

// Type for message in responses
type FormattedMessage = {
  user?: string;
  text?: string;
  timestamp?: string;
  ts?: string;
  thread_ts?: string;
  reply_count?: number;
  reactions?: Array<{ name: string; count: number; users?: string[] }>;
  edited?: { ts?: string; user?: string };
};

// Type for thread results
type ThreadResult = {
  threadTs?: string;
  parentMessage?: FormattedMessage;
  replyCount?: number;
  lastReply?: string;
  participants?: string[];
};

// Type for search match results
type SearchMatch = {
  type?: string;
  user?: string;
  text?: string;
  ts?: string;
  thread_ts?: string;
  channel?: { id?: string; name?: string };
  permalink?: string;
};

/**
 * Format sendMessage response for consistent text output
 */
export const formatSendMessageResponse = (result: {
  success: boolean;
  timestamp?: string;
  channel?: string;
  message?: FormattedMessage;
}): MCPToolResult => ({
  content: [
    {
      type: 'text',
      text: `Message sent successfully to ${result.channel}. Timestamp: ${result.timestamp}`,
    },
  ],
});

/**
 * Format getChannelHistory response for consistent text output
 */
export const formatChannelHistoryResponse = async (
  result: {
    messages: FormattedMessage[];
    hasMore?: boolean;
    cursor?: string;
    pageCount?: number;
    totalMessages?: number;
  },
  getUserDisplayName: (userId: string) => Promise<string>
): Promise<MCPToolResult> => {
  const formattedMessages = await Promise.all(
    result.messages.map(async (msg: FormattedMessage) => {
      const displayName = await getUserDisplayName(msg.user || 'unknown');
      return {
        user: displayName,
        text: msg.text || '',
        timestamp: msg.timestamp,
      };
    })
  );

  const paginationInfo =
    result.pageCount !== undefined
      ? `\n\nPagination: Fetched ${result.pageCount} pages, total ${result.totalMessages || result.messages.length} messages`
      : result.hasMore
        ? `\n\nMore messages available. Next cursor: ${result.cursor || 'N/A'}`
        : '';

  return {
    content: [
      {
        type: 'text',
        text: `Channel history (${result.messages.length} messages):${paginationInfo}\n\n${formattedMessages
          .map((msg) => `[${msg.timestamp}] ${msg.user}: ${msg.text}`)
          .join('\n')}`,
      },
    ],
  };
};

/**
 * Format findThreadsInChannel response for consistent text output
 */
export const formatFindThreadsResponse = async (
  result: {
    threads: ThreadResult[];
    total: number;
    hasMore?: boolean;
  },
  getUserDisplayName?: (userId: string) => Promise<string>
): Promise<MCPToolResult> => {
  let threadsText = '';

  if (getUserDisplayName) {
    // Format with user display names
    const formattedThreads = await Promise.all(
      result.threads.map(async (thread, idx) => {
        const parentUserName = thread.parentMessage?.user
          ? await getUserDisplayName(thread.parentMessage.user)
          : 'unknown';

        return `${idx + 1}. Thread ${thread.threadTs}
   └─ ${thread.replyCount} replies from ${thread.participants?.length || 0} users
   └─ Last reply: ${thread.lastReply}
   └─ Parent by ${parentUserName}: ${thread.parentMessage?.text?.substring(0, 100) || ''}...`;
      })
    );
    threadsText = formattedThreads.join('\n\n');
  } else {
    // Fallback to original format
    threadsText = result.threads
      .map(
        (thread, idx) =>
          `${idx + 1}. Thread ${thread.threadTs}
` +
          `   └─ ${thread.replyCount} replies from ${thread.participants?.length || 0} users
` +
          `   └─ Last reply: ${thread.lastReply}
` +
          `   └─ Parent: ${thread.parentMessage?.text?.substring(0, 100) || ''}...`
      )
      .join('\n\n');
  }

  return {
    content: [
      {
        type: 'text',
        text: `Found ${result.threads.length} threads in channel:

${threadsText}`,
      },
    ],
  };
};

/**
 * Format createThread response for consistent text output
 */
export const formatCreateThreadResponse = (result: {
  success: boolean;
  threadTs?: string;
  channel?: string;
  parentMessage?: FormattedMessage;
  reply?: FormattedMessage;
}): MCPToolResult => ({
  content: [
    {
      type: 'text',
      text: `Thread created successfully!\nParent message: ${result.threadTs}\nChannel: ${result.channel || 'Unknown'}`,
    },
  ],
});

/**
 * Format addReaction response for consistent text output
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
 * Format searchMessages response for consistent text output
 */
export const formatSearchMessagesResponse = async (
  result: {
    results: SearchMatch[];
    total: number;
    query: string;
    page?: number;
    pages?: number;
  },
  getUserDisplayName: (userId: string) => Promise<string>
): Promise<MCPToolResult> => {
  const formattedMatches = await Promise.all(
    result.results.map(async (match: SearchMatch) => {
      const displayName = await getUserDisplayName(match.user || '');
      return {
        user: displayName,
        text: match.text || '',
        timestamp: match.ts || '',
        channel: match.channel?.id || match.channel?.name || '',
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
/**
 * Format thread replies response with display names
 */
export const formatThreadRepliesResponse = async (
  result: {
    messages: FormattedMessage[];
    hasMore?: boolean;
    cursor?: string;
    pageCount?: number;
    totalMessages?: number;
  },
  getUserDisplayName: (userId: string) => Promise<string>
): Promise<MCPToolResult> => {
  const formattedMessages = await Promise.all(
    result.messages.map(async (msg: FormattedMessage) => {
      const displayName = await getUserDisplayName(msg.user || 'unknown');
      return {
        user: displayName,
        text: msg.text || '',
        timestamp: msg.ts,
        threadTs: msg.thread_ts,
        replyCount: msg.reply_count,
        reactions: msg.reactions,
        edited: msg.edited,
      };
    })
  );

  const paginationInfo =
    result.pageCount !== undefined
      ? `\n\nPagination: Fetched ${result.pageCount} pages, total ${result.totalMessages || result.messages.length} messages`
      : result.hasMore
        ? `\n\nMore messages available. Next cursor: ${result.cursor || 'N/A'}`
        : '';

  return {
    content: [
      {
        type: 'text',
        text: `Thread replies (${result.messages.length} messages):${paginationInfo}\n\n${formattedMessages
          .map((msg) => `[${msg.timestamp}] ${msg.user}: ${msg.text}`)
          .join('\n')}`,
      },
    ],
  };
};
