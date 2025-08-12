import type { ZodSchema } from 'zod';
import type { MCPToolResult } from '../../../mcp/types.js';
import type { RequestHandler, RequestHandlerDependencies } from './types.js';
import { logger } from '../../../utils/logger.js';
import { SlackAPIError } from '../../../utils/errors.js';

/**
 * Create a request handler with consistent error handling and response formatting
 * @param dependencies - Required dependencies for the handler
 * @returns A new RequestHandler instance
 */
export const createRequestHandler = (dependencies: RequestHandlerDependencies): RequestHandler => {
  /**
   * Handle an API request with validation, error handling, and response formatting
   */
  const handle = async <TInput, TOutput>(
    schema: ZodSchema<TInput>,
    args: unknown,
    operation: (input: TInput) => Promise<TOutput>
  ): Promise<MCPToolResult> => {
    try {
      // Validate input
      const input = dependencies.validateInput(schema, args);

      // Perform operation
      const result = await operation(input);

      // Format successful response
      return dependencies.formatResponse(result);
    } catch (error) {
      // Log error for debugging
      logger.error('Request handler error', {
        error: error instanceof Error ? error.message : String(error),
        args,
        stack: error instanceof Error ? error.stack : undefined,
      });

      // Format error response
      return dependencies.formatError(error instanceof Error ? error : new Error(String(error)));
    }
  };

  /**
   * Handle an API request with validation and error handling, but custom response formatting
   * This allows services to return their own MCPToolResult format directly
   */
  const handleWithCustomFormat = async <TInput>(
    schema: ZodSchema<TInput>,
    args: unknown,
    operation: (input: TInput) => Promise<MCPToolResult>
  ): Promise<MCPToolResult> => {
    try {
      // Validate input
      const input = dependencies.validateInput(schema, args);

      // Perform operation (returns MCPToolResult directly)
      return await operation(input);
    } catch (error) {
      // Log error for debugging
      logger.error('Request handler error', {
        error: error instanceof Error ? error.message : String(error),
        args,
        stack: error instanceof Error ? error.stack : undefined,
      });

      // Format error response instead of re-throwing
      return dependencies.formatError(error instanceof Error ? error : new Error(String(error)));
    }
  };

  return {
    handle,
    handleWithCustomFormat,
  };
};

/**
 * Default response formatter for successful operations
 * @param data - The data to include in the response
 * @returns Formatted MCP tool response
 */
export const defaultResponseFormatter = (data: unknown): MCPToolResult => ({
  content: [
    {
      type: 'text',
      text: typeof data === 'string' ? data : JSON.stringify(data, null, 2),
    },
  ],
});

/**
 * Default error formatter for failed operations
 * @param error - The error to format
 * @returns Formatted MCP tool error response
 */
export const defaultErrorFormatter = (error: Error): MCPToolResult => {
  const isSlackAPIError = error instanceof SlackAPIError;
  const message = isSlackAPIError ? `Slack API Error: ${error.message}` : `Error: ${error.message}`;

  return {
    content: [
      {
        type: 'text',
        text: message,
      },
    ],
    isError: true,
  };
};
