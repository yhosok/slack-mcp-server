/**
 * Base Service Factory - Templates for Service Creation
 *
 * This module provides base templates and patterns for creating domain services
 * with standardized dependency injection, method composition, and infrastructure
 * integration. Eliminates repetitive service factory patterns across the codebase.
 *
 * ## Key Features
 * - Standardized service creation templates
 * - Dependency injection patterns
 * - Method composition helpers
 * - Infrastructure integration utilities
 * - Type-safe service registry patterns
 *
 * ## Design Philosophy
 * This factory addresses service factory duplication by:
 * 1. Providing reusable service creation templates
 * 2. Standardizing dependency injection patterns
 * 3. Simplifying method composition and registration
 * 4. Ensuring consistent infrastructure integration
 *
 * @example Basic Service Creation
 * ```typescript
 * const fileService = createDomainService({
 *   serviceName: 'FileService',
 *   dependencies: { clientManager, userService },
 *   methods: {
 *     uploadFile: createServiceMethod(uploadFileConfig, deps),
 *     listFiles: createServiceMethod(listFilesConfig, deps),
 *   }
 * });
 * ```
 */

import type { ZodSchema } from 'zod';
import {
  createServiceMethod,
  createPaginatedServiceMethod,
  type ServiceMethodConfig,
  type PaginatedServiceMethodConfig,
  type ServiceMethodDependencies,
} from './service-method-factory.js';
import {
  handleServiceError,
  createErrorContext,
  type ErrorHandlingConfig,
} from './error-handling-patterns.js';
import type { ServiceResult, ServiceOutput } from '../../types/typesafe-api-patterns.js';
import { logger } from '../../../utils/logger.js';
import type { SlackClientManager } from '../client/types.js';

/**
 * Base dependencies required by all domain services
 */
export interface BaseDomainServiceDependencies {
  /** Client manager for Slack API operations */
  clientManager: SlackClientManager;
  /** Logger instance (optional, defaults to global logger) */
  logger?: typeof logger;
}

/**
 * Configuration for creating a domain service
 */
export interface DomainServiceConfig<TDependencies extends BaseDomainServiceDependencies> {
  /** Human-readable service name for logging */
  serviceName: string;
  /** Dependencies required by this service */
  dependencies: TDependencies;
  /** Optional error handling configuration */
  errorConfig?: ErrorHandlingConfig;
  /** Optional service-level logging configuration */
  enableServiceLogging?: boolean;
}

/**
 * Method registry for a domain service
 * Maps method names to their implementations
 */
export type ServiceMethodRegistry = Record<
  string,
  (args: unknown) => Promise<ServiceResult<ServiceOutput>>
>;

/**
 * Complete domain service definition
 */
export interface DomainService<TMethods extends ServiceMethodRegistry = ServiceMethodRegistry> {
  /** Service name for identification */
  serviceName: string;
  /** Service methods registry */
  methods: TMethods;
  /** Service dependencies */
  dependencies: BaseDomainServiceDependencies;
  /** Service metadata */
  metadata: {
    createdAt: Date;
    methodCount: number;
    hasLogging: boolean;
  };
}

/**
 * Configuration for a bulk method creation helper
 */
export interface BulkMethodCreationConfig<TDependencies extends BaseDomainServiceDependencies> {
  /** Service dependencies */
  dependencies: TDependencies;
  /** Default error handling configuration */
  defaultErrorConfig?: ErrorHandlingConfig;
  /** Service name for logging */
  serviceName: string;
}

/**
 * Method definition for bulk creation
 */
export interface MethodDefinition<TInput, TOutput extends ServiceOutput> {
  /** Method name */
  name: string;
  /** Method configuration */
  config: ServiceMethodConfig<TInput, TOutput> | PaginatedServiceMethodConfig<TInput, TOutput>;
  /** Method type (normal, paginated, or crud) */
  type?: 'normal' | 'paginated' | 'crud';
}

/**
 * Create a domain service with standardized patterns
 *
 * This template eliminates the repetitive service creation patterns found
 * across the codebase and provides a consistent foundation for all domain services.
 *
 * @template TDependencies - Service dependencies type
 * @template TMethods - Service methods registry type
 * @param config - Service configuration
 * @param methodsFactory - Function that creates the service methods
 * @returns Complete domain service instance
 */
export const createDomainService = <
  TDependencies extends BaseDomainServiceDependencies,
  TMethods extends ServiceMethodRegistry,
