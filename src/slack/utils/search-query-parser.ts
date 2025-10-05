/**
 * @fileoverview Advanced Search Query Parser for Slack Search API
 * Provides comprehensive parsing and building of Slack search queries
 *
 * Created: 2025-01-19
 * Phase: TDD Green - Implementation placeholder (to be implemented)
 */

// ============================================================================
// Type Definitions
// ============================================================================

/**
 * Supported Slack search operators
 */
export type SlackSearchOperator =
  | 'in' // Channel filter: in:#general
  | 'from' // User filter: from:@alice
  | 'has' // Content type: has:link, has:attachment
  | 'after' // Date filter: after:2023-01-01
  | 'before' // Date filter: before:2023-12-31
  | 'filetype' // File type: filetype:pdf
  | 'is' // Status: is:starred, is:pinned
  | 'during'; // Time period: during:january

/**
 * Boolean operators for complex queries
 */
export type BooleanOperator = 'AND' | 'OR' | 'NOT';

/**
 * Parsed operator structure
 */
export interface ParsedOperator {
  type: SlackSearchOperator;
  value: string;
  field: string;
}

/**
 * Boolean operator with position information
 */
export interface ParsedBooleanOperator {
  type: BooleanOperator;
  position: number;
}

/**
 * Grouped query terms with boolean logic
 */
export interface QueryGroup {
  terms: string[];
  phrases: string[];
  booleanOperator?: BooleanOperator;
  operators: ParsedOperator[];
}

/**
 * Complete parsed query structure
 */
export interface ParsedSearchQuery {
  terms: string[];
  phrases: string[];
  operators: ParsedOperator[];
  booleanOperators: ParsedBooleanOperator[];
  groups: QueryGroup[];
  raw: string;
}

/**
 * Search query parsing options
 */
export interface SearchQueryOptions {
  defaultChannel?: string;
  allowedOperators?: SlackSearchOperator[];
  maxQueryLength?: number;
  enableGrouping?: boolean;
  enableBooleanOperators?: boolean;
  channelNameMap?: Map<string, string>;
}

/**
 * Query validation error
 */
export interface SearchQueryError {
  code: string;
  message: string;
  position?: number;
  suggestion?: string;
}

/**
 * Query validation result
 */
export interface QueryValidationResult {
  isValid: boolean;
  errors: SearchQueryError[];
  warnings: SearchQueryError[];
}

/**
 * Query parsing result (discriminated union)
 */
export type QueryParseResult =
  | { success: true; query: ParsedSearchQuery }
  | { success: false; error: SearchQueryError };

// ============================================================================
// Main Parser Functions (Placeholder implementations)
// ============================================================================

/**
 * Parse a search query string into structured components
 *
 * @param query - Raw search query string
 * @param options - Parsing options
 * @returns Parsed query result
 */
