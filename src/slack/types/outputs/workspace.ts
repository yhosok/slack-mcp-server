/**
 * Workspace service output types following TypeSafeAPI + ts-pattern TypeScript best practices
 * All types extend ServiceOutput (Record<string, any>) for TypeSafeAPI compliance
 */

import type { ServiceOutput, ServiceResult } from '../typesafe-api-patterns';
import type { RateLimitMetrics } from '../../infrastructure/client/rate-limit-service';

export interface WorkspaceInfoOutput extends ServiceOutput {
  id: string;
  name: string;
  domain: string;
  emailDomain?: string;
  icon?: {
    image34?: string;
    image44?: string;
    image68?: string;
    image88?: string;
    image102?: string;
    image132?: string;
    image230?: string;
  };
  enterpriseId?: string;
  enterpriseName?: string;
  [key: string]: unknown;
}

export interface TeamMembersOutput extends ServiceOutput {
  members: Array<{
    id: string;
    name: string;
    realName?: string;
    displayName: string;
    email?: string;
    title?: string;
    isAdmin: boolean;
    isOwner: boolean;
    isPrimaryOwner: boolean;
    isRestricted: boolean;
    isUltraRestricted: boolean;
    isBot: boolean;
    deleted: boolean;
    hasFiles: boolean;
    timezone?: string;
    timezoneLabel?: string;
    timezoneOffset?: number;
    profile: {
      image24?: string;
      image32?: string;
      image48?: string;
      image72?: string;
      image192?: string;
      image512?: string;
      statusText?: string;
      statusEmoji?: string;
      statusExpiration?: number;
      phone?: string;
      skype?: string;
    };
    updated?: number;
  }>;
  total: number;
  pageCount?: number;
  hasMore: boolean;
  cursor?: string;
  responseMetadata?: {
    next_cursor?: string;
  };
  [key: string]: unknown;
}

export interface WorkspaceActivityOutput extends ServiceOutput {
  period: {
    start: string;
    end: string;
    days: number;
  };
  summary: {
    totalMessages: number;
    totalChannels: number;
    activeChannels: number;
    averageMessagesPerDay: number;
  };
  channelActivity: Array<{
    id: string;
    name: string;
    messages: number;
    uniqueUsers: number;
    threads: number;
  }>;
  userActivity: Array<{
    id: string;
    messages: number;
    uniqueChannels: number;
    displayName: string;
  }>;
  trends: {
    daily: Array<{
      date: string;
      messages: number;
    }>;
    hourly: Array<{
      hour: number;
      messages: number;
    }>;
  };
  [key: string]: unknown;
}

export interface ServerHealthOutput extends ServiceOutput {
  status: 'healthy' | 'unhealthy';
  timestamp: string;
  uptime: number;
  connectivity: {
    status: string;
    lastSuccessfulCall: string | null;
  };
  clientStatus: {
    botTokenConfigured: boolean;
    userTokenConfigured: boolean;
    searchApiAvailable: boolean;
  };
  rateLimiting: {
    enabled: boolean;
    metrics: RateLimitMetrics;
  };
  memory: {
    usage: NodeJS.MemoryUsage;
    heapUsed: number;
    heapTotal: number;
  };
  system: {
    nodeVersion: string;
    platform: string;
    arch: string;
  };
  modular_architecture: {
    enabled: boolean;
    services: {
      messages: boolean;
      threads: boolean;
      files: boolean;
      reactions: boolean;
      workspace: boolean;
    };
    performanceMetrics: {
      enabled: boolean;
      monitoring: boolean;
      totalMetrics: number;
    };
  };
  formattedUptime: {
    days: number;
    hours: number;
    minutes: number;
  };
  recommendations: string[];
  [key: string]: unknown;
}

// Discriminated union result types for TypeSafeAPI compliance
export type WorkspaceInfoResult = ServiceResult<WorkspaceInfoOutput>;
export type TeamMembersResult = ServiceResult<TeamMembersOutput>;
export type WorkspaceActivityResult = ServiceResult<WorkspaceActivityOutput>;
export type ServerHealthResult = ServiceResult<ServerHealthOutput>;
