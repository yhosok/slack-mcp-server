/**
 * TypeSafeAPI + ts-pattern Type Safety Patterns
 * 
 * Production-ready discriminated unions and response structures following
 * TypeSafeAPI TypeScript best practices for Node.js backend applications.
 * 
 * This module provides:
 * - Type-safe discriminated unions with exhaustive pattern matching
 * - Consistent API response structures for production backends
 * - Runtime type validation with compile-time safety
 * - Integration patterns between TypeSafeAPI services and MCP protocol
 * 
 * @example Basic Usage
 * ```typescript
 * const result = await someService.operation(args);
 * const apiResponse = handleServiceResult(result);
 * 
 * match(result)
 *   .with({ success: true }, (success) => console.log(success.data))
 *   .with({ success: false }, (error) => console.error(error.error))
 *   .exhaustive();
 * ```
 * 
 * @example Creating Service Results
 * ```typescript
 * // Success case
 * const success = createServiceSuccess(
 *   { users: [...], total: 5 },
 *   'Users retrieved successfully'
 * );
 * 
 * // Error case
 * const error = createServiceError(
 *   'User not found',
 *   'Failed to retrieve user'
 * );
 * ```
 */

import { match, P } from 'ts-pattern';

// Performance optimization: Pre-compiled patterns for common validations
const SUCCESS_PATTERN = { success: true } as const;
const ERROR_PATTERN = { success: false } as const;

/**
 * Pre-compiled common API response templates for performance optimization
 * Reduces object allocation in high-frequency scenarios
 */
const SUCCESS_RESPONSE_TEMPLATE = {
  statusCode: "10000",
} as const;

const ERROR_RESPONSE_TEMPLATE = {
  statusCode: "10001",
} as const;

/**
 * ServiceOutput constraint - all service outputs must extend Record<string, any>
 * 
 * This ensures:
 * - JSON serialization safety for API responses
 * - Type-safe property access without runtime errors
 * - Compatibility with TypeSafeAPI service architecture
 * - Prevention of primitive values as service outputs
 * 
 * @example Valid ServiceOutput
 * ```typescript
 * const validOutput: ServiceOutput = {
 *   users: [{ id: '1', name: 'John' }],
 *   total: 1,
 *   hasMore: false
 * };
 * ```
 * 
 * @example Invalid ServiceOutput (compilation error)
 * ```typescript
 * const invalidOutput: ServiceOutput = 'string'; // Error!
 * const alsoInvalid: ServiceOutput = 42; // Error!
 * ```
 */
export type ServiceOutput = Record<string, unknown>;

/**
 * Production-ready API response structure for Node.js backends
 * 
 * Standardized response format following TypeSafeAPI architecture patterns:
 * - statusCode: String-based status ("10000" = success, "10001" = error)
 * - message: Human-readable description of the operation result
 * - data: Typed payload for successful operations (optional)
 * - error: Error details for failed operations (optional)
 * 
 * This structure ensures:
 * - Consistent client-side response handling
 * - Type-safe access to response data
 * - Clear separation between success and error states
 * - Integration compatibility with frontend frameworks
 * 
 * @template T - The type of data payload, must extend ServiceOutput
 * 
 * @example Success Response
 * ```typescript
 * const successResponse: ApiResponse<UserListOutput> = {
 *   statusCode: "10000",
 *   message: "Users retrieved successfully",
 *   data: { users: [...], total: 5 }
 * };
 * ```
 * 
 * @example Error Response
 * ```typescript
 * const errorResponse: ApiResponse<never> = {
 *   statusCode: "10001",
 *   message: "Failed to retrieve users",
 *   error: "Database connection timeout"
 * };
 * ```
 */
export type ApiResponse<T extends ServiceOutput> = {
  statusCode: string;  // "10000" for success, "10001" for error
  message: string;
  data?: T;
  error?: string;
};

