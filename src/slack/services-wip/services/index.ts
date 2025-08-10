/**
 * Domain Services Layer
 * 
 * This module provides high-level business logic services that compose
 * infrastructure and analysis layers. Each service encapsulates domain
 * operations and provides a clean, typed interface.
 * 
 * Services are created via factory functions that accept infrastructure
 * dependencies, following the dependency injection pattern.
 */

// Message Services
export { createMessageService } from './messages/message-service.js';
export type { MessageService, MessageServiceDependencies, MessageServiceConfig } from './messages/types.js';

// Thread Services  
export { createThreadService } from './threads/thread-service.js';
export type { ThreadService, ThreadServiceDependencies, ThreadServiceConfig } from './threads/types.js';

// File Services
export { createFileService } from './files/file-service.js';
export type { FileService, FileServiceDependencies, FileServiceConfig } from './files/types.js';

// Reaction Services
export { createReactionService } from './reactions/reaction-service.js';
export type { ReactionService, ReactionServiceDependencies, ReactionServiceConfig } from './reactions/types.js';

// Workspace Services
export { createWorkspaceService } from './workspace/workspace-service.js';
export type { WorkspaceService, WorkspaceServiceDependencies, WorkspaceServiceConfig } from './workspace/types.js';

// Re-export infrastructure types for convenience
export type { InfrastructureServices } from '../infrastructure/factory.js';
import type { InfrastructureServices } from '../infrastructure/factory.js';
import { createMessageService } from './messages/message-service.js';
import { createThreadService } from './threads/thread-service.js';
import { createFileService } from './files/file-service.js';
import { createReactionService } from './reactions/reaction-service.js';
import { createWorkspaceService } from './workspace/workspace-service.js';
import type { MessageService } from './messages/types.js';
import type { ThreadService } from './threads/types.js';
import type { FileService } from './files/types.js';
import type { ReactionService } from './reactions/types.js';
import type { WorkspaceService } from './workspace/types.js';

/**
 * Complete domain services bundle
 */
export interface DomainServices {
  messageService: MessageService;
  threadService: ThreadService;
  fileService: FileService;
  reactionService: ReactionService;
  workspaceService: WorkspaceService;
}

/**
 * Create all domain services with infrastructure dependencies
 * @param infrastructure - Infrastructure services bundle
 * @returns Complete domain services bundle
 */
export const createDomainServices = (infrastructure: InfrastructureServices): DomainServices => {
  return {
    messageService: createMessageService(infrastructure),
    threadService: createThreadService(infrastructure),
    fileService: createFileService(infrastructure),
    reactionService: createReactionService(infrastructure),
    workspaceService: createWorkspaceService(infrastructure),
  };
};

/**
 * Service method registry for routing tool calls
 * Maps tool names to service methods across all domain services
 */
export interface ServiceMethodRegistry {
  // Message operations (6)
  send_message: (args: unknown) => Promise<any>;
  list_channels: (args: unknown) => Promise<any>;
  get_channel_history: (args: unknown) => Promise<any>;
  get_user_info: (args: unknown) => Promise<any>;
  search_messages: (args: unknown) => Promise<any>;
  get_channel_info: (args: unknown) => Promise<any>;

  // Thread operations (14)
  find_threads_in_channel: (args: unknown) => Promise<any>;
  get_thread_replies: (args: unknown) => Promise<any>;
  search_threads: (args: unknown) => Promise<any>;
  analyze_thread: (args: unknown) => Promise<any>;
  summarize_thread: (args: unknown) => Promise<any>;
  extract_action_items: (args: unknown) => Promise<any>;
  post_thread_reply: (args: unknown) => Promise<any>;
  create_thread: (args: unknown) => Promise<any>;
  mark_thread_important: (args: unknown) => Promise<any>;
  identify_important_threads: (args: unknown) => Promise<any>;
  export_thread: (args: unknown) => Promise<any>;
  find_related_threads: (args: unknown) => Promise<any>;
  get_thread_metrics: (args: unknown) => Promise<any>;
  get_threads_by_participants: (args: unknown) => Promise<any>;

  // File operations (7)
  upload_file: (args: unknown) => Promise<any>;
  list_files: (args: unknown) => Promise<any>;
  get_file_info: (args: unknown) => Promise<any>;
  delete_file: (args: unknown) => Promise<any>;
  share_file: (args: unknown) => Promise<any>;
  analyze_files: (args: unknown) => Promise<any>;
  search_files: (args: unknown) => Promise<any>;

  // Reaction operations (5)
  add_reaction: (args: unknown) => Promise<any>;
  remove_reaction: (args: unknown) => Promise<any>;
  get_reactions: (args: unknown) => Promise<any>;
  get_reaction_statistics: (args: unknown) => Promise<any>;
  find_messages_by_reactions: (args: unknown) => Promise<any>;

  // Workspace operations (4)
  get_workspace_info: (args: unknown) => Promise<any>;
  list_team_members: (args: unknown) => Promise<any>;
  get_workspace_activity: (args: unknown) => Promise<any>;
  get_server_health: (args: unknown) => Promise<any>;
}

/**
 * Create a method registry from domain services
 * @param services - Domain services bundle
 * @returns Registry mapping tool names to service methods
 */
export const createServiceMethodRegistry = (services: DomainServices): ServiceMethodRegistry => {
  return {
    // Message operations
    send_message: services.messageService.sendMessage,
    list_channels: services.messageService.listChannels,
    get_channel_history: services.messageService.getChannelHistory,
    get_user_info: services.messageService.getUserInfo,
    search_messages: services.messageService.searchMessages,
    get_channel_info: services.messageService.getChannelInfo,

    // Thread operations
    find_threads_in_channel: services.threadService.findThreadsInChannel,
    get_thread_replies: services.threadService.getThreadReplies,
    search_threads: services.threadService.searchThreads,
    analyze_thread: services.threadService.analyzeThread,
    summarize_thread: services.threadService.summarizeThread,
    extract_action_items: services.threadService.extractActionItems,
    post_thread_reply: services.threadService.postThreadReply,
    create_thread: services.threadService.createThread,
    mark_thread_important: services.threadService.markThreadImportant,
    identify_important_threads: services.threadService.identifyImportantThreads,
    export_thread: services.threadService.exportThread,
    find_related_threads: services.threadService.findRelatedThreads,
    get_thread_metrics: services.threadService.getThreadMetrics,
    get_threads_by_participants: services.threadService.getThreadsByParticipants,

    // File operations
    upload_file: services.fileService.uploadFile,
    list_files: services.fileService.listFiles,
    get_file_info: services.fileService.getFileInfo,
    delete_file: services.fileService.deleteFile,
    share_file: services.fileService.shareFile,
    analyze_files: services.fileService.analyzeFiles,
    search_files: services.fileService.searchFiles,

    // Reaction operations
    add_reaction: services.reactionService.addReaction,
    remove_reaction: services.reactionService.removeReaction,
    get_reactions: services.reactionService.getReactions,
    get_reaction_statistics: services.reactionService.getReactionStatistics,
    find_messages_by_reactions: services.reactionService.findMessagesByReactions,

    // Workspace operations
    get_workspace_info: services.workspaceService.getWorkspaceInfo,
    list_team_members: services.workspaceService.listTeamMembers,
    get_workspace_activity: services.workspaceService.getWorkspaceActivity,
    get_server_health: services.workspaceService.getServerHealth,
  };
};