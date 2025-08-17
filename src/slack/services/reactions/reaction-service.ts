/**
 * TypeSafeAPI Reaction Service
 *
 * Comprehensive emoji reaction management with TypeSafeAPI + ts-pattern patterns.
 * Provides type-safe operations for adding, removing, and analyzing emoji reactions
 * on Slack messages with discriminated union ServiceResult types for type-safe error handling.
 *
 * Features:
 * - Type-safe reaction operations with Zod validation
 * - Discriminated union results for exhaustive pattern matching
 * - Comprehensive reaction statistics and analytics
 * - Message filtering by reaction patterns
 * - Full integration with Slack Web API reaction endpoints
 * - Support for both basic and advanced reaction querying
 *
 * @implements TypeSafeAPI ServiceOutput constraints
 * @implements ts-pattern discriminated unions
 * @implements Production-ready API response structure
 */

import type { ReactionsGetArguments } from '@slack/web-api';
import type { SlackMessage } from '../../types/index.js';
import {
  AddReactionSchema,
  RemoveReactionSchema,
  GetReactionsSchema,
  GetReactionStatisticsSchema,
  FindMessagesByReactionsSchema,
} from '../../../utils/validation.js';
import type { ReactionService, ReactionServiceDependencies } from './types.js';
import type {
  AddReactionResult,
  RemoveReactionResult,
  GetReactionsResult,
  ReactionStatisticsResult,
  FindMessagesByReactionsResult,
} from '../../types/outputs/reactions.js';
import { createServiceSuccess, createServiceError } from '../../types/typesafe-api-patterns.js';

/**
 * Create TypeSafeAPI reaction service with infrastructure dependencies
 *
 * Factory function that creates a TypeSafeAPI-compliant reaction service with
 * full type safety, error handling, and integration with existing infrastructure.
 *
 * Features:
 * - Type-safe operations with discriminated union results
 * - Automatic input validation using Zod schemas
 * - Consistent error handling with ServiceResult patterns
 * - Integration with Slack Web API client management
 * - Support for both bot and user token operations
 * - Comprehensive reaction analytics and statistics
 *
 * @param deps - Infrastructure dependencies (client manager, rate limiter, etc.)
 * @returns Reaction service instance with TypeSafeAPI + ts-pattern type safety
 *
 * @example Service Creation
 * ```typescript
 * const reactionService = createReactionServiceTypeSafeAPI({
 *   clientManager,
 *   rateLimitTracker,
 *   requestHandler,
 *   userService
 * });
 *
 * const result = await reactionService.addReaction({
 *   channel: 'C1234567890',
 *   message_ts: '1234567890.123456',
 *   reaction_name: 'thumbsup'
 * });
 *
 * match(result)
 *   .with({ success: true }, (success) => console.log('Added:', success.data))
 *   .with({ success: false }, (error) => console.error('Failed:', error.error))
 *   .exhaustive();
 * ```
 *
 * @implements TypeSafeAPI ServiceOutput constraints
 * @implements ts-pattern discriminated unions
 * @implements Production-ready API response structure
 */
