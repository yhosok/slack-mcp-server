import { WebClient, WebClientEvent } from '@slack/web-api';
import { logger } from '../../../utils/logger.js';

/**
 * Rate limiting metrics tracked for monitoring and health reporting
 */
export interface RateLimitMetrics {
  readonly totalRequests: number;
  readonly rateLimitedRequests: number;
  readonly retryAttempts: number;
  readonly lastRateLimitTime: Date | null;
  readonly rateLimitsByTier: ReadonlyMap<string, number>;
}

/**
 * Interface for rate limit tracking and metrics
 */
export interface RateLimitService {
  /**
   * Create a WebClient with rate limiting metrics tracking
   * @param client - The WebClient instance to enhance
   * @param clientType - Type identifier for logging ('bot' | 'user')
   * @returns The enhanced client
   */
  createClientWithMetrics(client: WebClient, clientType: 'bot' | 'user'): WebClient;

  /**
   * Get current rate limiting metrics
   * @returns Immutable snapshot of current metrics
   */
  getMetrics(): RateLimitMetrics;

  /**
   * Extract API tier from URL for rate limit categorization
   * @param apiUrl - The API endpoint URL
   * @returns The tier category
   */
  extractTierFromUrl(apiUrl?: string): string;
}

/**
 * Internal mutable state for rate limit metrics
 */
interface MutableRateLimitMetrics {
  totalRequests: number;
  rateLimitedRequests: number;
  retryAttempts: number;
  lastRateLimitTime: Date | null;
  rateLimitsByTier: Map<string, number>;
}

/**
 * Create a rate limit service instance
 * @returns A new RateLimitService instance
 */
export const createRateLimitService = (): RateLimitService => {
  // Internal mutable state
  let metrics: MutableRateLimitMetrics = {
    totalRequests: 0,
    rateLimitedRequests: 0,
    retryAttempts: 0,
    lastRateLimitTime: null,
    rateLimitsByTier: new Map<string, number>(),
  };

  /**
   * Extract API tier from URL for categorization
   */
  const extractTierFromUrl = (apiUrl?: string): string => {
    if (!apiUrl) return 'unknown';

    // Common patterns for different tiers
    if (apiUrl.includes('chat.') || apiUrl.includes('files.')) return 'tier1';
    if (apiUrl.includes('conversations.') || apiUrl.includes('users.')) return 'tier2';
    if (apiUrl.includes('search.')) return 'tier3';
    if (apiUrl.includes('admin.')) return 'tier4';

    return 'other';
  };

  /**
   * Setup rate limit event listeners on a WebClient
   */
  const setupRateLimitListeners = (client: WebClient, clientType: 'bot' | 'user'): void => {
    client.on(WebClientEvent.RATE_LIMITED, (numSeconds: number, { team_id, api_url }) => {
      // Immutable update of metrics
      metrics = {
        ...metrics,
        rateLimitedRequests: metrics.rateLimitedRequests + 1,
        lastRateLimitTime: new Date(),
        rateLimitsByTier: new Map(metrics.rateLimitsByTier),
      };

      // Track by tier (extract from API URL)
      const tier = extractTierFromUrl(api_url);
      const currentCount = metrics.rateLimitsByTier.get(tier) || 0;
      metrics.rateLimitsByTier.set(tier, currentCount + 1);

      logger.warn(`Rate limit hit for ${clientType} client`, {
        team_id,
        api_url,
        retry_after_seconds: numSeconds,
        tier,
        total_rate_limits: metrics.rateLimitedRequests,
      });
    });

    // Track total requests by wrapping apiCall method
    const originalRequest = client.apiCall.bind(client);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    client.apiCall = (method: string, options?: any): Promise<any> => {
      // Immutable update of total requests
      metrics = {
        ...metrics,
        totalRequests: metrics.totalRequests + 1,
      };
      return originalRequest(method, options);
    };
  };

  /**
   * Create a WebClient with rate limiting metrics tracking
   */
  const createClientWithMetrics = (client: WebClient, clientType: 'bot' | 'user'): WebClient => {
    setupRateLimitListeners(client, clientType);
    return client;
  };

  /**
   * Get current rate limiting metrics (immutable snapshot)
   */
  const getMetrics = (): RateLimitMetrics => ({
    totalRequests: metrics.totalRequests,
    rateLimitedRequests: metrics.rateLimitedRequests,
    retryAttempts: metrics.retryAttempts,
    lastRateLimitTime: metrics.lastRateLimitTime,
    rateLimitsByTier: new Map(metrics.rateLimitsByTier),
  });

  return {
    createClientWithMetrics,
    getMetrics,
    extractTierFromUrl,
  };
};
