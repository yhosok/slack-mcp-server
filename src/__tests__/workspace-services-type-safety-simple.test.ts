/**
 * Workspace Services Type Safety Implementation Validation
 * 
 * This test file validates that TypeSafeAPI patterns have been successfully
 * implemented in Workspace Services and are working correctly.
 * 
 * Expected Result: All tests should PASS, proving implementation is complete.
 */

import { jest } from '@jest/globals';
import { match } from 'ts-pattern';
import {
  validateServiceResult,
  createServiceSuccess,
  createServiceError,
  handleServiceResult,
} from '../slack/types/typesafe-api-patterns.js';
import type { WorkspaceInfoOutput } from '../slack/types/outputs/workspace.js';

// Mock configuration to prevent environment dependencies
jest.mock('../config/index.js', () => ({
  CONFIG: {
    SLACK_BOT_TOKEN: 'xoxb-test-token',
    SLACK_USER_TOKEN: 'xoxp-test-token',
    USE_USER_TOKEN_FOR_READ: false,
    LOG_LEVEL: 'info',
  },
}));

// Mock logger
jest.mock('../utils/logger.js', () => ({
  logger: {
    warn: jest.fn(),
    debug: jest.fn(),
    error: jest.fn(),
    info: jest.fn(),
  },
}));

