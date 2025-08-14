import type { InfrastructureServices } from '../../infrastructure/factory.js';
import type { MCPToolResult } from '../../../mcp/types.js';

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
 * Message service interface
 */
export interface MessageService {
  sendMessage(args: unknown): Promise<MCPToolResult>;
  listChannels(args: unknown): Promise<MCPToolResult>;
  getChannelHistory(args: unknown): Promise<MCPToolResult>;
  getUserInfo(args: unknown): Promise<MCPToolResult>;
  searchMessages(args: unknown): Promise<MCPToolResult>;
  getChannelInfo(args: unknown): Promise<MCPToolResult>;
}
