/**
 * Date validation utilities for period parameters
 */

/**
 * Validate date parameters for search operations
 * @param after - Optional after date parameter
 * @param before - Optional before date parameter
 * @returns Validation error message if invalid, null if valid
 */
export const validateDateParameters = (after?: string, before?: string): string | null => {
  // Validate date formats (basic validation for YYYY-MM-DD and relative dates)
  const datePattern = /^\d{4}-\d{2}-\d{2}$/;
  const relativeDates = ['today', 'yesterday', 'last_week', 'last_month'];

  if (after && !datePattern.test(after) && !relativeDates.includes(after)) {
    return 'Invalid date format. Use YYYY-MM-DD format or relative dates (today, yesterday, etc.)';
  }

  if (before && !datePattern.test(before) && !relativeDates.includes(before)) {
    return 'Invalid date format. Use YYYY-MM-DD format or relative dates (today, yesterday, etc.)';
  }

  // Validate date order for absolute dates
  if (after && before && datePattern.test(after) && datePattern.test(before)) {
    const afterDate = new Date(after);
    const beforeDate = new Date(before);
    if (afterDate >= beforeDate) {
      return 'Invalid date range: before date must be after the after date';
    }
  }

  return null;
};
