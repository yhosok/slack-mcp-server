import type { ReactionsGetArguments } from '@slack/web-api';
import type { SlackMessage } from '../../types.js';
import {
  AddReactionSchema,
  RemoveReactionSchema,
  GetReactionsSchema,
  GetReactionStatisticsSchema,
  FindMessagesByReactionsSchema,
} from '../../../utils/validation.js';
import type { ReactionService, ReactionServiceDependencies } from './types.js';
import { formatAddReactionResponse } from '../formatters/text-formatters.js';

// Export types for external use
export type { ReactionService, ReactionServiceDependencies } from './types.js';
import { SlackAPIError } from '../../../utils/errors.js';

/**
 * Create reaction service with infrastructure dependencies
 * @param deps - Infrastructure dependencies
 * @returns Reaction service instance
 */
export const createReactionService = (deps: ReactionServiceDependencies): ReactionService => {
  /**
   * Add a reaction emoji to a message
   */
  const addReaction = (args: unknown) =>
    deps.requestHandler.handleWithCustomFormat(AddReactionSchema, args, async (input) => {
      const client = deps.clientManager.getClientForOperation('write');

      const result = await client.reactions.add({
        channel: input.channel,
        timestamp: input.message_ts,
        name: input.reaction_name,
      });

      return formatAddReactionResponse({
        success: result.ok || false,
        channel: input.channel,
        timestamp: input.message_ts,
        reaction: input.reaction_name,
      });
    });

  /**
   * Remove a reaction emoji from a message
   */
  const removeReaction = (args: unknown) =>
    deps.requestHandler.handle(RemoveReactionSchema, args, async (input) => {
      const client = deps.clientManager.getClientForOperation('write');

      const result = await client.reactions.remove({
        channel: input.channel,
        timestamp: input.message_ts,
        name: input.reaction_name,
      });

      return {
        success: result.ok || false,
        channel: input.channel,
        messageTs: input.message_ts,
        reaction: input.reaction_name,
        message: result.ok ? 'Reaction removed successfully' : 'Failed to remove reaction',
      };
    });

  /**
   * Get all reactions on a specific message
   */
  const getReactions = (args: unknown) =>
    deps.requestHandler.handle(GetReactionsSchema, args, async (input) => {
      const client = deps.clientManager.getClientForOperation('read');

      const getArgs: ReactionsGetArguments = {
        channel: input.channel,
        timestamp: input.message_ts,
        full: input.full,
      };

      const result = await client.reactions.get(getArgs);

      if (!result.message) {
        throw new SlackAPIError('Message not found or no reactions');
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

      return {
        channel: input.channel,
        messageTs: input.message_ts,
        reactions: processedReactions,
        totalReactions: processedReactions.reduce((sum, r) => sum + r.count, 0),
      };
    });

  /**
   * Get reaction statistics and trends for workspace or channel
   */
  const getReactionStatistics = (args: unknown) =>
    deps.requestHandler.handle(GetReactionStatisticsSchema, args, async (input) => {
      const client = deps.clientManager.getClientForOperation('read');

      // Calculate time range
      const now = new Date();
      const daysBack = input.days_back || 30;
      const fromTime = Math.floor((now.getTime() - daysBack * 24 * 60 * 60 * 1000) / 1000);

      let allMessages: SlackMessage[] = [];

      if (input.channel) {
        // Get messages from specific channel
        const historyResult = await client.conversations.history({
          channel: input.channel,
          oldest: fromTime.toString(),
          limit: 1000,
        });
        allMessages = (historyResult.messages || []).map((msg) => ({
          type: msg.type || '',
          user: msg.user || '',
          text: msg.text || '',
          ts: msg.ts || '',
          reactions: (msg.reactions || []).map((r) => ({
            name: r.name || '',
            count: r.count || 0,
            users: r.users || [],
          })),
        }));
      } else {
        // For workspace-wide stats, we need to check multiple channels
        // This is a simplified implementation - in practice, you'd want to
        // iterate through all channels the bot has access to
        const channelsResult = await client.conversations.list({
          exclude_archived: true,
          limit: 100,
        });

        if (channelsResult.channels) {
          const channels = channelsResult.channels.slice(0, 10); // Limit for performance
          for (const channel of channels) {
            if (channel.id) {
              try {
                const historyResult = await client.conversations.history({
                  channel: channel.id,
                  oldest: fromTime.toString(),
                  limit: 100, // Reduced limit per channel
                });
                const messages = (historyResult.messages || []).map((msg) => ({
                  type: msg.type || '',
                  user: msg.user || '',
                  text: msg.text || '',
                  ts: msg.ts || '',
                  reactions: (msg.reactions || []).map((r) => ({
                    name: r.name || '',
                    count: r.count || 0,
                    users: r.users || [],
                  })),
                }));
                allMessages.push(...messages);
              } catch {
                // Skip channels we can't access
              }
            }
          }
        }
      }

      // Filter for user-specific stats if requested
      if (input.user) {
        allMessages = allMessages.filter((msg) => msg.user === input.user);
      }

      // Collect reaction statistics
      const stats = {
        totalMessages: allMessages.length,
        messagesWithReactions: 0,
        totalReactions: 0,
        uniqueReactions: new Set<string>(),
        reactionCounts: new Map<string, number>(),
        userReactionCounts: new Map<string, number>(),
        dailyTrends: new Map<string, number>(),
        topReactors: new Map<string, number>(),
        topMessages: [] as Array<{
          text: string;
          user?: string;
          timestamp?: string;
          totalReactions: number;
          reactions: Array<{ name: string; count: number; users?: string[] }>;
        }>,
      };

      for (const message of allMessages) {
        if (message.reactions && message.reactions.length > 0) {
          stats.messagesWithReactions++;

          for (const reaction of message.reactions) {
            const reactionName = reaction.name;
            const count = reaction.count || 0;

            stats.totalReactions += count;
            stats.uniqueReactions.add(reactionName);
            stats.reactionCounts.set(
              reactionName,
              (stats.reactionCounts.get(reactionName) || 0) + count
            );

            // Track users who reacted
            for (const user of reaction.users || []) {
              stats.userReactionCounts.set(user, (stats.userReactionCounts.get(user) || 0) + 1);
              stats.topReactors.set(user, (stats.topReactors.get(user) || 0) + 1);
            }
          }

          // Track messages with high reaction counts for "top messages"
          const totalMessageReactions = message.reactions.reduce(
            (sum: number, r: { count?: number }) => sum + (r.count || 0),
            0
          );
          if (totalMessageReactions > 2) {
            // Threshold for "popular" messages
            stats.topMessages.push({
              text: message.text
                ? message.text.substring(0, 100) + (message.text.length > 100 ? '...' : '')
                : 'No text',
              user: message.user,
              timestamp: message.ts,
              totalReactions: totalMessageReactions,
              reactions: message.reactions,
            });
          }

          // Daily trends
          if (input.include_trends && message.ts) {
            try {
              const date = new Date(parseFloat(message.ts || '0') * 1000)
                .toISOString()
                .split('T')[0];
              const currentCount = stats.dailyTrends.get(date || '') || 0;
              stats.dailyTrends.set(date || '', currentCount + totalMessageReactions);
            } catch (error) {
              // Skip invalid timestamps
            }
          }
        }
      }

      // Sort top messages by reaction count
      stats.topMessages.sort((a, b) => b.totalReactions - a.totalReactions);
      stats.topMessages = stats.topMessages.slice(0, input.top_count || 10);

      // Convert Maps to arrays for JSON serialization
      const topReactions = Array.from(stats.reactionCounts.entries())
        .sort(([, a], [, b]) => b - a)
        .slice(0, input.top_count || 10)
        .map(([name, count]) => ({ name, count }));

      const topReactors = Array.from(stats.topReactors.entries())
        .sort(([, a], [, b]) => b - a)
        .slice(0, input.top_count || 10)
        .map(([user, count]) => ({ user, count }));

      const dailyTrends = input.include_trends
        ? Array.from(stats.dailyTrends.entries()).map(([date, count]) => ({ date, count }))
        : [];

      return {
        summary: {
          totalMessages: stats.totalMessages,
          messagesWithReactions: stats.messagesWithReactions,
          totalReactions: stats.totalReactions,
          uniqueReactions: stats.uniqueReactions.size,
          reactionRate:
            stats.totalMessages > 0 ? stats.messagesWithReactions / stats.totalMessages : 0,
        },
        topReactions,
        topReactors,
        topMessages: stats.topMessages,
        dailyTrends,
        analysisperiod: {
          daysBack,
          channel: input.channel,
          user: input.user,
        },
      };
    });

  /**
   * Find messages that have specific reaction patterns
   */
  const findMessagesByReactions = (args: unknown) =>
    deps.requestHandler.handle(FindMessagesByReactionsSchema, args, async (input) => {
      const client = deps.clientManager.getClientForOperation('read');

      // Calculate time range if provided
      let oldest: string | undefined;
      let latest: string | undefined;

      if (input.after) {
        oldest = Math.floor(new Date(input.after).getTime() / 1000).toString();
      }
      if (input.before) {
        latest = Math.floor(new Date(input.before).getTime() / 1000).toString();
      }

      let allMessages: Array<SlackMessage & { channel?: string; channelName?: string }> = [];

      if (input.channel) {
        // Search in specific channel
        const historyResult = await client.conversations.history({
          channel: input.channel,
          limit: 1000,
          oldest,
          latest,
        });
        allMessages = (historyResult.messages || []).map((msg) => ({
          type: msg.type || '',
          user: msg.user || '',
          text: msg.text || '',
          ts: msg.ts || '',
          reactions: (msg.reactions || []).map((r) => ({
            name: r.name || '',
            count: r.count || 0,
            users: r.users || [],
          })),
        }));
      } else {
        // Search across accessible channels
        const channelsResult = await client.conversations.list({
          exclude_archived: true,
          limit: 50,
        });

        if (channelsResult.channels) {
          const channels = channelsResult.channels.slice(0, 10); // Limit for performance
          for (const channel of channels) {
            if (channel.id) {
              try {
                const historyResult = await client.conversations.history({
                  channel: channel.id,
                  limit: 100,
                  oldest,
                  latest,
                });

                const messagesWithChannel = (historyResult.messages || []).map((msg) => ({
                  type: msg.type || '',
                  user: msg.user || '',
                  text: msg.text || '',
                  ts: msg.ts || '',
                  reactions: (msg.reactions || []).map((r) => ({
                    name: r.name || '',
                    count: r.count || 0,
                    users: r.users || [],
                  })),
                  channel: channel.id,
                  channelName: channel.name,
                }));

                allMessages.push(...messagesWithChannel);
              } catch {
                // Skip channels we can't access
              }
            }
          }
        }
      }

      // Filter messages that have the specified reactions
      const matchingMessages = [];

      for (const message of allMessages) {
        if (!message.reactions || message.reactions.length === 0) continue;

        const messageReactions = message.reactions.map((r: { name: string }) => r.name);
        const totalReactionCount = message.reactions.reduce(
          (sum: number, r: { count?: number }) => sum + (r.count || 0),
          0
        );

        // Check if message meets reaction count threshold
        if (totalReactionCount < (input.min_reaction_count || 1)) continue;

        // Check reaction matching criteria
        let matches = false;
        if (input.match_type === 'all') {
          // All specified reactions must be present
          matches = input.reactions.every((reaction) => messageReactions.includes(reaction));
        } else {
          // Any of the specified reactions must be present (default)
          matches = input.reactions.some((reaction) => messageReactions.includes(reaction));
        }

        if (matches) {
          // Get user display name
          let userName = message.user;
          if (message.user) {
            try {
              const userInfo = await deps.userService.getUserInfo(message.user);
              userName = userInfo.displayName;
            } catch {
              // Keep original user ID if lookup fails
            }
          }

          matchingMessages.push({
            channel: message.channel || input.channel,
            channelName: message.channelName,
            messageTs: message.ts,
            user: message.user,
            userName,
            text: message.text,
            reactions: message.reactions,
            totalReactionCount,
            matchingReactions: input.reactions.filter((r) => messageReactions.includes(r)),
            timestamp: message.ts,
          });
        }
      }

      // Sort by total reaction count (descending)
      matchingMessages.sort((a, b) => b.totalReactionCount - a.totalReactionCount);

      // Limit results
      const limitedResults = matchingMessages.slice(0, input.limit || 20);

      return {
        messages: limitedResults,
        total: matchingMessages.length,
        criteria: {
          reactions: input.reactions,
          matchType: input.match_type || 'any',
          minReactionCount: input.min_reaction_count || 1,
        },
        timeRange: {
          after: input.after,
          before: input.before,
        },
      };
    });

  return {
    addReaction,
    removeReaction,
    getReactions,
    getReactionStatistics,
    findMessagesByReactions,
  };
};
