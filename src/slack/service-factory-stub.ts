import { CONFIG } from '../config/index.js';
import type { MCPToolResult } from '../mcp/types.js';
import { createInfrastructureServices } from './infrastructure/factory.js';
import { createMessageService } from './services/messages/message-service.js';
import { createThreadService } from './services/threads/thread-service.js';
import { createFileService } from './services/files/file-service.js';
import { createReactionService } from './services/reactions/reaction-service.js';
import { createWorkspaceService } from './services/workspace/workspace-service.js';

/**
 * Configuration for the modular Slack service
 */
export interface ModularSlackConfig {
  // Feature flags for gradual rollout
  useModularArchitecture: boolean;
  enableModularMessages: boolean;
  enableModularThreads: boolean;
  enableModularFiles: boolean;
  enableModularReactions: boolean;
  enableModularWorkspace: boolean;

  // Performance monitoring
  enablePerformanceMetrics: boolean;
  monitorLegacyComparison: boolean;
}

/**
 * Method registry mapping method names to service implementations
 */
export interface ServiceMethodRegistry {
  // Message operations
  sendMessage: (args: unknown) => Promise<MCPToolResult>;
  listChannels: (args: unknown) => Promise<MCPToolResult>;
  getChannelHistory: (args: unknown) => Promise<MCPToolResult>;
  getUserInfo: (args: unknown) => Promise<MCPToolResult>;
  searchMessages: (args: unknown) => Promise<MCPToolResult>;
  getChannelInfo: (args: unknown) => Promise<MCPToolResult>;

  // Thread operations
  findThreadsInChannel: (args: unknown) => Promise<MCPToolResult>;
  getThreadReplies: (args: unknown) => Promise<MCPToolResult>;
  searchThreads: (args: unknown) => Promise<MCPToolResult>;
  analyzeThread: (args: unknown) => Promise<MCPToolResult>;
  summarizeThread: (args: unknown) => Promise<MCPToolResult>;
  extractActionItems: (args: unknown) => Promise<MCPToolResult>;
  postThreadReply: (args: unknown) => Promise<MCPToolResult>;
  createThread: (args: unknown) => Promise<MCPToolResult>;
  markThreadImportant: (args: unknown) => Promise<MCPToolResult>;
  identifyImportantThreads: (args: unknown) => Promise<MCPToolResult>;
  exportThread: (args: unknown) => Promise<MCPToolResult>;
  findRelatedThreads: (args: unknown) => Promise<MCPToolResult>;
  getThreadMetrics: (args: unknown) => Promise<MCPToolResult>;
  getThreadsByParticipants: (args: unknown) => Promise<MCPToolResult>;

  // File operations
  uploadFile: (args: unknown) => Promise<MCPToolResult>;
  listFiles: (args: unknown) => Promise<MCPToolResult>;
  getFileInfo: (args: unknown) => Promise<MCPToolResult>;
  deleteFile: (args: unknown) => Promise<MCPToolResult>;
  shareFile: (args: unknown) => Promise<MCPToolResult>;
  analyzeFiles: (args: unknown) => Promise<MCPToolResult>;
  searchFiles: (args: unknown) => Promise<MCPToolResult>;

  // Reaction operations
  addReaction: (args: unknown) => Promise<MCPToolResult>;
  removeReaction: (args: unknown) => Promise<MCPToolResult>;
  getReactions: (args: unknown) => Promise<MCPToolResult>;
  getReactionStatistics: (args: unknown) => Promise<MCPToolResult>;
  findMessagesByReactions: (args: unknown) => Promise<MCPToolResult>;

  // Workspace operations
  getWorkspaceInfo: (args: unknown) => Promise<MCPToolResult>;
  listTeamMembers: (args: unknown) => Promise<MCPToolResult>;
  getWorkspaceActivity: (args: unknown) => Promise<MCPToolResult>;
  getServerHealth: (args: unknown) => Promise<MCPToolResult>;
}

/**
 * Complete service registry
 */
export interface SlackServiceRegistry {
  methods: ServiceMethodRegistry;
  config: ModularSlackConfig;
}

/**
 * Parse modular configuration from CONFIG
 */
export function parseModularConfig(): ModularSlackConfig {
  return {
    // Feature flags for gradual rollout
    useModularArchitecture: CONFIG.USE_MODULAR_ARCHITECTURE,
    enableModularMessages: CONFIG.ENABLE_MODULAR_MESSAGES,
    enableModularThreads: CONFIG.ENABLE_MODULAR_THREADS,
    enableModularFiles: CONFIG.ENABLE_MODULAR_FILES,
    enableModularReactions: CONFIG.ENABLE_MODULAR_REACTIONS,
    enableModularWorkspace: CONFIG.ENABLE_MODULAR_WORKSPACE,

    // Performance monitoring
    enablePerformanceMetrics: CONFIG.ENABLE_PERFORMANCE_METRICS,
    monitorLegacyComparison: CONFIG.MONITOR_LEGACY_COMPARISON,
  };
}

/**
 * Create complete service registry with real implementations
 */
