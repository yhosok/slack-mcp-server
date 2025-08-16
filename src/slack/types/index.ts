/**
 * Centralized type exports for Slack MCP Server
 * 
 * This module implements the Context7 re-export pattern, providing a single
 * source of truth for all Slack-related type definitions. The modular structure
 * enables better maintainability while preserving backward compatibility.
 * 
 * Architecture:
 * - All types are organized by functional domain in core/ directory
 * - This index.ts serves as the re-export hub following TypeScript official patterns
 * - Existing import statements continue to work without modification
 * - Future outputs/ directory is prepared for service output types
 */

// ===================================================================
// CORE TYPE RE-EXPORTS
// ===================================================================

// Common types (exported first as they're used by other modules)
export type { SlackReaction, ActionItem } from './core/common.js';

// User types
export type { SlackUser, SlackUserProfile } from './core/users.js';

// Message types (includes SlackReaction re-export for backward compatibility)
export type {
  SlackMessage,
  SlackBlock,
  SlackAttachment,
  SlackAttachmentField,
} from './core/messages.js';

// Channel types (depends on SlackMessage)
export type { SlackChannel } from './core/channels.js';

// File types
export type {
  SlackFile,
  SlackFileShare,
  SlackFileComment,
  FileAnalysis,
} from './core/files.js';

// Thread types (depends on SlackMessage)
export type {
  SlackThread,
  ThreadAnalysis,
  ThreadParticipant,
  ThreadTimelineEvent,
  ThreadSummary,
  ThreadMetrics,
} from './core/threads.js';

// ===================================================================
// LEGACY COMPATIBILITY LAYER
// ===================================================================

/**
 * Re-export SlackReaction from messages module for complete backward compatibility
 * This ensures that existing code importing SlackReaction from the main types
 * file continues to work without modification.
 */
// SlackReaction is already exported above from common.js