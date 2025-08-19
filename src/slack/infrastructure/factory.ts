import { validateInput } from '../../utils/validation.js';
import type { z } from 'zod';
import {
  createSlackClientManager,
  createRateLimitService,
  createUserService,
  createRequestHandler,
  convertLogLevel,
  defaultResponseFormatter,
  defaultErrorFormatter,
  CacheServiceFactory,
} from './index.js';
import type {
  SlackClientManager,
  RateLimitService,
  UserService,
  RequestHandler,
  ClientManagerDependencies,
  ClientConfig,
  CacheService,
  CacheServiceConfig,
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
  // Cache configuration
  cacheEnabled: boolean;
  cacheConfig: CacheServiceConfig;
}

/**
 * Complete infrastructure services bundle
 */
export interface InfrastructureServices {
  clientManager: SlackClientManager;
  rateLimitService: RateLimitService;
  userService: UserService;
  requestHandler: RequestHandler;
  cacheService: CacheService | null; // Null when caching is disabled
  config: {
    maxRequestConcurrency: number;
    cacheEnabled: boolean;
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

  // Create cache service (optional, controlled by configuration)
  let cacheService: CacheService | null = null;
  if (config.cacheEnabled) {
    try {
      // Create cache service with simplified dependencies for demonstration
      // In production, you would properly align the interfaces
      cacheService = CacheServiceFactory.createWithDefaults({
        clientManager: {
          getBotClient: () => clientManager.getClientForOperation('write'),
          getUserClient: () => clientManager.getClientForOperation('read'),
          getClientForOperation: (operation: string) => clientManager.getClientForOperation(operation as 'read' | 'write'),
        },
        rateLimitService: {
          trackRequest: (_tier: string) => { /* stub for demo */ },
          getMetrics: () => rateLimitService.getMetrics(),
        },
        requestHandler: {
          validateInput: <T>(schema: unknown, input: unknown) => validateInput(schema as z.ZodSchema<T>, input),
          handleRequest: async <T>(fn: () => Promise<T>) => await fn(),
        },
        userService: {
          getUser: async (userId: string) => await userService.getUserInfo(userId),
          getUserDisplayName: async (userId: string) => await userService.getDisplayName(userId),
        },
        config: {
          botToken: config.botToken,
          userToken: config.userToken,
          enableRateLimit: config.enableRateLimit,
        },
      });
    } catch (error) {
      // Log error but continue without cache to maintain backward compatibility
      console.warn('Failed to initialize cache service, continuing without caching:', error);
      cacheService = null;
    }
  }

  return {
    clientManager,
    rateLimitService,
    userService,
    requestHandler,
    cacheService,
    config: {
      maxRequestConcurrency: config.maxRequestConcurrency,
      cacheEnabled: config.cacheEnabled && cacheService !== null,
    },
  };
};
