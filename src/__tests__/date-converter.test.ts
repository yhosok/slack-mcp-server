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
    test('converts valid date to start of day timestamp (00:00:00 local time)', () => {
      const result = convertDateToTimestamp('2025-09-10', false);
      const date = new Date(Number(result) * 1000);

      // Verify it represents Sept 10, 2025 at 00:00:00 local time
      expect(date.getFullYear()).toBe(2025);
      expect(date.getMonth()).toBe(8); // 0-indexed: September = 8
      expect(date.getDate()).toBe(10);
      expect(date.getHours()).toBe(0);
      expect(date.getMinutes()).toBe(0);
      expect(date.getSeconds()).toBe(0);
    });

    test('converts valid date to end of day timestamp (23:59:59 local time)', () => {
      const result = convertDateToTimestamp('2025-09-10', true);
      const date = new Date(Number(result) * 1000);

      // Verify it represents Sept 10, 2025 at 23:59:59 local time
      expect(date.getFullYear()).toBe(2025);
      expect(date.getMonth()).toBe(8); // 0-indexed: September = 8
      expect(date.getDate()).toBe(10);
      expect(date.getHours()).toBe(23);
      expect(date.getMinutes()).toBe(59);
      expect(date.getSeconds()).toBe(59);
    });

    test('handles leap year date correctly', () => {
      const result = convertDateToTimestamp('2024-02-29', false);
      const date = new Date(Number(result) * 1000);

      // Verify it represents Feb 29, 2024 at 00:00:00 local time (valid leap year date)
      expect(date.getFullYear()).toBe(2024);
      expect(date.getMonth()).toBe(1); // 0-indexed: February = 1
      expect(date.getDate()).toBe(29);
      expect(date.getHours()).toBe(0);
      expect(date.getMinutes()).toBe(0);
      expect(date.getSeconds()).toBe(0);
    });

    test('handles month boundaries correctly', () => {
      // Last day of month
      const endOfMonth = convertDateToTimestamp('2025-01-31', true);
      const endDate = new Date(Number(endOfMonth) * 1000);

      // First day of next month
      const startOfNextMonth = convertDateToTimestamp('2025-02-01', false);
      const startDate = new Date(Number(startOfNextMonth) * 1000);

      // Verify end of January
      expect(endDate.getFullYear()).toBe(2025);
      expect(endDate.getMonth()).toBe(0); // January = 0
      expect(endDate.getDate()).toBe(31);
      expect(endDate.getHours()).toBe(23);
      expect(endDate.getMinutes()).toBe(59);
      expect(endDate.getSeconds()).toBe(59);

      // Verify start of February
      expect(startDate.getFullYear()).toBe(2025);
      expect(startDate.getMonth()).toBe(1); // February = 1
      expect(startDate.getDate()).toBe(1);
      expect(startDate.getHours()).toBe(0);
      expect(startDate.getMinutes()).toBe(0);
      expect(startDate.getSeconds()).toBe(0);

      // Verify they are consecutive (1 second apart)
      expect(Number(startOfNextMonth) - Number(endOfMonth)).toBe(1);
    });

    test('handles year boundaries correctly', () => {
      // Last day of year
      const endOfYear = convertDateToTimestamp('2025-12-31', true);
      const endDate = new Date(Number(endOfYear) * 1000);

      // First day of next year
      const startOfNextYear = convertDateToTimestamp('2026-01-01', false);
      const startDate = new Date(Number(startOfNextYear) * 1000);

      // Verify end of 2025
      expect(endDate.getFullYear()).toBe(2025);
      expect(endDate.getMonth()).toBe(11); // December = 11
      expect(endDate.getDate()).toBe(31);
      expect(endDate.getHours()).toBe(23);
      expect(endDate.getMinutes()).toBe(59);
      expect(endDate.getSeconds()).toBe(59);

      // Verify start of 2026
      expect(startDate.getFullYear()).toBe(2026);
      expect(startDate.getMonth()).toBe(0); // January = 0
      expect(startDate.getDate()).toBe(1);
      expect(startDate.getHours()).toBe(0);
      expect(startDate.getMinutes()).toBe(0);
      expect(startDate.getSeconds()).toBe(0);

      // Verify they are consecutive (1 second apart)
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
