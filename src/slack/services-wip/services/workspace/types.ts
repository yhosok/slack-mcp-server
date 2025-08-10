import type { InfrastructureServices } from '../../infrastructure/factory.js';

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
  getWorkspaceInfo(args: unknown): Promise<any>;
  listTeamMembers(args: unknown): Promise<any>;
  getWorkspaceActivity(args: unknown): Promise<any>;
  getServerHealth(args: unknown): Promise<any>;
}