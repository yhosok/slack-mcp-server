/**
 * TDD Green Phase - Get Message Images Test Suite
 * 
 * Test Status: 🟢 GREEN PHASE - Implementation complete, tests should PASS
 * 
 * Purpose: Comprehensive test coverage for get_message_images MCP tool
 * Expected Behavior: ALL TESTS SHOULD PASS with complete implementation
 * 
 * Test Coverage:
 * ✅ Basic image retrieval from message
 * ✅ Image data inclusion option
 * ✅ Messages with no images handling
 * ✅ Invalid channel/timestamp error handling
 * ✅ Multiple images in single message
 * ✅ Mixed file types filtering
 */

import { jest } from '@jest/globals';
import type { MCPToolResult, MCPTextContent } from '../mcp/types.js';

// Mock configuration to prevent environment dependencies
jest.mock('../config/index.js', () => ({
  CONFIG: {
    SLACK_BOT_TOKEN: 'xoxb-test-token',
    SLACK_USER_TOKEN: 'xoxp-test-token',
    USE_USER_TOKEN_FOR_READ: false,
    LOG_LEVEL: 'info',
    // Cache configuration
    CACHE_ENABLED: false,
    CACHE_CHANNELS_MAX: 100,
    CACHE_CHANNELS_TTL: 3600,
    CACHE_USERS_MAX: 100,
    CACHE_USERS_TTL: 1800,
    CACHE_SEARCH_MAX_QUERIES: 50,
    CACHE_SEARCH_MAX_RESULTS: 500,
    CACHE_SEARCH_QUERY_TTL: 900,
    CACHE_SEARCH_RESULT_TTL: 900,
    CACHE_FILES_MAX: 100,
    CACHE_FILES_TTL: 3600,
    CACHE_THREADS_MAX: 100,
    CACHE_THREADS_TTL: 3600,
    // Rate limiting configuration
    SLACK_ENABLE_RATE_LIMIT_RETRY: true,
    SLACK_RATE_LIMIT_RETRIES: 3,
    SLACK_MAX_REQUEST_CONCURRENCY: 3,
    SLACK_REJECT_RATE_LIMITED_CALLS: false,
    // Search ranking configuration
    SEARCH_RANKING_ENABLED: true,
    SEARCH_INDEX_TTL: 900,
    SEARCH_TIME_DECAY_RATE: 0.01,
    SEARCH_MAX_INDEX_SIZE: 10000,
  }
}));

// Create a shared mock WebClient instance with proper typing
const createMockWebClient = (): any => ({
  // eslint-disable-line @typescript-eslint/no-explicit-any
  chat: {
    postMessage: jest.fn(),
  },
  conversations: {
    list: jest.fn(),
    history: jest.fn(),
    replies: jest.fn(),
    info: jest.fn(),
  },
  users: {
    info: jest.fn(),
  },
  search: {
    messages: jest.fn(),
    all: jest.fn(),
  },
  reactions: {
    add: jest.fn(),
  },
  files: {
    upload: jest.fn(),
    list: jest.fn(),
    info: jest.fn(),
    delete: jest.fn(),
    share: jest.fn(),
  },
  auth: {
    test: jest.fn(),
  },
  on: jest.fn(),
  apiCall: jest.fn(),
});

let MockWebClientInstance = createMockWebClient();

// Mock the WebClient
jest.mock('@slack/web-api', () => ({
  WebClient: jest.fn().mockImplementation(() => MockWebClientInstance),
  LogLevel: {
    DEBUG: 'debug',
    INFO: 'info',
    WARN: 'warn',
    ERROR: 'error',
  },
  WebClientEvent: {
    RATE_LIMITED: 'rate_limited',
  },
  retryPolicies: {
    fiveRetriesInFiveMinutes: {
      retries: 5,
      factor: 2,
      minTimeout: 1000,
      maxTimeout: 300000,
      randomize: true,
    },
  },
}));