export function parseSearchQuery(query: string, options?: SearchQueryOptions): QueryParseResult {
  try {
    // Input validation
    if (!query || typeof query !== 'string') {
      return {
        success: false,
        error: {
          code: QUERY_ERROR_CODES.EMPTY_QUERY,
          message: 'Query cannot be empty',
        },
      };
    }

    const trimmedQuery = query.trim();
    if (!trimmedQuery) {
      return {
        success: false,
        error: {
          code: QUERY_ERROR_CODES.EMPTY_QUERY,
          message: 'Query cannot be empty or whitespace only',
        },
      };
    }

    // Check complexity first (token count heuristic) - handles 1000+ repetitions
    const tokenCount = trimmedQuery.split(/\s+/).length;
    if (tokenCount > 500) {
      return {
        success: false,
        error: {
          code: QUERY_ERROR_CODES.QUERY_TOO_COMPLEX,
          message: 'Query is too complex',
        },
      };
    }

    // Check query length limits - handles moderately long queries
    const maxLength = options?.maxQueryLength || DEFAULT_QUERY_OPTIONS.maxQueryLength || 1000;
    if (trimmedQuery.length > maxLength) {
      return {
        success: false,
        error: {
          code: QUERY_ERROR_CODES.QUERY_TOO_LONG,
          message: `Query exceeds maximum length of ${maxLength} characters`,
        },
      };
    }

    // Initialize parsed query structure
    const parsedQuery: ParsedSearchQuery = {
      terms: [],
      phrases: [],
      operators: [],
      booleanOperators: [],
      groups: [],
      raw: trimmedQuery,
    };

    // Check for unmatched quotes (but allow quotes within terms for legacy compatibility)
    const quoteMatches = trimmedQuery.match(/"/g) || [];
    const quoteCount = quoteMatches.length;

    // Only fail if we have obvious quoted phrases that are unmatched
    if (quoteCount % 2 !== 0) {
      // Check if the quotes look like they're intended as phrase delimiters
      const hasSpacedQuotes = /"\s/.test(trimmedQuery) || /\s"/.test(trimmedQuery);
      if (hasSpacedQuotes) {
        return {
          success: false,
          error: {
            code: QUERY_ERROR_CODES.UNMATCHED_QUOTES,
            message: 'Unmatched quotes in query',
          },
        };
      }
      // Otherwise allow it for legacy compatibility (quotes within terms)
    }

    // Check for unmatched parentheses
    const openParens = (trimmedQuery.match(/\(/g) || []).length;
    const closeParens = (trimmedQuery.match(/\)/g) || []).length;
    if (openParens !== closeParens) {
      return {
        success: false,
        error: {
          code: QUERY_ERROR_CODES.UNMATCHED_PARENTHESES,
          message: 'Unmatched parentheses in query',
        },
      };
    }

    // Parse the query
    let workingQuery = trimmedQuery;

    // Extract quoted phrases
    const phraseRegex = /"([^"]*)"/g;
    let match;
    while ((match = phraseRegex.exec(trimmedQuery)) !== null) {
      parsedQuery.phrases.push(match[1] || '');
      workingQuery = workingQuery.replace(match[0], '');
    }

    // Extract parenthesized groups
    const groupRegex = /\(([^)]+)\)/g;
    while ((match = groupRegex.exec(workingQuery)) !== null) {
      const groupContent = match[1] || '';
      const groupTerms = groupContent
        .split(/\s+/)
        .filter((term) => term && !['AND', 'OR', 'NOT'].includes(term.toUpperCase()));

      let booleanOp: BooleanOperator | undefined;
      if (groupContent.toUpperCase().includes(' OR ')) {
        booleanOp = 'OR';
      } else if (groupContent.toUpperCase().includes(' AND ')) {
        booleanOp = 'AND';
      }

      parsedQuery.groups.push({
        terms: groupTerms,
        phrases: [],
        operators: [],
        booleanOperator: booleanOp,
      });

      workingQuery = workingQuery.replace(match[0], '');
    }

    // Extract Slack operators - use original query to find all operators
    const operatorRegex = /(\w+):([^\s]+)/g;
    let operatorMatch;
    while ((operatorMatch = operatorRegex.exec(trimmedQuery)) !== null) {
      const operatorType = operatorMatch[1] as SlackSearchOperator;
      const value = operatorMatch[2] || '';

      // Validate operator
      if (!isValidSlackOperator(operatorType)) {
        return {
          success: false,
          error: {
            code: QUERY_ERROR_CODES.INVALID_OPERATOR,
            message: `Invalid operator: ${operatorType}`,
            suggestion: `Valid operators are: ${Object.keys(OPERATOR_FIELD_MAP).join(', ')}`,
          },
        };
      }

      // Check if operator is allowed
      if (options?.allowedOperators && !options.allowedOperators.includes(operatorType)) {
        return {
          success: false,
          error: {
            code: QUERY_ERROR_CODES.OPERATOR_NOT_ALLOWED,
            message: `Operator '${operatorType}' is not allowed`,
          },
        };
      }

      // Check for empty operator value
      if (!value) {
        return {
          success: false,
          error: {
            code: QUERY_ERROR_CODES.INVALID_OPERATOR,
            message: `Operator '${operatorType}' is missing value`,
            suggestion: `Use format: ${operatorType}:value`,
          },
        };
      }

      parsedQuery.operators.push({
        type: operatorType,
        value: value,
        field: OPERATOR_FIELD_MAP[operatorType] || 'unknown',
      });

      workingQuery = workingQuery.replace(operatorMatch[0], '');
    }

    // Check for malformed operators (operator: with space) - specific patterns
    const malformedOperatorRegex = /(\w+):\s+/g;
    const malformedMatches = trimmedQuery.matchAll(malformedOperatorRegex);
    for (const malformedMatch of malformedMatches) {
      return {
        success: false,
        error: {
          code: QUERY_ERROR_CODES.INVALID_OPERATOR,
          message: `Operator '${malformedMatch[1]}:' is missing value`,
          suggestion: `Use format: ${malformedMatch[1]}:value`,
        },
      };
    }

    // Extract boolean operators with position tracking
    const booleanRegex = /\b(AND|OR|NOT)\b/gi;
    const booleanMatches = Array.from(trimmedQuery.matchAll(booleanRegex));
    booleanMatches.forEach((match, _index) => {
      // Calculate position in terms (terms before this operator)
      const beforeOperator = trimmedQuery.substring(0, match.index || 0);
      const termsBefore = beforeOperator
        .split(/\s+/)
        .filter((t) => t && !['AND', 'OR', 'NOT'].includes(t.toUpperCase())).length;

      parsedQuery.booleanOperators.push({
        type: match[1]?.toUpperCase() as BooleanOperator,
        position: Math.max(1, termsBefore), // Position starts from 1
      });
    });

    // Remove boolean operators from working query
    workingQuery = workingQuery.replace(booleanRegex, '');

    // Extract remaining terms
    const terms = workingQuery
      .split(/\s+/)
      .map((term) => term.trim())
      .filter((term) => term.length > 0);

    parsedQuery.terms = terms;

    return {
      success: true,
      query: parsedQuery,
    };
  } catch (error) {
    return {
      success: false,
      error: {
        code: 'PARSE_ERROR',
        message: error instanceof Error ? error.message : 'Unknown parsing error',
      },
    };
  }
}

