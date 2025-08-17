import type { InfrastructureServices } from '../../infrastructure/factory.js';
import type { MCPToolResult } from '../../../mcp/types.js';
import type {
  WorkspaceInfoResult,
  TeamMembersResult,
  WorkspaceActivityResult,
  ServerHealthResult,
} from '../../types/outputs/workspace.js';
import type { UserService as DomainUserService } from '../users/types.js';
import type { UserService as InfraUserService } from '../../infrastructure/user/types.js';

/**
 * Dependencies for workspace service operations
 * Enhanced with both Infrastructure and Domain user services for efficient operations
 */
export interface WorkspaceServiceDependencies extends InfrastructureServices {
  /**
   * Infrastructure user service - lightweight display name operations
   * Use for: Quick display name resolution, bulk operations, caching
   */
  infrastructureUserService: InfraUserService;

  /**
   * Domain user service - complete TypeSafeAPI-compliant user operations
   * Use for: Full user information when detailed data is required
   */
  domainUserService: DomainUserService;
}

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
