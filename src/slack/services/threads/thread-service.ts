import type { SearchAllArguments } from '@slack/web-api';
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
} from '../../../utils/validation.js';
import type { ThreadService, ThreadServiceDependencies } from './types.js';
import {
  formatFindThreadsResponse,
  formatCreateThreadResponse,
  formatThreadRepliesResponse,
} from '../formatters/text-formatters.js';
import { executePagination } from '../../infrastructure/generic-pagination.js';

// Export types for external use
export type { ThreadService, ThreadServiceDependencies } from './types.js';
import { SlackAPIError } from '../../../utils/errors.js';
import type {
  SlackMessage,
  ThreadParticipant,
  ThreadAnalysis,
  ThreadSummary,
} from '../../types.js';
import {
  performComprehensiveAnalysis,
  performQuickAnalysis,
  formatThreadAnalysis,
  formatThreadSummary,
  type ThreadSummaryFormatterOptions,
} from '../../analysis/index.js';

/**
 * Create thread service with infrastructure dependencies
 * @param deps - Infrastructure dependencies
 * @returns Thread service instance
 */
export const createThreadService = (deps: ThreadServiceDependencies): ThreadService => {
  /**
   * Find all threads in a channel
   */
  const findThreadsInChannel = (args: unknown) =>
    deps.requestHandler.handleWithCustomFormat(FindThreadsInChannelSchema, args, async (input) => {
      const client = deps.clientManager.getClientForOperation('read');

      // Use unified pagination implementation with thread processing logic
      return await executePagination(input, {
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
            (msg: any) => msg.thread_ts && msg.ts === msg.thread_ts && (msg.reply_count || 0) > 0
          );
        },
        
        formatResponse: async (data) => {
          const threadParents = data.items;
          const threads = [];

          for (const parentMsg of threadParents) {
            // Get thread replies for each parent message (maintains compatibility)
            const repliesResult = await client.conversations.replies({
              channel: input.channel,
              ts: (parentMsg as any).ts!,
              limit: 100,
            });

            if (repliesResult.ok && repliesResult.messages) {
              const [parent, ...replies] = repliesResult.messages;

              if (parent) {
                threads.push({
                  threadTs: parent.ts,
                  parentMessage: {
                    text: parent.text,
                    user: parent.user,
                    timestamp: parent.ts,
                  },
                  replyCount: replies.length,
                  lastReply: replies[replies.length - 1]?.ts || parent.ts,
                  participants: [...new Set(replies.map((r: any) => r.user).filter(Boolean))],
                });
              }
            }
          }

          return await formatFindThreadsResponse(
            {
              threads,
              total: threads.length,
              hasMore: data.hasMore,
            },
            deps.userService.getDisplayName
          );
        },
      });
    });

  /**
   * Get all replies in a thread
   */
  const getThreadReplies = (args: unknown) =>
    deps.requestHandler.handleWithCustomFormat(GetThreadRepliesSchema, args, async (input) => {
      const client = deps.clientManager.getClientForOperation('read');

      // Use unified pagination implementation
      return await executePagination(input, {
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
            throw new SlackAPIError(
              `Thread not found: ${result.error || 'No messages returned'}`
            );
          }

          return result;
        },

        getCursor: (response) => response.response_metadata?.next_cursor,
        
        getItems: (response) => response.messages || [],
        
        formatResponse: async (data) => {
          // Check for error case in single page mode
          if (!data.hasMore && data.items.length === 0) {
            const error = new SlackAPIError('Thread not found: No messages returned');
            return {
              content: [
                {
                  type: 'text',
                  text: `Slack API Error: ${error.message}`,
                },
              ],
              isError: true,
            };
          }

          return await formatThreadRepliesResponse(
            {
              messages: data.items,
              hasMore: data.hasMore,
              cursor: data.cursor,
              totalMessages: data.items.length,
            },
            deps.userService.getDisplayName
          );
        },
      });
    });

  /**
   * Search for threads by keywords or content
   */
  const searchThreads = (args: unknown) =>
    deps.requestHandler.handle(SearchThreadsSchema, args, async (input) => {
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
        return { results: [], total: 0 };
      }

      // Filter for messages that are part of threads
      const threadMessages = result.messages.matches.filter(
        (match: any) => match.thread_ts || match.reply_count > 0
      );

      return {
        results: threadMessages,
        total: threadMessages.length,
        query: searchQuery,
      };
    });

  /**
   * Analyze a thread comprehensively
   */
  const analyzeThread = (args: unknown) =>
    deps.requestHandler.handle(AnalyzeThreadSchema, args, async (input) => {
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
          const userInfo = await deps.userService.getUserInfo(message.user);
          participantMap.set(message.user, {
            user_id: message.user,
            username: userInfo.name || userInfo.real_name || message.user,
            real_name: userInfo.real_name,
            message_count: 0,
            first_message_ts: message.ts || '',
            last_message_ts: message.ts || '',
          });
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

      // Format the analysis result
      const formattedOptions = {
        includeTimeline: input.include_timeline !== false,
        includeSentimentAnalysis: input.include_sentiment_analysis !== false,
        includeActionItems: input.include_action_items !== false,
        includeSummary: true,
        includeParticipants: true,
        includeTopics: input.extract_topics !== false,
        includeEmojis: false,
        includeTimestamps: false,
        maxLineLength: 80,
        precision: 1,
      };

      // Convert ComprehensiveAnalysisResult to ThreadAnalysis format
      const threadAnalysis: ThreadAnalysis = {
        thread_ts: input.thread_ts,
        channel_id: input.channel,
        participants,
        timeline: analysis.timeline.events.map((event) => ({
          timestamp: event.timestamp,
          event_type: 'message' as const,
          user_id: event.user_id || '',
          content: event.content || '',
        })),
        key_topics: [...analysis.topics.topics],
        urgency_score: analysis.urgency.score,
        importance_score: analysis.importance.score,
        sentiment: analysis.sentiment.sentiment,
        action_items: analysis.actionItems.actionItems.map((item) => ({
          text: item.text,
          mentioned_users: (item as any).assigned_to ? [(item as any).assigned_to] : [],
          priority: item.priority,
          status: item.status,
          extracted_from_message_ts: (item as any).message_ts || '',
        })),
        summary: 'Thread analysis completed',
        word_count: analysis.metadata.messageCount * 10, // Rough estimate
        duration_hours: (Date.now() - parseFloat(input.thread_ts || '0') * 1000) / (1000 * 60 * 60),
      };

      return formatThreadAnalysis(threadAnalysis, formattedOptions);
    });

  /**
   * Generate an intelligent summary of thread content
   */
  const summarizeThread = (args: unknown) =>
    deps.requestHandler.handle(SummarizeThreadSchema, args, async (input) => {
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
            const userInfo = await deps.userService.getUserInfo(message.user);
            participantMap.set(message.user, {
              user_id: message.user,
              username: userInfo.name || userInfo.real_name || message.user,
              real_name: userInfo.real_name,
              message_count: 0,
              first_message_ts: message.ts || '',
              last_message_ts: message.ts || '',
            });
          }
        }
        const participants = Array.from(participantMap.values());
        const fullAnalysis = performComprehensiveAnalysis(messages, participants);

        const summaryOptions: ThreadSummaryFormatterOptions = {
          includeDecisions: input.include_decisions !== false,
          includeActionItems: input.include_action_items !== false,
          includeDetails: input.summary_length !== 'brief',
          includeKeyPoints: true,
          includeEmojis: true,
          includeTimestamps: false,
          maxLineLength: 100,
          precision: 1,
        };

        // Create ThreadSummary from analysis
        const threadSummary: ThreadSummary = {
          thread_ts: input.thread_ts,
          channel_id: input.channel,
          title: 'Thread Analysis',
          brief_summary: 'Thread summary generated',
          key_points: fullAnalysis.topics.topics.slice(0, 5),
          decisions_made: [], // TODO: Extract from analysis
          action_items: [...fullAnalysis.actionItems.actionItems],
          participants: participants.map((p) => p.user_id),
          message_count: messages.length,
          duration: `${Math.round(fullAnalysis.timeline.totalDuration)} minutes`,
          status: 'active' as const,
        };
        return formatThreadSummary(threadSummary, summaryOptions);
      }

      // Basic summary without comprehensive analysis
      return {
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
      };
    });

  /**
   * Extract action items from thread messages
   */
  const extractActionItems = (args: unknown) =>
    deps.requestHandler.handle(ExtractActionItemsSchema, args, async (input) => {
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
          const userInfo = await deps.userService.getUserInfo(message.user);
          participantMap.set(message.user, {
            user_id: message.user,
            username: userInfo.name || userInfo.real_name || message.user,
            real_name: userInfo.real_name,
            message_count: 0,
            first_message_ts: message.ts || '',
            last_message_ts: message.ts || '',
          });
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

      return {
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
      };
    });

  /**
   * Post a reply to an existing thread
   */
  const postThreadReply = (args: unknown) =>
    deps.requestHandler.handle(PostThreadReplySchema, args, async (input) => {
      const client = deps.clientManager.getClientForOperation('write');

      const messageArgs: any = {
        channel: input.channel,
        text: input.text,
        thread_ts: input.thread_ts,
      };

      if (input.reply_broadcast) {
        messageArgs.reply_broadcast = input.reply_broadcast;
      }

      const result = await client.chat.postMessage(messageArgs);

      return {
        success: true,
        timestamp: result.ts,
        channel: result.channel,
        threadTs: input.thread_ts,
        message: result.message,
      };
    });

  /**
   * Create a new thread by posting a parent message and optional first reply
   */
  const createThread = (args: unknown) =>
    deps.requestHandler.handleWithCustomFormat(CreateThreadSchema, args, async (input) => {
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
        const replyArgs: any = {
          channel: input.channel,
          text: input.reply_text,
          thread_ts: parentResult.ts,
        };

        if (input.broadcast) {
          replyArgs.reply_broadcast = input.broadcast;
        }

        replyResult = await client.chat.postMessage(replyArgs);
      }

      return formatCreateThreadResponse({
        success: true,
        threadTs: parentResult.ts,
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
      });
    });

  /**
   * Mark a thread as important with reactions and notifications
   */
  const markThreadImportant = (args: unknown) =>
    deps.requestHandler.handle(MarkThreadImportantSchema, args, async (input) => {
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

      return {
        success: true,
        channel: input.channel,
        threadTs: input.thread_ts,
        importanceLevel: input.importance_level || 'high',
        reactionAdded: reactionName,
        commentPosted: !!input.reason,
      };
    });

  /**
   * Identify important or urgent threads in a channel
   */
  const identifyImportantThreads = (args: unknown) =>
    deps.requestHandler.handle(IdentifyImportantThreadsSchema, args, async (input) => {
      const client = deps.clientManager.getClientForOperation('read');

      // Calculate time range
      const hoursBack = input.time_range_hours || 168; // Default 1 week
      const oldestTimestamp = Math.floor((Date.now() - hoursBack * 60 * 60 * 1000) / 1000);

      // Get channel history
      const historyResult = await client.conversations.history({
        channel: input.channel,
        limit: 1000,
        oldest: oldestTimestamp.toString(),
      });

      if (!historyResult.messages) {
        return { importantThreads: [], total: 0 };
      }

      // Find thread parents
      const threadParents = historyResult.messages.filter(
        (message: any) => message.reply_count && message.reply_count > 0
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

      return {
        importantThreads: importantThreads.slice(0, input.limit || 10),
        total: importantThreads.length,
        criteria: input.criteria || ['participant_count', 'message_count', 'urgency_keywords'],
        threshold: input.importance_threshold || 0.7,
      };
    });

  /**
   * Export thread content in various formats
   */
  const exportThread = (args: unknown) =>
    deps.requestHandler.handle(ExportThreadSchema, args, async (input) => {
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
      const userInfoMap = new Map<string, { displayName: string }>();
      if (input.include_user_profiles) {
        const uniqueUsers = new Set(
          messages.map((m) => m.user).filter((user): user is string => Boolean(user))
        );
        for (const userId of uniqueUsers) {
          const userInfo = await deps.userService.getUserInfo(userId);
          userInfoMap.set(userId, userInfo);
        }
      }

      // Basic export implementation - will be enhanced with proper formatters later
      const basicExport = {
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
      };

      return basicExport;
    });

  /**
   * Find threads related to a given thread
   */
  const findRelatedThreads = (args: unknown) =>
    deps.requestHandler.handle(FindRelatedThreadsSchema, args, async (input) => {
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
        return { relatedThreads: [], total: 0 };
      }

      const threadParents = historyResult.messages.filter(
        (message: any) =>
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

      return {
        relatedThreads: relatedThreads.slice(0, input.max_results || 10),
        total: relatedThreads.length,
        referenceThread: input.thread_ts,
        similarityThreshold: input.similarity_threshold || 0.3,
      };
    });

  /**
   * Get statistics and metrics about threads
   */
  const getThreadMetrics = (args: unknown) =>
    deps.requestHandler.handle(GetThreadMetricsSchema, args, async (input) => {
      const client = deps.clientManager.getClientForOperation('read');

      // Calculate time range
      const now = new Date();
      const after = input.after
        ? new Date(input.after)
        : new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      const before = input.before ? new Date(input.before) : now;

      const oldestTs = Math.floor(after.getTime() / 1000).toString();
      const latestTs = Math.floor(before.getTime() / 1000).toString();

      let allThreads: any[] = [];

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
            (message: any) => message.reply_count && message.reply_count > 0
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
          // Limit for performance
          const threadResult = await client.conversations.replies({
            channel: input.channel || thread.channel,
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
            const hour = new Date(parseFloat(thread.ts) * 1000).getHours();
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

      return {
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
      };
    });

  /**
   * Find threads that include specific participants
   */
  const getThreadsByParticipants = (args: unknown) =>
    deps.requestHandler.handle(GetThreadsByParticipantsSchema, args, async (input) => {
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
        return { threads: [], total: 0 };
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
        const threadTs =
          (match as any).thread_ts || ((match as any).reply_count > 0 ? (match as any).ts : null);
        if (!threadTs) continue;

        const threadKey = `${match.channel?.id || match.channel?.name}-${threadTs}`;
        if (threadMap.has(threadKey)) continue;

        // Get full thread to verify participants
        const threadResult = await client.conversations.replies({
          channel: (match as any).channel?.id || (match as any).channel?.name || '',
          ts: threadTs,
          limit: 100,
        });

        if (threadResult.messages) {
          const threadUsers = new Set(
            threadResult.messages?.map((m: any) => m.user).filter(Boolean) || []
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
              channel: (match as any).channel?.id || (match as any).channel?.name || '',
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

      return {
        threads,
        total: threads.length,
        searchedParticipants: input.participants,
        requireAllParticipants: input.require_all_participants || false,
      };
    });

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
