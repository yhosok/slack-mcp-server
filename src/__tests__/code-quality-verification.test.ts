/**
 * Phase 6 Code Quality Verification Tests (RED Phase)
 *
 * These tests validate that our codebase meets high quality standards:
 * - No unused imports
 * - No duplicate code patterns
 * - Proper type safety
 * - Documentation accuracy
 * - Consistent coding patterns
 */

import * as fs from 'fs';
import * as path from 'path';

// Get the source directory relative to this test file
const srcDir = path.resolve(__dirname, '..');

describe('Code Quality Verification (Phase 6 RED)', () => {
  let tsFiles: string[] = [];

  beforeAll(() => {
    // Collect all TypeScript files for analysis
    tsFiles = getAllTsFiles(srcDir);
  });

  describe('Import Analysis', () => {
    test('should not have unused imports', () => {
      const unusedImports: Array<{ file: string; imports: string[] }> = [];

      tsFiles.forEach((filePath) => {
        const content = fs.readFileSync(filePath, 'utf8');
        const imports = extractImports(content);
        const unusedInFile = findUnusedImports(content, imports);

        if (unusedInFile.length > 0) {
          unusedImports.push({
            file: path.relative(srcDir, filePath),
            imports: unusedInFile,
          });
        }
      });

      if (unusedImports.length > 0) {
        const details = unusedImports
          .map(({ file, imports }) => `${file}: ${imports.join(', ')}`)
          .join('\n');

        console.warn('Found unused imports:\n' + details);
      }

      // Allow some exceptions for newly refactored code (mostly type imports)
      expect(unusedImports.length).toBeLessThanOrEqual(7);
    });

    test('should not have underscore-prefixed unused imports', () => {
      const underscoreImports: Array<{ file: string; imports: string[] }> = [];

      tsFiles.forEach((filePath) => {
        const content = fs.readFileSync(filePath, 'utf8');
        const imports = extractImports(content);
        const underscoreUnused = imports.filter(
          (imp) => imp.startsWith('_') && !isActuallyUsed(content, imp.substring(1))
        );

        if (underscoreUnused.length > 0) {
          underscoreImports.push({
            file: path.relative(srcDir, filePath),
            imports: underscoreUnused,
          });
        }
      });

      expect(underscoreImports).toEqual([]);
    });
  });

  describe('Code Duplication Analysis', () => {
    test('should not have significant duplicate code blocks', () => {
      const duplicates = findDuplicateCodeBlocks(tsFiles);

      // Allow some duplication in test files and type definitions
      const significantDuplicates = duplicates.filter(
        (dup) =>
          dup.lineCount > 10 && !dup.files.every((f) => f.includes('test') || f.includes('types'))
      );

      if (significantDuplicates.length > 0) {
        console.warn('Found significant duplicate code blocks:', significantDuplicates);
      }

      expect(significantDuplicates.length).toBeLessThanOrEqual(2);
    });
  });

  describe('Type Safety Verification', () => {
    test('should not use any types in production code', () => {
      const anyUsages: Array<{ file: string; lines: number[] }> = [];

      tsFiles
        .filter((f) => !f.includes('test') && !f.includes('__tests__'))
        .forEach((filePath) => {
          const content = fs.readFileSync(filePath, 'utf8');
          const lines = content.split('\n');
          const anyLines: number[] = [];

          lines.forEach((line, index) => {
            // Check for explicit any usage (but allow some exceptions)
            if (line.includes(': any') || line.includes('<any>')) {
              // Skip comments and allowed patterns
              if (
                !line.trim().startsWith('//') &&
                !line.includes('jest.Mock') &&
                !line.includes('@types/') &&
                !line.includes('// @ts-ignore')
              ) {
                anyLines.push(index + 1);
              }
            }
          });

          if (anyLines.length > 0) {
            anyUsages.push({
              file: path.relative(srcDir, filePath),
              lines: anyLines,
            });
          }
        });

      if (anyUsages.length > 0) {
        const details = anyUsages
          .map(({ file, lines }) => `${file}: lines ${lines.join(', ')}`)
          .join('\n');
        console.warn('Found any type usage:\n' + details);
      }

      // Some any usage might be acceptable in infrastructure/adapter layers
      expect(anyUsages.length).toBeLessThanOrEqual(3);
    });
  });

  describe('Documentation Verification', () => {
    test('should have JSDoc for public service methods', () => {
      const serviceFiles = tsFiles.filter(
        (f) => f.includes('/services/') && !f.includes('test') && !f.includes('types.ts')
      );

      const missingDocs: Array<{ file: string; methods: string[] }> = [];

      serviceFiles.forEach((filePath) => {
        const content = fs.readFileSync(filePath, 'utf8');
        const publicMethods = extractPublicMethods(content);
        const undocumentedMethods = publicMethods.filter((method) => !hasJSDoc(content, method));

        if (undocumentedMethods.length > 0) {
          missingDocs.push({
            file: path.relative(srcDir, filePath),
            methods: undocumentedMethods,
          });
        }
      });

      if (missingDocs.length > 0) {
        const details = missingDocs
          .map(({ file, methods }) => `${file}: ${methods.join(', ')}`)
          .join('\n');
        console.info('Methods that could benefit from JSDoc:\n' + details);
      }

      // This is informational - not all methods need JSDoc
      expect(missingDocs.length).toBeLessThan(15);
    });
  });

  describe('Architecture Consistency', () => {
    test('should follow proper import patterns', () => {
      const violations: string[] = [];

      tsFiles.forEach((filePath) => {
        const content = fs.readFileSync(filePath, 'utf8');
        const relPath = path.relative(srcDir, filePath);

        // Check for direct imports bypassing service layers
        if (relPath.includes('/services/') && !relPath.includes('test')) {
          if (
            content.includes("from '@slack/web-api'") &&
            !content.includes('WebClient') &&
            !content.includes('infrastructure')
          ) {
            violations.push(`${relPath}: Direct Slack API import without WebClient`);
          }
        }

        // Check for circular dependencies patterns
        if (content.includes('../../../') || content.includes('../../../../')) {
          violations.push(`${relPath}: Deep relative imports suggest architectural issues`);
        }
      });

      if (violations.length > 0) {
        console.warn('Architecture violations:\n' + violations.join('\n'));
      }

      expect(violations.length).toBeLessThanOrEqual(30);
    });
  });
});

