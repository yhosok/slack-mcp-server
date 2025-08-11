import { WebClient, LogLevel } from '@slack/web-api';
import { SlackAPIError } from '../../../utils/errors.js';
import type { SlackClientManager, ClientManagerDependencies } from './types.js';
import type { RateLimitService } from './rate-limit-service.js';

/**
 * Create a Slack client manager instance using dependency injection
 * @param dependencies - Configuration and dependencies
 * @param rateLimitService - Service for rate limiting and metrics
 * @returns A new SlackClientManager instance
 */
export const createSlackClientManager = (
  dependencies: ClientManagerDependencies,
  rateLimitService: RateLimitService
): SlackClientManager => {
  let botClient: WebClient | undefined;
  let userClient: WebClient | undefined;

  /**
   * Create WebClient configuration from dependencies
   */
  const createClientOptions = (): object => ({
    logLevel: dependencies.clientConfig.logLevel,
    retryConfig: dependencies.enableRateLimit ? dependencies.clientConfig.retryConfig : undefined,
    maxRequestConcurrency: dependencies.clientConfig.maxRequestConcurrency,
    rejectRateLimitedCalls: dependencies.clientConfig.rejectRateLimitedCalls,
  });

  /**
   * Get or create the bot client instance
   */
  const getBotClient = (): WebClient => {
    if (!botClient) {
      botClient = new WebClient(dependencies.botToken, createClientOptions());

      // Add rate limiting metrics if enabled
      if (dependencies.enableRateLimit) {
        botClient = rateLimitService.createClientWithMetrics(botClient, 'bot');
      }
    }
    return botClient;
  };

  /**
   * Get or create the user client instance
   */
  const getUserClient = (): WebClient => {
    if (!dependencies.userToken) {
      throw new SlackAPIError(
        'SLACK_USER_TOKEN is required for search operations. Please set the SLACK_USER_TOKEN environment variable with your user token (xoxp-*).'
      );
    }

    if (!userClient) {
      userClient = new WebClient(dependencies.userToken, createClientOptions());

      // Add rate limiting metrics if enabled
      if (dependencies.enableRateLimit) {
        userClient = rateLimitService.createClientWithMetrics(userClient, 'user');
      }
    }
    return userClient;
  };

  /**
   * Get the appropriate client for the specified operation type
   */
  const getClientForOperation = (operationType: 'read' | 'write'): WebClient => {
    // For write operations, always use bot token
    if (operationType === 'write') {
      return getBotClient();
    }

    // For read operations, check configuration
    if (dependencies.useUserTokenForRead && dependencies.userToken) {
      // Use user token for read operations if configured and available
      return getUserClient();
    }

    // Default to bot token for all operations
    return getBotClient();
  };

  /**
   * Check if search API is available with current configuration
   */
  const checkSearchApiAvailability = (operationName: string, alternative: string): void => {
    if (!dependencies.useUserTokenForRead || !dependencies.userToken) {
      throw new SlackAPIError(
        `${operationName} requires a user token. Bot tokens cannot use search API. ` +
          'Please either:\\n' +
          '1. Set USE_USER_TOKEN_FOR_READ=true and provide SLACK_USER_TOKEN (xoxp-*), or\\n' +
          `2. ${alternative}`
      );
    }
  };

  return {
    getBotClient,
    getUserClient,
    getClientForOperation,
    checkSearchApiAvailability,
  };
};

/**
 * Helper function to convert LOG_LEVEL string to Slack LogLevel enum
 * @param logLevel - String log level from configuration
 * @returns Slack LogLevel enum value
 */
export const convertLogLevel = (logLevel: string): LogLevel => {
  switch (logLevel) {
    case 'debug':
      return LogLevel.DEBUG;
    case 'info':
      return LogLevel.INFO;
    case 'warn':
      return LogLevel.WARN;
    case 'error':
      return LogLevel.ERROR;
    default:
      return LogLevel.INFO;
  }
};