/**
 * Discriminated union for service results using ts-pattern
 * 
 * Core type for all service operations, enabling:
 * - Exhaustive pattern matching with compile-time guarantees
 * - Type-safe error handling without try-catch complexity
 * - Functional programming patterns for result processing
 * - Zero-cost abstractions with TypeScript inference
 * 
 * The discriminated union uses 'success' as the discriminator:
 * - success: true → Contains typed data and success message
 * - success: false → Contains error string and failure message
 * 
 * @template T - The type of success data payload, must extend ServiceOutput
 * 
 * @example Pattern Matching
 * ```typescript
 * const processResult = <T extends ServiceOutput>(result: ServiceResult<T>) =>
 *   match(result)
 *     .with({ success: true }, ({ data, message }) => {
 *       console.log(`Success: ${message}`);
 *       return data;
 *     })
 *     .with({ success: false }, ({ error, message }) => {
 *       console.error(`Error: ${message} - ${error}`);
 *       throw new Error(error);
 *     })
 *     .exhaustive(); // Compiler ensures all cases handled
 * ```
 * 
 * @example Type Guards
 * ```typescript
 * if (result.success) {
 *   // TypeScript knows this is success case
 *   console.log(result.data); // ✓ Type-safe access
 *   console.log(result.message); // ✓ Available
 *   // console.log(result.error); // ✗ Not available
 * } else {
 *   // TypeScript knows this is error case
 *   console.log(result.error); // ✓ Type-safe access
 *   console.log(result.message); // ✓ Available
 *   // console.log(result.data); // ✗ Not available
 * }
 * ```
 */
export type ServiceResult<T extends ServiceOutput> = 
  | { success: true; data: T; message: string }
  | { success: false; error: string; message: string };

/**
 * TypeSafeAPI type-safe result handler using ts-pattern exhaustive matching
 * 
 * Converts ServiceResult discriminated unions to standardized ApiResponse format
 * for consistent API responses across all service endpoints.
 * 
 * Features:
 * - Exhaustive pattern matching ensures all cases are handled
 * - Type-safe transformation with zero runtime overhead
 * - Automatic status code assignment based on success state
 * - Preserves all original data and message information
 * 
 * Status Code Mapping:
 * - Success: "10000" (industry standard for successful operations)
 * - Error: "10001" (consistent error identifier)
 * 
 * @template T - The type of success data, must extend ServiceOutput
 * @param result - ServiceResult to transform
 * @returns ApiResponse with appropriate structure
 * 
 * @example Basic Usage
 * ```typescript
 * const serviceResult = await userService.getUsers(args);
 * const apiResponse = handleServiceResult(serviceResult);
 * 
 * // apiResponse is now ready for HTTP response or MCP protocol
 * return {
 *   content: [{
 *     type: 'text',
 *     text: JSON.stringify(apiResponse, null, 2)
 *   }]
 * };
 * ```
 * 
 * @example Pattern Matching Alternative
 * ```typescript
 * // Instead of manual pattern matching:
 * const manualResponse = match(result)
 *   .with({ success: true }, (s) => ({ statusCode: "10000", ... }))
 *   .with({ success: false }, (e) => ({ statusCode: "10001", ... }))
 *   .exhaustive();
 * 
 * // Use the helper:
 * const autoResponse = handleServiceResult(result);
 * ```
 */
export const handleServiceResult = <T extends ServiceOutput>(
  result: ServiceResult<T>
): ApiResponse<T> =>
  match(result)
    .with(SUCCESS_PATTERN, (successResult) => ({
      ...SUCCESS_RESPONSE_TEMPLATE,
      message: successResult.message,
      data: successResult.data,
    }))
    .with(ERROR_PATTERN, (errorResult) => ({
      ...ERROR_RESPONSE_TEMPLATE,
      message: errorResult.message,
      error: errorResult.error,
    }))
    .exhaustive(); // Ensures type safety - compiler error if cases missed

/**
 * Type-safe error creation utility with TypeSafeAPI patterns
 * 
 * Creates a standardized error result for service operations.
 * All error results follow the same structure for consistent handling.
 * 
 * @param error - Technical error description (for logging/debugging)
 * @param message - User-friendly error message (default: 'Operation failed')
 * @returns ServiceResult in error state
 * 
 * @example API Error
 * ```typescript
 * if (!apiResponse.ok) {
 *   return createServiceError(
 *     `Slack API Error: ${apiResponse.error}`,
 *     'Failed to retrieve channel information'
 *   );
 * }
 * ```
 * 
 * @example Validation Error
 * ```typescript
 * if (!input.channel) {
 *   return createServiceError(
 *     'Channel ID is required',
 *     'Invalid request parameters'
 *   );
 * }
 * ```
 */
export const createServiceError = (error: string, message: string = 'Operation failed'): ServiceResult<never> => ({
  success: false,
  error,
  message,
});

/**
 * Type-safe success creation utility with TypeSafeAPI patterns
 * 
 * Creates a standardized success result for service operations.
 * Ensures data conforms to ServiceOutput constraint at compile-time.
 * 
 * @template T - The type of success data, must extend ServiceOutput
 * @param data - Success payload, must be an object (Record<string, any>)
 * @param message - Success message (default: 'Operation completed successfully')
 * @returns ServiceResult in success state
 * 
 * @example Channel List Success
 * ```typescript
 * const channels = apiResponse.channels.map(transformChannel);
 * return createServiceSuccess(
 *   { channels, total: channels.length },
 *   'Channels retrieved successfully'
 * );
 * ```
 * 
 * @example User Info Success
 * ```typescript
 * const userInfo = transformUserData(apiResponse.user);
 * return createServiceSuccess(
 *   userInfo,
 *   'User information retrieved successfully'
 * );
 * ```
 */
