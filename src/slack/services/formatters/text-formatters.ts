/**
 * Text formatters for consistent API response formatting across modular architecture
 * These formatters ensure standard text-based output formats for all service methods
 */

import type { MCPToolResult } from '../../../mcp/types.js';

/**
 * Format sendMessage response for consistent text output
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
 * Format getChannelHistory response for consistent text output
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
 * Format findThreadsInChannel response for consistent text output
 */
export const formatFindThreadsResponse = async (
  result: {
    threads: any[];
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
/**
 * Format thread replies response with display names
 */
export const formatThreadRepliesResponse = async (
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
        timestamp: msg.ts,
        threadTs: msg.thread_ts,
        replyCount: msg.reply_count,
        reactions: msg.reactions,
        edited: msg.edited,
      };
    })
  );

  return {
    content: [
      {
        type: 'text',
        text: `Thread replies (${result.messages.length} messages):\n\n${formattedMessages
          .map((msg) => `[${msg.timestamp}] ${msg.user}: ${msg.text}`)
          .join('\n')}`,
      },
    ],
  };
};
