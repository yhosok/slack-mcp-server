import type { UsersListArguments } from '@slack/web-api';
import {
  GetWorkspaceInfoSchema,
  ListTeamMembersSchema,
  GetWorkspaceActivitySchema,
  GetServerHealthSchema,
  validateInput,
} from '../../../utils/validation.js';
import type { WorkspaceService, WorkspaceServiceDependencies } from './types.js';
import { executePagination } from '../../infrastructure/generic-pagination.js';
import {
  createServiceSuccess,
  createServiceError,
  enforceServiceOutput,
} from '../../types/typesafe-api-patterns.js';
import type {
  WorkspaceInfoResult,
  TeamMembersResult,
  WorkspaceActivityResult,
  ServerHealthResult,
  WorkspaceInfoOutput,
  TeamMembersOutput,
  WorkspaceActivityOutput,
  ServerHealthOutput,
} from '../../types/outputs/workspace.js';

// Export types for external use
export type { WorkspaceService, WorkspaceServiceDependencies } from './types.js';
import { SlackAPIError } from '../../../utils/errors.js';

/**
 * Slack API Member interface for users.list response
 * Based on @slack/web-api UsersListResponse.Member
 */
interface SlackMember {
  id?: string;
  name?: string;
  real_name?: string;
  deleted?: boolean;
  is_admin?: boolean;
  is_owner?: boolean;
  is_primary_owner?: boolean;
  is_restricted?: boolean;
  is_ultra_restricted?: boolean;
  is_bot?: boolean;
  tz?: string;
  tz_label?: string;
  tz_offset?: number;
  updated?: number;
  profile?: {
    display_name?: string;
    email?: string;
    title?: string;
    image_24?: string;
    image_32?: string;
    image_48?: string;
    image_72?: string;
    image_192?: string;
    image_512?: string;
    status_text?: string;
    status_emoji?: string;
    status_expiration?: number;
    phone?: string;
    skype?: string;
  };
}
/**
 * Create workspace service with infrastructure dependencies
 *
 * Factory function that creates a TypeSafeAPI-compliant workspace service with
 * full type safety, error handling, and integration with existing infrastructure.
 *
 * Features:
 * - Type-safe operations with discriminated union results
 * - Automatic input validation using Zod schemas
 * - Consistent error handling with ServiceResult patterns
 * - Integration with Slack Web API client management
 * - Comprehensive workspace analytics and reporting
 * - Real-time health monitoring and metrics collection
 *
 * @param deps - Infrastructure dependencies (client manager, rate limiter, user service, etc.)
 * @returns Workspace service instance with TypeSafeAPI + ts-pattern type safety
 *
 * @example Service Creation
 * ```typescript
 * const workspaceService = createWorkspaceService({
 *   clientManager,
 *   rateLimitService,
 *   userService
 * });
 *
 * const result = await workspaceService.getWorkspaceInfo({});
 *
 * match(result)
 *   .with({ success: true }, (success) => console.log('Workspace:', success.data))
 *   .with({ success: false }, (error) => console.error('Failed:', error.error))
 *   .exhaustive();
 * ```
 */
