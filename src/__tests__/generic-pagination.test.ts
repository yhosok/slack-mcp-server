/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { describe, it, expect, jest } from '@jest/globals';
import {
  executePagination,
  type PaginationConfig,
} from '../slack/infrastructure/generic-pagination.js';
import type { MCPToolResult } from '../mcp/types.js';

// Mock pagination helper module
jest.mock('../slack/infrastructure/pagination-helper.js', () => ({
  paginateSlackAPI: jest.fn(),
  collectAllPages: jest.fn(() => Promise.resolve({ items: [], pageCount: 1 })),
}));

// Mock validation utilities
jest.mock('../utils/validation.js', () => ({
  applyPaginationSafetyDefaults: jest.fn((input: any) => ({
    ...input,
    max_pages: input.max_pages || 10,
    max_items: input.max_items || 1000,
  })),
}));

describe('Generic Pagination Type Tests', () => {
  interface MockApiResponse {
    messages: any[];
    response_metadata?: { next_cursor?: string };
  }

  interface MockItem {
    id: string;
    text: string;
  }

  describe('executePagination type compatibility', () => {
    it('should handle synchronous formatResponse functions', async () => {
      const config: PaginationConfig<MockApiResponse, MockItem, { result: string }> = {
        fetchPage: jest.fn(() =>
          Promise.resolve({
            messages: [{ id: '1', text: 'test' }],
            response_metadata: {},
          })
        ),
        getCursor: () => undefined,
        getItems: (response) => response.messages || [],
        formatResponse: (data) => ({
          result: `Found ${data.items.length} items`,
        }),
      };

      const result = await executePagination({}, config);
      expect(result.result).toBe('Found 1 items');
    });

    it('should handle asynchronous formatResponse functions', async () => {
      const config: PaginationConfig<MockApiResponse, MockItem, Promise<MCPToolResult>> = {
        fetchPage: jest.fn(() =>
          Promise.resolve({
            messages: [{ id: '1', text: 'test' }],
            response_metadata: {},
          })
        ),
        getCursor: () => undefined,
        getItems: (response) => response.messages || [],
        formatResponse: async (data) => {
          // Simulate async formatting (e.g., user lookup)
          await new Promise((resolve) => setTimeout(resolve, 10));
          return {
            content: [
              {
                type: 'text',
                text: `Async result: ${data.items.length} items`,
              },
            ],
          };
        },
      };

      // This should fail with current type definition but work after fix
      const result = await executePagination({}, config);
      expect(result).toBeDefined();
      expect(result.content).toBeDefined();
      expect(result.content.length).toBeGreaterThan(0);
    });

    it('should handle mixed async/sync formatter usage patterns', async () => {
      // Test case representing current real usage patterns

      // Pattern 1: Sync formatter returning object directly (workspace, files)
      const syncConfig: PaginationConfig<MockApiResponse, MockItem, { data: any[] }> = {
        fetchPage: jest.fn(() => Promise.resolve({ messages: [], response_metadata: {} })),
        getCursor: () => undefined,
        getItems: (response) => response.messages || [],
        formatResponse: (data) => ({ data: data.items }),
      };

      // Pattern 2: Async formatter returning Promise<MCPToolResult> (messages, threads)
      const asyncConfig: PaginationConfig<MockApiResponse, MockItem, Promise<MCPToolResult>> = {
        fetchPage: jest.fn(() => Promise.resolve({ messages: [], response_metadata: {} })),
        getCursor: () => undefined,
        getItems: (response) => response.messages || [],
        formatResponse: async (data) => ({
          content: [{ type: 'text', text: `Async: ${data.items.length}` }],
        }),
      };

      // Both should work after type fix
      const syncResult = await executePagination({}, syncConfig);
      const asyncResult = await executePagination({}, asyncConfig);

      expect(syncResult.data).toEqual([]);
      expect(asyncResult.content).toBeDefined();
      expect(asyncResult.content.length).toBeGreaterThan(0);
    });
  });

  describe('real service patterns reproduction', () => {
    it('should reproduce message-service pattern (missing await)', async () => {
      // This reproduces the actual pattern from message-service.ts
      const messageServicePattern = {
        fetchPage: jest.fn(() =>
          Promise.resolve({
            messages: [{ id: '1', text: 'message' }],
            response_metadata: {},
          })
        ),
        getCursor: () => undefined,
        getItems: (response: any) => response.messages || [],
        formatResponse: (data: any) => {
          // This should be await formatChannelHistoryResponse(...) but isn't
          return Promise.resolve({
            content: [{ type: 'text', text: `Messages: ${data.items.length}` }],
          });
        },
      };

      // This creates Promise<Promise<MCPToolResult>> instead of Promise<MCPToolResult>
      const result = await executePagination({}, messageServicePattern);

      // After fix, this should work properly
      expect(result).toBeDefined();
      expect(result.content).toBeDefined();
      expect(result.content.length).toBeGreaterThan(0);
    });

    it('should reproduce thread-service findThreadsInChannel pattern (correct await)', async () => {
      // This reproduces the pattern from thread-service.ts findThreadsInChannel
      const threadServicePattern = {
        fetchPage: jest.fn(() =>
          Promise.resolve({
            messages: [{ id: '1', text: 'thread parent' }],
            response_metadata: {},
          })
        ),
        getCursor: () => undefined,
        getItems: (response: any) => response.messages || [],
        formatResponse: async (data: any) => {
          // This correctly uses await
          return await Promise.resolve({
            content: [{ type: 'text', text: `Threads: ${data.items.length}` }],
          });
        },
      };

      const result = await executePagination({}, threadServicePattern);
      expect(result).toBeDefined();
      expect(result.content).toBeDefined();
      expect(result.content.length).toBeGreaterThan(0);
    });
  });
});
