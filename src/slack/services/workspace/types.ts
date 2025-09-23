import type { InfrastructureServices } from '../../infrastructure/factory.js';
import type { MCPToolResult } from '../../../mcp/types.js';
import type {
  WorkspaceInfoResult,
  TeamMembersResult,
  WorkspaceActivityResult,
  ServerHealthResult,
} from '../../types/outputs/workspace.js';
import type { UserService } from '../users/types.js';

/**
 * Dependencies for workspace service operations
 * Enhanced with consolidated user service (eliminates duplication)
 */
export interface WorkspaceServiceDependencies extends InfrastructureServices {
  /**
   * Consolidated user service - supports both lightweight utilities and TypeSafeAPI operations
   * Provides: Display name resolution, bulk operations, caching, complete user information
   * Eliminates the need for separate infrastructure and domain user services
   */
  infrastructureUserService: UserService;

  /**
   * Consolidated user service (same as infrastructureUserService)
   * Maintained for backward compatibility during transition period
   * TODO: Remove this after updating all service implementations
   */
  domainUserService: UserService;
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
 * MCP protocol interface for tool result compatibility with workspace
 * Uses MCPToolResult as required by the Model Context Protocol
 * 
 * This interface returns MCPToolResult as required by the Model Context Protocol.
 * The internal TypeSafeAPI services provide enhanced type safety, while this
 * interface ensures MCP protocol compatibility through adapter pattern.
 */
export interface WorkspaceServiceMCPCompat {
  getWorkspaceInfo(args: unknown): Promise<MCPToolResult>;
  listTeamMembers(args: unknown): Promise<MCPToolResult>;
  getWorkspaceActivity(args: unknown): Promise<MCPToolResult>;
  getServerHealth(args: unknown): Promise<MCPToolResult>;
}
