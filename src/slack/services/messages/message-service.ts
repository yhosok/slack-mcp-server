import type { SearchAllArguments } from '@slack/web-api';
import type { MessageElement } from '@slack/web-api/dist/types/response/ConversationsHistoryResponse.js';
import type { Match as SearchMessageElement } from '@slack/web-api/dist/types/response/SearchMessagesResponse.js';
import {
  SendMessageSchema,
  ListChannelsSchema,
  GetChannelHistorySchema,
  SearchMessagesSchema,
  GetChannelInfoSchema,
  GetMessageImagesSchema,
  validateInput,
} from '../../../utils/validation.js';
import {
  parseSearchQuery,
  buildSlackSearchQuery,
  type SearchQueryOptions,
} from '../../utils/search-query-parser.js';
import { validateDateParameters } from '../../../utils/date-validation.js';
import type { MessageService, MessageServiceDependencies } from './types.js';
import {
  formatSendMessageResponse,
  formatChannelHistoryResponse as _formatChannelHistoryResponse,
  formatSearchMessagesResponse as _formatSearchMessagesResponse,
} from '../formatters/text-formatters.js';
import { executePagination } from '../../infrastructure/generic-pagination.js';
import { logger } from '../../../utils/logger.js';
import {
  createServiceSuccess,
  createServiceError,
  enforceServiceOutput,
} from '../../types/typesafe-api-patterns.js';
import {
  createServiceMethod,
  type ServiceMethodContext,
} from '../../infrastructure/service-patterns/index.js';
import {
  createCacheIntegrationHelper,
} from '../../infrastructure/cache/cache-integration-helpers.js';
import type {
  MessageSearchResult,
  ChannelHistoryResult,
  ListChannelsResult,
  MessageImagesResult,
  MessageSearchOutput,
  ChannelHistoryOutput,
  ListChannelsOutput,
  MessageImagesOutput,
} from '../../types/outputs/messages.js';
import { applyRelevanceScoring, normalizeSearchResults } from '../../utils/relevance-integration.js';
import { CONFIG } from '../../../config/index.js';

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
  // Initialize cache integration helper for all message service operations
  const _cacheHelper = createCacheIntegrationHelper(deps.cacheService);

  /**
   * Send a message to a channel or user with TypeSafeAPI + ts-pattern type safety
   *
   * Sends a text message to a Slack channel, direct message, or thread.
   * Uses bot token for write operations and includes comprehensive error handling.
   *
   * REFACTORED: Now uses shared service method factory to eliminate duplication
   */
  const sendMessage = createServiceMethod({
    schema: SendMessageSchema,
    operation: 'write',
    handler: async (input, { client }: ServiceMethodContext) => {
      const result = await client.chat.postMessage({
        channel: input.channel,
        text: input.text,
        thread_ts: input.thread_ts,
      });

      if (!result.ok) {
        throw new Error(`Failed to send message: ${result.error || 'Unknown error'}`);
      }

      // Create TypeSafeAPI-compliant output using existing formatter
      const formattedResponse = await formatSendMessageResponse({
        success: true,
        timestamp: result.ts,
        channel: result.channel,
        message: result.message,
      });

      // Ensure ServiceOutput compliance and create type-safe success result
      return enforceServiceOutput({
        success: true,
        channel: result.channel || input.channel,
        ts: result.ts || '',
        message: 'Message sent successfully',
        ...formattedResponse,
      });
    },
    successMessage: 'Message sent successfully',
    methodName: 'sendMessage',
    errorPrefix: 'Failed to send message',
  }, { clientManager: deps.clientManager });

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
            // Filter files to include only image types (jpeg, png, gif)
            files: message.files
              ? message.files.filter(file => 
                  // Check mimetype for image types
                  (file.mimetype && ['image/jpeg', 'image/png', 'image/gif'].includes(file.mimetype)) ||
                  // Check filetype for image extensions
                  (file.filetype && ['jpg', 'jpeg', 'png', 'gif'].includes(file.filetype))
                )
              : undefined,
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

      // Validate date parameters
      const dateValidationError = validateDateParameters(input.after, input.before);
      if (dateValidationError) {
        return createServiceError(dateValidationError, 'Invalid date parameters');
      }

      // Check if search API is available
      deps.clientManager.checkSearchApiAvailability(
        'searchMessages',
        'Use channel history or conversation search'
      );

      const client = deps.clientManager.getClientForOperation('read');

      /**
       * Build advanced message search query using the search query parser
       * Supports complex queries with operators, boolean logic, and proper escaping
       *
       * @param query - Raw search query from input
       * @param after - Optional after date parameter
       * @param before - Optional before date parameter
       * @returns Enhanced search query with proper Slack syntax
       */
      const buildAdvancedMessageSearchQuery = (
        query: string,
        after?: string,
        before?: string
      ): string => {
        try {
          // Configure parser options for message search
          const parserOptions: SearchQueryOptions = {
            allowedOperators: ['in', 'from', 'has', 'after', 'before', 'is', 'during'],
            maxQueryLength: 500,
            enableBooleanOperators: true,
            enableGrouping: true
          };

          // Parse the query first
          const parseResult = parseSearchQuery(query, parserOptions);

          if (parseResult.success) {
            const parsedQuery = parseResult.query;

            // Add date operators from parameters if not already present
            if (after && !parsedQuery.operators.some(op => op.type === 'after')) {
              parsedQuery.operators.push({
                type: 'after',
                value: after,
                field: 'date'
              });
            }

            if (before && !parsedQuery.operators.some(op => op.type === 'before')) {
              parsedQuery.operators.push({
                type: 'before',
                value: before,
                field: 'date'
              });
            }

            // Use parsed query and rebuild with proper Slack syntax
            return buildSlackSearchQuery(parsedQuery, parserOptions);
          } else {
            // Fallback to legacy query building with dates
            logger.debug('Advanced message search query parsing failed, using legacy mode', {
              error: parseResult.error.message,
              query
            });

            return buildLegacyQueryWithDates(query, after, before);
          }

        } catch (error) {
          // Final fallback to legacy query building for any errors
          logger.warn('Advanced message search query building failed, falling back to legacy mode', {
            error: error instanceof Error ? error.message : 'Unknown error',
            query
          });

          return buildLegacyQueryWithDates(query, after, before);
        }
      };

      /**
       * Legacy fallback for building search queries with date parameters
       * Manually appends date operators when advanced parsing fails
       */
      const buildLegacyQueryWithDates = (
        query: string,
        after?: string,
        before?: string
      ): string => {
        let searchQuery = query.trim();

        // Add date filters if specified and not already present
        if (after && !searchQuery.includes('after:')) {
          searchQuery += ` after:${after}`;
        }
        if (before && !searchQuery.includes('before:')) {
          searchQuery += ` before:${before}`;
        }

        return searchQuery.trim();
      };

      // Build enhanced search query with date parameters
      const enhancedQuery = buildAdvancedMessageSearchQuery(input.query, input.after, input.before);

      const searchArgs: SearchAllArguments = {
        query: enhancedQuery,
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
          query: enhancedQuery,
          hasMore: false,
        });

        return createServiceSuccess(output, 'No messages found matching the search criteria');
      }

      // Process search results and create TypeSafeAPI-compliant output
      const searchResults = result.messages.matches || [];
      
      // Extract unique user IDs from search results
      const uniqueUserIds = [
        ...new Set(
          searchResults
            .map((match: SearchMessageElement) => match.user)
            .filter((user): user is string => Boolean(user))
        ),
      ];

      // Use Phase 3 pattern: bulkGetDisplayNames for efficient display name conversion
      const displayNameMap =
        uniqueUserIds.length > 0
          ? await deps.userService.bulkGetDisplayNames(uniqueUserIds)
          : new Map<string, string>();

      const messages = searchResults.map((match: SearchMessageElement) => ({
        text: match.text || '',
        user: match.user || '',
        ts: match.ts || '',
        channel: match.channel?.id || '',
        permalink: match.permalink || '',
        // Phase 5: Add user-friendly display name with graceful fallback
        userDisplayName: match.user
          ? displayNameMap.get(match.user) || match.user
          : undefined,
      }));

      // Phase 2: Apply relevance scoring to search results when enabled
      const normalizedMessages = normalizeSearchResults(messages, {
        textField: 'text',
        timestampField: 'ts',
        userField: 'user',
      });

      const relevanceResult = await applyRelevanceScoring(
        normalizedMessages,
        input.query, // Use original query for relevance scoring
        deps.relevanceScorer, // null when search ranking disabled
        {
          context: 'searchMessages',
          performanceThreshold: 100,
          enableLogging: true,
        }
      );

      const output: MessageSearchOutput = enforceServiceOutput({
        messages: relevanceResult.results,
        total: result.messages.total || 0,
        query: enhancedQuery,
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
   *
   * REFACTORED: Now uses shared service method factory to eliminate duplication
   */
  const getChannelInfo = createServiceMethod({
    schema: GetChannelInfoSchema,
    operation: 'read',
    handler: async (input, { client }: ServiceMethodContext) => {
      const result = await client.conversations.info({
        channel: input.channel,
      });

      if (!result.channel) {
        throw new Error('Channel not found');
      }

      // Create TypeSafeAPI-compliant output
      return enforceServiceOutput({
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
    },
    successMessage: 'Channel information retrieved successfully',
    methodName: 'getChannelInfo',
    errorPrefix: 'Failed to retrieve channel information',
  }, { clientManager: deps.clientManager });

  /**
   * Get all images from a specific message with TypeSafeAPI + ts-pattern type safety
   *
   * Retrieves all image files attached to a specific message in a channel.
   * Filters files to only return image types (PNG, JPG, JPEG, GIF, WEBP, etc).
   * Optionally includes Base64-encoded image data for immediate use.
   *
   * Features:
   * - Image type filtering (mimetype-based detection)
   * - Optional Base64 image data inclusion
   * - Comprehensive error handling for invalid channels/messages
   * - Type-safe input validation and output structure
   *
   * @param args - Arguments containing channel, message_ts, and include_image_data
   * @returns Promise<MessageImagesResult> - Discriminated union result with image data
   *
   * @example Basic Usage
   * ```typescript
   * const result = await messageService.getMessageImages({
   *   channel: 'C1234567890',
   *   message_ts: '1234567890.123456',
   *   include_image_data: false
   * });
   *
   * match(result)
   *   .with({ success: true }, (success) => {
   *     console.log(`Found ${success.data.total_images} images`);
   *     success.data.images.forEach(img => console.log(img.name));
   *   })
   *   .with({ success: false }, (error) => {
   *     console.error('Failed to get images:', error.error);
   *   })
   *   .exhaustive();
   * ```
   */
  const getMessageImages = async (args: unknown): Promise<MessageImagesResult> => {
    try {
      // Validate input using TypeSafeAPI validation pattern
      const input = validateInput(GetMessageImagesSchema, args);

      const client = deps.clientManager.getClientForOperation('read');

      // Get the specific message using conversations.history with timestamp filters
      const result = await client.conversations.history({
        channel: input.channel,
        latest: input.message_ts,
        oldest: input.message_ts,
        inclusive: true,
        limit: 1,
      });

      if (!result.messages || result.messages.length === 0) {
        return createServiceError('Message not found', 'Requested message does not exist or is not accessible');
      }

      const message = result.messages[0];
      if (!message) {
        return createServiceError('Message not found', 'Requested message does not exist or is not accessible');
      }

      // Check if message has any files
      if (!message.files || message.files.length === 0) {
        // Return empty result for messages with no files
        const output: MessageImagesOutput = enforceServiceOutput({
          channel: input.channel,
          message_ts: input.message_ts,
          images: [],
          total_images: 0,
        });

        return createServiceSuccess(output, 'No images found in the message');
      }

      // Filter files to only include image types
      const imageFiles = message.files.filter(file => {
        // Check mimetype for image types
        if (file.mimetype && file.mimetype.startsWith('image/')) {
          return true;
        }
        
        // Fallback: check file extension for common image types
        if (file.filetype) {
          const imageExtensions = ['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'svg', 'tiff', 'ico'];
          return imageExtensions.includes(file.filetype.toLowerCase());
        }
        
        return false;
      });

      // Process each image file
      const images = await Promise.all(
        imageFiles.map(async (file) => {
          const imageData: MessageImagesOutput['images'][0] = {
            id: file.id || '',
            name: file.name || '',
            url_private: file.url_private || '',
            url_private_download: file.url_private_download || '',
            mimetype: file.mimetype || '',
            filetype: file.filetype || '',
            size: file.size || 0,
          };

          // Add thumbnail URLs if available
          if (file.thumb_360) imageData.thumb_360 = file.thumb_360;
          if (file.thumb_480) imageData.thumb_480 = file.thumb_480;
          if (file.thumb_720) imageData.thumb_720 = file.thumb_720;
          if (file.thumb_1024) imageData.thumb_1024 = file.thumb_1024;

          // Include Base64 image data if requested
          if (input.include_image_data && file.url_private) {
            try {
              // Download image data from Slack's private URL
              const response = await fetch(file.url_private, {
                headers: {
                  'Authorization': `Bearer ${CONFIG.SLACK_BOT_TOKEN}`,
                },
              });

              if (response.ok) {
                const arrayBuffer = await response.arrayBuffer();
                const base64Data = Buffer.from(arrayBuffer).toString('base64');
                imageData.image_data = base64Data;
              } else {
                logger.warn('Failed to download image data', {
                  fileId: file.id,
                  status: response.status,
                  statusText: response.statusText,
                });
              }
            } catch (error) {
              logger.warn('Error downloading image data', {
                fileId: file.id,
                error: error instanceof Error ? error.message : 'Unknown error',
              });
            }
          }

          return imageData;
        })
      );

      // Create TypeSafeAPI-compliant output
      const output: MessageImagesOutput = enforceServiceOutput({
        channel: input.channel,
        message_ts: input.message_ts,
        images,
        total_images: images.length,
      });

      return createServiceSuccess(
        output, 
        `Retrieved ${images.length} image${images.length === 1 ? '' : 's'} from message`
      );
    } catch (error) {
      if (error instanceof SlackAPIError) {
        return createServiceError(error.message, 'Failed to retrieve message images');
      }

      return createServiceError(
        `Failed to get message images: ${error}`,
        'Unexpected error during message image retrieval'
      );
    }
  };

  return {
    sendMessage,
    listChannels,
    getChannelHistory,
    searchMessages,
    getChannelInfo,
    getMessageImages,
  };
};