/**
 * Build a Slack-compatible search query from parsed components
 *
 * @param parsed - Parsed query structure
 * @param options - Building options
 * @returns Slack API compatible query string
 */
export function buildSlackSearchQuery(
  parsed: ParsedSearchQuery,
  options?: SearchQueryOptions
): string {
  const parts: string[] = [];

  // Add phrases first (with quotes)
  if (parsed.phrases?.length > 0) {
    parsed.phrases.forEach((phrase) => {
      parts.push(`"${escapeSlackSearchText(phrase)}"`);
    });
  }

  // Add terms (escaped)
  if (parsed.terms?.length > 0) {
    parsed.terms.forEach((term) => {
      parts.push(escapeSlackSearchText(term));
    });
  }

  // Build query with boolean operators
  let queryParts = [...parts];
  if (parsed.booleanOperators?.length > 0) {
    // Reconstruct with boolean operators
    const result: string[] = [];
    let termIndex = 0;

    parsed.booleanOperators.forEach((boolOp, _index) => {
      if (termIndex < queryParts.length) {
        result.push(queryParts[termIndex++] || '');
      }
      result.push(boolOp.type);
      if (termIndex < queryParts.length) {
        result.push(queryParts[termIndex++] || '');
      }
    });

    // Add any remaining terms
    while (termIndex < queryParts.length) {
      result.push(queryParts[termIndex++] || '');
    }

    queryParts = result.filter((part) => part.length > 0);
  }

  // Add operators
  if (parsed.operators?.length > 0) {
    parsed.operators.forEach((op) => {
      queryParts.push(`${op.type}:${op.value}`);
    });
  }

  // Add default channel if specified in options and no channel operator present
  if (options?.defaultChannel && !parsed.operators?.some((op) => op.type === 'in')) {
    const channelName = resolveChannelName(options.defaultChannel, options.channelNameMap);
    queryParts.push(`in:#${channelName}`);
  }

  return queryParts.join(' ').trim();
}

/**
 * Validate a search query for syntax and compliance
 *
 * @param query - Query string to validate
 * @param options - Validation options
 * @returns Validation result with errors and warnings
 */
