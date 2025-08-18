import type { InfrastructureServices } from '../../infrastructure/factory.js';
import type { MCPToolResult } from '../../../mcp/types.js';
import type {
  SendMessageResult,
  MessageSearchResult,
  ChannelHistoryResult,
  ListChannelsResult,
  ChannelInfoResult,
} from '../../types/outputs/messages.js';
/**
 * Dependencies for message service operations
 * Uses infrastructure services directly
 */
export type MessageServiceDependencies = InfrastructureServices;

/**
 * Configuration for message service operations
 */
export interface MessageServiceConfig {
  defaultMessageLimit?: number;
  maxMessageHistory?: number;
}

/**
 * Message service interface with TypeSafeAPI + ts-pattern type safety
 * Following production-ready discriminated union patterns for type-safe service results
 */
export interface MessageService {
  sendMessage(args: unknown): Promise<SendMessageResult>;
  listChannels(args: unknown): Promise<ListChannelsResult>;
  getChannelHistory(args: unknown): Promise<ChannelHistoryResult>;
  searchMessages(args: unknown): Promise<MessageSearchResult>;
  getChannelInfo(args: unknown): Promise<ChannelInfoResult>;
}

/**
 * MCP protocol interface for tool result compatibility
 * Used by SlackService facade for MCP protocol compliance
 * 
 * This interface returns MCPToolResult as required by the Model Context Protocol.
 * The internal TypeSafeAPI services provide enhanced type safety, while this
 * interface ensures MCP protocol compatibility through adapter pattern.
 */
export interface MessageServiceMCPCompat {
  sendMessage(args: unknown): Promise<MCPToolResult>;
  listChannels(args: unknown): Promise<MCPToolResult>;
  getChannelHistory(args: unknown): Promise<MCPToolResult>;
  searchMessages(args: unknown): Promise<MCPToolResult>;
  getChannelInfo(args: unknown): Promise<MCPToolResult>;
}
