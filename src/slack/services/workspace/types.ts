import type { InfrastructureServices } from '../../infrastructure/factory.js';
import type { MCPToolResult } from '../../../mcp/types.js';

/**
 * Dependencies for workspace service operations
 */
export interface WorkspaceServiceDependencies extends InfrastructureServices {
  // Additional workspace-specific dependencies can be added here
}

/**
 * Configuration for workspace service operations
 */
export interface WorkspaceServiceConfig {
  maxTeamMemberCount?: number;
  activityReportDays?: number;
}

/**
 * Workspace service interface
 */
export interface WorkspaceService {
  getWorkspaceInfo(args: unknown): Promise<MCPToolResult>;
  listTeamMembers(args: unknown): Promise<MCPToolResult>;
  getWorkspaceActivity(args: unknown): Promise<MCPToolResult>;
  getServerHealth(args: unknown): Promise<MCPToolResult>;
}