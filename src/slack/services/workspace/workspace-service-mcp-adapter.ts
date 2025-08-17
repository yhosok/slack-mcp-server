/**
 * MCP Compatibility Adapter for Workspace Services
 * 
 * Converts TypeSafeAPI + ts-pattern ServiceResult types back to MCPToolResult
 * for backward compatibility with existing MCP protocol routing.
 * 
 * This adapter maintains the TypeSafeAPI type safety benefits while ensuring
 * seamless integration with the existing SlackService facade.
 */

import type { MCPToolResult } from '../../../mcp/types.js';
import type { WorkspaceService, WorkspaceServiceMCPCompat, WorkspaceServiceDependencies } from './types.js';
import { createWorkspaceService } from './workspace-service.js';
import { convertToMCPResult } from '../../infrastructure/mcp-adapter-utils.js';

/**
 * Create MCP-compatible workspace service adapter
 * Uses the shared conversion utilities to wrap the TypeSafeAPI workspace service
 */
export const createWorkspaceServiceMCPAdapter = (deps: WorkspaceServiceDependencies): WorkspaceServiceMCPCompat => {
  // Get the TypeSafeAPI type-safe workspace service
  const typeSafeApiService: WorkspaceService = createWorkspaceService(deps);

  // Manually wrap each method with the shared converter for type safety
  return {
    async getWorkspaceInfo(args: unknown): Promise<MCPToolResult> {
      const result = await typeSafeApiService.getWorkspaceInfo(args);
      return convertToMCPResult(result);
    },

    async listTeamMembers(args: unknown): Promise<MCPToolResult> {
      const result = await typeSafeApiService.listTeamMembers(args);
      return convertToMCPResult(result);
    },

    async getWorkspaceActivity(args: unknown): Promise<MCPToolResult> {
      const result = await typeSafeApiService.getWorkspaceActivity(args);
      return convertToMCPResult(result);
    },

    async getServerHealth(args: unknown): Promise<MCPToolResult> {
      const result = await typeSafeApiService.getServerHealth(args);
      return convertToMCPResult(result);
    },
  };
};