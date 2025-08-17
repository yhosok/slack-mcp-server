/**
 * MCP Compatibility Adapter for Workspace Services
 * 
 * Converts TypeSafeAPI + ts-pattern ServiceResult types back to MCPToolResult
 * for backward compatibility with existing MCP protocol routing.
 * 
 * This adapter maintains the TypeSafeAPI type safety benefits while ensuring
 * seamless integration with the existing SlackService facade.
 */

import { match } from 'ts-pattern';
import type { MCPToolResult } from '../../../mcp/types.js';
import type { WorkspaceService, WorkspaceServiceMCPCompat, WorkspaceServiceDependencies } from './types.js';
import { createWorkspaceService } from './workspace-service.js';
import {
  handleServiceResult,
  type ServiceResult,
  type ServiceOutput,
} from '../../types/typesafe-api-patterns.js';

/**
 * Create MCP-compatible workspace service adapter
 * Wraps the TypeSafeAPI workspace service to provide MCPToolResult compatibility
 */
export const createWorkspaceServiceMCPAdapter = (deps: WorkspaceServiceDependencies): WorkspaceServiceMCPCompat => {
  // Get the TypeSafeAPI type-safe workspace service
  const typeSafeApiService: WorkspaceService = createWorkspaceService(deps);

  /**
   * Convert ServiceResult to MCPToolResult with production-ready response structure
   */
  const convertToMCPResult = <T extends ServiceOutput>(result: ServiceResult<T>): MCPToolResult => {
    const apiResponse = handleServiceResult(result);
    
    return match(result)
      .with({ success: true }, (_successResult) => ({
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify({
              statusCode: apiResponse.statusCode,
              message: apiResponse.message,
              data: apiResponse.data,
            }, null, 2),
          },
        ],
      }))
      .with({ success: false }, (_errorResult) => ({
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify({
              statusCode: apiResponse.statusCode,
              message: apiResponse.message,
              error: apiResponse.error,
            }, null, 2),
          },
        ],
        isError: true,
      }))
      .exhaustive();
  };

  // MCP-compatible adapter methods
  return {
    /**
     * Get workspace/team information and settings
     */
    async getWorkspaceInfo(args: unknown): Promise<MCPToolResult> {
      const result = await typeSafeApiService.getWorkspaceInfo(args);
      return convertToMCPResult(result);
    },

    /**
     * List all team members with their roles and status
     */
    async listTeamMembers(args: unknown): Promise<MCPToolResult> {
      const result = await typeSafeApiService.listTeamMembers(args);
      return convertToMCPResult(result);
    },

    /**
     * Generate comprehensive workspace activity report
     */
    async getWorkspaceActivity(args: unknown): Promise<MCPToolResult> {
      const result = await typeSafeApiService.getWorkspaceActivity(args);
      return convertToMCPResult(result);
    },

    /**
     * Get MCP server health status and performance metrics
     */
    async getServerHealth(args: unknown): Promise<MCPToolResult> {
      const result = await typeSafeApiService.getServerHealth(args);
      return convertToMCPResult(result);
    },
  };
};