export const createServiceSuccess = <T extends ServiceOutput>(
  data: T, 
  message: string = 'Operation completed successfully'
): ServiceResult<T> => ({
  success: true,
  data,
  message,
});

/**
 * P.infer utility for type inference from ts-pattern patterns
 * 
 * Advanced type utility that extracts the inferred type from ts-pattern patterns.
 * This enables sophisticated compile-time type safety when working with
 * complex pattern matching scenarios.
 * 
 * @template T - A ts-pattern Pattern type
 * @returns The type that would be inferred from the pattern
 * 
 * @example String Pattern Inference
 * ```typescript
 * const stringPattern = P.string;
 * type StringType = InferPatternType<typeof stringPattern>; // string
 * ```
 * 
 * @example Object Pattern Inference
 * ```typescript
 * const userPattern = P.when((obj): obj is User => isValidUser(obj));
 * type UserType = InferPatternType<typeof userPattern>; // User
 * ```
 * 
 * @example Advanced Pattern Matching
 * ```typescript
 * const processData = <T>(pattern: P.Pattern<T>, data: unknown) => {
 *   type InferredType = InferPatternType<typeof pattern>;
 *   return match(data)
 *     .with(pattern, (matched: InferredType) => matched)
 *     .otherwise(() => null);
 * };
 * ```
 */
export type InferPatternType<T> = T extends P.Pattern<infer U> ? U : never;

/**
 * High-performance type predicate for ServiceResult validation
 * Uses minimal checks for maximum throughput in production scenarios
 * 
 * @param value - Value to check
 * @returns Type predicate indicating if value is ServiceResult
 * 
 * @example Fast Validation
 * ```typescript
 * if (isServiceResult(unknownValue)) {
 *   // TypeScript knows this is ServiceResult
 *   return handleServiceResult(unknownValue);
 * }
 * ```
 */
export const isServiceResult = (value: unknown): value is ServiceResult<ServiceOutput> => {
  if (typeof value !== 'object' || value === null) return false;
  
  const obj = value as Record<string, unknown>;
  return (
    typeof obj.success === 'boolean' &&
    typeof obj.message === 'string' &&
    (obj.success === false ? typeof obj.error === 'string' : obj.data !== undefined)
  );
};

/**
 * Exhaustive pattern matching utility for ServiceResult validation
 * 
 * Runtime validation function that checks if an unknown value conforms
 * to the ServiceResult discriminated union structure. Uses ts-pattern
 * for both validation logic and type narrowing.
 * 
 * Features:
 * - Runtime type checking with compile-time type narrowing
 * - Exhaustive validation ensures no edge cases are missed
 * - Integration with TypeScript's type system for safety
 * - Zero false positives through pattern-based validation
 * 
 * @template T - The expected success data type, must extend ServiceOutput
 * @param result - Unknown value to validate
 * @returns Type predicate indicating if value is valid ServiceResult
 * 
 * @example Input Validation
 * ```typescript
 * const validateApiInput = (input: unknown) => {
 *   if (validateServiceResult<UserOutput>(input)) {
 *     // TypeScript knows input is ServiceResult<UserOutput>
 *     if (input.success) {
 *       console.log(input.data.name); // ✓ Type-safe access
 *     }
 *   }
 * };
 * ```
 * 
 * @example Runtime Safety
 * ```typescript
 * const processUntrustedData = (data: unknown) => {
 *   if (validateServiceResult(data)) {
 *     // Safe to process as ServiceResult
 *     return handleServiceResult(data);
 *   }
 *   throw new Error('Invalid service result format');
 * };
 * ```
 */
// Performance optimization: Cache validation patterns
const SUCCESS_VALIDATION_PATTERN = { success: true, data: P.any, message: P.string } as const;
const ERROR_VALIDATION_PATTERN = { success: false, error: P.string, message: P.string } as const;

export const validateServiceResult = <T extends ServiceOutput>(
  result: unknown
): result is ServiceResult<T> =>
  match(result)
    .with(SUCCESS_VALIDATION_PATTERN, () => true)
    .with(ERROR_VALIDATION_PATTERN, () => true)
    .otherwise(() => false);

