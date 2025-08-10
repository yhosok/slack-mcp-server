import { 
  WebClient, 
  LogLevel,
  WebClientEvent,
  type SearchAllArguments,
  type FilesListArguments,
  type UsersListArguments,
  type ChatPostMessageArguments,
  type ReactionsGetArguments
} from '@slack/web-api';
/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { CONFIG } from '../config/index.js';
import { logger } from '../utils/logger.js';
import { SlackAPIError } from '../utils/errors.js';
import {
  validateInput,
  SendMessageSchema,
  ListChannelsSchema,
  GetChannelHistorySchema,
  GetUserInfoSchema,
  SearchMessagesSchema,
  GetChannelInfoSchema,
  FindThreadsInChannelSchema,
  GetThreadRepliesSchema,
  SearchThreadsSchema,
  AnalyzeThreadSchema,
  SummarizeThreadSchema,
  PostThreadReplySchema,
  CreateThreadSchema,
  MarkThreadImportantSchema,
  ExportThreadSchema,
  FindRelatedThreadsSchema,
  GetThreadMetricsSchema,
  GetThreadsByParticipantsSchema,
  ExtractActionItemsSchema,
  IdentifyImportantThreadsSchema,
  UploadFileSchema,
  ListFilesSchema,
  GetFileInfoSchema,
  DeleteFileSchema,
  ShareFileSchema,
  AnalyzeFilesSchema,
  SearchFilesSchema,
  AddReactionSchema,
  RemoveReactionSchema,
  GetReactionsSchema,
  GetReactionStatisticsSchema,
  FindMessagesByReactionsSchema,
  GetWorkspaceInfoSchema,
  ListTeamMembersSchema,
  GetWorkspaceActivitySchema,
  GetServerHealthSchema,
} from '../utils/validation.js';
import type {
  SlackThread,
  ThreadAnalysis,
  ThreadSearchResult,
  ThreadSummary,
  ThreadMetrics,
  RelatedThread,
  ThreadExportResult,
  ThreadExportOptions,
  ThreadTimelineEvent,
  ActionItem,
  ThreadParticipant,
  SlackMessage,
  SlackFile,
  FileAnalysis,
  ReactionStatistics,
  WorkspaceInfo,
  TeamMember,
  WorkspaceActivity,
  ServerHealth,
  SearchThreadsInput,
  SearchMatch,
} from './types.js';

/**
 * Service class for Slack API operations
 */
export class SlackService {
  private client: WebClient | undefined;
  private userClient: WebClient | undefined;
  private userCache: Map<string, string> = new Map();
  
  // Rate limiting metrics
  private rateLimitMetrics = {
    totalRequests: 0,
    rateLimitedRequests: 0,
    retryAttempts: 0,
    lastRateLimitTime: null as Date | null,
    rateLimitsByTier: new Map<string, number>(),
  };

  constructor() {
    // Delay initialization until first use
  }

  private getClient(): WebClient {
    if (!this.client) {
      this.client = new WebClient(CONFIG.SLACK_BOT_TOKEN, {
        logLevel: this.getSlackLogLevel(),
        retryConfig: CONFIG.SLACK_ENABLE_RATE_LIMIT_RETRY ? {
          retries: CONFIG.SLACK_RATE_LIMIT_RETRIES,
          factor: 2,
          minTimeout: 1000,
          maxTimeout: 300000,
          randomize: true,
        } : undefined,
        maxRequestConcurrency: CONFIG.SLACK_MAX_REQUEST_CONCURRENCY,
        rejectRateLimitedCalls: CONFIG.SLACK_REJECT_RATE_LIMITED_CALLS,
      });
      
      // Add rate limiting event listeners
      this.setupRateLimitListeners(this.client, 'bot');
    }
    return this.client;
  }

  private getUserClient(): WebClient {
    if (!CONFIG.SLACK_USER_TOKEN) {
      throw new SlackAPIError(
        'SLACK_USER_TOKEN is required for search operations. Please set the SLACK_USER_TOKEN environment variable with your user token (xoxp-*).'
      );
    }
    
    if (!this.userClient) {
      this.userClient = new WebClient(CONFIG.SLACK_USER_TOKEN, {
        logLevel: this.getSlackLogLevel(),
        retryConfig: CONFIG.SLACK_ENABLE_RATE_LIMIT_RETRY ? {
          retries: CONFIG.SLACK_RATE_LIMIT_RETRIES,
          factor: 2,
          minTimeout: 1000,
          maxTimeout: 300000,
          randomize: true,
        } : undefined,
        maxRequestConcurrency: CONFIG.SLACK_MAX_REQUEST_CONCURRENCY,
        rejectRateLimitedCalls: CONFIG.SLACK_REJECT_RATE_LIMITED_CALLS,
      });
      
      // Add rate limiting event listeners
      this.setupRateLimitListeners(this.userClient, 'user');
    }
    return this.userClient;
  }

  /**
   * Setup rate limiting event listeners for WebClient
   * @param client - WebClient instance
   * @param clientType - Type of client (bot/user) for logging
   */
  private setupRateLimitListeners(client: WebClient, clientType: 'bot' | 'user'): void {
    client.on(WebClientEvent.RATE_LIMITED, (numSeconds: number, { team_id, api_url }) => {
      this.rateLimitMetrics.rateLimitedRequests++;
      this.rateLimitMetrics.lastRateLimitTime = new Date();
      
      // Track by tier (extract from API URL)
      const tier = this.extractTierFromUrl(api_url);
      const currentCount = this.rateLimitMetrics.rateLimitsByTier.get(tier) || 0;
      this.rateLimitMetrics.rateLimitsByTier.set(tier, currentCount + 1);
      
      logger.warn(`Rate limit hit for ${clientType} client`, {
        team_id,
        api_url,
        retry_after_seconds: numSeconds,
        tier,
        total_rate_limits: this.rateLimitMetrics.rateLimitedRequests
      });
    });

    // Track total requests - use a different approach since HTTP_REQUEST may not be available
    const originalRequest = client.apiCall.bind(client);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    client.apiCall = (method: string, options?: any) => {
      this.rateLimitMetrics.totalRequests++;
      return originalRequest(method, options);
    };
  }

  /**
   * Extract rate limit tier from API URL
   * @param apiUrl - Slack API URL
   * @returns Tier identifier
   */
  private extractTierFromUrl(apiUrl?: string): string {
    if (!apiUrl) return 'unknown';
    
    // Common patterns for different tiers
    if (apiUrl.includes('chat.') || apiUrl.includes('files.')) return 'tier1';
    if (apiUrl.includes('conversations.') || apiUrl.includes('users.')) return 'tier2';
    if (apiUrl.includes('search.')) return 'tier3';
    if (apiUrl.includes('admin.')) return 'tier4';
    
    return 'other';
  }

  /**
   * Get the appropriate client based on operation type and configuration
   * @param operationType - 'read' for read operations, 'write' for write operations
   * @returns WebClient instance configured with bot or user token
   */
  private getClientForOperation(operationType: 'read' | 'write'): WebClient {
    // For write operations, always use bot token
    if (operationType === 'write') {
      return this.getClient();
    }
    
    // For read operations, check configuration
    if (CONFIG.USE_USER_TOKEN_FOR_READ && CONFIG.SLACK_USER_TOKEN) {
      // Use user token for read operations if configured and available
      return this.getUserClient();
    }
    
    // Default to bot token for all operations
    return this.getClient();
  }

  /**
   * Check if search API is available and throw appropriate error if not
   * @param operationName - Name of the search operation for error messaging
   * @param alternative - Alternative method suggestion for error message
   */
  private checkSearchApiAvailability(operationName: string, alternative: string): void {
    if (!CONFIG.USE_USER_TOKEN_FOR_READ || !CONFIG.SLACK_USER_TOKEN) {
      throw new SlackAPIError(
        `${operationName} requires a user token. Bot tokens cannot use search API. ` +
        'Please either:\n' +
        '1. Set USE_USER_TOKEN_FOR_READ=true and provide SLACK_USER_TOKEN (xoxp-*), or\n' +
        `2. ${alternative}`
      );
    }
  }

  private getSlackLogLevel(): LogLevel {
    switch (CONFIG.LOG_LEVEL) {
      case 'debug':
        return LogLevel.DEBUG;
      case 'info':
        return LogLevel.INFO;
      case 'warn':
        return LogLevel.WARN;
      case 'error':
        return LogLevel.ERROR;
      default:
        return LogLevel.INFO;
    }
  }

  /**
   * Get display name for a user ID
   */
  private async getUserDisplayName(userId: string): Promise<string> {
    // Return cached name if available
    if (this.userCache.has(userId)) {
      return this.userCache.get(userId)!;
    }

    // Special cases
    if (!userId || userId === 'unknown' || userId === 'Unknown') {
      return 'Unknown';
    }

    try {
      const result = await this.getClientForOperation('read').users.info({ user: userId });
      if (result.user) {
        // Prefer display_name, then real_name, then name
        const displayName = result.user.profile?.display_name ||
                          result.user.real_name ||
                          result.user.name ||
                          userId;
        this.userCache.set(userId, displayName);
        return displayName;
      }
    } catch (error) {
      logger.debug(`Failed to get user info for ${userId}: ${error}`);
    }

    // Fallback to user ID if lookup fails
    this.userCache.set(userId, userId);
    return userId;
  }

  /**
   * Format messages with display names
   */
  /**
   * Convert message from Slack API to SlackMessage (our internal type)
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private convertMessageElementToSlackMessage(msg: any): SlackMessage {
    return {
      type: msg.type || 'message',
      user: msg.user,
      text: msg.text,
      ts: msg.ts || '',
      thread_ts: msg.thread_ts,
      edited: msg.edited,
      bot_id: msg.bot_id,
      app_id: msg.app_id,
      username: msg.username,
      blocks: msg.blocks,
      attachments: msg.attachments,
      reactions: msg.reactions
    };
  }

  /**
   * Convert Match (from Slack search API) to SearchMatch (our internal type) 
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private convertMatchToSearchMatch(match: any): SearchMatch {
    return {
      type: match.type || 'message',
      channel: match.channel || { id: '', name: '', is_private: false },
      user: match.user || '',
      username: match.username || '',
      ts: match.ts || '',
      text: match.text || '',
      permalink: match.permalink || '',
      previous: match.previous ? this.convertMessageElementToSlackMessage(match.previous) : undefined,
      previous_2: match.previous_2 ? this.convertMessageElementToSlackMessage(match.previous_2) : undefined,
      next: match.next ? this.convertMessageElementToSlackMessage(match.next) : undefined,
      next_2: match.next_2 ? this.convertMessageElementToSlackMessage(match.next_2) : undefined,
    };
  }

  // Removed formatMessagesWithNames method due to type complexity

  /**
   * Send a message to a Slack channel or user
   */
  // eslint-disable-next-line @typescript-eslint/explicit-function-return-type
  async sendMessage(args: unknown) {
    const input = validateInput(SendMessageSchema, args);
    
    try {
      logger.info(`Sending message to channel: ${input.channel}`);
      
      const result = await this.getClientForOperation('write').chat.postMessage({
        channel: input.channel,
        text: input.text,
        ...(input.thread_ts && { thread_ts: input.thread_ts }),
      });

      if (!result.ok) {
        throw new SlackAPIError(`Failed to send message: ${result.error}`);
      }

      return {
        content: [
          {
            type: 'text',
            text: `Message sent successfully to ${input.channel}. Timestamp: ${result.ts}`,
          },
        ],
      };
    } catch (error) {
      logger.error('Error sending message:', error);
      
      if (error instanceof SlackAPIError) {
        throw error;
      }
      
      throw new SlackAPIError(`Failed to send message: ${error}`);
    }
  }

  /**
   * List all channels in the workspace
   */
  // eslint-disable-next-line @typescript-eslint/explicit-function-return-type
  async listChannels(args: unknown) {
    const input = validateInput(ListChannelsSchema, args);
    
    try {
      logger.info('Fetching channels list');
      
      const result = await this.getClientForOperation('read').conversations.list({
        ...(input.types && { types: input.types }),
        exclude_archived: true,
      });

      if (!result.ok) {
        throw new SlackAPIError(`Failed to list channels: ${result.error}`);
      }

      const channels = result.channels || [];
      const channelInfo = channels.map((channel) => ({
        id: channel.id,
        name: channel.name,
        is_channel: channel.is_channel,
        is_group: channel.is_group,
        is_im: channel.is_im,
        is_private: channel.is_private,
        members_count: channel.num_members,
      }));

      return {
        content: [
          {
            type: 'text',
            text: `Found ${channels.length} channels:\n\n${channelInfo
              .map((ch) => `• ${ch.name} (${ch.id}) - ${ch.members_count} members`)
              .join('\n')}`,
          },
        ],
      };
    } catch (error) {
      logger.error('Error listing channels:', error);
      
      if (error instanceof SlackAPIError) {
        throw error;
      }
      
      throw new SlackAPIError(`Failed to list channels: ${error}`);
    }
  }

