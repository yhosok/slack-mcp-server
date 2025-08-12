import type { SearchAllArguments } from '@slack/web-api';
import {
  SendMessageSchema,
  ListChannelsSchema,
  GetChannelHistorySchema,
  GetUserInfoSchema,
  SearchMessagesSchema,
  GetChannelInfoSchema,
} from '../../../utils/validation.js';
import type { MessageService, MessageServiceDependencies } from './types.js';
import {
  formatSendMessageResponse,
  formatChannelHistoryResponse,
  formatSearchMessagesResponse,
} from '../formatters/text-formatters.js';
import { executePagination } from '../../infrastructure/generic-pagination.js';

// Export types for external use
export type { MessageService, MessageServiceDependencies } from './types.js';
import { SlackAPIError } from '../../../utils/errors.js';

/**
 * Create message service with infrastructure dependencies
 * @param deps - Infrastructure dependencies
 * @returns Message service instance
 */
export const createMessageService = (deps: MessageServiceDependencies): MessageService => {
  /**
   * Send a message to a channel or user
   */
  const sendMessage = (args: unknown) =>
    deps.requestHandler.handleWithCustomFormat(SendMessageSchema, args, async (input) => {
      const client = deps.clientManager.getClientForOperation('write');

      try {
        const result = await client.chat.postMessage({
          channel: input.channel,
          text: input.text,
          thread_ts: input.thread_ts,
        });

        if (!result.ok) {
          throw new SlackAPIError(`Failed to send message: ${result.error}`);
        }

        return formatSendMessageResponse({
          success: true,
          timestamp: result.ts,
          channel: result.channel,
          message: result.message,
        });
      } catch (error) {
        if (error instanceof SlackAPIError) {
          throw error;
        }

        throw new SlackAPIError(`Failed to send message: ${error}`);
      }
    });

  /**
   * List channels in the workspace
   */
  const listChannels = (args: unknown) =>
    deps.requestHandler.handle(ListChannelsSchema, args, async (input) => {
      const client = deps.clientManager.getClientForOperation('read');

      const result = await client.conversations.list({
        types: input.types,
        exclude_archived: input.exclude_archived,
        limit: 1000,
      });

      if (!result.channels) {
        throw new SlackAPIError('Failed to retrieve channels');
      }

      return {
        channels: result.channels.map((channel) => ({
          id: channel.id,
          name: channel.name,
          isPrivate: channel.is_private,
          isMember: channel.is_member,
          isArchived: channel.is_archived,
          memberCount: channel.num_members,
          topic: channel.topic?.value,
          purpose: channel.purpose?.value,
        })),
        total: result.channels.length,
      };
    });

  /**
   * Get message history from a channel
   */
  const getChannelHistory = (args: unknown) =>
    deps.requestHandler.handleWithCustomFormat(GetChannelHistorySchema, args, async (input) => {
      const client = deps.clientManager.getClientForOperation('read');

      // Use unified pagination implementation
      return await executePagination(input, {
        fetchPage: async (cursor?: string) => {
          const result = await client.conversations.history({
            channel: input.channel,
            limit: input.limit,
            cursor,
            oldest: input.oldest,
            latest: input.latest,
          });

          if (!result.messages) {
            throw new SlackAPIError(`Failed to retrieve channel history${cursor ? ` (page with cursor: ${cursor.substring(0, 10)}...)` : ''}`);
          }

          return result;
        },

        getCursor: (response) => response.response_metadata?.next_cursor,
        
        getItems: (response) => response.messages || [],
        
        formatResponse: (data) => {
          const messages = data.items.map((message: any) => ({
            type: message.type,
            user: message.user,
            text: message.text,
            timestamp: message.ts,
            threadTs: message.thread_ts,
            replyCount: message.reply_count,
            reactions: message.reactions,
            edited: message.edited,
            files: message.files,
          }));

          return formatChannelHistoryResponse(
            {
              messages,
              hasMore: data.hasMore,
              cursor: data.cursor,
              pageCount: data.pageCount,
              totalMessages: messages.length,
            },
            deps.userService.getDisplayName
          );
        },
      });
    });

  /**
   * Get information about a user
   */
  const getUserInfo = (args: unknown) =>
    deps.requestHandler.handle(GetUserInfoSchema, args, async (input) => {
      const client = deps.clientManager.getClientForOperation('read');

      // Get user display name from cache or API
      const displayName = await deps.userService.getDisplayName(input.user);

      // Get detailed user info from API
      const result = await client.users.info({
        user: input.user,
      });

      if (!result.user) {
        throw new SlackAPIError('User not found');
      }

      return {
        id: result.user.id,
        name: result.user.name,
        displayName,
        realName: result.user.real_name,
        email: result.user.profile?.email,
        isBot: result.user.is_bot,
        isAdmin: result.user.is_admin,
        isOwner: result.user.is_owner,
        deleted: result.user.deleted,
        profile: {
          image24: result.user.profile?.image_24,
          image32: result.user.profile?.image_32,
          image48: result.user.profile?.image_48,
          image72: result.user.profile?.image_72,
          image192: result.user.profile?.image_192,
          image512: result.user.profile?.image_512,
          statusText: result.user.profile?.status_text,
          statusEmoji: result.user.profile?.status_emoji,
          title: result.user.profile?.title,
        },
      };
    });

  /**
   * Search for messages in the workspace
   */
  const searchMessages = (args: unknown) =>
    deps.requestHandler.handleWithCustomFormat(SearchMessagesSchema, args, async (input) => {
      // Check if search API is available
      deps.clientManager.checkSearchApiAvailability(
        'searchMessages',
        'Use channel history or conversation search'
      );

      const client = deps.clientManager.getClientForOperation('read');

      const searchArgs: SearchAllArguments = {
        query: input.query,
        sort: input.sort,
        sort_dir: input.sort_dir,
        count: input.count,
        page: input.page,
        highlight: input.highlight,
      };

      const result = await client.search.messages(searchArgs);

      if (!result.messages) {
        return await formatSearchMessagesResponse(
          {
            results: [],
            total: 0,
            query: input.query,
          },
          deps.userService.getDisplayName
        );
      }

      return await formatSearchMessagesResponse(
        {
          results: result.messages.matches || [],
          total: result.messages.total || 0,
          query: input.query,
          page: result.messages.paging?.page,
          pages: result.messages.paging?.pages,
        },
        deps.userService.getDisplayName
      );
    });

  /**
   * Get detailed information about a channel
   */
  const getChannelInfo = (args: unknown) =>
    deps.requestHandler.handle(GetChannelInfoSchema, args, async (input) => {
      const client = deps.clientManager.getClientForOperation('read');

      const result = await client.conversations.info({
        channel: input.channel,
      });

      if (!result.channel) {
        throw new SlackAPIError('Channel not found');
      }

      return {
        id: result.channel.id,
        name: result.channel.name,
        isChannel: result.channel.is_channel,
        isGroup: result.channel.is_group,
        isPrivate: result.channel.is_private,
        isArchived: result.channel.is_archived,
        created: result.channel.created,
        creator: result.channel.creator,
        topic: result.channel.topic,
        purpose: result.channel.purpose,
        memberCount: result.channel.num_members,
        members: (result.channel as any)?.members,
      };
    });

  return {
    sendMessage,
    listChannels,
    getChannelHistory,
    getUserInfo,
    searchMessages,
    getChannelInfo,
  };
};
