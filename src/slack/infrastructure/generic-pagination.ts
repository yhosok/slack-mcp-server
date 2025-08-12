/**
 * Generic pagination configuration interface for unified pagination handling.
 * Based on Refactoring Guru's "Extract Method" pattern to eliminate code duplication
 * across service layers.
 */

import { paginateSlackAPI, collectAllPages } from './pagination-helper.js';
import { applyPaginationSafetyDefaults } from '../../utils/validation.js';

/**
 * Configuration object for generic pagination handling.
 * This interface defines the contract for unified pagination processing.
 * 
 * @template T - The type of the API response from Slack
 * @template I - The type of individual items in the response
 * @template F - The type of the formatted response
 */
/**
 * Input interface for pagination operations that ensures type safety
 * while allowing service-specific fields to be passed through.
 */
export interface PaginationInput {
  /** Whether to fetch all pages automatically */
  fetch_all_pages?: boolean;
  /** Cursor for pagination continuation */
  cursor?: string;
  /** Maximum number of pages to fetch (1-100) */
  max_pages?: number;
  /** Maximum total items to retrieve (1-10000) */
  max_items?: number;
  /** Allow service-specific fields to be passed through */
  [key: string]: any;
}

export interface PaginationConfig<T, I, F> {
  /** Function to fetch a single page from Slack API */
  fetchPage: (cursor?: string) => Promise<T>;
  
  /** Function to extract cursor for next page from API response */
  getCursor: (response: T) => string | undefined;
  
  /** Function to extract items array from API response */
  getItems: (response: T) => I[];
  
  /** Function to format the final consolidated response */
  formatResponse: (data: {
    items: I[];
    pageCount: number;
    hasMore: boolean;
    cursor?: string;
    totalItems?: number;
  }) => F;
}

/**
 * Unified pagination execution function that eliminates duplicate fetch_all_pages logic
 * across all service layers. This follows the DRY principle and provides consistent
 * pagination behavior throughout the application.
 * 
 * @template T - API response type
 * @template I - Item type
 * @template F - Formatted response type
 * @param input - The validated input containing pagination options
 * @param config - Configuration object defining pagination behavior
 * @returns Promise resolving to formatted response
 * 
 * @example
 * ```typescript
 * // Usage in message service
 * const result = await executePagination(input, {
 *   fetchPage: (cursor) => client.conversations.history({ channel: input.channel, cursor }),
 *   getCursor: (response) => response.response_metadata?.next_cursor,
 *   getItems: (response) => response.messages || [],
 *   formatResponse: (data) => formatChannelHistoryResponse(data, userService.getDisplayName)
 * });
 * ```
 */
/**
 * Unified pagination execution function that eliminates duplicate fetch_all_pages logic
 * across all service layers. This follows the DRY principle and provides consistent
 * pagination behavior throughout the application.
 * 
 * @template T - API response type
 * @template I - Item type
 * @template F - Formatted response type
 * @param input - The validated input containing pagination options
 * @param config - Configuration object defining pagination behavior
 * @returns Promise resolving to formatted response
 * 
 * @example
 * ```typescript
 * // Usage in message service
 * const result = await executePagination(input, {
 *   fetchPage: (cursor) => client.conversations.history({ channel: input.channel, cursor }),
 *   getCursor: (response) => response.response_metadata?.next_cursor,
 *   getItems: (response) => response.messages || [],
 *   formatResponse: (data) => formatChannelHistoryResponse(data, userService.getDisplayName)
 * });
 * ```
 */
export async function executePagination<T, I, F>(
  input: PaginationInput,
  config: PaginationConfig<T, I, F>
): Promise<F> {
  // Handle fetch_all_pages option with safety defaults
  if (input.fetch_all_pages) {
    // Apply automatic safety defaults if not explicitly overridden
    const safeInput = applyPaginationSafetyDefaults(input);
    
    // Create async generator for paginated API calls
    const generator = paginateSlackAPI(config.fetchPage, config.getCursor, {
      maxPages: safeInput.max_pages,
      maxItems: safeInput.max_items,
      getItems: config.getItems,
    });

    // Collect all pages into consolidated result
    const { items: allItems, pageCount } = await collectAllPages(
      generator,
      config.getItems,
      safeInput.max_items
    );

    // Format and return consolidated response
    return config.formatResponse({
      items: allItems,
      pageCount,
      hasMore: false,
      cursor: undefined,
      totalItems: allItems.length,
    });
  }

  // Single page logic: fetch one page and format response
  const result = await config.fetchPage(input.cursor);
  const items = config.getItems(result);
  const cursor = config.getCursor(result);
  
  return config.formatResponse({
    items,
    pageCount: 1,
    hasMore: Boolean(cursor),
    cursor,
    totalItems: items.length,
  });
}