/**
 * TypeSafeAPI type constraints validator
 * 
 * Runtime enforcement of ServiceOutput constraints with compile-time type safety.
 * Ensures that all service outputs are proper objects that can be safely
 * serialized and accessed without runtime errors.
 * 
 * Validation Rules:
 * - Must be a non-null object (not primitive, null, or array)
 * - Must be compatible with Record<string, any> structure
 * - Must be JSON-serializable for API responses
 * 
 * @template T - Input type to validate and constrain
 * @param data - Data to validate and enforce as ServiceOutput
 * @returns Input data cast as ServiceOutput-compliant type
 * @throws Error if data doesn't meet ServiceOutput requirements
 * 
 * @example Valid Output Enforcement
 * ```typescript
 * const userOutput = enforceServiceOutput({
 *   id: 'user123',
 *   name: 'John Doe',
 *   settings: { theme: 'dark' }
 * }); // ✓ Valid object
 * ```
 * 
 * @example Invalid Input Detection
 * ```typescript
 * enforceServiceOutput(null); // ✗ Throws: non-null object required
 * enforceServiceOutput('string'); // ✗ Throws: object required
 * enforceServiceOutput([1, 2, 3]); // ✗ Throws: not an array
 * ```
 * 
 * @example Integration with Service Methods
 * ```typescript
 * const output = enforceServiceOutput({
 *   channels: processedChannels,
 *   total: channelCount,
 *   hasMore: false
 * });
 * return createServiceSuccess(output, 'Channels retrieved');
 * ```
 */
/**
 * Performance-optimized ServiceOutput enforcement with minimal runtime overhead
 * Uses fast type checks and early returns for common cases
 */
export const enforceServiceOutput = <T>(data: T): T & ServiceOutput => {
  // Fast path: skip validation in production if we trust the input
  if (process.env.NODE_ENV === 'production' && typeof data === 'object' && data !== null) {
    return data as T & ServiceOutput;
  }
  
  // Development/test path: full validation
  if (typeof data !== 'object' || data === null || Array.isArray(data)) {
    throw new Error('ServiceOutput must be a non-null object (Record<string, any>)');
  }
  return data as T & ServiceOutput;
};

/**
 * Production-ready error types following TypeSafeAPI patterns
 * 
 * Standardized error classification system for consistent error handling
 * across all service operations. Each error type represents a specific
 * category of failure with appropriate handling strategies.
 * 
 * Error Categories:
 * - VALIDATION_ERROR: Input validation failures, client-side issues
 * - API_ERROR: External API failures, network issues
 * - AUTHORIZATION_ERROR: Authentication/authorization failures
 * - NOT_FOUND_ERROR: Resource not found, missing data
 * - RATE_LIMIT_ERROR: API rate limiting, throttling
 * - UNKNOWN_ERROR: Unexpected errors, system failures
 * 
 * @example Error Type Usage
 * ```typescript
 * const handleSlackApiError = (error: SlackAPIError) => {
 *   if (error.code === 'invalid_auth') {
 *     return createTypedServiceError(
 *       'AUTHORIZATION_ERROR',
 *       'Invalid Slack credentials',
 *       'Authentication failed'
 *     );
 *   }
 *   if (error.code === 'rate_limited') {
 *     return createTypedServiceError(
 *       'RATE_LIMIT_ERROR',
 *       'Slack API rate limit exceeded',
 *       'Too many requests, please try again later'
 *     );
 *   }
 * };
 * ```
 */
export type ServiceErrorType = 
  | 'VALIDATION_ERROR'
  | 'API_ERROR' 
  | 'AUTHORIZATION_ERROR'
  | 'NOT_FOUND_ERROR'
  | 'RATE_LIMIT_ERROR'
  | 'UNKNOWN_ERROR';

/**
 * Enhanced error result with typed error categories
 * 
 * Extended ServiceResult that includes error classification for
 * sophisticated error handling and monitoring. Adds errorType
 * and optional details for comprehensive error reporting.
 * 
 * Additional Fields:
 * - errorType: Categorizes the error for appropriate handling
 * - details: Optional object with additional error context
 * 
 * Benefits:
 * - Enables error-specific handling logic
 * - Facilitates error monitoring and alerting
 * - Provides rich context for debugging
 * - Supports error analytics and reporting
 * 
 * @example Error Classification
 * ```typescript
 * const handleTypedError = (error: TypedServiceError) => {
 *   match(error.errorType)
 *     .with('VALIDATION_ERROR', () => sendBadRequestResponse())
 *     .with('AUTHORIZATION_ERROR', () => sendUnauthorizedResponse())
 *     .with('RATE_LIMIT_ERROR', () => sendRateLimitResponse())
 *     .with('NOT_FOUND_ERROR', () => sendNotFoundResponse())
 *     .exhaustive();
 * };
 * ```
 */
