import type { InfrastructureServices } from '../../infrastructure/factory.js';

/**
 * Dependencies for message service operations
 */
export interface MessageServiceDependencies extends InfrastructureServices {
  // Additional message-specific dependencies can be added here
}

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
  sendMessage(args: unknown): Promise<any>;
  listChannels(args: unknown): Promise<any>;
  getChannelHistory(args: unknown): Promise<any>;
  getUserInfo(args: unknown): Promise<any>;
  searchMessages(args: unknown): Promise<any>;
  getChannelInfo(args: unknown): Promise<any>;
}