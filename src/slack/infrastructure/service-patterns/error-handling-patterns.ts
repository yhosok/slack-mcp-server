/**
 * Error Handling Patterns - Reusable Error Factories for Service Methods
 *
 * This module consolidates the 40+ duplicate error handling blocks found across
 * services into standardized, reusable error creation factories. Eliminates
 * massive code duplication while maintaining TypeSafeAPI + ts-pattern type safety.
 *
 * ## Key Features
 * - Standardized error creation for common scenarios
 * - Enhanced error context and metadata
 * - Type-safe error handling with TypeSafeAPI patterns
 * - Consistent error messages and structure
 * - Integration with existing error infrastructure
 *
 * ## Design Philosophy
 * This module addresses the root cause of error handling duplication by:
 * 1. Providing reusable error factories for common scenarios
 * 2. Standardizing error messages and context across services
 * 3. Maintaining type safety with createTypedServiceError patterns
 * 4. Reducing maintenance burden for error handling updates
 *
 * @example Basic Usage
 * ```typescript
 * // Instead of duplicating this pattern 40+ times:
 * if (error instanceof SlackAPIError) {
 *   return createTypedServiceError('API_ERROR', error.message, 'Failed to...');
 * }
 *
 * // Use the factory:
 * return handleSlackApiError(error, 'uploadFile', 'Failed to upload file');
 * ```
 */

import {
  createTypedServiceError,
  type ServiceResult,
  type ServiceOutput,
} from '../../types/typesafe-api-patterns.js';
import { SlackAPIError } from '../../../utils/errors.js';
import { logger } from '../../../utils/logger.js';

/**
 * Enhanced error context for better debugging and monitoring
 */
export interface ErrorContext {
  /** Method name where the error occurred */
  method: string;
  /** Operation type (read/write) */
  operationType?: 'read' | 'write';
  /** Additional metadata for debugging */
  metadata?: Record<string, unknown>;
  /** Input parameters that caused the error (be careful with sensitive data) */
  inputContext?: Record<string, unknown>;
  /** Slack-specific error details */
  slackError?: string;
  /** HTTP status code if applicable */
  statusCode?: number;
}

/**
 * Configuration for error handling behavior
 */
export interface ErrorHandlingConfig {
  /** Whether to log errors (default: true) */
  enableLogging?: boolean;
  /** Log level for errors (default: 'error') */
  logLevel?: 'error' | 'warn' | 'debug';
  /** Whether to include input context in errors (default: false for security) */
  includeInputContext?: boolean;
  /** Maximum error message length (default: 500) */
  maxErrorLength?: number;
}

/**
 * Default error handling configuration
 */
const DEFAULT_ERROR_CONFIG: Required<ErrorHandlingConfig> = {
  enableLogging: true,
  logLevel: 'error',
  includeInputContext: false,
  maxErrorLength: 500,
};

/**
 * Truncate error messages to prevent log pollution
 */
const truncateErrorMessage = (message: string, maxLength: number): string => {
  if (message.length <= maxLength) {
    return message;
  }
  return `${message.substring(0, maxLength - 3)}...`;
};

/**
 * Handle Slack API errors with standardized patterns
 *
 * Eliminates the repeated pattern found across 40+ service methods:
 * ```typescript
 * if (error instanceof SlackAPIError) {
 *   return createTypedServiceError('API_ERROR', error.message, 'Failed to...');
 * }
 * ```
 *
 * @param error - The error instance
 * @param context - Error context for debugging
 * @param userMessage - User-friendly error message
 * @param config - Error handling configuration
 * @returns Standardized ServiceResult error
 */
export const handleSlackApiError = (
  error: unknown,
  context: ErrorContext,
  userMessage: string,
  config: ErrorHandlingConfig = {}
): ServiceResult<never> => {
  const finalConfig = { ...DEFAULT_ERROR_CONFIG, ...config };

  if (error instanceof SlackAPIError) {
    const truncatedMessage = truncateErrorMessage(error.message, finalConfig.maxErrorLength);

    if (finalConfig.enableLogging) {
      logger[finalConfig.logLevel](`${context.method}: Slack API error`, {
        method: context.method,
        error: truncatedMessage,
        operationType: context.operationType,
        slackError: context.slackError,
        ...context.metadata,
      });
    }

    return createTypedServiceError('API_ERROR', truncatedMessage, userMessage, {
      method: context.method,
      operationType: context.operationType,
      slackError: context.slackError,
      ...(finalConfig.includeInputContext ? context.inputContext : {}),
      ...context.metadata,
    });
  }

  // Not a SlackAPIError, delegate to generic error handler
  return handleGenericError(error, context, userMessage, config);
};

