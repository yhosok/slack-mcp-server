import { z } from 'zod';

/**
 * Configuration schema validation
 */
const ConfigSchema = z.object({
  // Slack configuration
  SLACK_BOT_TOKEN: z.string().min(1, 'Slack bot token is required'),
  SLACK_USER_TOKEN: z.string().optional(), // Optional user token for search operations
  USE_USER_TOKEN_FOR_READ: z.coerce.boolean().default(false), // Use user token for read operations (default: false = bot token only)

  // Slack rate limiting configuration
  SLACK_RATE_LIMIT_RETRIES: z.coerce.number().min(0).max(10).default(3), // Number of retries for rate-limited requests
  SLACK_MAX_REQUEST_CONCURRENCY: z.coerce.number().min(1).max(20).default(3), // Maximum concurrent requests
  SLACK_REJECT_RATE_LIMITED_CALLS: z.coerce.boolean().default(false), // Reject rate-limited calls instead of retrying
  SLACK_ENABLE_RATE_LIMIT_RETRY: z.coerce.boolean().default(true), // Enable automatic retry on rate limits


  // MCP configuration
  MCP_SERVER_NAME: z.string().default('slack-mcp-server'),
  MCP_SERVER_VERSION: z.string().default('1.0.0'),

  // Optional configuration
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
  PORT: z.coerce.number().default(3000),
});

/**
 * Parse and validate environment variables
 */
function parseConfig(): Config {
  try {
    return ConfigSchema.parse(process.env);
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.error('Configuration validation failed:');
      error.errors.forEach((err) => {
        console.error(`  ${err.path.join('.')}: ${err.message}`);
      });
      process.exit(1);
    }
    throw error;
  }
}

// Lazy load configuration - only parse when accessed
let _config: Config | undefined;

export function getConfig(): Config {
  if (!_config) {
    _config = parseConfig();
  }
  return _config;
}

// For backward compatibility, export CONFIG as a getter
export const CONFIG = new Proxy({} as Config, {
  get(target, prop): unknown {
    return getConfig()[prop as keyof Config];
  },
});

export type Config = z.infer<typeof ConfigSchema>;
