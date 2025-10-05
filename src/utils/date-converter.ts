/**
 * Date conversion utilities for Slack MCP server
 * Converts between YYYY-MM-DD date strings and Unix timestamps
 */

/**
 * Validates that a string matches the YYYY-MM-DD format and represents a valid date
 * @param dateString - String to validate
 * @returns true if valid YYYY-MM-DD format and valid date, false otherwise
 */
export function isValidDateFormat(dateString: string): boolean {
  if (!dateString || typeof dateString !== 'string') {
    return false;
  }

  // Check format: YYYY-MM-DD (strict regex)
  const dateFormatRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (!dateFormatRegex.test(dateString)) {
    return false;
  }

  // Parse and validate the date
  const parts = dateString.split('-').map(Number);
  const year = parts[0];
  const month = parts[1];
  const day = parts[2];

  // Ensure all parts are valid numbers
  if (
    year === undefined ||
    month === undefined ||
    day === undefined ||
    isNaN(year) ||
    isNaN(month) ||
    isNaN(day)
  ) {
    return false;
  }

  // Create date object (month is 0-indexed in JavaScript)
  const date = new Date(Date.UTC(year, month - 1, day));

  // Verify the date components match (catches invalid dates like Feb 30)
  return (
    date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
  );
}

/**
 * Checks if a string represents a Unix timestamp (positive integer)
 * @param value - String to check
 * @returns true if valid timestamp format, false otherwise
 */
export function isTimestampFormat(value: string): boolean {
  if (!value || typeof value !== 'string') {
    return false;
  }

  // Must be all digits (no decimals, no negatives, no whitespace)
  const timestampRegex = /^\d+$/;
  return timestampRegex.test(value);
}

/**
 * Convert YYYY-MM-DD date string to Unix timestamp
 * @param dateString - Date in YYYY-MM-DD format
 * @param endOfDay - If true, return 23:59:59 UTC, otherwise 00:00:00 UTC
 * @returns Unix timestamp string (seconds since epoch)
 * @throws Error if date format is invalid or date is invalid
 */
export function convertDateToTimestamp(dateString: string, endOfDay: boolean = false): string {
  // Validate format first
  if (!isValidDateFormat(dateString)) {
    // Provide more specific error messages
    if (!dateString) {
      throw new Error('Invalid date format: date string cannot be empty');
    }

    const dateFormatRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateFormatRegex.test(dateString)) {
      throw new Error(`Invalid date format: expected YYYY-MM-DD, got "${dateString}"`);
    }

    // If format is correct but date is invalid
    throw new Error(`Invalid date: "${dateString}" does not represent a valid calendar date`);
  }

  // Parse the date
  const parts = dateString.split('-').map(Number);
  const year = parts[0]!; // Safe because isValidDateFormat already validated
  const month = parts[1]!;
  const day = parts[2]!;

  // Create UTC date at start of day
  const date = new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0));

  if (endOfDay) {
    // Set to end of day: 23:59:59 UTC
    date.setUTCHours(23, 59, 59, 0);
  }

  // Convert to Unix timestamp (seconds, not milliseconds)
  const timestamp = Math.floor(date.getTime() / 1000);

  return timestamp.toString();
}