>(
  config: DomainServiceConfig<TDependencies>,
  methodsFactory: (dependencies: TDependencies) => TMethods
): DomainService<TMethods> => {
  const serviceLogger = config.dependencies.logger || logger;

  if (config.enableServiceLogging) {
    serviceLogger.debug(`Creating domain service: ${config.serviceName}`, {
      serviceName: config.serviceName,
      dependencyCount: Object.keys(config.dependencies).length,
    });
  }

  // Create service methods using the factory function
  const methods = methodsFactory(config.dependencies);

  const service: DomainService<TMethods> = {
    serviceName: config.serviceName,
    methods,
    dependencies: config.dependencies,
    metadata: {
      createdAt: new Date(),
      methodCount: Object.keys(methods).length,
      hasLogging: config.enableServiceLogging || false,
    },
  };

  if (config.enableServiceLogging) {
    serviceLogger.info(`Domain service created successfully: ${config.serviceName}`, {
      serviceName: config.serviceName,
      methodCount: service.metadata.methodCount,
      createdAt: service.metadata.createdAt,
    });
  }

  return service;
};

/**
 * Bulk method creation helper
 *
 * Creates multiple service methods at once using standardized patterns.
 * Reduces boilerplate when creating services with many similar methods.
 */
export const createBulkMethods = <TDependencies extends BaseDomainServiceDependencies>(
  bulkConfig: BulkMethodCreationConfig<TDependencies>,
  definitions: MethodDefinition<unknown, ServiceOutput>[]
): ServiceMethodRegistry => {
  const methods: ServiceMethodRegistry = {};
  const serviceMethodDeps: ServiceMethodDependencies = {
    clientManager: bulkConfig.dependencies.clientManager,
  };

  for (const definition of definitions) {
    const methodName = definition.name;

    try {
      switch (definition.type || 'normal') {
        case 'normal':
          methods[methodName] = createServiceMethod(
            definition.config as ServiceMethodConfig<unknown, ServiceOutput>,
            serviceMethodDeps
          );
          break;

        case 'paginated':
          methods[methodName] = createPaginatedServiceMethod(
            definition.config as PaginatedServiceMethodConfig<unknown, ServiceOutput>,
            serviceMethodDeps
          );
          break;

        case 'crud':
          // Note: CRUD methods require additional configuration
          // This is a placeholder for future CRUD method integration
          methods[methodName] = createServiceMethod(
            definition.config as ServiceMethodConfig<unknown, ServiceOutput>,
            serviceMethodDeps
          );
          break;

        default:
          throw new Error(`Unknown method type: ${definition.type}`);
      }

      if (bulkConfig.defaultErrorConfig?.enableLogging) {
        logger.debug(`Created service method: ${methodName}`, {
          serviceName: bulkConfig.serviceName,
          methodName,
          methodType: definition.type || 'normal',
        });
      }
    } catch (error) {
      logger.error(`Failed to create service method: ${methodName}`, {
        serviceName: bulkConfig.serviceName,
        methodName,
        error: error instanceof Error ? error.message : String(error),
      });

      // Create a fallback error method
      methods[methodName] = async (_args: unknown): Promise<ServiceResult<ServiceOutput>> => {
        return handleServiceError(
          new Error(`Method ${methodName} failed to initialize`),
          createErrorContext(methodName),
          `${methodName} is not available`
        );
      };
    }
  }

  return methods;
};

/**
 * Service method builder for fluent API creation
 *
 * Provides a fluent interface for building service methods with
 * standardized patterns and configurations.
 */
export class ServiceMethodBuilder<TInput, TOutput extends ServiceOutput> {
  private config: Partial<ServiceMethodConfig<TInput, TOutput>> = {};

  constructor(private dependencies: ServiceMethodDependencies) {}

  schema(schema: ZodSchema<TInput>): this {
    this.config.schema = schema;
    return this;
  }

  operation(operation: 'read' | 'write'): this {
    this.config.operation = operation;
    return this;
  }

  handler(handler: ServiceMethodConfig<TInput, TOutput>['handler']): this {
    this.config.handler = handler;
    return this;
  }

  successMessage(message: string): this {
    this.config.successMessage = message;
    return this;
  }

  methodName(name: string): this {
    this.config.methodName = name;
    return this;
  }

  errorPrefix(prefix: string): this {
    this.config.errorPrefix = prefix;
    return this;
  }

  enableInputLogging(): this {
    this.config.logInputs = true;
    return this;
  }

  enableOutputLogging(): this {
    this.config.logOutputs = true;
    return this;
  }

