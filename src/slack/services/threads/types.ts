import type { InfrastructureServices } from '../../infrastructure/factory.js';
import type { MCPToolResult } from '../../../mcp/types.js';

/**
 * Dependencies for thread service operations
 */
export interface ThreadServiceDependencies extends InfrastructureServices {
  // Additional thread-specific dependencies can be added here
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
 * Thread service interface
 */
export interface ThreadService {
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