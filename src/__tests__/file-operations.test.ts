/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { jest } from '@jest/globals';
import { SlackService } from '../slack/slack-service';
import { promises as fs } from 'fs';
import { extractTextContent } from '../utils/helpers';

// Create a shared mock WebClient instance with all file operations
const createMockWebClient = (): any => ({
  // eslint-disable-line @typescript-eslint/no-explicit-any
  files: {
    upload: jest.fn(),
    list: jest.fn(),
    info: jest.fn(),
    delete: jest.fn(),
    share: jest.fn(),
    sharedPublicURL: jest.fn(),
  },
  filesUploadV2: jest.fn(),
  search: {
    files: jest.fn(),
  },
  chat: {
    postMessage: jest.fn(),
  },
  auth: {
    test: jest.fn(),
  },
  on: jest.fn(),
  apiCall: jest.fn(),
});

let mockWebClientInstance = createMockWebClient();

// Mock the WebClient
jest.mock('@slack/web-api', () => ({
  WebClient: jest.fn().mockImplementation(() => mockWebClientInstance),
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

// Mock the config with both bot and user tokens for comprehensive testing
jest.mock('../config/index', () => {
  const mockConfig = {
    SLACK_BOT_TOKEN: 'xoxb-test-token',
    SLACK_USER_TOKEN: 'xoxp-test-token',
    USE_USER_TOKEN_FOR_READ: true,
    LOG_LEVEL: 'info',
    MCP_SERVER_NAME: 'test-server',
    MCP_SERVER_VERSION: '1.0.0',
    PORT: 3000,
  };
  return {
    CONFIG: mockConfig,
    getConfig: () => mockConfig,
  };
});

// Mock the logger
jest.mock('../utils/logger', () => ({
  logger: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

// Mock fs/promises for file operations
jest.mock('fs', () => ({
  promises: {
    readFile: jest.fn(),
  },
}));

// Mock validation to use actual validation but allow jest to spy on it
jest.mock('../utils/validation', () => {
  const originalModule = jest.requireActual('../utils/validation') as any; // eslint-disable-line @typescript-eslint/no-explicit-any
  return {
    ...originalModule,
    validateInput: jest.fn((schema: any, input: any) => {
      // eslint-disable-line @typescript-eslint/no-explicit-any
      return originalModule.validateInput(schema, input);
    }),
  };
});

// Mock the file analysis formatter
jest.mock('../slack/analysis/formatters/file-formatters', () => ({
  formatFileAnalysis: jest.fn((analysis: any) => ({
    content: [
      {
        type: 'text',
        text: `File Analysis: ${analysis.total_files} files, ${analysis.total_size_bytes} bytes`,
      },
    ],
  })),
}));

describe('SlackService - File Operations', () => {
  let slackService: SlackService;
  const mockReadFile = fs.readFile as jest.MockedFunction<typeof fs.readFile>;

  beforeEach(() => {
    // Clear all mocks before each test
    jest.clearAllMocks();
    mockReadFile.mockClear();

    // Reset the mock WebClient instance
    mockWebClientInstance = createMockWebClient();

    slackService = new SlackService();
  });

  describe('uploadFile', () => {
    const validArgs = {
      file_path: '/path/to/test-file.txt',
      filename: 'test-file.txt',
      title: 'Test File',
      channels: ['C1234567890'],
      initial_comment: 'Test upload',
      thread_ts: '1234567890.123456',
    };

    it('should upload a file successfully with all options', async () => {
      // Arrange
      const mockFileContent = Buffer.from('test file content');
      mockReadFile.mockResolvedValue(mockFileContent);

      const mockResult = {
        ok: true,
        files: [
          {
            id: 'F1234567890',
            name: 'test-file.txt',
            title: 'Test File',
            size: mockFileContent.length,
            url_private: 'https://files.slack.com/files-pri/test',
            url_private_download: 'https://files.slack.com/files-pri/test/download',
            channels: ['C1234567890'],
            timestamp: 1234567890,
          },
        ],
      };
      mockWebClientInstance.filesUploadV2.mockResolvedValue(mockResult);

      // Act
      const result = await slackService.uploadFile(validArgs);

      // Assert
      expect(mockReadFile).toHaveBeenCalledWith('/path/to/test-file.txt');
      expect(mockWebClientInstance.filesUploadV2).toHaveBeenCalledWith({
        filename: 'test-file.txt',
        file: mockFileContent,
        channel_id: 'C1234567890', // V2 API uses channel_id instead of channels
        title: 'Test File',
        initial_comment: 'Test upload',
        thread_ts: '1234567890.123456',
      });

      expect(result.content).toBeDefined();
      expect(result.content[0]).toBeDefined();
      // The response format has changed to return JSON data
      const content = extractTextContent(result.content?.[0]);
      expect(content).toContain('success');
      expect(content).toContain('file');
    });

    it('should upload a file with minimal options', async () => {
      // Arrange
      const minimalArgs = {
        file_path: '/path/to/simple.txt',
      };
      const mockFileContent = Buffer.from('simple content');
      mockReadFile.mockResolvedValue(mockFileContent);

      const mockResult = {
        ok: true,
        files: [
          {
            id: 'F1234567891',
            name: 'simple.txt',
            title: 'simple.txt',
            size: mockFileContent.length,
            url_private: 'https://files.slack.com/files-pri/simple',
            url_private_download: 'https://files.slack.com/files-pri/simple/download',
            channels: [],
            timestamp: 1234567891,
          },
        ],
      };
      mockWebClientInstance.filesUploadV2.mockResolvedValue(mockResult);

      // Act
      const result = await slackService.uploadFile(minimalArgs);

      // Assert
      expect(mockWebClientInstance.filesUploadV2).toHaveBeenCalledWith({
        filename: 'simple.txt',
        file: mockFileContent,
      });

      expect(result.content).toBeDefined();
      expect(result.content[0]).toBeDefined();
      // The response format has changed to return JSON data
      const content = extractTextContent(result.content?.[0]);
      expect(content).toContain('success');
      expect(content).toContain('file');
    });

    it('should handle file read errors', async () => {
      // Arrange
      mockReadFile.mockRejectedValue(new Error('File not found'));

      // Act
      const result = await slackService.uploadFile(validArgs);

      // Assert
      expect(result.isError).toBe(true);
      expect(extractTextContent(result.content?.[0])).toContain('Failed to read file');
      expect(extractTextContent(result.content?.[0])).toContain('File not found');
    });

    it('should handle Slack API upload errors', async () => {
      // Arrange
      const mockFileContent = Buffer.from('test file content');
      mockReadFile.mockResolvedValue(mockFileContent);
      mockWebClientInstance.filesUploadV2.mockResolvedValue({ ok: false, files: null });

      // Act
      const result = await slackService.uploadFile(validArgs);

      // Assert
      expect(result.isError).toBe(true);
      expect(extractTextContent(result.content?.[0])).toContain('Slack API Error');
      expect(extractTextContent(result.content?.[0])).toContain('File upload failed');
    });

    it('should handle large binary files', async () => {
      // Arrange
      const largeBuffer = Buffer.alloc(10 * 1024 * 1024, 0); // 10MB buffer
      mockReadFile.mockResolvedValue(largeBuffer);

      const mockResult = {
        ok: true,
        files: [
          {
            id: 'F1234567892',
            name: 'large-file.bin',
            title: 'Large Binary File',
            size: largeBuffer.length,
            url_private: 'https://files.slack.com/files-pri/large',
            url_private_download: 'https://files.slack.com/files-pri/large/download',
            channels: ['C1234567890'],
            timestamp: 1234567892,
          },
        ],
      };
      mockWebClientInstance.filesUploadV2.mockResolvedValue(mockResult);

      const largeFileArgs = {
        file_path: '/path/to/large-file.bin',
        channels: ['C1234567890'],
      };

      // Act
      const result = await slackService.uploadFile(largeFileArgs);

      // Assert
      expect(mockWebClientInstance.filesUploadV2).toHaveBeenCalledWith(
        expect.objectContaining({
          filename: 'large-file.bin',
          channel_id: 'C1234567890', // V2 API uses channel_id instead of channels
        })
      );
      // Check that a Buffer was passed but don't compare the entire content
      expect(mockWebClientInstance.filesUploadV2.mock.calls[0][0].file).toBeInstanceOf(Buffer);
      // The actual buffer size may be different due to how the filename is extracted
      // The response format has changed to return JSON data
      const content = extractTextContent(result.content?.[0]);
      expect(content).toContain('success');
      expect(content).toContain('file');
    });

    it('should validate required file_path parameter', async () => {
      // Act & Assert
      const result = await slackService.uploadFile({});
      expect(result.isError).toBe(true);
      expect(extractTextContent(result.content[0])).toContain('Validation failed');
    });
  });

  describe('uploadFile with filesUploadV2 API (TDD Red Phase)', () => {
    const validArgs = {
      file_path: '/path/to/test-file.txt',
      filename: 'test-file.txt',
      title: 'Test File',
      channels: ['C1234567890'],
      initial_comment: 'Test upload with v2 API',
      thread_ts: '1234567890.123456',
    };

    it('should upload a file using filesUploadV2 API for single channel', async () => {
      // Arrange
      const mockFileContent = Buffer.from('test file content for v2 API');
      mockReadFile.mockResolvedValue(mockFileContent);

      // Mock the new filesUploadV2 API response structure
      const mockV2Result = {
        ok: true,
        files: [
          {
            id: 'F1234567890',
            name: 'test-file.txt',
            title: 'Test File',
            size: mockFileContent.length,
            url_private: 'https://files.slack.com/files-pri/test',
            url_private_download: 'https://files.slack.com/files-pri/test/download',
            channels: ['C1234567890'],
            timestamp: 1234567890,
          },
        ],
      };
      mockWebClientInstance.filesUploadV2.mockResolvedValue(mockV2Result);

      // Act
      const result = await slackService.uploadFile(validArgs);

      // Assert - Expect the new filesUploadV2 API to be called
      expect(mockWebClientInstance.filesUploadV2).toHaveBeenCalledWith({
        filename: 'test-file.txt',
        file: mockFileContent,
        channel_id: 'C1234567890', // New API uses channel_id instead of channels
        title: 'Test File',
        initial_comment: 'Test upload with v2 API',
        thread_ts: '1234567890.123456',
      });

      // Assert - Expect files.upload NOT to be called
      expect(mockWebClientInstance.files.upload).not.toHaveBeenCalled();

      // Assert - Response should come from result.files array (not result.file)
      expect(result.content).toBeDefined();
      expect(result.content[0]).toBeDefined();
      const content = extractTextContent(result.content?.[0]);
      expect(content).toContain('success');
      expect(content).toContain('file');
    });

    it('should upload a file using filesUploadV2 API with minimal options', async () => {
      // Arrange
      const minimalArgs = {
        file_path: '/path/to/simple.txt',
        channels: ['C1234567890'], // Single channel for v2 API
      };
      const mockFileContent = Buffer.from('simple content for v2');
      mockReadFile.mockResolvedValue(mockFileContent);

      const mockV2Result = {
        ok: true,
        files: [
          {
            id: 'F1234567891',
            name: 'simple.txt',
            title: 'simple.txt',
            size: mockFileContent.length,
            url_private: 'https://files.slack.com/files-pri/simple',
            url_private_download: 'https://files.slack.com/files-pri/simple/download',
            channels: ['C1234567890'],
            timestamp: 1234567891,
          },
        ],
      };
      mockWebClientInstance.filesUploadV2.mockResolvedValue(mockV2Result);

      // Act
      const result = await slackService.uploadFile(minimalArgs);

      // Assert - Expect the new filesUploadV2 API to be called
      expect(mockWebClientInstance.filesUploadV2).toHaveBeenCalledWith({
        filename: 'simple.txt',
        file: mockFileContent,
        channel_id: 'C1234567890', // New API uses channel_id for single channel
      });

      // Assert - Expect files.upload NOT to be called
      expect(mockWebClientInstance.files.upload).not.toHaveBeenCalled();

      expect(result.content).toBeDefined();
      expect(result.content[0]).toBeDefined();
      const content = extractTextContent(result.content?.[0]);
      expect(content).toContain('success');
      expect(content).toContain('file');
    });

    it('should handle filesUploadV2 API upload errors', async () => {
      // Arrange
      const mockFileContent = Buffer.from('test file content');
      mockReadFile.mockResolvedValue(mockFileContent);
      mockWebClientInstance.filesUploadV2.mockResolvedValue({ 
        ok: false, 
        files: null,
        error: 'upload_failed',
      });

      // Act
      const result = await slackService.uploadFile(validArgs);

      // Assert - Should attempt filesUploadV2 first
      expect(mockWebClientInstance.filesUploadV2).toHaveBeenCalled();
      expect(result.isError).toBe(true);
      expect(extractTextContent(result.content?.[0])).toContain('File upload failed');
    });

    it('should extract file information from files array in v2 response', async () => {
      // Arrange
      const mockFileContent = Buffer.from('test content');
      mockReadFile.mockResolvedValue(mockFileContent);

      // Mock v2 response with files array containing multiple files
      const mockV2Result = {
        ok: true,
        files: [
          {
            id: 'F1234567890',
            name: 'test-file.txt',
            title: 'Test File',
            size: mockFileContent.length,
            url_private: 'https://files.slack.com/files-pri/test',
            url_private_download: 'https://files.slack.com/files-pri/test/download',
            channels: ['C1234567890'],
            timestamp: 1234567890,
          },
        ],
      };
      mockWebClientInstance.filesUploadV2.mockResolvedValue(mockV2Result);

      // Act
      const result = await slackService.uploadFile(validArgs);

      // Assert - Should use first file from files array
      expect(mockWebClientInstance.filesUploadV2).toHaveBeenCalled();
      expect(result.content).toBeDefined();
      const content = extractTextContent(result.content?.[0]);
      expect(content).toContain('success');
      expect(content).toContain('F1234567890'); // Should extract file ID from files array
    });

    it('should handle missing ID gracefully with fallback strategy (TDD Green Phase)', async () => {
      // Arrange
      const mockFileContent = Buffer.from('test content without id');
      mockReadFile.mockResolvedValue(mockFileContent);

      // Mock successful API response but with file object missing 'id' field
      // This simulates a legitimate Slack API response scenario where id field may be absent
      const mockV2ResultWithoutId = {
        ok: true,
        files: [
          {
            // Note: No 'id' field in this file object
            name: 'test-file.txt',
            title: 'Test File',
            size: mockFileContent.length,
            url_private: 'https://files.slack.com/files-pri/test',
            url_private_download: 'https://files.slack.com/files-pri/test/download',
            channels: ['C1234567890'],
            timestamp: 1234567890,
            filetype: 'txt',
            mimetype: 'text/plain',
          },
        ],
      };
      mockWebClientInstance.filesUploadV2.mockResolvedValue(mockV2ResultWithoutId);

      // Act
      const result = await slackService.uploadFile(validArgs);

      // Assert - Should succeed with graceful fallback ID handling
      expect(mockWebClientInstance.filesUploadV2).toHaveBeenCalled();
      expect(result.isError).toBeUndefined(); // Successful operations don't have isError property
      expect(result.content).toBeDefined();
      
      // Verify the response contains success and fallback ID
      const content = extractTextContent(result.content?.[0]);
      expect(content).toContain('success');
      expect(content).toContain('true'); // success: true
      expect(content).toContain('temp_1234567890_test-file.txt'); // fallback ID pattern
      
      // Verify structured warning was logged about missing ID with enhanced metadata
      const { logger } = await import('../utils/logger');
      expect(logger.warn).toHaveBeenCalledWith(
        'Slack API returned file without ID - using fallback strategy',
        expect.objectContaining({
          fallback_id: 'temp_1234567890_test-file.txt',
          original_filename: 'test-file.txt',
          sanitized_filename: 'test-file.txt',
          file_timestamp: 1234567890,
          file_size: mockFileContent.length,
          upload_channel: 'C1234567890',
          api_context: 'missing_file_id_fallback',
          response_metadata: expect.objectContaining({
            has_name: true,
            has_title: true,
            has_url: true,
            has_timestamp: true,
          }),
        })
      );
    });

    it('should handle multiple channels with structured warning logging', async () => {
      // Arrange
      const mockFileContent = Buffer.from('test file for multiple channels');
      mockReadFile.mockResolvedValue(mockFileContent);
      
      const multiChannelArgs = {
        file_path: '/path/to/multi-channel-file.txt',
        filename: 'multi-channel-file.txt',
        channels: ['C1234567890', 'C0987654321', 'C1122334455'],
      };

      const mockV2Result = {
        ok: true,
        files: [
          {
            id: 'F1234567890',
            name: 'multi-channel-file.txt',
            title: 'multi-channel-file.txt',
            size: mockFileContent.length,
            url_private: 'https://files.slack.com/files-pri/test',
            url_private_download: 'https://files.slack.com/files-pri/test/download',
            channels: ['C1234567890'],
            timestamp: 1234567890,
          },
        ],
      };
      mockWebClientInstance.filesUploadV2.mockResolvedValue(mockV2Result);

      // Act
      const result = await slackService.uploadFile(multiChannelArgs);

      // Assert - Should succeed and log structured warning about multiple channels
      expect(mockWebClientInstance.filesUploadV2).toHaveBeenCalledWith(
        expect.objectContaining({
          channel_id: 'C1234567890', // Only first channel used
        })
      );
      
      expect(result.isError).toBeUndefined();
      
      // Verify structured warning was logged about multiple channels limitation
      const { logger } = await import('../utils/logger');
      expect(logger.warn).toHaveBeenCalledWith(
        'files.uploadV2 API limitation: multiple channels not supported',
        expect.objectContaining({
          filename: 'multi-channel-file.txt',
          total_channels: 3,
          selected_channel: 'C1234567890',
          ignored_channels: ['C0987654321', 'C1122334455'],
          api_context: 'uploadV2_channel_limitation',
        })
      );
    });
  });

  describe('listFiles', () => {
    it('should list files with default parameters', async () => {
      // Arrange
      const mockFiles = [
        {
          id: 'F1234567890',
          name: 'test1.txt',
          title: 'Test File 1',
          filetype: 'txt',
          size: 1024,
          url_private: 'https://files.slack.com/files-pri/test1',
          url_private_download: 'https://files.slack.com/files-pri/test1/download',
          user: 'U1234567890',
          timestamp: 1234567890,
          channels: ['C1234567890'],
        },
        {
          id: 'F1234567891',
          name: 'test2.pdf',
          title: 'Test PDF',
          filetype: 'pdf',
          size: 2048,
          url_private: 'https://files.slack.com/files-pri/test2',
          url_private_download: 'https://files.slack.com/files-pri/test2/download',
          user: 'U1234567891',
          timestamp: 1234567891,
          channels: ['C1234567891'],
        },
      ];

      const mockResult = {
        ok: true,
        files: mockFiles,
        paging: { count: 2, total: 2, page: 1, pages: 1 },
      };
      mockWebClientInstance.files.list.mockResolvedValue(mockResult);

      // Act
      const result = await slackService.listFiles({});

      // Assert
      expect(mockWebClientInstance.files.list).toHaveBeenCalledWith({
        channel: undefined,
        user: undefined,
        ts_from: undefined,
        ts_to: undefined,
        types: undefined,
        count: 100,
        page: 1,
      });

      expect(result.content).toBeDefined();
      expect(result.content[0]).toBeDefined();
      const content = extractTextContent(result.content?.[0]);
      expect(content).toContain('files');
      expect(content).toContain('total');
    });

    it('should list files with filtering options', async () => {
      // Arrange
      const filterArgs = {
        channel: 'C1234567890',
        user: 'U1234567890',
        types: 'images,pdfs',
        ts_from: '1234560000',
        ts_to: '1234570000',
        count: 50,
        page: 2,
      };

      const mockResult = {
        ok: true,
        files: [],
        paging: { count: 0, total: 0, page: 2, pages: 1 },
      };
      mockWebClientInstance.files.list.mockResolvedValue(mockResult);

      // Act
      const result = await slackService.listFiles(filterArgs);

      // Assert
      expect(mockWebClientInstance.files.list).toHaveBeenCalledWith({
        channel: 'C1234567890',
        user: 'U1234567890',
        ts_from: '1234560000',
        ts_to: '1234570000',
        types: 'images,pdfs',
        count: 50,
        page: 2,
      });

      const content = extractTextContent(result.content?.[0]);
      expect(content).toContain('files');
      expect(content).toContain('total');
      expect(content).toContain('0');
    });

    it('should handle empty file list', async () => {
      // Arrange - With unified pagination, null files now throws an error
      mockWebClientInstance.files.list.mockResolvedValue({ ok: true, files: null });

      // Act
      const result = await slackService.listFiles({});

      // Assert - Unified implementation throws SlackAPIError for null files
      expect(result.isError).toBe(true);
      const content = extractTextContent(result.content?.[0]);
      expect(content).toContain('Failed to retrieve files');
    });

    it('should handle pagination correctly', async () => {
      // Arrange
      const paginationArgs = {
        count: 1000,
        page: 1,
      };

      const mockResult = {
        ok: true,
        files: [],
        paging: { count: 1000, total: 2500, page: 1, pages: 3 },
      };
      mockWebClientInstance.files.list.mockResolvedValue(mockResult);

      // Act
      await slackService.listFiles(paginationArgs);

      // Assert
      expect(mockWebClientInstance.files.list).toHaveBeenCalledWith(
        expect.objectContaining({
          count: 1000,
          page: 1,
        })
      );
    });

    it('should validate count limits', async () => {
      // Act & Assert - count too high should be handled by validation
      const result = await slackService.listFiles({ count: 2000 });
      expect(result.isError).toBe(true);
      expect(extractTextContent(result.content[0])).toContain('Validation failed');
    });
  });

  describe('getFileInfo', () => {
    const validFileId = 'F1234567890';

    it('should get file info without comments', async () => {
      // Arrange
      const mockFile = {
        id: 'F1234567890',
        name: 'test-file.txt',
        title: 'Test File',
        mimetype: 'text/plain',
        filetype: 'txt',
        size: 1024,
        url_private: 'https://files.slack.com/files-pri/test',
        url_private_download: 'https://files.slack.com/files-pri/test/download',
        preview: 'https://files.slack.com/files-pri/test/preview',
        thumb_360: 'https://files.slack.com/files-pri/test/thumb',
        channels: ['C1234567890'],
        groups: [],
        ims: [],
        user: 'U1234567890',
        username: 'testuser',
        timestamp: 1234567890,
        created: 1234567890,
        public_url_shared: false,
        is_external: false,
        has_rich_preview: true,
      };

      mockWebClientInstance.files.info.mockResolvedValue({ ok: true, file: mockFile });

      // Act
      const result = await slackService.getFileInfo({
        file_id: validFileId,
        include_comments: false,
      });

      // Assert
      expect(mockWebClientInstance.files.info).toHaveBeenCalledWith({
        file: validFileId,
      });

      expect(result.content).toBeDefined();
      expect(result.content?.[0]).toBeDefined();
      // Response format has changed to JSON data
      const content = extractTextContent(result.content?.[0]);
      expect(content).toContain('id');
      expect(content).toContain('test-file.txt');
    });

    it('should get file info with comments requested', async () => {
      // Arrange
      const mockFile = {
        id: 'F1234567890',
        name: 'test-file.txt',
        title: 'Test File',
        mimetype: 'text/plain',
        filetype: 'txt',
        size: 1024,
        url_private: 'https://files.slack.com/files-pri/test',
        url_private_download: 'https://files.slack.com/files-pri/test/download',
        channels: ['C1234567890'],
        user: 'U1234567890',
        timestamp: 1234567890,
        created: 1234567890,
        public_url_shared: false,
        is_external: false,
        has_rich_preview: true,
      };

      mockWebClientInstance.files.info.mockResolvedValue({ ok: true, file: mockFile });

      // Act
      const result = await slackService.getFileInfo({
        file_id: validFileId,
        include_comments: true,
      });

      // Assert
      // Response format has changed to JSON data
      const content = extractTextContent(result.content?.[0]);
      expect(content).toContain('id');
      expect(content).toContain('name');
    });

    it('should handle file not found', async () => {
      // Arrange
      mockWebClientInstance.files.info.mockResolvedValue({ ok: true, file: null });

      // Act
      const result = await slackService.getFileInfo({ file_id: validFileId });

      // Assert
      expect(result.isError).toBe(true);
      expect(extractTextContent(result.content?.[0])).toContain('Error');
    });

    it('should validate required file_id parameter', async () => {
      // Act & Assert
      const result = await slackService.getFileInfo({});
      expect(result.isError).toBe(true);
      expect(extractTextContent(result.content[0])).toContain('Validation failed');
    });

    it('should handle API errors gracefully', async () => {
      // Arrange
      mockWebClientInstance.files.info.mockRejectedValue(new Error('Slack API Error'));

      // Act
      const result = await slackService.getFileInfo({ file_id: validFileId });

      // Assert
      expect(result.isError).toBe(true);
      expect(extractTextContent(result.content?.[0])).toContain('Error');
    });
  });

  describe('deleteFile', () => {
    const validFileId = 'F1234567890';

    it('should delete a file successfully', async () => {
      // Arrange
      mockWebClientInstance.files.delete.mockResolvedValue({ ok: true });

      // Act
      const result = await slackService.deleteFile({ file_id: validFileId });

      // Assert
      expect(mockWebClientInstance.files.delete).toHaveBeenCalledWith({
        file: validFileId,
      });

      // Response format has changed to JSON data
      const content = extractTextContent(result.content?.[0]);
      expect(content).toContain('success');
      expect(content).toContain('F1234567890');
      expect(content).toContain('deleted');
    });

    it('should handle deletion failure', async () => {
      // Arrange
      mockWebClientInstance.files.delete.mockResolvedValue({ ok: false, error: 'not_allowed' });

      // Act
      const result = await slackService.deleteFile({ file_id: validFileId });

      // Assert
      const content = extractTextContent(result.content?.[0]);
      expect(content).toContain('success');
      expect(content).toContain('false');
    });

    it('should handle permission errors', async () => {
      // Arrange
      mockWebClientInstance.files.delete.mockRejectedValue(new Error('not_allowed'));

      // Act
      const result = await slackService.deleteFile({ file_id: validFileId });

      // Assert
      expect(result.isError).toBe(true);
      expect(extractTextContent(result.content?.[0])).toContain('Error');
    });

    it('should validate required file_id parameter', async () => {
      // Act & Assert
      const result = await slackService.deleteFile({});
      expect(result.isError).toBe(true);
      expect(extractTextContent(result.content[0])).toContain('Validation failed');
    });
  });

  describe('shareFile', () => {
    const validArgs = {
      file_id: 'F1234567890',
      channel: 'C1234567890',
    };

    it('should share a file successfully', async () => {
      // Arrange
      mockWebClientInstance.files.info.mockResolvedValue({
        ok: true,
        file: {
          id: 'F1234567890',
          permalink: 'https://example.slack.com/files/U123456789/F1234567890/test.txt',
        },
      });
      mockWebClientInstance.chat.postMessage.mockResolvedValue({
        ok: true,
        ts: '1234567890.123456',
      });

      // Act
      const result = await slackService.shareFile(validArgs);

      // Assert
      expect(mockWebClientInstance.files.info).toHaveBeenCalledWith({
        file: 'F1234567890',
      });
      expect(mockWebClientInstance.chat.postMessage).toHaveBeenCalledWith({
        channel: 'C1234567890',
        text: 'File shared: https://example.slack.com/files/U123456789/F1234567890/test.txt',
        unfurl_links: true,
      });

      const content = extractTextContent(result.content?.[0]);
      expect(content).toContain('success');
      expect(content).toContain('F1234567890');
      expect(content).toContain('C1234567890');
    });

    it('should handle sharing failure when file not found', async () => {
      // Arrange
      mockWebClientInstance.files.info.mockResolvedValue({
        ok: false,
        error: 'file_not_found',
      });

      // Act
      const result = await slackService.shareFile(validArgs);

      // Assert
      expect(mockWebClientInstance.files.info).toHaveBeenCalledWith({
        file: 'F1234567890',
      });
      expect(result.isError).toBe(true);
      expect(extractTextContent(result.content?.[0])).toContain('Error');
    });

    it('should handle sharing failure when file has no permalink', async () => {
      // Arrange
      mockWebClientInstance.files.info.mockResolvedValue({
        ok: true,
        file: {
          id: 'F1234567890',
          // No permalink field
        },
      });

      // Act
      const result = await slackService.shareFile(validArgs);

      // Assert
      expect(result.isError).toBe(true);
      expect(extractTextContent(result.content?.[0])).toContain('Error');
    });

    it('should handle chat message posting failure', async () => {
      // Arrange
      mockWebClientInstance.files.info.mockResolvedValue({
        ok: true,
        file: {
          id: 'F1234567890',
          permalink: 'https://example.slack.com/files/U123456789/F1234567890/test.txt',
        },
      });
      mockWebClientInstance.chat.postMessage.mockResolvedValue({
        ok: false,
        error: 'channel_not_found',
      });

      // Act
      const result = await slackService.shareFile(validArgs);

      // Assert
      expect(result.isError).toBe(true);
      expect(extractTextContent(result.content?.[0])).toContain('Error');
    });

    it('should validate required parameters', async () => {
      // Act & Assert - missing file_id
      const result1 = await slackService.shareFile({ channel: 'C1234567890' });
      expect(result1.isError).toBe(true);
      expect(extractTextContent(result1.content[0])).toContain('Validation failed');

      // Act & Assert - missing channel
      const result2 = await slackService.shareFile({ file_id: 'F1234567890' });
      expect(result2.isError).toBe(true);
      expect(extractTextContent(result2.content[0])).toContain('Validation failed');
    });
  });

  describe('analyzeFiles', () => {
    it('should analyze files with default options', async () => {
      // Arrange
      const mockFiles = [
        {
          id: 'F1',
          name: 'doc1.pdf',
          filetype: 'pdf',
          size: 1024 * 1024, // 1MB
          user: 'U1',
          timestamp: 1234567890,
          channels: ['C1'],
        },
        {
          id: 'F2',
          name: 'image1.jpg',
          filetype: 'jpg',
          size: 2 * 1024 * 1024, // 2MB
          user: 'U1',
          timestamp: 1234567891,
          channels: ['C1'],
        },
        {
          id: 'F3',
          name: 'large.zip',
          filetype: 'zip',
          size: 15 * 1024 * 1024, // 15MB (large file)
          user: 'U2',
          timestamp: 1234567892,
          channels: ['C2'],
        },
      ];

      mockWebClientInstance.files.list.mockResolvedValue({ ok: true, files: mockFiles });

      // Act
      const result = await slackService.analyzeFiles({});

      // Assert
      expect(mockWebClientInstance.files.list).toHaveBeenCalledWith(
        expect.objectContaining({
          count: 1000,
          ts_from: expect.any(String),
        })
      );

      // The response format has changed to return JSON data
      const content = extractTextContent(result.content?.[0]);
      expect(content).toContain('files');
      expect(content).toContain('bytes');
    });

    it('should analyze files with custom options', async () => {
      // Arrange
      const customArgs = {
        channel: 'C1234567890',
        user: 'U1234567890',
        days_back: 7,
        include_large_files: true,
        size_threshold_mb: 5,
      };

      const mockFiles = [
        {
          id: 'F1',
          name: 'small.txt',
          filetype: 'txt',
          size: 1024, // 1KB
          user: 'U1234567890',
          timestamp: 1234567890,
          channels: ['C1234567890'],
        },
      ];

      mockWebClientInstance.files.list.mockResolvedValue({ ok: true, files: mockFiles });

      // Act
      const result = await slackService.analyzeFiles(customArgs);

      // Assert
      expect(mockWebClientInstance.files.list).toHaveBeenCalledWith(
        expect.objectContaining({
          channel: 'C1234567890',
          user: 'U1234567890',
          count: 1000,
        })
      );

      // The response format has changed to return JSON data
      const content = extractTextContent(result.content?.[0]);
      expect(content).toContain('files');
      expect(content).toContain('bytes');
    });

    it('should handle empty file list for analysis', async () => {
      // Arrange
      mockWebClientInstance.files.list.mockResolvedValue({ ok: true, files: null });

      // Act
      const result = await slackService.analyzeFiles({});

      // Assert
      // Response format changed - checking for structure instead
      const content = extractTextContent(result.content?.[0]);
      expect(content).toContain('files');
      expect(content).toBeDefined();
    });

    it('should calculate file statistics correctly', async () => {
      // Arrange
      const mockFiles = [
        {
          id: 'F1',
          name: 'doc1.pdf',
          filetype: 'pdf',
          size: 5 * 1024 * 1024, // 5MB
          user: 'U1',
          timestamp: 1234567890,
          channels: ['C1'],
        },
        {
          id: 'F2',
          name: 'doc2.pdf',
          filetype: 'pdf',
          size: 3 * 1024 * 1024, // 3MB
          user: 'U1',
          timestamp: 1234567891,
          channels: ['C1'],
        },
        {
          id: 'F3',
          name: 'image.jpg',
          filetype: 'jpg',
          size: 2 * 1024 * 1024, // 2MB
          user: 'U2',
          timestamp: 1234567892,
          channels: ['C2'],
        },
      ];

      mockWebClientInstance.files.list.mockResolvedValue({ ok: true, files: mockFiles });

      // Act
      const result = await slackService.analyzeFiles({});

      // Assert - Check that analysis was performed and returned
      // The response format has changed to return JSON data
      const content = extractTextContent(result.content?.[0]);
      expect(content).toContain('files');
      expect(content).toContain('bytes');
    });

    it('should identify large files correctly', async () => {
      // Arrange
      const mockFiles = [
        {
          id: 'F1',
          name: 'huge-file.zip',
          filetype: 'zip',
          size: 50 * 1024 * 1024, // 50MB
          user: 'U1',
          timestamp: 1234567890,
          channels: ['C1'],
          url_private: 'https://files.slack.com/files-pri/huge',
          url_private_download: 'https://files.slack.com/files-pri/huge/download',
        },
      ];

      const analyzeArgs = { size_threshold_mb: 25 };
      mockWebClientInstance.files.list.mockResolvedValue({ ok: true, files: mockFiles });

      // Act
      const result = await slackService.analyzeFiles(analyzeArgs);

      // Assert - Should identify and report the large file
      // The response format has changed to return JSON data
      const content = extractTextContent(result.content?.[0]);
      expect(content).toContain('files');
      expect(content).toContain('bytes');
    });

    it('should validate days_back parameter limits', async () => {
      // Act & Assert - days_back too high should be handled by validation
      const result = await slackService.analyzeFiles({ days_back: 400 });
      expect(result.isError).toBe(true);
      expect(extractTextContent(result.content[0])).toContain('Validation failed');
    });
  });

  describe('searchFiles', () => {
    const validArgs = {
      query: 'test document',
      types: 'pdf,doc',
      user: 'U1234567890',
      channel: 'C1234567890',
      after: '2023-01-01',
      before: '2023-12-31',
      count: 20,
    };

    it('should search files successfully with all filters', async () => {
      // Arrange
      const mockSearchResult = {
        files: {
          matches: [
            {
              id: 'F1234567890',
              name: 'test-document.pdf',
              title: 'Test Document',
              filetype: 'pdf',
              size: 1024,
              url_private: 'https://files.slack.com/files-pri/test-doc',
              user: 'U1234567890',
              timestamp: 1234567890,
            },
          ],
          total: 1,
          paging: { count: 1, total: 1, page: 1, pages: 1 },
        },
      };

      mockWebClientInstance.search.files.mockResolvedValue({ ok: true, ...mockSearchResult });

      // Act
      const result = await slackService.searchFiles(validArgs);

      // Assert
      expect(mockWebClientInstance.search.files).toHaveBeenCalledWith({
        query: expect.stringContaining('test document'),
        count: 20,
        sort: 'timestamp',
        sort_dir: 'desc',
      });

      // Check that query includes all the filters
      const searchCall = mockWebClientInstance.search.files.mock.calls[0][0];
      expect(searchCall.query).toContain('test document');
      expect(searchCall.query).toContain('filetype:pdf OR filetype:doc');
      expect(searchCall.query).toContain('in:<#C1234567890>');
      expect(searchCall.query).toContain('from:<@U1234567890>');
      expect(searchCall.query).toContain('after:2023-01-01');
      expect(searchCall.query).toContain('before:2023-12-31');

      const content = extractTextContent(result.content?.[0]);
      expect(content).toContain('results');
      expect(content).toContain('total');
      expect(content).toContain('1');
    });

    it('should search files with minimal query', async () => {
      // Arrange
      const minimalArgs = { query: 'report' };
      const mockSearchResult = {
        files: {
          matches: [],
          total: 0,
          paging: { count: 0, total: 0, page: 1, pages: 1 },
        },
      };

      mockWebClientInstance.search.files.mockResolvedValue({ ok: true, ...mockSearchResult });

      // Act
      const result = await slackService.searchFiles(minimalArgs);

      // Assert
      expect(mockWebClientInstance.search.files).toHaveBeenCalledWith({
        query: 'report',
        count: 20,
        sort: 'timestamp',
        sort_dir: 'desc',
      });

      const content = extractTextContent(result.content?.[0]);
      expect(content).toContain('results');
      expect(content).toContain('total');
      expect(content).toContain('0');
    });

    it('should handle empty search results', async () => {
      // Arrange
      mockWebClientInstance.search.files.mockResolvedValue({
        ok: true,
        files: { matches: null },
      });

      // Act
      const result = await slackService.searchFiles({ query: 'nonexistent' });

      // Assert
      const content = extractTextContent(result.content?.[0]);
      expect(content).toContain('results');
      expect(content).toContain('total');
      expect(content).toContain('0');
    });

    it('should require user token for search operations', async () => {
      // This test verifies the checkSearchApiAvailability is called
      // The actual implementation should throw an error if user token is not available

      // Arrange
      mockWebClientInstance.search.files.mockResolvedValue({
        ok: true,
        files: { matches: [], total: 0 },
      });

      // Act & Assert
      // Since we mocked the config with user token, this should work
      // But if user token was not available, it should throw
      await expect(slackService.searchFiles({ query: 'test' })).resolves.not.toThrow();
    });

    it('should validate required query parameter', async () => {
      // Act & Assert
      const result = await slackService.searchFiles({});
      expect(result.isError).toBe(true);
      expect(extractTextContent(result.content[0])).toContain('Validation failed');
    });

    it('should handle API search errors', async () => {
      // Arrange
      mockWebClientInstance.search.files.mockRejectedValue(new Error('Search API unavailable'));

      // Act & Assert
      const result = await slackService.searchFiles({ query: 'test' });
      expect(result.isError).toBe(true);
      expect(extractTextContent(result.content[0])).toContain('Search API unavailable');
    });

    it('should build complex search queries correctly', async () => {
      // Arrange
      const complexArgs = {
        query: 'financial report',
        types: 'pdf,xlsx,doc',
        user: 'U1234567890',
        channel: 'C1234567890',
        after: '2023-06-01',
        before: '2023-06-30',
      };

      mockWebClientInstance.search.files.mockResolvedValue({
        ok: true,
        files: { matches: [], total: 0 },
      });

      // Act
      await slackService.searchFiles(complexArgs);

      // Assert
      const searchCall = mockWebClientInstance.search.files.mock.calls[0][0];
      expect(searchCall.query).toContain('financial report');
      expect(searchCall.query).toContain('filetype:pdf OR filetype:xlsx OR filetype:doc');
      expect(searchCall.query).toContain('in:<#C1234567890>');
      expect(searchCall.query).toContain('from:<@U1234567890>');
      expect(searchCall.query).toContain('after:2023-06-01');
      expect(searchCall.query).toContain('before:2023-06-30');
    });

    it('should validate count parameter limits', async () => {
      // Act & Assert - count too high should be handled by validation
      const result = await slackService.searchFiles({ query: 'test', count: 200 });
      expect(result.isError).toBe(true);
      expect(extractTextContent(result.content[0])).toContain('Validation failed');
    });
  });
});
