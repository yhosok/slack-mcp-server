import type { InfrastructureServices } from '../../infrastructure/factory.js';
import type { MCPToolResult } from '../../../mcp/types.js';
import type {
  ThreadDiscoveryResult,
  ThreadRepliesResult,
  ThreadSearchResult,
  ThreadAnalysisResult,
  ThreadSummaryResult,
  ActionItemsResult,
  ThreadReplyResult,
  CreateThreadResult,
  MarkImportantResult,
  ImportantThreadsResult,
  ThreadExportResult,
  RelatedThreadsResult,
  ThreadMetricsResult,
  ThreadsByParticipantsResult,
} from '../../types/outputs/threads.js';
import type { UserService } from '../users/types.js';
import type { ParticipantTransformationService } from './participant-transformation-service.js';

/**
 * Dependencies for thread service operations
 * Enhanced with consolidated user service (eliminates duplication)
 */
export interface ThreadServiceDependencies extends InfrastructureServices {
  /**
   * Consolidated user service - supports both lightweight utilities and TypeSafeAPI operations
   * Provides: Display name resolution, bulk operations, caching, complete user information
   * Eliminates the need for separate infrastructure and domain user services
   */
  infrastructureUserService: UserService;

  /**
   * Consolidated user service (same as infrastructureUserService)
   * Maintained for backward compatibility during transition period
   * TODO: Remove this after updating all service implementations
   */
  domainUserService: UserService;

  /**
   * Participant transformation service - centralized participant building logic
   * Use for: Optimized participant list construction, bulk user operations
   */
  participantTransformationService: ParticipantTransformationService;
}

/**
 * Configuration for thread service operations
 */
export interface ThreadServiceConfig {
  defaultThreadLimit?: number;
  maxThreadDepth?: number;
  analysisConfig?: {
    enableSentimentAnalysis?: boolean;
    enableTopicExtraction?: boolean;
    enableUrgencyCalculation?: boolean;
    enableActionItemExtraction?: boolean;
    enableTimelineAnalysis?: boolean;
  };
}

/**
 * TypeSafeAPI + ts-pattern type-safe thread service interface
 * Returns ServiceResult discriminated unions for exhaustive pattern matching
 */
export interface ThreadService {
  findThreadsInChannel(args: unknown): Promise<ThreadDiscoveryResult>;
  getThreadReplies(args: unknown): Promise<ThreadRepliesResult>;
  searchThreads(args: unknown): Promise<ThreadSearchResult>;
  analyzeThread(args: unknown): Promise<ThreadAnalysisResult>;
  summarizeThread(args: unknown): Promise<ThreadSummaryResult>;
  extractActionItems(args: unknown): Promise<ActionItemsResult>;
  postThreadReply(args: unknown): Promise<ThreadReplyResult>;
  createThread(args: unknown): Promise<CreateThreadResult>;
  markThreadImportant(args: unknown): Promise<MarkImportantResult>;
  identifyImportantThreads(args: unknown): Promise<ImportantThreadsResult>;
  exportThread(args: unknown): Promise<ThreadExportResult>;
  findRelatedThreads(args: unknown): Promise<RelatedThreadsResult>;
  getThreadMetrics(args: unknown): Promise<ThreadMetricsResult>;
  getThreadsByParticipants(args: unknown): Promise<ThreadsByParticipantsResult>;
}

/**
 * MCP protocol interface for tool result compatibility with threads
 * Maintains MCPToolResult return types as required by the Model Context Protocol
 * 
 * This interface returns MCPToolResult as required by the Model Context Protocol.
 * The internal TypeSafeAPI services provide enhanced type safety, while this
 * interface ensures MCP protocol compatibility through adapter pattern.
 */
export interface ThreadServiceMCPCompat {
  findThreadsInChannel(args: unknown): Promise<MCPToolResult>;
  getThreadReplies(args: unknown): Promise<MCPToolResult>;
  searchThreads(args: unknown): Promise<MCPToolResult>;
  analyzeThread(args: unknown): Promise<MCPToolResult>;
  summarizeThread(args: unknown): Promise<MCPToolResult>;
  extractActionItems(args: unknown): Promise<MCPToolResult>;
  postThreadReply(args: unknown): Promise<MCPToolResult>;
  createThread(args: unknown): Promise<MCPToolResult>;
  markThreadImportant(args: unknown): Promise<MCPToolResult>;
  identifyImportantThreads(args: unknown): Promise<MCPToolResult>;
  exportThread(args: unknown): Promise<MCPToolResult>;
  findRelatedThreads(args: unknown): Promise<MCPToolResult>;
  getThreadMetrics(args: unknown): Promise<MCPToolResult>;
  getThreadsByParticipants(args: unknown): Promise<MCPToolResult>;
}