export const createWorkspaceService = (deps: WorkspaceServiceDependencies): WorkspaceService => {
  /**
   * Get workspace/team information and settings with TypeSafeAPI + ts-pattern type safety
   *
   * Retrieves comprehensive workspace information including team details, configuration,
   * and enterprise settings. Uses read-operation client for optimal token usage.
   *
   * @param args - Unknown input (validated at runtime using GetWorkspaceInfoSchema)
   * @returns ServiceResult with workspace information or error details
   *
   * @example Basic Usage
   * ```typescript
   * const result = await getWorkspaceInfo({});
   *
   * match(result)
   *   .with({ success: true }, (r) => {
   *     console.log('Workspace:', r.data.name);
   *     console.log('Domain:', r.data.domain);
   *   })
   *   .with({ success: false }, (r) => {
   *     console.error('Error:', r.error);
   *   })
   *   .exhaustive();
   * ```
   *
   * @example With Pattern Matching
   * ```typescript
   * const result = await getWorkspaceInfo({});
   *
   * if (result.success) {
   *   // TypeScript knows result.data is WorkspaceInfoOutput
   *   const workspace = result.data;
   *   console.log(`${workspace.name} (${workspace.domain})`);
   * } else {
   *   // TypeScript knows result.error is string
   *   console.error('Failed to get workspace info:', result.error);
   * }
   * ```
   */
  const getWorkspaceInfo = async (args: unknown): Promise<WorkspaceInfoResult> => {
    try {
      // Validate input using TypeSafeAPI validation pattern
      const _input = validateInput(GetWorkspaceInfoSchema, args);

      const client = deps.clientManager.getClientForOperation('read');

      const result = await client.team.info();

      if (!result.team) {
        return createServiceError(
          'No team information available',
          'Failed to retrieve workspace information'
        );
      }

      if (!result.team.id || !result.team.name || !result.team.domain) {
        return createServiceError(
          'Incomplete team information received',
          'Failed to retrieve workspace information'
        );
      }

      const outputData: WorkspaceInfoOutput = enforceServiceOutput({
        id: result.team.id,
        name: result.team.name,
        domain: result.team.domain,
        emailDomain: result.team.email_domain,
        icon: {
          image34: result.team.icon?.image_34,
          image44: result.team.icon?.image_44,
          image68: result.team.icon?.image_68,
          image88: result.team.icon?.image_88,
          image102: result.team.icon?.image_102,
          image132: result.team.icon?.image_132,
          image230: result.team.icon?.image_230,
        },
        enterpriseId: result.team.enterprise_id,
        enterpriseName: result.team.enterprise_name,
      });

      return createServiceSuccess(outputData, 'Workspace information retrieved successfully');
    } catch (error) {
      return createServiceError(
        error instanceof Error ? error.message : 'Unknown error',
        'Failed to retrieve workspace information'
      );
    }
  };

  /**
   * List all team members with their roles and status with TypeSafeAPI + ts-pattern type safety
   *
   * Retrieves comprehensive team member information with support for pagination,
   * filtering, and detailed profile data. Supports both bot and deleted user filtering.
   *
   * @param args - Unknown input (validated at runtime using ListTeamMembersSchema)
   * @returns ServiceResult with team members list or error details
   *
   * @example Basic Team Members List
   * ```typescript
   * const result = await listTeamMembers({
   *   limit: 50,
   *   include_bots: false,
   *   include_deleted: false
   * });
   *
   * match(result)
   *   .with({ success: true }, (r) => {
   *     console.log(`Found ${r.data.total} members`);
   *     r.data.members.forEach(member => {
   *       console.log(`${member.displayName} (${member.email})`);
   *     });
   *   })
   *   .with({ success: false }, (r) => {
   *     console.error('Failed to get members:', r.error);
   *   })
   *   .exhaustive();
   * ```
   *
   * @example With Pagination
   * ```typescript
   * const result = await listTeamMembers({
   *   fetch_all_pages: true,
   *   max_pages: 10,
   *   max_items: 1000,
   *   include_bots: true
   * });
   *
   * if (result.success) {
   *   // TypeScript knows result.data is TeamMembersOutput
   *   const { members, total, hasMore } = result.data;
   *   console.log(`Retrieved ${members.length} of ${total} members`);
   * }
   * ```
   */
  const listTeamMembers = async (args: unknown): Promise<TeamMembersResult> => {
    try {
      // Validate input using TypeSafeAPI validation pattern
      const input = validateInput(ListTeamMembersSchema, args);

      const client = deps.clientManager.getClientForOperation('read');

      // Use unified pagination implementation
      const paginationResult = await executePagination(input, {
        fetchPage: async (cursor?: string) => {
          const listArgs: UsersListArguments = {
            limit: input.limit || 100,
            cursor,
            include_locale: true,
          };

          const result = await client.users.list(listArgs);

          if (!result.members) {
            throw new SlackAPIError(
              `Failed to retrieve team members${cursor ? ` (page with cursor: ${cursor.substring(0, 10)}...)` : ''}`
            );
          }

          return result;
        },

        getCursor: (response) => response.response_metadata?.next_cursor,

        getItems: (response) => response.members || [],

        formatResponse: (data) => {
          // Filter members based on input options
          let filteredMembers = data.items;

          if (!input.include_deleted) {
            filteredMembers = filteredMembers.filter((member: SlackMember) => !member.deleted);
          }

          if (!input.include_bots) {
            filteredMembers = filteredMembers.filter((member: SlackMember) => !member.is_bot);
          }

          // Filter out members without required fields
          filteredMembers = filteredMembers.filter((member: SlackMember) => member.id && member.name);

          const processedMembers = filteredMembers.map((member: SlackMember) => ({
            id: member.id!,
            name: member.name!,
            realName: member.real_name,
            displayName: member.profile?.display_name || member.real_name || member.name!,
            email: member.profile?.email,
            title: member.profile?.title,
            isAdmin: member.is_admin || false,
            isOwner: member.is_owner || false,
            isPrimaryOwner: member.is_primary_owner || false,
            isRestricted: member.is_restricted || false,
            isUltraRestricted: member.is_ultra_restricted || false,
            isBot: member.is_bot || false,
            deleted: member.deleted || false,
            hasFiles: false, // Property not available in API
            timezone: member.tz,
            timezoneLabel: member.tz_label,
            timezoneOffset: member.tz_offset,
            profile: {
              image24: member.profile?.image_24,
              image32: member.profile?.image_32,
              image48: member.profile?.image_48,
              image72: member.profile?.image_72,
              image192: member.profile?.image_192,
              image512: member.profile?.image_512,
              statusText: member.profile?.status_text,
              statusEmoji: member.profile?.status_emoji,
              statusExpiration: member.profile?.status_expiration,
              phone: member.profile?.phone,
              skype: member.profile?.skype,
            },
            updated: member.updated,
          }));

          // Create TypeSafeAPI-compliant output
          const output: TeamMembersOutput = enforceServiceOutput({
            members: processedMembers,
            total: processedMembers.length,
            pageCount: data.pageCount,
            hasMore: data.hasMore,
            cursor: data.cursor,
            responseMetadata: data.hasMore ? { next_cursor: data.cursor } : undefined,
          });

          return output;
        },
      });

      return createServiceSuccess(
        paginationResult as TeamMembersOutput,
        'Team members retrieved successfully'
      );
    } catch (error) {
      return createServiceError(
        error instanceof Error ? error.message : 'Unknown error',
        'Failed to retrieve team members'
      );
    }
  };

  /**
   * Generate comprehensive workspace activity report with TypeSafeAPI + ts-pattern type safety
   *
   * Analyzes workspace activity across channels, users, and time periods with detailed
   * metrics, trends, and insights. Supports customizable date ranges and analytics depth.
   *
   * @param args - Unknown input (validated at runtime using GetWorkspaceActivitySchema)
   * @returns ServiceResult with activity report or error details
   *
   * @example Basic Activity Report
   * ```typescript
   * const result = await getWorkspaceActivity({
   *   start_date: '2024-01-01',
   *   end_date: '2024-01-31',
   *   include_user_details: true,
   *   include_channel_details: true
   * });
   *
   * match(result)
   *   .with({ success: true }, (r) => {
   *     const { summary, channelActivity, userActivity } = r.data;
   *     console.log(`Total messages: ${summary.totalMessages}`);
   *     console.log(`Active channels: ${summary.activeChannels}`);
   *     console.log(`Top channel: ${channelActivity[0]?.name}`);
   *   })
   *   .with({ success: false }, (r) => {
   *     console.error('Failed to generate report:', r.error);
   *   })
   *   .exhaustive();
   * ```
   *
   * @example With Trend Analysis
   * ```typescript
   * const result = await getWorkspaceActivity({
   *   top_count: 15,
   *   include_user_details: true
   * });
   *
   * if (result.success) {
   *   // TypeScript knows result.data is WorkspaceActivityOutput
   *   const { trends, period } = result.data;
   *   console.log(`Report for ${period.days} days`);
   *
   *   trends.daily.forEach(day => {
   *     console.log(`${day.date}: ${day.messages} messages`);
   *   });
   * }
   * ```
   */
  const getWorkspaceActivity = async (args: unknown): Promise<WorkspaceActivityResult> => {
    try {
      // Validate input using TypeSafeAPI validation pattern
      const input = validateInput(GetWorkspaceActivitySchema, args);
      const client = deps.clientManager.getClientForOperation('read');

      // Calculate time range
      const now = new Date();
      const startDate = input.start_date
        ? new Date(input.start_date)
        : new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      const endDate = input.end_date ? new Date(input.end_date) : now;

      const oldestTs = Math.floor(startDate.getTime() / 1000).toString();
      const latestTs = Math.floor(endDate.getTime() / 1000).toString();

      // Get list of channels
      const channelsResult = await client.conversations.list({
        exclude_archived: true,
        limit: 100,
      });

      if (!channelsResult.channels) {
        throw new SlackAPIError('Failed to retrieve channels for activity report');
      }

      const activity = {
        period: {
          start: startDate.toISOString(),
          end: endDate.toISOString(),
          days: Math.ceil((endDate.getTime() - startDate.getTime()) / (24 * 60 * 60 * 1000)),
        },
        totalMessages: 0,
        totalChannels: 0,
        activeChannels: 0,
        channelActivity: new Map<
          string,
          {
            name: string;
            messages: number;
            users: Set<string>;
            threads: number;
          }
        >(),
        userActivity: new Map<
          string,
          {
            messages: number;
            channels: Set<string>;
          }
        >(),
        dailyActivity: new Map<string, number>(),
        hourlyActivity: new Map<number, number>(),
      };

      // Analyze activity for each channel
      const channels = channelsResult.channels.slice(0, input.include_channel_details ? 50 : 20);
      activity.totalChannels = channels.length;

      for (const channel of channels) {
        if (!channel.id || !channel.name) continue;

        try {
          const historyResult = await client.conversations.history({
            channel: channel.id,
            oldest: oldestTs,
            latest: latestTs,
            limit: 1000,
          });

          if (historyResult.messages && historyResult.messages.length > 0) {
            activity.activeChannels++;

            const channelStats = {
              name: channel.name,
              messages: historyResult.messages.length,
              users: new Set<string>(),
              threads: 0,
            };

            for (const message of historyResult.messages) {
              activity.totalMessages++;

              // Track user activity
              if (message.user) {
                channelStats.users.add(message.user);

                const userStats = activity.userActivity.get(message.user) || {
                  messages: 0,
                  channels: new Set<string>(),
                };
                userStats.messages++;
                userStats.channels.add(channel.id);
                activity.userActivity.set(message.user, userStats);
              }

              // Track threads
              if (message.reply_count && message.reply_count > 0) {
                channelStats.threads++;
              }

              // Track daily activity
              if (message.ts) {
                const date = new Date(parseFloat(message.ts || '0') * 1000);
                const dateStr = date.toISOString().split('T')[0];
                const currentDaily = activity.dailyActivity.get(dateStr || '') || 0;
                activity.dailyActivity.set(dateStr || '', currentDaily + 1);

                // Track hourly activity
                const hour = date.getHours();
                const currentHourly = activity.hourlyActivity.get(hour) || 0;
                activity.hourlyActivity.set(hour, currentHourly + 1);
              }
            }

            activity.channelActivity.set(channel.id, channelStats);
          }
        } catch {
          // Skip channels we can't access
        }
      }

      // Get user details if requested
      const userDetails = new Map<string, { displayName: string }>();
      if (input.include_user_details) {
        const topUsers = Array.from(activity.userActivity.entries())
          .sort((a, b) => b[1].messages - a[1].messages)
          .slice(0, input.top_count || 10);

        for (const [userId] of topUsers) {
          try {
            const userInfo = await deps.userService.getUserInfo(userId);
            userDetails.set(userId, {
              displayName:
                userInfo.profile?.display_name ||
                userInfo.real_name ||
                userInfo.name ||
                userInfo.id,
            });
          } catch {
            // Skip users we can't look up
          }
        }
      }

      // Convert Maps to arrays for JSON serialization
      const channelActivity = Array.from(activity.channelActivity.entries()).map(([id, stats]) => ({
        id,
        name: stats.name,
        messages: stats.messages,
        uniqueUsers: stats.users.size,
        threads: stats.threads,
      }));

      const userActivity = Array.from(activity.userActivity.entries()).map(([id, stats]) => ({
        id,
        messages: stats.messages,
        uniqueChannels: stats.channels.size,
        displayName: userDetails.get(id)?.displayName || id,
      }));

      const dailyActivity = Array.from(activity.dailyActivity.entries()).map(([date, count]) => ({
        date,
        messages: count,
      }));

      const hourlyActivity = Array.from(activity.hourlyActivity.entries()).map(([hour, count]) => ({
        hour,
        messages: count,
      }));

      const outputData: WorkspaceActivityOutput = enforceServiceOutput({
        period: activity.period,
        summary: {
          totalMessages: activity.totalMessages,
          totalChannels: activity.totalChannels,
          activeChannels: activity.activeChannels,
          averageMessagesPerDay:
            activity.period.days > 0
              ? Math.round(activity.totalMessages / activity.period.days)
              : 0,
        },
        channelActivity:
          input.include_channel_details !== false
            ? channelActivity
                .sort((a, b) => b.messages - a.messages)
                .slice(0, input.top_count || 10)
            : [],
        userActivity:
          input.include_user_details !== false
            ? userActivity.sort((a, b) => b.messages - a.messages).slice(0, input.top_count || 10)
            : [],
        trends: {
          daily: dailyActivity.sort((a, b) => a.date.localeCompare(b.date)),
          hourly: hourlyActivity.sort((a, b) => a.hour - b.hour),
        },
      });

      return createServiceSuccess(outputData, 'Workspace activity report generated successfully');
    } catch (error) {
      return createServiceError(
        error instanceof Error ? error.message : 'Unknown error',
        'Failed to generate workspace activity report'
      );
    }
  };

  /**
   * Get MCP server health status and performance metrics with TypeSafeAPI + ts-pattern type safety
   *
   * Performs comprehensive health check including connectivity tests, memory usage,
   * rate limiting metrics, and infrastructure status. Essential for monitoring and diagnostics.
   *
   * @param args - Unknown input (validated at runtime using GetServerHealthSchema)
   * @returns ServiceResult with health status and metrics or error details
   *
   * @example Basic Health Check
   * ```typescript
   * const result = await getServerHealth({
   *   include_rate_limits: true,
   *   include_response_times: true
   * });
   *
   * match(result)
   *   .with({ success: true }, (r) => {
   *     const { status, connectivity, memory, rateLimiting } = r.data;
   *     console.log(`Server status: ${status}`);
   *     console.log(`Connectivity: ${connectivity.status}`);
   *     console.log(`Memory usage: ${memory.heapUsed}MB`);
   *     console.log(`Rate limits: ${rateLimiting.metrics.rateLimitedRequests}`);
   *   })
   *   .with({ success: false }, (r) => {
   *     console.error('Health check failed:', r.error);
   *   })
   *   .exhaustive();
   * ```
   *
   * @example Conditional Health Monitoring
   * ```typescript
   * const result = await getServerHealth({});
   *
   * if (result.success) {
   *   // TypeScript knows result.data is ServerHealthOutput
   *   const health = result.data;
   *
   *   if (health.status === 'unhealthy') {
   *     console.warn('Server health issues detected');
   *     health.recommendations.forEach(rec => console.log(`- ${rec}`));
   *   }
   *
   *   if (health.memory.heapUsed > health.memory.heapTotal * 0.8) {
   *     console.warn('High memory usage detected');
   *   }
   * }
   * ```
   */
  const getServerHealth = async (args: unknown): Promise<ServerHealthResult> => {
    try {
      // Validate input using TypeSafeAPI validation pattern
      const _input = validateInput(GetServerHealthSchema, args);
      // Get rate limiting metrics from the infrastructure
      const rateLimitMetrics = deps.rateLimitService.getMetrics();

      // Get client manager status
      const clientStatus = {
        botTokenConfigured: !!deps.clientManager,
        userTokenConfigured: deps.clientManager.checkSearchApiAvailability !== undefined,
        searchApiAvailable: false,
      };

      try {
        deps.clientManager.checkSearchApiAvailability('search', 'Search functionality limited');
        clientStatus.searchApiAvailable = true;
      } catch {
        clientStatus.searchApiAvailable = false;
      }

      // Test basic connectivity
      let connectivityStatus = 'unknown';
      let lastApiCall: Date | null = null;

      try {
        const client = deps.clientManager.getClientForOperation('read');
        const start = Date.now();
        await client.auth.test();
        const responseTime = Date.now() - start;
        connectivityStatus = responseTime < 1000 ? 'good' : responseTime < 3000 ? 'fair' : 'slow';
        lastApiCall = new Date();
      } catch {
        connectivityStatus = 'error';
      }

      const health = {
        status: (connectivityStatus === 'good' || connectivityStatus === 'fair'
          ? 'healthy'
          : 'unhealthy') as 'healthy' | 'unhealthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        connectivity: {
          status: connectivityStatus,
          lastSuccessfulCall: lastApiCall?.toISOString() || null,
        },
        clientStatus,
        rateLimiting: {
          enabled: true,
          metrics: rateLimitMetrics,
        },
        memory: {
          usage: process.memoryUsage(),
          heapUsed: Math.round((process.memoryUsage().heapUsed / 1024 / 1024) * 100) / 100, // MB
          heapTotal: Math.round((process.memoryUsage().heapTotal / 1024 / 1024) * 100) / 100, // MB
        },
        system: {
          nodeVersion: process.version,
          platform: process.platform,
          arch: process.arch,
        },
        modular_architecture: {
          enabled: true,
          services: {
            messages: true,
            threads: true,
            files: true,
            reactions: true,
            workspace: true,
          },
          performanceMetrics: {
            enabled: false,
            monitoring: false,
            totalMetrics: 0,
          },
        },
      };

      const outputData: ServerHealthOutput = enforceServiceOutput({
        ...health,
        formattedUptime: {
          days: Math.floor(health.uptime / (24 * 60 * 60)),
          hours: Math.floor((health.uptime % (24 * 60 * 60)) / (60 * 60)),
          minutes: Math.floor((health.uptime % (60 * 60)) / 60),
        },
        recommendations: [
          ...(health.status === 'unhealthy' ? ['Check network connectivity to Slack API'] : []),
          ...(health.memory.heapUsed > health.memory.heapTotal * 0.8
            ? ['Consider increasing memory allocation']
            : []),
          ...(health.rateLimiting.metrics.rateLimitedRequests > 10
            ? ['Review rate limiting configuration']
            : []),
        ],
      });

      return createServiceSuccess(outputData, 'Server health status retrieved successfully');
    } catch (error) {
      return createServiceError(
        error instanceof Error ? error.message : 'Unknown error',
        'Failed to retrieve server health status'
      );
    }
  };

  return {
    getWorkspaceInfo,
    listTeamMembers,
    getWorkspaceActivity,
    getServerHealth,
  };
};