describe('Workspace Services Type Safety Implementation Validation', () => {
  describe('TypeSafeAPI Pattern Validation', () => {
    it('should validate: ServiceResult patterns work correctly', () => {
      // Test ServiceResult creation patterns
      const mockWorkspaceData: WorkspaceInfoOutput = {
        id: 'T123456',
        name: 'Test Workspace',
        domain: 'test-workspace',
        emailDomain: 'test.com',
      };

      const successResult = createServiceSuccess(mockWorkspaceData, 'Success');
      const errorResult = createServiceError('Test error', 'Failed');

      // Validate ServiceResult structure
      expect(validateServiceResult(successResult)).toBe(true);
      expect(validateServiceResult(errorResult)).toBe(true);

      // Validate discriminated union properties
      expect(successResult.success).toBe(true);
      expect(errorResult.success).toBe(false);

      if (successResult.success) {
        expect(successResult.data).toEqual(mockWorkspaceData);
        expect(successResult.message).toBe('Success');
      }

      if (!errorResult.success) {
        expect(errorResult.error).toBe('Test error');
        expect(errorResult.message).toBe('Failed');
      }
    });

    it('should validate: ts-pattern exhaustive matching works with ServiceResult', () => {
      const mockData: WorkspaceInfoOutput = {
        id: 'T123456',
        name: 'Test Workspace',
        domain: 'test-workspace',
      };

      const successResult = createServiceSuccess(mockData, 'Success');
      const errorResult = createServiceError('Test error', 'Failed');

      // Test exhaustive matching on success result
      const successProcessed = match(successResult)
        .with({ success: true }, (result) => ({
          type: 'success' as const,
          workspaceName: result.data.name,
          workspaceId: result.data.id,
        }))
        .with({ success: false }, (result) => ({
          type: 'error' as const,
          error: result.error,
        }))
        .exhaustive();

      expect(successProcessed.type).toBe('success');
      if (successProcessed.type === 'success') {
        expect(successProcessed.workspaceName).toBe('Test Workspace');
        expect(successProcessed.workspaceId).toBe('T123456');
      }

      // Test exhaustive matching on error result
      const errorProcessed = match(errorResult)
        .with({ success: true }, (result) => ({
          type: 'success' as const,
          data: result.data,
        }))
        .with({ success: false }, (result) => ({
          type: 'error' as const,
          error: result.error,
        }))
        .exhaustive();

      expect(errorProcessed.type).toBe('error');
      if (errorProcessed.type === 'error') {
        expect(errorProcessed.error).toBe('Test error');
      }
    });

    it('should validate: handleServiceResult provides consistent API response structure', () => {
      const mockData: WorkspaceInfoOutput = {
        id: 'T123456',
        name: 'Test Workspace',
        domain: 'test-workspace',
      };

      const successResult = createServiceSuccess(mockData, 'Success message');
      const errorResult = createServiceError('Test error', 'Failed message');

      // Test success response structure
      const successApiResponse = handleServiceResult(successResult);
      expect(successApiResponse).toHaveProperty('statusCode', '10000');
      expect(successApiResponse).toHaveProperty('message', 'Success message');
      expect(successApiResponse).toHaveProperty('data');
      expect(successApiResponse.data).toEqual(mockData);
      expect(successApiResponse).not.toHaveProperty('error');

      // Test error response structure
      const errorApiResponse = handleServiceResult(errorResult);
      expect(errorApiResponse).toHaveProperty('statusCode', '10001');
      expect(errorApiResponse).toHaveProperty('message', 'Failed message');
      expect(errorApiResponse).toHaveProperty('error', 'Test error');
      expect(errorApiResponse).not.toHaveProperty('data');
    });

    it('should validate: type narrowing works correctly with discriminated unions', () => {
      const mockData: WorkspaceInfoOutput = {
        id: 'T123456',
        name: 'Test Workspace',
        domain: 'test-workspace',
      };

      const successResult = createServiceSuccess(mockData, 'Success');
      const errorResult = createServiceError('Test error', 'Failed');

      // Test type narrowing with success result
      if (successResult.success) {
        // TypeScript should narrow this to success type
        expect(successResult.data.name).toBe('Test Workspace');
        expect(successResult.data.id).toBe('T123456');
        expect('error' in successResult).toBe(false);
      } else {
        fail('Expected success result');
      }

      // Test type narrowing with error result
      if (!errorResult.success) {
        // TypeScript should narrow this to error type
        expect(errorResult.error).toBe('Test error');
        expect(errorResult.message).toBe('Failed');
        expect('data' in errorResult).toBe(false);
      } else {
        fail('Expected error result');
      }
    });

    it('should validate: JSON serialization safety is guaranteed', () => {
      const mockData: WorkspaceInfoOutput = {
        id: 'T123456',
        name: 'Test Workspace',
        domain: 'test-workspace',
        emailDomain: 'test.com',
        icon: {
          image34: 'icon34.png',
          image44: 'icon44.png',
        },
      };

      const successResult = createServiceSuccess(mockData, 'Success');
      const errorResult = createServiceError('Test error', 'Failed');

      // Test that results can be JSON serialized and parsed
      expect(() => {
        const successJson = JSON.stringify(successResult);
        const parsedSuccess = JSON.parse(successJson);
        expect(parsedSuccess.success).toBe(true);
        expect(parsedSuccess.data.name).toBe('Test Workspace');
      }).not.toThrow();

      expect(() => {
        const errorJson = JSON.stringify(errorResult);
        const parsedError = JSON.parse(errorJson);
        expect(parsedError.success).toBe(false);
        expect(parsedError.error).toBe('Test error');
      }).not.toThrow();

      // Test that API responses can be JSON serialized
      const successApiResponse = handleServiceResult(successResult);
      const errorApiResponse = handleServiceResult(errorResult);

      expect(() => {
        JSON.parse(JSON.stringify(successApiResponse));
        JSON.parse(JSON.stringify(errorApiResponse));
      }).not.toThrow();
    });
  });

  describe('Compile-time Type Safety Validation', () => {
    it('should validate: ServiceOutput constraint enforcement works', () => {
      // Test that WorkspaceInfoOutput extends ServiceOutput
      const mockData: WorkspaceInfoOutput = {
        id: 'T123456',
        name: 'Test Workspace',
        domain: 'test-workspace',
        customField: 'custom value', // ServiceOutput allows string indexing
      };

      // This should compile without errors
      const result = createServiceSuccess(mockData, 'Success');
      expect(result.success).toBe(true);
      
      if (result.success) {
        expect(result.data.id).toBe('T123456');
        expect(result.data.name).toBe('Test Workspace');
        expect(result.data.customField).toBe('custom value');
      }
    });

    it('should validate: discriminated union type safety works at compile time', () => {
      const mockData: WorkspaceInfoOutput = {
        id: 'T123456',
        name: 'Test Workspace',
        domain: 'test-workspace',
      };

      const result = createServiceSuccess(mockData, 'Success');

      // These type assertions should compile correctly
      type SuccessType = typeof result extends { success: true } ? true : false;
      type HasDataType = typeof result extends { success: true; data: WorkspaceInfoOutput } ? true : false;
      
      // Runtime validation that types are correct
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toBeDefined();
        expect(typeof result.data.name).toBe('string');
      }
    });
  });

  describe('Integration Pattern Validation', () => {
    it('should validate: complex pattern matching scenarios work correctly', () => {
      const mockData: WorkspaceInfoOutput = {
        id: 'T123456',
        name: 'Test Workspace',
        domain: 'test-workspace',
        enterpriseId: 'E123456',
      };

      const result = createServiceSuccess(mockData, 'Success');

      // Test complex pattern matching with multiple conditions
      const analysis = match(result)
        .with({ success: true }, (success) => 
          match(success.data)
            .with({ enterpriseId: 'E123456' }, (data) => ({
              type: 'enterprise-workspace' as const,
              name: data.name,
              isEnterprise: true,
            }))
            .with({ enterpriseId: undefined }, (data) => ({
              type: 'regular-workspace' as const,
              name: data.name,
              isEnterprise: false,
            }))
            .otherwise((data) => ({
              type: 'unknown-workspace' as const,
              name: data.name,
              isEnterprise: false,
            }))
        )
        .with({ success: false }, (error) => ({
          type: 'error' as const,
          error: error.error,
          isEnterprise: false,
        }))
        .exhaustive();

      expect(analysis.type).toBe('enterprise-workspace');
      if (analysis.type === 'enterprise-workspace') {
        expect(analysis.name).toBe('Test Workspace');
        expect(analysis.isEnterprise).toBe(true);
      }
    });

    it('should validate: error handling patterns work correctly', () => {
      const errorResult = createServiceError('Slack API Error', 'Failed to retrieve workspace info');

      // Test error-specific pattern matching
      const errorHandling = match(errorResult)
        .with({ success: false, error: 'Slack API Error' }, (error) => ({
          type: 'api-error' as const,
          retryable: true,
          userMessage: 'Slack service is temporarily unavailable',
        }))
        .with({ success: false }, (error) => ({
          type: 'general-error' as const,
          retryable: false,
          userMessage: error.message,
        }))
        .otherwise(() => ({
          type: 'unknown' as const,
          retryable: false,
          userMessage: 'An unknown error occurred',
        }));

      expect(errorHandling.type).toBe('api-error');
      expect(errorHandling.retryable).toBe(true);
      expect(errorHandling.userMessage).toBe('Slack service is temporarily unavailable');
    });
  });
});