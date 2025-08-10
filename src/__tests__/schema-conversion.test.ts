/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { jest } from '@jest/globals';
import { z } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';
import type { JSONSchema7 } from 'json-schema';
import { createMCPTool, defineSlackTool } from '../mcp/schema-converter.js';
import {
  SendMessageSchema,
  ListChannelsSchema,
  GetChannelHistorySchema,
  AnalyzeThreadSchema,
  SearchMessagesSchema,
} from '../utils/validation.js';

// Mock configuration to prevent environment variable requirements in tests
jest.mock('../config/index.js', () => ({
  CONFIG: {
    SLACK_BOT_TOKEN: 'xoxb-test-token',
    SLACK_USER_TOKEN: 'xoxp-test-token',
    USE_USER_TOKEN_FOR_READ: false,
    LOG_LEVEL: 'info',
    SLACK_ENABLE_RATE_LIMIT_RETRY: true,
    SLACK_RATE_LIMIT_RETRIES: 3,
    SLACK_MAX_REQUEST_CONCURRENCY: 3,
    SLACK_REJECT_RATE_LIMITED_CALLS: false,
  },
}));

describe('Schema Conversion', () => {
  describe('createMCPTool', () => {
    it('should convert a simple Zod schema to MCP tool format', () => {
      const testSchema = z.object({
        name: z.string().describe('User name'),
        age: z.number().min(0).describe('User age'),
      });

      const result = createMCPTool('test_tool', 'A test tool', testSchema);

      expect(result.name).toBe('test_tool');
      expect(result.description).toBe('A test tool');
      expect(result.inputSchema).toBeDefined();
      expect(result.inputSchema.additionalProperties).toBe(false);
      expect(result.inputSchema.type).toBe('object');
      expect(result.inputSchema.properties).toBeDefined();
      expect(result.inputSchema.required).toEqual(['name', 'age']);
    });

    it('should preserve required fields from Zod schema', () => {
      const testSchema = z.object({
        required_field: z.string(),
        optional_field: z.string().optional(),
      });

      const result = createMCPTool('required_test', 'Test required fields', testSchema);

      expect(result.inputSchema.required).toEqual(['required_field']);
      expect(result.inputSchema.properties?.required_field).toBeDefined();
      expect(result.inputSchema.properties?.optional_field).toBeDefined();
    });

    it('should maintain field descriptions from Zod schema', () => {
      const testSchema = z.object({
        channel: z.string().describe('Channel ID to send message to'),
        text: z.string().describe('Message text to send'),
      });

      const result = createMCPTool('desc_test', 'Test descriptions', testSchema);
      const channelProp = result.inputSchema.properties?.channel as JSONSchema7;
      const textProp = result.inputSchema.properties?.text as JSONSchema7;

      expect(channelProp?.description).toBe('Channel ID to send message to');
      expect(textProp?.description).toBe('Message text to send');
    });

    it('should handle enum values correctly', () => {
      const testSchema = z.object({
        sort: z.enum(['asc', 'desc']).describe('Sort direction'),
      });

      const result = createMCPTool('enum_test', 'Test enum handling', testSchema);
      const sortProp = result.inputSchema.properties?.sort as JSONSchema7;

      expect(sortProp?.enum).toEqual(['asc', 'desc']);
      expect(sortProp?.description).toBe('Sort direction');
    });

    it('should handle default values correctly', () => {
      const testSchema = z.object({
        limit: z.number().default(10).describe('Number of items to return'),
        enabled: z.boolean().default(true).describe('Enable feature'),
      });

      const result = createMCPTool('default_test', 'Test default values', testSchema);
      const limitProp = result.inputSchema.properties?.limit as JSONSchema7;
      const enabledProp = result.inputSchema.properties?.enabled as JSONSchema7;

      expect(limitProp?.default).toBe(10);
      expect(enabledProp?.default).toBe(true);
    });
  });

  describe('defineSlackTool', () => {
    it('should create MCP tools with consistent structure', () => {
      const testSchema = z.object({
        user: z.string().describe('User ID'),
      });

      const result = defineSlackTool('slack_test', 'Slack API test', testSchema);

      expect(result.name).toBe('slack_test');
      expect(result.description).toBe('Slack API test');
      expect(result.inputSchema.additionalProperties).toBe(false);
      expect(result.inputSchema.type).toBe('object');
    });
  });

  describe('Real Schema Conversions', () => {
    it('should correctly convert SendMessageSchema', () => {
      const result = createMCPTool('send_message', 'Send message', SendMessageSchema);
      const channelProp = result.inputSchema.properties?.channel as JSONSchema7;
      const textProp = result.inputSchema.properties?.text as JSONSchema7;

      expect(result.inputSchema.required).toEqual(['channel', 'text']);
      expect(channelProp?.type).toBe('string');
      expect(textProp?.type).toBe('string');
      expect(result.inputSchema.properties?.thread_ts).toBeDefined();
      expect(result.inputSchema.additionalProperties).toBe(false);
    });

    it('should correctly convert ListChannelsSchema with defaults', () => {
      const result = createMCPTool('list_channels', 'List channels', ListChannelsSchema);
      const typesProp = result.inputSchema.properties?.types as JSONSchema7;
      const excludeArchivedProp = result.inputSchema.properties?.exclude_archived as JSONSchema7;

      expect(typesProp?.default).toBe('public_channel,private_channel');
      expect(excludeArchivedProp?.default).toBe(true);
      expect(excludeArchivedProp?.type).toBe('boolean');
      expect(result.inputSchema.additionalProperties).toBe(false);
    });

    it('should correctly convert GetChannelHistorySchema with limits', () => {
      const result = createMCPTool('get_channel_history', 'Get history', GetChannelHistorySchema);
      const limitProp = result.inputSchema.properties?.limit as JSONSchema7;

      expect(result.inputSchema.required).toEqual(['channel']);
      expect(limitProp?.minimum).toBe(1);
      expect(limitProp?.maximum).toBe(100);
      expect(limitProp?.default).toBe(10);
      expect(result.inputSchema.additionalProperties).toBe(false);
    });

    it('should correctly convert AnalyzeThreadSchema with booleans', () => {
      const result = createMCPTool('analyze_thread', 'Analyze thread', AnalyzeThreadSchema);
      const sentimentProp = result.inputSchema.properties
        ?.include_sentiment_analysis as JSONSchema7;
      const topicsProp = result.inputSchema.properties?.extract_topics as JSONSchema7;

      expect(result.inputSchema.required).toEqual(['channel', 'thread_ts']);
      expect(sentimentProp?.type).toBe('boolean');
      expect(sentimentProp?.default).toBe(true);
      expect(topicsProp?.default).toBe(true);
      expect(result.inputSchema.additionalProperties).toBe(false);
    });

    it('should correctly convert SearchMessagesSchema with enums', () => {
      const result = createMCPTool('search_messages', 'Search messages', SearchMessagesSchema);
      const sortProp = result.inputSchema.properties?.sort as JSONSchema7;
      const sortDirProp = result.inputSchema.properties?.sort_dir as JSONSchema7;

      expect(result.inputSchema.required).toEqual(['query']);
      expect(sortProp?.enum).toEqual(['score', 'timestamp']);
      expect(sortDirProp?.enum).toEqual(['asc', 'desc']);
      expect(sortProp?.default).toBe('score');
      expect(sortDirProp?.default).toBe('desc');
      expect(result.inputSchema.additionalProperties).toBe(false);
    });
  });

  describe('Schema Structure Validation', () => {
    it('should ensure all converted schemas have additionalProperties: false', () => {
      const schemas = [
        SendMessageSchema,
        ListChannelsSchema,
        GetChannelHistorySchema,
        AnalyzeThreadSchema,
        SearchMessagesSchema,
      ];

      schemas.forEach((schema, index) => {
        const result = createMCPTool(`test_${index}`, `Test ${index}`, schema);
        expect(result.inputSchema.additionalProperties).toBe(false);
      });
    });

    it('should preserve original zod-to-json-schema behavior', () => {
      const testSchema = z.object({
        test: z.string(),
      });

      // Direct zod-to-json-schema conversion
      const directConversion = zodToJsonSchema(testSchema, {
        $refStrategy: 'none',
        target: 'jsonSchema7',
      }) as JSONSchema7;

      // Our wrapper conversion
      const wrapperResult = createMCPTool('test', 'test', testSchema);

      // Should have same structure except for additionalProperties
      expect(wrapperResult.inputSchema.type).toBe(directConversion.type);
      expect(wrapperResult.inputSchema.properties).toEqual(directConversion.properties);
      expect(wrapperResult.inputSchema.required).toEqual(directConversion.required);

      // Our wrapper should add additionalProperties: false
      expect(wrapperResult.inputSchema.additionalProperties).toBe(false);
    });

    it('should handle complex nested schemas', () => {
      const complexSchema = z.object({
        config: z.object({
          enabled: z.boolean().default(true),
          options: z.array(z.string()),
        }),
        metadata: z.record(z.string(), z.unknown()).optional(),
      });

      const result = createMCPTool('complex_test', 'Complex schema test', complexSchema);
      const configProp = result.inputSchema.properties?.config as JSONSchema7;
      const enabledProp = configProp?.properties?.enabled as JSONSchema7;
      const optionsProp = configProp?.properties?.options as JSONSchema7;

      expect(result.inputSchema.additionalProperties).toBe(false);
      expect(configProp?.type).toBe('object');
      expect(enabledProp?.default).toBe(true);
      expect(optionsProp?.type).toBe('array');
      expect(result.inputSchema.required).toEqual(['config']);
    });
  });
});