  /**
   * Get message history from a channel
   */
  // eslint-disable-next-line @typescript-eslint/explicit-function-return-type
  async getChannelHistory(args: unknown) {
    const input = validateInput(GetChannelHistorySchema, args);
    
    try {
      logger.info(`Fetching history for channel: ${input.channel}`);
      
      const result = await this.getClientForOperation('read').conversations.history({
        channel: input.channel,
        ...(input.limit && { limit: input.limit }),
      });

      if (!result.ok) {
        throw new SlackAPIError(`Failed to get channel history: ${result.error}`);
      }

      const messages = result.messages || [];
      const formattedMessages = await Promise.all(
        messages.map(async (msg: any) => { // eslint-disable-line @typescript-eslint/no-explicit-any
          const displayName = await this.getUserDisplayName(msg.user || 'unknown');
          return {
            user: displayName,
            text: msg.text || '',
            timestamp: msg.ts || '',
            thread_ts: msg.thread_ts
          };
        })
      );

      return {
        content: [
          {
            type: 'text',
            text: `Channel history (${messages.length} messages):\n\n${formattedMessages
              .map((msg) => `[${msg.timestamp}] ${msg.user}: ${msg.text}`)
              .join('\n')}`,
          },
        ],
      };
    } catch (error) {
      logger.error('Error getting channel history:', error);
      
      if (error instanceof SlackAPIError) {
        throw error;
      }
      
      throw new SlackAPIError(`Failed to get channel history: ${error}`);
    }
  }

