#!/usr/bin/env node

import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Get the directory of the current module
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables BEFORE importing CONFIG
// Look for .env in the project root (parent of dist or src)
dotenv.config({ path: path.resolve(__dirname, '..', '.env') });

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
} from '@modelcontextprotocol/sdk/types.js';
import { SlackService } from './slack/slack-service.js';
import { CONFIG } from './config/index.js';
import { logger } from './utils/logger.js';
import { ALL_TOOLS } from './mcp/tools.js';

/**
 * Main MCP Server class for Slack integration
 */
class SlackMCPServer {
  private server: Server;
  private slackService: SlackService;

  constructor() {
    this.server = new Server(
      {
        name: CONFIG.MCP_SERVER_NAME,
        version: CONFIG.MCP_SERVER_VERSION,
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.slackService = new SlackService();
    this.setupToolHandlers();
  }

  /**
   * Setup tool handlers for the MCP server
   */
  private setupToolHandlers(): void {
    // List available tools
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      const tools: Tool[] = ALL_TOOLS.map(tool => ({
        name: tool.name,
        description: tool.description,
        inputSchema: {
          ...tool.inputSchema,
          type: 'object' as const
        } as Tool['inputSchema'],
      }));

      return { tools };
    });

    // Handle tool calls
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      try {
        switch (name) {
          // Original tools
          case 'send_message':
            return await this.slackService.sendMessage(args);
          case 'list_channels':
            return await this.slackService.listChannels(args);
          case 'get_channel_history':
            return await this.slackService.getChannelHistory(args);
          case 'get_user_info':
            return await this.slackService.getUserInfo(args);

          // Thread detection and retrieval
          case 'find_threads_in_channel':
            return await this.slackService.findThreadsInChannel(args);
          case 'get_thread_replies':
            return await this.slackService.getThreadReplies(args);
          case 'search_threads':
            return await this.slackService.searchThreads(args);

          // Thread analysis and summarization
          case 'analyze_thread':
            return await this.slackService.analyzeThread(args);
          case 'summarize_thread':
            return await this.slackService.summarizeThread(args);
          case 'extract_action_items':
            return await this.slackService.extractActionItems(args);
          case 'identify_important_threads':
            return await this.slackService.identifyImportantThreads(args);

          // Thread management
          case 'post_thread_reply':
            return await this.slackService.postThreadReply(args);
          case 'create_thread':
            return await this.slackService.createThread(args);
          case 'mark_thread_important':
            return await this.slackService.markThreadImportant(args);

          // Advanced thread features
          case 'export_thread':
            return await this.slackService.exportThread(args);
          case 'find_related_threads':
            return await this.slackService.findRelatedThreads(args);
          case 'get_thread_metrics':
            return await this.slackService.getThreadMetrics(args);
          case 'get_threads_by_participants':
            return await this.slackService.getThreadsByParticipants(args);

          // File operation tools
          case 'upload_file':
            return await this.slackService.uploadFile(args);
          case 'list_files':
            return await this.slackService.listFiles(args);
          case 'get_file_info':
            return await this.slackService.getFileInfo(args);
          case 'delete_file':
            return await this.slackService.deleteFile(args);
          case 'share_file':
            return await this.slackService.shareFile(args);
          case 'analyze_files':
            return await this.slackService.analyzeFiles(args);
          case 'search_files':
            return await this.slackService.searchFiles(args);

          // Reaction management tools
          case 'add_reaction':
            return await this.slackService.addReaction(args);
          case 'remove_reaction':
            return await this.slackService.removeReaction(args);
          case 'get_reactions':
            return await this.slackService.getReactions(args);
          case 'get_reaction_statistics':
            return await this.slackService.getReactionStatistics(args);
          case 'find_messages_by_reactions':
            return await this.slackService.findMessagesByReactions(args);

          // Workspace management tools
          case 'get_workspace_info':
            return await this.slackService.getWorkspaceInfo(args);
          case 'list_team_members':
            return await this.slackService.listTeamMembers(args);

          // Analytics and reporting tools
          case 'get_workspace_activity':
            return await this.slackService.getWorkspaceActivity(args);
          case 'get_server_health':
            return await this.slackService.getServerHealth(args);

          // Search and info tools
          case 'search_messages':
            return await this.slackService.searchMessages(args);
          case 'get_channel_info':
            return await this.slackService.getChannelInfo(args);

          default:
            throw new Error(`Unknown tool: ${name}`);
        }
      } catch (error) {
        logger.error(`Error executing tool ${name}:`, error);
        throw error;
      }
    });
  }

  /**
   * Start the MCP server
   */
  async start(): Promise<void> {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    logger.info(`Slack MCP Server started successfully`);
  }
}

// Start the server when this file is run
// This works for both direct execution and npx
const startServer = (): void => {
  const server = new SlackMCPServer();
  server.start().catch((error) => {
    logger.error('Failed to start server:', error);
    process.exit(1);
  });
};

// Start immediately
startServer();

export { SlackMCPServer };