import type { ZodSchema } from 'zod';
import type { MCPToolResult } from '../../../mcp/types.js';
import type { RequestHandler, RequestHandlerDependencies } from './types.js';
import { logger } from '../../../utils/logger.js';
import { SlackAPIError } from '../../../utils/errors.js';
import {
  createTypedMCPResult,
  toSerializableOutput,
  createTypedErrorResult,
} from './type-helpers.js';

/**
 * TypeSafeAPI utility type for service output constraints
 * Simplifies the verbose "extends Record<string, any>" pattern
 */
type ServiceOutput = Record<string, unknown>;

/**
 * Enhanced error handling utility for request operations
 * TypeSafeAPI pattern: Centralized error logging and formatting
 * @param error - The error to handle
 * @param context - Additional context for debugging
 * @param dependencies - Handler dependencies for error formatting
 * @returns Formatted error response
 */
const handleOperationError = (
  error: unknown,
  context: { args?: unknown; operation?: string },
  dependencies: RequestHandlerDependencies
): MCPToolResult => {
  const normalizedError = error instanceof Error ? error : new Error(String(error));

  // Enhanced logging with operation context
  logger.error('Request handler operation failed', {
    error: normalizedError.message,
    operation: context.operation || 'unknown',
    args: context.args,
    stack: normalizedError.stack,
    timestamp: new Date().toISOString(),
  });

  return dependencies.formatError(normalizedError);
};

/**
 * Create a request handler with consistent error handling and response formatting
 *
 * TypeSafeAPI Implementation Features:
 * - Generic constraints ensure JSON serialization safety
 * - Centralized error handling reduces code duplication
 * - Type-safe operations with comprehensive logging
 * - Performance-optimized validation pipeline
 *
 * @param dependencies - Required dependencies for the handler
 * @returns A new RequestHandler instance with TypeSafeAPI patterns
 */
export const createRequestHandler = (dependencies: RequestHandlerDependencies): RequestHandler => {
  /**
   * Handle an API request with validation, error handling, and response formatting
   *
   * TypeSafeAPI Pattern Implementation:
   * - TOutput extends ServiceOutput ensures object structure and JSON safety
   * - Centralized error handling with enhanced logging context
   * - Performance-optimized validation pipeline
   * - Type-safe response formatting with runtime safety checks
   *
   * @param schema - Zod schema for input validation
   * @param args - Raw input arguments to validate
   * @param operation - Async operation to perform with validated input
   * @returns Formatted MCP tool response with type safety guarantees
   */
  const handle = async <TInput, TOutput extends ServiceOutput>(
    schema: ZodSchema<TInput>,
    args: unknown,
    operation: (input: TInput) => Promise<TOutput>
  ): Promise<MCPToolResult> => {
    try {
      // Step 1: Input validation with TypeSafeAPI type safety
      const input = dependencies.validateInput(schema, args);

      // Step 2: Execute operation with validated input
      const result = await operation(input);

      // Step 3: Runtime safety validation (TypeSafeAPI constraint enforcement)
      const safeResult = toSerializableOutput<TOutput>(result);

      // Step 4: Type-safe response formatting
      return createTypedMCPResult(safeResult);
    } catch (error) {
      return handleOperationError(error, { args, operation: 'handle' }, dependencies);
    }
  };

  /**
   * Handle an API request with validation and error handling, but custom response formatting
   *
   * TypeSafeAPI Pattern: Allows services to return MCPToolResult directly while maintaining
   * consistent error handling and logging patterns across the application.
   *
   * Use Case: For operations that need complex response formatting or multiple content types
   *
   * @param schema - Zod schema for input validation
   * @param args - Raw input arguments to validate
   * @param operation - Async operation that returns MCPToolResult directly
   * @returns MCP tool response with consistent error handling
   */
  const handleWithCustomFormat = async <TInput>(
    schema: ZodSchema<TInput>,
    args: unknown,
    operation: (input: TInput) => Promise<MCPToolResult>
  ): Promise<MCPToolResult> => {
    try {
      // Step 1: Input validation with type safety
      const input = dependencies.validateInput(schema, args);

      // Step 2: Execute operation (returns MCPToolResult directly)
      return await operation(input);
    } catch (error) {
      return handleOperationError(
        error,
        { args, operation: 'handleWithCustomFormat' },
        dependencies
      );
    }
  };

  return {
    handle,
    handleWithCustomFormat,
  };
};

/**
 * Default response formatter for successful operations
 * TypeSafeAPI pattern: Type-safe response formatting with enhanced error handling
 *
 * @param data - The data to include in the response
 * @returns Formatted MCP tool response with JSON safety guarantees
 */
export const defaultResponseFormatter = (data: unknown): MCPToolResult => {
  try {
    // TypeSafeAPI pattern: Ensure data is safely serializable
    const formattedText = typeof data === 'string' ? data : JSON.stringify(data, null, 2);

    return {
      content: [
        {
          type: 'text',
          text: formattedText,
        },
      ],
    };
  } catch (error) {
    // Fallback for non-serializable data (TypeSafeAPI safety pattern)
    logger.warn('Response formatting fallback triggered', {
      error: error instanceof Error ? error.message : String(error),
      dataType: typeof data,
    });

    return {
      content: [
        {
          type: 'text',
          text: 'Response data could not be serialized safely',
        },
      ],
      isError: true,
    };
  }
};

/**
 * Enhanced error formatter for failed operations
 * TypeSafeAPI pattern: Type-safe error formatting with comprehensive error context
 *
 * @param error - The error to format
 * @returns Formatted MCP tool error response with enhanced debugging information
 */
export const defaultErrorFormatter = (error: Error): MCPToolResult => {
  const isSlackAPIError = error instanceof SlackAPIError;

  // TypeSafeAPI pattern: Enhanced error messaging with context
  const errorContext = {
    type: isSlackAPIError ? 'SlackAPIError' : 'ApplicationError',
    message: error.message,
    timestamp: new Date().toISOString(),
  };

  const displayMessage = isSlackAPIError
    ? `Slack API Error: ${error.message}`
    : `Error: ${error.message}`;

  return createTypedErrorResult(displayMessage, errorContext);
};
