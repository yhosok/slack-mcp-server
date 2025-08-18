/**
 * Options for pagination
 * @template T - The type of the API response
 * @template I - The type of items in the response
 */
export interface PaginationOptions<T = unknown, I = unknown> {
  /** Maximum number of pages to fetch */
  maxPages?: number;
  /** Maximum total items to collect */
  maxItems?: number;
  /** Function to extract items from a response */
  getItems?: (response: T) => I[];
}

/**
 * Generic async generator for paginating Slack API responses.
 * Yields each page of results as they are fetched, allowing for memory-efficient
 * processing of large datasets.
 *
 * @template T - The type of the API response
 * @template I - The type of items in the response (for counting)
 * @param fetchPage - Function to fetch a single page of results
 * @param getCursor - Function to extract the cursor for the next page from a response
 * @param options - Optional pagination limits and configuration
 * @yields Each page of API response data
 *
 * @example
 * ```typescript
 * const paginator = paginateSlackAPI(
 *   (cursor) => client.conversations.history({ channel, cursor }),
 *   (res) => res.response_metadata?.next_cursor,
 *   { maxPages: 5, maxItems: 500 }
 * );
 *
 * for await (const page of paginator) {
 *   console.log(`Got ${page.messages.length} messages`);
 * }
 * ```
 */
export async function* paginateSlackAPI<T, I = unknown>(
  fetchPage: (cursor?: string) => Promise<T>,
  getCursor: (response: T) => string | undefined,
  options?: PaginationOptions<T, I>
): AsyncGenerator<T, void, unknown> {
  let cursor: string | undefined;
  let pageCount = 0;
  let totalItems = 0;

  do {
    // Fetch the next page
    const response = await fetchPage(cursor);
    yield response;

    pageCount++;

    // Track total items if a getter is provided
    if (options?.getItems) {
      const items = options.getItems(response);
      totalItems += items.length;
    }

    // Check if we've reached limits
    if (options?.maxPages && pageCount >= options.maxPages) {
      break;
    }

    if (options?.maxItems && totalItems >= options.maxItems) {
      break;
    }

    // Get the cursor for the next page
    cursor = getCursor(response);
  } while (cursor);
}

/**
 * Collect all pages from an async generator into a single array.
 * This function accumulates all items in memory, so use with caution for large datasets.
 *
 * @template T - The type of the API response
 * @template I - The type of items being collected
 * @param generator - The async generator producing pages of data
 * @param getItems - Function to extract items from each page
 * @param maxItems - Optional maximum number of items to collect
 * @returns Object containing all collected items and the total page count
 *
 * @example
 * ```typescript
 * const generator = paginateSlackAPI(fetchPage, getCursor);
 * const { items, pageCount } = await collectAllPages(
 *   generator,
 *   (page) => page.messages,
 *   1000 // Limit to 1000 items
 * );
 * ```
 */
export async function collectAllPages<T, I>(
  generator: AsyncGenerator<T, void, unknown>,
  getItems: (response: T) => I[],
  maxItems?: number
): Promise<{ items: I[]; pageCount: number }> {
  const allItems: I[] = [];
  let pageCount = 0;

  for await (const page of generator) {
    const items = getItems(page);
    allItems.push(...items);
    pageCount++;

    if (maxItems && allItems.length >= maxItems) {
      // Trim to exact maxItems if we've exceeded
      allItems.length = maxItems;
      break;
    }
  }

  return {
    items: allItems,
    pageCount,
  };
}
