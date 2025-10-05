/**
 * Test helpers for infrastructure configuration
 *
 * Provides utility functions to create test infrastructure configurations
 * that include all required properties including the new search ranking config.
 */

import type { InfrastructureConfig } from '../slack/infrastructure/index.js';

/**
 * Create a default infrastructure configuration for testing
 *
 * @param overrides - Partial configuration to override defaults
 * @returns Complete infrastructure configuration suitable for testing
 */
export function createTestInfrastructureConfig(
  overrides: Partial<InfrastructureConfig> = {}
): InfrastructureConfig {
  const defaultConfig: InfrastructureConfig = {
    botToken: 'xoxb-test-bot-token',
    userToken: 'xoxp-test-user-token',
    useUserTokenForRead: false,
    enableRateLimit: false,
    rateLimitRetries: 3,
    maxRequestConcurrency: 3,
    rejectRateLimitedCalls: false,
    logLevel: 'info',
    cacheEnabled: false,
    cacheConfig: {
      channels: { max: 100, ttl: 300000, updateAgeOnGet: true },
      users: { max: 50, ttl: 300000, updateAgeOnGet: true },
      search: {
        maxQueries: 10,
        maxResults: 100,
        queryTTL: 60000,
        resultTTL: 120000,
        adaptiveTTL: false,
        enablePatternInvalidation: false,
      },
      files: { max: 50, ttl: 300000 },
      threads: { max: 50, ttl: 300000, updateAgeOnGet: true },
      enableMetrics: false,
    },
    // Search ranking configuration defaults for testing
    searchRankingEnabled: false,
    searchIndexTTL: 900,
    searchTimeDecayRate: 0.01,
    searchMaxIndexSize: 1000,
  };

  return { ...defaultConfig, ...overrides };
}

/**
 * Create infrastructure configuration with search ranking enabled
 *
 * @param overrides - Partial configuration to override defaults
 * @returns Infrastructure configuration with search ranking enabled
 */
export function createTestInfrastructureConfigWithSearchRanking(
  overrides: Partial<InfrastructureConfig> = {}
): InfrastructureConfig {
  return createTestInfrastructureConfig({
    searchRankingEnabled: true,
    searchIndexTTL: 900,
    searchTimeDecayRate: 0.01,
    searchMaxIndexSize: 10000,
    ...overrides,
  });
}