  build(): (args: unknown) => Promise<ServiceResult<TOutput>> {
    // Validate that all required config is present
    if (!this.config.schema) {
      throw new Error('Schema is required for service method');
    }
    if (!this.config.operation) {
      throw new Error('Operation type is required for service method');
    }
    if (!this.config.handler) {
      throw new Error('Handler function is required for service method');
    }
    if (!this.config.successMessage) {
      throw new Error('Success message is required for service method');
    }

    return createServiceMethod(
      this.config as ServiceMethodConfig<TInput, TOutput>,
      this.dependencies
    );
  }
}

/**
 * Create a service method builder
 *
 * Provides a fluent interface for creating service methods.
 */
export const createMethodBuilder = <TInput, TOutput extends ServiceOutput>(
  dependencies: ServiceMethodDependencies
): ServiceMethodBuilder<TInput, TOutput> => {
  return new ServiceMethodBuilder<TInput, TOutput>(dependencies);
};

/**
 * Common service patterns for standard operations
 */
export const ServicePatterns = {
  /**
   * Standard CRUD operation patterns
   */
  crud: {
    /** Create a simple read operation */
    read: <TInput, TOutput extends ServiceOutput>(
      schema: ZodSchema<TInput>,
      handler: ServiceMethodConfig<TInput, TOutput>['handler'],
      resourceName: string
    ): ServiceMethodConfig<TInput, TOutput> => ({
      schema,
      operation: 'read' as const,
      handler,
      successMessage: `${resourceName} retrieved successfully`,
      methodName: `get${resourceName}`,
    }),

    /** Create a simple write operation */
    write: <TInput, TOutput extends ServiceOutput>(
      schema: ZodSchema<TInput>,
      handler: ServiceMethodConfig<TInput, TOutput>['handler'],
      resourceName: string,
      operationType: 'create' | 'update' | 'delete' = 'create'
    ): ServiceMethodConfig<TInput, TOutput> => ({
      schema,
      operation: 'write' as const,
      handler,
      successMessage: `${resourceName} ${operationType}d successfully`,
      methodName: `${operationType}${resourceName}`,
    }),
  },

  /**
   * Search operation patterns
   */
  search: {
    /** Create a search operation with pagination support */
    paginated: <TInput, TOutput extends ServiceOutput>(
      schema: ZodSchema<TInput>,
      handler: ServiceMethodConfig<TInput, TOutput>['handler'],
      resourceName: string
    ): PaginatedServiceMethodConfig<TInput, TOutput> => ({
      schema,
      operation: 'read' as const,
      handler,
      successMessage: `${resourceName} search completed successfully`,
      methodName: `search${resourceName}`,
      supportsPagination: true,
    }),
  },

  /**
   * File operation patterns
   */
  files: {
    /** Create a file upload operation */
    upload: <TInput, TOutput extends ServiceOutput>(
      schema: ZodSchema<TInput>,
      handler: ServiceMethodConfig<TInput, TOutput>['handler']
    ): ServiceMethodConfig<TInput, TOutput> => ({
      schema,
      operation: 'write' as const,
      handler,
      successMessage: 'File uploaded successfully',
      methodName: 'uploadFile',
      errorPrefix: 'Failed to upload file',
    }),

    /** Create a file analysis operation */
    analyze: <TInput, TOutput extends ServiceOutput>(
      schema: ZodSchema<TInput>,
      handler: ServiceMethodConfig<TInput, TOutput>['handler']
    ): ServiceMethodConfig<TInput, TOutput> => ({
      schema,
      operation: 'read' as const,
      handler,
      successMessage: 'File analysis completed successfully',
      methodName: 'analyzeFiles',
    }),
  },
};

/**
 * Service registry helper for organizing multiple services
 */
export interface ServiceRegistry {
  [serviceName: string]: DomainService;
}

/**
 * Create a service registry with multiple domain services
 */
export const createServiceRegistry = (services: DomainService[]): ServiceRegistry => {
  const registry: ServiceRegistry = {};

  for (const service of services) {
    registry[service.serviceName] = service;
  }

  logger.info('Service registry created', {
    serviceCount: services.length,
    services: services.map((s) => s.serviceName),
  });

  return registry;
};

/**
 * Get all methods from a service registry as a flat map
 */
export const flattenServiceMethods = (registry: ServiceRegistry): ServiceMethodRegistry => {
  const methods: ServiceMethodRegistry = {};

  for (const [serviceName, service] of Object.entries(registry)) {
    for (const [methodName, method] of Object.entries(service.methods)) {
      // Prefix method names with service name to avoid conflicts
      const qualifiedMethodName = `${serviceName}.${methodName}`;
      methods[qualifiedMethodName] = method;

      // Also add unprefixed method names for backward compatibility
      if (!methods[methodName]) {
        methods[methodName] = method;
      }
    }
  }

  return methods;
};
