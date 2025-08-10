import type { ZodSchema } from 'zod';
import type { MCPToolResult } from '../../../mcp/types.js';

/**
 * Generic request handler for consistent API operation patterns
 */
export interface RequestHandler {
  /**
   * Handle an API request with validation, error handling, and response formatting
   * @param schema - Zod schema for input validation
   * @param args - Raw input arguments to validate
   * @param operation - Async operation to perform with validated input
   * @returns Formatted MCP tool response
   */
  handle<TInput, TOutput>(
    schema: ZodSchema<TInput>,
    args: unknown,
    operation: (input: TInput) => Promise<TOutput>
  ): Promise<MCPToolResult>;
}

/**
 * Function type for formatting successful responses
 */
export type ResponseFormatter<T> = (data: T) => MCPToolResult;

/**
 * Function type for formatting error responses
 */
export type ErrorFormatter = (error: Error) => MCPToolResult;

/**
 * Dependencies for creating a RequestHandler
 */
export interface RequestHandlerDependencies {
  /**
   * Function to validate input against a schema
   */
  validateInput: <T>(schema: ZodSchema<T>, args: unknown) => T;

  /**
   * Function to format successful responses
   */
  formatResponse: ResponseFormatter<unknown>;

  /**
   * Function to format error responses
   */
  formatError: ErrorFormatter;
}
