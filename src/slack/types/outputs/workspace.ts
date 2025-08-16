/**
 * Workspace service output types following TypeSafeAPI TypeScript best practices
 * All types extend ServiceOutput for JSON serialization safety
 */

import type { ServiceOutput } from '../typesafe-api-patterns';

export interface WorkspaceInfoOutput extends ServiceOutput {
  team: {
    id: string;
    name: string;
    domain: string;
    email_domain?: string;
  };
  url: string;
  plan: string;
  memberCount: number;
  [key: string]: unknown;

}

export interface TeamMembersOutput extends ServiceOutput {
  members: Array<{
    id: string;
    name: string;
    real_name: string;
    email?: string;
    is_admin: boolean;
    is_bot: boolean;
    is_deleted: boolean;
    profile: {
      display_name: string;
      image_24: string;
    };
  }>;
  total: number;
  hasMore: boolean;
  [key: string]: unknown;

}

export interface WorkspaceActivityOutput extends ServiceOutput {
  summary: {
    totalMessages: number;
    totalChannels: number;
    activeUsers: number;
    timeRange: string;
  };
  topChannels: Array<{
    id: string;
    name: string;
    messageCount: number;
  }>;
  topUsers: Array<{
    id: string;
    name: string;
    messageCount: number;
  }>;
  dailyActivity: Array<{
    date: string;
    messageCount: number;
  }>;
  [key: string]: unknown;

}

export interface ServerHealthOutput extends ServiceOutput {
  status: 'healthy' | 'warning' | 'error';
  rateLimits: {
    tier1: { remaining: number; resetTime?: string };
    tier2: { remaining: number; resetTime?: string };
    tier3: { remaining: number; resetTime?: string };
    tier4: { remaining: number; resetTime?: string };
  };
  metrics: {
    totalRequests: number;
    rateLimitHits: number;
    averageResponseTime: number;
    errorRate: number;
  };
  uptime: string;
  version: string;
  [key: string]: unknown;

}