/**
 * Handle validation errors with standardized patterns
 *
 * Provides consistent handling for Zod validation errors and other input validation failures.
 */
export const handleValidationError = (
  error: unknown,
  context: ErrorContext,
  userMessage: string = 'Invalid input parameters',
  config: ErrorHandlingConfig = {}
): ServiceResult<never> => {
  const finalConfig = { ...DEFAULT_ERROR_CONFIG, ...config };
  const errorMessage = error instanceof Error ? error.message : String(error);
  const truncatedMessage = truncateErrorMessage(errorMessage, finalConfig.maxErrorLength);

  if (finalConfig.enableLogging) {
    logger[finalConfig.logLevel](`${context.method}: Validation error`, {
      method: context.method,
      error: truncatedMessage,
      validationDetails: error instanceof Error ? error.name : 'unknown',
      ...context.metadata,
    });
  }

  return createTypedServiceError('VALIDATION_ERROR', truncatedMessage, userMessage, {
    method: context.method,
    validationType: error instanceof Error ? error.name : 'unknown',
    ...(finalConfig.includeInputContext ? context.inputContext : {}),
    ...context.metadata,
  });
};

/**
 * Handle not found errors with standardized patterns
 *
 * Provides consistent handling for cases where requested resources don't exist.
 */
export const handleNotFoundError = (
  resourceType: string,
  resourceId: string,
  context: ErrorContext,
  config: ErrorHandlingConfig = {}
): ServiceResult<never> => {
  const finalConfig = { ...DEFAULT_ERROR_CONFIG, ...config };
  const userMessage = `${resourceType} not found`;
  const errorMessage = `${resourceType} with ID '${resourceId}' does not exist or is not accessible`;

  if (finalConfig.enableLogging) {
    logger[finalConfig.logLevel](`${context.method}: Resource not found`, {
      method: context.method,
      resourceType,
      resourceId,
      ...context.metadata,
    });
  }

  return createTypedServiceError('NOT_FOUND_ERROR', errorMessage, userMessage, {
    method: context.method,
    resourceType,
    resourceId,
    ...context.metadata,
  });
};

/**
 * Handle permission errors with standardized patterns
 *
 * Provides consistent handling for authorization and permission-related errors.
 */
export const handlePermissionError = (
  operation: string,
  context: ErrorContext,
  userMessage?: string,
  config: ErrorHandlingConfig = {}
): ServiceResult<never> => {
  const finalConfig = { ...DEFAULT_ERROR_CONFIG, ...config };
  const defaultMessage = `Insufficient permissions for ${operation}`;
  const finalUserMessage = userMessage || defaultMessage;

  if (finalConfig.enableLogging) {
    logger[finalConfig.logLevel](`${context.method}: Permission error`, {
      method: context.method,
      operation,
      operationType: context.operationType,
      ...context.metadata,
    });
  }

  return createTypedServiceError(
    'AUTHORIZATION_ERROR',
    `Permission denied for operation: ${operation}`,
    finalUserMessage,
    {
      method: context.method,
      operation,
      operationType: context.operationType,
      ...context.metadata,
    }
  );
};

/**
 * Handle rate limit errors with standardized patterns
 *
 * Provides consistent handling for Slack API rate limiting scenarios.
 */
export const handleRateLimitError = (
  context: ErrorContext,
  retryAfter?: number,
  config: ErrorHandlingConfig = {}
): ServiceResult<never> => {
  const finalConfig = { ...DEFAULT_ERROR_CONFIG, ...config };
  const userMessage = 'Rate limit exceeded. Please try again later.';
  const errorMessage = retryAfter
    ? `Rate limit exceeded. Retry after ${retryAfter} seconds.`
    : 'Rate limit exceeded';

  if (finalConfig.enableLogging) {
    logger[finalConfig.logLevel](`${context.method}: Rate limit exceeded`, {
      method: context.method,
      retryAfter,
      operationType: context.operationType,
      ...context.metadata,
    });
  }

  return createTypedServiceError('RATE_LIMIT_ERROR', errorMessage, userMessage, {
    method: context.method,
    retryAfter,
    operationType: context.operationType,
    ...context.metadata,
  });
};

/**
 * Handle generic errors with standardized patterns
 *
 * Fallback handler for unexpected errors that don't fit other categories.
 */
