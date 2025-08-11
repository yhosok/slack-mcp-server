import type { UsersListArguments } from '@slack/web-api';
import {
  GetWorkspaceInfoSchema,
  ListTeamMembersSchema,
  GetWorkspaceActivitySchema,
  GetServerHealthSchema,
} from '../../../utils/validation.js';
import type { WorkspaceService, WorkspaceServiceDependencies } from './types.js';

// Export types for external use
export type { WorkspaceService, WorkspaceServiceDependencies } from './types.js';
import { SlackAPIError } from '../../../utils/errors.js';
// Using basic formatting - formatters will be enhanced later

/**
 * Create workspace service with infrastructure dependencies
 * @param deps - Infrastructure dependencies
 * @returns Workspace service instance
 */
export const createWorkspaceService = (deps: WorkspaceServiceDependencies): WorkspaceService => {
  /**
   * Get workspace/team information and settings
   */
  const getWorkspaceInfo = (args: unknown) =>
    deps.requestHandler.handle(GetWorkspaceInfoSchema, args, async () => {
      const client = deps.clientManager.getClientForOperation('read');

      const result = await client.team.info();

      if (!result.team) {
        throw new SlackAPIError('Failed to retrieve workspace information');
      }

      return {
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
      };
    });

  /**
   * List all team members with their roles and status
   */
  const listTeamMembers = (args: unknown) =>
    deps.requestHandler.handle(ListTeamMembersSchema, args, async (input) => {
      const client = deps.clientManager.getClientForOperation('read');

      const listArgs: UsersListArguments = {
        limit: input.limit || 100,
        cursor: input.cursor,
        include_locale: true,
      };

      const result = await client.users.list(listArgs);

      if (!result.members) {
        throw new SlackAPIError('Failed to retrieve team members');
      }

      // Filter members based on input options
      let members = result.members;

      if (!input.include_deleted) {
        members = members.filter((member) => !member.deleted);
      }

      if (!input.include_bots) {
        members = members.filter((member) => !member.is_bot);
      }

      const processedMembers = members.map((member) => ({
        id: member.id,
        name: member.name,
        realName: member.real_name,
        displayName: member.profile?.display_name || member.real_name || member.name,
        email: member.profile?.email,
        title: member.profile?.title,
        isAdmin: member.is_admin,
        isOwner: member.is_owner,
        isPrimaryOwner: member.is_primary_owner,
        isRestricted: member.is_restricted,
        isUltraRestricted: member.is_ultra_restricted,
        isBot: member.is_bot,
        deleted: member.deleted,
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

      return {
        members: processedMembers,
        total: processedMembers.length,
        hasMore: result.response_metadata?.next_cursor ? true : false,
        cursor: result.response_metadata?.next_cursor,
        responseMetadata: result.response_metadata,
      };
    });

  /**
   * Generate comprehensive workspace activity report
   */
  const getWorkspaceActivity = (args: unknown) =>
    deps.requestHandler.handle(GetWorkspaceActivitySchema, args, async (input) => {
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
            userDetails.set(userId, userInfo);
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

      return {
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
      };
    });

  /**
   * Get MCP server health status and performance metrics
   */
  const getServerHealth = (args: unknown) =>
    deps.requestHandler.handle(GetServerHealthSchema, args, async (input) => {
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
      } catch (error) {
        connectivityStatus = 'error';
      }

      const health = {
        status:
          connectivityStatus === 'good' || connectivityStatus === 'fair' ? 'healthy' : 'unhealthy',
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

      return {
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
      };
    });

  return {
    getWorkspaceInfo,
    listTeamMembers,
    getWorkspaceActivity,
    getServerHealth,
  };
};
