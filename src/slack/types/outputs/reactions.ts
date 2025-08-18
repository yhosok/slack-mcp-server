/**
 * Reaction service output types following TypeSafeAPI TypeScript best practices
 *
 * Comprehensive type definitions for emoji reaction service responses that ensure
 * JSON serialization safety, type-safe API interactions, and consistent data structures
 * across all reaction operations. All types extend ServiceOutput for guaranteed
 * serialization compatibility and maintain strict TypeScript type checking.
 *
 * Architecture Features:
 * - ServiceOutput constraint ensures JSON serialization safety
 * - Discriminated union patterns for type-safe error handling
 * - Comprehensive reaction data structures with user information
 * - Statistical analysis types for engagement metrics
 * - Message filtering and search result types
 * - Full TypeScript strict mode compatibility
 *
 * @implements TypeSafeAPI ServiceOutput constraints
 * @implements JSON serialization safety
 * @implements Production-ready type definitions
 */

import type { ServiceOutput, ServiceResult } from '../typesafe-api-patterns';

/**
 * Output type for successful emoji reaction addition operations
 *
 * Represents the result of adding an emoji reaction to a Slack message.
 * Contains confirmation details and operation metadata for client validation.
 *
 * @example Usage with ts-pattern
 * ```typescript
 * match(result)
 *   .with({ success: true }, (data: { data: AddReactionOutput }) => {
 *     console.log(`Added ${data.data.reaction_name} to message ${data.data.message_ts}`);
 *     console.log(`Operation: ${data.data.message}`);
 *   })
 *   .with({ success: false }, (error) => console.error(error.error))
 *   .exhaustive();
 * ```
 *
 * @implements ServiceOutput constraint for JSON serialization
 * @implements TypeSafeAPI output pattern
 */
export interface AddReactionOutput extends ServiceOutput {
  /** Whether the reaction was successfully added */
  success: boolean;
  /** Channel ID where the reaction was added */
  channel: string;
  /** Timestamp of the message that received the reaction */
  message_ts: string;
  /** Name of the emoji reaction that was added */
  reaction_name: string;
  /** Human-readable success or failure message */
  message: string;
  /** Additional metadata for extensibility */
  [key: string]: unknown;
}

/**
 * Output type for successful emoji reaction removal operations
 *
 * Represents the result of removing an emoji reaction from a Slack message.
 * Contains confirmation details and operation metadata for client validation.
 *
 * @example Usage with ts-pattern
 * ```typescript
 * match(result)
 *   .with({ success: true }, (data: { data: RemoveReactionOutput }) => {
 *     console.log(`Removed ${data.data.reaction_name} from message ${data.data.message_ts}`);
 *     console.log(`Status: ${data.data.message}`);
 *   })
 *   .with({ success: false }, (error) => console.error(error.error))
 *   .exhaustive();
 * ```
 *
 * @implements ServiceOutput constraint for JSON serialization
 * @implements TypeSafeAPI output pattern
 */
export interface RemoveReactionOutput extends ServiceOutput {
  /** Whether the reaction was successfully removed */
  success: boolean;
  /** Channel ID where the reaction was removed from */
  channel: string;
  /** Timestamp of the message the reaction was removed from */
  message_ts: string;
  /** Name of the emoji reaction that was removed */
  reaction_name: string;
  /** Human-readable success or failure message */
  message: string;
  /** Additional metadata for extensibility */
  [key: string]: unknown;
}

/**
 * Output type for comprehensive message reaction retrieval
 *
 * Provides detailed reaction data for a specific message including emoji counts,
 * user information, and message context. Supports both summary and detailed views
 * based on the 'full' parameter in the request.
 *
 * @example Basic Reaction Analysis
 * ```typescript
 * match(result)
 *   .with({ success: true }, (data: { data: GetReactionsOutput }) => {
 *     const { reactions, totalReactions, message } = data.data;
 *
 *     console.log(`Message: "${message.text}" by ${message.user}`);
 *     console.log(`Total reactions: ${totalReactions}`);
 *
 *     reactions.forEach(reaction => {
 *       console.log(`${reaction.name}: ${reaction.count} users`);
 *       if (reaction.users.length > 0) {
 *         console.log(`  Users: ${reaction.users.join(', ')}`);
 *       }
 *     });
 *   })
 *   .exhaustive();
 * ```
 *
 * @implements ServiceOutput constraint for JSON serialization
 * @implements TypeSafeAPI output pattern
 */
