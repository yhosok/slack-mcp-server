/**
 * Service Patterns - Centralized Export
 *
 * This module exports all service pattern utilities for eliminating
 * code duplication across domain services.
 *
 * ## Exported Modules
 * - Service Method Factory: Generic method creation patterns
 * - Error Handling Patterns: Reusable error factories
 * - Base Service Factory: Service creation templates
 *
 * @example Usage
 * ```typescript
 * import {
 *   createServiceMethod,
 *   handleSlackApiError,
 *   createDomainService
 * } from './infrastructure/service-patterns';
 * ```
 */

// Service Method Factory
export {
  createServiceMethod,
  createPaginatedServiceMethod,
  createCrudMethod,
  isPaginatedConfig,
  type ServiceMethodConfig,
  type PaginatedServiceMethodConfig,
  type CrudMethodConfig,
  type ServiceMethodContext,
  type ServiceMethodDependencies,
  type ServiceMethodReturn,
} from './service-method-factory.js';

// Error Handling Patterns
export {
  handleSlackApiError,
  handleValidationError,
  handleNotFoundError,
  handlePermissionError,
  handleRateLimitError,
  handleGenericError,
  handleServiceError,
  createErrorContext,
  withErrorHandling,
  CommonErrorHandlers,
  type ErrorContext,
  type ErrorHandlingConfig,
} from './error-handling-patterns.js';

// Base Service Factory
export {
  createDomainService,
  createBulkMethods,
  createMethodBuilder,
  createServiceRegistry,
  flattenServiceMethods,
  ServicePatterns,
  type BaseDomainServiceDependencies,
  type DomainServiceConfig,
  type ServiceMethodRegistry,
  type DomainService,
  type BulkMethodCreationConfig,
  type MethodDefinition,
  type ServiceRegistry,
} from './base-service-factory.js';