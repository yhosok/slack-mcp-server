import type { InfrastructureServices } from '../../infrastructure/factory.js';

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
  findThreadsInChannel(args: unknown): Promise<any>;
  getThreadReplies(args: unknown): Promise<any>;
  searchThreads(args: unknown): Promise<any>;
  analyzeThread(args: unknown): Promise<any>;
  summarizeThread(args: unknown): Promise<any>;
  extractActionItems(args: unknown): Promise<any>;
  postThreadReply(args: unknown): Promise<any>;
  createThread(args: unknown): Promise<any>;
  markThreadImportant(args: unknown): Promise<any>;
  identifyImportantThreads(args: unknown): Promise<any>;
  exportThread(args: unknown): Promise<any>;
  findRelatedThreads(args: unknown): Promise<any>;
  getThreadMetrics(args: unknown): Promise<any>;
  getThreadsByParticipants(args: unknown): Promise<any>;
}