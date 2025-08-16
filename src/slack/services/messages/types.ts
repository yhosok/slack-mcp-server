import type { InfrastructureServices } from '../../infrastructure/factory.js';
import type { MCPToolResult } from '../../../mcp/types.js';
import type {
  SendMessageResult,
  MessageSearchResult,
  ChannelHistoryResult,
  ListChannelsResult,
  UserInfoResult,
  ChannelInfoResult,
} from '../../types/outputs/messages.js';

/**
 * Dependencies for message service operations
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
 * Message service interface with Context7 + ts-pattern type safety
 * Following production-ready discriminated union patterns for type-safe service results
 */
export interface MessageService {
  sendMessage(args: unknown): Promise<SendMessageResult>;
  listChannels(args: unknown): Promise<ListChannelsResult>;
  getChannelHistory(args: unknown): Promise<ChannelHistoryResult>;
  getUserInfo(args: unknown): Promise<UserInfoResult>;
  searchMessages(args: unknown): Promise<MessageSearchResult>;
  getChannelInfo(args: unknown): Promise<ChannelInfoResult>;
}

/**
 * Legacy interface for backward compatibility with MCP routing
 * Used by SlackService facade for MCP protocol compatibility
 */
export interface MessageServiceMCPCompat {
  sendMessage(args: unknown): Promise<MCPToolResult>;
  listChannels(args: unknown): Promise<MCPToolResult>;
  getChannelHistory(args: unknown): Promise<MCPToolResult>;
  getUserInfo(args: unknown): Promise<MCPToolResult>;
  searchMessages(args: unknown): Promise<MCPToolResult>;
  getChannelInfo(args: unknown): Promise<MCPToolResult>;
}
