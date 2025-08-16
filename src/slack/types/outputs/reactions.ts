/**
 * Reaction service output types following Context7 TypeScript best practices
 * All types extend Record<string, any> for JSON serialization safety
 */

export interface AddReactionOutput extends Record<string, any> {
  success: boolean;
  channel: string;
  message_ts: string;
  reaction_name: string;
  message: string;
}

export interface RemoveReactionOutput extends Record<string, any> {
  success: boolean;
  channel: string;
  message_ts: string;
  reaction_name: string;
  message: string;
}

export interface GetReactionsOutput extends Record<string, any> {
  reactions: Array<{
    name: string;
    count: number;
    users: string[];
  }>;
  message: {
    type: string;
    user: string;
    text: string;
    ts: string;
  };
  channel: string;
}

export interface ReactionStatisticsOutput extends Record<string, any> {
  totalReactions: number;
  topReactions: Array<{
    name: string;
    count: number;
    percentage: number;
  }>;
  topUsers: Array<{
    userId: string;
    reactionCount: number;
  }>;
  trends: Array<{
    date: string;
    count: number;
  }>;
  period: string;
}