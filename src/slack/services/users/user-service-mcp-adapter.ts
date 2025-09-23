/**
 * User Service MCP Adapter
 * Enhanced to work with consolidated user service (eliminates duplication)
 */

import type { MCPToolResult } from '../../../mcp/types.js';
import { convertToMCPResult } from '../../infrastructure/mcp-adapter-utils.js';
import type { UserService } from './types.js';

/**
 * Creates User Service MCP Adapter using consolidated user service
 *
 * Updated to accept the consolidated user service directly, eliminating the need
 * for separate infrastructure and domain user services. The consolidated service
 * already provides both TypeSafeAPI methods and infrastructure utilities.
 */
export const createUserServiceMCPAdapter = (
  consolidatedUserService: UserService
): {
  getUserInfo: (args: unknown) => Promise<MCPToolResult>;
} => {
  return {
    async getUserInfo(args: unknown): Promise<MCPToolResult> {
      // Use the consolidated service's getUserInfo method (TypeSafeAPI pattern)
      const result = await consolidatedUserService.getUserInfo(args);
      return convertToMCPResult(result);
    },
  };
};
