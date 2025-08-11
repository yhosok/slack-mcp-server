import {
  WebClient,
  LogLevel,
  WebClientEvent,
  type SearchAllArguments,
  type FilesListArguments,
  type UsersListArguments,
  type ChatPostMessageArguments,
  type ReactionsGetArguments,
} from '@slack/web-api';
import type { MCPToolResult } from '../mcp/types.js';
import { CONFIG } from '../config/index.js';
import {
  createSlackServiceRegistry,
  type SlackServiceRegistry,
} from './service-factory-stub.js';
import { logger } from '../utils/logger.js';
import { SlackAPIError } from '../utils/errors.js';

import type {
  SlackMessage,
  SearchMatch,
} from './types.js';

/**
 * Service class for Slack API operations
 * 
 * This class serves as a thin facade over the modular architecture,
 * providing WebClient management, rate limiting, and delegating
 * all business logic to the service registry.
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

  // Modular architecture integration
  private serviceRegistry: SlackServiceRegistry | undefined;

  constructor() {
    // Delay initialization until first use
  }

  /**
   * Initialize modular services (lazy-loaded)
   */
  private getServiceRegistry(): SlackServiceRegistry {
    if (!this.serviceRegistry) {
      this.serviceRegistry = createSlackServiceRegistry();
    }
    return this.serviceRegistry;
  }

  private getClient(): WebClient {
    if (!this.client) {
      this.client = new WebClient(CONFIG.SLACK_BOT_TOKEN, {
        logLevel: this.getSlackLogLevel(),
        retryConfig: CONFIG.SLACK_ENABLE_RATE_LIMIT_RETRY
          ? {
              retries: CONFIG.SLACK_RATE_LIMIT_RETRIES,
              factor: 2,
              minTimeout: 1000,
              maxTimeout: 300000,
              randomize: true,
            }
          : undefined,
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
        retryConfig: CONFIG.SLACK_ENABLE_RATE_LIMIT_RETRY
          ? {
              retries: CONFIG.SLACK_RATE_LIMIT_RETRIES,
              factor: 2,
              minTimeout: 1000,
              maxTimeout: 300000,
              randomize: true,
            }
          : undefined,
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
        total_rate_limits: this.rateLimitMetrics.rateLimitedRequests,
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
        const displayName =
          result.user.profile?.display_name || result.user.real_name || result.user.name || userId;
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
      reactions: msg.reactions,
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
      previous: match.previous
        ? this.convertMessageElementToSlackMessage(match.previous)
        : undefined,
      previous_2: match.previous_2
        ? this.convertMessageElementToSlackMessage(match.previous_2)
        : undefined,
      next: match.next ? this.convertMessageElementToSlackMessage(match.next) : undefined,
      next_2: match.next_2 ? this.convertMessageElementToSlackMessage(match.next_2) : undefined,
    };
  }

  /**
   * Get performance statistics (stub for compatibility)
   */
  public getPerformanceStats(_methodName?: string): {
    legacy: { avgTime: number; successRate: number; count: number };
    modular: { avgTime: number; successRate: number; count: number };
  } {
    // Return empty stats since we removed performance monitoring
    return {
      legacy: { avgTime: 0, successRate: 100, count: 0 },
      modular: { avgTime: 0, successRate: 100, count: 0 },
    };
  }

  // ================================
  // PUBLIC API METHODS (36 TOTAL)
  // ================================
  
  /**
   * Send a message to a Slack channel or user
   */
  async sendMessage(args: unknown): Promise<MCPToolResult> {
    if (!this.serviceRegistry) {
      this.serviceRegistry = createSlackServiceRegistry();
    }
    return this.serviceRegistry.methods.sendMessage(args);
  }

  /**
   * Get message history from a channel
   */
  async getChannelHistory(args: unknown): Promise<MCPToolResult> {
    if (!this.serviceRegistry) {
      this.serviceRegistry = createSlackServiceRegistry();
    }
    return this.serviceRegistry.methods.getChannelHistory(args);
  }

  async searchMessages(args: unknown): Promise<MCPToolResult> {
    if (!this.serviceRegistry) {
      this.serviceRegistry = createSlackServiceRegistry();
    }
    return this.serviceRegistry.methods.searchMessages(args);
  }

  async getChannelInfo(args: unknown): Promise<MCPToolResult> {
    if (!this.serviceRegistry) {
      this.serviceRegistry = createSlackServiceRegistry();
    }
    return this.serviceRegistry.methods.getChannelInfo(args);
  }

  /**
   * Get information about a user
   */
  async getUserInfo(args: unknown): Promise<MCPToolResult> {
    if (!this.serviceRegistry) {
      this.serviceRegistry = createSlackServiceRegistry();
    }
    return this.serviceRegistry.methods.getUserInfo(args);
  }

  /**
   * List team members
   */
  async listTeamMembers(args: unknown): Promise<MCPToolResult> {
    if (!this.serviceRegistry) {
      this.serviceRegistry = createSlackServiceRegistry();
    }
    return this.serviceRegistry.methods.listTeamMembers(args);
  }

  /**
   * Get workspace activity report
   */
  async getWorkspaceActivity(args: unknown): Promise<MCPToolResult> {
    if (!this.serviceRegistry) {
      this.serviceRegistry = createSlackServiceRegistry();
    }
    return this.serviceRegistry.methods.getWorkspaceActivity(args);
  }

  /**
   * Get server health status
   */
  async getServerHealth(args: unknown): Promise<MCPToolResult> {
    if (!this.serviceRegistry) {
      this.serviceRegistry = createSlackServiceRegistry();
    }
    return this.serviceRegistry.methods.getServerHealth(args);
  }

  /**
   * List channels
   */
  async listChannels(args: unknown): Promise<MCPToolResult> {
    if (!this.serviceRegistry) {
      this.serviceRegistry = createSlackServiceRegistry();
    }
    return this.serviceRegistry.methods.listChannels(args);
  }

  /**
   * Get workspace info
   */
  async getWorkspaceInfo(args: unknown): Promise<MCPToolResult> {
    if (!this.serviceRegistry) {
      this.serviceRegistry = createSlackServiceRegistry();
    }
    return this.serviceRegistry.methods.getWorkspaceInfo(args);
  }

  // ================================
  // THREAD METHODS (14 TOTAL)
  // ================================

  /**
   * Find threads in channel
   */
  async findThreadsInChannel(args: unknown): Promise<MCPToolResult> {
    if (!this.serviceRegistry) {
      this.serviceRegistry = createSlackServiceRegistry();
    }
    return this.serviceRegistry.methods.findThreadsInChannel(args);
  }

  /**
   * Get thread replies
   */
  async getThreadReplies(args: unknown): Promise<MCPToolResult> {
    if (!this.serviceRegistry) {
      this.serviceRegistry = createSlackServiceRegistry();
    }
    return this.serviceRegistry.methods.getThreadReplies(args);
  }

  /**
   * Search threads
   */
  async searchThreads(args: unknown): Promise<MCPToolResult> {
    if (!this.serviceRegistry) {
      this.serviceRegistry = createSlackServiceRegistry();
    }
    return this.serviceRegistry.methods.searchThreads(args);
  }

  /**
   * Post thread reply
   */
  async postThreadReply(args: unknown): Promise<MCPToolResult> {
    if (!this.serviceRegistry) {
      this.serviceRegistry = createSlackServiceRegistry();
    }
    return this.serviceRegistry.methods.postThreadReply(args);
  }

  /**
   * Create thread
   */
  async createThread(args: unknown): Promise<MCPToolResult> {
    if (!this.serviceRegistry) {
      this.serviceRegistry = createSlackServiceRegistry();
    }
    return this.serviceRegistry.methods.createThread(args);
  }

  /**
   * Mark thread important
   */
  async markThreadImportant(args: unknown): Promise<MCPToolResult> {
    if (!this.serviceRegistry) {
      this.serviceRegistry = createSlackServiceRegistry();
    }
    return this.serviceRegistry.methods.markThreadImportant(args);
  }

  /**
   * Analyze thread
   */
  async analyzeThread(args: unknown): Promise<MCPToolResult> {
    if (!this.serviceRegistry) {
      this.serviceRegistry = createSlackServiceRegistry();
    }
    return this.serviceRegistry.methods.analyzeThread(args);
  }

  /**
   * Summarize thread
   */
  async summarizeThread(args: unknown): Promise<MCPToolResult> {
    if (!this.serviceRegistry) {
      this.serviceRegistry = createSlackServiceRegistry();
    }
    return this.serviceRegistry.methods.summarizeThread(args);
  }

  /**
   * Extract action items
   */
  async extractActionItems(args: unknown): Promise<MCPToolResult> {
    if (!this.serviceRegistry) {
      this.serviceRegistry = createSlackServiceRegistry();
    }
    return this.serviceRegistry.methods.extractActionItems(args);
  }

  /**
   * Identify important threads
   */
  async identifyImportantThreads(args: unknown): Promise<MCPToolResult> {
    if (!this.serviceRegistry) {
      this.serviceRegistry = createSlackServiceRegistry();
    }
    return this.serviceRegistry.methods.identifyImportantThreads(args);
  }

  /**
   * Export thread
   */
  async exportThread(args: unknown): Promise<MCPToolResult> {
    if (!this.serviceRegistry) {
      this.serviceRegistry = createSlackServiceRegistry();
    }
    return this.serviceRegistry.methods.exportThread(args);
  }

  /**
   * Find related threads
   */
  async findRelatedThreads(args: unknown): Promise<MCPToolResult> {
    if (!this.serviceRegistry) {
      this.serviceRegistry = createSlackServiceRegistry();
    }
    return this.serviceRegistry.methods.findRelatedThreads(args);
  }

  /**
   * Get thread metrics
   */
  async getThreadMetrics(args: unknown): Promise<MCPToolResult> {
    if (!this.serviceRegistry) {
      this.serviceRegistry = createSlackServiceRegistry();
    }
    return this.serviceRegistry.methods.getThreadMetrics(args);
  }

  /**
   * Get threads by participants
   */
  async getThreadsByParticipants(args: unknown): Promise<MCPToolResult> {
    if (!this.serviceRegistry) {
      this.serviceRegistry = createSlackServiceRegistry();
    }
    return this.serviceRegistry.methods.getThreadsByParticipants(args);
  }

  // ================================
  // FILE METHODS (7 TOTAL)
  // ================================

  /**
   * Upload file
   */
  async uploadFile(args: unknown): Promise<MCPToolResult> {
    if (!this.serviceRegistry) {
      this.serviceRegistry = createSlackServiceRegistry();
    }
    return this.serviceRegistry.methods.uploadFile(args);
  }

  /**
   * List files
   */
  async listFiles(args: unknown): Promise<MCPToolResult> {
    if (!this.serviceRegistry) {
      this.serviceRegistry = createSlackServiceRegistry();
    }
    return this.serviceRegistry.methods.listFiles(args);
  }

  /**
   * Get file info
   */
  async getFileInfo(args: unknown): Promise<MCPToolResult> {
    if (!this.serviceRegistry) {
      this.serviceRegistry = createSlackServiceRegistry();
    }
    return this.serviceRegistry.methods.getFileInfo(args);
  }

  /**
   * Delete file
   */
  async deleteFile(args: unknown): Promise<MCPToolResult> {
    if (!this.serviceRegistry) {
      this.serviceRegistry = createSlackServiceRegistry();
    }
    return this.serviceRegistry.methods.deleteFile(args);
  }

  /**
   * Share file
   */
  async shareFile(args: unknown): Promise<MCPToolResult> {
    if (!this.serviceRegistry) {
      this.serviceRegistry = createSlackServiceRegistry();
    }
    return this.serviceRegistry.methods.shareFile(args);
  }

  /**
   * Analyze files
   */
  async analyzeFiles(args: unknown): Promise<MCPToolResult> {
    if (!this.serviceRegistry) {
      this.serviceRegistry = createSlackServiceRegistry();
    }
    return this.serviceRegistry.methods.analyzeFiles(args);
  }

  /**
   * Search files
   */
  async searchFiles(args: unknown): Promise<MCPToolResult> {
    if (!this.serviceRegistry) {
      this.serviceRegistry = createSlackServiceRegistry();
    }
    return this.serviceRegistry.methods.searchFiles(args);
  }

  // ================================
  // REACTION METHODS (5 TOTAL)
  // ================================

  /**
   * Add reaction
   */
  async addReaction(args: unknown): Promise<MCPToolResult> {
    if (!this.serviceRegistry) {
      this.serviceRegistry = createSlackServiceRegistry();
    }
    return this.serviceRegistry.methods.addReaction(args);
  }

  /**
   * Remove reaction
   */
  async removeReaction(args: unknown): Promise<MCPToolResult> {
    if (!this.serviceRegistry) {
      this.serviceRegistry = createSlackServiceRegistry();
    }
    return this.serviceRegistry.methods.removeReaction(args);
  }

  /**
   * Get reactions
   */
  async getReactions(args: unknown): Promise<MCPToolResult> {
    if (!this.serviceRegistry) {
      this.serviceRegistry = createSlackServiceRegistry();
    }
    return this.serviceRegistry.methods.getReactions(args);
  }

  /**
   * Get reaction statistics
   */
  async getReactionStatistics(args: unknown): Promise<MCPToolResult> {
    if (!this.serviceRegistry) {
      this.serviceRegistry = createSlackServiceRegistry();
    }
    return this.serviceRegistry.methods.getReactionStatistics(args);
  }

  /**
   * Find messages by reactions
   */
  async findMessagesByReactions(args: unknown): Promise<MCPToolResult> {
    if (!this.serviceRegistry) {
      this.serviceRegistry = createSlackServiceRegistry();
    }
    return this.serviceRegistry.methods.findMessagesByReactions(args);
  }
}