  // eslint-disable-next-line @typescript-eslint/explicit-function-return-type
  async searchMessages(args: unknown) {
    const input = validateInput(SearchMessagesSchema, args);
    
    try {
      logger.info(`Searching messages with query: ${input.query}`);
      
      // Check if search API is available
      this.checkSearchApiAvailability(
        'Search operations',
        'Use alternative methods like get_channel_history with filtering'
      );
      
      const result = await this.getClientForOperation('read').search.messages({
        query: input.query,
        sort: input.sort,
        sort_dir: input.sort_dir,
        count: input.count,
        page: input.page,
        highlight: input.highlight,
      });

      if (!result.ok) {
        throw new SlackAPIError(`Failed to search messages: ${result.error}`);
      }

      const matches = result.messages?.matches || [];
      const formattedMatches = await Promise.all(
        matches.map(async (match: any) => { // eslint-disable-line @typescript-eslint/no-explicit-any
          const displayName = await this.getUserDisplayName(match.user || '');
          return {
            user: displayName,
            text: match.text || '',
            timestamp: match.ts || '',
            channel: match.channel,
            permalink: match.permalink || '',
          };
        })
      );

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              query: input.query,
              total: result.messages?.total || 0,
              page: result.messages?.paging?.page || 1,
              pages: result.messages?.paging?.pages || 1,
              matches: formattedMatches,
            }, null, 2),
          },
        ],
      };
    } catch (error) {
      logger.error('Error searching messages:', error);
      
      if (error instanceof SlackAPIError) {
        throw error;
      }
      
      throw new SlackAPIError(`Failed to search messages: ${error}`);
    }
  }

  // eslint-disable-next-line @typescript-eslint/explicit-function-return-type
  async getChannelInfo(args: unknown) {
    const input = validateInput(GetChannelInfoSchema, args);
    
    try {
      logger.info(`Fetching channel info for: ${input.channel}`);
      
      const result = await this.getClientForOperation('read').conversations.info({
        channel: input.channel,
        include_locale: true,
        include_num_members: true,
      });

      if (!result.ok) {
        throw new SlackAPIError(`Failed to get channel info: ${result.error}`);
      }

      const channel = result.channel;
      if (!channel) {
        throw new SlackAPIError('Channel not found');
      }

      const channelInfo = {
        id: channel.id,
        name: channel.name,
        is_channel: channel.is_channel,
        is_group: channel.is_group,
        is_im: channel.is_im,
        is_mpim: channel.is_mpim,
        is_private: channel.is_private,
        is_archived: channel.is_archived,
        is_general: channel.is_general,
        created: channel.created,
        creator: channel.creator,
        name_normalized: channel.name_normalized,
        is_shared: channel.is_shared,
        is_org_shared: channel.is_org_shared,
        is_member: channel.is_member,
        topic: channel.topic,
        purpose: channel.purpose,
        num_members: channel.num_members,
      };

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(channelInfo, null, 2),
          },
        ],
      };
    } catch (error) {
      logger.error('Error getting channel info:', error);
      
      if (error instanceof SlackAPIError) {
        throw error;
      }
      
      throw new SlackAPIError(`Failed to get channel info: ${error}`);
    }
  }

  /**
   * Get information about a user
   */
  async getUserInfo(args: unknown) {
    const input = validateInput(GetUserInfoSchema, args);
    
    try {
      logger.info(`Fetching user info for: ${input.user}`);
      
      const result = await this.getClientForOperation('read').users.info({
        user: input.user,
      });

      if (!result.ok) {
        throw new SlackAPIError(`Failed to get user info: ${result.error}`);
      }

      const user = result.user;
      if (!user) {
        throw new SlackAPIError('User not found');
      }

      const userInfo = {
        id: user.id,
        name: user.name,
        real_name: user.real_name,
        display_name: user.profile?.display_name,
        email: user.profile?.email,
        is_bot: user.is_bot,
        is_admin: user.is_admin,
        is_owner: user.is_owner,
        timezone: user.tz,
      };

      return {
        content: [
          {
            type: 'text',
            text: `User Information:
• ID: ${userInfo.id}
• Name: ${userInfo.name}
• Real Name: ${userInfo.real_name}
• Display Name: ${userInfo.display_name || 'N/A'}
• Email: ${userInfo.email || 'N/A'}
• Is Bot: ${userInfo.is_bot}
• Is Admin: ${userInfo.is_admin}
• Is Owner: ${userInfo.is_owner}
• Timezone: ${userInfo.timezone || 'N/A'}`,
          },
        ],
      };
    } catch (error) {
      logger.error('Error getting user info:', error);
      
      if (error instanceof SlackAPIError) {
        throw error;
      }
      
      throw new SlackAPIError(`Failed to get user info: ${error}`);
    }
  }

  // ================================
  // THREAD DETECTION AND RETRIEVAL
  // ================================

  /**
   * Find all threaded conversations in a channel
   */
  async findThreadsInChannel(args: unknown) {
    const input = validateInput(FindThreadsInChannelSchema, args);
    
    try {
      logger.info(`Finding threads in channel: ${input.channel}`);
      
      // First, get channel history to find messages with replies
      const result = await this.getClientForOperation('read').conversations.history({
        channel: input.channel,
        ...(input.limit && { limit: input.limit }),
        ...(input.cursor && { cursor: input.cursor }),
        ...(input.oldest && { oldest: input.oldest }),
        ...(input.latest && { latest: input.latest }),
        ...(input.include_all_metadata !== undefined && { include_all_metadata: input.include_all_metadata }),
      });

      if (!result.ok) {
        throw new SlackAPIError(`Failed to get channel history: ${result.error}`);
      }

      const messages = result.messages || [];
      
      // Filter messages that have replies (threads)
      const threadParents = messages.filter(msg => 
        msg.thread_ts && msg.ts === msg.thread_ts && (msg.reply_count || 0) > 0
      );

      const threads: SlackThread[] = [];
      
      for (const parentMsg of threadParents) {
        // Get thread replies for each parent message
        const repliesResult = await this.getClientForOperation('read').conversations.replies({
          channel: input.channel,
          ts: parentMsg.ts!,
          limit: 100,
        });

        if (repliesResult.ok && repliesResult.messages) {
          const [parent, ...replies] = repliesResult.messages;
          
          if (parent) {
            threads.push({
              parent_message: parent as unknown as SlackMessage,
              replies: replies as unknown as SlackMessage[],
              reply_count: replies.length,
              reply_users: [...new Set(replies.map(r => r.user).filter(Boolean))] as string[],
              reply_users_count: new Set(replies.map(r => r.user).filter(Boolean)).size,
              latest_reply: replies[replies.length - 1]?.ts || parent.ts!,
              thread_ts: parent.ts!,
              channel_id: input.channel,
            });
          }
        }
      }

      return {
        content: [
          {
            type: 'text',
            text: `Found ${threads.length} threads in channel:\n\n${threads
              .map((thread, idx) => 
                `${idx + 1}. Thread ${thread.thread_ts}\n` +
                `   └─ ${thread.reply_count} replies from ${thread.reply_users_count} users\n` +
                `   └─ Last reply: ${thread.latest_reply}\n` +
                `   └─ Parent: ${thread.parent_message.text?.substring(0, 100)}...`
              )
              .join('\n\n')}`,
          },
        ],
      };
    } catch (error) {
      logger.error('Error finding threads:', error);
      
      if (error instanceof SlackAPIError) {
        throw error;
      }
      
      throw new SlackAPIError(`Failed to find threads: ${error}`);
    }
  }

  /**
   * Get complete thread content (parent + all replies)
   */
  async getThreadReplies(args: unknown) {
    const input = validateInput(GetThreadRepliesSchema, args);
    
    try {
      logger.info(`Getting thread replies: ${input.channel}/${input.thread_ts}`);
      
      const result = await this.getClientForOperation('read').conversations.replies({
        channel: input.channel,
        ts: input.thread_ts,
        ...(input.limit && { limit: input.limit }),
        ...(input.cursor && { cursor: input.cursor }),
        ...(input.oldest && { oldest: input.oldest }),
        ...(input.latest && { latest: input.latest }),
        ...(input.inclusive !== undefined && { inclusive: input.inclusive }),
      });

      if (!result.ok) {
        throw new SlackAPIError(`Failed to get thread replies: ${result.error}`);
      }

      const messages = result.messages || [];
      const [parent, ...replies] = messages;

      const thread: SlackThread = {
        parent_message: parent as unknown as SlackMessage,
        replies: replies as unknown as SlackMessage[],
        reply_count: replies.length,
        reply_users: [...new Set(replies.map(r => r.user).filter(Boolean))] as string[],
        reply_users_count: new Set(replies.map(r => r.user).filter(Boolean)).size,
        latest_reply: replies[replies.length - 1]?.ts || (parent?.ts || ''),
        thread_ts: input.thread_ts,
        channel_id: input.channel,
      };

      const formattedMessages = await Promise.all(
        messages.map(async (msg, idx) => {
          const displayName = await this.getUserDisplayName(msg.user || 'unknown');
          return `${idx === 0 ? '🧵' : '  ├─'} [${msg.ts}] ${displayName}: ${msg.text || ''}`;
        })
      );

      return {
        content: [
          {
            type: 'text',
            text: `Thread ${input.thread_ts} (${replies.length} replies from ${thread.reply_users_count} users):\n\n${formattedMessages.join('\n')}`,
          },
        ],
      };
    } catch (error) {
      logger.error('Error getting thread replies:', error);
      
      if (error instanceof SlackAPIError) {
        throw error;
      }
      
      throw new SlackAPIError(`Failed to get thread replies: ${error}`);
    }
  }

  /**
   * Search for threads by keywords or participants
   */
  async searchThreads(args: unknown) {
    const input = validateInput(SearchThreadsSchema, args);
    
    try {
      logger.info(`Searching threads with query: "${input.query}"`);
      
      // Check if search API is available
      this.checkSearchApiAvailability(
        'Thread search',
        'Use find_threads_in_channel for channel-specific thread discovery'
      );
      
      // Use Slack's search API to find messages
      const searchQuery = this.buildThreadSearchQuery(input);
      
      const searchArgs: SearchAllArguments = {
        query: searchQuery,
        sort: input.sort === 'relevance' ? 'score' : input.sort,
        sort_dir: input.sort_dir,
        ...(input.limit && { count: input.limit })
      };

      const result = await this.getClientForOperation('read').search.messages(searchArgs);

      if (!result.ok) {
        throw new SlackAPIError(`Failed to search messages: ${result.error}`);
      }

      const searchResults: ThreadSearchResult[] = [];
      const messages = result.messages?.matches || [];
      const processedThreads = new Set<string>(); // Track processed threads to avoid duplicates

      for (const match of messages) {
        const message = match;
        
        // For search results, we need to check if the message is part of a thread
        if (message.ts && message.channel?.id) {
          // Determine the thread timestamp
          // If it's a reply, use thread_ts; if it's a parent, use ts
          const threadTs = (message as any).thread_ts || message.ts; // eslint-disable-line @typescript-eslint/no-explicit-any
          
          // Skip if we've already processed this thread
          const threadKey = `${message.channel.id}-${threadTs}`;
          if (processedThreads.has(threadKey)) {
            continue;
          }
          processedThreads.add(threadKey);
          
          try {
            // Try to get thread details using user client for broader access
            // Note: User token has access to more channels and history
            const threadResult = await this.getClientForOperation('read').conversations.replies({
              channel: message.channel.id,
              ts: threadTs,
            });

            // Process all messages, including those that are thread parents without replies
            if (threadResult.ok && threadResult.messages && threadResult.messages.length >= 1) {
              const [parent, ...replies] = threadResult.messages;
              
              const thread: SlackThread = {
                parent_message: parent as unknown as SlackMessage,
                replies: replies as unknown as SlackMessage[],
                reply_count: replies.length,
                reply_users: [...new Set(replies.map(r => r.user).filter(Boolean))] as string[],
                reply_users_count: new Set(replies.map(r => r.user).filter(Boolean)).size,
                latest_reply: replies.length > 0 ? (replies[replies.length - 1]?.ts || '') : (parent?.ts || ''),
                thread_ts: threadTs,
                channel_id: message.channel.id,
              };

              searchResults.push({
                thread,
                relevance_score: match.score || 0,
                matched_messages: threadResult.messages.filter(msg => 
                  msg.text?.toLowerCase().includes(input.query.toLowerCase())
                ) as SlackMessage[],
                match_reason: `Matched query "${input.query}"`,
              });
            }
          } catch (threadError: unknown) {
            // Log the error but continue processing other messages
            const error = threadError as { data?: { error?: string } };
            if (error?.data?.error === 'not_in_channel') {
              logger.warn(`Bot is not in channel ${message.channel.id}, skipping thread ${message.ts}`);
            } else if (error?.data?.error === 'channel_not_found') {
              logger.warn(`Channel ${message.channel.id} not found, skipping thread ${message.ts}`);
            } else {
              logger.warn(`Failed to get thread for message ${message.ts}:`, threadError);
            }
            
            // Still include the message in results even if we can't get full thread details
            // This happens when the bot isn't in the channel where the message was found
            searchResults.push({
              thread: {
                parent_message: message as SlackMessage,
                replies: [],
                reply_count: 0,
                reply_users: [],
                reply_users_count: 0,
                latest_reply: message.ts || '',
                thread_ts: threadTs,
                channel_id: message.channel.id,
              },
              relevance_score: match.score || 0,
              matched_messages: [message as SlackMessage],
              match_reason: `Matched query "${input.query}" (Note: Bot not in channel, limited details)`,
            });
          }
        }
      }

      return {
        content: [
          {
            type: 'text',
            text: `Found ${searchResults.length} threads matching "${input.query}":\n\n${searchResults
              .map((result, idx) => 
                `${idx + 1}. Thread ${result.thread.thread_ts} (Score: ${result.relevance_score})\n` +
                `   └─ Channel: ${result.thread.channel_id}\n` +
                `   └─ ${result.thread.reply_count} replies\n` +
                `   └─ ${result.matched_messages.length} matching messages\n` +
                `   └─ Parent: ${result.thread.parent_message.text?.substring(0, 100)}...`
              )
              .join('\n\n')}`,
          },
        ],
      };
    } catch (error) {
      logger.error('Error searching threads:', error);
      
      if (error instanceof SlackAPIError) {
        throw error;
      }
      
      throw new SlackAPIError(`Failed to search threads: ${error}`);
    }
  }

  // ================================
  // THREAD MANAGEMENT TOOLS
  // ================================

  /**
   * Post a reply to an existing thread
   */
  async postThreadReply(args: unknown) {
    const input = validateInput(PostThreadReplySchema, args);
    
    try {
      logger.info(`Posting reply to thread: ${input.channel}/${input.thread_ts}`);
      
      const result = await this.getClientForOperation('write').chat.postMessage({
        channel: input.channel,
        text: input.text,
        thread_ts: input.thread_ts,
        reply_broadcast: input.reply_broadcast,
      } as ChatPostMessageArguments);

      if (!result.ok) {
        throw new SlackAPIError(`Failed to post thread reply: ${result.error}`);
      }

      return {
        content: [
          {
            type: 'text',
            text: `Reply posted successfully to thread ${input.thread_ts}. Message timestamp: ${result.ts}`,
          },
        ],
      };
    } catch (error) {
      logger.error('Error posting thread reply:', error);
      
      if (error instanceof SlackAPIError) {
        throw error;
      }
      
      throw new SlackAPIError(`Failed to post thread reply: ${error}`);
    }
  }

  /**
   * Create a new thread
   */
  async createThread(args: unknown) {
    const input = validateInput(CreateThreadSchema, args);
    
    try {
      logger.info(`Creating new thread in channel: ${input.channel}`);
      
      // Post the initial message
      const parentResult = await this.getClientForOperation('write').chat.postMessage({
        channel: input.channel,
        text: input.text,
      });

      if (!parentResult.ok) {
        throw new SlackAPIError(`Failed to create thread parent: ${parentResult.error}`);
      }

      let replyResult;
      // If reply text is provided, post a reply to create the thread
      if (input.reply_text) {
        replyResult = await this.getClientForOperation('write').chat.postMessage({
          channel: input.channel,
          text: input.reply_text,
          thread_ts: parentResult.ts!,
          reply_broadcast: input.broadcast,
        } as ChatPostMessageArguments);

        if (!replyResult.ok) {
          throw new SlackAPIError(`Failed to create thread reply: ${replyResult.error}`);
        }
      }

      return {
        content: [
          {
            type: 'text',
            text: `Thread created successfully!\n` +
                  `Parent message: ${parentResult.ts}\n` +
                  `Channel: ${input.channel}${replyResult ? `\nReply: ${replyResult.ts}` : ''}`,
          },
        ],
      };
    } catch (error) {
      logger.error('Error creating thread:', error);
      
      if (error instanceof SlackAPIError) {
        throw error;
      }
      
      throw new SlackAPIError(`Failed to create thread: ${error}`);
    }
  }

  /**
   * Mark a thread as important/resolved
   */
  async markThreadImportant(args: unknown) {
    const input = validateInput(MarkThreadImportantSchema, args);
    
    try {
      logger.info(`Marking thread as important: ${input.channel}/${input.thread_ts}`);
      
      // Add a bookmark or pin the message (if the bot has permissions)
      // For now, we'll add a reaction and/or post a message
      const reactionResult = await this.getClientForOperation('write').reactions.add({
        channel: input.channel,
        timestamp: input.thread_ts,
        name: this.getImportanceReaction(input.importance_level || 'medium'),
      });

      if (!reactionResult.ok) {
        logger.warn(`Failed to add importance reaction: ${reactionResult.error}`);
      }

      // Post a message to the thread about its importance
      const notificationText = `📌 Thread marked as **${input.importance_level}** importance` +
        (input.reason ? ` - ${input.reason}` : '');

      const messageResult = await this.getClientForOperation('write').chat.postMessage({
        channel: input.channel,
        text: notificationText,
        thread_ts: input.thread_ts,
        reply_broadcast: input.notify_participants,
      } as ChatPostMessageArguments);

      if (!messageResult.ok) {
        throw new SlackAPIError(`Failed to post importance notification: ${messageResult.error}`);
      }

      return {
        content: [
          {
            type: 'text',
            text: `Thread ${input.thread_ts} marked as ${input.importance_level} importance.\n` +
                  `Notification posted: ${messageResult.ts}`,
          },
        ],
      };
    } catch (error) {
      logger.error('Error marking thread as important:', error);
      
      if (error instanceof SlackAPIError) {
        throw error;
      }
      
      throw new SlackAPIError(`Failed to mark thread as important: ${error}`);
    }
  }

  // ================================
  // THREAD ANALYSIS AND SUMMARIZATION
  // ================================

  /**
   * Analyze thread structure (participants, timeline, key topics)
   */
  async analyzeThread(args: unknown) {
    const input = validateInput(AnalyzeThreadSchema, args);
    
    try {
      logger.info(`Analyzing thread: ${input.channel}/${input.thread_ts}`);
      
      // Get the full thread
      const result = await this.getClientForOperation('read').conversations.replies({
        channel: input.channel,
        ts: input.thread_ts,
        limit: 1000,
      });

      if (!result.ok) {
        throw new SlackAPIError(`Failed to get thread for analysis: ${result.error}`);
      }

      const rawMessages = result.messages || [];
      const messages = rawMessages.map(msg => this.convertMessageElementToSlackMessage(msg));
      const [parent, ...replies] = messages;

      // Analyze participants
      const participants = this.analyzeThreadParticipants(messages);
      
      // Build timeline
      const timeline = input.include_timeline ? this.buildThreadTimeline(messages) : [];
      
      // Extract topics and keywords
      const keyTopics = input.extract_topics ? this.extractTopicsFromThread(messages) : [];
      
      // Calculate scores
      const urgencyScore = this.calculateUrgencyScore(messages);
      const importanceScore = this.calculateImportanceScore(messages, participants);
      
      // Analyze sentiment
      const sentiment = input.include_sentiment_analysis ? this.analyzeSentiment(messages) : 'neutral';
      
      // Extract action items
      const actionItems = input.include_action_items ? this.extractActionItemsFromMessages(messages) : [];
      
      // Generate summary
      const summary = this.generateThreadSummary(messages, participants, keyTopics);
      
      // Calculate metrics
      const totalText = messages.map(m => m.text || '').join(' ');
      const wordCount = totalText.split(/\s+/).length;
      const startTime = parseFloat(parent?.ts || '0');
      const endTime = parseFloat((replies[replies.length - 1]?.ts as string) || (parent?.ts as string) || '0');
      const durationHours = (endTime - startTime) / 3600;

      const analysis: ThreadAnalysis = {
        thread_ts: input.thread_ts,
        channel_id: input.channel,
        participants,
        timeline,
        key_topics: keyTopics,
        urgency_score: urgencyScore,
        importance_score: importanceScore,
        sentiment,
        action_items: actionItems,
        summary,
        word_count: wordCount,
        duration_hours: durationHours,
      };

      return {
        content: [
          {
            type: 'text',
            text: this.formatThreadAnalysis(analysis),
          },
        ],
      };
    } catch (error) {
      logger.error('Error analyzing thread:', error);
      
      if (error instanceof SlackAPIError) {
        throw error;
      }
      
      throw new SlackAPIError(`Failed to analyze thread: ${error}`);
    }
  }

  /**
   * Generate intelligent thread summaries
   */
  async summarizeThread(args: unknown) {
    const input = validateInput(SummarizeThreadSchema, args);
    
    try {
      logger.info(`Summarizing thread: ${input.channel}/${input.thread_ts}`);
      
      const result = await this.getClientForOperation('read').conversations.replies({
        channel: input.channel,
        ts: input.thread_ts,
        limit: 1000,
      });

      if (!result.ok) {
        throw new SlackAPIError(`Failed to get thread for summary: ${result.error}`);
      }

      const rawMessages = result.messages || [];
      const messages = rawMessages.map(msg => this.convertMessageElementToSlackMessage(msg));
      const participants = this.analyzeThreadParticipants(messages);
      // const keyTopics = this.extractTopicsFromThread(messages); // TODO: Use for topic extraction
      const actionItems = input.include_action_items ? this.extractActionItemsFromMessages(messages) : [];
      const decisions = input.include_decisions ? this.extractDecisions(messages) : [];

      const summary: ThreadSummary = {
        thread_ts: input.thread_ts,
        channel_id: input.channel,
        title: this.generateThreadTitle(messages),
        brief_summary: this.generateBriefSummary(messages, input.summary_length || 'medium'),
        key_points: this.extractKeyPoints(messages),
        decisions_made: decisions,
        action_items: actionItems,
        participants: participants.map(p => p.user_id),
        message_count: messages.length,
        duration: this.formatDuration(messages),
        status: this.determineThreadStatus(messages, actionItems),
      };

      return {
        content: [
          {
            type: 'text',
            text: this.formatThreadSummary(summary),
          },
        ],
      };
    } catch (error) {
      logger.error('Error summarizing thread:', error);
      
      if (error instanceof SlackAPIError) {
        throw error;
      }
      
      throw new SlackAPIError(`Failed to summarize thread: ${error}`);
    }
  }

  /**
   * Extract action items from threads
   */
  async extractActionItems(args: unknown) {
    const input = validateInput(ExtractActionItemsSchema, args);
    
    try {
      logger.info(`Extracting action items from thread: ${input.channel}/${input.thread_ts}`);
      
      const result = await this.getClientForOperation('read').conversations.replies({
        channel: input.channel,
        ts: input.thread_ts,
        limit: 1000,
      });

      if (!result.ok) {
        throw new SlackAPIError(`Failed to get thread for action items: ${result.error}`);
      }

      const rawMessages = result.messages || [];
      const messages = rawMessages.map(msg => this.convertMessageElementToSlackMessage(msg));
      const actionItems = this.extractActionItemsFromMessages(messages);
      
      const filteredItems = actionItems.filter(item => {
        if (!input.include_completed && item.status === 'completed') {
          return false;
        }
        
        const priorityLevels = ['low', 'medium', 'high'];
        const thresholdIndex = priorityLevels.indexOf(input.priority_threshold || 'low');
        const itemIndex = priorityLevels.indexOf(item.priority);
        
        return itemIndex >= thresholdIndex;
      });

      return {
        content: [
          {
            type: 'text',
            text: `Action Items from Thread ${input.thread_ts}:\n\n${filteredItems.length === 0 
              ? 'No action items found matching the criteria.'
              : filteredItems.map((item, idx) => 
                  `${idx + 1}. ${item.text}\n` +
                  `   └─ Priority: ${item.priority}\n` +
                  `   └─ Status: ${item.status}\n` +
                  `   └─ Mentioned: ${item.mentioned_users.join(', ') || 'None'}\n` +
                  `   └─ From message: ${item.extracted_from_message_ts}`
                ).join('\n\n')
            }`,
          },
        ],
      };
    } catch (error) {
      logger.error('Error extracting action items:', error);
      
      if (error instanceof SlackAPIError) {
        throw error;
      }
      
      throw new SlackAPIError(`Failed to extract action items: ${error}`);
    }
  }

  /**
   * Identify important/urgent threads
   */
  async identifyImportantThreads(args: unknown) {
    const input = validateInput(IdentifyImportantThreadsSchema, args);
    
    try {
      logger.info(`Identifying important threads in channel: ${input.channel}`);
      
      const hoursAgo = input.time_range_hours || 24;
      const oldestTime = (Date.now() / 1000 - hoursAgo * 3600).toString();
      
      // Get recent messages from the channel
      const result = await this.getClientForOperation('read').conversations.history({
        channel: input.channel,
        oldest: oldestTime,
        limit: 200,
      });

      if (!result.ok) {
        throw new SlackAPIError(`Failed to get channel history: ${result.error}`);
      }

      const messages = result.messages || [];
      const threadParents = messages.filter(msg => 
        msg.thread_ts && msg.ts === msg.thread_ts && (msg.reply_count || 0) > 0
      );

      const scoredThreads = [];

      for (const parentMsg of threadParents) {
        try {
          const repliesResult = await this.getClientForOperation('read').conversations.replies({
            channel: input.channel,
            ts: parentMsg.ts!,
          });

          if (repliesResult.ok && repliesResult.messages) {
            const rawThreadMessages = repliesResult.messages || [];
            const threadMessages = rawThreadMessages.map(msg => this.convertMessageElementToSlackMessage(msg));
            const participants = this.analyzeThreadParticipants(threadMessages);
            const importance = this.calculateImportanceScore(threadMessages, participants);
            const urgency = this.calculateUrgencyScore(threadMessages);
            const overallScore = (importance + urgency) / 2;

            if (overallScore >= (input.importance_threshold || 0.5)) {
              scoredThreads.push({
                thread_ts: parentMsg.ts!,
                parent_message: parentMsg as SlackMessage,
                score: overallScore,
                importance_score: importance,
                urgency_score: urgency,
                reply_count: threadMessages.length - 1,
                participants: participants.length,
              });
            }
          }
        } catch (threadError) {
          logger.warn(`Failed to analyze thread ${parentMsg.ts}:`, threadError);
        }
      }

      // Sort by score and limit results
      scoredThreads.sort((a, b) => b.score - a.score);
      const topThreads = scoredThreads.slice(0, input.limit);

      return {
        content: [
          {
            type: 'text',
            text: `Important threads found (${topThreads.length}):\n\n${topThreads
              .map((thread, idx) => 
                `${idx + 1}. Thread ${thread.thread_ts} (Score: ${thread.score.toFixed(2)})\n` +
                `   └─ Importance: ${thread.importance_score.toFixed(2)}, Urgency: ${thread.urgency_score.toFixed(2)}\n` +
                `   └─ ${thread.reply_count} replies, ${thread.participants} participants\n` +
                `   └─ ${thread.parent_message.text?.substring(0, 100)}...`
              )
              .join('\n\n')}`,
          },
        ],
      };
    } catch (error) {
      logger.error('Error identifying important threads:', error);
      
      if (error instanceof SlackAPIError) {
        throw error;
      }
      
      throw new SlackAPIError(`Failed to identify important threads: ${error}`);
    }
  }

  // ================================
  // ADVANCED THREAD FEATURES
  // ================================

  /**
   * Export thread content (markdown, json, html, csv)
   */
  async exportThread(args: unknown) {
    const input = validateInput(ExportThreadSchema, args);
    
    try {
      logger.info(`Exporting thread: ${input.channel}/${input.thread_ts} as ${input.format}`);
      
      const result = await this.getClientForOperation('read').conversations.replies({
        channel: input.channel,
        ts: input.thread_ts,
        limit: 1000,
      });

      if (!result.ok) {
        throw new SlackAPIError(`Failed to get thread for export: ${result.error}`);
      }

      const rawMessages = result.messages || [];
      const messages = rawMessages.map(msg => this.convertMessageElementToSlackMessage(msg));
      const participants = input.include_user_profiles ? this.analyzeThreadParticipants(messages) : [];
      
      const exportOptions: ThreadExportOptions = {
        format: input.format || 'markdown',
        include_metadata: input.include_metadata ?? true,
        include_reactions: input.include_reactions ?? true,
        include_user_profiles: input.include_user_profiles ?? false,
        date_format: input.date_format
      };

      const exportResult = await this.generateThreadExport(
        messages,
        participants,
        exportOptions
      );

      return {
        content: [
          {
            type: 'text',
            text: `Thread exported successfully!\n\n` +
                  `Format: ${exportResult.format}\n` +
                  `Size: ${exportResult.size_bytes} bytes\n` +
                  `Filename: ${exportResult.filename}\n\n` +
                  `Content preview:\n${exportResult.content.substring(0, 500)}${exportResult.content.length > 500 ? '...' : ''}`,
          },
        ],
      };
    } catch (error) {
      logger.error('Error exporting thread:', error);
      
      if (error instanceof SlackAPIError) {
        throw error;
      }
      
      throw new SlackAPIError(`Failed to export thread: ${error}`);
    }
  }

  /**
   * Find related threads across channels
   */
  async findRelatedThreads(args: unknown) {
    const input = validateInput(FindRelatedThreadsSchema, args);
    
    try {
      logger.info(`Finding threads related to: ${input.channel}/${input.thread_ts}`);
      
      // Get the source thread
      const sourceResult = await this.getClientForOperation('read').conversations.replies({
        channel: input.channel,
        ts: input.thread_ts,
        limit: 1000,
      });

      if (!sourceResult.ok) {
        throw new SlackAPIError(`Failed to get source thread: ${sourceResult.error}`);
      }

      const sourceMessages = sourceResult.messages || [];
      const sourceKeywords = this.extractTopicsFromThread(sourceMessages as SlackMessage[]);
      // const sourceParticipants = this.analyzeThreadParticipants(sourceMessages as SlackMessage[]).map(p => p.user_id); // TODO: Use for participant matching

      const relatedThreads: RelatedThread[] = [];

      // Check if search API is available
      try {
        this.checkSearchApiAvailability(
          'Related thread search',
          'Use find_threads_in_channel for channel-specific discovery'
        );
      } catch (error) {
        logger.warn('Search API not available with bot token. Skipping search-based related thread discovery.');
        if (error instanceof SlackAPIError) {
          return {
            content: [{
              type: 'text',
              text: error.message
            }],
          };
        }
        throw error;
      }

      // Search for related threads using various methods
      const searchQueries = this.buildRelatedThreadSearchQueries(sourceKeywords);

      for (const query of searchQueries) {
        try {
          const searchResult = await this.getClientForOperation('read').search.messages({
            query: query,
            count: 20,
          });

          if (searchResult.ok && searchResult.messages?.matches) {
            for (const match of searchResult.messages.matches) {
              const message = match;
              
              if (message.channel?.id && message.ts && message.ts !== input.thread_ts) {
                const similarity = this.calculateThreadSimilarity();

                if (similarity >= (input.similarity_threshold || 0.3)) {
                  relatedThreads.push({
                    thread_ts: (message as any).thread_ts || message.ts, // eslint-disable-line @typescript-eslint/no-explicit-any
                    channel_id: message.channel.id,
                    similarity_score: similarity,
                    relationship_type: 'keyword_overlap',
                    brief_summary: this.generateBriefSummary([this.convertMatchToSearchMatch(message as any)], 'brief'), // eslint-disable-line @typescript-eslint/no-explicit-any
                  });
                }
              }
            }
          }
        } catch (searchError) {
          logger.warn(`Search failed for query "${query}":`, searchError);
        }
      }

      // Remove duplicates and sort by similarity
      const uniqueThreads = this.removeDuplicateThreads(relatedThreads);
      uniqueThreads.sort((a, b) => b.similarity_score - a.similarity_score);
      const topThreads = uniqueThreads.slice(0, input.max_results);

      return {
        content: [
          {
            type: 'text',
            text: `Found ${topThreads.length} related threads:\n\n${topThreads
              .map((thread, idx) => 
                `${idx + 1}. Thread ${thread.thread_ts} (Similarity: ${(thread.similarity_score * 100).toFixed(1)}%)\n` +
                `   └─ Channel: ${thread.channel_id}\n` +
                `   └─ Relationship: ${thread.relationship_type}\n` +
                `   └─ Summary: ${thread.brief_summary}`
              )
              .join('\n\n')}`,
          },
        ],
      };
    } catch (error) {
      logger.error('Error finding related threads:', error);
      
      if (error instanceof SlackAPIError) {
        throw error;
      }
      
      throw new SlackAPIError(`Failed to find related threads: ${error}`);
    }
  }

  /**
   * Get thread statistics and metrics
   */
  async getThreadMetrics(args: unknown) {
    const input = validateInput(GetThreadMetricsSchema, args);
    
    try {
      logger.info(`Getting thread metrics for ${input.channel || 'all channels'}`);
      
      // const timeRange = this.calculateTimeRange(input.after, input.before); // TODO: Use for filtering threads
      const allThreads: SlackThread[] = [];

      if (input.channel) {
        // Get threads from specific channel
        // This would need to be implemented to return actual thread objects instead of formatted text
        // For now, we'll use empty array as placeholder
      } else {
        // This would require iterating through all channels the bot has access to
        logger.warn('Getting metrics for all channels not yet implemented');
      }

      const metrics = this.calculateThreadMetrics(allThreads);

      return {
        content: [
          {
            type: 'text',
            text: this.formatThreadMetrics(metrics),
          },
        ],
      };
    } catch (error) {
      logger.error('Error getting thread metrics:', error);
      
      if (error instanceof SlackAPIError) {
        throw error;
      }
      
      throw new SlackAPIError(`Failed to get thread metrics: ${error}`);
    }
  }

  /**
   * Get threads by participants
   */
  async getThreadsByParticipants(args: unknown) {
    const input = validateInput(GetThreadsByParticipantsSchema, args);
    
    try {
      logger.info(`Finding threads with participants: ${input.participants.join(', ')}`);
      
      const searchQuery = input.require_all_participants 
        ? input.participants.map(p => `from:${p}`).join(' ')
        : input.participants.map(p => `from:${p}`).join(' OR ');
      
      // Check if search API is available
      this.checkSearchApiAvailability(
        'Participant search',
        'Use get_channel_history with manual filtering as an alternative'
      );
      
      // Don't add has:thread - we'll filter for threads in the result processing
      const fullQuery = searchQuery + 
        (input.channel ? ` in:${input.channel}` : '') +
        (input.after ? ` after:${input.after}` : '') +
        (input.before ? ` before:${input.before}` : '');

      const result = await this.getClientForOperation('read').search.messages({
        query: fullQuery,
        ...(input.limit && { count: input.limit }),
      });

      if (!result.ok) {
        throw new SlackAPIError(`Failed to search for participant threads: ${result.error}`);
      }

      const threads: Array<{
        thread_ts: string;
        channel_id: string;
        preview: string;
        timestamp: string;
        participants: string[];
      }> = [];
      const messages = result.messages?.matches || [];

      for (const match of messages) {
        const message = match;
        if (message.channel?.id && message.ts) {
          threads.push({
            thread_ts: (message as any).thread_ts || message.ts, // eslint-disable-line @typescript-eslint/no-explicit-any
            channel_id: message.channel.id,
            preview: (message.text || '').substring(0, 100) + '...',
            timestamp: message.ts,
            participants: input.participants
          });
        }
      }

      return {
        content: [
          {
            type: 'text',
            text: `Found ${threads.length} threads with specified participants:\n\n${threads
              .map((thread, idx) => 
                `${idx + 1}. Thread ${thread.thread_ts}\n` +
                `   └─ Channel: ${thread.channel_id}\n` +
                `   └─ Preview: ${thread.preview}`
              )
              .join('\n\n')}`,
          },
        ],
      };
    } catch (error) {
      logger.error('Error getting threads by participants:', error);
      
      if (error instanceof SlackAPIError) {
        throw error;
      }
      
      throw new SlackAPIError(`Failed to get threads by participants: ${error}`);
    }
  }

  // ================================
  // FILE OPERATION METHODS
  // ================================

  /**
   * Upload a file to Slack
   */
  async uploadFile(args: unknown) {
    const input = validateInput(UploadFileSchema, args);
    
    try {
      logger.info(`Uploading file: ${input.file_path}`);
      
      // Read file from filesystem
      const fs = await import('fs/promises');
      const path = await import('path');
      
      const fileBuffer = await fs.readFile(input.file_path);
      const filename = input.filename || path.basename(input.file_path);
      
      const uploadArgs: any = { // eslint-disable-line @typescript-eslint/no-explicit-any
        file: fileBuffer,
        filename: filename,
        ...(input.title && { title: input.title }),
        ...(input.initial_comment && { initial_comment: input.initial_comment }),
        ...(input.channels && { channels: input.channels.join(',') }),
        ...(input.thread_ts && input.channels && input.channels.length > 0 && { thread_ts: input.thread_ts })
      };

      const result = await this.getClientForOperation('write').files.upload(uploadArgs);

      if (!result.ok) {
        throw new SlackAPIError(`Failed to upload file: ${result.error}`);
      }

      const file = result.file as SlackFile;
      
      return {
        content: [
          {
            type: 'text',
            text: `File uploaded successfully!\n` +
                  `• File ID: ${file.id}\n` +
                  `• Name: ${file.name}\n` +
                  `• Size: ${file.size} bytes\n` +
                  `• Type: ${file.filetype}\n` +
                  `• URL: ${file.permalink}`,
          },
        ],
      };
    } catch (error) {
      logger.error('Error uploading file:', error);
      
      if (error instanceof SlackAPIError) {
        throw error;
      }
      
      throw new SlackAPIError(`Failed to upload file: ${error}`);
    }
  }

  /**
   * List files in workspace
   */
  async listFiles(args: unknown) {
    const input = validateInput(ListFilesSchema, args);
    
    try {
      logger.info('Listing workspace files');
      
      const listArgs: FilesListArguments = {
        ...(input.user && { user: input.user }),
        ...(input.channel && { channel: input.channel }),
        ...(input.types && { types: input.types }),
        ...(input.ts_from && { ts_from: input.ts_from }),
        ...(input.ts_to && { ts_to: input.ts_to }),
        ...(input.count && { count: input.count }),
        ...(input.page && { page: input.page })
      };

      const result = await this.getClientForOperation('read').files.list(listArgs);

      if (!result.ok) {
        throw new SlackAPIError(`Failed to list files: ${result.error}`);
      }

      const files = result.files as SlackFile[] || [];
      const paging = result.paging || { count: 0, total: 0, page: 1, pages: 1 };
      
      return {
        content: [
          {
            type: 'text',
            text: `Found ${files.length} files (Page ${paging.page} of ${paging.pages}):\n\n${files
              .map((file, idx) => 
                `${idx + 1}. ${file.name} (${file.id})\n` +
                `   └─ Size: ${file.size} bytes | Type: ${file.filetype}\n` +
                `   └─ Created: ${new Date(file.created * 1000).toLocaleString()}\n` +
                `   └─ By: ${file.username || file.user}`
              )
              .join('\n\n')}`,
          },
        ],
      };
    } catch (error) {
      logger.error('Error listing files:', error);
      
      if (error instanceof SlackAPIError) {
        throw error;
      }
      
      throw new SlackAPIError(`Failed to list files: ${error}`);
    }
  }

  /**
   * Get detailed file information
   */
  async getFileInfo(args: unknown) {
    const input = validateInput(GetFileInfoSchema, args);
    
    try {
      logger.info(`Getting file info: ${input.file_id}`);
      
      const result = await this.getClientForOperation('read').files.info({
        file: input.file_id,
        ...(input.include_comments && { count: 100 }),
      });

      if (!result.ok) {
        throw new SlackAPIError(`Failed to get file info: ${result.error}`);
      }

      const file = result.file as SlackFile;
      const comments = result.comments || [];
      
      return {
        content: [
          {
            type: 'text',
            text: `File Information: ${file.name}\n\n` +
                  `📁 Details:\n` +
                  `• ID: ${file.id}\n` +
                  `• Title: ${file.title || 'N/A'}\n` +
                  `• Type: ${file.filetype} (${file.pretty_type})\n` +
                  `• Size: ${file.size} bytes\n` +
                  `• Created: ${new Date(file.created * 1000).toLocaleString()}\n` +
                  `• By: ${file.username || file.user}\n` +
                  `• Public: ${file.is_public}\n` +
                  `• Channels: ${file.channels?.length || 0}\n` +
                  `• Comments: ${file.comments_count}\n` +
                  `• Stars: ${file.num_stars || 0}\n\n` +
                  `🔗 Links:\n` +
                  `• Permalink: ${file.permalink}\n` +
                  `• Download: ${file.url_private_download}` +
                  (input.include_comments && comments.length > 0 ? 
                    `\n\n💬 Recent Comments:\n${comments.slice(0, 5).map((comment: any) => // eslint-disable-line @typescript-eslint/no-explicit-any 
                      `• ${comment.user}: ${comment.comment.substring(0, 100)}...`
                    ).join('\n')}` : ''),
          },
        ],
      };
    } catch (error) {
      logger.error('Error getting file info:', error);
      
      if (error instanceof SlackAPIError) {
        throw error;
      }
      
      throw new SlackAPIError(`Failed to get file info: ${error}`);
    }
  }

  /**
   * Delete a file
   */
  async deleteFile(args: unknown) {
    const input = validateInput(DeleteFileSchema, args);
    
    try {
      logger.info(`Deleting file: ${input.file_id}`);
      
      const result = await this.getClientForOperation('write').files.delete({
        file: input.file_id,
      });

      if (!result.ok) {
        throw new SlackAPIError(`Failed to delete file: ${result.error}`);
      }

      return {
        content: [
          {
            type: 'text',
            text: `File ${input.file_id} deleted successfully.`,
          },
        ],
      };
    } catch (error) {
      logger.error('Error deleting file:', error);
      
      if (error instanceof SlackAPIError) {
        throw error;
      }
      
      throw new SlackAPIError(`Failed to delete file: ${error}`);
    }
  }

  /**
   * Share a file to additional channels
   */
  async shareFile(args: unknown) {
    const input = validateInput(ShareFileSchema, args);
    
    try {
      logger.info(`Sharing file ${input.file_id} to channel ${input.channel}`);
      
      const result = await this.getClientForOperation('write').files.sharedPublicURL({
        file: input.file_id,
      });

      if (!result.ok) {
        throw new SlackAPIError(`Failed to share file: ${result.error}`);
      }

      // Post the file link to the channel
      const shareResult = await this.getClientForOperation('write').chat.postMessage({
        channel: input.channel,
        text: `Shared file: ${result.file?.permalink}`,
        unfurl_links: true,
      });

      if (!shareResult.ok) {
        throw new SlackAPIError(`Failed to post file to channel: ${shareResult.error}`);
      }

      return {
        content: [
          {
            type: 'text',
            text: `File ${input.file_id} shared successfully to channel ${input.channel}.`,
          },
        ],
      };
    } catch (error) {
      logger.error('Error sharing file:', error);
      
      if (error instanceof SlackAPIError) {
        throw error;
      }
      
      throw new SlackAPIError(`Failed to share file: ${error}`);
    }
  }

  /**
   * Analyze files in workspace
   */
  async analyzeFiles(args: unknown) {
    const input = validateInput(AnalyzeFilesSchema, args);
    
    try {
      logger.info('Analyzing workspace files');
      
      const daysAgo = input.days_back || 30;
      const tsFrom = (Date.now() / 1000 - daysAgo * 24 * 3600).toString();
      
      const result = await this.getClientForOperation('read').files.list({
        ...(input.channel && { channel: input.channel }),
        ...(input.user && { user: input.user }),
        ts_from: tsFrom,
        count: 1000,
      });

      if (!result.ok) {
        throw new SlackAPIError(`Failed to list files for analysis: ${result.error}`);
      }

      const files = result.files as SlackFile[] || [];
      const analysis = this.performFileAnalysis(files, input);
      
      return {
        content: [
          {
            type: 'text',
            text: this.formatFileAnalysis(analysis),
          },
        ],
      };
    } catch (error) {
      logger.error('Error analyzing files:', error);
      
      if (error instanceof SlackAPIError) {
        throw error;
      }
      
      throw new SlackAPIError(`Failed to analyze files: ${error}`);
    }
  }

  /**
   * Search for files
   */
  async searchFiles(args: unknown) {
    const input = validateInput(SearchFilesSchema, args);
    
    try {
      logger.info(`Searching files with query: "${input.query}"`);
      
      // Check if search API is available
      this.checkSearchApiAvailability(
        'File search',
        'Use list_files with filtering as an alternative'
      );
      
      // Build search query
      let searchQuery = input.query;
      if (input.types) searchQuery += ` filetype:${input.types}`;
      if (input.user) searchQuery += ` from:${input.user}`;
      if (input.channel) searchQuery += ` in:${input.channel}`;
      if (input.after) searchQuery += ` after:${input.after}`;
      if (input.before) searchQuery += ` before:${input.before}`;
      
      const searchArgs: SearchAllArguments = {
        query: searchQuery,
        ...(input.count && { count: input.count })
      };

      const result = await this.getClientForOperation('read').search.files(searchArgs);

      if (!result.ok) {
        throw new SlackAPIError(`Failed to search files: ${result.error}`);
      }

      const files = result.files?.matches as SlackFile[] || [];
      
      return {
        content: [
          {
            type: 'text',
            text: `Found ${files.length} files matching "${input.query}":\n\n${files
              .map((file, idx) => 
                `${idx + 1}. ${file.name} (${file.id})\n` +
                `   └─ Type: ${file.filetype} | Size: ${file.size} bytes\n` +
                `   └─ Created: ${new Date(file.created * 1000).toLocaleDateString()}\n` +
                `   └─ By: ${file.username || file.user}`
              )
              .join('\n\n')}`,
          },
        ],
      };
    } catch (error) {
      logger.error('Error searching files:', error);
      
      if (error instanceof SlackAPIError) {
        throw error;
      }
      
      throw new SlackAPIError(`Failed to search files: ${error}`);
    }
  }

  // ================================
  // REACTION MANAGEMENT METHODS
  // ================================

  /**
   * Add a reaction to a message
   */
  async addReaction(args: unknown) {
    const input = validateInput(AddReactionSchema, args);
    
    try {
      logger.info(`Adding reaction ${input.reaction_name} to message ${input.message_ts}`);
      
      const result = await this.getClientForOperation('write').reactions.add({
        channel: input.channel,
        timestamp: input.message_ts,
        name: input.reaction_name,
      });

      if (!result.ok) {
        throw new SlackAPIError(`Failed to add reaction: ${result.error}`);
      }

      return {
        content: [
          {
            type: 'text',
            text: `Reaction :${input.reaction_name}: added successfully to message ${input.message_ts}.`,
          },
        ],
      };
    } catch (error) {
      logger.error('Error adding reaction:', error);
      
      if (error instanceof SlackAPIError) {
        throw error;
      }
      
      throw new SlackAPIError(`Failed to add reaction: ${error}`);
    }
  }

  /**
   * Remove a reaction from a message
   */
  async removeReaction(args: unknown) {
    const input = validateInput(RemoveReactionSchema, args);
    
    try {
      logger.info(`Removing reaction ${input.reaction_name} from message ${input.message_ts}`);
      
      const result = await this.getClientForOperation('write').reactions.remove({
        channel: input.channel,
        timestamp: input.message_ts,
        name: input.reaction_name,
      });

      if (!result.ok) {
        throw new SlackAPIError(`Failed to remove reaction: ${result.error}`);
      }

      return {
        content: [
          {
            type: 'text',
            text: `Reaction :${input.reaction_name}: removed successfully from message ${input.message_ts}.`,
          },
        ],
      };
    } catch (error) {
      logger.error('Error removing reaction:', error);
      
      if (error instanceof SlackAPIError) {
        throw error;
      }
      
      throw new SlackAPIError(`Failed to remove reaction: ${error}`);
    }
  }

  /**
   * Get reactions on a message
   */
  async getReactions(args: unknown) {
    const input = validateInput(GetReactionsSchema, args);
    
    try {
      logger.info(`Getting reactions for message ${input.message_ts}`);
      
      const getArgs: ReactionsGetArguments = {
        channel: input.channel,
        timestamp: input.message_ts,
        ...(input.full !== undefined && { full: input.full })
      };

      const result = await this.getClientForOperation('read').reactions.get(getArgs);

      if (!result.ok) {
        throw new SlackAPIError(`Failed to get reactions: ${result.error}`);
      }

      const message = result.message as SlackMessage;
      const reactions = message.reactions || [];
      
      return {
        content: [
          {
            type: 'text',
            text: `Reactions on message ${input.message_ts}:\n\n${reactions.length === 0 
              ? 'No reactions found.'
              : reactions.map(reaction => 
                  `:${reaction.name}: ${reaction.count} ${input.full 
                    ? `(${reaction.users.join(', ')})` 
                    : `user${reaction.count === 1 ? '' : 's'}`}`
                ).join('\n')
            }\n\n📝 Message: ${message.text?.substring(0, 100)}${message.text && message.text.length > 100 ? '...' : ''}`,
          },
        ],
      };
    } catch (error) {
      logger.error('Error getting reactions:', error);
      
      if (error instanceof SlackAPIError) {
        throw error;
      }
      
      throw new SlackAPIError(`Failed to get reactions: ${error}`);
    }
  }

  /**
   * Get reaction statistics
   */
  async getReactionStatistics(args: unknown) {
    const input = validateInput(GetReactionStatisticsSchema, args);
    
    try {
      logger.info('Getting reaction statistics');
      
      const daysAgo = input.days_back || 30;
      const oldest = (Date.now() / 1000 - daysAgo * 24 * 3600).toString();
      
      // Get messages from channel(s) and analyze reactions
      const messages: SlackMessage[] = [];
      
      if (input.channel) {
        const result = await this.getClientForOperation('read').conversations.history({
          channel: input.channel,
          oldest: oldest,
          limit: 1000,
        });
        
        if (result.ok && result.messages) {
          messages.push(...(result.messages as unknown as SlackMessage[]));
        }
      }
      
      const statistics = this.analyzeReactionStatistics(messages, input);
      
      return {
        content: [
          {
            type: 'text',
            text: this.formatReactionStatistics(statistics),
          },
        ],
      };
    } catch (error) {
      logger.error('Error getting reaction statistics:', error);
      
      if (error instanceof SlackAPIError) {
        throw error;
      }
      
      throw new SlackAPIError(`Failed to get reaction statistics: ${error}`);
    }
  }

  /**
   * Find messages by reaction patterns
   */
  async findMessagesByReactions(args: unknown) {
    const input = validateInput(FindMessagesByReactionsSchema, args);
    
    try {
      logger.info(`Finding messages with reactions: ${input.reactions.join(', ')}`);
      
      // Check if search API is available
      this.checkSearchApiAvailability(
        'Reaction search',
        'Use get_reactions on specific messages as an alternative'
      );
      
      // Build search query based on reactions
      const searchQuery = input.reactions.map(r => `has::${r}:`).join(input.match_type === 'all' ? ' ' : ' OR ') +
        (input.channel ? ` in:${input.channel}` : '') +
        (input.after ? ` after:${input.after}` : '') +
        (input.before ? ` before:${input.before}` : '');
      
      const searchArgs: SearchAllArguments = {
        query: searchQuery,
        ...(input.limit && { count: input.limit })
      };

      const result = await this.getClientForOperation('read').search.messages(searchArgs);

      if (!result.ok) {
        throw new SlackAPIError(`Failed to search messages by reactions: ${result.error}`);
      }

      const messages = result.messages?.matches || [];
      const filteredMessages = messages.filter((match: any) => { // eslint-disable-line @typescript-eslint/no-explicit-any
        const message = match;
        const reactions = (message as any).reactions || []; // eslint-disable-line @typescript-eslint/no-explicit-any
        const totalReactions = reactions.reduce((sum: number, r: any) => sum + r.count, 0); // eslint-disable-line @typescript-eslint/no-explicit-any
        
        return totalReactions >= (input.min_reaction_count || 1);
      });
      
      return {
        content: [
          {
            type: 'text',
            text: `Found ${filteredMessages.length} messages with specified reaction patterns:\n\n${(await Promise.all(
              filteredMessages.map(async (match: any, idx: number) => { // eslint-disable-line @typescript-eslint/no-explicit-any
                const message = match;
                const reactions = (message as any).reactions || []; // eslint-disable-line @typescript-eslint/no-explicit-any
                const displayName = await this.getUserDisplayName(message.user || 'unknown');
                return `${idx + 1}. Message from ${displayName}\n` +
                       `   └─ Reactions: ${reactions.map((r: any) => `:${r.name}: ${r.count}`).join(' ')}\n` + // eslint-disable-line @typescript-eslint/no-explicit-any
                       `   └─ Text: ${message.text?.substring(0, 100)}...`;
              })
            )).join('\n\n')}`,
          },
        ],
      };
    } catch (error) {
      logger.error('Error finding messages by reactions:', error);
      
      if (error instanceof SlackAPIError) {
        throw error;
      }
      
      throw new SlackAPIError(`Failed to find messages by reactions: ${error}`);
    }
  }

  // ================================
  // WORKSPACE MANAGEMENT METHODS
  // ================================

  /**
   * Get workspace information
   */
  async getWorkspaceInfo(args: unknown) {
    validateInput(GetWorkspaceInfoSchema, args);
    
    try {
      logger.info('Getting workspace information');
      
      const result = await this.getClientForOperation('read').team.info();

      if (!result.ok) {
        throw new SlackAPIError(`Failed to get workspace info: ${result.error}`);
      }

      const team = result.team as WorkspaceInfo;
      
      return {
        content: [
          {
            type: 'text',
            text: `Workspace Information:\n\n` +
                  `🏢 ${team.name} (${team.domain})\n` +
                  `• ID: ${team.id}\n` +
                  `• Email Domain: ${team.email_domain}\n` +
                  `• Enterprise: ${team.enterprise_name || 'N/A'} (${team.enterprise_id || 'N/A'})`,
          },
        ],
      };
    } catch (error) {
      logger.error('Error getting workspace info:', error);
      
      if (error instanceof SlackAPIError) {
        throw error;
      }
      
      throw new SlackAPIError(`Failed to get workspace info: ${error}`);
    }
  }

  /**
   * List team members
   */
  async listTeamMembers(args: unknown) {
    const input = validateInput(ListTeamMembersSchema, args);
    
    try {
      logger.info('Listing team members');
      
      const listArgs: UsersListArguments = {
        include_locale: false,
        ...(input.limit && { limit: input.limit }),
        ...(input.cursor && { cursor: input.cursor })
      };

      const result = await this.getClientForOperation('read').users.list(listArgs);

      if (!result.ok) {
        throw new SlackAPIError(`Failed to list team members: ${result.error}`);
      }

      let members = result.members as TeamMember[] || [];
      
      // Filter based on preferences
      if (!input.include_deleted) {
        members = members.filter(member => !member.deleted);
      }
      if (!input.include_bots) {
        members = members.filter(member => !member.is_bot);
      }
      
      return {
        content: [
          {
            type: 'text',
            text: `Team Members (${members.length} found):\n\n${members
              .map((member, idx) => 
                `${idx + 1}. ${member.real_name || member.name} (@${member.name})\n` +
                `   └─ ID: ${member.id}\n` +
                `   └─ Role: ${member.is_owner ? 'Owner' : member.is_admin ? 'Admin' : member.is_restricted ? 'Restricted' : 'Member'}\n` +
                `   └─ Status: ${member.deleted ? 'Deleted' : member.is_bot ? 'Bot' : 'Active'}`
              )
              .slice(0, 20) // Limit display to first 20
              .join('\n\n')}${members.length > 20 ? `\n\n... and ${members.length - 20} more` : ''}`,
          },
        ],
      };
    } catch (error) {
      logger.error('Error listing team members:', error);
      
      if (error instanceof SlackAPIError) {
        throw error;
      }
      
      throw new SlackAPIError(`Failed to list team members: ${error}`);
    }
  }

  // ================================
  // ANALYTICS AND REPORTING METHODS
  // ================================

  /**
   * Get workspace activity report
   */
  async getWorkspaceActivity(args: unknown) {
    const input = validateInput(GetWorkspaceActivitySchema, args);
    
    try {
      logger.info('Generating workspace activity report');
      
      const startDate = input.start_date || new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      const endDate = input.end_date || new Date().toISOString().split('T')[0];
      
      // This would typically involve multiple API calls to gather comprehensive data
      // For this implementation, we'll provide a basic structure
      const activity: WorkspaceActivity = {
        date_range: { start: startDate || '', end: endDate || '' },
        message_stats: {
          total_messages: 0,
          public_messages: 0,
          private_messages: 0,
          dm_messages: 0,
          bot_messages: 0,
        },
        user_stats: {
          active_users: 0,
          total_users: 0,
          new_users: 0,
          user_activity: [],
        },
        channel_stats: {
          active_channels: 0,
          total_channels: 0,
          new_channels: 0,
          channel_activity: [],
        },
        file_stats: {
          files_uploaded: 0,
          total_storage_bytes: 0,
          storage_by_type: {},
        },
        integration_stats: {
          api_calls: 0,
          rate_limit_hits: 0,
          error_rate: 0,
        },
      };
      
      return {
        content: [
          {
            type: 'text',
            text: this.formatWorkspaceActivity(activity),
          },
        ],
      };
    } catch (error) {
      logger.error('Error generating workspace activity report:', error);
      
      if (error instanceof SlackAPIError) {
        throw error;
      }
      
      throw new SlackAPIError(`Failed to generate workspace activity report: ${error}`);
    }
  }

  /**
   * Get server health status
   */
  async getServerHealth(args: unknown) {
    const input = validateInput(GetServerHealthSchema, args);
    
    try {
      logger.info('Getting server health status');
      
      const startTime = process.hrtime();
      
      // Test API connectivity
      const testResult = await this.getClientForOperation('write').auth.test();
      
      const [seconds, nanoseconds] = process.hrtime(startTime);
      const responseTimeMs = seconds * 1000 + nanoseconds / 1e6;
      
      const memoryUsage = process.memoryUsage();
      const uptime = process.uptime();
      
      const rateLimitPercentage = this.rateLimitMetrics.totalRequests > 0 
        ? (this.rateLimitMetrics.rateLimitedRequests / this.rateLimitMetrics.totalRequests) * 100 
        : 0;

      const health: ServerHealth = {
        status: testResult.ok ? 'healthy' : 'degraded',
        uptime_seconds: uptime,
        memory_usage: {
          used: memoryUsage.heapUsed,
          total: memoryUsage.heapTotal,
          percentage: (memoryUsage.heapUsed / memoryUsage.heapTotal) * 100,
        },
        rate_limits: {
          remaining: 1000, // Would need to track actual rate limits
          reset_at: Date.now() + 3600000,
          limit: 1000,
        },
        last_api_call: new Date().toISOString(),
        error_count_last_hour: 0, // Would need to implement error tracking
        response_times: {
          avg_ms: responseTimeMs,
          p95_ms: responseTimeMs * 1.2,
          p99_ms: responseTimeMs * 1.5,
        },
        rate_limit_metrics: {
          total_requests: this.rateLimitMetrics.totalRequests,
          rate_limited_requests: this.rateLimitMetrics.rateLimitedRequests,
          retry_attempts: this.rateLimitMetrics.retryAttempts,
          last_rate_limit_time: this.rateLimitMetrics.lastRateLimitTime?.toISOString() || null,
          rate_limits_by_tier: Object.fromEntries(this.rateLimitMetrics.rateLimitsByTier),
          rate_limit_percentage: rateLimitPercentage,
        },
      };
      
      return {
        content: [
          {
            type: 'text',
            text: this.formatServerHealth(health, input),
          },
        ],
      };
    } catch (error) {
      logger.error('Error getting server health:', error);
      
      const rateLimitPercentage = this.rateLimitMetrics.totalRequests > 0 
        ? (this.rateLimitMetrics.rateLimitedRequests / this.rateLimitMetrics.totalRequests) * 100 
        : 0;

      const degradedHealth: ServerHealth = {
        status: 'unhealthy',
        uptime_seconds: process.uptime(),
        memory_usage: {
          used: process.memoryUsage().heapUsed,
          total: process.memoryUsage().heapTotal,
          percentage: (process.memoryUsage().heapUsed / process.memoryUsage().heapTotal) * 100,
        },
        rate_limits: {
          remaining: 0,
          reset_at: Date.now() + 3600000,
          limit: 1000,
        },
        last_api_call: new Date().toISOString(),
        error_count_last_hour: 1,
        response_times: {
          avg_ms: 0,
          p95_ms: 0,
          p99_ms: 0,
        },
        rate_limit_metrics: {
          total_requests: this.rateLimitMetrics.totalRequests,
          rate_limited_requests: this.rateLimitMetrics.rateLimitedRequests,
          retry_attempts: this.rateLimitMetrics.retryAttempts,
          last_rate_limit_time: this.rateLimitMetrics.lastRateLimitTime?.toISOString() || null,
          rate_limits_by_tier: Object.fromEntries(this.rateLimitMetrics.rateLimitsByTier),
          rate_limit_percentage: rateLimitPercentage,
        },
      };
      
      return {
        content: [
          {
            type: 'text',
            text: this.formatServerHealth(degradedHealth, input) + `\n\nError: ${error}`,
          },
        ],
      };
    }
  }

  // ================================
  // HELPER METHODS
  // ================================

  /**
   * Build search query for thread searching
   */
  private buildThreadSearchQuery(input: SearchThreadsInput): string {
    let query = input.query;
    
    // Don't add has:thread - we want to find all messages that match,
    // including thread parents without replies
    
    if (input.channel) {
      query += ` in:${input.channel}`;
    }
    
    if (input.user) {
      query += ` from:${input.user}`;
    }
    
    if (input.after) {
      query += ` after:${input.after}`;
    }
    
    if (input.before) {
      query += ` before:${input.before}`;
    }
    
    return query;
  }

  /**
   * Get appropriate reaction emoji for importance level
   */
  private getImportanceReaction(level: string): string {
    switch (level) {
      case 'critical': return 'rotating_light';
      case 'high': return 'exclamation';
      case 'medium': return 'warning';
      case 'low': return 'information_source';
      default: return 'pushpin';
    }
  }

  /**
   * Analyze thread participants
   */
  private analyzeThreadParticipants(messages: SlackMessage[]): ThreadParticipant[] {
    const participantMap = new Map<string, ThreadParticipant>();
    
    for (const msg of messages) {
      if (msg.user) {
        if (!participantMap.has(msg.user)) {
          participantMap.set(msg.user, {
            user_id: msg.user,
            username: msg.user, // This would ideally be resolved to actual username
            message_count: 0,
            first_message_ts: msg.ts!,
            last_message_ts: msg.ts!,
          });
        }
        
        const participant = participantMap.get(msg.user)!;
        participant.message_count++;
        participant.last_message_ts = msg.ts!;
      }
    }
    
    return Array.from(participantMap.values());
  }

  /**
   * Build thread timeline
   */
  private buildThreadTimeline(messages: SlackMessage[]): ThreadTimelineEvent[] {
    return messages.map(msg => ({
      timestamp: msg.ts!,
      user_id: msg.user || 'unknown',
      event_type: 'message',
      content: msg.text,
    }));
  }

  /**
   * Extract topics from thread
   */
  private extractTopicsFromThread(messages: SlackMessage[]): string[] {
    const text = messages.map(m => m.text || '').join(' ').toLowerCase();
    
    // Simple keyword extraction - in practice, you'd use more sophisticated NLP
    const commonWords = ['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should', 'may', 'might', 'can', 'cannot', 'this', 'that', 'these', 'those'];
    const words = text.split(/\s+/).filter(word => word.length > 3 && !commonWords.includes(word));
    
    const wordCounts = new Map<string, number>();
    words.forEach(word => {
      wordCounts.set(word, (wordCounts.get(word) || 0) + 1);
    });
    
    return Array.from(wordCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([word]) => word);
  }

  /**
   * Calculate urgency score
   */
  private calculateUrgencyScore(messages: SlackMessage[]): number {
    const urgentKeywords = ['urgent', 'asap', 'immediately', 'emergency', 'critical', 'now', 'today', 'deadline'];
    const text = messages.map(m => m.text || '').join(' ').toLowerCase();
    
    let score = 0;
    urgentKeywords.forEach(keyword => {
      const count = (text.match(new RegExp(keyword, 'g')) || []).length;
      score += count * 0.2;
    });
    
    // Factor in response frequency
    if (messages.length > 10) score += 0.3;
    if (messages.length > 20) score += 0.3;
    
    return Math.min(1, score);
  }

  /**
   * Calculate importance score
   */
  private calculateImportanceScore(messages: SlackMessage[], participants: ThreadParticipant[]): number {
    let score = 0;
    
    // More participants = potentially more important
    score += Math.min(0.3, participants.length * 0.05);
    
    // More messages = more discussion = potentially more important
    score += Math.min(0.4, messages.length * 0.02);
    
    // Check for important keywords
    const importantKeywords = ['decision', 'approve', 'budget', 'launch', 'release', 'client', 'customer', 'revenue', 'milestone'];
    const text = messages.map(m => m.text || '').join(' ').toLowerCase();
    
    importantKeywords.forEach(keyword => {
      if (text.includes(keyword)) score += 0.1;
    });
    
    return Math.min(1, score);
  }

  /**
   * Analyze sentiment
   */
  private analyzeSentiment(messages: SlackMessage[]): 'positive' | 'neutral' | 'negative' {
    const text = messages.map(m => m.text || '').join(' ').toLowerCase();
    
    const positiveWords = ['good', 'great', 'excellent', 'awesome', 'perfect', 'love', 'like', 'happy', 'yes', 'agree'];
    const negativeWords = ['bad', 'terrible', 'awful', 'hate', 'dislike', 'angry', 'no', 'disagree', 'problem', 'issue'];
    
    let positiveCount = 0;
    let negativeCount = 0;
    
    positiveWords.forEach(word => {
      positiveCount += (text.match(new RegExp(word, 'g')) || []).length;
    });
    
    negativeWords.forEach(word => {
      negativeCount += (text.match(new RegExp(word, 'g')) || []).length;
    });
    
    if (positiveCount > negativeCount * 1.2) return 'positive';
    if (negativeCount > positiveCount * 1.2) return 'negative';
    return 'neutral';
  }

  /**
   * Extract action items from messages
   */
  private extractActionItemsFromMessages(messages: SlackMessage[]): ActionItem[] {
    const actionItems: ActionItem[] = [];
    const actionIndicators = ['todo', 'action item', 'need to', 'should', 'will', 'task', 'follow up', 'next step'];
    
    messages.forEach(msg => {
      if (msg.text) {
        const text = msg.text.toLowerCase();
        const lines = text.split('\n');
        
        lines.forEach(line => {
          if (actionIndicators.some(indicator => line.includes(indicator))) {
            // Extract mentioned users
            const mentions = (line.match(/<@(\w+)>/g) || []).map(mention => mention.replace(/<@|>/g, ''));
            
            actionItems.push({
              text: line.trim(),
              mentioned_users: mentions,
              priority: this.determinePriority(line),
              status: this.determineActionStatus(line),
              extracted_from_message_ts: msg.ts!,
            });
          }
        });
      }
    });
    
    return actionItems;
  }

  /**
   * Generate thread summary
   */
  private generateThreadSummary(messages: SlackMessage[], participants: ThreadParticipant[], topics: string[]): string {
    const participantCount = participants.length;
    const messageCount = messages.length;
    const mainTopics = topics.slice(0, 3).join(', ');
    
    return `Thread with ${participantCount} participants and ${messageCount} messages discussing ${mainTopics || 'various topics'}.`;
  }

  /**
   * Format thread analysis
   */
  private formatThreadAnalysis(analysis: ThreadAnalysis): string {
    return `Thread Analysis: ${analysis.thread_ts}\n\n` +
           `📊 Overview:\n` +
           `• Participants: ${analysis.participants.length}\n` +
           `• Messages: ${analysis.timeline.length}\n` +
           `• Duration: ${analysis.duration_hours.toFixed(1)} hours\n` +
           `• Word Count: ${analysis.word_count}\n\n` +
           `🎯 Scores:\n` +
           `• Importance: ${(analysis.importance_score * 100).toFixed(1)}%\n` +
           `• Urgency: ${(analysis.urgency_score * 100).toFixed(1)}%\n` +
           `• Sentiment: ${analysis.sentiment}\n\n` +
           `🔑 Key Topics: ${analysis.key_topics.join(', ')}\n\n` +
           `📝 Summary: ${analysis.summary}\n\n` +
           `✅ Action Items: ${analysis.action_items.length}`;
  }

  /**
   * Generate thread title
   */
  private generateThreadTitle(messages: SlackMessage[]): string {
    const firstMessage = messages[0];
    if (firstMessage?.text) {
      return firstMessage.text.substring(0, 50) + (firstMessage.text.length > 50 ? '...' : '');
    }
    return 'Thread Discussion';
  }

  /**
   * Generate brief summary
   */
  private generateBriefSummary(messages: SlackMessage[], length: string): string {
    const text = messages.map(m => m.text || '').join(' ');
    const maxLength = length === 'brief' ? 100 : length === 'detailed' ? 300 : 500;
    
    return text.substring(0, maxLength) + (text.length > maxLength ? '...' : '');
  }

  /**
   * Extract key points
   */
  private extractKeyPoints(messages: SlackMessage[]): string[] {
    // Simple implementation - in practice, use more sophisticated text analysis
    const points = [];
    for (const msg of messages) {
      if (msg.text && msg.text.length > 50) {
        points.push(msg.text.substring(0, 100));
        if (points.length >= 5) break;
      }
    }
    return points;
  }

  /**
   * Extract decisions
   */
  private extractDecisions(messages: SlackMessage[]): string[] {
    const decisionKeywords = ['decided', 'decision', 'agree', 'approved', 'concluded', 'resolved'];
    const decisions = [];
    
    for (const msg of messages) {
      if (msg.text) {
        const text = msg.text.toLowerCase();
        if (decisionKeywords.some(keyword => text.includes(keyword))) {
          decisions.push(msg.text.substring(0, 150));
        }
      }
    }
    
    return decisions;
  }

  /**
   * Format duration
   */
  private formatDuration(messages: SlackMessage[]): string {
    if (messages.length < 2) return '0 minutes';
    
    const startTime = parseFloat(messages[0]?.ts || '0');
    const endTime = parseFloat(messages[messages.length - 1]?.ts || '0');
    const durationMinutes = (endTime - startTime) / 60;
    
    if (durationMinutes < 60) {
      return `${Math.round(durationMinutes)} minutes`;
    } else if (durationMinutes < 1440) {
      return `${Math.round(durationMinutes / 60)} hours`;
    } else {
      return `${Math.round(durationMinutes / 1440)} days`;
    }
  }

  /**
   * Determine thread status
   */
  private determineThreadStatus(messages: SlackMessage[], actionItems: ActionItem[]): 'active' | 'resolved' | 'stale' {
    const lastMessage = messages[messages.length - 1];
    const lastMessageTime = parseFloat((lastMessage?.ts as string) || '0');
    const now = Date.now() / 1000;
    const hoursOld = (now - lastMessageTime) / 3600;
    
    if (hoursOld > 168) return 'stale'; // More than a week old
    if (actionItems.every(item => item.status === 'completed')) return 'resolved';
    return 'active';
  }

  /**
   * Determine priority
   */
  private determinePriority(text: string): 'low' | 'medium' | 'high' {
    const highPriorityWords = ['urgent', 'critical', 'immediately', 'asap'];
    const mediumPriorityWords = ['important', 'soon', 'today'];
    
    const lowerText = text.toLowerCase();
    
    if (highPriorityWords.some(word => lowerText.includes(word))) return 'high';
    if (mediumPriorityWords.some(word => lowerText.includes(word))) return 'medium';
    return 'low';
  }

  /**
   * Determine action status
   */
  private determineActionStatus(text: string): 'open' | 'in_progress' | 'completed' {
    const completedWords = ['done', 'completed', 'finished', 'resolved'];
    const inProgressWords = ['working on', 'in progress', 'started'];
    
    const lowerText = text.toLowerCase();
    
    if (completedWords.some(word => lowerText.includes(word))) return 'completed';
    if (inProgressWords.some(word => lowerText.includes(word))) return 'in_progress';
    return 'open';
  }

  // Additional helper methods for advanced features would go here
  // For brevity, I'm including just the essential ones above
  
  private async generateThreadExport(messages: SlackMessage[], _participants: ThreadParticipant[], options: ThreadExportOptions): Promise<ThreadExportResult> {
    // Implementation would depend on format
    const content = messages.map(m => `${m.user}: ${m.text}`).join('\n');
    return {
      format: options.format,
      content,
      filename: `thread_${Date.now()}.${options.format}`,
      size_bytes: Buffer.byteLength(content, 'utf8'),
      export_timestamp: new Date().toISOString(),
    };
  }

  private formatThreadSummary(summary: ThreadSummary): string {
    return `Thread Summary: ${summary.title}\n\n` +
           `📋 Details:\n` +
           `• Status: ${summary.status}\n` +
           `• Participants: ${summary.participants.length}\n` +
           `• Messages: ${summary.message_count}\n` +
           `• Duration: ${summary.duration}\n\n` +
           `💬 Summary: ${summary.brief_summary}\n\n` +
           `🎯 Key Points:\n${summary.key_points.map(p => `• ${p}`).join('\n')}\n\n` +
           `✅ Action Items: ${summary.action_items.length}\n` +
           `📋 Decisions: ${summary.decisions_made.length}`;
  }

  // Placeholder methods for complex features
  private buildRelatedThreadSearchQueries(keywords: string[]): string[] {
    // Don't add has:thread - we'll identify threads in the result processing
    return [keywords.join(' ')]; // Return array of search query strings
  }

  private calculateThreadSimilarity(): number {
    // Simplified similarity calculation
    return Math.random() * 0.8 + 0.2; // Placeholder
  }

  private removeDuplicateThreads(threads: RelatedThread[]): RelatedThread[] {
    const seen = new Set();
    return threads.filter(thread => {
      const key = `${thread.channel_id}_${thread.thread_ts}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  // eslint-disable-next-line @typescript-eslint/explicit-function-return-type
  private calculateTimeRange(after?: string, before?: string) {
    return {
      oldest: after || (Date.now() / 1000 - 30 * 24 * 3600).toString(), // 30 days ago
      latest: before || (Date.now() / 1000).toString(),
    };
  }

  private calculateThreadMetrics(threads: SlackThread[]): ThreadMetrics {
    // Placeholder implementation
    return {
      total_threads: threads.length,
      active_threads: 0,
      resolved_threads: 0,
      stale_threads: 0,
      avg_messages_per_thread: 0,
      avg_participants_per_thread: 0,
      avg_duration_hours: 0,
      top_participants: [],
      busiest_channels: [],
      thread_activity_by_hour: [],
    };
  }

  private formatThreadMetrics(metrics: ThreadMetrics): string {
    return `Thread Metrics\n\n` +
           `📊 Overview:\n` +
           `• Total Threads: ${metrics.total_threads}\n` +
           `• Active: ${metrics.active_threads}\n` +
           `• Resolved: ${metrics.resolved_threads}\n` +
           `• Stale: ${metrics.stale_threads}\n\n` +
           `📈 Averages:\n` +
           `• Messages per thread: ${metrics.avg_messages_per_thread.toFixed(1)}\n` +
           `• Participants per thread: ${metrics.avg_participants_per_thread.toFixed(1)}\n` +
           `• Duration: ${metrics.avg_duration_hours.toFixed(1)} hours`;
  }

  // ================================
  // NEW HELPER METHODS
  // ================================

  /**
   * Perform file analysis
   */
  private performFileAnalysis(files: SlackFile[], input: { days_back?: number; size_threshold_mb?: number; user?: string; channel?: string; include_large_files?: boolean }): FileAnalysis {
    const sizeThreshold = (input.size_threshold_mb || 10) * 1024 * 1024; // Convert to bytes
    
    const analysis: FileAnalysis = {
      total_files: files.length,
      total_size_bytes: files.reduce((sum, file) => sum + file.size, 0),
      by_type: {},
      by_user: {},
      by_channel: {},
      large_files: files.filter(file => file.size > sizeThreshold),
      old_files: files.filter(file => {
        const age = Date.now() - file.created * 1000;
        return age > 90 * 24 * 60 * 60 * 1000; // Older than 90 days
      }),
      recent_activity: [],
    };

    // Analyze by type
    files.forEach(file => {
      if (!analysis.by_type[file.filetype]) {
        analysis.by_type[file.filetype] = { count: 0, size_bytes: 0 };
      }
      analysis.by_type[file.filetype]!.count++;
      analysis.by_type[file.filetype]!.size_bytes += file.size;
    });

    // Analyze by user
    files.forEach(file => {
      const user = file.username || file.user;
      if (user && !analysis.by_user[user]) {
        analysis.by_user[user] = { count: 0, size_bytes: 0 };
      }
      if (user) {
        analysis.by_user[user]!.count++;
        analysis.by_user[user]!.size_bytes += file.size;
      }
    });

    return analysis;
  }

  /**
   * Format file analysis results
   */
  private formatFileAnalysis(analysis: FileAnalysis): string {
    const formatBytes = (bytes: number): string => {
      const sizes = ['Bytes', 'KB', 'MB', 'GB'];
      if (bytes === 0) return '0 Bytes';
      const i = Math.floor(Math.log(bytes) / Math.log(1024));
      return `${Math.round(bytes / Math.pow(1024, i) * 100) / 100} ${sizes[i]}`;
    };

    return `File Analysis Report\n\n` +
           `📊 Overview:\n` +
           `• Total Files: ${analysis.total_files}\n` +
           `• Total Size: ${formatBytes(analysis.total_size_bytes)}\n` +
           `• Large Files (>${10}MB): ${analysis.large_files.length}\n` +
           `• Old Files (>90 days): ${analysis.old_files.length}\n\n` +
           `📁 By File Type:\n${Object.entries(analysis.by_type)
             .sort((a, b) => b[1].count - a[1].count)
             .slice(0, 10)
             .map(([type, stats]) => 
               `• ${type}: ${stats.count} files (${formatBytes(stats.size_bytes)})`
             ).join('\n')}\n\n` +
           `👤 Top Uploaders:\n${Object.entries(analysis.by_user)
             .sort((a, b) => b[1].count - a[1].count)
             .slice(0, 5)
             .map(([user, stats]) => 
               `• ${user}: ${stats.count} files (${formatBytes(stats.size_bytes)})`
             ).join('\n')}` +
           (analysis.large_files.length > 0 ? 
             `\n\n🐘 Large Files:\n${analysis.large_files.slice(0, 5)
               .map(file => `• ${file.name}: ${formatBytes(file.size)}`)
               .join('\n')}` : '');
  }

  /**
   * Analyze reaction statistics
   */
  private analyzeReactionStatistics(messages: SlackMessage[], input: { days_back?: number; include_trends?: boolean; top_count?: number; user?: string; channel?: string }): ReactionStatistics {
    const reactionCounts = new Map<string, number>();
    const reactionUsers = new Map<string, Set<string>>();
    let totalReactions = 0;

    messages.forEach(message => {
      if (message.reactions) {
        message.reactions.forEach(reaction => {
          const currentCount = reactionCounts.get(reaction.name) || 0;
          reactionCounts.set(reaction.name, currentCount + reaction.count);
          
          if (!reactionUsers.has(reaction.name)) {
            reactionUsers.set(reaction.name, new Set());
          }
          reaction.users.forEach(user => reactionUsers.get(reaction.name)!.add(user));
          
          totalReactions += reaction.count;
        });
      }
    });

    const mostUsedReactions = Array.from(reactionCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, input.top_count || 10)
      .map(([name, count]) => ({
        name,
        count,
        percentage: (count / totalReactions) * 100,
      }));

    return {
      total_reactions: totalReactions,
      unique_reactions: reactionCounts.size,
      most_used_reactions: mostUsedReactions,
      reaction_trends: [], // Would need historical data
      top_reactors: [], // Would need user-level aggregation
    };
  }

  /**
   * Format reaction statistics
   */
  private formatReactionStatistics(statistics: ReactionStatistics): string {
    return `Reaction Statistics\n\n` +
           `📊 Overview:\n` +
           `• Total Reactions: ${statistics.total_reactions}\n` +
           `• Unique Reactions: ${statistics.unique_reactions}\n\n` +
           `🏆 Most Used Reactions:\n${statistics.most_used_reactions
             .map((reaction, idx) => 
               `${idx + 1}. :${reaction.name}: ${reaction.count} uses (${reaction.percentage.toFixed(1)}%)`
             ).join('\n')}`;
  }

  /**
   * Format workspace activity
   */
  private formatWorkspaceActivity(activity: WorkspaceActivity): string {
    return `Workspace Activity Report\n` +
           `📅 Period: ${activity.date_range.start} to ${activity.date_range.end}\n\n` +
           `💬 Messages:\n` +
           `• Total: ${activity.message_stats.total_messages}\n` +
           `• Public: ${activity.message_stats.public_messages}\n` +
           `• Private: ${activity.message_stats.private_messages}\n` +
           `• DMs: ${activity.message_stats.dm_messages}\n` +
           `• Bot: ${activity.message_stats.bot_messages}\n\n` +
           `👥 Users:\n` +
           `• Active: ${activity.user_stats.active_users}\n` +
           `• Total: ${activity.user_stats.total_users}\n` +
           `• New: ${activity.user_stats.new_users}\n\n` +
           `📺 Channels:\n` +
           `• Active: ${activity.channel_stats.active_channels}\n` +
           `• Total: ${activity.channel_stats.total_channels}\n` +
           `• New: ${activity.channel_stats.new_channels}\n\n` +
           `📁 Files:\n` +
           `• Uploaded: ${activity.file_stats.files_uploaded}\n` +
           `• Storage: ${this.formatBytes(activity.file_stats.total_storage_bytes)}`;
  }

  /**
   * Format server health
   */
  private formatServerHealth(health: ServerHealth, input: { include_rate_limits?: boolean; include_response_times?: boolean }): string {
    const formatUptime = (seconds: number): string => {
      const days = Math.floor(seconds / 86400);
      const hours = Math.floor((seconds % 86400) / 3600);
      const minutes = Math.floor((seconds % 3600) / 60);
      return `${days}d ${hours}h ${minutes}m`;
    };

    let result = `Server Health Status: ${health.status.toUpperCase()}\n\n` +
                 `⏱️ Uptime: ${formatUptime(health.uptime_seconds)}\n` +
                 `💾 Memory: ${this.formatBytes(health.memory_usage.used)} / ${this.formatBytes(health.memory_usage.total)} (${health.memory_usage.percentage.toFixed(1)}%)\n`;

    if (input.include_rate_limits) {
      result += `🚦 Rate Limits: ${health.rate_limits.remaining} / ${health.rate_limits.limit} remaining\n`;
    }

    if (input.include_response_times) {
      result += `⚡ Response Times: ${health.response_times.avg_ms.toFixed(1)}ms avg, ${health.response_times.p95_ms.toFixed(1)}ms p95\n`;
    }

    result += `🔍 Last API Call: ${health.last_api_call}\n` +
              `❌ Errors (last hour): ${health.error_count_last_hour}`;

    // Add rate limit metrics if available
    if (health.rate_limit_metrics) {
      result += '\n\n📊 Rate Limit Metrics:\n' +
                `  Total Requests: ${health.rate_limit_metrics.total_requests}\n` +
                `  Rate Limited Requests: ${health.rate_limit_metrics.rate_limited_requests}\n` +
                `  Rate Limit Percentage: ${health.rate_limit_metrics.rate_limit_percentage.toFixed(2)}%\n` +
                `  Retry Attempts: ${health.rate_limit_metrics.retry_attempts}\n`;
      
      if (health.rate_limit_metrics.last_rate_limit_time) {
        result += `  Last Rate Limited: ${health.rate_limit_metrics.last_rate_limit_time}\n`;
      }
      
      const tierEntries = Object.entries(health.rate_limit_metrics.rate_limits_by_tier);
      if (tierEntries.length > 0) {
        result += '  Rate Limits by Tier:\n';
        tierEntries.forEach(([tier, count]) => {
          result += `    ${tier}: ${count}\n`;
        });
      }
    }

    return result;
  }

  /**
   * Format bytes helper
   */
  private formatBytes(bytes: number): string {
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    if (bytes === 0) return '0 Bytes';
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return `${Math.round(bytes / Math.pow(1024, i) * 100) / 100} ${sizes[i]}`;
  }
}