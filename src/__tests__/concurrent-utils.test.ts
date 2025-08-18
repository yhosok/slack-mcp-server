/**
 * Tests for concurrent processing utilities
 */

import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import {
  processConcurrently,
  processConcurrentlyInBatches,
  mapConcurrently,
  filterConcurrently,
  createSimpleCache,
} from '../slack/infrastructure/concurrent-utils.js';

// Mock configuration to avoid environment dependencies
jest.mock('../config/index.js', () => ({
  CONFIG: {
    SLACK_BOT_TOKEN: 'xoxb-mock-token',
    LOG_LEVEL: 'warn'
  }
}));

// Mock logger to avoid config dependencies
jest.mock('../utils/logger.js', () => ({
  logger: {
    warn: jest.fn(),
    error: jest.fn(),
    info: jest.fn(),
    debug: jest.fn()
  }
}));

describe('Concurrent Processing Utilities', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Suppress console logs during tests
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  describe('processConcurrently', () => {
    it('should process items concurrently and return successful results', async () => {
      const items = [1, 2, 3, 4, 5];
      const processor = jest.fn<(item: number, index: number) => Promise<number>>().mockImplementation(async (item: number) => item * 2);

      const result = await processConcurrently(items, processor);

      expect(result.results).toEqual([2, 4, 6, 8, 10]);
      expect(result.errors).toHaveLength(0);
      expect(result.totalProcessed).toBe(5);
      expect(result.successCount).toBe(5);
      expect(result.errorCount).toBe(0);
      expect(processor).toHaveBeenCalledTimes(5);
    });

    it('should handle errors gracefully when failFast is false', async () => {
      const items = [1, 2, 3, 4, 5];
      const processor = jest.fn<(item: number, index: number) => Promise<number>>().mockImplementation(async (item: number) => {
        if (item === 3) {
          throw new Error(`Error processing ${item}`);
        }
        return item * 2;
      });

      const result = await processConcurrently(items, processor, { failFast: false });

      expect(result.results).toEqual([2, 4, 8, 10]);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]?.index).toBe(2);
      expect(result.errors[0]?.error.message).toBe('Error processing 3');
      expect(result.totalProcessed).toBe(5);
      expect(result.successCount).toBe(4);
      expect(result.errorCount).toBe(1);
    });

    it('should throw error immediately when failFast is true', async () => {
      const items = [1, 2, 3, 4, 5];
      const processor = jest.fn<(item: number, index: number) => Promise<number>>().mockImplementation(async (item: number) => {
        if (item === 3) {
          throw new Error(`Error processing ${item}`);
        }
        return item * 2;
      });

      await expect(
        processConcurrently(items, processor, { failFast: true })
      ).rejects.toThrow('Error processing 3');
    });

    it('should respect concurrency limits', async () => {
      const items = [1, 2, 3, 4, 5];
      let activeCount = 0;
      let maxActiveCount = 0;

      const processor = jest.fn<(item: number, index: number) => Promise<number>>().mockImplementation(async (item: number) => {
        activeCount++;
        maxActiveCount = Math.max(maxActiveCount, activeCount);
        
        // Simulate async work
        await new Promise(resolve => setTimeout(resolve, 10));
        
        activeCount--;
        return item * 2;
      });

      await processConcurrently(items, processor, { concurrency: 2 });

      expect(maxActiveCount).toBeLessThanOrEqual(2);
    });

    it('should call custom error handler', async () => {
      const items = [1, 2, 3];
      const errorHandler = jest.fn();
      const processor = jest.fn<(item: number, index: number) => Promise<number>>().mockImplementation(async (item: number) => {
        if (item === 2) {
          throw new Error(`Error processing ${item}`);
        }
        return item * 2;
      });

      await processConcurrently(items, processor, { 
        failFast: false, 
        errorHandler 
      });

      expect(errorHandler).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'Error processing 2' }),
        1
      );
    });
  });

  describe('processConcurrentlyInBatches', () => {
    it('should process items in batches', async () => {
      const items = Array.from({ length: 10 }, (_, i) => i + 1);
      const processor = jest.fn<(item: number, index: number) => Promise<number>>().mockImplementation(async (item: number) => item * 2);

      const result = await processConcurrentlyInBatches(
        items, 
        processor, 
        3, // batch size
        { concurrency: 2 }
      );

      expect(result.results).toEqual([2, 4, 6, 8, 10, 12, 14, 16, 18, 20]);
      expect(result.totalProcessed).toBe(10);
      expect(result.successCount).toBe(10);
      expect(processor).toHaveBeenCalledTimes(10);
    });

    it('should handle errors across batches', async () => {
      const items = [1, 2, 3, 4, 5, 6];
      const processor = jest.fn<(item: number, index: number) => Promise<number>>().mockImplementation(async (item: number) => {
        if (item === 2 || item === 5) {
          throw new Error(`Error processing ${item}`);
        }
        return item * 2;
      });

      const result = await processConcurrentlyInBatches(
        items, 
        processor, 
        3, // batch size
        { failFast: false }
      );

      expect(result.results).toEqual([2, 6, 8, 12]);
      expect(result.errors).toHaveLength(2);
      expect(result.errorCount).toBe(2);
      expect(result.successCount).toBe(4);
    });
  });

  describe('mapConcurrently', () => {
    it('should map items preserving order', async () => {
      const items = [1, 2, 3, 4, 5];
      const mapper = jest.fn<(item: number, index: number) => Promise<number>>().mockImplementation(async (item: number) => item * 2);

      const result = await mapConcurrently(items, mapper);

      expect(result).toEqual([2, 4, 6, 8, 10]);
    });

    it('should return undefined for failed items', async () => {
      const items = [1, 2, 3, 4, 5];
      const mapper = jest.fn<(item: number, index: number) => Promise<number>>().mockImplementation(async (item: number) => {
        if (item === 3) {
          throw new Error(`Error processing ${item}`);
        }
        return item * 2;
      });

      const result = await mapConcurrently(items, mapper, { failFast: false });

      expect(result).toEqual([2, 4, undefined, 8, 10]);
    });
  });

  describe('filterConcurrently', () => {
    it('should filter items concurrently', async () => {
      const items = [1, 2, 3, 4, 5, 6];
      const predicate = jest.fn<(item: number, index: number) => Promise<boolean>>().mockImplementation(async (item: number) => item % 2 === 0);

      const result = await filterConcurrently(items, predicate);

      expect(result).toEqual([2, 4, 6]);
      expect(predicate).toHaveBeenCalledTimes(6);
    });

    it('should handle predicate failures', async () => {
      const items = [1, 2, 3, 4, 5];
      const predicate = jest.fn<(item: number, index: number) => Promise<boolean>>().mockImplementation(async (item: number) => {
        if (item === 3) {
          throw new Error(`Error checking ${item}`);
        }
        return item % 2 === 0;
      });

      const result = await filterConcurrently(items, predicate, { failFast: false });

      expect(result).toEqual([2, 4]); // Item 3 filtered out due to error
    });
  });

  describe('createSimpleCache', () => {
    it('should cache and retrieve values', () => {
      const cache = createSimpleCache<string, number>();

      cache.set('key1', 100);
      cache.set('key2', 200);

      expect(cache.get('key1')).toBe(100);
      expect(cache.get('key2')).toBe(200);
      expect(cache.get('nonexistent')).toBeUndefined();
    });

    it('should expire values after TTL', async () => {
      const cache = createSimpleCache<string, number>(50); // 50ms TTL

      cache.set('key1', 100);
      expect(cache.get('key1')).toBe(100);

      // Wait for expiration
      await new Promise(resolve => setTimeout(resolve, 60));

      expect(cache.get('key1')).toBeUndefined();
    });

    it('should clear all cached values', () => {
      const cache = createSimpleCache<string, number>();

      cache.set('key1', 100);
      cache.set('key2', 200);
      
      expect(cache.size()).toBe(2);
      
      cache.clear();
      
      expect(cache.size()).toBe(0);
      expect(cache.get('key1')).toBeUndefined();
      expect(cache.get('key2')).toBeUndefined();
    });

    it('should clean expired entries when checking size', async () => {
      const cache = createSimpleCache<string, number>(50); // 50ms TTL

      cache.set('key1', 100);
      cache.set('key2', 200);
      
      expect(cache.size()).toBe(2);

      // Wait for expiration
      await new Promise(resolve => setTimeout(resolve, 60));

      // Size check should clean expired entries
      expect(cache.size()).toBe(0);
    });
  });

  describe('Performance Characteristics', () => {
    it('should process items faster with higher concurrency', async () => {
      const items = Array.from({ length: 20 }, (_, i) => i + 1);
      const delayMs = 50;
      
      const processor = jest.fn<(item: number, index: number) => Promise<number>>().mockImplementation(async (item: number) => {
        await new Promise(resolve => setTimeout(resolve, delayMs));
        return item * 2;
      });

      // Low concurrency
      const start1 = Date.now();
      await processConcurrently([...items], processor, { concurrency: 1 });
      const duration1 = Date.now() - start1;

      processor.mockClear();

      // High concurrency
      const start2 = Date.now();
      await processConcurrently([...items], processor, { concurrency: 5 });
      const duration2 = Date.now() - start2;

      // Higher concurrency should be significantly faster
      expect(duration2).toBeLessThan(duration1 * 0.5);
    });
  });
});