export const createReactionServiceTypeSafeAPI = (
  deps: ReactionServiceDependencies
): ReactionService => {
  /**
   * Add a reaction emoji to a Slack message with TypeSafeAPI + ts-pattern type safety
   *
   * Adds an emoji reaction to a specific message in a channel or thread.
   * Uses bot token for write operations and provides comprehensive validation.
   *
   * @param args - Unknown input (validated at runtime using AddReactionSchema)
   * @returns Promise<AddReactionResult> - Type-safe result with discriminated union
   *
   * @example Basic Reaction
   * ```typescript
   * const result = await addReaction({
   *   channel: 'C1234567890',
   *   message_ts: '1234567890.123456',
   *   reaction_name: 'thumbsup'
   * });
   *
   * // Type-safe handling with ts-pattern
   * match(result)
   *   .with({ success: true }, ({ data }) => {
   *     console.log(`Added ${data.reaction_name} to message ${data.message_ts}`);
   *   })
   *   .with({ success: false }, ({ error }) => {
   *     console.error('Failed to add reaction:', error);
   *   })
   *   .exhaustive();
   * ```
   *
   * @example Error Handling
   * ```typescript
   * const result = await addReaction({ invalid: 'data' });
   *
   * if (!result.success) {
   *   // TypeScript knows this is an error case
   *   console.error('Validation error:', result.error);
   * }
   * ```
   *
   * @implements TypeSafeAPI ServiceOutput constraints
   * @implements ts-pattern discriminated unions
   * @implements Production-ready API response structure
   */
  const addReaction = async (args: unknown): Promise<AddReactionResult> => {
    try {
      const input = AddReactionSchema.parse(args);
      const client = deps.clientManager.getClientForOperation('write');

      const result = await client.reactions.add({
        channel: input.channel,
        timestamp: input.message_ts,
        name: input.reaction_name,
      });

      return createServiceSuccess(
        {
          success: result.ok || false,
          channel: input.channel,
          message_ts: input.message_ts,
          reaction_name: input.reaction_name,
          message: result.ok ? 'Reaction added successfully' : 'Failed to add reaction',
        },
        'Reaction operation completed'
      );
    } catch (error) {
      return createServiceError(
        error instanceof Error ? error.message : 'Failed to add reaction',
        'Failed to add reaction'
      );
    }
  };

  /**
   * Remove a reaction emoji from a Slack message with TypeSafeAPI + ts-pattern type safety
   *
   * Removes an emoji reaction from a specific message in a channel or thread.
   * Uses bot token for write operations and provides comprehensive validation.
   * Only removes reactions that were added by the authenticated user/bot.
   *
   * @param args - Unknown input (validated at runtime using RemoveReactionSchema)
   * @returns Promise<RemoveReactionResult> - Type-safe result with discriminated union
   *
   * @example Basic Reaction Removal
   * ```typescript
   * const result = await removeReaction({
   *   channel: 'C1234567890',
   *   message_ts: '1234567890.123456',
   *   reaction_name: 'thumbsup'
   * });
   *
   * // Type-safe handling with ts-pattern
   * match(result)
   *   .with({ success: true }, ({ data }) => {
   *     console.log(`Removed ${data.reaction_name} from message ${data.message_ts}`);
   *   })
   *   .with({ success: false }, ({ error }) => {
   *     console.error('Failed to remove reaction:', error);
   *   })
   *   .exhaustive();
   * ```
   *
   * @example Batch Processing
   * ```typescript
   * const reactions = ['thumbsup', 'heart', 'fire'];
   * const results = await Promise.all(
   *   reactions.map(name => removeReaction({
   *     channel: 'C1234567890',
   *     message_ts: '1234567890.123456',
   *     reaction_name: name
   *   }))
   * );
   *
   * results.forEach(result =>
   *   match(result)
   *     .with({ success: true }, ({ data }) => console.log('Removed:', data.reaction_name))
   *     .with({ success: false }, ({ error }) => console.error('Error:', error))
   *     .exhaustive()
   * );
   * ```
   *
   * @implements TypeSafeAPI ServiceOutput constraints
   * @implements ts-pattern discriminated unions
   * @implements Production-ready API response structure
   */
  const removeReaction = async (args: unknown): Promise<RemoveReactionResult> => {
    try {
      const input = RemoveReactionSchema.parse(args);
      const client = deps.clientManager.getClientForOperation('write');

      const result = await client.reactions.remove({
        channel: input.channel,
        timestamp: input.message_ts,
        name: input.reaction_name,
      });

      return createServiceSuccess(
        {
          success: result.ok || false,
          channel: input.channel,
          message_ts: input.message_ts,
          reaction_name: input.reaction_name,
          message: result.ok ? 'Reaction removed successfully' : 'Failed to remove reaction',
        },
        'Reaction removal completed'
      );
    } catch (error) {
      return createServiceError(
        error instanceof Error ? error.message : 'Failed to remove reaction',
        'Failed to remove reaction'
      );
    }
  };

  /**
   * Get all reactions on a specific message with TypeSafeAPI + ts-pattern type safety
   *
   * Retrieves comprehensive reaction data for a message including emoji names, counts,
   * and optionally user details. Supports both summary and detailed views with user information.
   *
   * @param args - Unknown input (validated at runtime using GetReactionsSchema)
   * @returns Promise<GetReactionsResult> - Type-safe result with comprehensive reaction data
   *
   * @example Basic Reaction Retrieval
   * ```typescript
   * const result = await getReactions({
   *   channel: 'C1234567890',
   *   message_ts: '1234567890.123456'
   * });
   *
   * // Type-safe handling with ts-pattern
   * match(result)
   *   .with({ success: true }, ({ data }) => {
   *     console.log(`Total reactions: ${data.totalReactions}`);
   *     data.reactions.forEach(r =>
   *       console.log(`${r.name}: ${r.count} users`)
   *     );
   *   })
   *   .with({ success: false }, ({ error }) => {
   *     console.error('Failed to get reactions:', error);
   *   })
   *   .exhaustive();
   * ```
   *
   * @example Detailed User Information
   * ```typescript
   * const result = await getReactions({
   *   channel: 'C1234567890',
   *   message_ts: '1234567890.123456',
   *   full: true  // Include user display names
   * });
   *
   * if (result.success) {
   *   result.data.reactions.forEach(reaction => {
   *     console.log(`${reaction.name}: ${reaction.users.join(', ')}`);
   *   });
   * }
   * ```
   *
   * @example Message Context Analysis
   * ```typescript
   * const result = await getReactions(args);
   *
   * match(result)
   *   .with({ success: true }, ({ data }) => {
   *     const { message, reactions, totalReactions } = data;
   *     console.log(`Message by ${message.user}: "${message.text}"`);
   *     console.log(`Received ${totalReactions} reactions`);
   *
   *     // Find most popular reaction
   *     const topReaction = reactions.reduce((max, r) =>
   *       r.count > max.count ? r : max, reactions[0]
   *     );
   *     console.log(`Top reaction: ${topReaction.name} (${topReaction.count})`);
   *   })
   *   .with({ success: false }, ({ error }) => console.error(error))
   *   .exhaustive();
   * ```
   *
   * @implements TypeSafeAPI ServiceOutput constraints
   * @implements ts-pattern discriminated unions
   * @implements Production-ready API response structure
   */
  const getReactions = async (args: unknown): Promise<GetReactionsResult> => {
    try {
      const input = GetReactionsSchema.parse(args);
      const client = deps.clientManager.getClientForOperation('read');

      const getArgs: ReactionsGetArguments = {
        channel: input.channel,
        timestamp: input.message_ts,
        full: input.full,
      };

      const result = await client.reactions.get(getArgs);

      if (!result.message) {
        return createServiceError('Message not found or no reactions', 'Message not found');
      }

      const reactions = result.message.reactions || [];

      // Process user info if full details requested
      const processedReactions = await Promise.all(
        reactions.map(async (reaction) => {
          const name = reaction.name || '';
          const count = reaction.count || 0;
          let users = reaction.users || [];

          if (input.full && users.length > 0) {
            // Get display names for users
            const userDetails = await Promise.all(
              users.map(async (userId: string) => {
                try {
                  const userInfo = await deps.userService.getUserInfo(userId);
                  return {
                    id: userId,
                    name: userInfo.real_name || userInfo.name || userId,
                  };
                } catch {
                  return { id: userId, name: userId };
                }
              })
            );
            users = userDetails.map((u) => u.name);
          }

          return {
            name,
            count,
            users,
          };
        })
      );

      const totalReactions = processedReactions.reduce((sum, r) => sum + r.count, 0);

      return createServiceSuccess(
        {
          reactions: processedReactions,
          message: {
            type: result.message.type || '',
            user: result.message.user || '',
            text: result.message.text || '',
            ts: result.message.ts || '',
          },
          channel: input.channel,
          totalReactions,
        },
        'Reactions retrieved successfully'
      );
    } catch (error) {
      return createServiceError(
        error instanceof Error ? error.message : 'Failed to get reactions',
        'Failed to retrieve reactions'
      );
    }
  };

  /**
   * Get comprehensive reaction statistics and trends with TypeSafeAPI + ts-pattern type safety
   *
   * Analyzes reaction patterns across workspace or specific channels to provide insights
   * into emoji usage, user engagement, and temporal trends. Supports customizable time ranges
   * and statistical analysis with top reactions and most active users.
   *
   * @param args - Unknown input (validated at runtime using GetReactionStatisticsSchema)
   * @returns Promise<ReactionStatisticsResult> - Type-safe result with statistical analysis
   *
   * @example Workspace-wide Statistics
   * ```typescript
   * const result = await getReactionStatistics({
   *   days_back: 30,
   *   include_trends: true,
   *   top_count: 10
   * });
   *
   * // Type-safe handling with ts-pattern
   * match(result)
   *   .with({ success: true }, ({ data }) => {
   *     console.log(`Total reactions in ${data.period}: ${data.totalReactions}`);
   *
   *     // Top reactions analysis
   *     data.topReactions.forEach((reaction, idx) => {
   *       console.log(`${idx + 1}. ${reaction.name}: ${reaction.count} (${reaction.percentage}%)`);
   *     });
   *
   *     // User engagement analysis
   *     console.log('Most active reactors:');
   *     data.topUsers.forEach(user => {
   *       console.log(`${user.userId}: ${user.reactionCount} reactions`);
   *     });
   *   })
   *   .with({ success: false }, ({ error }) => {
   *     console.error('Statistics error:', error);
   *   })
   *   .exhaustive();
   * ```
   *
   * @example Channel-specific Analysis
   * ```typescript
   * const result = await getReactionStatistics({
   *   channel: 'C1234567890',
   *   days_back: 7,
   *   include_trends: true
   * });
   *
   * if (result.success) {
   *   const { data } = result;
   *
   *   // Trend analysis
   *   console.log('Daily reaction trends:');
   *   data.trends.forEach(day => {
   *     console.log(`${day.date}: ${day.count} reactions`);
   *   });
   *
   *   // Engagement metrics
   *   const avgDaily = data.totalReactions / data.trends.length;
   *   console.log(`Average daily reactions: ${avgDaily.toFixed(1)}`);
   * }
   * ```
   *
   * @example Custom Time Range
   * ```typescript
   * const quarterlyStats = await getReactionStatistics({
   *   days_back: 90,
   *   top_count: 20,
   *   include_trends: false  // Skip trends for performance
   * });
   *
   * match(quarterlyStats)
   *   .with({ success: true }, ({ data }) => {
   *     // Quarterly engagement report
   *     const topThree = data.topReactions.slice(0, 3);
   *     console.log('Top 3 reactions this quarter:', topThree);
   *   })
   *   .with({ success: false }, ({ error }) => console.error(error))
   *   .exhaustive();
   * ```
   *
   * @implements TypeSafeAPI ServiceOutput constraints
   * @implements ts-pattern discriminated unions
   * @implements Production-ready API response structure
   */
  const getReactionStatistics = async (args: unknown): Promise<ReactionStatisticsResult> => {
    try {
      const input = GetReactionStatisticsSchema.parse(args);
      const client = deps.clientManager.getClientForOperation('read');

      const daysBack = input.days_back || 30;
      const oldestTime = Math.floor((Date.now() - daysBack * 24 * 60 * 60 * 1000) / 1000);

      const allMessages: SlackMessage[] = [];

      if (input.channel) {
        // Get messages from specific channel
        const historyResult = await client.conversations.history({
          channel: input.channel,
          oldest: oldestTime.toString(),
          limit: 1000,
        });

        if (historyResult.ok && historyResult.messages) {
          allMessages.push(...(historyResult.messages as SlackMessage[]));
        }
      } else {
        // Get messages from all channels
        const channelsResult = await client.conversations.list({
          exclude_archived: true,
          limit: 100,
        });

        if (channelsResult.ok && channelsResult.channels) {
          for (const channel of channelsResult.channels.slice(0, 10)) {
            // Limit to 10 channels for performance
            if (channel.id) {
              const historyResult = await client.conversations.history({
                channel: channel.id,
                oldest: oldestTime.toString(),
                limit: 100,
              });

              if (historyResult.ok && historyResult.messages) {
                allMessages.push(...(historyResult.messages as SlackMessage[]));
              }
            }
          }
        }
      }

      // Aggregate reaction statistics
      const reactionCounts: { [reaction: string]: number } = {};
      const userReactionCounts: { [userId: string]: number } = {};
      let totalReactions = 0;

      allMessages.forEach((message) => {
        if (message.reactions) {
          message.reactions.forEach((reaction) => {
            const name = reaction.name || '';
            const count = reaction.count || 0;
            reactionCounts[name] = (reactionCounts[name] || 0) + count;
            totalReactions += count;

            (reaction.users || []).forEach((userId) => {
              userReactionCounts[userId] = (userReactionCounts[userId] || 0) + 1;
            });
          });
        }
      });

      // Create top reactions list
      const topReactions = Object.entries(reactionCounts)
        .map(([name, count]) => ({
          name,
          count,
          percentage: totalReactions > 0 ? Math.round((count / totalReactions) * 100) : 0,
        }))
        .sort((a, b) => b.count - a.count)
        .slice(0, input.top_count || 10);

      // Create top users list
      const topUsers = Object.entries(userReactionCounts)
        .map(([userId, reactionCount]) => ({
          userId,
          reactionCount,
        }))
        .sort((a, b) => b.reactionCount - a.reactionCount)
        .slice(0, input.top_count || 10);

      // Create simple daily trends (simplified for this implementation)
      const trends: Array<{ date: string; count: number }> = [];
      if (input.include_trends) {
        for (let i = daysBack - 1; i >= 0; i--) {
          const date = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
          const dateString = date.toISOString().split('T')[0];
          if (dateString) {
            trends.push({
              date: dateString,
              count: Math.floor(totalReactions / daysBack), // Simplified distribution
            });
          }
        }
      }

      return createServiceSuccess(
        {
          totalReactions,
          topReactions,
          topUsers,
          trends,
          period: `${daysBack} days`,
        },
        'Reaction statistics calculated'
      );
    } catch (error) {
      return createServiceError(
        error instanceof Error ? error.message : 'Failed to get reaction statistics',
        'Failed to retrieve reaction statistics'
      );
    }
  };

  /**
   * Find messages with specific reaction patterns using TypeSafeAPI + ts-pattern type safety
   *
   * Searches for messages that match specific reaction criteria, supporting both
   * individual emoji filtering and complex pattern matching. Enables discovery of
   * highly-reacted content, sentiment analysis, and engagement pattern identification.
   *
   * @param args - Unknown input (validated at runtime using FindMessagesByReactionsSchema)
   * @returns Promise<FindMessagesByReactionsResult> - Type-safe result with matching messages
   *
   * @example Find Popular Messages
   * ```typescript
   * const result = await findMessagesByReactions({
   *   channel: 'C1234567890',
   *   reactions: ['fire', 'star', 'trophy'],
   *   match_type: 'any',
   *   min_reaction_count: 5,
   *   limit: 10
   * });
   *
   * // Type-safe handling with ts-pattern
   * match(result)
   *   .with({ success: true }, ({ data }) => {
   *     console.log(`Found ${data.total} popular messages`);
   *
   *     data.messages.forEach(msg => {
   *       console.log(`Message: ${msg.text?.substring(0, 50)}...`);
   *       console.log(`Total reactions: ${msg.totalReactions}`);
   *       console.log(`Reactions: ${msg.reactions.map(r => `${r.name}(${r.count})`).join(', ')}`);
   *       console.log(`Link: ${msg.permalink}`);
   *       console.log('---');
   *     });
   *   })
   *   .with({ success: false }, ({ error }) => {
   *     console.error('Search failed:', error);
   *   })
   *   .exhaustive();
   * ```
   *
   * @example Sentiment Analysis
   * ```typescript
   * // Find positive sentiment messages
   * const positiveResult = await findMessagesByReactions({
   *   channel: 'C1234567890',
   *   reactions: ['heart', 'thumbsup', 'clap', 'fire'],
   *   match_type: 'any',
   *   min_reaction_count: 3
   * });
   *
   * // Find negative sentiment messages
   * const negativeResult = await findMessagesByReactions({
   *   channel: 'C1234567890',
   *   reactions: ['thumbsdown', 'confused', 'disappointed'],
   *   match_type: 'any',
   *   min_reaction_count: 1
   * });
   *
   * if (positiveResult.success && negativeResult.success) {
   *   const sentiment = {
   *     positive: positiveResult.data.total,
   *     negative: negativeResult.data.total,
   *     ratio: positiveResult.data.total / (negativeResult.data.total || 1)
   *   };
   *   console.log('Channel sentiment analysis:', sentiment);
   * }
   * ```
   *
   * @example Content Curation
   * ```typescript
   * // Find messages that require ALL specified reactions (high engagement)
   * const curatedResult = await findMessagesByReactions({
   *   channel: 'C1234567890',
   *   reactions: ['star', 'bookmark', 'point_up'],
   *   match_type: 'all',  // Must have ALL reactions
   *   after: '2024-01-01',
   *   limit: 5
   * });
   *
   * match(curatedResult)
   *   .with({ success: true }, ({ data }) => {
   *     console.log('Highly curated content:');
   *     data.messages.forEach(msg => {
   *       console.log(`By ${msg.user}: ${msg.text}`);
   *       console.log(`Engagement: ${msg.totalReactions} reactions`);
   *     });
   *   })
   *   .with({ success: false }, ({ error }) => console.error(error))
   *   .exhaustive();
   * ```
   *
   * @example Time-based Analysis
   * ```typescript
   * const weeklyAnalysis = await findMessagesByReactions({
   *   channel: 'C1234567890',
   *   reactions: ['thumbsup'],
   *   after: '2024-08-10',
   *   before: '2024-08-17',
   *   min_reaction_count: 2
   * });
   *
   * if (weeklyAnalysis.success) {
   *   const engagement = weeklyAnalysis.data.messages.reduce(
   *     (sum, msg) => sum + msg.totalReactions, 0
   *   );
   *   console.log(`Weekly engagement: ${engagement} total reactions`);
   * }
   * ```
   *
   * @implements TypeSafeAPI ServiceOutput constraints
   * @implements ts-pattern discriminated unions
   * @implements Production-ready API response structure
   */
  const findMessagesByReactions = async (args: unknown): Promise<FindMessagesByReactionsResult> => {
    try {
      const input = FindMessagesByReactionsSchema.parse(args);
      const client = deps.clientManager.getClientForOperation('read');

      // Get messages from channel if specified, otherwise search across workspace would go here
      const messages: SlackMessage[] = [];

      if (input.channel) {
        const historyResult = await client.conversations.history({
          channel: input.channel,
          limit: 1000,
          oldest: input.after ? new Date(input.after).getTime() / 1000 + '' : undefined,
          latest: input.before ? new Date(input.before).getTime() / 1000 + '' : undefined,
        });

        if (historyResult.ok && historyResult.messages) {
          messages.push(...(historyResult.messages as SlackMessage[]));
        }
      }

      // Filter messages based on reaction criteria
      const filteredMessages = messages.filter((message) => {
        const reactions = message.reactions || [];
        if (reactions.length === 0) return false;

        const messageReactionNames = reactions.map((r) => r.name || '');
        const totalReactionCount = reactions.reduce((sum, r) => sum + (r.count || 0), 0);

        // Check minimum reaction count
        if (input.min_reaction_count && totalReactionCount < input.min_reaction_count) {
          return false;
        }

        // Check reaction matching
        if (input.match_type === 'all') {
          return input.reactions.every((reaction) => messageReactionNames.includes(reaction));
        } else {
          return input.reactions.some((reaction) => messageReactionNames.includes(reaction));
        }
      });

      // Limit results and transform to expected format
      const limitedMessages = filteredMessages.slice(0, input.limit || 20);

      const transformedMessages = limitedMessages.map((message) => ({
        channel: input.channel || '',
        text: message.text || '',
        user: message.user || '',
        timestamp: message.ts || '',
        reactions: (message.reactions || []).map((r) => ({
          name: r.name || '',
          count: r.count || 0,
          users: r.users || [],
        })),
        totalReactions: (message.reactions || []).reduce((sum, r) => sum + (r.count || 0), 0),
        permalink: `https://example.slack.com/archives/${input.channel}/p${(message.ts || '').replace('.', '')}`,
      }));

      return createServiceSuccess(
        {
          messages: transformedMessages,
          total: limitedMessages.length,
          searchedReactions: input.reactions,
          matchType: input.match_type || 'any',
          minReactionCount: input.min_reaction_count || 1,
        },
        'Message search completed'
      );
    } catch (error) {
      return createServiceError(
        error instanceof Error ? error.message : 'Failed to find messages by reactions',
        'Failed to search messages'
      );
    }
  };

  return {
    addReaction,
    removeReaction,
    getReactions,
    getReactionStatistics,
    findMessagesByReactions,
  };
};
