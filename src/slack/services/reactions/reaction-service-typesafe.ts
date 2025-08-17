/**
 * TypeSafeAPI Reaction Service
 * 
 * Provides type-safe reaction operations using TypeSafeAPI + ts-pattern patterns
 * Returns discriminated union ServiceResult types for type-safe error handling
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
import type { 
  ReactionService, 
  ReactionServiceDependencies
} from './types.js';
import type {
  AddReactionResult,
  RemoveReactionResult,
  GetReactionsResult,
  ReactionStatisticsResult,
  FindMessagesByReactionsResult
} from '../../types/outputs/reactions.js';
import { SlackAPIError } from '../../../utils/errors.js';
import {
  createServiceSuccess,
  createServiceError,
  type ServiceResult,
} from '../../types/typesafe-api-patterns.js';

/**
 * Create TypeSafeAPI reaction service with infrastructure dependencies
 * @param deps - Infrastructure dependencies
 * @returns TypeSafeAPI reaction service instance
 */
export const createReactionServiceTypeSafeAPI = (deps: ReactionServiceDependencies): ReactionService => {
  /**
   * Add a reaction emoji to a message
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

      return createServiceSuccess({
        success: result.ok || false,
        channel: input.channel,
        message_ts: input.message_ts,
        reaction_name: input.reaction_name,
        message: result.ok ? 'Reaction added successfully' : 'Failed to add reaction',
      }, 'Reaction operation completed');
    } catch (error) {
      return createServiceError(
        error instanceof Error ? error.message : 'Failed to add reaction',
        'Failed to add reaction'
      );
    }
  };

  /**
   * Remove a reaction emoji from a message
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

      return createServiceSuccess({
        success: result.ok || false,
        channel: input.channel,
        message_ts: input.message_ts,
        reaction_name: input.reaction_name,
        message: result.ok ? 'Reaction removed successfully' : 'Failed to remove reaction',
      }, 'Reaction removal completed');
    } catch (error) {
      return createServiceError(
        error instanceof Error ? error.message : 'Failed to remove reaction',
        'Failed to remove reaction'
      );
    }
  };

  /**
   * Get all reactions on a specific message
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
      
      return createServiceSuccess({
        reactions: processedReactions,
        message: {
          type: result.message.type || '',
          user: result.message.user || '',
          text: result.message.text || '',
          ts: result.message.ts || '',
        },
        channel: input.channel,
        totalReactions,
      }, 'Reactions retrieved successfully');
    } catch (error) {
      return createServiceError(
        error instanceof Error ? error.message : 'Failed to get reactions',
        'Failed to retrieve reactions'
      );
    }
  };

  /**
   * Get reaction statistics and trends for workspace or channel
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
          for (const channel of channelsResult.channels.slice(0, 10)) { // Limit to 10 channels for performance
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
      
      allMessages.forEach(message => {
        if (message.reactions) {
          message.reactions.forEach(reaction => {
            const name = reaction.name || '';
            const count = reaction.count || 0;
            reactionCounts[name] = (reactionCounts[name] || 0) + count;
            totalReactions += count;
            
            (reaction.users || []).forEach(userId => {
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
      
      return createServiceSuccess({
        totalReactions,
        topReactions,
        topUsers,
        trends,
        period: `${daysBack} days`,
      }, 'Reaction statistics calculated');
    } catch (error) {
      return createServiceError(
        error instanceof Error ? error.message : 'Failed to get reaction statistics',
        'Failed to retrieve reaction statistics'
      );
    }
  };

  /**
   * Find messages that have specific reaction patterns
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
      const filteredMessages = messages.filter(message => {
        const reactions = message.reactions || [];
        if (reactions.length === 0) return false;
        
        const messageReactionNames = reactions.map(r => r.name || '');
        const totalReactionCount = reactions.reduce((sum, r) => sum + (r.count || 0), 0);
        
        // Check minimum reaction count
        if (input.min_reaction_count && totalReactionCount < input.min_reaction_count) {
          return false;
        }
        
        // Check reaction matching
        if (input.match_type === 'all') {
          return input.reactions.every(reaction => messageReactionNames.includes(reaction));
        } else {
          return input.reactions.some(reaction => messageReactionNames.includes(reaction));
        }
      });
      
      // Limit results and transform to expected format
      const limitedMessages = filteredMessages.slice(0, input.limit || 20);
      
      const transformedMessages = limitedMessages.map(message => ({
        channel: input.channel || '',
        text: message.text || '',
        user: message.user || '',
        timestamp: message.ts || '',
        reactions: (message.reactions || []).map(r => ({
          name: r.name || '',
          count: r.count || 0,
          users: r.users || [],
        })),
        totalReactions: (message.reactions || []).reduce((sum, r) => sum + (r.count || 0), 0),
        permalink: `https://example.slack.com/archives/${input.channel}/p${(message.ts || '').replace('.', '')}`,
      }));
      
      return createServiceSuccess({
        messages: transformedMessages,
        total: limitedMessages.length,
        searchedReactions: input.reactions,
        matchType: input.match_type || 'any',
        minReactionCount: input.min_reaction_count || 1,
      }, 'Message search completed');
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