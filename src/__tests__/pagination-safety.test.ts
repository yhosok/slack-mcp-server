/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { describe, it, expect } from '@jest/globals';
import { applyPaginationSafetyDefaults } from '../utils/validation.js';

describe('Pagination Safety Defaults', () => {
  describe('applyPaginationSafetyDefaults', () => {
    it('should not modify input when fetch_all_pages is false', () => {
      const input = {
        channel: 'C123456789',
        fetch_all_pages: false,
      };
      
      const result = applyPaginationSafetyDefaults(input);
      
      expect(result).toEqual(input);
      expect(result.max_pages).toBeUndefined();
      expect(result.max_items).toBeUndefined();
    });

    it('should not modify input when fetch_all_pages is undefined', () => {
      const input = {
        channel: 'C123456789',
      };
      
      const result = applyPaginationSafetyDefaults(input);
      
      expect(result).toEqual(input);
      expect(result.max_pages).toBeUndefined();
      expect(result.max_items).toBeUndefined();
    });

    it('should apply default limits when fetch_all_pages is true and limits are not specified', () => {
      const input = {
        channel: 'C123456789',
        fetch_all_pages: true,
      };
      
      const result = applyPaginationSafetyDefaults(input);
      
      expect(result.fetch_all_pages).toBe(true);
      expect(result.max_pages).toBe(10);
      expect(result.max_items).toBe(1000);
    });

    it('should preserve explicit max_pages when provided', () => {
      const input = {
        channel: 'C123456789',
        fetch_all_pages: true,
        max_pages: 5,
      };
      
      const result = applyPaginationSafetyDefaults(input);
      
      expect(result.fetch_all_pages).toBe(true);
      expect(result.max_pages).toBe(5); // Preserved
      expect(result.max_items).toBe(1000); // Applied default
    });

    it('should preserve explicit max_items when provided', () => {
      const input = {
        channel: 'C123456789',
        fetch_all_pages: true,
        max_items: 500,
      };
      
      const result = applyPaginationSafetyDefaults(input);
      
      expect(result.fetch_all_pages).toBe(true);
      expect(result.max_pages).toBe(10); // Applied default
      expect(result.max_items).toBe(500); // Preserved
    });

    it('should preserve both explicit values when provided', () => {
      const input = {
        channel: 'C123456789',
        fetch_all_pages: true,
        max_pages: 7,
        max_items: 750,
      };
      
      const result = applyPaginationSafetyDefaults(input);
      
      expect(result.fetch_all_pages).toBe(true);
      expect(result.max_pages).toBe(7); // Preserved
      expect(result.max_items).toBe(750); // Preserved
    });

    it('should preserve other properties unchanged', () => {
      const input = {
        channel: 'C123456789',
        fetch_all_pages: true,
        limit: 50,
        cursor: 'abc123',
        oldest: '1234567890',
        latest: '1234567999',
        include_metadata: true,
      };
      
      const result = applyPaginationSafetyDefaults(input);
      
      // Safety defaults applied
      expect(result.max_pages).toBe(10);
      expect(result.max_items).toBe(1000);
      
      // Other properties preserved
      expect(result.channel).toBe('C123456789');
      expect(result.limit).toBe(50);
      expect(result.cursor).toBe('abc123');
      expect(result.oldest).toBe('1234567890');
      expect(result.latest).toBe('1234567999');
      expect(result.include_metadata).toBe(true);
    });

    it('should not mutate the original input object', () => {
      const input = {
        channel: 'C123456789',
        fetch_all_pages: true,
      };
      
      const originalInput = { ...input };
      const result = applyPaginationSafetyDefaults(input);
      
      // Original input should be unchanged
      expect(input).toEqual(originalInput);
      
      // Result should be different
      expect(result).not.toBe(input);
      expect(result.max_pages).toBe(10);
      expect(result.max_items).toBe(1000);
    });

    it('should handle edge case values correctly', () => {
      const input = {
        channel: 'C123456789',
        fetch_all_pages: true,
        max_pages: 0, // Explicit 0 should be preserved
        max_items: null as any, // null should trigger default
      };
      
      const result = applyPaginationSafetyDefaults(input);
      
      expect(result.max_pages).toBe(0); // Preserved (even though it's 0)
      expect(result.max_items).toBe(1000); // Applied default (null treated as undefined)
    });

    it('should apply defaults for different service types', () => {
      const testInputs = [
        { channel: 'C123', fetch_all_pages: true }, // Channel history
        { channel: 'C123', thread_ts: '123.456', fetch_all_pages: true }, // Thread replies
        { fetch_all_pages: true }, // Files
        { include_deleted: false, fetch_all_pages: true }, // Team members
      ];
      
      testInputs.forEach(input => {
        const result = applyPaginationSafetyDefaults(input);
        expect(result.max_pages).toBe(10);
        expect(result.max_items).toBe(1000);
      });
    });
  });

  describe('Safety Rationale', () => {
    it('should prevent memory exhaustion with reasonable defaults', () => {
      // Test that defaults prevent potentially dangerous scenarios
      const dangerousInput = {
        fetch_all_pages: true,
        // No limits - could fetch unlimited data
      };
      
      const safeResult = applyPaginationSafetyDefaults(dangerousInput);
      
      // With defaults: max 10 pages * max 1000 items per page = max 10,000 items
      // This is a reasonable upper bound for most use cases
      expect(safeResult.max_pages).toBe(10);
      expect(safeResult.max_items).toBe(1000);
      
      // Calculate theoretical maximum items
      const theoreticalMax = (safeResult.max_pages || 0) * (safeResult.max_items || 0);
      expect(theoreticalMax).toBeLessThanOrEqual(10000);
    });

    it('should still allow power users to override defaults', () => {
      // Power users can still request more data if needed
      const powerUserInput = {
        fetch_all_pages: true,
        max_pages: 50, // Higher than default
        max_items: 5000, // Higher than default
      };
      
      const result = applyPaginationSafetyDefaults(powerUserInput);
      
      // Should respect user's explicit choices
      expect(result.max_pages).toBe(50);
      expect(result.max_items).toBe(5000);
    });
  });
});