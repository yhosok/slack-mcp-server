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
import {
  processConcurrently,
  processConcurrentlyInBatches,
  createSimpleCache,
} from '../../infrastructure/concurrent-utils.js';
import { logger } from '../../../utils/logger.js';
import type {
  SlackMessage,
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
  // Performance optimization: Create cache for channel name resolution
  const channelNameCache = createSimpleCache<string, string>(10 * 60 * 1000); // 10-minute TTL
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
          
          // Performance optimization: Process thread replies concurrently
          const threadProcessingResult = await processConcurrently(
            threadParents,
            async (parentMsg) => {
              const parentMsgElement = parentMsg as MessageElement;
              if (!parentMsgElement.ts) return null;
              
              // Get thread replies for each parent message
              const repliesResult = await client.conversations.replies({
                channel: input.channel,
                ts: parentMsgElement.ts,
                limit: 100,
              });

              if (!repliesResult.ok || !repliesResult.messages) {
                return null;
              }

              const [parent, ...replies] = repliesResult.messages;
              if (!parent) return null;

              const participants = [
                ...new Set(
                  replies
                    .map((r: MessageElement) => r.user)
                    .filter((user): user is string => Boolean(user))
                ),
              ];

              return {
                parent,
                replies,
                participants,
                allUserIds: [parent.user, ...participants].filter((user): user is string =>
                  Boolean(user)
                ),
              };
            },
            {
              concurrency: 5, // Higher concurrency for thread discovery
              failFast: false,
            }
          );

          // Collect all user IDs for bulk display name lookup
          const allUserIds = new Set<string>();
          for (const threadData of threadProcessingResult.results) {
            if (threadData) {
              threadData.allUserIds.forEach((userId) => allUserIds.add(userId));
            }
          }

          // Single bulk call for all display names
          const displayNameMap = await deps.infrastructureUserService.bulkGetDisplayNames(
            Array.from(allUserIds)
          );

          // Build final thread objects
          const threads = [];
          for (const threadData of threadProcessingResult.results) {
            if (!threadData) continue;

            const { parent, replies, participants } = threadData;
            
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

          // Log performance metrics
          if (threadProcessingResult.errorCount > 0) {
            logger.warn(
              `Thread discovery: ${threadProcessingResult.successCount}/${threadProcessingResult.totalProcessed} threads processed successfully`
            );
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
   * Resolve channel ID to channel name for search queries with caching
   * Provides consistent channel resolution across all search functions
   * Performance optimization: Uses cache to avoid redundant API calls
   */
  const resolveChannelName = async (channelId: string): Promise<string> => {
    // Check cache first
    const cached = channelNameCache.get(channelId);
    if (cached) {
      return cached;
    }

    try {
      const client = deps.clientManager.getClientForOperation('read');
      const channelInfo = await client.conversations.info({ channel: channelId });
      
      if (channelInfo.ok && channelInfo.channel?.name) {
        const channelName = channelInfo.channel.name;
        channelNameCache.set(channelId, channelName);
        return channelName;
      }
      
      // Fallback to channel ID if name resolution fails
      channelNameCache.set(channelId, channelId);
      return channelId;
    } catch {
      // Fallback to channel ID if any error occurs
      channelNameCache.set(channelId, channelId);
      return channelId;
    }
  };

  /**
   * Escape special characters in search query terms
   * Prevents query injection and handles edge cases
   */
  const escapeSearchQuery = (query: string): string => {
    if (!query || typeof query !== 'string') {
      return '';
    }
    // Remove or escape potentially problematic characters
    // Keep basic search operators but escape quotes and other special chars
    return query
      .replace(/["]/g, '\\"') // Escape quotes
      .replace(/[\r\n]/g, ' ') // Replace newlines with spaces
      .trim();
  };

  /**
   * Build search query with proper syntax and escaping
   * Centralizes query construction logic for consistency
   */
  const buildSearchQuery = async (options: {
    baseQuery: string;
    channel?: string;
    user?: string;
    after?: string;
    before?: string;
    additionalFilters?: string[];
  }): Promise<string> => {
    let searchQuery = escapeSearchQuery(options.baseQuery);

    // Add channel filter if specified
    if (options.channel) {
      const channelName = await resolveChannelName(options.channel);
      searchQuery += ` in:#${channelName}`;
    }

    // Add user filter if specified
    if (options.user) {
      searchQuery += ` from:<@${options.user}>`;
    }

    // Add date filters if specified
    if (options.after) {
      searchQuery += ` after:${options.after}`;
    }
    if (options.before) {
      searchQuery += ` before:${options.before}`;
    }

    // Add any additional filters
    if (options.additionalFilters) {
      for (const filter of options.additionalFilters) {
        searchQuery += ` ${filter}`;
      }
    }

    return searchQuery.trim();
  };

  /**
   * Search for threads by keywords or content using TypeSafeAPI + ts-pattern patterns
   * Improved version: validates thread existence and provides proper thread context
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

      const searchQuery = await buildSearchQuery({
        baseQuery: input.query,
        channel: input.channel,
        user: input.user,
        after: input.after,
        before: input.before,
      });

      const searchArgs: SearchAllArguments = {
        query: searchQuery,
        sort: input.sort === 'timestamp' ? 'timestamp' : 'score',
        sort_dir: input.sort_dir || 'desc',
        count: Math.min((input.limit || 20) * 2, 100), // Search more to account for thread filtering
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

      // Step 1: Extract potential threads from search results
      const threadCandidates = new Map<string, {
        channel: string;
        threadTs: string;
        searchMatch: SearchMessageElement;
      }>();

      for (const match of result.messages.matches) {
        if (!match.text || match.text.length === 0) continue;

        const messageTs = typeof match.ts === 'string' ? match.ts : String(match.ts);
        if (!messageTs || messageTs === 'undefined') continue;

        const channelId = typeof match.channel === 'string' 
          ? match.channel 
          : (match.channel as any)?.id || '';
        if (!channelId) continue;

        // Extract thread_ts from search result (improved logic)
        let threadTs: string;
        const searchMatchWithThread = match as any;
        if (searchMatchWithThread.thread_ts && 
            typeof searchMatchWithThread.thread_ts === 'string' &&
            searchMatchWithThread.thread_ts !== messageTs) {
          // This is a reply message, use thread_ts
          threadTs = searchMatchWithThread.thread_ts;
        } else {
          // This might be the parent message
          threadTs = messageTs;
        }

        const threadKey = `${channelId}-${threadTs}`;
        if (!threadCandidates.has(threadKey)) {
          threadCandidates.set(threadKey, {
            channel: channelId,
            threadTs,
            searchMatch: match,
          });
        }
      }

      // Step 2: Validate threads and get thread context concurrently
      const threadValidationResult = await processConcurrently(
        Array.from(threadCandidates.values()),
        async (candidate) => {
          try {
            const threadResult = await client.conversations.replies({
              channel: candidate.channel,
              ts: candidate.threadTs,
              limit: 10, // Just need to validate and get basic info
            });

            // Validate this is actually a thread (has replies)
            if (!threadResult.messages || threadResult.messages.length < 2) {
              return null; // Skip standalone messages
            }

            const parentMessage = threadResult.messages[0];
            const channelName = await resolveChannelName(candidate.channel);

            return {
              text: candidate.searchMatch.text || '',
              user: typeof candidate.searchMatch.user === 'string'
                ? candidate.searchMatch.user
                : typeof candidate.searchMatch.user === 'object' && candidate.searchMatch.user && 'id' in candidate.searchMatch.user
                  ? String((candidate.searchMatch.user as Record<string, unknown>).id)
                  : '',
              ts: candidate.threadTs,
              channel: {
                id: candidate.channel,
                name: channelName,
              },
              thread_ts: candidate.threadTs,
              reply_count: threadResult.messages.length - 1,
              permalink: candidate.searchMatch.permalink || '',
              parentMessage: {
                text: parentMessage?.text,
                user: parentMessage?.user,
                timestamp: parentMessage?.ts,
              },
            };
          } catch {
            return null; // Skip on any error
          }
        },
        {
          concurrency: 5,
          failFast: false,
        }
      );

      // Filter out null results and limit to requested amount
      const validThreads = threadValidationResult.results
        .filter((thread) => thread !== null)
        .slice(0, input.limit || 20);

      const output = enforceServiceOutput({
        results: validThreads,
        total: validThreads.length,
        query: searchQuery,
        hasMore: threadCandidates.size > validThreads.length,
        threadsValidated: threadValidationResult.successCount,
        threadCandidatesFound: threadCandidates.size,
      });

      return createServiceSuccess(
        output, 
        `Found ${validThreads.length} valid threads from ${threadCandidates.size} candidates`
      );
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

      // Build participants list using centralized service (replaces lines 490-548)
      const participantsResult = await deps.participantTransformationService.buildParticipantsFromMessages(messages);
      
      if (!participantsResult.success) {
        throw new SlackAPIError(`Failed to build participants: ${participantsResult.error}`);
      }

      const participants = participantsResult.data.participants;

      // Perform comprehensive analysis (now async for parallel processing)
      const analysis = await performComprehensiveAnalysis(messages, participants);

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

      // Perform analysis for summary (now async for parallel processing)
      const analysis = await performQuickAnalysis(messages);

      // Build participants for comprehensive analysis if needed (replaces lines 622-674)
      if (input.include_decisions || input.include_action_items) {
        const participantsResult = await deps.participantTransformationService.buildParticipantsFromMessages(messages);
        
        if (!participantsResult.success) {
          throw new SlackAPIError(`Failed to build participants: ${participantsResult.error}`);
        }

        const participants = participantsResult.data.participants;
        const fullAnalysis = await performComprehensiveAnalysis(messages, participants);

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

      // Build participants using centralized service (replaces lines 751-803)
      const participantsResult = await deps.participantTransformationService.buildParticipantsFromMessages(messages);
      
      if (!participantsResult.success) {
        throw new SlackAPIError(`Failed to build participants: ${participantsResult.error}`);
      }

      const participants = participantsResult.data.participants;

      // Perform comprehensive analysis (now async for parallel processing)
      const analysis = await performComprehensiveAnalysis(messages, participants);

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

      // Using Record<string, unknown> for Slack API compatibility - ChatPostMessageArguments has complex union types
      const messageArgs: Record<string, unknown> = {
        channel: input.channel,
        text: input.text,
        thread_ts: input.thread_ts,
        ...(input.reply_broadcast && { reply_broadcast: true }),
      };

      const result = await client.chat.postMessage(messageArgs as unknown as Parameters<typeof client.chat.postMessage>[0]);

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
        // Using Record<string, unknown> for Slack API compatibility - ChatPostMessageArguments has complex union types
        const replyArgs: Record<string, unknown> = {
          channel: input.channel,
          text: input.reply_text,
          thread_ts: parentResult.ts,
          ...(input.broadcast && { reply_broadcast: true }),
        };

        replyResult = await client.chat.postMessage(replyArgs as unknown as Parameters<typeof client.chat.postMessage>[0]);
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

      // Performance optimization: Pre-compute criteria and threshold
      const criteria = input.criteria || ['participant_count', 'message_count', 'urgency_keywords'];
      const importanceThreshold = input.importance_threshold || 0.7;
      const limitThreads = input.limit || 10;

      // Performance optimization: Process threads concurrently for importance analysis
      const importanceAnalysisResult = await processConcurrently(
        threadParents.slice(0, Math.max(limitThreads * 2, 50)), // Process more threads to find best ones
        async (parent) => {
          if (!parent.ts) return null;
          
          const threadResult = await client.conversations.replies({
            channel: input.channel,
            ts: parent.ts,
            limit: 100,
          });

          if (!threadResult.messages) return null;

          const messages = threadResult.messages as SlackMessage[];
          const analysis = await performQuickAnalysis(messages);

          // Calculate importance score based on criteria (optimized with pre-computed values)
          let importanceScore = 0;

          if (criteria.includes('message_count')) {
            importanceScore += Math.min(messages.length / 20, 1) * 0.3;
          }

          if (criteria.includes('urgency_keywords')) {
            const urgencyScores = {
              critical: 0.4,
              high: 0.3,
              medium: 0.2,
              low: 0.1,
            };
            importanceScore += urgencyScores[analysis.urgencyLevel];
          }

          if (criteria.includes('participant_count')) {
            // Use consistent participant counting (filter out undefined users)
            const uniqueUsers = new Set(messages.map((m) => m.user).filter((u): u is string => Boolean(u))).size;
            importanceScore += Math.min(uniqueUsers / 10, 1) * 0.2;
          }

          if (criteria.includes('mention_frequency')) {
            const mentionCount = messages.reduce(
              (count, msg) => count + (msg.text?.match(/<@[UW][A-Z0-9]+>/g)?.length || 0),
              0
            );
            importanceScore += Math.min(mentionCount / 5, 1) * 0.1;
          }

          // Only return if above threshold
          if (importanceScore >= importanceThreshold) {
            const uniqueUsers = new Set(messages.map((m) => m.user));
            return {
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
                participantCount: uniqueUsers.size,
                urgencyLevel: analysis.urgencyLevel,
                actionItemCount: analysis.actionItemCount,
                duration: analysis.duration,
              },
            };
          }
          
          return null;
        },
        {
          concurrency: 4, // Moderate concurrency for importance analysis
          failFast: false,
        }
      );

      // Filter null results and get important threads
      const importantThreads = importanceAnalysisResult.results.filter((thread) => thread !== null);
      
      // Log performance metrics
      if (importanceAnalysisResult.errorCount > 0) {
        logger.warn(
          `Important threads analysis: ${importanceAnalysisResult.successCount}/${importanceAnalysisResult.totalProcessed} threads analyzed successfully`
        );
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

      // Get user info if requested (replaces lines 1161-1199)
      let userInfoMap = new Map<
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
        const uniqueUsers = Array.from(
          new Set(messages.map((m) => m.user).filter((user): user is string => Boolean(user)))
        );
        
        const enhancedUserInfoResult = await deps.participantTransformationService.getEnhancedUserInfoForExport(uniqueUsers);
        
        if (enhancedUserInfoResult.success) {
          // Convert Record to Map
          userInfoMap = new Map(Object.entries(enhancedUserInfoResult.data.userInfoMap));
        } else {
          // Fallback to empty map if enhanced user info fails
          logger.warn(`Failed to get enhanced user info for export: ${enhancedUserInfoResult.error}`);
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
   * Optimized version with improved similarity calculation and performance
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
      
      // Build participants using centralized service for consistency
      const refParticipantsResult = await deps.participantTransformationService.buildParticipantsFromMessages(refMessages);
      
      if (!refParticipantsResult.success) {
        throw new SlackAPIError(`Failed to build reference thread participants: ${refParticipantsResult.error}`);
      }

      const refParticipants = refParticipantsResult.data.participants;
      const refAnalysis = await performQuickAnalysis(refMessages);

      // Determine search scope - include cross-channel if requested
      const searchChannels: string[] = [input.channel];
      if (input.include_cross_channel) {
        // For cross-channel search, we'd need to get channel list
        // For now, limit to current channel to avoid excessive API calls
        logger.info('Cross-channel search requested but limited to current channel for performance');
      }

      // Performance optimization: Pre-compute reference thread data for comparison
      const refText = refMessages
        .map((m) => m.text || '')
        .join(' ')
        .toLowerCase();
      const refWords = new Set(refText.split(/\s+/).filter((w) => w.length > 3));
      const refUsers = new Set(refParticipants.map((p) => p.user_id));
      const refTime = parseInt(input.thread_ts);
      const maxTime = 7 * 24 * 60 * 60; // 7 days in seconds
      const similarityThreshold = input.similarity_threshold || 0.3;
      const relationshipTypes = input.relationship_types || ['keyword_overlap', 'participant_overlap'];

      // Get candidate threads from all search channels
      const candidateThreadsResult = await processConcurrently(
        searchChannels,
        async (channelId) => {
          // Get threads from last 30 days for comparison
          const thirtyDaysAgo = Math.floor((Date.now() - 30 * 24 * 60 * 60 * 1000) / 1000);
          const historyResult = await client.conversations.history({
            channel: channelId,
            limit: 1000,
            oldest: thirtyDaysAgo.toString(),
          });

          if (!historyResult.messages) return [];

          return historyResult.messages.filter(
            (message: MessageElement) =>
              message.reply_count && message.reply_count > 0 && message.ts !== input.thread_ts
          );
        },
        {
          concurrency: 2, // Conservative for channel history calls
          failFast: false,
        }
      );

      const allThreadParents = candidateThreadsResult.results.flat();
      
      if (allThreadParents.length === 0) {
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
        return createServiceSuccess(output, 'No other threads found for comparison');
      }

      // Performance optimization: Process thread comparison concurrently with batching
      const threadComparisonResult = await processConcurrentlyInBatches(
        allThreadParents.slice(0, 150), // Increased limit for better coverage
        async (parent) => {
          if (!parent.ts) return null;
          
          const threadResult = await client.conversations.replies({
            channel: input.channel,
            ts: parent.ts,
            limit: 100,
          });

          if (!threadResult.messages) return null;

          const messages = threadResult.messages as SlackMessage[];
          const analysis = await performQuickAnalysis(messages);

          let similarityScore = 0;

          // Enhanced keyword overlap similarity (using Jaccard similarity)
          if (relationshipTypes.includes('keyword_overlap')) {
            const compText = messages
              .map((m) => m.text || '')
              .join(' ')
              .toLowerCase();
            const compWords = new Set(compText.split(/\s+/).filter((w) => w.length > 3));
            const intersection = new Set([...refWords].filter((w) => compWords.has(w)));
            const union = new Set([...refWords, ...compWords]);
            if (union.size > 0) {
              const jaccardSimilarity = intersection.size / union.size;
              similarityScore += jaccardSimilarity * 0.4;
            }
          }

          // Enhanced participant overlap (using participant display names)
          if (relationshipTypes.includes('participant_overlap')) {
            const compParticipantsResult = await deps.participantTransformationService.buildParticipantsFromMessages(messages);
            if (compParticipantsResult.success) {
              const compUsers = new Set(compParticipantsResult.data.participants.map((p) => p.user_id));
              const userIntersection = new Set([...refUsers].filter((u) => compUsers.has(u)));
              const userUnion = new Set([...refUsers, ...compUsers]);
              if (userUnion.size > 0) {
                const participantSimilarity = userIntersection.size / userUnion.size;
                similarityScore += participantSimilarity * 0.3;
              }
            }
          }

          // Improved temporal proximity (non-linear decay)
          if (relationshipTypes.includes('temporal_proximity')) {
            const compTime = parseInt(parent.ts || '0');
            const timeDiff = Math.abs(refTime - compTime);
            if (timeDiff < maxTime) {
              // Use exponential decay for temporal proximity
              const temporalSimilarity = Math.exp(-timeDiff / (maxTime / 3));
              similarityScore += temporalSimilarity * 0.2;
            }
          }

          // Enhanced topic similarity (multiple factors)
          if (relationshipTypes.includes('topic_similarity')) {
            let topicScore = 0;
            
            // Urgency level similarity
            if (refAnalysis.urgencyLevel === analysis.urgencyLevel) {
              topicScore += 0.5;
            }
            
            // Message length similarity (normalized)
            const refLength = refMessages.length;
            const compLength = messages.length;
            const lengthSimilarity = 1 - Math.abs(refLength - compLength) / Math.max(refLength, compLength);
            topicScore += lengthSimilarity * 0.3;
            
            // Action item presence similarity
            if ((refAnalysis.actionItemCount > 0) === (analysis.actionItemCount > 0)) {
              topicScore += 0.2;
            }
            
            similarityScore += topicScore * 0.1;
          }

          // Only return if above threshold
          if (similarityScore >= similarityThreshold) {
            return {
              channel: input.channel,
              threadTs: parent.ts,
              parentMessage: {
                text: parent.text,
                user: parent.user,
                timestamp: parent.ts,
              },
              similarityScore,
              relationshipTypes,
              analysis: {
                messageCount: messages.length,
                urgencyLevel: analysis.urgencyLevel,
                actionItemCount: analysis.actionItemCount,
              },
            };
          }
          
          return null;
        },
        50, // Process 50 threads per batch
        {
          concurrency: 4, // Moderate concurrency for thread comparison
          failFast: false,
        }
      );

      // Filter null results and collect related threads
      const relatedThreads = threadComparisonResult.results.filter((thread) => thread !== null);
      
      // Log performance metrics
      if (threadComparisonResult.errorCount > 0) {
        logger.warn(
          `Related threads analysis: ${threadComparisonResult.successCount}/${threadComparisonResult.totalProcessed} threads analyzed successfully`
        );
      }

      // Sort by similarity score (highest first)
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
        analysisMetrics: {
          threadsAnalyzed: threadComparisonResult.totalProcessed,
          threadsAboveThreshold: relatedThreads.length,
          averageSimilarity: relatedThreads.length > 0 
            ? relatedThreads.reduce((sum, t) => sum + t.similarityScore, 0) / relatedThreads.length 
            : 0,
        },
      });

      return createServiceSuccess(output, `Found ${relatedThreads.length} related threads from ${threadComparisonResult.totalProcessed} analyzed`);
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

      // Performance optimization: Analyze threads concurrently with batch processing
      const metrics = {
        totalThreads: allThreads.length,
        averageReplies: 0,
        mostActiveThreads: [],
        participantStats: new Map<string, number>(),
        timeDistribution: new Map<number, number>(),
        totalMessages: 0,
      };

      if (allThreads.length > 0 && input.channel) {
        // Filter valid threads and prepare for concurrent processing
        const validThreads = allThreads.filter((thread) => thread.ts);
        
        // Performance improvement: Process threads concurrently in batches
        const threadAnalysisResult = await processConcurrentlyInBatches(
          validThreads,
          async (thread) => {
            if (!thread.ts) return null;
            
            const threadResult = await client.conversations.replies({
              channel: input.channel!,
              ts: thread.ts,
              limit: 100,
            });

            if (!threadResult.messages) return null;

            const messageCount = threadResult.messages.length;
            const participants = new Map<string, number>();
            const hour = new Date(parseFloat(thread.ts) * 1000).getHours();

            // Count participants in this thread
            for (const message of threadResult.messages) {
              if (message.user) {
                participants.set(
                  message.user,
                  (participants.get(message.user) || 0) + 1
                );
              }
            }

            return {
              messageCount,
              replyCount: messageCount - 1, // Subtract parent message
              participants,
              hour,
            };
          },
          50, // Process 50 threads per batch
          {
            concurrency: 5, // Higher concurrency for metrics processing
            failFast: false, // Continue on individual thread failures
          }
        );

        // Aggregate results from concurrent processing
        let totalReplies = 0;
        
        for (const threadData of threadAnalysisResult.results) {
          if (!threadData) continue;
          
          totalReplies += threadData.replyCount;
          metrics.totalMessages += threadData.messageCount;

          // Merge participant stats
          for (const [user, count] of threadData.participants) {
            metrics.participantStats.set(
              user,
              (metrics.participantStats.get(user) || 0) + count
            );
          }

          // Track time distribution
          metrics.timeDistribution.set(
            threadData.hour,
            (metrics.timeDistribution.get(threadData.hour) || 0) + 1
          );
        }

        metrics.averageReplies = validThreads.length > 0 ? totalReplies / validThreads.length : 0;
        
        // Log performance metrics
        if (threadAnalysisResult.errorCount > 0) {
          logger.warn(
            `Thread metrics analysis: ${threadAnalysisResult.successCount}/${threadAnalysisResult.totalProcessed} threads processed successfully`
          );
        }
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
   * Uses hybrid approach: findThreadsInChannel for single-channel, improved search for cross-channel
   */
  const getThreadsByParticipants = async (args: unknown): Promise<ThreadsByParticipantsResult> => {
    try {
      const input = validateInput(GetThreadsByParticipantsSchema, args);

      // Strategy 1: Use findThreadsInChannel for single-channel searches (more reliable)
      if (input.channel) {
        return await getThreadsByParticipantsInChannel({
          ...input,
          channel: input.channel, // Ensure channel is not undefined
        });
      }

      // Strategy 2: Use improved search for cross-channel searches
      return await getThreadsByParticipantsViaSearch(input);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      return createServiceError(errorMessage, 'Failed to find threads by participants');
    }
  };

  /**
   * Helper: Find threads by participants within a specific channel using findThreadsInChannel
   */
  const getThreadsByParticipantsInChannel = async (
    input: {
      participants: string[];
      channel: string;
      require_all_participants?: boolean;
      after?: string;
      before?: string;
      limit?: number;
    }
  ): Promise<ThreadsByParticipantsResult> => {
    // Use existing findThreadsInChannel and filter by participants
    const findThreadsInput = {
      channel: input.channel,
      fetch_all_pages: false,
      limit: Math.min(input.limit || 20, 100), // Reasonable limit for processing
      oldest: input.after,
      latest: input.before,
    };

    const threadsResult = await findThreadsInChannel(findThreadsInput);
    
    if (!threadsResult.success) {
      return createServiceError(threadsResult.error, 'Failed to find threads in channel');
    }

    const allThreads = threadsResult.data.threads || [];
    const matchingThreads = [];

    for (const thread of allThreads) {
      const threadParticipants = new Set(thread.participants || []);
      
      let includeThread = false;
      if (input.require_all_participants) {
        // ALL participants must be in thread
        includeThread = input.participants.every((p) => threadParticipants.has(p));
      } else {
        // ANY participant can be in thread
        includeThread = input.participants.some((p) => threadParticipants.has(p));
      }

      if (includeThread && thread.threadTs) {
        matchingThreads.push({
          channel: input.channel,
          threadTs: thread.threadTs,
          parentMessage: thread.parentMessage,
          participants: Array.from(threadParticipants).filter((p): p is string => Boolean(p)),
          messageCount: thread.replyCount + 1, // Include parent message
          matchingParticipants: input.participants.filter((p) => threadParticipants.has(p)),
        });
      }
    }

    const output = enforceServiceOutput({
      threads: matchingThreads.slice(0, input.limit || 20),
      total: matchingThreads.length,
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
      `Found ${matchingThreads.length} threads with specified participants in channel`
    );
  };

  /**
   * Helper: Find threads by participants via search API with improved thread identification
   */
  const getThreadsByParticipantsViaSearch = async (
    input: {
      participants: string[];
      channel?: string;
      require_all_participants?: boolean;
      after?: string;
      before?: string;
      limit?: number;
    }
  ): Promise<ThreadsByParticipantsResult> => {
    // Check if search API is available for broader search
    deps.clientManager.checkSearchApiAvailability(
      'getThreadsByParticipants',
      'Use findThreadsInChannel with filtering instead'
    );

    const client = deps.clientManager.getClientForOperation('read');

    // Build participant query - use improved logic for better search results
    let participantQuery = '';
    if (input.require_all_participants) {
      // For ALL participants (AND logic), we need to search sequentially
      // Slack search doesn't support native AND for participants
      // We'll search for the first participant and filter programmatically
      participantQuery = `from:<@${input.participants[0]}>`;
    } else {
      // Any participant can be in thread (OR logic)
      participantQuery = input.participants.map((p) => `from:<@${p}>`).join(' OR ');
    }

    const searchQuery = await buildSearchQuery({
      baseQuery: participantQuery,
      channel: input.channel,
      after: input.after,
      before: input.before,
    });

    const searchResult = await client.search.all({
      query: searchQuery,
      count: Math.min((input.limit || 20) * 3, 100), // Search more to account for filtering
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

    // Process search results with improved thread identification
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
      try {
        // Improved thread identification logic
        const messageTs = typeof match.ts === 'string' ? match.ts : String(match.ts);
        if (!messageTs || messageTs === 'undefined' || messageTs === 'null') continue;

        const channelId = typeof match.channel === 'string' 
          ? match.channel 
          : (match.channel as any)?.id || '';
        if (!channelId) continue;

        // Key improvement: Properly extract thread_ts from search results
        let actualThreadTs: string;
        
        // First, check if the search result has thread_ts (indicates this is a reply)
        const searchMatchWithThread = match as any;
        if (searchMatchWithThread.thread_ts && 
            typeof searchMatchWithThread.thread_ts === 'string' &&
            searchMatchWithThread.thread_ts !== messageTs) {
          // This is a reply message, use thread_ts as the actual thread parent
          actualThreadTs = searchMatchWithThread.thread_ts;
        } else {
          // This might be the thread parent or a standalone message
          // We need to check if this message actually has replies
          actualThreadTs = messageTs;
        }

        const threadKey = `${channelId}-${actualThreadTs}`;
        if (threadMap.has(threadKey)) continue;

        // Validate thread existence and get full thread data
        const threadResult = await client.conversations.replies({
          channel: channelId,
          ts: actualThreadTs,
          limit: 100,
        });

        // Check if this is actually a thread (has more than one message)
        if (!threadResult.messages || threadResult.messages.length < 2) {
          continue; // Skip standalone messages
        }

        const threadUsers = new Set(
          threadResult.messages.map((m: MessageElement) => m.user).filter((u): u is string => Boolean(u))
        );

        // Apply participant filtering
        let includeThread = false;
        if (input.require_all_participants) {
          // ALL participants must be in thread
          includeThread = input.participants.every((p) => threadUsers.has(p));
        } else {
          // ANY participant can be in thread
          includeThread = input.participants.some((p) => threadUsers.has(p));
        }

        if (includeThread) {
          const parentMessage = threadResult.messages[0];
          threadMap.set(threadKey, {
            channel: channelId,
            threadTs: actualThreadTs,
            parentMessage: {
              text: parentMessage?.text,
              user: parentMessage?.user,
              timestamp: parentMessage?.ts,
            },
            participants: Array.from(threadUsers),
            messageCount: threadResult.messages.length,
            matchingParticipants: input.participants.filter((p) => threadUsers.has(p)),
          });
        }
      } catch {
        // Skip individual thread processing errors and continue
        continue;
      }
    }

    const threads = Array.from(threadMap.values());

    // Sort by timestamp (most recent first) and limit results
    threads.sort((a, b) => parseFloat(b.threadTs) - parseFloat(a.threadTs));
    const limitedThreads = threads.slice(0, input.limit || 20);

    const output = enforceServiceOutput({
      threads: limitedThreads,
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
      `Found ${limitedThreads.length} threads with specified participants via search`
    );
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
