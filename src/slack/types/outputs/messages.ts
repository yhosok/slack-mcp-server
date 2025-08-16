/**
 * Message service output types following Context7 TypeScript best practices
 * All types extend Record<string, any> for JSON serialization safety
 */

export interface SendMessageOutput extends Record<string, any> {
  success: boolean;
  channel: string;
  ts: string;
  message: string;
}

export interface MessageSearchOutput extends Record<string, any> {
  messages: Array<{
    text: string;
    user: string;
    ts: string;
    channel: string;
    permalink: string;
  }>;
  total: number;
  query: string;
  hasMore: boolean;
}

export interface ChannelHistoryOutput extends Record<string, any> {
  messages: Array<{
    type: string;
    user: string;
    text: string;
    ts: string;
    thread_ts?: string;
    reply_count?: number;
  }>;
  hasMore: boolean;
  responseMetadata?: {
    nextCursor?: string;
  };
  channel: string;
}