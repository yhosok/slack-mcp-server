# Slack MCP Server - Comprehensive Implementation

This Slack MCP (Model Context Protocol) server now provides comprehensive file operations and reaction management functionality, completing the "slack apiでできることは一通り実装" requirement.

## 🚀 Quick Start

### MCP Client Configuration

This server can be used with any MCP-compatible client (Claude Desktop, VSCode, etc.).

#### Using with Claude Desktop

Add to your Claude Desktop configuration (`~/Library/Application Support/Claude/claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "slack": {
      "command": "npx",
      "args": ["slack-mcp-server"],
      "env": {
        "SLACK_BOT_TOKEN": "xoxb-your-token-here"
      }
    }
  }
}
```

#### Using with local installation

```json
{
  "mcpServers": {
    "slack": {
      "command": "node",
      "args": ["/path/to/slack-mcp-server/dist/index.js"],
      "env": {
        "SLACK_BOT_TOKEN": "xoxb-your-token-here"
      }
    }
  }
}
```

### Local Development
```bash
# Clone and setup
git clone https://github.com/yourusername/slack-mcp-server.git
cd slack-mcp-server
./setup.sh

# Build and run
npm run build
npm start
```

## ⚙️ Configuration

### Environment Variables

The server supports the following environment variables:

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `SLACK_BOT_TOKEN` | ✅ Yes | - | Bot token (xoxb-*) from your Slack App |
| `SLACK_USER_TOKEN` | ❌ No | - | User token (xoxp-*) for extended functionality |
| `USE_USER_TOKEN_FOR_READ` | ❌ No | `false` | Use user token for read operations |
| `LOG_LEVEL` | ❌ No | `info` | Logging level (debug, info, warn, error) |

### Token Usage Strategy

By default (security-first approach):
- **All operations use bot token** (requires proper bot scopes)
- Search operations will return helpful error messages

For extended functionality:
- Set `USE_USER_TOKEN_FOR_READ=true` to enable:
  - Message and file search capabilities
  - Access to channels bot hasn't joined
  - Broader workspace visibility

Example configurations:

#### Bot Token Only (Default - Most Secure)
```json
{
  "env": {
    "SLACK_BOT_TOKEN": "xoxb-your-bot-token"
  }
}
```

#### With User Token for Extended Features
```json
{
  "env": {
    "SLACK_BOT_TOKEN": "xoxb-your-bot-token",
    "SLACK_USER_TOKEN": "xoxp-your-user-token",
    "USE_USER_TOKEN_FOR_READ": "true"
  }
}
```

### Required Bot Token Scopes

For bot-only mode, ensure your Slack App has these OAuth scopes:
- `channels:read` - Read channel information
- `channels:history` - Read channel messages
- `groups:read` - Read private channels
- `groups:history` - Read private channel messages
- `users:read` - Read user information
- `team:read` - Read workspace information
- `files:read` - Read file information
- `files:write` - Upload and manage files
- `chat:write` - Send messages
- `reactions:read` - Read reactions
- `reactions:write` - Add/remove reactions

## 🚀 New Features Implemented

### File Operations
- **File Upload**: Upload files to channels/threads with metadata support
- **File Management**: List, get info, delete, and share files across workspace
- **File Analysis**: Analyze file types, sizes, usage patterns, and identify cleanup opportunities
- **File Search**: Search files by name, type, content with advanced filtering
- **Bulk Operations**: Manage file permissions and generate file reports

### Reaction Management
- **Add/Remove Reactions**: Add or remove emoji reactions to any message
- **Reaction Analytics**: Get detailed statistics and trends for workspace reactions
- **Pattern Search**: Find messages by specific reaction patterns
- **User Insights**: Track top reactors and most used reactions

### Workspace Management
- **Team Info**: Get comprehensive workspace information and settings
- **Member Management**: List team members with roles and permissions
- **Activity Reports**: Generate detailed workspace activity analytics
- **Health Monitoring**: Monitor server performance and API usage

### Analytics & Reporting
- **Comprehensive Reports**: Message, user, channel, and file analytics
- **Performance Monitoring**: Real-time server health and rate limit tracking
- **Trend Analysis**: Usage patterns and engagement metrics
- **Export Capabilities**: Multiple format support for data export

## 📋 Complete Tool List (43 Tools Total)

### Core Messaging (6 tools)
- `send_message` - Send messages to channels/threads
- `list_channels` - List workspace channels 
- `get_channel_history` - Get channel message history
- `get_user_info` - Get user information
- `search_messages` - Search messages (legacy)
- `get_channel_info` - Get channel details (legacy)

### Thread Management (16 tools)
- `find_threads_in_channel` - Find all threaded conversations
- `get_thread_replies` - Get complete thread content
- `search_threads` - Search threads by keywords/participants
- `analyze_thread` - Deep thread analysis (participants, timeline, topics)
- `summarize_thread` - AI-powered thread summaries
- `post_thread_reply` - Reply to existing threads
- `create_thread` - Start new threaded conversations
- `mark_thread_important` - Flag important threads
- `extract_action_items` - Extract tasks from threads
- `identify_important_threads` - Find high-priority discussions
- `export_thread` - Export threads (markdown, JSON, HTML, CSV)
- `find_related_threads` - Discover related discussions
- `get_thread_metrics` - Thread analytics and statistics
- `get_threads_by_participants` - Find threads by user participation
- And more thread utilities...

### File Operations (7 tools)
- `upload_file` - Upload files with metadata
- `list_files` - List workspace files with filters
- `get_file_info` - Detailed file information
- `delete_file` - Delete files (where permitted)
- `share_file` - Share files to additional channels
- `analyze_files` - File usage analysis and cleanup insights
- `search_files` - Advanced file search capabilities

### Reaction Management (5 tools)
- `add_reaction` - Add emoji reactions to messages
- `remove_reaction` - Remove reactions from messages
- `get_reactions` - List all reactions on a message
- `get_reaction_statistics` - Reaction analytics and trends
- `find_messages_by_reactions` - Find messages by reaction patterns

### Workspace Management (2 tools)
- `get_workspace_info` - Workspace/team information
- `list_team_members` - Team member listing with roles

### Analytics & Reporting (2 tools)
- `get_workspace_activity` - Comprehensive activity reports
- `get_server_health` - Server health and performance monitoring

## 🛠️ Technical Implementation

### Architecture
- **Type-Safe Design**: Comprehensive TypeScript types for all Slack API entities
- **Validation Layer**: Zod-based input validation for all operations
- **Error Handling**: Robust error handling with detailed logging
- **Rate Limiting**: Built-in rate limit awareness and management
- **Performance**: Optimized for large-scale workspace operations

### Advanced Features
- **Binary File Support**: Handle file uploads with proper binary data processing
- **Streaming Support**: Large file upload capabilities
- **Multi-format Export**: Support for markdown, JSON, HTML, CSV exports
- **Cross-channel Operations**: Work across multiple channels and workspaces
- **Comprehensive Analytics**: Deep insights into workspace usage patterns

### Integration Capabilities
- **MCP Protocol**: Full Model Context Protocol compliance
- **Webhook Support**: Handle Slack webhook integrations
- **Bot Management**: Manage bot presence and status
- **Permission Handling**: Respect Slack permissions and access controls

## 🎯 Use Cases

This comprehensive implementation enables:

1. **Team Communication Analysis**: Deep insights into team communication patterns
2. **Content Management**: Organize and manage workspace files and documents
3. **Workflow Automation**: Automate routine Slack operations and maintenance
4. **Compliance & Auditing**: Generate reports for compliance requirements
5. **Productivity Analytics**: Measure and optimize team productivity
6. **Knowledge Management**: Extract and organize institutional knowledge
7. **Integration Hub**: Connect Slack with external systems and workflows

## 🚀 Getting Started

```bash
# Install dependencies
npm install

# Build the project
npm run build

# Start the server
npm start
```

The server provides a complete Slack API implementation through the MCP protocol, making it easy to build sophisticated Slack integrations and automation tools.

## 📊 Performance & Scalability

- **Concurrent Operations**: Handle multiple API calls efficiently
- **Memory Optimization**: Efficient memory usage for large datasets
- **Caching Strategy**: Smart caching to minimize API calls
- **Error Recovery**: Robust error handling and retry logic
- **Rate Limit Management**: Automatic rate limit handling and backoff

This implementation represents a complete, production-ready Slack MCP server that can handle enterprise-scale operations while maintaining excellent performance and reliability.