export function validateSearchQuery(
  query: string,
  options?: SearchQueryOptions
): QueryValidationResult {
  const errors: SearchQueryError[] = [];
  const warnings: SearchQueryError[] = [];

  // Parse the query first
  const parseResult = parseSearchQuery(query, options);

  if (!parseResult.success) {
    errors.push(parseResult.error);
  }

  // Additional validation checks
  if (query && typeof query === 'string') {
    const trimmed = query.trim();

    // Check for invalid operators (only if parse was successful)
    if (parseResult.success) {
      const operatorMatches = trimmed.matchAll(/(\w+):/g);
      for (const match of operatorMatches) {
        const operator = match[1];
        if (operator && !isValidSlackOperator(operator as SlackSearchOperator)) {
          errors.push({
            code: QUERY_ERROR_CODES.INVALID_OPERATOR,
            message: `Invalid operator: ${operator}`,
            suggestion: `Valid operators are: ${Object.keys(OPERATOR_FIELD_MAP).join(', ')}`,
          });
        }
      }
    }

    // Check for operators missing values (malformed pattern)
    const emptyOperatorMatches = trimmed.matchAll(/(\w+):\s+/g);
    for (const match of emptyOperatorMatches) {
      const operator = match[1];
      errors.push({
        code: QUERY_ERROR_CODES.INVALID_OPERATOR,
        message: `Operator '${operator}' is missing value`,
        suggestion: `Use format: ${operator}:value`,
      });
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  };
}

// ============================================================================
// Utility Functions (Placeholder implementations)
// ============================================================================

/**
 * Escape special characters for Slack search
 *
 * @param text - Text to escape
 * @returns Escaped text
 */
export function escapeSlackSearchText(text: string): string {
  if (!text || typeof text !== 'string') {
    return '';
  }

  return text
    .replace(/\\/g, '\\\\') // Escape backslashes first
    .replace(/"/g, '\\"') // Escape quotes
    .replace(/[\r\n\t]/g, ' ') // Replace control characters with spaces
    .replace(/\s+/g, ' ') // Normalize multiple spaces
    .trim();
}

/**
 * Resolve channel ID to channel name
 *
 * @param channelId - Channel ID
 * @param channelMap - Optional channel name mapping
 * @returns Channel name or original ID
 */
export function resolveChannelName(channelId: string, channelMap?: Map<string, string>): string {
  if (!channelId) {
    return '';
  }

  // If channelMap is provided, try to resolve
  if (channelMap && channelMap.has(channelId)) {
    return channelMap.get(channelId) || channelId;
  }

  // If already has # prefix, remove it for consistent handling
  if (channelId.startsWith('#')) {
    return channelId.slice(1);
  }

  // If it looks like a channel ID (starts with C), return as is
  if (channelId.startsWith('C')) {
    return channelId;
  }

  // Otherwise assume it's already a channel name
  return channelId;
}

/**
 * Check if operator is allowed based on options
 *
 * @param operator - Operator to check
 * @param options - Query options
 * @returns True if operator is allowed
 */
export function isOperatorAllowed(
  operator: SlackSearchOperator,
  options?: SearchQueryOptions
): boolean {
  // If no allowedOperators list is provided, allow all valid operators
  if (!options?.allowedOperators) {
    return isValidSlackOperator(operator);
  }

  return options.allowedOperators.includes(operator);
}

// ============================================================================
// Helper Functions and Constants
// ============================================================================

/**
 * Mapping of Slack operators to their field types
 */
const OPERATOR_FIELD_MAP: Record<SlackSearchOperator, string> = {
  in: 'channel',
  from: 'user',
  has: 'content_type',
  after: 'date',
  before: 'date',
  filetype: 'file_type',
  is: 'status',
  during: 'date',
};

/**
 * Check if a string is a valid Slack search operator
 * @param operator - Operator to validate
 * @returns True if valid
 */
function isValidSlackOperator(operator: string): operator is SlackSearchOperator {
  return operator in OPERATOR_FIELD_MAP;
}

// ============================================================================
// Error Codes Constants
// ============================================================================

export const QUERY_ERROR_CODES = {
  EMPTY_QUERY: 'EMPTY_QUERY',
  QUERY_TOO_LONG: 'QUERY_TOO_LONG',
  QUERY_TOO_COMPLEX: 'QUERY_TOO_COMPLEX',
  INVALID_OPERATOR: 'INVALID_OPERATOR',
  OPERATOR_NOT_ALLOWED: 'OPERATOR_NOT_ALLOWED',
  UNMATCHED_QUOTES: 'UNMATCHED_QUOTES',
  UNMATCHED_PARENTHESES: 'UNMATCHED_PARENTHESES',
  INVALID_DATE_FORMAT: 'INVALID_DATE_FORMAT',
  INVALID_CHANNEL_FORMAT: 'INVALID_CHANNEL_FORMAT',
  INVALID_USER_FORMAT: 'INVALID_USER_FORMAT',
} as const;

/**
 * Default options for query parsing
 */
export const DEFAULT_QUERY_OPTIONS: SearchQueryOptions = {
  maxQueryLength: 1000,
  enableGrouping: true,
  enableBooleanOperators: true,
  allowedOperators: ['in', 'from', 'has', 'after', 'before', 'filetype', 'is'],
};

// ============================================================================
// Legacy Compatibility Exports
// ============================================================================

/**
 * Legacy function for backward compatibility with existing codebase
 * @deprecated Use parseSearchQuery instead
 */
export function escapeSearchQuery(query: string): string {
  // Legacy implementation matching existing pattern in services
  if (!query || typeof query !== 'string') {
    return '';
  }

  return query
    .replace(/"/g, '\\"') // Escape quotes
    .replace(/[\r\n]/g, ' ') // Replace newlines with spaces
    .trim();
}
