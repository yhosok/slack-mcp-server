import type { MCPToolResult } from '../mcp/types.js';
import { createSlackServiceRegistry, type SlackServiceRegistry } from './service-factory.js';

/**
 * Service class for Slack API operations
 *
 * This class serves as a thin facade over the modular architecture,
 * delegating all business logic to the service registry.
 * All WebClient management, rate limiting, and infrastructure concerns
 * are handled by the modular services.
 */
export class SlackService {
  // Modular architecture integration
  private serviceRegistry: SlackServiceRegistry | undefined;

  constructor() {
    // Delay initialization until first use
  }

  /**
   * Initialize modular services (lazy-loaded)
   */
  private getServiceRegistry(): SlackServiceRegistry {
    if (!this.serviceRegistry) {
      this.serviceRegistry = createSlackServiceRegistry();
    }
    return this.serviceRegistry;
  }

  // ================================
  // PUBLIC API METHODS (36 TOTAL)
  // ================================

  /**
   * Send a message to a Slack channel or user
   */
  async sendMessage(args: unknown): Promise<MCPToolResult> {
    return this.getServiceRegistry().methods.sendMessage(args);
  }

  /**
   * Get message history from a channel
   */
  async getChannelHistory(args: unknown): Promise<MCPToolResult> {
    return this.getServiceRegistry().methods.getChannelHistory(args);
  }

  async searchMessages(args: unknown): Promise<MCPToolResult> {
    return this.getServiceRegistry().methods.searchMessages(args);
  }

  async getChannelInfo(args: unknown): Promise<MCPToolResult> {
    return this.getServiceRegistry().methods.getChannelInfo(args);
  }

  /**
   * Get all images from a specific message
   */
  async getMessageImages(args: unknown): Promise<MCPToolResult> {
    return this.getServiceRegistry().methods.getMessageImages(args);
  }

  /**
   * Get information about a user
   */
  async getUserInfo(args: unknown): Promise<MCPToolResult> {
    return this.getServiceRegistry().methods.getUserInfo(args);
  }

  /**
   * List team members
   */
  async listTeamMembers(args: unknown): Promise<MCPToolResult> {
    return this.getServiceRegistry().methods.listTeamMembers(args);
  }

  /**
   * Get workspace activity report
   */
  async getWorkspaceActivity(args: unknown): Promise<MCPToolResult> {
    return this.getServiceRegistry().methods.getWorkspaceActivity(args);
  }

  /**
   * Get server health status
   */
  async getServerHealth(args: unknown): Promise<MCPToolResult> {
    return this.getServiceRegistry().methods.getServerHealth(args);
  }

  /**
   * List channels
   */
  async listChannels(args: unknown): Promise<MCPToolResult> {
    return this.getServiceRegistry().methods.listChannels(args);
  }

  /**
   * Get workspace info
   */
  async getWorkspaceInfo(args: unknown): Promise<MCPToolResult> {
    return this.getServiceRegistry().methods.getWorkspaceInfo(args);
  }

  // ================================
  // THREAD METHODS (14 TOTAL)
  // ================================

  /**
   * Find threads in channel
   */
  async findThreadsInChannel(args: unknown): Promise<MCPToolResult> {
    return this.getServiceRegistry().methods.findThreadsInChannel(args);
  }

  /**
   * Get thread replies
   */
  async getThreadReplies(args: unknown): Promise<MCPToolResult> {
    return this.getServiceRegistry().methods.getThreadReplies(args);
  }

  /**
   * Search threads
   */
  async searchThreads(args: unknown): Promise<MCPToolResult> {
    return this.getServiceRegistry().methods.searchThreads(args);
  }

  /**
   * Post thread reply
   */
  async postThreadReply(args: unknown): Promise<MCPToolResult> {
    return this.getServiceRegistry().methods.postThreadReply(args);
  }

  /**
   * Create thread
   */
  async createThread(args: unknown): Promise<MCPToolResult> {
    return this.getServiceRegistry().methods.createThread(args);
  }

