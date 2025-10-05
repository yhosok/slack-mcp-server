/**
 * Tests for date conversion utilities
 * Following TDD: These tests are written FIRST and should FAIL until implementation is complete
 */

import { describe, expect, test } from '@jest/globals';
import {
  convertDateToTimestamp,
  isValidDateFormat,
  isTimestampFormat,
} from '../utils/date-converter.js';

describe('date-converter', () => {
  describe('convertDateToTimestamp', () => {
    test('converts valid date to start of day timestamp (00:00:00 UTC)', () => {
      const result = convertDateToTimestamp('2025-09-10', false);
      // 2025-09-10 00:00:00 UTC = 1757462400 seconds since epoch
      expect(result).toBe('1757462400');
    });

    test('converts valid date to end of day timestamp (23:59:59 UTC)', () => {
      const result = convertDateToTimestamp('2025-09-10', true);
      // 2025-09-10 23:59:59 UTC = 1757548799 seconds since epoch
      expect(result).toBe('1757548799');
    });

    test('handles leap year date correctly', () => {
      const result = convertDateToTimestamp('2024-02-29', false);
      // 2024-02-29 00:00:00 UTC (valid leap year date)
      expect(result).toBe('1709164800');
    });

    test('handles month boundaries correctly', () => {
      // Last day of month
      const endOfMonth = convertDateToTimestamp('2025-01-31', true);
      expect(endOfMonth).toBe('1738367999');

      // First day of next month
      const startOfNextMonth = convertDateToTimestamp('2025-02-01', false);
      expect(startOfNextMonth).toBe('1738368000');

      // Verify they are consecutive
      expect(Number(startOfNextMonth) - Number(endOfMonth)).toBe(1);
    });

    test('handles year boundaries correctly', () => {
      // Last day of year
      const endOfYear = convertDateToTimestamp('2025-12-31', true);
      expect(endOfYear).toBe('1767225599');

      // First day of next year
      const startOfNextYear = convertDateToTimestamp('2026-01-01', false);
      expect(startOfNextYear).toBe('1767225600');

      // Verify they are consecutive
      expect(Number(startOfNextYear) - Number(endOfYear)).toBe(1);
    });

    test('throws error for invalid date format', () => {
      expect(() => convertDateToTimestamp('2025/09/10', false)).toThrow('Invalid date format');
      expect(() => convertDateToTimestamp('09-10-2025', false)).toThrow('Invalid date format');
      expect(() => convertDateToTimestamp('2025-9-10', false)).toThrow('Invalid date format');
      expect(() => convertDateToTimestamp('not-a-date', false)).toThrow('Invalid date format');
    });

    test('throws error for invalid date values', () => {
      expect(() => convertDateToTimestamp('2025-02-30', false)).toThrow('Invalid date');
      expect(() => convertDateToTimestamp('2025-13-01', false)).toThrow('Invalid date');
      expect(() => convertDateToTimestamp('2023-02-29', false)).toThrow('Invalid date'); // Not a leap year
    });

    test('throws error for empty or null input', () => {
      expect(() => convertDateToTimestamp('', false)).toThrow('Invalid date format');
    });
  });

  describe('isValidDateFormat', () => {
    test('returns true for valid YYYY-MM-DD format', () => {
      expect(isValidDateFormat('2025-09-10')).toBe(true);
      expect(isValidDateFormat('2024-02-29')).toBe(true);
      expect(isValidDateFormat('2025-01-01')).toBe(true);
      expect(isValidDateFormat('2025-12-31')).toBe(true);
    });

    test('returns false for invalid formats', () => {
      expect(isValidDateFormat('2025/09/10')).toBe(false);
      expect(isValidDateFormat('09-10-2025')).toBe(false);
      expect(isValidDateFormat('2025-9-10')).toBe(false);
      expect(isValidDateFormat('2025-09-1')).toBe(false);
      expect(isValidDateFormat('not-a-date')).toBe(false);
      expect(isValidDateFormat('')).toBe(false);
      expect(isValidDateFormat('2025-13-01')).toBe(false); // Invalid month
      expect(isValidDateFormat('2025-02-30')).toBe(false); // Invalid day
    });

    test('returns false for non-leap year Feb 29', () => {
      expect(isValidDateFormat('2023-02-29')).toBe(false);
      expect(isValidDateFormat('2024-02-29')).toBe(true); // Leap year
    });
  });

  describe('isTimestampFormat', () => {
    test('returns true for valid Unix timestamp strings', () => {
      expect(isTimestampFormat('1725926400')).toBe(true);
      expect(isTimestampFormat('1757376000')).toBe(true);
      expect(isTimestampFormat('0')).toBe(true);
      expect(isTimestampFormat('9999999999')).toBe(true);
    });

    test('returns false for date strings', () => {
      expect(isTimestampFormat('2025-09-10')).toBe(false);
    });

    test('returns false for invalid timestamp strings', () => {
      expect(isTimestampFormat('not-a-number')).toBe(false);
      expect(isTimestampFormat('')).toBe(false);
      expect(isTimestampFormat('123.456')).toBe(false); // Decimal not allowed
      expect(isTimestampFormat('-1725926400')).toBe(false); // Negative not allowed for our use case
    });

    test('returns false for mixed formats', () => {
      expect(isTimestampFormat('2025-09-10-1725926400')).toBe(false);
    });
  });

  describe('integration tests', () => {
    test('date range covers exactly one day when using start and end of same date', () => {
      const start = convertDateToTimestamp('2025-09-10', false);
      const end = convertDateToTimestamp('2025-09-10', true);

      // Should be exactly 86399 seconds apart (23:59:59 - 00:00:00)
      expect(Number(end) - Number(start)).toBe(86399);
    });

    test('consecutive dates have correct timestamp relationship', () => {
      const day1End = convertDateToTimestamp('2025-09-10', true);
      const day2Start = convertDateToTimestamp('2025-09-11', false);

      // End of day1 and start of day2 should be 1 second apart
      expect(Number(day2Start) - Number(day1End)).toBe(1);
    });

    test('timestamp format detection works correctly with converted dates', () => {
      const timestamp = convertDateToTimestamp('2025-09-10', false);
      expect(isTimestampFormat(timestamp)).toBe(true);
      expect(isValidDateFormat(timestamp)).toBe(false);
    });
  });
});