export const handleGenericError = (
  error: unknown,
  context: ErrorContext,
  userMessage: string = 'An unexpected error occurred',
  config: ErrorHandlingConfig = {}
): ServiceResult<never> => {
  const finalConfig = { ...DEFAULT_ERROR_CONFIG, ...config };
  const errorMessage = error instanceof Error ? error.message : String(error);
  const truncatedMessage = truncateErrorMessage(errorMessage, finalConfig.maxErrorLength);

  if (finalConfig.enableLogging) {
    logger[finalConfig.logLevel](`${context.method}: Unexpected error`, {
      method: context.method,
      error: truncatedMessage,
      errorType: error instanceof Error ? error.constructor.name : 'unknown',
      operationType: context.operationType,
      ...context.metadata,
    });
  }

  return createTypedServiceError('UNKNOWN_ERROR', truncatedMessage, userMessage, {
    method: context.method,
    errorType: error instanceof Error ? error.constructor.name : 'unknown',
    operationType: context.operationType,
    ...(finalConfig.includeInputContext ? context.inputContext : {}),
    ...context.metadata,
  });
};

/**
 * Comprehensive error handler that routes to appropriate specific handlers
 *
 * This is the main entry point for handling errors in service methods.
 * It automatically determines the error type and routes to the appropriate
 * specialized handler.
 *
 * @param error - The error to handle
 * @param context - Error context for debugging
 * @param userMessage - User-friendly error message
 * @param config - Error handling configuration
 * @returns Appropriate ServiceResult error
 */
export const handleServiceError = (
  error: unknown,
  context: ErrorContext,
  userMessage: string,
  config: ErrorHandlingConfig = {}
): ServiceResult<never> => {
  // Handle Slack API errors
  if (error instanceof SlackAPIError) {
    return handleSlackApiError(error, context, userMessage, config);
  }

  // Handle validation errors (Zod)
  if (error instanceof Error && error.name === 'ZodError') {
    return handleValidationError(error, context, userMessage, config);
  }

  // Handle permission/authorization errors
  if (error instanceof Error && error.message.toLowerCase().includes('permission')) {
    return handlePermissionError('unknown operation', context, userMessage, config);
  }

  // Handle rate limit errors
  if (error instanceof Error && error.message.toLowerCase().includes('rate limit')) {
    return handleRateLimitError(context, undefined, config);
  }

  // Fallback to generic error handling
  return handleGenericError(error, context, userMessage, config);
};

/**
 * Create error context helper for service methods
 *
 * Provides a standardized way to create error context objects.
 */
export const createErrorContext = (
  method: string,
  operationType?: 'read' | 'write',
  metadata?: Record<string, unknown>
): ErrorContext => ({
  method,
  operationType,
  metadata,
});

/**
 * Error handling decorators and utilities
 */

/**
 * Type for service method that can throw errors
 */
type ServiceMethodWithErrors<TInput, TOutput> = (input: TInput) => Promise<TOutput>;

/**
 * Wrap a service method with automatic error handling
 *
 * This decorator automatically handles errors using the standardized patterns,
 * reducing boilerplate in service method implementations.
 */
export const withErrorHandling = <TInput, TOutput>(
  method: ServiceMethodWithErrors<TInput, TOutput>,
  methodName: string,
  operationType: 'read' | 'write',
  userMessage: string,
  config: ErrorHandlingConfig = {}
) => {
  return async (input: TInput): Promise<TOutput | ServiceResult<never>> => {
    try {
      return await method(input);
    } catch (error) {
      const context = createErrorContext(methodName, operationType);
      return handleServiceError(error, context, userMessage, config);
    }
  };
};

/**
 * Pre-configured error handlers for common scenarios
 */
export const CommonErrorHandlers = {
  /** Handle file operation errors */
  fileOperation: (
    error: unknown,
    method: string,
    operation: string
  ): ServiceResult<ServiceOutput> =>
    handleServiceError(
      error,
      createErrorContext(method, 'write', { operation }),
      `Failed to ${operation} file`
    ),

  /** Handle message operation errors */
  messageOperation: (
    error: unknown,
    method: string,
    operation: string
  ): ServiceResult<ServiceOutput> =>
    handleServiceError(
      error,
      createErrorContext(method, operation === 'send' ? 'write' : 'read', { operation }),
      `Failed to ${operation} message`
    ),

  /** Handle channel operation errors */
  channelOperation: (
    error: unknown,
    method: string,
    operation: string
  ): ServiceResult<ServiceOutput> =>
    handleServiceError(
      error,
      createErrorContext(method, 'read', { operation }),
      `Failed to ${operation} channel information`
    ),

  /** Handle search operation errors */
  searchOperation: (
    error: unknown,
    method: string,
    searchType: string
  ): ServiceResult<ServiceOutput> =>
    handleServiceError(
      error,
      createErrorContext(method, 'read', { searchType }),
      `Failed to search ${searchType}`
    ),
};
