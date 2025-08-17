import { match as _match } from 'ts-pattern';
import type { SearchAllArguments } from '@slack/web-api';
import type { MessageElement } from '@slack/web-api/dist/types/response/ConversationsHistoryResponse.js';
import type { MessagesMatch as SearchMessageElement } from '@slack/web-api/dist/types/response/SearchAllResponse.js';
import {
  FindThreadsInChannelSchema,
  GetThreadRepliesSchema,
  SearchThreadsSchema,
  AnalyzeThreadSchema,
  SummarizeThreadSchema,
  ExtractActionItemsSchema,
  PostThreadReplySchema,
  CreateThreadSchema,
  MarkThreadImportantSchema,
  IdentifyImportantThreadsSchema,
  ExportThreadSchema,
  FindRelatedThreadsSchema,
  GetThreadMetricsSchema,
  GetThreadsByParticipantsSchema,
  validateInput,
} from '../../../utils/validation.js';
import type { ThreadService, ThreadServiceDependencies } from './types.js';
import type { SlackUser } from '../../types/core/users.js';
import {
  formatFindThreadsResponse as _formatFindThreadsResponse,
  formatCreateThreadResponse as _formatCreateThreadResponse,
  formatThreadRepliesResponse as _formatThreadRepliesResponse,
} from '../formatters/text-formatters.js';
import { executePagination } from '../../infrastructure/generic-pagination.js';
import {
  createServiceSuccess,
  createServiceError,
  enforceServiceOutput,
  type ServiceResult as _ServiceResult,
} from '../../types/typesafe-api-patterns.js';
import type {
  ThreadDiscoveryResult,
  ThreadRepliesResult,
  ThreadSearchResult,
  ThreadAnalysisResult,
  ThreadSummaryResult,
  ActionItemsResult,
  ThreadReplyResult,
  CreateThreadResult,
  MarkImportantResult,
  ImportantThreadsResult,
  ThreadExportResult,
  RelatedThreadsResult,
  ThreadMetricsResult,
  ThreadsByParticipantsResult,
} from '../../types/outputs/threads.js';

// Export types for external use
export type { ThreadService, ThreadServiceDependencies } from './types.js';
import { SlackAPIError } from '../../../utils/errors.js';
import type {
  SlackMessage,
  ThreadParticipant,
  ThreadAnalysis as _ThreadAnalysis,
  ThreadSummary as _ThreadSummary,
} from '../../types/index.js';
import {
  performComprehensiveAnalysis,
  performQuickAnalysis,
  formatThreadAnalysis as _formatThreadAnalysis,
  formatThreadSummary as _formatThreadSummary,
  type ThreadSummaryFormatterOptions as _ThreadSummaryFormatterOptions,
} from '../../analysis/index.js';
import { countWordsInMessages } from '../../analysis/thread/sentiment-analysis.js';

/**
 * Create thread service with infrastructure dependencies
 * @param deps - Infrastructure dependencies
 * @returns Thread service instance
 */
