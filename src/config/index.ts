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

  // Cache configuration
  CACHE_ENABLED: z.coerce.boolean().default(true), // Enable/disable caching system
  CACHE_CHANNELS_MAX: z.coerce.number().min(10).max(10000).default(1000), // Max channel cache entries
  CACHE_CHANNELS_TTL: z.coerce.number().min(60).max(86400).default(3600), // Channel cache TTL in seconds (1 hour)
  CACHE_USERS_MAX: z.coerce.number().min(10).max(10000).default(500), // Max user cache entries
  CACHE_USERS_TTL: z.coerce.number().min(60).max(86400).default(1800), // User cache TTL in seconds (30 minutes)
  CACHE_SEARCH_MAX_QUERIES: z.coerce.number().min(10).max(1000).default(100), // Max search query cache entries
  CACHE_SEARCH_MAX_RESULTS: z.coerce.number().min(100).max(50000).default(5000), // Max search result cache entries
  CACHE_SEARCH_QUERY_TTL: z.coerce.number().min(60).max(3600).default(900), // Search query TTL in seconds (15 minutes)
  CACHE_SEARCH_RESULT_TTL: z.coerce.number().min(60).max(3600).default(900), // Search result TTL in seconds (15 minutes)
  CACHE_FILES_MAX: z.coerce.number().min(10).max(5000).default(500), // Max file cache entries
  CACHE_FILES_TTL: z.coerce.number().min(60).max(86400).default(1800), // File cache TTL in seconds (30 minutes)
  CACHE_THREADS_MAX: z.coerce.number().min(10).max(5000).default(300), // Max thread cache entries
  CACHE_THREADS_TTL: z.coerce.number().min(60).max(3600).default(2700), // Thread cache TTL in seconds (45 minutes)

  // Search ranking configuration (Advanced relevance scoring features)
  SEARCH_RANKING_ENABLED: z.string().transform(val => val === 'true').default('true'), // Enable/disable advanced search ranking features
  SEARCH_INDEX_TTL: z.coerce.number().min(60).max(3600).default(900), // Search index cache TTL in seconds (15 minutes)
  SEARCH_TIME_DECAY_RATE: z.coerce.number().min(0.001).max(1).default(0.01), // Time decay rate for message recency scoring (0.001-1.0)
  SEARCH_MAX_INDEX_SIZE: z.coerce.number().min(100).max(100000).default(10000), // Maximum search index size for performance optimization

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
