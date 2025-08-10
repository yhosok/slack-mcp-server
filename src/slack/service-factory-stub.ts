import { CONFIG } from '../config/index.js';

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
  sendMessage: (args: unknown) => Promise<any>;
  listChannels: (args: unknown) => Promise<any>;
  getChannelHistory: (args: unknown) => Promise<any>;
  getUserInfo: (args: unknown) => Promise<any>;
  searchMessages: (args: unknown) => Promise<any>;
  getChannelInfo: (args: unknown) => Promise<any>;

  // Thread operations
  findThreadsInChannel: (args: unknown) => Promise<any>;
  getThreadReplies: (args: unknown) => Promise<any>;
  searchThreads: (args: unknown) => Promise<any>;
  analyzeThread: (args: unknown) => Promise<any>;
  summarizeThread: (args: unknown) => Promise<any>;
  extractActionItems: (args: unknown) => Promise<any>;
  postThreadReply: (args: unknown) => Promise<any>;
  createThread: (args: unknown) => Promise<any>;
  markThreadImportant: (args: unknown) => Promise<any>;
  identifyImportantThreads: (args: unknown) => Promise<any>;
  exportThread: (args: unknown) => Promise<any>;
  findRelatedThreads: (args: unknown) => Promise<any>;
  getThreadMetrics: (args: unknown) => Promise<any>;
  getThreadsByParticipants: (args: unknown) => Promise<any>;

  // File operations
  uploadFile: (args: unknown) => Promise<any>;
  listFiles: (args: unknown) => Promise<any>;
  getFileInfo: (args: unknown) => Promise<any>;
  deleteFile: (args: unknown) => Promise<any>;
  shareFile: (args: unknown) => Promise<any>;
  analyzeFiles: (args: unknown) => Promise<any>;
  searchFiles: (args: unknown) => Promise<any>;

  // Reaction operations
  addReaction: (args: unknown) => Promise<any>;
  removeReaction: (args: unknown) => Promise<any>;
  getReactions: (args: unknown) => Promise<any>;
  getReactionStatistics: (args: unknown) => Promise<any>;
  findMessagesByReactions: (args: unknown) => Promise<any>;

  // Workspace operations
  getWorkspaceInfo: (args: unknown) => Promise<any>;
  listTeamMembers: (args: unknown) => Promise<any>;
  getWorkspaceActivity: (args: unknown) => Promise<any>;
  getServerHealth: (args: unknown) => Promise<any>;
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
 * Create stub service registry (Phase 4 - for integration purposes)
 * This allows the routing system to work while the modular services are being finalized
 */
export function createSlackServiceRegistry(config?: ModularSlackConfig): SlackServiceRegistry {
  const finalConfig = config || parseModularConfig();
  
  // Create stub methods that throw "not implemented" errors
  // This allows the routing system to work but falls back to legacy
  const stubMethod = (methodName: string) => async (args: unknown) => {
    throw new Error(`Modular implementation for ${methodName} not yet available. Using legacy implementation.`);
  };

  const methods: ServiceMethodRegistry = {
    // Message operations
    sendMessage: stubMethod('sendMessage'),
    listChannels: stubMethod('listChannels'),
    getChannelHistory: stubMethod('getChannelHistory'),
    getUserInfo: stubMethod('getUserInfo'),
    searchMessages: stubMethod('searchMessages'),
    getChannelInfo: stubMethod('getChannelInfo'),

    // Thread operations
    findThreadsInChannel: stubMethod('findThreadsInChannel'),
    getThreadReplies: stubMethod('getThreadReplies'),
    searchThreads: stubMethod('searchThreads'),
    analyzeThread: stubMethod('analyzeThread'),
    summarizeThread: stubMethod('summarizeThread'),
    extractActionItems: stubMethod('extractActionItems'),
    postThreadReply: stubMethod('postThreadReply'),
    createThread: stubMethod('createThread'),
    markThreadImportant: stubMethod('markThreadImportant'),
    identifyImportantThreads: stubMethod('identifyImportantThreads'),
    exportThread: stubMethod('exportThread'),
    findRelatedThreads: stubMethod('findRelatedThreads'),
    getThreadMetrics: stubMethod('getThreadMetrics'),
    getThreadsByParticipants: stubMethod('getThreadsByParticipants'),

    // File operations
    uploadFile: stubMethod('uploadFile'),
    listFiles: stubMethod('listFiles'),
    getFileInfo: stubMethod('getFileInfo'),
    deleteFile: stubMethod('deleteFile'),
    shareFile: stubMethod('shareFile'),
    analyzeFiles: stubMethod('analyzeFiles'),
    searchFiles: stubMethod('searchFiles'),

    // Reaction operations
    addReaction: stubMethod('addReaction'),
    removeReaction: stubMethod('removeReaction'),
    getReactions: stubMethod('getReactions'),
    getReactionStatistics: stubMethod('getReactionStatistics'),
    findMessagesByReactions: stubMethod('findMessagesByReactions'),

    // Workspace operations
    getWorkspaceInfo: stubMethod('getWorkspaceInfo'),
    listTeamMembers: stubMethod('listTeamMembers'),
    getWorkspaceActivity: stubMethod('getWorkspaceActivity'),
    getServerHealth: stubMethod('getServerHealth'),
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
      ? this.metrics.filter(m => m.methodName === methodName)
      : this.metrics;

    const legacyMetrics = filteredMetrics.filter(m => m.implementationType === 'legacy');
    const modularMetrics = filteredMetrics.filter(m => m.implementationType === 'modular');

    const calculateStats = (metrics: PerformanceMetrics[]) => ({
      avgTime: metrics.length > 0 
        ? metrics.reduce((sum, m) => sum + m.executionTime, 0) / metrics.length 
        : 0,
      successRate: metrics.length > 0 
        ? metrics.filter(m => m.success).length / metrics.length 
        : 0,
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