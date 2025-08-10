/**
 * Schema converter utilities for converting Zod schemas to MCP tools
 */

import { zodToJsonSchema } from 'zod-to-json-schema';
import type { z } from 'zod';
import type { MCPTool } from './types.js';
import type { JSONSchema7 } from 'json-schema';

/**
 * Convert a Zod schema to an MCPTool definition
 */
export function createMCPTool(name: string, description: string, schema: z.ZodSchema): MCPTool {
  const jsonSchema = zodToJsonSchema(schema, {
    $refStrategy: 'none', // MCP doesn't use references
    target: 'jsonSchema7',
  }) as JSONSchema7;

  // Ensure we have the correct structure for MCP
  const inputSchema: JSONSchema7 = {
    ...jsonSchema,
    additionalProperties: false, // Strict validation
  };

  return {
    name,
    description,
    inputSchema,
  };
}

/**
 * Utility function to create tools with consistent structure
 */
export function defineSlackTool(name: string, description: string, schema: z.ZodSchema): MCPTool {
  return createMCPTool(name, description, schema);
}