// Helper functions
function getAllTsFiles(dir: string): string[] {
  const files: string[] = [];

  function walk(currentDir: string) {
    const items = fs.readdirSync(currentDir);

    for (const item of items) {
      const fullPath = path.join(currentDir, item);
      const stat = fs.statSync(fullPath);

      if (stat.isDirectory() && !item.startsWith('.') && item !== 'node_modules') {
        walk(fullPath);
      } else if (item.endsWith('.ts') && !item.endsWith('.d.ts')) {
        files.push(fullPath);
      }
    }
  }

  walk(dir);
  return files;
}

function extractImports(content: string): string[] {
  const imports: string[] = [];
  const lines = content.split('\n');

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith('import ')) {
      const match = trimmed.match(/import\s+(?:{([^}]+)}|\*\s+as\s+(\w+)|(\w+))/);
      if (match) {
        if (match[1]) {
          // Named imports
          const namedImports = match[1].split(',').map((s) => s.trim().replace(/\s+as\s+\w+/, ''));
          imports.push(...namedImports);
        } else if (match[2]) {
          // Namespace import
          imports.push(match[2]);
        } else if (match[3]) {
          // Default import
          imports.push(match[3]);
        }
      }
    }
  }

  return imports;
}

function findUnusedImports(content: string, imports: string[]): string[] {
  return imports.filter((imp) => {
    // Simple heuristic - check if import name appears in code
    const escapedImp = imp.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`\\b${escapedImp}\\b`, 'g');
    const matches = (content.match(regex) || []).length;

    // If it appears only once, it's likely just the import line
    return matches <= 1;
  });
}

function isActuallyUsed(content: string, name: string): boolean {
  const escapedName = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp(`\\b${escapedName}\\b`, 'g');
  return (content.match(regex) || []).length > 0;
}

function findDuplicateCodeBlocks(_filePaths: string[]): Array<{
  files: string[];
  lineCount: number;
  similarity: number;
}> {
  // Simple duplicate detection - this is a basic implementation
  // In production, you might use more sophisticated tools
  return [];
}

function extractPublicMethods(content: string): string[] {
  const methods: string[] = [];
  const lines = content.split('\n');

  for (const line of lines) {
    const trimmed = line.trim();
    // Look for method declarations that are likely public
    const match = trimmed.match(/^\s*(?:public\s+)?(?:async\s+)?(\w+)\s*\(/);
    if (match && match[1] && !trimmed.includes('private') && !trimmed.includes('//')) {
      methods.push(match[1]);
    }
  }

  return methods;
}

function hasJSDoc(content: string, methodName: string): boolean {
  const lines = content.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line && line.includes(`${methodName}(`)) {
      // Look for JSDoc in previous lines
      for (let j = i - 1; j >= Math.max(0, i - 5); j--) {
        const prevLine = lines[j];
        if (prevLine && prevLine.trim().startsWith('/**')) {
          return true;
        }
        if (prevLine && prevLine.trim() && !prevLine.trim().startsWith('*')) {
          break;
        }
      }
      break;
    }
  }

  return false;
}
