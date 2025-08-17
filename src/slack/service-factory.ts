import { CONFIG } from '../config/index.js';
import type { MCPToolResult } from '../mcp/types.js';
import { createInfrastructureServices } from './infrastructure/factory.js';
import { createMessageServiceMCPAdapter } from './services/messages/message-service-mcp-adapter.js';
import { createThreadServiceMCPAdapter } from './services/threads/thread-service-mcp-adapter.js';
import { createFileServiceMCPAdapter } from './services/files/file-service-mcp-adapter.js';
import { createReactionService } from './services/reactions/reaction-service.js';
import { createWorkspaceServiceMCPAdapter } from './services/workspace/workspace-service-mcp-adapter.js';

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
}

/**
 * Create complete service registry with real implementations
 */
export function createSlackServiceRegistry(): SlackServiceRegistry {
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
  const messageService = createMessageServiceMCPAdapter(infrastructure);
  const threadService = createThreadServiceMCPAdapter(infrastructure);
  const fileService = createFileServiceMCPAdapter(infrastructure);
  const reactionService = createReactionService(infrastructure);
  const workspaceService = createWorkspaceServiceMCPAdapter(infrastructure);

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
  };
}
