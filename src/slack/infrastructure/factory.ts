import { validateInput } from '../../utils/validation.js';
import {
  createSlackClientManager,
  createRateLimitService,
  createUserService,
  createRequestHandler,
  convertLogLevel,
  defaultResponseFormatter,
  defaultErrorFormatter,
} from './index.js';
import type {
  SlackClientManager,
  RateLimitService,
  UserService,
  RequestHandler,
  ClientManagerDependencies,
  ClientConfig,
} from './index.js';

/**
 * Configuration for creating infrastructure services
 */
export interface InfrastructureConfig {
  botToken: string;
  userToken?: string;
  useUserTokenForRead: boolean;
  enableRateLimit: boolean;
  rateLimitRetries: number;
  maxRequestConcurrency: number;
  rejectRateLimitedCalls: boolean;
  logLevel: string;
}

/**
 * Complete infrastructure services bundle
 */
export interface InfrastructureServices {
  clientManager: SlackClientManager;
  rateLimitService: RateLimitService;
  userService: UserService;
  requestHandler: RequestHandler;
  config: {
    maxRequestConcurrency: number;
  };
}

/**
 * Create all infrastructure services with proper dependency injection
 * @param config - Configuration for the infrastructure
 * @returns Complete infrastructure services bundle
 */
export const createInfrastructureServices = (
  config: InfrastructureConfig
): InfrastructureServices => {
  // Create rate limit service first (no dependencies)
  const rateLimitService = createRateLimitService(config.rejectRateLimitedCalls);

  // Create client configuration
  const clientConfig: ClientConfig = {
    logLevel: convertLogLevel(config.logLevel),
    retryConfig: config.enableRateLimit
      ? {
          retries: config.rateLimitRetries,
          factor: 2,
          minTimeout: 1000,
          maxTimeout: 300000,
          randomize: true,
        }
      : undefined,
    maxRequestConcurrency: config.maxRequestConcurrency,
    rejectRateLimitedCalls: config.rejectRateLimitedCalls,
  };

  // Create client manager dependencies
  const clientManagerDependencies: ClientManagerDependencies = {
    botToken: config.botToken,
    userToken: config.userToken,
    useUserTokenForRead: config.useUserTokenForRead,
    enableRateLimit: config.enableRateLimit,
    clientConfig,
  };

  // Create client manager
  const clientManager = createSlackClientManager(clientManagerDependencies, rateLimitService);

  // Create Infrastructure User Service - Pure utility for shared user operations
  // This service provides display name resolution and caching utilities
  // Used by: thread-service, reaction-service, workspace-service, etc.
  // Role: Infrastructure utility, NOT MCP tool implementation
  const userService = createUserService({
    getClient: () => clientManager.getClientForOperation('read'),
  });

  // Create request handler (uses existing validation functions)
  const requestHandler = createRequestHandler({
    validateInput,
    formatResponse: defaultResponseFormatter,
    formatError: defaultErrorFormatter,
  });

  return {
    clientManager,
    rateLimitService,
    userService,
    requestHandler,
    config: {
      maxRequestConcurrency: config.maxRequestConcurrency,
    },
  };
};
