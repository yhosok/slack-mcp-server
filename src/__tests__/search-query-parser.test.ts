/**
 * @fileoverview Test suite for Advanced Search Query Parser
 * Tests comprehensive query parsing functionality for Slack Search API
 * 
 * Created: 2025-01-19
 * TDD Red Phase: Comprehensive test cases before implementation
 */

import { describe, it, expect } from '@jest/globals';
import {
  parseSearchQuery,
  buildSlackSearchQuery,
  validateSearchQuery,
  SearchQueryOptions,
  ParsedSearchQuery
} from '../slack/utils/search-query-parser';

describe('Advanced Search Query Parser', () => {
  
  describe('parseSearchQuery', () => {
    
    describe('Basic Query Parsing', () => {
      it('should parse simple text queries', () => {
        const result = parseSearchQuery('hello world');
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.query.terms).toEqual(['hello', 'world']);
          expect(result.query.operators).toEqual([]);
          expect(result.query.raw).toBe('hello world');
        }
      });

      it('should parse quoted phrases', () => {
        const result = parseSearchQuery('"hello world" test');
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.query.phrases).toEqual(['hello world']);
          expect(result.query.terms).toEqual(['test']);
        }
      });

      it('should handle empty queries', () => {
        const result = parseSearchQuery('');
        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error.code).toBe('EMPTY_QUERY');
        }
      });

      it('should handle whitespace-only queries', () => {
        const result = parseSearchQuery('   ');
        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error.code).toBe('EMPTY_QUERY');
        }
      });
    });

    describe('Slack Operator Parsing', () => {
      it('should parse channel operators', () => {
        const result = parseSearchQuery('in:#general hello');
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.query.operators).toContainEqual({
            type: 'in',
            value: '#general',
            field: 'channel'
          });
          expect(result.query.terms).toEqual(['hello']);
        }
      });

      it('should parse user operators', () => {
        const result = parseSearchQuery('from:@alice hello');
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.query.operators).toContainEqual({
            type: 'from',
            value: '@alice',
            field: 'user'
          });
        }
      });

      it('should parse has operators', () => {
        const result = parseSearchQuery('has:link hello');
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.query.operators).toContainEqual({
            type: 'has',
            value: 'link',
            field: 'content_type'
          });
        }
      });

      it('should parse date operators', () => {
        const result = parseSearchQuery('after:2023-01-01 before:2023-12-31 hello');
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.query.operators).toContainEqual({
            type: 'after',
            value: '2023-01-01',
            field: 'date'
          });
          expect(result.query.operators).toContainEqual({
            type: 'before',
            value: '2023-12-31',
            field: 'date'
          });
        }
      });

      it('should parse filetype operators', () => {
        const result = parseSearchQuery('filetype:pdf document');
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.query.operators).toContainEqual({
            type: 'filetype',
            value: 'pdf',
            field: 'file_type'
          });
        }
      });
    });

    describe('Boolean Operators', () => {
      it('should parse AND operators', () => {
        const result = parseSearchQuery('hello AND world');
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.query.booleanOperators).toContainEqual({
            type: 'AND',
            position: 1
          });
        }
      });

      it('should parse OR operators', () => {
        const result = parseSearchQuery('hello OR world');
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.query.booleanOperators).toContainEqual({
            type: 'OR',
            position: 1
          });
        }
      });

      it('should parse NOT operators', () => {
        const result = parseSearchQuery('hello NOT spam');
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.query.booleanOperators).toContainEqual({
            type: 'NOT',
            position: 1
          });
        }
      });
    });

    describe('Complex Query Parsing', () => {
      it('should parse queries with multiple operators', () => {
        const result = parseSearchQuery('in:#general from:@alice has:link "important message" after:2023-01-01');
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.query.operators).toHaveLength(4);
          expect(result.query.phrases).toContainEqual('important message');
        }
      });

      it('should parse queries with parentheses grouping', () => {
        const result = parseSearchQuery('(hello OR world) AND in:#general');
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.query.groups).toHaveLength(1);
          expect(result.query.groups[0]?.terms).toEqual(['hello', 'world']);
          expect(result.query.groups[0]?.booleanOperator).toBe('OR');
        }
      });
    });

    describe('Error Handling', () => {
      it('should handle malformed queries gracefully', () => {
        const result = parseSearchQuery('in: hello');
        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error.code).toBe('INVALID_OPERATOR');
          expect(result.error.message).toContain('in:');
        }
      });

      it('should handle unmatched quotes', () => {
        const result = parseSearchQuery('hello "world');
        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error.code).toBe('UNMATCHED_QUOTES');
        }
      });

      it('should handle unmatched parentheses', () => {
        const result = parseSearchQuery('(hello world');
        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error.code).toBe('UNMATCHED_PARENTHESES');
        }
      });

      it('should handle too complex queries', () => {
        const veryLongQuery = 'hello '.repeat(1000);
        const result = parseSearchQuery(veryLongQuery);
        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error.code).toBe('QUERY_TOO_COMPLEX');
        }
      });
    });
  });

  describe('buildSlackSearchQuery', () => {
    
    describe('Basic Query Building', () => {
      it('should build simple queries', () => {
        const parsed: ParsedSearchQuery = {
          terms: ['hello', 'world'],
          phrases: [],
          operators: [],
          booleanOperators: [],
          groups: [],
          raw: 'hello world'
        };
        
        const result = buildSlackSearchQuery(parsed);
        expect(result).toBe('hello world');
      });

      it('should build queries with phrases', () => {
        const parsed: ParsedSearchQuery = {
          terms: ['test'],
          phrases: ['hello world'],
          operators: [],
          booleanOperators: [],
          groups: [],
          raw: '"hello world" test'
        };
        
        const result = buildSlackSearchQuery(parsed);
        expect(result).toBe('"hello world" test');
      });
    });

    describe('Operator Integration', () => {
      it('should integrate channel operators', () => {
        const parsed: ParsedSearchQuery = {
          terms: ['hello'],
          phrases: [],
          operators: [{
            type: 'in',
            value: '#general',
            field: 'channel'
          }],
          booleanOperators: [],
          groups: [],
          raw: 'in:#general hello'
        };
        
        const result = buildSlackSearchQuery(parsed);
        expect(result).toBe('hello in:#general');
      });

      it('should integrate multiple operators', () => {
        const parsed: ParsedSearchQuery = {
          terms: ['hello'],
          phrases: [],
          operators: [
            { type: 'in', value: '#general', field: 'channel' },
            { type: 'from', value: '@alice', field: 'user' },
            { type: 'after', value: '2023-01-01', field: 'date' }
          ],
          booleanOperators: [],
          groups: [],
          raw: 'in:#general from:@alice after:2023-01-01 hello'
        };
        
        const result = buildSlackSearchQuery(parsed);
        expect(result).toBe('hello in:#general from:@alice after:2023-01-01');
      });
    });

    describe('Boolean Operator Integration', () => {
      it('should preserve boolean operators', () => {
        const parsed: ParsedSearchQuery = {
          terms: ['hello', 'world'],
          phrases: [],
          operators: [],
          booleanOperators: [{ type: 'AND', position: 1 }],
          groups: [],
          raw: 'hello AND world'
        };
        
        const result = buildSlackSearchQuery(parsed);
        expect(result).toBe('hello AND world');
      });
    });

    describe('Escaping and Sanitization', () => {
      it('should escape special characters', () => {
        const parsed: ParsedSearchQuery = {
          terms: ['hello"world'],
          phrases: [],
          operators: [],
          booleanOperators: [],
          groups: [],
          raw: 'hello"world'
        };
        
        const result = buildSlackSearchQuery(parsed);
        expect(result).toBe('hello\\"world');
      });

      it('should handle newlines and control characters', () => {
        const parsed: ParsedSearchQuery = {
          terms: ['hello\nworld\r\t'],
          phrases: [],
          operators: [],
          booleanOperators: [],
          groups: [],
          raw: 'hello\nworld\r\t'
        };
        
        const result = buildSlackSearchQuery(parsed);
        expect(result).toBe('hello world');
      });
    });
  });

  describe('validateSearchQuery', () => {
    
    it('should validate valid queries', () => {
      const result = validateSearchQuery('hello world');
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject empty queries', () => {
      const result = validateSearchQuery('');
      expect(result.isValid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({ code: 'EMPTY_QUERY' })
      );
    });

    it('should reject queries with invalid operators', () => {
      const result = validateSearchQuery('invalidop:value hello');
      expect(result.isValid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({ code: 'INVALID_OPERATOR' })
      );
    });

    it('should reject queries that are too long', () => {
      const longQuery = 'hello '.repeat(500);
      const result = validateSearchQuery(longQuery);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({ code: 'QUERY_TOO_LONG' })
      );
    });

    it('should provide helpful error messages', () => {
      const result = validateSearchQuery('in: hello');
      expect(result.isValid).toBe(false);
      expect(result.errors[0]?.message).toContain('missing value');
      expect(result.errors[0]?.suggestion).toBeTruthy();
    });
  });

  describe('Integration with SearchQueryOptions', () => {
    
    it('should apply channel filter options', () => {
      const options: SearchQueryOptions = {
        defaultChannel: 'C1234567890',
        allowedOperators: ['in', 'from', 'after', 'before'],
        maxQueryLength: 500
      };
      
      const result = parseSearchQuery('hello world', options);
      expect(result.success).toBe(true);
      if (result.success) {
        const query = buildSlackSearchQuery(result.query, options);
        expect(query).toContain('in:#');
      }
    });

    it('should restrict operators based on options', () => {
      const options: SearchQueryOptions = {
        allowedOperators: ['in', 'from']
      };
      
      const result = parseSearchQuery('has:link hello', options);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('OPERATOR_NOT_ALLOWED');
      }
    });
  });

  describe('Performance and Edge Cases', () => {
    
    it('should handle unicode characters', () => {
      const result = parseSearchQuery('こんにちは 世界 🌍');
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.query.terms).toEqual(['こんにちは', '世界', '🌍']);
      }
    });

    it('should handle mixed language queries', () => {
      const result = parseSearchQuery('hello こんにちは in:#general');
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.query.terms).toEqual(['hello', 'こんにちは']);
        expect(result.query.operators).toHaveLength(1);
      }
    });

    it('should process queries quickly', () => {
      const complexQuery = 'in:#general from:@alice has:link "important message" after:2023-01-01 before:2023-12-31 (urgent OR priority) AND NOT spam';
      
      const start = Date.now();
      const result = parseSearchQuery(complexQuery);
      const end = Date.now();
      
      expect(end - start).toBeLessThan(100); // Should complete in under 100ms
      expect(result.success).toBe(true);
    });
  });

  describe('Backward Compatibility', () => {
    
    it('should handle legacy simple escaping', () => {
      const result = parseSearchQuery('hello"world');
      expect(result.success).toBe(true);
      if (result.success) {
        const query = buildSlackSearchQuery(result.query);
        expect(query).toBe('hello\\"world');
      }
    });

    it('should handle existing channel name patterns', () => {
      const result = parseSearchQuery('in:#channel-name hello');
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.query.operators[0]?.value).toBe('#channel-name');
      }
    });
  });
});

// Additional type definitions for test completeness
interface TestSearchQueryOptions extends SearchQueryOptions {
  testMode?: boolean;
}

describe('Type Safety', () => {
  it('should maintain strict typing for all interfaces', () => {
    // This test ensures TypeScript compilation catches type issues
    const options: TestSearchQueryOptions = {
      allowedOperators: ['in', 'from'],
      maxQueryLength: 100,
      testMode: true
    };
    
    expect(options.allowedOperators).toBeDefined();
  });
});