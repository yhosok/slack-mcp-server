/**
 * Workspace service output types following Context7 TypeScript best practices
 * All types extend Record<string, any> for JSON serialization safety
 */

export interface WorkspaceInfoOutput extends Record<string, any> {
  team: {
    id: string;
    name: string;
    domain: string;
    email_domain?: string;
  };
  url: string;
  plan: string;
  memberCount: number;
}

export interface TeamMembersOutput extends Record<string, any> {
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
}

export interface WorkspaceActivityOutput extends Record<string, any> {
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
}

export interface ServerHealthOutput extends Record<string, any> {
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
}