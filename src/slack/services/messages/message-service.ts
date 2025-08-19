import type { SearchAllArguments } from '@slack/web-api';
import type { MessageElement } from '@slack/web-api/dist/types/response/ConversationsHistoryResponse.js';
import type { Match as SearchMessageElement } from '@slack/web-api/dist/types/response/SearchMessagesResponse.js';
import {
  SendMessageSchema,
  ListChannelsSchema,
  GetChannelHistorySchema,
  SearchMessagesSchema,
  GetChannelInfoSchema,
  validateInput,
} from '../../../utils/validation.js';
import type { MessageService, MessageServiceDependencies } from './types.js';
import {
  formatSendMessageResponse,
  formatChannelHistoryResponse as _formatChannelHistoryResponse,
  formatSearchMessagesResponse as _formatSearchMessagesResponse,
} from '../formatters/text-formatters.js';
import { executePagination } from '../../infrastructure/generic-pagination.js';
import {
  createServiceSuccess,
  createServiceError,
  enforceServiceOutput,
  type ServiceErrorType as _ServiceErrorType,
  createTypedServiceError as _createTypedServiceError,
} from '../../types/typesafe-api-patterns.js';
import type {
  SendMessageResult,
  MessageSearchResult,
  ChannelHistoryResult,
  ListChannelsResult,
  ChannelInfoResult,
  SendMessageOutput,
  MessageSearchOutput,
  ChannelHistoryOutput,
  ListChannelsOutput,
  ChannelInfoOutput,
} from '../../types/outputs/messages.js';

// Export types for external use
export type { MessageService, MessageServiceDependencies } from './types.js';
import { SlackAPIError } from '../../../utils/errors.js';

/**
 * Create message service with infrastructure dependencies
 *
 * Factory function that creates a TypeSafeAPI-compliant message service with
 * full type safety, error handling, and integration with existing infrastructure.
 *
 * Features:
 * - Type-safe operations with discriminated union results
 * - Automatic input validation using Zod schemas
 * - Consistent error handling with ServiceResult patterns
 * - Integration with Slack Web API client management
 * - Support for both bot and user token operations
 *
 * @param deps - Infrastructure dependencies (client manager, rate limiter, etc.)
 * @returns Message service instance with TypeSafeAPI + ts-pattern type safety
 *
 * @example Service Creation
 * ```typescript
 * const messageService = createMessageService({
 *   clientManager,
 *   rateLimitTracker,
 *   requestHandler,
 *   userService
 * });
 *
 * const result = await messageService.sendMessage({
 *   channel: 'C1234567890',
 *   text: 'Hello, world!'
 * });
 *
 * match(result)
 *   .with({ success: true }, (success) => console.log('Sent:', success.data))
 *   .with({ success: false }, (error) => console.error('Failed:', error.error))
 *   .exhaustive();
 * ```
 */
