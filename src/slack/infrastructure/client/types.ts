import type { WebClient } from '@slack/web-api';

/**
 * Interface for managing Slack WebClient instances
 */
export interface SlackClientManager {
  /**
   * Get or create the bot client instance
   * @returns The bot WebClient instance
   */
  getBotClient(): WebClient;

  /**
   * Get or create the user client instance
   * @returns The user WebClient instance
   * @throws {SlackAPIError} When user token is not configured
   */
  getUserClient(): WebClient;

  /**
   * Get the appropriate client for the specified operation type
   * @param operationType - The type of operation ('read' or 'write')
   * @returns The appropriate WebClient instance
   */
  getClientForOperation(operationType: 'read' | 'write'): WebClient;

  /**
   * Check if search API is available with current configuration
   * @param operationName - Name of the operation for error messages
   * @param alternative - Alternative approach when search API is unavailable
   * @throws {SlackAPIError} When search API is not available
   */
  checkSearchApiAvailability(operationName: string, alternative: string): void;
}

/**
 * Configuration for rate limiting and retry behavior
 */
export interface RateLimitConfig {
  retries: number;
  factor: number;
  minTimeout: number;
  maxTimeout: number;
  randomize: boolean;
}

/**
 * Configuration for WebClient creation
 */
export interface ClientConfig {
  logLevel: import('@slack/web-api').LogLevel;
  retryConfig?: RateLimitConfig;
  maxRequestConcurrency: number;
  rejectRateLimitedCalls: boolean;
}

/**
 * Dependencies for creating a SlackClientManager
 */
export interface ClientManagerDependencies {
  botToken: string;
  userToken?: string;
  useUserTokenForRead: boolean;
  enableRateLimit: boolean;
  clientConfig: ClientConfig;
}
