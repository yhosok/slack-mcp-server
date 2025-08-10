/**
 * MCP-specific type definitions
 */

import type { JSONSchema7 } from 'json-schema';

/**
 * Tool definition for MCP
 */
export interface MCPTool {
  name: string;
  description: string;
  inputSchema: JSONSchema7;
}

/**
 * Tool result structure
 */
export interface MCPToolResult {
  content: MCPContent[];
  isError?: boolean;
}

/**
 * Content types for MCP responses
 */
export type MCPContent = MCPTextContent | MCPImageContent | MCPResourceContent;

export interface MCPTextContent {
  type: 'text';
  text: string;
}

export interface MCPImageContent {
  type: 'image';
  data: string;
  mimeType: string;
}

export interface MCPResourceContent {
  type: 'resource';
  resource: {
    uri: string;
    mimeType?: string;
    text?: string;
  };
}

/**
 * Server capabilities
 */
export interface MCPServerCapabilities {
  tools?: Record<string, unknown>;
  resources?: Record<string, unknown>;
  prompts?: Record<string, unknown>;
  logging?: Record<string, unknown>;
}

/**
 * Server information
 */
export interface MCPServerInfo {
  name: string;
  version: string;
  capabilities: MCPServerCapabilities;
}

/**
 * Request/Response types
 */
export interface MCPRequest {
  method: string;
  params?: Record<string, unknown>;
}

export interface MCPResponse<T = unknown> {
  result?: T;
  error?: MCPError;
}

export interface MCPError {
  code: number;
  message: string;
  data?: unknown;
}

/**
 * Tool execution context
 */
export interface MCPToolContext {
  requestId?: string;
  sessionId?: string;
  userId?: string;
  metadata?: Record<string, unknown>;
}
