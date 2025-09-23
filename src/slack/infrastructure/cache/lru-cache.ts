/**
 * @fileoverview LRU Cache wrapper implementation with TTL, metrics, and advanced features
 * 
 * Provides a comprehensive wrapper around the lru-cache library with:
 * - Type-safe configuration and operations
 * - TTL (Time-To-Live) functionality with per-entry customization
 * - Memory management with size calculation functions
 * - Comprehensive metrics tracking (hits, misses, hit rate, memory usage)
 * - LRU eviction behavior with access order updates
 * - Dispose callbacks for cleanup operations
 * - Error handling and validation
 * 
 * Created: 2025-08-19
 * TDD Green Phase: Implementation to make comprehensive tests pass
 */

import { LRUCache } from 'lru-cache';

/**
 * Configuration interface for LRU Cache wrapper
 */
export interface LRUCacheConfig<K = string, V = unknown> {
  /** Maximum number of items (required) */
  max: number;
  
  /** Default TTL in milliseconds (optional) */
  ttl?: number;
  
  /** Update access order on get operations (default: true) */
  updateAgeOnGet?: boolean;
  
  /** Function to calculate size of values for memory-based eviction */
  sizeCalculation?: (value: V, key: K) => number;
  
  /** Callback function called when items are disposed (evicted/deleted) */
  dispose?: (value: V, key: K, reason: 'evict' | 'set' | 'delete') => void;
  
  /** Maximum total size in bytes (optional, requires sizeCalculation) */
  maxSize?: number;
  
  /** Allow stale entries to be returned (default: false) */
  allowStale?: boolean;
  
  /** Don't call dispose callback on set operations (default: false) */
  noDisposeOnSet?: boolean;
}

/**
 * Interface for cache performance metrics
 */
export interface CacheMetrics {
  /** Total number of cache hits */
  hits: number;
  
  /** Total number of cache misses */
  misses: number;
  
  /** Total number of set operations */
  sets: number;
  
  /** Total number of delete operations */
  deletes: number;
  
  /** Total number of eviction operations */
  evictions: number;
  
  /** Hit rate as percentage (0-100) */
  hitRate: number;
  
  /** Current memory usage in bytes */
  memoryUsage: number;
  
  /** Current number of items in cache */
  size: number;
}

/**
 * Options for set operations
 */
export interface SetOptions {
  /** Custom TTL for this entry in milliseconds */
  ttl?: number;
}

/**
 * LRU Cache wrapper class providing advanced caching functionality
 * 
 * This class wraps the lru-cache library to provide:
 * - Type safety with TypeScript generics
 * - Comprehensive metrics tracking
 * - TTL support with per-entry customization
 * - Memory management and size-based eviction
 * - Dispose callbacks for cleanup operations
 * - Error handling and validation
 */
// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export class LRUCacheWrapper<K extends {} = string, V = unknown> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private readonly cache: LRUCache<any, any>;
  private readonly config: LRUCacheConfig<K, V>;
  
  // Metrics tracking
  private metrics: {
    hits: number;
    misses: number;
    sets: number;
    deletes: number;
    evictions: number;
  } = {
    hits: 0,
    misses: 0,
    sets: 0,
    deletes: 0,
    evictions: 0
  };

  /**
   * Create a new LRU Cache wrapper instance
   * 
   * @param config - Cache configuration options
   * @throws {Error} When configuration is invalid
   */
  constructor(config: LRUCacheConfig<K, V>) {
    this.validateConfig(config);
    this.config = { ...config };
    
    // Create enhanced dispose callback that tracks evictions
    const originalDispose = config.dispose;
    const enhancedDispose = originalDispose ? 
      (value: V, key: K, reason: 'evict' | 'set' | 'delete'): void => {
        if (reason === 'evict') {
          this.metrics.evictions++;
        }
        originalDispose(value, key, reason);
      } : 
      (value: V, key: K, reason: 'evict' | 'set' | 'delete'): void => {
        if (reason === 'evict') {
          this.metrics.evictions++;
        }
      };

    // Map our configuration to lru-cache options
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const cacheOptions: any = {
      max: config.max,
      ttl: config.ttl,
      updateAgeOnGet: config.updateAgeOnGet ?? true,
      allowStale: config.allowStale ?? false,
      noDisposeOnSet: config.noDisposeOnSet ?? false,
      dispose: enhancedDispose,
      ttlAutopurge: true, // Required when TTL is used
    };

    // Add size-related options if provided
    if (config.sizeCalculation) {
      cacheOptions.sizeCalculation = config.sizeCalculation;
    }
    
    if (config.maxSize !== undefined) {
      cacheOptions.maxSize = config.maxSize;
    }

    this.cache = new LRUCache(cacheOptions);
  }

  /**
   * Validate cache configuration
   * 
   * @param config - Configuration to validate
   * @throws {Error} When configuration is invalid
   */
  private validateConfig(config: LRUCacheConfig<K, V>): void {
    if (!config.max || config.max <= 0) {
      throw new Error('max must be a positive number');
    }
    
    if (config.ttl !== undefined && config.ttl < 0) {
      throw new Error('ttl must be non-negative');
    }
    
    if (config.maxSize !== undefined && config.maxSize < 0) {
      throw new Error('maxSize must be non-negative');
    }
    
    if (config.sizeCalculation && !config.maxSize) {
      throw new Error('sizeCalculation requires maxSize to be set');
    }
  }

  /**
   * Set a key-value pair in the cache
   * 
   * @param key - The key to set
   * @param value - The value to associate with the key
   * @param options - Optional settings for this operation
   * @returns true if the item was stored, false otherwise
   */
  set(key: K, value: V, options?: SetOptions): boolean {
    try {
      this.metrics.sets++;
      
      const cacheOptions = options?.ttl !== undefined ? { ttl: options.ttl } : {};
      
      this.cache.set(key, value, cacheOptions);
      return true;
    } catch {
      // Handle potential serialization errors gracefully
      return false;
    }
  }

  /**
   * Get a value from the cache
   * 
   * @param key - The key to retrieve
   * @returns The value associated with the key, or undefined if not found
   */
  get(key: K): V | undefined {
    const value = this.cache.get(key);
    
    if (value !== undefined) {
      this.metrics.hits++;
    } else {
      this.metrics.misses++;
    }
    
    return value;
  }

  /**
   * Check if a key exists in the cache
   * 
   * @param key - The key to check
   * @returns true if the key exists, false otherwise
   */
  has(key: K): boolean {
    return this.cache.has(key);
  }

  /**
   * Delete a key from the cache
   * 
   * @param key - The key to delete
   * @returns true if the key was deleted, false if it didn't exist
   */
  delete(key: K): boolean {
    const existed = this.cache.has(key);
    const deleted = this.cache.delete(key);
    
    if (existed && deleted) {
      this.metrics.deletes++;
    }
    
    return deleted;
  }

  /**
   * Clear all entries from the cache
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * Get current cache metrics and statistics
   * 
   * @returns Comprehensive cache metrics
   */
  getMetrics(): CacheMetrics {
    const totalOperations = this.metrics.hits + this.metrics.misses;
    const hitRate = totalOperations > 0 ? (this.metrics.hits / totalOperations) * 100 : 0;
    
    // Calculate memory usage if size calculation is available
    let memoryUsage = 0;
    if (this.config.sizeCalculation) {
      // Use calculatedSize if available on the cache instance
      const cacheWithSize = this.cache as { calculatedSize?: number };
      memoryUsage = cacheWithSize.calculatedSize || 0;
    }

    return {
      hits: this.metrics.hits,
      misses: this.metrics.misses,
      sets: this.metrics.sets,
      deletes: this.metrics.deletes,
      evictions: this.metrics.evictions,
      hitRate: Math.round(hitRate * 100) / 100, // Round to 2 decimal places
      memoryUsage,
      size: this.cache.size
    };
  }

  /**
   * Reset all metrics counters to zero
   */
  resetMetrics(): void {
    this.metrics = {
      hits: 0,
      misses: 0,
      sets: 0,
      deletes: 0,
      evictions: 0
    };
  }

  /**
   * Purge stale entries from the cache
   * 
   * This method removes expired entries that haven't been accessed recently.
   * It's useful for manual cleanup when you want to free memory immediately
   * rather than waiting for lazy cleanup.
   */
  purgeStale(): void {
    // The lru-cache library handles stale entry cleanup automatically
    // However, we can force a cleanup by accessing the internal purgeStale method
    const cacheWithPurge = this.cache as unknown as { purgeStale?: () => number };
    if (typeof cacheWithPurge.purgeStale === 'function') {
      cacheWithPurge.purgeStale();
    }
  }

  /**
   * Get the current size of the cache
   * 
   * @returns Number of items currently in the cache
   */
  get size(): number {
    return this.cache.size;
  }

  /**
   * Get the maximum number of items the cache can hold
   * 
   * @returns Maximum cache capacity
   */
  get max(): number {
    return this.cache.max;
  }

  /**
   * Get the default TTL for cache entries
   * 
   * @returns Default TTL in milliseconds, or undefined if not set
   */
  get ttl(): number | undefined {
    const cacheWithTTL = this.cache as unknown as { getRemainingTTL?: (key: K) => number; ttl?: number };
    return cacheWithTTL.ttl;
  }
}

// Types are already exported inline above