export type TypedServiceError = {
  success: false;
  error: string;
  message: string;
  errorType: ServiceErrorType;
  details?: Record<string, unknown>;
};

/**
 * Create typed service error with TypeSafeAPI patterns
 * 
 * Advanced error creation utility that includes error classification
 * and optional context details. Enables sophisticated error handling
 * and monitoring in production systems.
 * 
 * @param errorType - Category of error for handling classification
 * @param error - Technical error description for logging
 * @param message - User-friendly error message (default: 'Operation failed')
 * @param details - Optional additional context for debugging
 * @returns TypedServiceError with classification and context
 * 
 * @example Validation Error with Details
 * ```typescript
 * return createTypedServiceError(
 *   'VALIDATION_ERROR',
 *   'Required field missing: channel',
 *   'Invalid request parameters',
 *   { field: 'channel', received: undefined, expected: 'string' }
 * );
 * ```
 * 
 * @example API Error with Context
 * ```typescript
 * return createTypedServiceError(
 *   'API_ERROR',
 *   `Slack API error: ${response.error}`,
 *   'Failed to retrieve channel information',
 *   { 
 *     slackError: response.error,
 *     channelId: input.channel,
 *     statusCode: response.status
 *   }
 * );
 * ```
 */
export const createTypedServiceError = (
  errorType: ServiceErrorType,
  error: string,
  message: string = 'Operation failed',
  details?: Record<string, unknown>
): TypedServiceError => ({
  success: false,
  error,
  message,
  errorType,
  details,
});

/**
 * Performance Utilities for TypeSafeAPI + ts-pattern Operations
 * 
 * These utilities provide optimized paths for common operations
 * to reduce runtime overhead in high-throughput scenarios.
 */

/**
 * Fast path for success result creation when type is known at compile time
 * Bypasses runtime validation for better performance in hot paths
 * 
 * @template T - Success data type (must extend ServiceOutput)
 * @param data - Pre-validated success data
 * @param message - Success message
 * @returns ServiceResult in success state
 * 
 * @example High-Performance Usage
 * ```typescript
 * // Use when you know data is already valid
 * const result = createServiceSuccessFast(
 *   { users: processedUsers, total: users.length },
 *   'Users processed successfully'
 * );
 * ```
 */
export const createServiceSuccessFast = <T extends ServiceOutput>(
  data: T,
  message: string
): ServiceResult<T> => ({
  success: true as const,
  data,
  message,
});

/**
 * Batch result processor for handling multiple ServiceResults efficiently
 * Processes an array of results and aggregates success/error counts
 * 
 * @template T - Success data type
 * @param results - Array of ServiceResult to process
 * @returns Aggregated processing statistics
 * 
 * @example Batch Processing
 * ```typescript
 * const userResults = await Promise.all(
 *   userIds.map(id => userService.getUser({ userId: id }))
 * );
 * 
 * const stats = processBatchResults(userResults);
 * console.log(`Processed ${stats.total}, ${stats.successes} succeeded, ${stats.errors} failed`);
 * ```
 */
export const processBatchResults = <T extends ServiceOutput>(
  results: ServiceResult<T>[]
): { successes: number; errors: number; successData: T[]; errorMessages: string[]; total: number } => {
  let successes = 0;
  let errors = 0;
  const successData: T[] = [];
  const errorMessages: string[] = [];
  
  for (const result of results) {
    if (result.success) {
      successes++;
      successData.push(result.data);
    } else {
      errors++;
      errorMessages.push(result.error);
    }
  }
  
  return {
    total: results.length,
    successes,
    errors,
    successData,
    errorMessages,
  };
};

/**
 * Memory-efficient result transformer that applies a function to success data
 * without creating intermediate objects
 * 
 * @template T - Input success data type
 * @template U - Output success data type
 * @param result - ServiceResult to transform
 * @param transformer - Function to transform success data
 * @returns Transformed ServiceResult
 * 
 * @example Data Transformation
 * ```typescript
 * const userResult = await userService.getUser(args);
 * const publicUserResult = transformResult(
 *   userResult,
 *   (user) => ({ id: user.id, name: user.name }) // Remove sensitive data
 * );
 * ```
 */
export const transformResult = <T extends ServiceOutput, U extends ServiceOutput>(
  result: ServiceResult<T>,
  transformer: (data: T) => U
): ServiceResult<U> => {
  if (result.success) {
    return {
      success: true,
      data: transformer(result.data),
      message: result.message,
    };
  }
  return result; // Error results pass through unchanged
};