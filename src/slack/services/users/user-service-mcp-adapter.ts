/**
 * User Service MCP Adapter
 * Following TypeSafeAPI + ts-pattern pattern established in other service adapters
 */

import type { MCPToolResult } from '../../../mcp/types.js';
import type { InfrastructureServices } from '../../infrastructure/factory.js';
import { convertToMCPResult } from '../../infrastructure/mcp-adapter-utils.js';
import { createUserServiceWithMCPTransformation } from './user-service-factory.js';

/**
 * Creates User Service MCP Adapter following established patterns
 * 
 * Provides the same interface pattern as other service MCP adapters:
 * - message-service-mcp-adapter.ts
 * - thread-service-mcp-adapter.ts  
 * - file-service-mcp-adapter.ts
 * - reaction-service-mcp-adapter.ts
 * - workspace-service-mcp-adapter.ts
 */
export const createUserServiceMCPAdapter = (infrastructure: InfrastructureServices): {
  getUserInfo: (args: unknown) => Promise<MCPToolResult>;
} => {
  const userService = createUserServiceWithMCPTransformation(infrastructure);

  return {
    async getUserInfo(args: unknown): Promise<MCPToolResult> {
      const result = await userService.getUserInfo(args);
      return convertToMCPResult(result);
    },
  };
};