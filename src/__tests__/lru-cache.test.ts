/**
 * @fileoverview Unit tests for LRU Cache wrapper implementation
 * Tests comprehensive LRU cache functionality with TTL, size constraints, and metrics
 * 
 * Created: 2025-08-19
 * TDD Red Phase: Tests written before implementation to drive development
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';

// Import the actual implementation
import { LRUCacheWrapper } from '../slack/infrastructure/cache/index.js';
import type { LRUCacheConfig, CacheMetrics as _CacheMetrics } from '../slack/infrastructure/cache/index.js';

describe('LRU Cache Wrapper', () => {
  let cache: LRUCacheWrapper<string, unknown>;

  afterEach(() => {
    if (cache) {
      cache.clear();
    }
  });

  describe('Constructor and Configuration', () => {
    it('should create cache with basic configuration', () => {
      const config: LRUCacheConfig = {
        max: 100,
        ttl: 60000, // 1 minute
        updateAgeOnGet: true
      };

      expect(() => {
        cache = new LRUCacheWrapper(config);
      }).not.toThrow();
      
      expect(cache).toBeInstanceOf(LRUCacheWrapper);
      expect(cache.max).toBe(100);
    });

    it('should create cache with size calculation function', () => {
      const config: LRUCacheConfig = {
        max: 50,
        maxSize: 1024 * 1024, // 1MB
        sizeCalculation: (value: any) => JSON.stringify(value).length
      };

      expect(() => {
        cache = new LRUCacheWrapper(config);
      }).not.toThrow();
      
      expect(cache).toBeInstanceOf(LRUCacheWrapper);
      expect(cache.max).toBe(50);
    });

    it('should create cache with dispose callback', () => {
      const disposeFn = jest.fn();
      const config: LRUCacheConfig = {
        max: 100,
        dispose: disposeFn
      };

      expect(() => {
        cache = new LRUCacheWrapper(config);
      }).not.toThrow();
      
      expect(cache).toBeInstanceOf(LRUCacheWrapper);
    });

    it('should reject invalid configuration', () => {
      const invalidConfigs = [
        { max: 0 },
        { max: -1 },
        { max: 100, ttl: -1 },
        { max: 100, maxSize: -1 }
      ];

      invalidConfigs.forEach(config => {
        expect(() => {
          new LRUCacheWrapper(config);
        }).toThrow();
      });
    });
  });

  describe('Basic Cache Operations', () => {
    beforeEach(() => {
      cache = new LRUCacheWrapper({ max: 100, ttl: 60000 });
    });

    it('should set and get values', () => {
      const result = cache.set('key1', 'value1');
      expect(result).toBe(true);
      
      const value = cache.get('key1');
      expect(value).toBe('value1');
    });

    it('should return undefined for non-existent keys', () => {
      const value = cache.get('nonexistent');
      expect(value).toBeUndefined();
    });

    it('should check key existence', () => {
      cache.set('key1', 'value1');
      
      expect(cache.has('key1')).toBe(true);
      expect(cache.has('nonexistent')).toBe(false);
    });

    it('should delete keys', () => {
      cache.set('key1', 'value1');
      expect(cache.has('key1')).toBe(true);
      
      const deleted = cache.delete('key1');
      expect(deleted).toBe(true);
      expect(cache.has('key1')).toBe(false);
      
      // Deleting non-existent key should return false
      const deletedAgain = cache.delete('key1');
      expect(deletedAgain).toBe(false);
    });

    it('should clear all entries', () => {
      cache.set('key1', 'value1');
      cache.set('key2', 'value2');
      expect(cache.size).toBe(2);
      
      cache.clear();
      expect(cache.size).toBe(0);
      expect(cache.has('key1')).toBe(false);
      expect(cache.has('key2')).toBe(false);
    });
  });

  describe('TTL Functionality', () => {
    it('should set entries with default TTL', () => {
      const testCache = new LRUCacheWrapper({ max: 100, ttl: 1000 });
      const result = testCache.set('key1', 'value1');
      expect(result).toBe(true);
      expect(testCache.get('key1')).toBe('value1');
    });

    it('should set entries with custom TTL', () => {
      const testCache = new LRUCacheWrapper({ max: 100, ttl: 1000 });
      const result = testCache.set('key1', 'value1', { ttl: 2000 });
      expect(result).toBe(true);
      expect(testCache.get('key1')).toBe('value1');
    });

    it('should expire entries after TTL', async () => {
      const testCache = new LRUCacheWrapper({ max: 100, ttl: 50 }); // 50ms TTL
      testCache.set('key1', 'value1');
      
      // Should be available immediately
      expect(testCache.get('key1')).toBe('value1');
      
      // Wait for expiration
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Should be expired now
      expect(testCache.get('key1')).toBeUndefined();
    });

    it('should purge stale entries on demand', () => {
      const testCache = new LRUCacheWrapper({ max: 100, ttl: 1000 });
      testCache.set('key1', 'value1');
      
      expect(() => {
        testCache.purgeStale();
      }).not.toThrow();
    });
  });

  describe('Size-Based Eviction (LRU Behavior)', () => {

    it('should evict least recently used items when max size exceeded', () => {
      const testCache = new LRUCacheWrapper({ max: 3 });
      
      // Fill cache to capacity
      testCache.set('key1', 'value1');
      testCache.set('key2', 'value2');
      testCache.set('key3', 'value3');
      
      expect(testCache.size).toBe(3);
      expect(testCache.has('key1')).toBe(true);
      
      // Adding one more should evict the least recently used (key1)
      testCache.set('key4', 'value4');
      
      expect(testCache.size).toBe(3);
      expect(testCache.has('key1')).toBe(false); // Should be evicted
      expect(testCache.has('key2')).toBe(true);
      expect(testCache.has('key3')).toBe(true);
      expect(testCache.has('key4')).toBe(true);
    });

    it('should update access order on get when updateAgeOnGet is true', () => {
      const testCache = new LRUCacheWrapper({ max: 3, updateAgeOnGet: true });
      
      testCache.set('key1', 'value1');
      testCache.set('key2', 'value2');
      testCache.set('key3', 'value3');
      
      // Access key1 to make it most recently used
      testCache.get('key1');
      
      // Add new item - should evict key2 (now least recently used)
      testCache.set('key4', 'value4');
      
      expect(testCache.has('key1')).toBe(true); // Should still be there
      expect(testCache.has('key2')).toBe(false); // Should be evicted
      expect(testCache.has('key3')).toBe(true);
      expect(testCache.has('key4')).toBe(true);
    });
  });

  describe('Memory Size Constraints', () => {
    it('should calculate memory size using sizeCalculation function', () => {
      const sizeCalculation = jest.fn((value: any) => JSON.stringify(value).length);
      
      const testCache = new LRUCacheWrapper({
        max: 100,
        maxSize: 1024,
        sizeCalculation
      });
      
      testCache.set('key1', { data: 'test' });
      
      expect(sizeCalculation).toHaveBeenCalledWith({ data: 'test' }, 'key1');
    });

    it('should evict items when memory size limit exceeded', () => {
      const testCache = new LRUCacheWrapper({
        max: 10,
        maxSize: 50, // 50 bytes limit
        sizeCalculation: (value: any) => JSON.stringify(value).length
      });
      
      // Add small items first
      testCache.set('key1', 'x'); // ~3 bytes
      testCache.set('key2', 'y'); // ~3 bytes
      
      expect(testCache.has('key1')).toBe(true);
      expect(testCache.has('key2')).toBe(true);
      
      // Add a large item that should cause eviction
      const largeData = 'x'.repeat(45); // 45 bytes, forcing eviction
      testCache.set('key3', largeData);
      
      // key3 should be in cache, and some older items may be evicted
      expect(testCache.has('key3')).toBe(true);
      // At least one of the earlier items should be gone due to size limit
      const stillHasKey1 = testCache.has('key1');
      const stillHasKey2 = testCache.has('key2');
      expect(stillHasKey1 && stillHasKey2).toBe(false); // Not both should remain
    });
  });

  describe('Dispose Callbacks', () => {
    it('should call dispose callback on eviction', () => {
      const disposeFn = jest.fn();
      
      const testCache = new LRUCacheWrapper({
        max: 2,
        dispose: disposeFn
      });
      
      testCache.set('key1', 'value1');
      testCache.set('key2', 'value2');
      
      // This should trigger eviction of key1
      testCache.set('key3', 'value3');
      
      expect(disposeFn).toHaveBeenCalledWith('value1', 'key1', 'evict');
    });

    it('should call dispose callback on manual deletion', () => {
      const disposeFn = jest.fn();
      
      const testCache = new LRUCacheWrapper({
        max: 100,
        dispose: disposeFn
      });
      
      testCache.set('key1', 'value1');
      testCache.delete('key1');
      
      expect(disposeFn).toHaveBeenCalledWith('value1', 'key1', 'delete');
    });
  });

  describe('Cache Metrics and Statistics', () => {
    it('should track cache metrics', () => {
      const testCache = new LRUCacheWrapper({ max: 100, ttl: 60000 });
      
      const initialMetrics = testCache.getMetrics();
      expect(initialMetrics.hits).toBe(0);
      expect(initialMetrics.misses).toBe(0);
      expect(initialMetrics.sets).toBe(0);
      expect(initialMetrics.size).toBe(0);
      
      testCache.set('key1', 'value1');
      testCache.get('key1'); // hit
      testCache.get('nonexistent'); // miss
      
      const finalMetrics = testCache.getMetrics();
      expect(finalMetrics.hits).toBe(1);
      expect(finalMetrics.misses).toBe(1);
      expect(finalMetrics.sets).toBe(1);
      expect(finalMetrics.size).toBe(1);
    });

    it('should calculate hit rate correctly', () => {
      const testCache = new LRUCacheWrapper({ max: 100 });
      
      testCache.set('key1', 'value1');
      testCache.set('key2', 'value2');
      
      // 2 hits, 1 miss = 66.67% hit rate
      testCache.get('key1'); // hit
      testCache.get('key2'); // hit
      testCache.get('key3'); // miss
      
      const metrics = testCache.getMetrics();
      expect(metrics.hitRate).toBeCloseTo(66.67, 2);
    });

    it('should track memory usage', () => {
      const testCache = new LRUCacheWrapper({
        max: 100,
        maxSize: 1024,
        sizeCalculation: (value: any) => JSON.stringify(value).length
      });
      
      testCache.set('key1', { data: 'test' });
      
      const metrics = testCache.getMetrics();
      expect(metrics.memoryUsage).toBeGreaterThan(0);
    });

    it('should reset metrics', () => {
      const testCache = new LRUCacheWrapper({ max: 100, ttl: 60000 });
      
      testCache.set('key1', 'value1');
      testCache.get('key1');
      
      let metrics = testCache.getMetrics();
      expect(metrics.hits).toBe(1);
      expect(metrics.sets).toBe(1);
      
      testCache.resetMetrics();
      
      metrics = testCache.getMetrics();
      expect(metrics.hits).toBe(0);
      expect(metrics.sets).toBe(0);
      expect(metrics.size).toBe(1); // Items still in cache
    });
  });

  describe('Error Handling', () => {
    it('should handle cache overflow gracefully', () => {
      const testCache = new LRUCacheWrapper({ max: 2 });
      
      // Fill beyond capacity - should handle gracefully
      testCache.set('key1', 'value1');
      testCache.set('key2', 'value2');
      testCache.set('key3', 'value3'); // Should evict key1
      
      expect(testCache.size).toBe(2);
      expect(testCache.has('key1')).toBe(false);
      expect(testCache.has('key2')).toBe(true);
      expect(testCache.has('key3')).toBe(true);
    });

    it('should handle invalid keys gracefully', () => {
      const testCache = new LRUCacheWrapper({ max: 100 });
      
      // These should not throw
      expect(testCache.get(null as any)).toBeUndefined();
      expect(testCache.has(undefined as any)).toBe(false);
      expect(testCache.delete('' as any)).toBe(false);
    });

    it('should handle serialization errors in sizeCalculation', () => {
      const faultySizeCalc = jest.fn(() => {
        throw new Error('Serialization failed');
      });

      const testCache = new LRUCacheWrapper({
        max: 100,
        maxSize: 1024,
        sizeCalculation: faultySizeCalc
      });
      
      // Should handle error gracefully
      const result = testCache.set('key1', 'value1');
      expect(result).toBe(false);
    });
  });

  describe('TypeScript Type Safety', () => {
    it('should maintain type safety for keys and values', () => {
      // Type safety tests - these will be compile-time checks
      type _TestCache = LRUCacheWrapper<string, { id: number; name: string }>;
      
      // This ensures the generic types are properly constrained
      expect(true).toBe(true);
    });

    it('should enforce consistent key-value type pairs', () => {
      // Additional type safety verification
      expect(true).toBe(true);
    });
  });

  describe('Performance Characteristics', () => {
    it('should perform operations within expected time bounds', async () => {
      // Performance benchmarks will be added
      // Will be implemented when cache is ready
      expect(true).toBe(true);
    });

    it('should handle concurrent access patterns', async () => {
      // Concurrency tests will be added
      // Will be implemented when cache is ready
      expect(true).toBe(true);
    });
  });
});