export interface GetReactionsOutput extends ServiceOutput {
  /** Array of emoji reactions with counts and user details */
  reactions: Array<{
    /** Emoji reaction name (without colons) */
    name: string;
    /** Number of users who added this reaction */
    count: number;
    /** Array of user IDs or display names (if full=true) */
    users: string[];
    /** Enhanced user details when full=true (optional for backward compatibility) */
    userDetails?: Array<{
      id: string;
      name: string;
      isBot?: boolean;
      isAdmin?: boolean;
      isDeleted?: boolean;
      isRestricted?: boolean;
    }>;
  }>;
  /** Message context information */
  message: {
    /** Message type (usually 'message') */
    type: string;
    /** User ID who posted the message */
    user: string;
    /** Message text content */
    text: string;
    /** Message timestamp */
    ts: string;
  };
  /** Channel ID containing the message */
  channel: string;
  /** Total count of all reactions on the message */
  totalReactions: number;
  /** Additional metadata for extensibility */
  [key: string]: unknown;
}

/**
 * Output type for comprehensive reaction statistics and analytics
 *
 * Provides detailed statistical analysis of emoji reaction patterns across
 * workspace or channel conversations. Includes engagement metrics, trending
 * analysis, and user activity insights for data-driven decision making.
 *
 * @example Engagement Analysis
 * ```typescript
 * match(result)
 *   .with({ success: true }, (data: { data: ReactionStatisticsOutput }) => {
 *     const { totalReactions, topReactions, topUsers, trends, period } = data.data;
 *
 *     console.log(`Reaction Analysis for ${period}`);
 *     console.log(`Total Reactions: ${totalReactions}`);
 *
 *     // Top emoji analysis
 *     console.log('Most Popular Reactions:');
 *     topReactions.slice(0, 5).forEach((reaction, idx) => {
 *       console.log(`${idx + 1}. ${reaction.name}: ${reaction.count} (${reaction.percentage}%)`);
 *     });
 *
 *     // User engagement metrics
 *     console.log('Most Active Users:');
 *     topUsers.slice(0, 3).forEach(user => {
 *       console.log(`${user.userId}: ${user.reactionCount} reactions`);
 *     });
 *
 *     // Trend analysis
 *     if (trends.length > 0) {
 *       const avgDaily = trends.reduce((sum, day) => sum + day.count, 0) / trends.length;
 *       console.log(`Average daily reactions: ${avgDaily.toFixed(1)}`);
 *     }
 *   })
 *   .exhaustive();
 * ```
 *
 * @implements ServiceOutput constraint for JSON serialization
 * @implements TypeSafeAPI output pattern
 */
export interface ReactionStatisticsOutput extends ServiceOutput {
  /** Total number of reactions in the analyzed period */
  totalReactions: number;
  /** Most popular emoji reactions with usage statistics */
  topReactions: Array<{
    /** Emoji reaction name */
    name: string;
    /** Total usage count */
    count: number;
    /** Percentage of total reactions */
    percentage: number;
  }>;
  /** Most active users in terms of reaction activity */
  topUsers: Array<{
    /** User ID of the active reactor */
    userId: string;
    /** Number of reactions given by this user */
    reactionCount: number;
  }>;
  /** Daily reaction trends over the analyzed period */
  trends: Array<{
    /** Date in YYYY-MM-DD format */
    date: string;
    /** Number of reactions on this date */
    count: number;
  }>;
  /** Human-readable description of the analysis period */
  period: string;
  /** Additional metadata for extensibility */
  [key: string]: unknown;
}

/**
 * Output type for message search by reaction patterns
 *
 * Represents filtered messages that match specific reaction criteria,
 * enabling content discovery, sentiment analysis, and engagement tracking.
 * Includes comprehensive message metadata and reaction details.
 *
 * @example Content Curation
 * ```typescript
 * match(result)
 *   .with({ success: true }, (data: { data: FindMessagesByReactionsOutput }) => {
 *     const { messages, total, searchedReactions, matchType } = data.data;
 *
 *     console.log(`Found ${total} messages matching ${matchType} of: ${searchedReactions.join(', ')}`);
 *
 *     messages.forEach((msg, idx) => {
 *       console.log(`\n${idx + 1}. Message by ${msg.user}:`);
 *       console.log(`   "${msg.text?.substring(0, 100)}..."`);
 *       console.log(`   Total reactions: ${msg.totalReactions}`);
 *
 *       // Show reaction breakdown
 *       const reactionSummary = msg.reactions
 *         .map(r => `${r.name}(${r.count})`)
 *         .join(', ');
 *       console.log(`   Reactions: ${reactionSummary}`);
 *
 *       if (msg.permalink) {
 *         console.log(`   Link: ${msg.permalink}`);
 *       }
 *     });
 *   })
 *   .exhaustive();
 * ```
 *
 * @example Sentiment Analysis
 * ```typescript
 * // Usage for identifying positive/negative sentiment messages
 * const positiveMessages = data.messages.filter(msg =>
 *   msg.reactions.some(r => ['heart', 'thumbsup', 'fire'].includes(r.name))
 * );
 *
 * const engagementScore = positiveMessages.reduce(
 *   (sum, msg) => sum + msg.totalReactions, 0
 * ) / positiveMessages.length;
 * ```
 *
 * @implements ServiceOutput constraint for JSON serialization
 * @implements TypeSafeAPI output pattern
 */