// Mock the logger
jest.mock('../utils/logger.js', () => ({
  logger: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

// Helper function to safely extract text content from MCP result
const getTextContent = (result: MCPToolResult): string => {
  expect(result.content).toBeDefined();
  expect(result.content.length).toBeGreaterThan(0);
  
  const firstContent = result.content[0];
  expect(firstContent).toBeDefined();
  
  if (!firstContent) {
    throw new Error('First content is undefined');
  }
  
  expect(firstContent.type).toBe('text');
  
  if (firstContent.type === 'text') {
    return (firstContent as MCPTextContent).text;
  }
  
  throw new Error('Expected text content but got different type');
};

// Helper function to parse JSON from MCP text result
const parseJSONResponse = (result: MCPToolResult) => {
  const textContent = getTextContent(result);
  return JSON.parse(textContent);
};

// Import after mocking
import { SlackService } from '../slack/slack-service.js';

describe('TDD Green Phase: get_message_images Tool Implementation', () => {
  let slackService: SlackService;

  beforeEach(() => {
    // Reset the mock instance for each test
    MockWebClientInstance = createMockWebClient();
    slackService = new SlackService();
    jest.clearAllMocks();
    
    // Reset fetch mock if it exists
    if (global.fetch && jest.isMockFunction(global.fetch)) {
      // @ts-expect-error - Mock access for testing
      global.fetch.mockReset();
    }
  });

  describe('🟢 GREEN PHASE: Basic Image Retrieval', () => {
    test('should succeed - getMessageImages method exists and works', async () => {
      // Arrange
      MockWebClientInstance.conversations.history.mockResolvedValueOnce({
        ok: true,
        messages: [{
          ts: '1234567890.123456',
          user: 'U1234567890',
          text: 'Test message without images'
        }]
      });

      const args = {
        channel: 'C1234567890',
        message_ts: '1234567890.123456',
        include_image_data: false
      };

      // Act
      const result = await slackService.getMessageImages(args);

      // Assert - Method should exist and work
      expect(result).toBeDefined();
      expect(result.content).toBeDefined();
      expect(result.isError).toBe(false);
    });

    test('should succeed - MCP tool get_message_images is registered', async () => {
      // This test now passes because the tool is in the ALL_TOOLS array
      const { ALL_TOOLS } = await import('../mcp/tools.js');
      
      const getMessageImagesTool = ALL_TOOLS.find(tool => tool.name === 'get_message_images');
      
      expect(getMessageImagesTool).toBeDefined();
      expect(getMessageImagesTool?.name).toBe('get_message_images');
      expect(getMessageImagesTool?.description).toBe('Get all images from a specific message');
    });
  });

  describe('🟢 GREEN PHASE: Expected Functionality Tests', () => {
    test('should succeed - message with single image retrieval', async () => {
      // Mock setup for successful image retrieval
      MockWebClientInstance.conversations.history.mockResolvedValueOnce({
        ok: true,
        messages: [{
          ts: '1234567890.123456',
          user: 'U1234567890',
          text: 'Check out this screenshot!',
          files: [{
            id: 'F1234567890',
            name: 'screenshot.png',
            url_private: 'https://files.slack.com/files-pri/T12345-F1234567890/screenshot.png',
            url_private_download: 'https://files.slack.com/files-pri/T12345-F1234567890/download/screenshot.png',
            mimetype: 'image/png',
            filetype: 'png',
            size: 1024000,
            thumb_360: 'https://files.slack.com/files-tmb/T12345-F1234567890-abc123/screenshot_360.png'
          }]
        }]
      });

      const args = {
        channel: 'C1234567890',
        message_ts: '1234567890.123456',
        include_image_data: false
      };

      // Act
      const result = await slackService.getMessageImages(args);

      // Assert
      expect(result).toBeDefined();
      expect(result.isError).toBe(false);
      
      const parsedData = parseJSONResponse(result);
      expect(parsedData.data).toHaveProperty('channel', 'C1234567890');
      expect(parsedData.data).toHaveProperty('message_ts', '1234567890.123456');
      expect(parsedData.data).toHaveProperty('images');
      expect(parsedData.data).toHaveProperty('total_images');
      expect(parsedData.data.images).toHaveLength(1);
      expect(parsedData.data.total_images).toBe(1);
      
      const image = parsedData.data.images[0];
      expect(image).toHaveProperty('id', 'F1234567890');
      expect(image).toHaveProperty('name', 'screenshot.png');
      expect(image).toHaveProperty('mimetype', 'image/png');
      expect(image).toHaveProperty('filetype', 'png');
      expect(image).toHaveProperty('url_private');
      expect(image).toHaveProperty('url_private_download');
      expect(image).toHaveProperty('size', 1024000);
      expect(image).toHaveProperty('thumb_360');
    });

    test('should succeed - message with no images handling', async () => {
      // Mock message without files
      MockWebClientInstance.conversations.history.mockResolvedValueOnce({
        ok: true,
        messages: [{
          ts: '1234567890.123456',
          user: 'U1234567890',
          text: 'Just a text message with no images'
        }]
      });

      const args = {
        channel: 'C1234567890',
        message_ts: '1234567890.123456',
        include_image_data: false
      };

      // Act
      const result = await slackService.getMessageImages(args);

      // Assert
      expect(result).toBeDefined();
      expect(result.isError).toBe(false);
      
      const parsedData = parseJSONResponse(result);
      expect(parsedData.data).toHaveProperty('channel', 'C1234567890');
      expect(parsedData.data).toHaveProperty('message_ts', '1234567890.123456');
      expect(parsedData.data).toHaveProperty('images');
      expect(parsedData.data.images).toHaveLength(0);
      expect(parsedData.data.total_images).toBe(0);
    });

    test('should succeed - include_image_data option with base64 encoding', async () => {
      // Mock message with image file
      MockWebClientInstance.conversations.history.mockResolvedValueOnce({
        ok: true,
        messages: [{
          ts: '1234567890.123456',
          user: 'U1234567890',
          text: 'Image with data',
          files: [{
            id: 'F1234567890',
            name: 'diagram.jpg',
            url_private: 'https://files.slack.com/files-pri/T12345-F1234567890/diagram.jpg',
            url_private_download: 'https://files.slack.com/files-pri/T12345-F1234567890/download/diagram.jpg',
            mimetype: 'image/jpeg',
            filetype: 'jpg',
            size: 2048000
          }]
        }]
      });

      // Mock Base64 image data download
      const mockArrayBuffer = new ArrayBuffer(8);
      const mockBase64 = Buffer.from(mockArrayBuffer).toString('base64');
      
      // Mock fetch for image data download
      // @ts-expect-error - Jest mock creation for testing
      const mockFetch = jest.fn().mockResolvedValueOnce({
        ok: true,
        arrayBuffer: () => Promise.resolve(mockArrayBuffer),
      });
      // @ts-expect-error - Mock assignment for testing
      global.fetch = mockFetch;

      const args = {
        channel: 'C1234567890',
        message_ts: '1234567890.123456',
        include_image_data: true
      };

      // Act
      const result = await slackService.getMessageImages(args);

      // Assert
      expect(result).toBeDefined();
      expect(result.isError).toBe(false);
      
      const parsedData = parseJSONResponse(result);
      expect(parsedData.data.images).toHaveLength(1);
      expect(parsedData.data.images[0]).toHaveProperty('image_data', mockBase64);
    });

    test('should succeed - multiple images in single message', async () => {
      // Mock message with multiple image files
      MockWebClientInstance.conversations.history.mockResolvedValueOnce({
        ok: true,
        messages: [{
          ts: '1234567890.123456',
          user: 'U1234567890',
          text: 'Multiple screenshots',
          files: [
            {
              id: 'F1234567890',
              name: 'screenshot1.png',
              url_private: 'https://files.slack.com/files-pri/T12345-F1234567890/screenshot1.png',
              mimetype: 'image/png',
              filetype: 'png',
              size: 1024000
            },
            {
              id: 'F1234567891',
              name: 'screenshot2.jpg',
              url_private: 'https://files.slack.com/files-pri/T12345-F1234567891/screenshot2.jpg',
              mimetype: 'image/jpeg',
              filetype: 'jpg',
              size: 1536000
            }
          ]
        }]
      });

      const args = {
        channel: 'C1234567890',
        message_ts: '1234567890.123456',
        include_image_data: false
      };

      // Act
      const result = await slackService.getMessageImages(args);

      // Assert
      expect(result).toBeDefined();
      expect(result.isError).toBe(false);
      
      const parsedData = parseJSONResponse(result);
      expect(parsedData.data.images).toHaveLength(2);
      expect(parsedData.data.total_images).toBe(2);
      
      const image1 = parsedData.data.images[0];
      expect(image1).toHaveProperty('id', 'F1234567890');
      expect(image1).toHaveProperty('name', 'screenshot1.png');
      expect(image1).toHaveProperty('mimetype', 'image/png');
      
      const image2 = parsedData.data.images[1];
      expect(image2).toHaveProperty('id', 'F1234567891');
      expect(image2).toHaveProperty('name', 'screenshot2.jpg');
      expect(image2).toHaveProperty('mimetype', 'image/jpeg');
    });

    test('should succeed - mixed file types with image filtering', async () => {
      // Mock message with mixed file types (images and non-images)
      MockWebClientInstance.conversations.history.mockResolvedValueOnce({
        ok: true,
        messages: [{
          ts: '1234567890.123456',
          user: 'U1234567890',
          text: 'Mixed files - images and documents',
          files: [
            {
              id: 'F1234567890',
              name: 'image.png',
              url_private: 'https://files.slack.com/files-pri/T12345-F1234567890/image.png',
              mimetype: 'image/png',
              filetype: 'png',
              size: 1024000
            },
            {
              id: 'F1234567891',
              name: 'document.pdf',
              url_private: 'https://files.slack.com/files-pri/T12345-F1234567891/document.pdf',
              mimetype: 'application/pdf',
              filetype: 'pdf',
              size: 2048000
            },
            {
              id: 'F1234567892',
              name: 'photo.gif',
              url_private: 'https://files.slack.com/files-pri/T12345-F1234567892/photo.gif',
              mimetype: 'image/gif',
              filetype: 'gif',
              size: 512000
            }
          ]
        }]
      });

      const args = {
        channel: 'C1234567890',
        message_ts: '1234567890.123456',
        include_image_data: false
      };

      // Act
      const result = await slackService.getMessageImages(args);

      // Assert
      expect(result).toBeDefined();
      expect(result.isError).toBe(false);
      
      const parsedData = parseJSONResponse(result);
      expect(parsedData.data.images).toHaveLength(2); // Only PNG and GIF, not PDF
      expect(parsedData.data.total_images).toBe(2);
      
      // Verify only image files are included
      const imageTypes = parsedData.data.images.map((img: any) => img.mimetype);
      expect(imageTypes).toContain('image/png');
      expect(imageTypes).toContain('image/gif');
      expect(imageTypes).not.toContain('application/pdf');
      
      const imageNames = parsedData.data.images.map((img: any) => img.name);
      expect(imageNames).toContain('image.png');
      expect(imageNames).toContain('photo.gif');
      expect(imageNames).not.toContain('document.pdf');
    });
  });

  describe('🟢 GREEN PHASE: Error Handling Tests', () => {
    test('should succeed - invalid channel ID error handling', async () => {
      // Mock API error for invalid channel
      MockWebClientInstance.conversations.history.mockRejectedValueOnce(
        new Error('channel_not_found')
      );

      const args = {
        channel: 'INVALID_CHANNEL',
        message_ts: '1234567890.123456',
        include_image_data: false
      };

      // Act
      const result = await slackService.getMessageImages(args);

      // Assert
      expect(result).toBeDefined();
      expect(result.isError).toBe(true);
      
      const textContent = getTextContent(result);
      expect(textContent).toContain('Failed to get message images');
    });

    test('should succeed - invalid message timestamp error handling', async () => {
      // Mock API error for invalid timestamp format
      MockWebClientInstance.conversations.history.mockRejectedValueOnce(
        new Error('invalid_ts_latest')
      );

      const args = {
        channel: 'C1234567890',
        message_ts: 'invalid_timestamp',
        include_image_data: false
      };

      // Act
      const result = await slackService.getMessageImages(args);

      // Assert
      expect(result).toBeDefined();
      expect(result.isError).toBe(true);
      
      const textContent = getTextContent(result);
      expect(textContent).toContain('Failed to get message images');
    });

    test('should succeed - message not found error handling', async () => {
      // Mock empty response
      MockWebClientInstance.conversations.history.mockResolvedValueOnce({
        ok: true,
        messages: []
      });

      const args = {
        channel: 'C1234567890',
        message_ts: '9999999999.999999',
        include_image_data: false
      };

      // Act
      const result = await slackService.getMessageImages(args);

      // Assert
      expect(result).toBeDefined();
      expect(result.isError).toBe(true);
      
      const textContent = getTextContent(result);
      expect(textContent).toContain('Message not found');
    });
  });

  describe('🟢 GREEN PHASE: Input Validation Tests', () => {
    test('should succeed - missing required channel parameter', async () => {
      const args = {
        message_ts: '1234567890.123456',
        include_image_data: false
      };

      // Act
      const result = await slackService.getMessageImages(args);

      // Assert
      expect(result).toBeDefined();
      expect(result.isError).toBe(true);
      
      const textContent = getTextContent(result);
      expect(textContent).toContain('channel: Required');
    });

    test('should succeed - missing required message_ts parameter', async () => {
      const args = {
        channel: 'C1234567890',
        include_image_data: false
      };

      // Act
      const result = await slackService.getMessageImages(args);

      // Assert
      expect(result).toBeDefined();
      expect(result.isError).toBe(true);
      
      const textContent = getTextContent(result);
      expect(textContent).toContain('message_ts: Required');
    });

    test('should succeed - invalid include_image_data type', async () => {
      const args = {
        channel: 'C1234567890',
        message_ts: '1234567890.123456',
        include_image_data: 'invalid_boolean'
      };

      // Act
      const result = await slackService.getMessageImages(args);

      // Assert
      expect(result).toBeDefined();
      expect(result.isError).toBe(true);
      
      const textContent = getTextContent(result);
      expect(textContent).toContain('Expected boolean');
    });
  });

  describe('🟢 GREEN PHASE: Expected Response Format Tests', () => {
    test('should succeed - TypeSafeAPI ServiceResult format expectations', async () => {
      // Mock successful response
      MockWebClientInstance.conversations.history.mockResolvedValueOnce({
        ok: true,
        messages: [{
          ts: '1234567890.123456',
          user: 'U1234567890',
          text: 'Image message',
          files: [{
            id: 'F1234567890',
            name: 'test.png',
            url_private: 'https://files.slack.com/test.png',
            url_private_download: 'https://files.slack.com/download/test.png',
            mimetype: 'image/png',
            filetype: 'png',
            size: 1024000
          }]
        }]
      });

      const args = {
        channel: 'C1234567890',
        message_ts: '1234567890.123456',
        include_image_data: false
      };

      // Expected response format (TypeSafeAPI pattern)
      const expectedResponse: MCPToolResult = {
        content: [{
          type: 'text',
          text: JSON.stringify({
            statusCode: "10000",
            message: "Retrieved 1 image from message",
            data: {
              channel: 'C1234567890',
              message_ts: '1234567890.123456',
              images: [{
                id: 'F1234567890',
                name: 'test.png',
                url_private: 'https://files.slack.com/test.png',
                url_private_download: 'https://files.slack.com/download/test.png',
                mimetype: 'image/png',
                filetype: 'png',
                size: 1024000
              }],
              total_images: 1
            }
          }, null, 2)
        }],
        isError: false
      };

      // Act
      const result = await slackService.getMessageImages(args);

      // Assert
      expect(result).toBeDefined();
      expect(result).toMatchObject(expectedResponse);
    });

    test('should succeed - include_image_data response format with base64', async () => {
      // Mock successful image data download
      const mockArrayBuffer = new ArrayBuffer(8);
      // @ts-expect-error - Jest mock creation for testing
      const mockFetch = jest.fn().mockResolvedValueOnce({
        ok: true,
        arrayBuffer: () => Promise.resolve(mockArrayBuffer),
      });
      // @ts-expect-error - Mock assignment for testing
      global.fetch = mockFetch;
      
      // Mock message with image
      MockWebClientInstance.conversations.history.mockResolvedValueOnce({
        ok: true,
        messages: [{
          ts: '1234567890.123456',
          user: 'U1234567890',
          text: 'Image with data',
          files: [{
            id: 'F1234567890',
            name: 'test.png',
            url_private: 'https://files.slack.com/test.png',
            url_private_download: 'https://files.slack.com/download/test.png',
            mimetype: 'image/png',
            filetype: 'png',
            size: 1024000
          }]
        }]
      });

      const args = {
        channel: 'C1234567890',
        message_ts: '1234567890.123456',
        include_image_data: true
      };

      // Act
      const result = await slackService.getMessageImages(args);

      // Assert
      expect(result).toBeDefined();
      expect(result.isError).toBe(false);
      
      // Parse the JSON response to check for image_data
      const parsedData = parseJSONResponse(result);
      expect(parsedData.data.images[0]).toHaveProperty('image_data');
    });
  });

  describe('🟢 GREEN PHASE: Integration Tests', () => {
    test('should succeed - MCP protocol integration', async () => {
      // Mock successful response
      MockWebClientInstance.conversations.history.mockResolvedValueOnce({
        ok: true,
        messages: [{
          ts: '1234567890.123456',
          user: 'U1234567890',
          text: 'No images here'
        }]
      });

      const args = {
        channel: 'C1234567890',
        message_ts: '1234567890.123456',
        include_image_data: false
      };

      // Call through the SlackService to test MCP integration
      const service = new SlackService();
      
      // Act
      const result = await service.getMessageImages(args);

      // Assert
      expect(result).toBeDefined();
      expect(result.content).toBeDefined();
      expect(result.isError).toBe(false);
      
      const parsedData = parseJSONResponse(result);
      expect(parsedData.data).toHaveProperty('channel');
      expect(parsedData.data).toHaveProperty('message_ts');
      expect(parsedData.data).toHaveProperty('images');
      expect(parsedData.data).toHaveProperty('total_images');
    });
  });
});

/**
 * GREEN PHASE TEST SUMMARY
 * =========================
 * 
 * 🟢 ALL TESTS SHOULD NOW PASS
 * 
 * Implemented Components:
 * ✅ MCP Tool Definition (GET_MESSAGE_IMAGES_TOOL in tools.ts)
 * ✅ Zod Validation Schema (GetMessageImagesSchema in validation.ts)
 * ✅ Service Method Implementation (getMessageImages in SlackService)
 * ✅ Message Service Domain Logic (in messages/ domain service)
 * ✅ MCP Route Handler (case 'get_message_images' in index.ts switch)
 * ✅ Type Definitions (MessageImagesOutput type)
 * ✅ Image Filtering Logic (PNG, JPG, GIF, etc.)
 * ✅ Base64 Image Data Retrieval (when include_image_data: true)
 * 
 * Test Coverage Areas:
 * ✅ Basic functionality verification
 * ✅ Error handling scenarios  
 * ✅ Input validation requirements
 * ✅ Response format specifications
 * ✅ TypeSafeAPI pattern compliance
 * ✅ Multiple image handling
 * ✅ Image type filtering
 * ✅ MCP protocol integration
 * 
 * Status: 🟢 GREEN PHASE COMPLETE - All functionality implemented and tested
 */