export function createSlackServiceRegistry(config?: ModularSlackConfig): SlackServiceRegistry {
  const finalConfig = config || parseModularConfig();

  // Create infrastructure configuration from global CONFIG
  const infrastructureConfig = {
    botToken: CONFIG.SLACK_BOT_TOKEN,
    userToken: CONFIG.SLACK_USER_TOKEN,
    useUserTokenForRead: CONFIG.USE_USER_TOKEN_FOR_READ,
    enableRateLimit: CONFIG.SLACK_ENABLE_RATE_LIMIT_RETRY,
    rateLimitRetries: CONFIG.SLACK_RATE_LIMIT_RETRIES,
    maxRequestConcurrency: CONFIG.SLACK_MAX_REQUEST_CONCURRENCY,
    rejectRateLimitedCalls: CONFIG.SLACK_REJECT_RATE_LIMITED_CALLS,
    logLevel: CONFIG.LOG_LEVEL,
  };

  // Create infrastructure services
  const infrastructure = createInfrastructureServices(infrastructureConfig);

  // Create domain services
  const messageService = createMessageService(infrastructure);
  const threadService = createThreadService(infrastructure);
  const fileService = createFileService(infrastructure);
  const reactionService = createReactionService(infrastructure);
  const workspaceService = createWorkspaceService(infrastructure);

  const methods: ServiceMethodRegistry = {
    // Message operations
    sendMessage: messageService.sendMessage,
    listChannels: messageService.listChannels,
    getChannelHistory: messageService.getChannelHistory,
    getUserInfo: messageService.getUserInfo,
    searchMessages: messageService.searchMessages,
    getChannelInfo: messageService.getChannelInfo,

    // Thread operations
    findThreadsInChannel: threadService.findThreadsInChannel,
    getThreadReplies: threadService.getThreadReplies,
    searchThreads: threadService.searchThreads,
    analyzeThread: threadService.analyzeThread,
    summarizeThread: threadService.summarizeThread,
    extractActionItems: threadService.extractActionItems,
    postThreadReply: threadService.postThreadReply,
    createThread: threadService.createThread,
    markThreadImportant: threadService.markThreadImportant,
    identifyImportantThreads: threadService.identifyImportantThreads,
    exportThread: threadService.exportThread,
    findRelatedThreads: threadService.findRelatedThreads,
    getThreadMetrics: threadService.getThreadMetrics,
    getThreadsByParticipants: threadService.getThreadsByParticipants,

    // File operations
    uploadFile: fileService.uploadFile,
    listFiles: fileService.listFiles,
    getFileInfo: fileService.getFileInfo,
    deleteFile: fileService.deleteFile,
    shareFile: fileService.shareFile,
    analyzeFiles: fileService.analyzeFiles,
    searchFiles: fileService.searchFiles,

    // Reaction operations
    addReaction: reactionService.addReaction,
    removeReaction: reactionService.removeReaction,
    getReactions: reactionService.getReactions,
    getReactionStatistics: reactionService.getReactionStatistics,
    findMessagesByReactions: reactionService.findMessagesByReactions,

    // Workspace operations
    getWorkspaceInfo: workspaceService.getWorkspaceInfo,
    listTeamMembers: workspaceService.listTeamMembers,
    getWorkspaceActivity: workspaceService.getWorkspaceActivity,
    getServerHealth: workspaceService.getServerHealth,
  };

  return {
    methods,
    config: finalConfig,
  };
}

/**
 * Performance metrics for monitoring legacy vs modular implementation
 */
export interface PerformanceMetrics {
  methodName: string;
  implementationType: 'legacy' | 'modular';
  executionTime: number;
  success: boolean;
  timestamp: Date;
  errorType?: string;
}

/**
 * Performance monitoring utility
 */
export class PerformanceMonitor {
  private metrics: PerformanceMetrics[] = [];
  private maxMetrics = 1000; // Keep last 1000 metrics

  /**
   * Record performance metrics for a method execution
   */
  record(metric: PerformanceMetrics): void {
    this.metrics.push(metric);

    // Keep only the most recent metrics
    if (this.metrics.length > this.maxMetrics) {
      this.metrics = this.metrics.slice(-this.maxMetrics);
    }
  }

  /**
   * Get performance statistics for comparison
   */
  getStats(methodName?: string): {
    legacy: { avgTime: number; successRate: number; count: number };
    modular: { avgTime: number; successRate: number; count: number };
  } {
    const filteredMetrics = methodName
      ? this.metrics.filter((m) => m.methodName === methodName)
      : this.metrics;

    const legacyMetrics = filteredMetrics.filter((m) => m.implementationType === 'legacy');
    const modularMetrics = filteredMetrics.filter((m) => m.implementationType === 'modular');

    const calculateStats = (metrics: PerformanceMetrics[]) => ({
      avgTime:
        metrics.length > 0
          ? metrics.reduce((sum, m) => sum + m.executionTime, 0) / metrics.length
          : 0,
      successRate:
        metrics.length > 0 ? metrics.filter((m) => m.success).length / metrics.length : 0,
      count: metrics.length,
    });

    return {
      legacy: calculateStats(legacyMetrics),
      modular: calculateStats(modularMetrics),
    };
  }

  /**
   * Clear all metrics
   */
  clear(): void {
    this.metrics = [];
  }

  /**
   * Export metrics for analysis
   */
  export(): PerformanceMetrics[] {
    return [...this.metrics];
  }
}