export interface FindMessagesByReactionsOutput extends ServiceOutput {
  /** Array of messages matching the reaction criteria */
  messages: Array<{
    /** Channel ID containing the message */
    channel: string;
    /** Message text content (may be truncated) */
    text?: string;
    /** User ID who posted the message */
    user?: string;
    /** Message timestamp */
    timestamp?: string;
    /** Reaction details for this message */
    reactions: Array<{
      /** Emoji reaction name */
      name: string;
      /** Number of users who added this reaction */
      count: number;
      /** Array of user IDs (optional) */
      users?: string[];
    }>;
    /** Total count of all reactions on this message */
    totalReactions: number;
    /** Direct link to the message in Slack (if available) */
    permalink?: string;
  }>;
  /** Total number of messages found */
  total: number;
  /** Array of reaction names that were searched for */
  searchedReactions: string[];
  /** Whether messages must match 'any' or 'all' of the searched reactions */
  matchType: 'any' | 'all';
  /** Minimum reaction count threshold used in the search */
  minReactionCount: number;
  /** Additional metadata for extensibility */
  [key: string]: unknown;
}

/**
 * TypeSafeAPI + ts-pattern discriminated union types for type-safe service results
 *
 * Production-ready discriminated union types that enable exhaustive pattern matching
 * with ts-pattern library. Each result type provides type-safe success/error handling
 * with comprehensive data structures for both success and failure scenarios.
 *
 * Features:
 * - Discriminated unions for exhaustive pattern matching
 * - Type-safe error handling with detailed error information
 * - Consistent success/failure patterns across all operations
 * - Full compatibility with ts-pattern match expressions
 * - JSON serialization safety through ServiceOutput constraints
 *
 * @example Pattern Matching Usage
 * ```typescript
 * import { match } from 'ts-pattern';
 *
 * const handleReactionResult = (result: AddReactionResult) =>
 *   match(result)
 *     .with({ success: true }, ({ data, message }) => {
 *       // TypeScript knows data is AddReactionOutput
 *       console.log(`Success: ${message}`);
 *       console.log(`Added ${data.reaction_name} to ${data.channel}`);
 *       return { status: 'completed', data };
 *     })
 *     .with({ success: false }, ({ error, message }) => {
 *       // TypeScript knows this is the error case
 *       console.error(`Failed: ${message} - ${error}`);
 *       return { status: 'failed', error };
 *     })
 *     .exhaustive(); // Compile-time completeness check
 * ```
 *
 * @example Batch Processing
 * ```typescript
 * const results: AddReactionResult[] = await Promise.all(
 *   reactions.map(name => service.addReaction({ channel, message_ts, reaction_name: name }))
 * );
 *
 * const { successes, errors } = results.reduce(
 *   (acc, result) =>
 *     match(result)
 *       .with({ success: true }, ({ data }) => {
 *         acc.successes.push(data);
 *         return acc;
 *       })
 *       .with({ success: false }, ({ error }) => {
 *         acc.errors.push(error);
 *         return acc;
 *       })
 *       .exhaustive(),
 *   { successes: [], errors: [] }
 * );
 * ```
 *
 * @implements TypeSafeAPI discriminated union pattern
 * @implements ts-pattern exhaustive matching
 * @implements Production-ready error handling
 */
/** Type-safe result for emoji reaction addition operations */
export type AddReactionResult = ServiceResult<AddReactionOutput>;

/** Type-safe result for emoji reaction removal operations */
export type RemoveReactionResult = ServiceResult<RemoveReactionOutput>;

/** Type-safe result for comprehensive reaction data retrieval */
export type GetReactionsResult = ServiceResult<GetReactionsOutput>;

/** Type-safe result for reaction statistics and analytics */
export type ReactionStatisticsResult = ServiceResult<ReactionStatisticsOutput>;

/** Type-safe result for message search by reaction patterns */
export type FindMessagesByReactionsResult = ServiceResult<FindMessagesByReactionsOutput>;
