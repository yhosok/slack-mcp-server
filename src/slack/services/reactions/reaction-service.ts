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
import { match } from 'ts-pattern';
import type { SlackMessage } from '../../types/index.js';
import type { SlackUser } from '../../types/core/users.js';
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
            // Use infrastructureUserService for lightweight display name operations
            const userDisplayNames = await Promise.all(
              users.map(async (userId: string) => {
                try {
                  return await deps.infrastructureUserService.getDisplayName(userId);
                } catch {
                  return userId; // Fallback to userId if display name fails
                }
              })
            );

            // Get enhanced user details with capabilities using domainUserService
            const userDetails = await Promise.all(
              users.map(async (userId: string) => {
                try {
                  const userResult = await deps.domainUserService.getUserInfo(userId);
                  if (userResult.success) {
                    const userInfo = userResult.data as SlackUser;
                    return {
                      id: userId,
                      name: userInfo.real_name || userInfo.name || userId,
                      // Enhanced user capabilities from SlackUser integration
                      isBot: userInfo.is_bot,
                      isAdmin: userInfo.is_admin,
                      isDeleted: userInfo.deleted,
                      isRestricted: userInfo.is_restricted,
                    };
                  } else {
                    // Fallback for failed user lookup
                    return {
                      id: userId,
                      name: userId,
                      isBot: false,
                      isAdmin: false,
                      isDeleted: false,
                      isRestricted: false,
                    };
                  }
                } catch {
                  // Fallback for any error
                  return {
                    id: userId,
                    name: userId,
                    isBot: false,
                    isAdmin: false,
                    isDeleted: false,
                    isRestricted: false,
                  };
                }
              })
            );
            // For backward compatibility, use display names but also include enhanced details
            users = userDisplayNames;

            return {
              name,
              count,
              users,
              // Include enhanced user details when full=true
              userDetails,
            };
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
   * channel-scoped and workspace-wide searches. Uses Slack Search API for workspace-wide
   * searches when no channel is specified, falling back to conversations.history for
   * channel-specific searches to maintain backward compatibility.
   *
   * Features:
   * - Workspace-wide search using Search API with 'has:' operators
   * - Channel-scoped search using conversations.history API
   * - Support for single and multiple reaction queries
   * - Boolean logic: 'any' (OR) and 'all' (AND) match types
   * - Time-based filtering with after/before parameters
   * - User token requirement checking for Search API operations
   * - Comprehensive error handling and graceful fallbacks
   *
   * @param args - Unknown input (validated at runtime using FindMessagesByReactionsSchema)
   * @returns Promise<FindMessagesByReactionsResult> - Type-safe result with matching messages
   *
   * @example Workspace-wide Search
   * ```typescript
   * const result = await findMessagesByReactions({
   *   reactions: ['fire', 'star', 'trophy'],
   *   match_type: 'any',
   *   min_reaction_count: 5,
   *   limit: 10
   *   // No channel = workspace search
   * });
   *
   * // Type-safe handling with ts-pattern
   * match(result)
   *   .with({ success: true }, ({ data }) => {
   *     console.log(`Found ${data.total} popular messages across workspace`);
   *     console.log(`Search method: ${data.searchMethod}`); // 'workspace_search'
   *
   *     data.messages.forEach(msg => {
   *       console.log(`Message: ${msg.text?.substring(0, 50)}...`);
   *       console.log(`Channel: ${msg.channelName || msg.channel}`);
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
   * @example Channel-specific Search (Backward Compatible)
   * ```typescript
   * const result = await findMessagesByReactions({
   *   channel: 'C1234567890',
   *   reactions: ['thumbsup', 'heart'],
   *   match_type: 'any',
   *   limit: 10
   * });
   *
   * if (result.success) {
   *   console.log(`Search method: ${result.data.searchMethod}`); // 'channel_history'
   *   console.log(`Found ${result.data.total} messages in channel`);
   * }
   * ```
   *
   * @example Complex Boolean Logic
   * ```typescript
   * // Find messages with ALL specified reactions (AND logic)
   * const curatedResult = await findMessagesByReactions({
   *   reactions: ['star', 'bookmark', 'point_up'],
   *   match_type: 'all',  // Must have ALL reactions
   *   after: '2024-01-01',
   *   before: '2024-12-31'
   * });
   * // Search query: "has:star has:bookmark has:point_up after:2024-01-01 before:2024-12-31"
   * ```
   *
   * @example Time-based Filtering
   * ```typescript
   * const timeFilteredResult = await findMessagesByReactions({
   *   reactions: ['calendar'],
   *   after: '2024-08-01',
   *   before: '2024-08-31'
   * });
   * // Search query: "has:calendar after:2024-08-01 before:2024-08-31"
   * ```
   *
   * @implements TypeSafeAPI ServiceOutput constraints
   * @implements ts-pattern discriminated unions
   * @implements Production-ready API response structure
   */
  const findMessagesByReactions = async (args: unknown): Promise<FindMessagesByReactionsResult> => {
    try {
      const input = FindMessagesByReactionsSchema.parse(args);

      // Determine search strategy based on channel parameter
      if (input.channel) {
        // Channel-specific search using existing conversations.history approach
        return await findMessagesByReactionsInChannel(input);
      } else {
        // Workspace-wide search using Search API
        return await findMessagesByReactionsWorkspaceWide(input);
      }
    } catch (error) {
      return createServiceError(
        error instanceof Error ? error.message : 'Failed to find messages by reactions',
        'Failed to search messages'
      );
    }
  };

  /**
   * Helper function: Channel-specific reaction search using conversations.history API
   * Maintains backward compatibility with existing behavior
   */
  const findMessagesByReactionsInChannel = async (
    input: ReturnType<typeof FindMessagesByReactionsSchema.parse>
  ): Promise<FindMessagesByReactionsResult> => {
    const client = deps.clientManager.getClientForOperation('read');
    const messages: SlackMessage[] = [];

    const historyResult = await client.conversations.history({
      channel: input.channel!,
      limit: 1000,
      oldest: input.after ? new Date(input.after).getTime() / 1000 + '' : undefined,
      latest: input.before ? new Date(input.before).getTime() / 1000 + '' : undefined,
    });

    if (historyResult.ok && historyResult.messages) {
      messages.push(...(historyResult.messages as SlackMessage[]));
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
      channel: input.channel!,
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
        searchMethod: 'channel_history',
      },
      'Channel message search completed'
    );
  };

  /**
   * Helper function: Workspace-wide reaction search using Message Service
   * Delegates to message service for consistent search infrastructure
   */
  const findMessagesByReactionsWorkspaceWide = async (
    input: ReturnType<typeof FindMessagesByReactionsSchema.parse>
  ): Promise<FindMessagesByReactionsResult> => {
    try {
      // Build reaction search query using Slack search operators
      const reactionQuery = buildReactionSearchQuery(input);

      // Delegate to message service's searchMessages method
      const searchResult = await deps.messageService.searchMessages({
        query: reactionQuery,
        count: input.limit || 20,
        // Include time filters if specified - message service handles these automatically
        ...(input.after && { after: input.after }),
        ...(input.before && { before: input.before }),
      });

      // Transform message search result to reaction search result format
      return match(searchResult)
        .with({ success: true }, (success) => {
          // Transform messages from MessageSearchResult to FindMessagesByReactionsResult format
          const transformedMessages = success.data.messages.map(msg => ({
            channel: msg.channel || '',
            channelName: '', // Message service doesn't provide channel names in search results
            text: msg.text || '',
            user: msg.user || '',
            username: msg.userDisplayName || msg.user || '', // Use display name when available
            timestamp: msg.ts || '',
            permalink: msg.permalink || '',
            reactions: [], // Search API doesn't return reaction details
            totalReactions: 0, // Would need separate API call to get reaction counts
            searchMatch: true, // Indicates this came from search, not history
          }));

          return createServiceSuccess(
            {
              messages: transformedMessages,
              total: success.data.total,
              searchedReactions: input.reactions,
              matchType: input.match_type || 'any',
              minReactionCount: input.min_reaction_count || 1,
              searchMethod: 'workspace_search' as const,
            },
            'Workspace reaction search completed'
          );
        })
        .with({ success: false }, (error) => {
          // Transform message service error to reaction service error
          return createServiceError(
            error.error,
            error.message || 'Failed to perform workspace reaction search'
          );
        })
        .exhaustive();
    } catch (error) {
      return createServiceError(
        error instanceof Error ? error.message : 'Workspace search failed',
        'Failed to perform workspace reaction search'
      );
    }
  };

  /**
   * Helper function: Build Slack Search API query for reaction searches
   * Supports both 'any' (OR) and 'all' (AND) match types
   * Time filtering is handled by message service, so we only build reaction operators
   */
  const buildReactionSearchQuery = (
    input: ReturnType<typeof FindMessagesByReactionsSchema.parse>
  ): string => {
    const reactionQueries = input.reactions.map(reaction => `has:${reaction}`);
    
    if (input.match_type === 'all') {
      // AND logic: all reactions must be present
      return reactionQueries.join(' ');
    } else {
      // OR logic (default): any reaction can be present
      if (reactionQueries.length === 1) {
        return reactionQueries[0] || '';
      } else {
        return reactionQueries.join(' OR ');
      }
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