  /**
   * Mark thread important
   */
  async markThreadImportant(args: unknown): Promise<MCPToolResult> {
    return this.getServiceRegistry().methods.markThreadImportant(args);
  }

  /**
   * Analyze thread
   */
  async analyzeThread(args: unknown): Promise<MCPToolResult> {
    return this.getServiceRegistry().methods.analyzeThread(args);
  }

  /**
   * Summarize thread
   */
  async summarizeThread(args: unknown): Promise<MCPToolResult> {
    return this.getServiceRegistry().methods.summarizeThread(args);
  }

  /**
   * Extract action items
   */
  async extractActionItems(args: unknown): Promise<MCPToolResult> {
    return this.getServiceRegistry().methods.extractActionItems(args);
  }

  /**
   * Identify important threads
   */
  async identifyImportantThreads(args: unknown): Promise<MCPToolResult> {
    return this.getServiceRegistry().methods.identifyImportantThreads(args);
  }

  /**
   * Export thread
   */
  async exportThread(args: unknown): Promise<MCPToolResult> {
    return this.getServiceRegistry().methods.exportThread(args);
  }

  /**
   * Find related threads
   */
  async findRelatedThreads(args: unknown): Promise<MCPToolResult> {
    return this.getServiceRegistry().methods.findRelatedThreads(args);
  }

  /**
   * Get thread metrics
   */
  async getThreadMetrics(args: unknown): Promise<MCPToolResult> {
    return this.getServiceRegistry().methods.getThreadMetrics(args);
  }

  /**
   * Get threads by participants
   */
  async getThreadsByParticipants(args: unknown): Promise<MCPToolResult> {
    return this.getServiceRegistry().methods.getThreadsByParticipants(args);
  }

  // ================================
  // FILE METHODS (7 TOTAL)
  // ================================

  /**
   * Upload file
   */
  async uploadFile(args: unknown): Promise<MCPToolResult> {
    return this.getServiceRegistry().methods.uploadFile(args);
  }

  /**
   * List files
   */
  async listFiles(args: unknown): Promise<MCPToolResult> {
    return this.getServiceRegistry().methods.listFiles(args);
  }

  /**
   * Get file info
   */
  async getFileInfo(args: unknown): Promise<MCPToolResult> {
    return this.getServiceRegistry().methods.getFileInfo(args);
  }

  /**
   * Delete file
   */
  async deleteFile(args: unknown): Promise<MCPToolResult> {
    return this.getServiceRegistry().methods.deleteFile(args);
  }

  /**
   * Share file
   */
  async shareFile(args: unknown): Promise<MCPToolResult> {
    return this.getServiceRegistry().methods.shareFile(args);
  }

  /**
   * Analyze files
   */
  async analyzeFiles(args: unknown): Promise<MCPToolResult> {
    return this.getServiceRegistry().methods.analyzeFiles(args);
  }

  /**
   * Search files
   */
  async searchFiles(args: unknown): Promise<MCPToolResult> {
    return this.getServiceRegistry().methods.searchFiles(args);
  }

  // ================================
  // REACTION METHODS (5 TOTAL)
  // ================================

  /**
   * Add reaction
   */
  async addReaction(args: unknown): Promise<MCPToolResult> {
    return this.getServiceRegistry().methods.addReaction(args);
  }

  /**
   * Remove reaction
   */
  async removeReaction(args: unknown): Promise<MCPToolResult> {
    return this.getServiceRegistry().methods.removeReaction(args);
  }

  /**
   * Get reactions
   */
  async getReactions(args: unknown): Promise<MCPToolResult> {
    return this.getServiceRegistry().methods.getReactions(args);
  }

  /**
   * Get reaction statistics
   */
  async getReactionStatistics(args: unknown): Promise<MCPToolResult> {
    return this.getServiceRegistry().methods.getReactionStatistics(args);
  }

  /**
   * Find messages by reactions
   */
  async findMessagesByReactions(args: unknown): Promise<MCPToolResult> {
    return this.getServiceRegistry().methods.findMessagesByReactions(args);
  }
}