export const createThreadService = (deps: ThreadServiceDependencies): ThreadService => {
  /**
   * Find all threads in a channel using TypeSafeAPI + ts-pattern patterns
   */
  const findThreadsInChannel = async (args: unknown): Promise<ThreadDiscoveryResult> => {
    try {
      const input = validateInput(FindThreadsInChannelSchema, args);

      const client = deps.clientManager.getClientForOperation('read');

      // Use unified pagination implementation with thread processing logic
      const paginationResult = await executePagination(input, {
        fetchPage: async (cursor?: string) => {
          const result = await client.conversations.history({
            channel: input.channel,
            limit: input.limit || 100,
            cursor,
            oldest: input.oldest,
            latest: input.latest,
            include_all_metadata: input.include_all_metadata,
          });

          if (!result.messages) {
            throw new SlackAPIError('Failed to retrieve channel history for thread discovery');
          }

          return result;
        },

        getCursor: (response) => response.response_metadata?.next_cursor,

        getItems: (response) => {
          const messages = response.messages || [];
          // Filter messages that have replies (threads) - preserves business logic
          return messages.filter(
            (msg: MessageElement) =>
              msg.thread_ts && msg.ts === msg.thread_ts && (msg.reply_count || 0) > 0
          );
        },

        formatResponse: async (data) => {
          const threadParents = data.items;
          const threads = [];

          for (const parentMsg of threadParents) {
            // Get thread replies for each parent message (maintains compatibility)
            const repliesResult = await client.conversations.replies({
              channel: input.channel,
              ts: (parentMsg as MessageElement).ts!,
              limit: 100,
            });

            if (repliesResult.ok && repliesResult.messages) {
              const [parent, ...replies] = repliesResult.messages;

              if (parent) {
                const participants = [
                  ...new Set(
                    replies
                      .map((r: MessageElement) => r.user)
                      .filter((user): user is string => Boolean(user))
                  ),
                ];

                // Get display names for participants efficiently using infrastructure service
                const allUserIds = [parent.user, ...participants].filter((user): user is string =>
                  Boolean(user)
                );
                const displayNameMap =
                  await deps.infrastructureUserService.bulkGetDisplayNames(allUserIds);

                threads.push({
                  threadTs: parent.ts,
                  parentMessage: {
                    text: parent.text,
                    user: parent.user,
                    timestamp: parent.ts,
                    userDisplayName: parent.user ? displayNameMap.get(parent.user) : undefined,
                  },
                  replyCount: replies.length,
                  lastReply: replies[replies.length - 1]?.ts || parent.ts,
                  participants,
                  participantDisplayNames: participants.map((userId) => ({
                    id: userId,
                    displayName: displayNameMap.get(userId) || userId,
                  })),
                });
              }
            }
          }

          return {
            threads,
            total: threads.length,
            hasMore: data.hasMore,
            cursor: data.cursor,
          };
        },
      });

      // Phase 5: Enable user-friendly formatted output using the restored formatter
      // Apply Phase 3 success pattern: use infrastructureUserService for display names
      const getUserDisplayName = async (userId: string): Promise<string> => {
        return await deps.infrastructureUserService.getDisplayName(userId);
      };

      // Check if user wants formatted output (backward compatible)
      const shouldUseFormatter = paginationResult.threads.length > 0;

      if (shouldUseFormatter) {
        // Use the restored formatter for user-friendly output
        const formattedResult = await _formatFindThreadsResponse(
          {
            threads: paginationResult.threads,
            total: paginationResult.total,
            hasMore: paginationResult.hasMore,
          },
          getUserDisplayName
        );

        // Combine structured data with formatted output for best of both worlds
        const output = enforceServiceOutput({
          threads: paginationResult.threads,
          total: paginationResult.total,
          hasMore: paginationResult.hasMore,
          cursor: paginationResult.cursor,
          // Add formatted output for user-friendly display
          formattedSummary:
            formattedResult.content?.[0]?.type === 'text'
              ? (formattedResult.content[0] as { text: string }).text
              : undefined,
        });

        return createServiceSuccess(
          output,
          'Threads retrieved successfully with user-friendly formatting'
        );
      } else {
        // Fallback to original output for empty results
        const output = enforceServiceOutput({
          threads: paginationResult.threads,
          total: paginationResult.total,
          hasMore: paginationResult.hasMore,
          cursor: paginationResult.cursor,
        });

        return createServiceSuccess(output, 'Threads retrieved successfully');
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      return createServiceError(errorMessage, 'Failed to find threads in channel');
    }
  };

  /**
   * Get all replies in a thread using TypeSafeAPI + ts-pattern patterns
   */
  const getThreadReplies = async (args: unknown): Promise<ThreadRepliesResult> => {
    try {
      const input = validateInput(GetThreadRepliesSchema, args);

      const client = deps.clientManager.getClientForOperation('read');

      // Use unified pagination implementation
      const paginationResult = await executePagination(input, {
        fetchPage: async (cursor?: string) => {
          const result = await client.conversations.replies({
            channel: input.channel,
            ts: input.thread_ts,
            limit: input.limit,
            cursor,
            oldest: input.oldest,
            latest: input.latest,
            inclusive: input.inclusive !== false,
          });

          if (!result.ok || !result.messages) {
            throw new SlackAPIError(`Thread not found: ${result.error || 'No messages returned'}`);
          }

          return result;
        },

        getCursor: (response) => response.response_metadata?.next_cursor,

        getItems: (response) => response.messages || [],

        formatResponse: async (data) => {
          // Check for error case in single page mode
          if (!data.hasMore && data.items.length === 0) {
            throw new SlackAPIError('Thread not found: No messages returned');
          }

          return {
            messages: data.items.map((msg: MessageElement) => ({
              type: msg.type || 'message',
              user: msg.user,
              text: msg.text,
              ts: msg.ts,
              thread_ts: msg.thread_ts,
              reply_count: msg.reply_count,
              reactions: msg.reactions?.map((r) => ({
                name: r.name || '',
                count: r.count || 0,
                users: r.users || [],
              })),
            })),
            hasMore: data.hasMore,
            cursor: data.cursor,
            totalMessages: data.items.length,
            threadInfo: {
              channel: input.channel,
              threadTs: input.thread_ts,
            },
          };
        },
      });

      const output = enforceServiceOutput(paginationResult);
      return createServiceSuccess(output, 'Thread replies retrieved successfully');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      return createServiceError(errorMessage, 'Failed to get thread replies');
    }
  };

  /**
   * Search for threads by keywords or content using TypeSafeAPI + ts-pattern patterns
   */
  const searchThreads = async (args: unknown): Promise<ThreadSearchResult> => {
    try {
      const input = validateInput(SearchThreadsSchema, args);

      // Check if search API is available
      deps.clientManager.checkSearchApiAvailability(
        'searchThreads',
        'Use findThreadsInChannel instead'
      );

      const client = deps.clientManager.getClientForOperation('read');

      let searchQuery = input.query;

      // Add channel filter if specified
      if (input.channel) {
        searchQuery += ` in:#${input.channel}`;
      }

      // Add user filter if specified
      if (input.user) {
        searchQuery += ` from:<@${input.user}>`;
      }

      // Add date filters if specified
      if (input.after) {
        searchQuery += ` after:${input.after}`;
      }
      if (input.before) {
        searchQuery += ` before:${input.before}`;
      }

      const searchArgs: SearchAllArguments = {
        query: searchQuery,
        sort: input.sort === 'timestamp' ? 'timestamp' : 'score',
        sort_dir: input.sort_dir || 'desc',
        count: input.limit || 20,
      };

      const result = await client.search.all(searchArgs);

      if (!result.messages?.matches) {
        const output = enforceServiceOutput({
          results: [],
          total: 0,
          query: searchQuery,
          hasMore: false,
        });
        return createServiceSuccess(output, 'No threads found matching search criteria');
      }

      // Filter for messages that are part of threads
      // Note: SearchMessageElement doesn't have thread_ts/reply_count, so we consider all matches
      const threadMessages = result.messages.matches.filter((match: SearchMessageElement) => {
        // For search results, we consider all matches as potential thread content
        return match.text && match.text.length > 0;
      });

      const output = enforceServiceOutput({
        results: threadMessages.map((match: SearchMessageElement) => ({
          text: match.text || '',
          user:
            typeof match.user === 'string'
              ? match.user
              : typeof match.user === 'object' && match.user && 'id' in match.user
                ? String((match.user as Record<string, unknown>).id)
                : '',
          ts: typeof match.ts === 'string' ? match.ts : String(match.ts) || '',
          channel: {
            id:
              typeof match.channel === 'string'
                ? match.channel
                : typeof match.channel === 'object' && match.channel && 'id' in match.channel
                  ? String((match.channel as Record<string, unknown>).id)
                  : '',
            name: '',
          },
          thread_ts: '', // SearchMessageElement doesn't have thread_ts
          reply_count: 0, // SearchMessageElement doesn't have reply_count
          permalink: match.permalink || '',
        })),
        total: threadMessages.length,
        query: searchQuery,
        hasMore: result.messages.paging?.total
          ? threadMessages.length < result.messages.paging.total
          : false,
      });

      return createServiceSuccess(output, 'Thread search completed successfully');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      return createServiceError(errorMessage, 'Failed to search threads');
    }
  };

  /**
   * Analyze a thread comprehensively using TypeSafeAPI + ts-pattern patterns
   */
  const analyzeThread = async (args: unknown): Promise<ThreadAnalysisResult> => {
    try {
      const input = validateInput(AnalyzeThreadSchema, args);
      const client = deps.clientManager.getClientForOperation('read');

      // Get thread messages
      const threadResult = await client.conversations.replies({
        channel: input.channel,
        ts: input.thread_ts,
        limit: 1000,
      });

      if (!threadResult.messages) {
        throw new SlackAPIError('Thread not found');
      }

      const messages = threadResult.messages as SlackMessage[];

      // Build participants list
      const participantMap = new Map<string, ThreadParticipant>();
      for (const message of messages) {
        if (message.user && !participantMap.has(message.user)) {
          try {
            const userResult = await deps.domainUserService.getUserInfo({ user: message.user });
            if (userResult.success) {
              const userInfo = userResult.data as SlackUser;
              participantMap.set(message.user, {
                user_id: message.user,
                username: userInfo.name || userInfo.real_name || message.user,
                real_name: userInfo.real_name,
                // Enhanced user capabilities from SlackUser integration
                is_admin: userInfo.is_admin,
                is_bot: userInfo.is_bot,
                is_deleted: userInfo.deleted,
                is_restricted: userInfo.is_restricted,
                message_count: 0,
                first_message_ts: message.ts || '',
                last_message_ts: message.ts || '',
              });
            } else {
              // Fallback for failed user lookup
              participantMap.set(message.user, {
                user_id: message.user,
                username: message.user,
                real_name: '',
                is_admin: false,
                is_bot: false,
                is_deleted: false,
                is_restricted: false,
                message_count: 0,
                first_message_ts: message.ts || '',
                last_message_ts: message.ts || '',
              });
            }
          } catch {
            // Fallback for any error
            participantMap.set(message.user, {
              user_id: message.user,
              username: message.user,
              real_name: '',
              is_admin: false,
              is_bot: false,
              is_deleted: false,
              is_restricted: false,
              message_count: 0,
              first_message_ts: message.ts || '',
              last_message_ts: message.ts || '',
            });
          }
        }

        const participant = participantMap.get(message.user!);
        if (participant) {
          participant.message_count++;
          participant.last_message_ts = message.ts || '';
        }
      }

      const participants = Array.from(participantMap.values());

      // Perform comprehensive analysis
      const analysis = performComprehensiveAnalysis(messages, participants);

      const output = enforceServiceOutput({
        threadInfo: {
          channel: input.channel,
          threadTs: input.thread_ts,
          messageCount: messages.length,
        },
        participants,
        timeline: analysis.timeline.events.map((event) => ({
          timestamp: event.timestamp,
          event_type: 'message' as const,
          user_id: event.user_id || '',
          content: event.content || '',
        })),
        keyTopics: [...analysis.topics.topics],
        urgencyScore: analysis.urgency.score,
        importanceScore: analysis.importance.score,
        sentiment: analysis.sentiment,
        actionItems: analysis.actionItems.actionItems.map((item) => ({
          text: item.text,
          mentioned_users: 'assigned_to' in item ? [item.assigned_to as string] : [],
          priority: item.priority,
          status: item.status,
          extracted_from_message_ts: 'message_ts' in item ? (item.message_ts as string) : '',
        })),
        summary: 'Thread analysis completed',
        wordCount: countWordsInMessages(messages),
        durationHours: analysis.timeline.totalDuration / 60,
        analysisMetadata: {
          includeTimeline: input.include_timeline !== false,
          includeSentimentAnalysis: input.include_sentiment_analysis !== false,
          includeActionItems: input.include_action_items !== false,
          includeTopics: input.extract_topics !== false,
        },
      });

      return createServiceSuccess(output, 'Thread analysis completed successfully');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      return createServiceError(errorMessage, 'Failed to analyze thread');
    }
  };

  /**
   * Generate an intelligent summary of thread content using TypeSafeAPI + ts-pattern patterns
   */
  const summarizeThread = async (args: unknown): Promise<ThreadSummaryResult> => {
    try {
      const input = validateInput(SummarizeThreadSchema, args);
      const client = deps.clientManager.getClientForOperation('read');

      // Get thread messages
      const threadResult = await client.conversations.replies({
        channel: input.channel,
        ts: input.thread_ts,
        limit: 1000,
      });

      if (!threadResult.messages) {
        throw new SlackAPIError('Thread not found');
      }

      const messages = threadResult.messages as SlackMessage[];

      // Perform analysis for summary
      const analysis = performQuickAnalysis(messages);

      // Build participants for comprehensive analysis if needed
      if (input.include_decisions || input.include_action_items) {
        const participantMap = new Map<string, ThreadParticipant>();
        for (const message of messages) {
          if (message.user && !participantMap.has(message.user)) {
            try {
              const userResult = await deps.domainUserService.getUserInfo({ user: message.user });
              if (userResult.success) {
                const userInfo = userResult.data as SlackUser;
                participantMap.set(message.user, {
                  user_id: message.user,
                  username: userInfo.name || userInfo.real_name || message.user,
                  real_name: userInfo.real_name,
                  // Enhanced user capabilities from SlackUser integration
                  is_admin: userInfo.is_admin,
                  is_bot: userInfo.is_bot,
                  is_deleted: userInfo.deleted,
                  is_restricted: userInfo.is_restricted,
                  message_count: 0,
                  first_message_ts: message.ts || '',
                  last_message_ts: message.ts || '',
                });
              } else {
                // Fallback for failed user lookup
                participantMap.set(message.user, {
                  user_id: message.user,
                  username: message.user,
                  real_name: '',
                  is_admin: false,
                  is_bot: false,
                  is_deleted: false,
                  is_restricted: false,
                  message_count: 0,
                  first_message_ts: message.ts || '',
                  last_message_ts: message.ts || '',
                });
              }
            } catch {
              // Fallback for any error
              participantMap.set(message.user, {
                user_id: message.user,
                username: message.user,
                real_name: '',
                is_admin: false,
                is_bot: false,
                is_deleted: false,
                is_restricted: false,
                message_count: 0,
                first_message_ts: message.ts || '',
                last_message_ts: message.ts || '',
              });
            }
          }
        }
        const participants = Array.from(participantMap.values());
        const fullAnalysis = performComprehensiveAnalysis(messages, participants);

        const output = enforceServiceOutput({
          threadInfo: {
            channel: input.channel,
            threadTs: input.thread_ts,
            messageCount: messages.length,
            summary: `Thread with ${messages.length} messages, ${analysis.urgencyLevel} urgency`,
          },
          summary: {
            messageCount: messages.length,
            participantCount: participants.length,
            duration: `${Math.round(fullAnalysis.timeline.totalDuration)} minutes`,
            urgencyLevel: analysis.urgencyLevel,
            actionItemCount: fullAnalysis.actionItems.actionItems.length,
          },
          keyPoints: fullAnalysis.topics.topics.slice(0, 5),
          decisionsMade: [], // TODO: Extract from analysis
          actionItems: [...fullAnalysis.actionItems.actionItems],
          sentiment: analysis.sentiment,
          language: input.language || 'en',
          summaryLength: input.summary_length || 'detailed',
        });

        return createServiceSuccess(output, 'Thread summary generated successfully');
      }

      // Basic summary without comprehensive analysis
      const output = enforceServiceOutput({
        threadInfo: {
          channel: input.channel,
          threadTs: input.thread_ts,
          messageCount: messages.length,
          summary: `Thread with ${messages.length} messages, ${analysis.urgencyLevel} urgency`,
        },
        summary: {
          messageCount: messages.length,
          participantCount: new Set(messages.map((m) => m.user).filter(Boolean)).size,
          duration: `${Math.round(analysis.duration / 60)} minutes`,
          urgencyLevel: analysis.urgencyLevel,
          actionItemCount: analysis.actionItemCount,
        },
        sentiment: analysis.sentiment,
        language: input.language || 'en',
        summaryLength: input.summary_length || 'detailed',
      });

      return createServiceSuccess(output, 'Thread summary generated successfully');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      return createServiceError(errorMessage, 'Failed to summarize thread');
    }
  };

  /**
   * Extract action items from thread messages using TypeSafeAPI + ts-pattern patterns
   */
  const extractActionItems = async (args: unknown): Promise<ActionItemsResult> => {
    try {
      const input = validateInput(ExtractActionItemsSchema, args);
      const client = deps.clientManager.getClientForOperation('read');

      // Get thread messages
      const threadResult = await client.conversations.replies({
        channel: input.channel,
        ts: input.thread_ts,
        limit: 1000,
      });

      if (!threadResult.messages) {
        throw new SlackAPIError('Thread not found');
      }

      const messages = threadResult.messages as SlackMessage[];

      // Build participants
      const participantMap = new Map<string, ThreadParticipant>();
      for (const message of messages) {
        if (message.user && !participantMap.has(message.user)) {
          try {
            const userResult = await deps.domainUserService.getUserInfo({ user: message.user });
            if (userResult.success) {
              const userInfo = userResult.data as SlackUser;
              participantMap.set(message.user, {
                user_id: message.user,
                username: userInfo.name || userInfo.real_name || message.user,
                real_name: userInfo.real_name,
                // Enhanced user capabilities from SlackUser integration
                is_admin: userInfo.is_admin,
                is_bot: userInfo.is_bot,
                is_deleted: userInfo.deleted,
                is_restricted: userInfo.is_restricted,
                message_count: 0,
                first_message_ts: message.ts || '',
                last_message_ts: message.ts || '',
              });
            } else {
              // Fallback for failed user lookup
              participantMap.set(message.user, {
                user_id: message.user,
                username: message.user,
                real_name: '',
                is_admin: false,
                is_bot: false,
                is_deleted: false,
                is_restricted: false,
                message_count: 0,
                first_message_ts: message.ts || '',
                last_message_ts: message.ts || '',
              });
            }
          } catch {
            // Fallback for any error
            participantMap.set(message.user, {
              user_id: message.user,
              username: message.user,
              real_name: '',
              is_admin: false,
              is_bot: false,
              is_deleted: false,
              is_restricted: false,
              message_count: 0,
              first_message_ts: message.ts || '',
              last_message_ts: message.ts || '',
            });
          }
        }
      }
      const participants = Array.from(participantMap.values());

      // Perform comprehensive analysis
      const analysis = performComprehensiveAnalysis(messages, participants);

      // Filter action items by priority if specified
      let actionItems = analysis.actionItems.actionItems;
      if (input.priority_threshold && input.priority_threshold !== 'low') {
        const priorities = ['low', 'medium', 'high'];
        const minPriorityIndex = priorities.indexOf(input.priority_threshold);
        actionItems = actionItems.filter(
          (item) => priorities.indexOf(item.priority) >= minPriorityIndex
        );
      }

      // Filter completed items if not requested
      if (!input.include_completed) {
        actionItems = actionItems.filter((item) => item.status !== 'completed');
      }

      const output = enforceServiceOutput({
        actionItems,
        extractedAt: new Date().toISOString(),
        threadInfo: {
          channel: input.channel,
          threadTs: input.thread_ts,
          messageCount: messages.length,
        },
        totalActionItems: actionItems.length,
        priorityBreakdown: {
          high: actionItems.filter((item) => item.priority === 'high').length,
          medium: actionItems.filter((item) => item.priority === 'medium').length,
          low: actionItems.filter((item) => item.priority === 'low').length,
        },
        statusBreakdown: {
          pending: actionItems.filter((item) => item.status === 'open').length,
          in_progress: actionItems.filter((item) => item.status === 'in_progress').length,
          completed: actionItems.filter((item) => item.status === 'completed').length,
        },
      });

      return createServiceSuccess(output, 'Action items extracted successfully');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      return createServiceError(errorMessage, 'Failed to extract action items');
    }
  };

  /**
   * Post a reply to an existing thread using TypeSafeAPI + ts-pattern patterns
   */
  const postThreadReply = async (args: unknown): Promise<ThreadReplyResult> => {
    try {
      const input = validateInput(PostThreadReplySchema, args);
      const client = deps.clientManager.getClientForOperation('write');

      // Using any for Slack API compatibility - ChatPostMessageArguments has complex union types
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const messageArgs: any = {
        channel: input.channel,
        text: input.text,
        thread_ts: input.thread_ts,
        ...(input.reply_broadcast && { reply_broadcast: true }),
      };

      const result = await client.chat.postMessage(messageArgs);

      const output = enforceServiceOutput({
        success: true,
        timestamp: result.ts,
        channel: result.channel,
        threadTs: input.thread_ts,
        message: result.message,
        replyInfo: {
          posted: true,
          broadcast: input.reply_broadcast || false,
        },
      });

      return createServiceSuccess(output, 'Thread reply posted successfully');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      return createServiceError(errorMessage, 'Failed to post thread reply');
    }
  };

  /**
   * Create a new thread by posting a parent message and optional first reply using TypeSafeAPI + ts-pattern patterns
   */
  const createThread = async (args: unknown): Promise<CreateThreadResult> => {
    try {
      const input = validateInput(CreateThreadSchema, args);
      const client = deps.clientManager.getClientForOperation('write');

      // Post the parent message
      const parentResult = await client.chat.postMessage({
        channel: input.channel,
        text: input.text,
      });

      if (!parentResult.ts) {
        throw new SlackAPIError('Failed to create thread parent message');
      }

      // Post the first reply if provided
      let replyResult;
      if (input.reply_text) {
        // Using any for Slack API compatibility - ChatPostMessageArguments has complex union types
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const replyArgs: any = {
          channel: input.channel,
          text: input.reply_text,
          thread_ts: parentResult.ts,
          ...(input.broadcast && { reply_broadcast: true }),
        };

        replyResult = await client.chat.postMessage(replyArgs);
      }

      const output = enforceServiceOutput({
        success: true,
        threadTs: parentResult.ts!,
        parentMessage: {
          timestamp: parentResult.ts,
          channel: parentResult.channel,
          message: parentResult.message,
        },
        reply: replyResult
          ? {
              timestamp: replyResult.ts,
              message: replyResult.message,
            }
          : null,
        threadInfo: {
          created: true,
          hasReply: !!input.reply_text,
        },
      });

      return createServiceSuccess(output, 'Thread created successfully');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      return createServiceError(errorMessage, 'Failed to create thread');
    }
  };

  /**
   * Mark a thread as important with reactions and notifications using TypeSafeAPI + ts-pattern patterns
   */
  const markThreadImportant = async (args: unknown): Promise<MarkImportantResult> => {
    try {
      const input = validateInput(MarkThreadImportantSchema, args);
      const client = deps.clientManager.getClientForOperation('write');

      // Add importance reaction based on level
      const reactionMap = {
        low: 'information_source',
        medium: 'warning',
        high: 'exclamation',
        critical: 'rotating_light',
      };

      const reactionName = reactionMap[input.importance_level || 'high'];

      await client.reactions.add({
        channel: input.channel,
        timestamp: input.thread_ts,
        name: reactionName,
      });

      // Post a comment if reason is provided
      if (input.reason) {
        await client.chat.postMessage({
          channel: input.channel,
          text: `⚠️ Thread marked as ${input.importance_level || 'high'} importance: ${input.reason}`,
          thread_ts: input.thread_ts,
        });
      }

      const output = enforceServiceOutput({
        success: true,
        channel: input.channel,
        threadTs: input.thread_ts,
        importanceLevel: input.importance_level || 'high',
        reactionAdded: reactionName,
        commentPosted: !!input.reason,
        reason: input.reason,
      });

      return createServiceSuccess(output, 'Thread marked as important successfully');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      return createServiceError(errorMessage, 'Failed to mark thread as important');
    }
  };

  /**
   * Identify important or urgent threads in a channel using TypeSafeAPI + ts-pattern patterns
   */
  const identifyImportantThreads = async (args: unknown): Promise<ImportantThreadsResult> => {
    try {
      const input = validateInput(IdentifyImportantThreadsSchema, args);
      const client = deps.clientManager.getClientForOperation('read');

      // Calculate time range
      const hoursBack = input.time_range_hours || 168; // Default 1 week
      const oldestTimestamp = Math.floor((Date.now() - hoursBack * 60 * 60 * 1000) / 1000);
      const fromDate = new Date(oldestTimestamp * 1000);
      const toDate = new Date();

      // Get channel history
      const historyResult = await client.conversations.history({
        channel: input.channel,
        limit: 1000,
        oldest: oldestTimestamp.toString(),
      });

      if (!historyResult.messages) {
        const output = enforceServiceOutput({
          importantThreads: [],
          total: 0,
          criteria: input.criteria || ['participant_count', 'message_count', 'urgency_keywords'],
          threshold: input.importance_threshold || 0.7,
          timeRange: {
            hours: hoursBack,
            from: fromDate.toISOString(),
            to: toDate.toISOString(),
          },
        });
        return createServiceSuccess(output, 'No threads found in channel');
      }

      // Find thread parents
      const threadParents = historyResult.messages.filter(
        (message: MessageElement) => message.reply_count && message.reply_count > 0
      );

      const importantThreads = [];

      for (const parent of threadParents.slice(0, input.limit || 10)) {
        // Get thread replies for analysis
        const threadResult = await client.conversations.replies({
          channel: input.channel,
          ts: parent.ts || '',
          limit: 100,
        });

        if (threadResult.messages) {
          const messages = threadResult.messages as SlackMessage[];
          const analysis = performQuickAnalysis(messages);

          // Calculate importance score based on criteria
          let importanceScore = 0;

          if (!input.criteria || input.criteria.includes('message_count')) {
            importanceScore += Math.min(messages.length / 20, 1) * 0.3;
          }

          if (!input.criteria || input.criteria.includes('urgency_keywords')) {
            importanceScore +=
              analysis.urgencyLevel === 'critical'
                ? 0.4
                : analysis.urgencyLevel === 'high'
                  ? 0.3
                  : analysis.urgencyLevel === 'medium'
                    ? 0.2
                    : 0.1;
          }

          if (!input.criteria || input.criteria.includes('participant_count')) {
            const uniqueUsers = new Set(messages.map((m) => m.user)).size;
            importanceScore += Math.min(uniqueUsers / 10, 1) * 0.2;
          }

          if (!input.criteria || input.criteria.includes('mention_frequency')) {
            const mentionCount = messages.reduce(
              (count, msg) => count + (msg.text?.match(/<@[UW][A-Z0-9]+>/g)?.length || 0),
              0
            );
            importanceScore += Math.min(mentionCount / 5, 1) * 0.1;
          }

          if (importanceScore >= (input.importance_threshold || 0.7)) {
            importantThreads.push({
              channel: input.channel,
              threadTs: parent.ts,
              parentMessage: {
                text: parent.text,
                user: parent.user,
                timestamp: parent.ts,
              },
              importanceScore,
              analysis: {
                messageCount: messages.length,
                participantCount: new Set(messages.map((m) => m.user)).size,
                urgencyLevel: analysis.urgencyLevel,
                actionItemCount: analysis.actionItemCount,
                duration: analysis.duration,
              },
            });
          }
        }
      }

      // Sort by importance score
      importantThreads.sort((a, b) => b.importanceScore - a.importanceScore);

      const output = enforceServiceOutput({
        importantThreads: importantThreads.slice(0, input.limit || 10),
        total: importantThreads.length,
        criteria: input.criteria || ['participant_count', 'message_count', 'urgency_keywords'],
        threshold: input.importance_threshold || 0.7,
        timeRange: {
          hours: hoursBack,
          from: fromDate.toISOString(),
          to: toDate.toISOString(),
        },
      });

      return createServiceSuccess(output, `Found ${importantThreads.length} important threads`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      return createServiceError(errorMessage, 'Failed to identify important threads');
    }
  };

  /**
   * Export thread content in various formats using TypeSafeAPI + ts-pattern patterns
   */
  const exportThread = async (args: unknown): Promise<ThreadExportResult> => {
    try {
      const input = validateInput(ExportThreadSchema, args);
      const client = deps.clientManager.getClientForOperation('read');

      // Get thread messages
      const threadResult = await client.conversations.replies({
        channel: input.channel,
        ts: input.thread_ts,
        limit: 1000,
      });

      if (!threadResult.messages) {
        throw new SlackAPIError('Thread not found');
      }

      const messages = threadResult.messages as SlackMessage[];

      // Get user info if requested
      const userInfoMap = new Map<
        string,
        {
          displayName: string;
          isAdmin?: boolean;
          isBot?: boolean;
          isDeleted?: boolean;
          isRestricted?: boolean;
        }
      >();
      if (input.include_user_profiles) {
        const uniqueUsers = new Set(
          messages.map((m) => m.user).filter((user): user is string => Boolean(user))
        );
        for (const userId of uniqueUsers) {
          try {
            const userResult = await deps.domainUserService.getUserInfo({ user: userId });
            if (userResult.success) {
              const userInfo = userResult.data as SlackUser;
              userInfoMap.set(userId, {
                displayName: userInfo.profile?.display_name || userInfo.real_name || userId,
                // Enhanced user capabilities from SlackUser integration
                isAdmin: userInfo.is_admin,
                isBot: userInfo.is_bot,
                isDeleted: userInfo.deleted,
                isRestricted: userInfo.is_restricted,
              });
            } else {
              // Fallback for failed user lookup
              userInfoMap.set(userId, {
                displayName: userId,
                isAdmin: false,
                isBot: false,
                isDeleted: false,
                isRestricted: false,
              });
            }
          } catch {
            // Fallback for any error
            userInfoMap.set(userId, {
              displayName: userId,
              isAdmin: false,
              isBot: false,
              isDeleted: false,
              isRestricted: false,
            });
          }
        }
      }

      const output = enforceServiceOutput({
        format: input.format || 'markdown',
        threadInfo: {
          channel: input.channel,
          threadTs: input.thread_ts,
          messageCount: messages.length,
          exportedAt: new Date().toISOString(),
        },
        messages: messages.map((message) => ({
          user: message.user,
          text: message.text,
          timestamp: message.ts,
          reactions: input.include_reactions !== false ? message.reactions : undefined,
        })),
        userProfiles: input.include_user_profiles ? Object.fromEntries(userInfoMap) : undefined,
        exportMetadata: {
          includeReactions: input.include_reactions !== false,
          includeUserProfiles: input.include_user_profiles || false,
          includeMetadata: input.include_metadata !== false,
        },
      });

      return createServiceSuccess(
        output,
        `Thread exported in ${input.format || 'markdown'} format`
      );
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      return createServiceError(errorMessage, 'Failed to export thread');
    }
  };

  /**
   * Find threads related to a given thread using TypeSafeAPI + ts-pattern patterns
   */
  const findRelatedThreads = async (args: unknown): Promise<RelatedThreadsResult> => {
    try {
      const input = validateInput(FindRelatedThreadsSchema, args);
      const client = deps.clientManager.getClientForOperation('read');

      // Get the reference thread
      const refThreadResult = await client.conversations.replies({
        channel: input.channel,
        ts: input.thread_ts,
        limit: 1000,
      });

      if (!refThreadResult.messages) {
        throw new SlackAPIError('Reference thread not found');
      }

      const refMessages = refThreadResult.messages as SlackMessage[];
      const refAnalysis = performQuickAnalysis(refMessages);

      // Get other threads in the channel (last 30 days for comparison)
      const thirtyDaysAgo = Math.floor((Date.now() - 30 * 24 * 60 * 60 * 1000) / 1000);
      const historyResult = await client.conversations.history({
        channel: input.channel,
        limit: 1000,
        oldest: thirtyDaysAgo.toString(),
      });

      if (!historyResult.messages) {
        const output = enforceServiceOutput({
          relatedThreads: [],
          total: 0,
          referenceThread: input.thread_ts,
          similarityThreshold: input.similarity_threshold || 0.3,
          relationshipCriteria: input.relationship_types || [
            'keyword_overlap',
            'participant_overlap',
          ],
        });
        return createServiceSuccess(output, 'No other threads found in channel');
      }

      const threadParents = historyResult.messages.filter(
        (message: MessageElement) =>
          message.reply_count && message.reply_count > 0 && message.ts !== input.thread_ts
      );

      const relatedThreads = [];

      for (const parent of threadParents.slice(0, 50)) {
        // Limit comparison threads
        const threadResult = await client.conversations.replies({
          channel: input.channel,
          ts: parent.ts || '',
          limit: 100,
        });

        if (threadResult.messages) {
          const messages = threadResult.messages as SlackMessage[];
          const analysis = performQuickAnalysis(messages);

          let similarityScore = 0;

          // Keyword overlap similarity
          if (!input.relationship_types || input.relationship_types.includes('keyword_overlap')) {
            // Simple keyword similarity (this could be enhanced with proper NLP)
            const refText = refMessages
              .map((m) => m.text || '')
              .join(' ')
              .toLowerCase();
            const compText = messages
              .map((m) => m.text || '')
              .join(' ')
              .toLowerCase();
            const refWords = new Set(refText.split(/\s+/).filter((w) => w.length > 3));
            const compWords = new Set(compText.split(/\s+/).filter((w) => w.length > 3));
            const intersection = new Set([...refWords].filter((w) => compWords.has(w)));
            const union = new Set([...refWords, ...compWords]);
            if (union.size > 0) {
              similarityScore += (intersection.size / union.size) * 0.4;
            }
          }

          // Participant overlap
          if (
            !input.relationship_types ||
            input.relationship_types.includes('participant_overlap')
          ) {
            const refUsers = new Set(refMessages.map((m) => m.user).filter(Boolean));
            const compUsers = new Set(messages.map((m) => m.user).filter(Boolean));
            const userIntersection = new Set([...refUsers].filter((u) => compUsers.has(u)));
            const userUnion = new Set([...refUsers, ...compUsers]);
            if (userUnion.size > 0) {
              similarityScore += (userIntersection.size / userUnion.size) * 0.3;
            }
          }

          // Temporal proximity (messages close in time are more related)
          if (
            !input.relationship_types ||
            input.relationship_types.includes('temporal_proximity')
          ) {
            const refTime = parseInt(input.thread_ts);
            const compTime = parseInt(parent.ts || '0');
            const timeDiff = Math.abs(refTime - compTime);
            const maxTime = 7 * 24 * 60 * 60; // 7 days in seconds
            if (timeDiff < maxTime) {
              similarityScore += (1 - timeDiff / maxTime) * 0.2;
            }
          }

          // Topic similarity (basic implementation)
          if (!input.relationship_types || input.relationship_types.includes('topic_similarity')) {
            if (refAnalysis.urgencyLevel === analysis.urgencyLevel) {
              similarityScore += 0.1;
            }
          }

          if (similarityScore >= (input.similarity_threshold || 0.3)) {
            relatedThreads.push({
              channel: input.channel,
              threadTs: parent.ts,
              parentMessage: {
                text: parent.text,
                user: parent.user,
                timestamp: parent.ts,
              },
              similarityScore,
              relationshipTypes: input.relationship_types || [
                'keyword_overlap',
                'participant_overlap',
              ],
              analysis: {
                messageCount: messages.length,
                urgencyLevel: analysis.urgencyLevel,
                actionItemCount: analysis.actionItemCount,
              },
            });
          }
        }
      }

      // Sort by similarity score
      relatedThreads.sort((a, b) => b.similarityScore - a.similarityScore);

      const output = enforceServiceOutput({
        relatedThreads: relatedThreads.slice(0, input.max_results || 10),
        total: relatedThreads.length,
        referenceThread: input.thread_ts,
        similarityThreshold: input.similarity_threshold || 0.3,
        relationshipCriteria: input.relationship_types || [
          'keyword_overlap',
          'participant_overlap',
        ],
      });

      return createServiceSuccess(output, `Found ${relatedThreads.length} related threads`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      return createServiceError(errorMessage, 'Failed to find related threads');
    }
  };

  /**
   * Get statistics and metrics about threads using TypeSafeAPI + ts-pattern patterns
   */
  const getThreadMetrics = async (args: unknown): Promise<ThreadMetricsResult> => {
    try {
      const input = validateInput(GetThreadMetricsSchema, args);
      const client = deps.clientManager.getClientForOperation('read');

      // Calculate time range
      const now = new Date();
      const after = input.after
        ? new Date(input.after)
        : new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      const before = input.before ? new Date(input.before) : now;

      const oldestTs = Math.floor(after.getTime() / 1000).toString();
      const latestTs = Math.floor(before.getTime() / 1000).toString();

      let allThreads: MessageElement[] = [];

      if (input.channel) {
        // Get threads from specific channel
        const historyResult = await client.conversations.history({
          channel: input.channel,
          limit: 1000,
          oldest: oldestTs,
          latest: latestTs,
        });

        if (historyResult.messages) {
          const threadParents = historyResult.messages.filter(
            (message: MessageElement) => message.reply_count && message.reply_count > 0
          );
          allThreads = threadParents;
        }
      }

      // Analyze threads
      const metrics = {
        totalThreads: allThreads.length,
        averageReplies: 0,
        mostActiveThreads: [],
        participantStats: new Map<string, number>(),
        timeDistribution: new Map<number, number>(),
        totalMessages: 0,
      };

      if (allThreads.length > 0) {
        let totalReplies = 0;

        for (const thread of allThreads.slice(0, 100)) {
          // Limit for performance - need to ensure we have a valid channel and timestamp
          if (!input.channel || !thread.ts) continue;

          const threadResult = await client.conversations.replies({
            channel: input.channel,
            ts: thread.ts,
            limit: 100,
          });

          if (threadResult.messages) {
            const messageCount = threadResult.messages.length;
            totalReplies += messageCount - 1; // Subtract parent message
            metrics.totalMessages += messageCount;

            // Track participants
            for (const message of threadResult.messages) {
              if (message.user) {
                metrics.participantStats.set(
                  message.user,
                  (metrics.participantStats.get(message.user) || 0) + 1
                );
              }
            }

            // Track time distribution (hour of day)
            const hour = new Date(parseFloat(thread.ts || '0') * 1000).getHours();
            metrics.timeDistribution.set(hour, (metrics.timeDistribution.get(hour) || 0) + 1);
          }
        }

        metrics.averageReplies = totalReplies / allThreads.length;
      }

      // Convert Maps to arrays for JSON serialization
      const topParticipants = Array.from(metrics.participantStats.entries())
        .sort(([, a], [, b]) => b - a)
        .slice(0, 10)
        .map(([user, count]) => ({ user, messageCount: count }));

      const activityPatterns = Array.from(metrics.timeDistribution.entries())
        .map(([hour, count]) => ({ hour, threadCount: count }))
        .sort((a, b) => a.hour - b.hour);

      const hourlyDistribution: Record<number, number> = {};
      activityPatterns.forEach(({ hour, threadCount }) => {
        hourlyDistribution[hour] = threadCount;
      });

      const output = enforceServiceOutput({
        summary: {
          totalThreads: metrics.totalThreads,
          averageReplies: metrics.averageReplies,
          totalMessages: metrics.totalMessages,
        },
        topParticipants: input.include_participant_stats !== false ? topParticipants : [],
        activityPatterns: input.include_activity_patterns !== false ? activityPatterns : [],
        analysisConfig: {
          timeZone: input.time_zone || 'UTC',
          channel: input.channel,
          dateRange: {
            after: input.after,
            before: input.before,
          },
        },
        timeDistribution: {
          hourly: hourlyDistribution,
        },
      });

      return createServiceSuccess(output, `Analyzed ${metrics.totalThreads} threads`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      return createServiceError(errorMessage, 'Failed to get thread metrics');
    }
  };

  /**
   * Find threads that include specific participants using TypeSafeAPI + ts-pattern patterns
   */
  const getThreadsByParticipants = async (args: unknown): Promise<ThreadsByParticipantsResult> => {
    try {
      const input = validateInput(GetThreadsByParticipantsSchema, args);

      // Check if search API is available for broader search
      deps.clientManager.checkSearchApiAvailability(
        'getThreadsByParticipants',
        'Use findThreadsInChannel with filtering instead'
      );

      const client = deps.clientManager.getClientForOperation('read');

      // Build search query for participants
      let searchQuery = '';
      if (input.require_all_participants) {
        // All participants must be in thread
        searchQuery = input.participants.map((p) => `from:<@${p}>`).join(' ');
      } else {
        // Any participant can be in thread
        searchQuery = `(${input.participants.map((p) => `from:<@${p}>`).join(' OR ')})`;
      }

      // Add channel filter if specified
      if (input.channel) {
        searchQuery += ` in:<#${input.channel}>`;
      }

      // Add date filters
      if (input.after) {
        searchQuery += ` after:${input.after}`;
      }
      if (input.before) {
        searchQuery += ` before:${input.before}`;
      }

      const searchResult = await client.search.all({
        query: searchQuery,
        count: input.limit || 20,
        sort: 'timestamp',
        sort_dir: 'desc',
      });

      if (!searchResult.messages?.matches) {
        const output = enforceServiceOutput({
          threads: [],
          total: 0,
          searchedParticipants: input.participants,
          requireAllParticipants: input.require_all_participants || false,
          searchCriteria: {
            channelFilter: input.channel,
            dateRange: {
              after: input.after,
              before: input.before,
            },
          },
        });
        return createServiceSuccess(output, 'No threads found with specified participants');
      }

      // Filter for actual threads and verify participant requirements
      const threadMap = new Map<
        string,
        {
          channel: string;
          threadTs: string;
          parentMessage: {
            text?: string;
            user?: string;
            timestamp?: string;
          };
          participants: string[];
          messageCount: number;
          matchingParticipants: string[];
        }
      >();

      for (const match of searchResult.messages.matches) {
        // For search results, use the message timestamp as thread timestamp
        const threadTs = typeof match.ts === 'string' ? match.ts : String(match.ts);
        if (!threadTs || threadTs === 'undefined' || threadTs === 'null') continue;

        const threadKey = `${match.channel?.id || match.channel?.name}-${threadTs}`;
        if (threadMap.has(threadKey)) continue;

        // Get full thread to verify participants
        const threadResult = await client.conversations.replies({
          channel: typeof match.channel === 'string' ? match.channel : match.channel?.id || '',
          ts: threadTs,
          limit: 100,
        });

        if (threadResult.messages) {
          const threadUsers = new Set(
            threadResult.messages?.map((m: MessageElement) => m.user).filter(Boolean) || []
          );

          let includeThread = false;
          if (input.require_all_participants) {
            includeThread = input.participants.every((p) => threadUsers.has(p));
          } else {
            includeThread = input.participants.some((p) => threadUsers.has(p));
          }

          if (includeThread) {
            const firstMessage = threadResult.messages?.[0];
            threadMap.set(threadKey, {
              channel: typeof match.channel === 'string' ? match.channel : match.channel?.id || '',
              threadTs,
              parentMessage: {
                text: firstMessage?.text,
                user: firstMessage?.user,
                timestamp: firstMessage?.ts,
              },
              participants: Array.from(threadUsers).filter(Boolean) as string[],
              messageCount: threadResult.messages?.length || 0,
              matchingParticipants: input.participants.filter((p) => threadUsers.has(p)),
            });
          }
        }
      }

      const threads = Array.from(threadMap.values());

      const output = enforceServiceOutput({
        threads,
        total: threads.length,
        searchedParticipants: input.participants,
        requireAllParticipants: input.require_all_participants || false,
        searchCriteria: {
          channelFilter: input.channel,
          dateRange: {
            after: input.after,
            before: input.before,
          },
        },
      });

      return createServiceSuccess(
        output,
        `Found ${threads.length} threads with specified participants`
      );
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      return createServiceError(errorMessage, 'Failed to find threads by participants');
    }
  };

  return {
    findThreadsInChannel,
    getThreadReplies,
    searchThreads,
    analyzeThread,
    summarizeThread,
    extractActionItems,
    postThreadReply,
    createThread,
    markThreadImportant,
    identifyImportantThreads,
    exportThread,
    findRelatedThreads,
    getThreadMetrics,
    getThreadsByParticipants,
  };
};