export const createMessageService = (deps: MessageServiceDependencies): MessageService => {
  /**
   * Send a message to a channel or user with TypeSafeAPI + ts-pattern type safety
   *
   * Sends a text message to a Slack channel, direct message, or thread.
   * Uses bot token for write operations and includes comprehensive error handling.
   *
   * @param args - Unknown input (validated at runtime using SendMessageSchema)
   * @returns ServiceResult with send confirmation or error details
   *
   * @example Basic Message
   * ```typescript
   * const result = await sendMessage({
   *   channel: 'C1234567890',
   *   text: 'Hello, team!'
   * });
   * ```
   *
   * @example Thread Reply
   * ```typescript
   * const result = await sendMessage({
   *   channel: 'C1234567890',
   *   text: 'Reply to this thread',
   *   thread_ts: '1234567890.123456'
   * });
   * ```
   *
   * @example Error Handling
   * ```typescript
   * const result = await sendMessage(args);
   * if (!result.success) {
   *   console.error(`Send failed: ${result.error}`);
   *   // Handle specific error cases
   * }
   * ```
   */
  const sendMessage = async (args: unknown): Promise<SendMessageResult> => {
    try {
      // Validate input using TypeSafeAPI validation pattern
      const input = validateInput(SendMessageSchema, args);

      const client = deps.clientManager.getClientForOperation('write');

      const result = await client.chat.postMessage({
        channel: input.channel,
        text: input.text,
        thread_ts: input.thread_ts,
      });

      if (!result.ok) {
        return createServiceError(
          `Failed to send message: ${result.error}`,
          'Message delivery failed'
        );
      }

      // Create TypeSafeAPI-compliant output using existing formatter
      const formattedResponse = await formatSendMessageResponse({
        success: true,
        timestamp: result.ts,
        channel: result.channel,
        message: result.message,
      });

      // Ensure ServiceOutput compliance and create type-safe success result
      const output: SendMessageOutput = enforceServiceOutput({
        success: true,
        channel: result.channel || input.channel,
        ts: result.ts || '',
        message: 'Message sent successfully',
        ...formattedResponse,
      });

      return createServiceSuccess(output, 'Message sent successfully');
    } catch (error) {
      if (error instanceof SlackAPIError) {
        return createServiceError(error.message, 'Message delivery failed');
      }

      return createServiceError(
        `Failed to send message: ${error}`,
        'Unexpected error during message delivery'
      );
    }
  };

  /**
   * List channels in the workspace with TypeSafeAPI + ts-pattern type safety
   */
  const listChannels = async (args: unknown): Promise<ListChannelsResult> => {
    try {
      // Validate input using TypeSafeAPI validation pattern
      const input = validateInput(ListChannelsSchema, args);

      const client = deps.clientManager.getClientForOperation('read');

      // Use unified pagination implementation
      const paginationResult = await executePagination(input, {
        fetchPage: async (cursor?: string) => {
          const result = await client.conversations.list({
            types: input.types,
            exclude_archived: input.exclude_archived,
            limit: input.limit,
            cursor,
          });

          if (!result.channels) {
            throw new SlackAPIError(
              `Failed to retrieve channels${cursor ? ` (page with cursor: ${cursor.substring(0, 10)}...)` : ''}`
            );
          }

          return result;
        },

        getCursor: (response) => response.response_metadata?.next_cursor,

        getItems: (response) => response.channels || [],

        formatResponse: async (data) => {
          let channels = data.items.map((channel) => ({
            id: channel.id || '',
            name: channel.name || '',
            isPrivate: channel.is_private || false,
            isMember: channel.is_member || false,
            isArchived: channel.is_archived || false,
            memberCount: channel.num_members,
            topic: channel.topic?.value,
            purpose: channel.purpose?.value,
          }));

          // Apply name filter if specified (client-side filtering)
          if (input.name_filter) {
            const filterLower = input.name_filter.toLowerCase();
            channels = channels.filter((channel) =>
              channel.name.toLowerCase().includes(filterLower)
            );
          }

          // Create TypeSafeAPI-compliant output
          const output: ListChannelsOutput = enforceServiceOutput({
            channels,
            total: channels.length,
            hasMore: data.hasMore,
            responseMetadata: data.cursor ? { nextCursor: data.cursor } : undefined,
            filteredBy: input.name_filter ? `name contains "${input.name_filter}"` : undefined,
          });

          return output;
        },
      });

      return createServiceSuccess(
        paginationResult as ListChannelsOutput,
        'Channels retrieved successfully'
      );
    } catch (error) {
      if (error instanceof SlackAPIError) {
        return createServiceError(error.message, 'Failed to retrieve channels');
      }

      return createServiceError(
        `Failed to list channels: ${error}`,
        'Unexpected error during channel retrieval'
      );
    }
  };

  /**
   * Get message history from a channel with TypeSafeAPI + ts-pattern type safety
   */
  const getChannelHistory = async (args: unknown): Promise<ChannelHistoryResult> => {
    try {
      // Validate input using TypeSafeAPI validation pattern
      const input = validateInput(GetChannelHistorySchema, args);

      const client = deps.clientManager.getClientForOperation('read');

      // Use unified pagination implementation
      const paginationResult = await executePagination(input, {
        fetchPage: async (cursor?: string) => {
          const result = await client.conversations.history({
            channel: input.channel,
            limit: input.limit,
            cursor,
            oldest: input.oldest,
            latest: input.latest,
          });

          if (!result.messages) {
            throw new SlackAPIError(
              `Failed to retrieve channel history${cursor ? ` (page with cursor: ${cursor.substring(0, 10)}...)` : ''}`
            );
          }

          return result;
        },

        getCursor: (response) => response.response_metadata?.next_cursor,

        getItems: (response) => response.messages || [],

        formatResponse: async (data) => {
          // Phase 5: Apply Phase 3 success pattern for display name conversion
          // Get all unique user IDs for efficient bulk display name retrieval
          const uniqueUserIds = [
            ...new Set(
              data.items
                .map((message: MessageElement) => message.user)
                .filter((user): user is string => Boolean(user))
            ),
          ];

          // Use Phase 3 pattern: bulkGetDisplayNames for efficient display name conversion
          const displayNameMap =
            uniqueUserIds.length > 0
              ? await deps.userService.bulkGetDisplayNames(uniqueUserIds)
              : new Map<string, string>();

          const messages = data.items.map((message: MessageElement) => ({
            type: message.type || '',
            user: message.user || '',
            text: message.text || '',
            ts: message.ts || '',
            thread_ts: message.thread_ts,
            reply_count: message.reply_count,
            reactions: message.reactions,
            edited: message.edited,
            files: message.files,
            // Phase 5: Add user-friendly display name with graceful fallback
            userDisplayName: message.user
              ? displayNameMap.get(message.user) || message.user
              : undefined,
          }));

          // Create TypeSafeAPI-compliant output
          const output: ChannelHistoryOutput = enforceServiceOutput({
            messages,
            hasMore: data.hasMore,
            responseMetadata: data.cursor ? { nextCursor: data.cursor } : undefined,
            channel: input.channel,
            // Phase 5: Add formatted message list for user-friendly display
            formattedMessages: messages
              .filter((msg) => msg.text && msg.userDisplayName)
              .map((msg) => `${msg.userDisplayName}: ${msg.text}`)
              .join('\n'),
          });

          return output;
        },
      });

      return createServiceSuccess(
        paginationResult as ChannelHistoryOutput,
        'Channel history retrieved successfully'
      );
    } catch (error) {
      if (error instanceof SlackAPIError) {
        return createServiceError(error.message, 'Failed to retrieve channel history');
      }

      return createServiceError(
        `Failed to get channel history: ${error}`,
        'Unexpected error during channel history retrieval'
      );
    }
  };

  /**
   * Search for messages in the workspace with TypeSafeAPI + ts-pattern type safety
   */
  const searchMessages = async (args: unknown): Promise<MessageSearchResult> => {
    try {
      // Validate input using TypeSafeAPI validation pattern
      const input = validateInput(SearchMessagesSchema, args);

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

      // Handle empty results
      if (!result.messages) {
        const output: MessageSearchOutput = enforceServiceOutput({
          messages: [],
          total: 0,
          query: input.query,
          hasMore: false,
        });

        return createServiceSuccess(output, 'No messages found matching the search criteria');
      }

      // Process search results and create TypeSafeAPI-compliant output
      const searchResults = result.messages.matches || [];
      const messages = searchResults.map((match: SearchMessageElement) => ({
        text: match.text || '',
        user: match.user || '',
        ts: match.ts || '',
        channel: match.channel?.id || '',
        permalink: match.permalink || '',
      }));

      const output: MessageSearchOutput = enforceServiceOutput({
        messages,
        total: result.messages.total || 0,
        query: input.query,
        hasMore: (result.messages.paging?.page || 1) < (result.messages.paging?.pages || 1),
      });

      return createServiceSuccess(output, 'Message search completed successfully');
    } catch (error) {
      if (error instanceof SlackAPIError) {
        return createServiceError(error.message, 'Failed to search messages');
      }

      return createServiceError(
        `Failed to search messages: ${error}`,
        'Unexpected error during message search'
      );
    }
  };

  /**
   * Get detailed information about a channel with TypeSafeAPI + ts-pattern type safety
   */
  const getChannelInfo = async (args: unknown): Promise<ChannelInfoResult> => {
    try {
      // Validate input using TypeSafeAPI validation pattern
      const input = validateInput(GetChannelInfoSchema, args);

      const client = deps.clientManager.getClientForOperation('read');

      const result = await client.conversations.info({
        channel: input.channel,
      });

      if (!result.channel) {
        return createServiceError('Channel not found', 'Requested channel does not exist');
      }

      // Create TypeSafeAPI-compliant output
      const output: ChannelInfoOutput = enforceServiceOutput({
        id: result.channel.id || '',
        name: result.channel.name || '',
        isChannel: result.channel.is_channel,
        isGroup: result.channel.is_group,
        isPrivate: result.channel.is_private,
        isArchived: result.channel.is_archived,
        created: result.channel.created,
        creator: result.channel.creator,
        topic: result.channel.topic,
        purpose: result.channel.purpose,
        memberCount: result.channel.num_members,
        members: (result.channel as { members?: string[] })?.members,
      });

      return createServiceSuccess(output, 'Channel information retrieved successfully');
    } catch (error) {
      if (error instanceof SlackAPIError) {
        return createServiceError(error.message, 'Failed to retrieve channel information');
      }

      return createServiceError(
        `Failed to get channel info: ${error}`,
        'Unexpected error during channel information retrieval'
      );
    }
  };

  return {
    sendMessage,
    listChannels,
    getChannelHistory,
    searchMessages,
    getChannelInfo,
  };
};
