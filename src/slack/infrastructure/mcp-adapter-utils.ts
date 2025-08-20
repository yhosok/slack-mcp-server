/**
 * Shared utilities for MCP adapter conversion
 * Consolidates the common MCP adapter patterns used across all service adapters
 */

import { match } from 'ts-pattern';
import type { MCPToolResult } from '../../mcp/types.js';
import {
  handleServiceResult,
  type ServiceResult,
  type ServiceOutput,
} from '../types/typesafe-api-patterns.js';

/**
 * Convert ServiceResult to MCPToolResult with production-ready response structure
 * This function is shared across all MCP adapters to ensure consistent response format
 */
export const convertToMCPResult = <T extends ServiceOutput>(
  result: ServiceResult<T>
): MCPToolResult => {
  const apiResponse = handleServiceResult(result);

  return match(result)
    .with({ success: true }, (_successResult) => ({
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
      isError: false,
    }))
    .with({ success: false }, (_errorResult) => ({
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
    }))
    .exhaustive(); // Type-safe exhaustive matching
};

/**
 * Generic MCP adapter factory that wraps any TypeSafeAPI service
 * Takes a service instance and converts all its methods to return MCPToolResult
 */
export const createMCPAdapter = <T>(
  service: T
): T extends Record<string, (...args: unknown[]) => Promise<ServiceResult<ServiceOutput>>>
  ? { [K in keyof T]: (args: unknown) => Promise<MCPToolResult> }
  : never => {
  const adapter = {} as Record<string, (args: unknown) => Promise<MCPToolResult>>;

  for (const [methodName, method] of Object.entries(service as Record<string, unknown>)) {
    if (typeof method === 'function') {
      adapter[methodName] = async (args: unknown): Promise<MCPToolResult> => {
        const result = await method(args);
        return convertToMCPResult(result);
      };
    }
  }

  return adapter as T extends Record<
    string,
    (...args: unknown[]) => Promise<ServiceResult<ServiceOutput>>
  >
    ? { [K in keyof T]: (args: unknown) => Promise<MCPToolResult> }
    : never;
};

/**
 * Type helper for defining MCP-compatible service interfaces
 * Converts a TypeSafeAPI service interface to MCP-compatible interface
 */
export type MCPCompatService<T> = {
  [K in keyof T]: T[K] extends (...args: unknown[]) => Promise<ServiceResult<ServiceOutput>>
    ? (args: unknown) => Promise<MCPToolResult>
    : never;
};
