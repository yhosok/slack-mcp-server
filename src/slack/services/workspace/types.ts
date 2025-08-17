import type { InfrastructureServices } from '../../infrastructure/factory.js';
import type { MCPToolResult } from '../../../mcp/types.js';
import type {
  WorkspaceInfoResult,
  TeamMembersResult,
  WorkspaceActivityResult,
  ServerHealthResult,
} from '../../types/outputs/workspace.js';

/**
 * Dependencies for workspace service operations
 */
export type WorkspaceServiceDependencies = InfrastructureServices;

/**
 * Configuration for workspace service operations
 */
export interface WorkspaceServiceConfig {
  maxTeamMemberCount?: number;
  activityReportDays?: number;
}

/**
 * TypeSafeAPI-compliant workspace service interface
 * Returns discriminated union ServiceResult types for type safety
 */
export interface WorkspaceService {
  getWorkspaceInfo(args: unknown): Promise<WorkspaceInfoResult>;
  listTeamMembers(args: unknown): Promise<TeamMembersResult>;
  getWorkspaceActivity(args: unknown): Promise<WorkspaceActivityResult>;
  getServerHealth(args: unknown): Promise<ServerHealthResult>;
}

/**
 * MCP-compatible workspace service interface for backward compatibility
 * Uses traditional MCPToolResult for compatibility with existing routing
 */
export interface WorkspaceServiceMCPCompat {
  getWorkspaceInfo(args: unknown): Promise<MCPToolResult>;
  listTeamMembers(args: unknown): Promise<MCPToolResult>;
  getWorkspaceActivity(args: unknown): Promise<MCPToolResult>;
  getServerHealth(args: unknown): Promise<MCPToolResult>;
}
