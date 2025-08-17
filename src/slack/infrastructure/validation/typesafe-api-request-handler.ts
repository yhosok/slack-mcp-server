/**
 * TypeSafeAPI-compatible Request Handler
 *
 * Extends the existing request handler to support TypeSafeAPI + ts-pattern patterns
 * while maintaining backward compatibility with MCPToolResult.
 */

import type { ZodSchema } from 'zod';
import type { MCPToolResult } from '../../../mcp/types.js';
import type { RequestHandlerDependencies } from './types.js';
import { logger } from '../../../utils/logger.js';
import {
  type ServiceResult,
  type ServiceOutput,
  handleServiceResult,
  validateServiceResult,
} from '../../types/typesafe-api-patterns.js';

/**
 * TypeSafeAPI Request Handler Dependencies
 */
// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface TypeSafeAPIRequestHandlerDependencies extends RequestHandlerDependencies {
  // Extended with TypeSafeAPI-specific capabilities
}

/**
 * TypeSafeAPI Request Handler Interface
 */
export interface TypeSafeAPIRequestHandler {
  /**
   * Handle request with TypeSafeAPI ServiceResult pattern
   */
  handleTypeSafeAPI<TInput, TOutput extends ServiceOutput>(
    schema: ZodSchema<TInput>,
    args: unknown,
    operation: (input: TInput) => Promise<ServiceResult<TOutput>>
  ): Promise<ServiceResult<TOutput>>;

  /**
   * Handle request with TypeSafeAPI pattern and convert to MCP format
   */
  handleTypeSafeAPIToMCP<TInput, TOutput extends ServiceOutput>(
    schema: ZodSchema<TInput>,
    args: unknown,
    operation: (input: TInput) => Promise<ServiceResult<TOutput>>
  ): Promise<MCPToolResult>;

  /**
   * Legacy compatibility - standard request handler
   */
  handle<TInput, TOutput extends ServiceOutput>(
    schema: ZodSchema<TInput>,
    args: unknown,
    operation: (input: TInput) => Promise<TOutput>
  ): Promise<MCPToolResult>;

  /**
   * Legacy compatibility - custom format handler
   */
  handleWithCustomFormat<TInput>(
    schema: ZodSchema<TInput>,
    args: unknown,
    operation: (input: TInput) => Promise<MCPToolResult>
  ): Promise<MCPToolResult>;
}

/**
 * Enhanced error handling for TypeSafeAPI patterns
 */
const handleTypeSafeAPIError = (
  error: unknown,
  context: { args?: unknown; operation?: string }
): ServiceResult<never> => {
  const normalizedError = error instanceof Error ? error : new Error(String(error));

  // Enhanced logging with operation context
  logger.error('TypeSafeAPI request handler operation failed', {
    error: normalizedError.message,
    operation: context.operation || 'unknown',
    args: context.args,
    stack: normalizedError.stack,
    timestamp: new Date().toISOString(),
  });

  return {
    success: false,
    error: normalizedError.message,
    message: 'Operation failed',
  };
};

/**
 * Convert ServiceResult to MCPToolResult with production-ready response structure
 */
const convertServiceResultToMCP = <T extends ServiceOutput>(
  result: ServiceResult<T>
): MCPToolResult => {
  if (!validateServiceResult(result)) {
    logger.error('Invalid ServiceResult format detected', { result });
    return {
      content: [
        {
          type: 'text' as const,
          text: JSON.stringify(
            {
              statusCode: '10001',
              message: 'Invalid service result format',
              error: 'Service returned malformed result',
            },
            null,
            2
          ),
        },
      ],
      isError: true,
    };
  }

  const apiResponse = handleServiceResult(result);

  if (result.success) {
    return {
      content: [
        {
          type: 'text' as const,
          text: JSON.stringify(
            {
              statusCode: apiResponse.statusCode,
              message: apiResponse.message,
              data: apiResponse.data,
            },
            null,
            2
          ),
        },
      ],
    };
  } else {
    return {
      content: [
        {
          type: 'text' as const,
          text: JSON.stringify(
            {
              statusCode: apiResponse.statusCode,
              message: apiResponse.message,
              error: apiResponse.error,
            },
            null,
            2
          ),
        },
      ],
      isError: true,
    };
  }
};

/**
 * Create a TypeSafeAPI-compatible request handler
 */
export const createTypeSafeAPIRequestHandler = (
  dependencies: TypeSafeAPIRequestHandlerDependencies
): TypeSafeAPIRequestHandler => {
  /**
   * Handle request with TypeSafeAPI ServiceResult pattern
   */
  const handleTypeSafeAPI = async <TInput, TOutput extends ServiceOutput>(
    schema: ZodSchema<TInput>,
    args: unknown,
    operation: (input: TInput) => Promise<ServiceResult<TOutput>>
  ): Promise<ServiceResult<TOutput>> => {
    try {
      // Step 1: Input validation with TypeSafeAPI type safety
      const input = dependencies.validateInput(schema, args);

      // Step 2: Execute operation with validated input
      const result = await operation(input);

      // Step 3: Validate ServiceResult format
      if (!validateServiceResult(result)) {
        logger.error('Operation returned invalid ServiceResult format', { result });
        return handleTypeSafeAPIError(
          new Error('Operation returned invalid ServiceResult format'),
          { args, operation: 'handleTypeSafeAPI' }
        );
      }

      return result;
    } catch (error) {
      return handleTypeSafeAPIError(error, { args, operation: 'handleTypeSafeAPI' });
    }
  };

  /**
   * Handle request with TypeSafeAPI pattern and convert to MCP format
   */
  const handleTypeSafeAPIToMCP = async <TInput, TOutput extends ServiceOutput>(
    schema: ZodSchema<TInput>,
    args: unknown,
    operation: (input: TInput) => Promise<ServiceResult<TOutput>>
  ): Promise<MCPToolResult> => {
    const result = await handleTypeSafeAPI(schema, args, operation);
    return convertServiceResultToMCP(result);
  };

  /**
   * Legacy compatibility - standard request handler
   */
  const handle = async <TInput, TOutput extends ServiceOutput>(
    schema: ZodSchema<TInput>,
    args: unknown,
    operation: (input: TInput) => Promise<TOutput>
  ): Promise<MCPToolResult> => {
    try {
      // Step 1: Input validation
      const input = dependencies.validateInput(schema, args);

      // Step 2: Execute operation
      const result = await operation(input);

      // Step 3: Format as MCP result
      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    } catch (error) {
      const normalizedError = error instanceof Error ? error : new Error(String(error));
      logger.error('Legacy request handler operation failed', {
        error: normalizedError.message,
        args,
        stack: normalizedError.stack,
      });

      return dependencies.formatError(normalizedError);
    }
  };

  /**
   * Legacy compatibility - custom format handler
   */
  const handleWithCustomFormat = async <TInput>(
    schema: ZodSchema<TInput>,
    args: unknown,
    operation: (input: TInput) => Promise<MCPToolResult>
  ): Promise<MCPToolResult> => {
    try {
      // Step 1: Input validation
      const input = dependencies.validateInput(schema, args);

      // Step 2: Execute operation
      return await operation(input);
    } catch (error) {
      const normalizedError = error instanceof Error ? error : new Error(String(error));
      logger.error('Legacy custom format handler operation failed', {
        error: normalizedError.message,
        args,
        stack: normalizedError.stack,
      });

      return dependencies.formatError(normalizedError);
    }
  };

  return {
    handleTypeSafeAPI,
    handleTypeSafeAPIToMCP,
    handle,
    handleWithCustomFormat,
  };
};
