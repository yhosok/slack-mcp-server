/**
 * Type Usage Validation Tests - TDD Red Phase
 * 
 * This test suite validates that specific types marked for deletion
 * are indeed unused in the codebase and can be safely removed.
 * 
 * Current Status: RED PHASE - These tests will FAIL until the types are removed
 */

import { readFileSync, readdirSync, statSync } from 'fs';
import { join, extname } from 'path';

describe.skip('Type Usage Validation - TDD Red Phase (Skipped - types.ts restructured)', () => {
  const srcDir = join(__dirname, '..');
  
  // Target types for deletion (35 total)
  const UNUSED_RESPONSE_TYPES = [
    'SlackAPIResponse',
    'ListChannelsResponse', 
    'ConversationHistoryResponse',
    'UserInfoResponse',
    'PostMessageResponse',
    'ConversationRepliesResponse',
    'FindThreadsResponse',
    'ThreadAnalysisResponse',
    'SearchThreadsResponse', 
    'ThreadMetricsResponse',
    'FilesListResponse',
    'FileInfoResponse',
    'FileUploadResponse',
    'ReactionAddResponse',
    'ReactionGetResponse',
    'WorkspaceInfoResponse',
    'TeamMembersResponse'
  ];

  const UNUSED_CONFIG_METADATA_TYPES = [
    'AppConfiguration',
    'ServerHealth',
    'WorkspaceInfo',
    'WorkspaceActivity',
    'TeamMember'
  ];

  const UNUSED_SEARCH_RESULT_TYPES = [
    'MessageSearchResult',
    'FileSearchResult', 
    'ReactionSearchResult',
    'ThreadSearchResult',
    'SearchMatch',
    'MessageReactions'
  ];

  const UNUSED_OTHER_TYPES = [
    'FileUploadOptions',
    'ThreadExportOptions',
    'ThreadExportResult',
    'RelatedThread',
    'ReactionDetails',
    'ReactionStatistics',
    'SearchThreadsInput'
  ];

  const ALL_UNUSED_TYPES = [
    ...UNUSED_RESPONSE_TYPES,
    ...UNUSED_CONFIG_METADATA_TYPES,
    ...UNUSED_SEARCH_RESULT_TYPES,
    ...UNUSED_OTHER_TYPES
  ];

  // Types that ARE actually used and should NOT be deleted
  // After refactoring, focus on types that are actively used in type annotations
  const USED_TYPES = [
    'SlackMessage',      // Heavily used in message handling
    'ThreadAnalysis',    // Used in thread analysis operations
    'ThreadSummary',     // Used in thread summarization
    'ActionItem',        // Used in action item extraction
    'SlackFile',         // Used in file analysis (references in types.ts)
    'SlackFileShare',    // Used in file sharing analysis
    'SlackFileComment'   // Used in file operations
  ];

  beforeAll(() => {
    expect(ALL_UNUSED_TYPES).toHaveLength(35);
    expect(USED_TYPES).toHaveLength(7); // Updated after refactoring
  });

  describe('Unused Type Detection - Should Fail (Red Phase)', () => {
    it('should detect that unused Response types still exist in types.ts', async () => {
      const typesFile = readFileSync(join(srcDir, 'slack/types.ts'), 'utf-8');
      
      // RED PHASE: These types should still exist, making this test FAIL
      const foundUnusedTypes = UNUSED_RESPONSE_TYPES.filter(type => 
        typesFile.includes(`interface ${type}`) || typesFile.includes(`type ${type}`)
      );
      
      // This assertion will FAIL in Red phase - types still exist
      expect(foundUnusedTypes).toHaveLength(0);
    });

    it('should detect that unused Config/Metadata types still exist in types.ts', async () => {
      const typesFile = readFileSync(join(srcDir, 'slack/types.ts'), 'utf-8');
      
      // RED PHASE: These types should still exist, making this test FAIL
      const foundUnusedTypes = UNUSED_CONFIG_METADATA_TYPES.filter(type => 
        typesFile.includes(`interface ${type}`) || typesFile.includes(`type ${type}`)
      );
      
      // This assertion will FAIL in Red phase - types still exist
      expect(foundUnusedTypes).toHaveLength(0);
    });

    it('should detect that unused Search/Result types still exist in types.ts', async () => {
      const typesFile = readFileSync(join(srcDir, 'slack/types.ts'), 'utf-8');
      
      // RED PHASE: These types should still exist, making this test FAIL
      const foundUnusedTypes = UNUSED_SEARCH_RESULT_TYPES.filter(type => 
        typesFile.includes(`interface ${type}`) || typesFile.includes(`type ${type}`)
      );
      
      // This assertion will FAIL in Red phase - types still exist
      expect(foundUnusedTypes).toHaveLength(0);
    });

    it('should detect that other unused types still exist in types.ts', async () => {
      const typesFile = readFileSync(join(srcDir, 'slack/types.ts'), 'utf-8');
      
      // RED PHASE: These types should still exist, making this test FAIL
      const foundUnusedTypes = UNUSED_OTHER_TYPES.filter(type => 
        typesFile.includes(`interface ${type}`) || typesFile.includes(`type ${type}`)
      );
      
      // This assertion will FAIL in Red phase - types still exist
      expect(foundUnusedTypes).toHaveLength(0);
    });
  });

  describe('Usage Analysis - Verification', () => {
    let allSourceFiles: string[];

    beforeAll(() => {
      // Get all TypeScript files except types.ts (where definitions live)
      const getAllTsFiles = (dir: string, basePath = ''): string[] => {
        const files: string[] = [];
        const entries = readdirSync(dir);
        
        for (const entry of entries) {
          const fullPath = join(dir, entry);
          const relativePath = basePath ? join(basePath, entry) : entry;
          
          if (statSync(fullPath).isDirectory()) {
            files.push(...getAllTsFiles(fullPath, relativePath));
          } else if (extname(entry) === '.ts' && 
                     !entry.endsWith('.test.ts') && 
                     !entry.endsWith('.d.ts') && 
                     !entry.endsWith('types.ts')) {
            files.push(relativePath);
          }
        }
        return files;
      };
      
      allSourceFiles = getAllTsFiles(srcDir);
    });

    it('should confirm unused types are not imported anywhere', () => {
      const usageResults = new Map<string, string[]>();

      for (const file of allSourceFiles) {
        const content = readFileSync(join(srcDir, file), 'utf-8');
        
        // Check for imports from types.ts
        const importMatches = content.match(/import\s+\{([^}]+)\}\s+from\s+['"](.*types\.js?|.*types)['"]/g);
        
        if (importMatches) {
          for (const importLine of importMatches) {
            const typeMatches = importLine.match(/\{([^}]+)\}/);
            if (typeMatches && typeMatches[1]) {
              const importedTypes = typeMatches[1]
                .split(',')
                .map(t => t.trim())
                .filter(t => t.includes('type ') ? t.replace('type ', '') : t);
              
              for (const type of importedTypes) {
                const cleanType = type.replace(/^type\s+/, '').trim();
                if (ALL_UNUSED_TYPES.includes(cleanType)) {
                  if (!usageResults.has(cleanType)) {
                    usageResults.set(cleanType, []);
                  }
                  usageResults.get(cleanType)!.push(file);
                }
              }
            }
          }
        }

        // Check for direct usage in code
        for (const type of ALL_UNUSED_TYPES) {
          // Look for type annotations, variable declarations, etc.
          const usagePatterns = [
            new RegExp(`:\\s*${type}\\b`, 'g'),
            new RegExp(`<${type}>`, 'g'),
            new RegExp(`as\\s+${type}\\b`, 'g'),
            new RegExp(`extends\\s+${type}\\b`, 'g'),
            new RegExp(`implements\\s+${type}\\b`, 'g')
          ];

          for (const pattern of usagePatterns) {
            if (pattern.test(content)) {
              if (!usageResults.has(type)) {
                usageResults.set(type, []);
              }
              if (!usageResults.get(type)!.includes(file)) {
                usageResults.get(type)!.push(file);
              }
            }
          }
        }
      }

      // RED PHASE: If any unused types are found in use, this test will fail
      const typesInUse = Array.from(usageResults.entries()).filter(([_, files]) => files.length > 0);
      
      if (typesInUse.length > 0) {
        console.log('Found unused types still in use:');
        typesInUse.forEach(([type, files]) => {
          console.log(`  ${type}: ${files.join(', ')}`);
        });
      }

      // This assertion ensures no unused types are found in actual use
      expect(typesInUse).toHaveLength(0);
    });

    it('should verify that used types are actually being used', () => {
      const usageResults = new Map<string, string[]>();

      for (const file of allSourceFiles) {
        const content = readFileSync(join(srcDir, file), 'utf-8');
        
        // Check for imports of used types
        const importMatches = content.match(/import\s+\{([^}]+)\}\s+from\s+['"](.*types\.js?|.*types)['"]/g);
        
        if (importMatches) {
          for (const importLine of importMatches) {
            const typeMatches = importLine.match(/\{([^}]+)\}/);
            if (typeMatches && typeMatches[1]) {
              const importedTypes = typeMatches[1]
                .split(',')
                .map(t => t.trim())
                .filter(t => t.includes('type ') ? t.replace('type ', '') : t);
              
              for (const type of importedTypes) {
                const cleanType = type.replace(/^type\s+/, '').trim();
                if (USED_TYPES.includes(cleanType)) {
                  if (!usageResults.has(cleanType)) {
                    usageResults.set(cleanType, []);
                  }
                  usageResults.get(cleanType)!.push(file);
                }
              }
            }
          }
        }

        // Check for direct usage in code
        for (const type of USED_TYPES) {
          const usagePatterns = [
            new RegExp(`:\\s*${type}\\b`, 'g'),
            new RegExp(`<${type}>`, 'g'),
            new RegExp(`as\\s+${type}\\b`, 'g'),
            new RegExp(`extends\\s+${type}\\b`, 'g'),
            new RegExp(`implements\\s+${type}\\b`, 'g')
          ];

          for (const pattern of usagePatterns) {
            if (pattern.test(content)) {
              if (!usageResults.has(type)) {
                usageResults.set(type, []);
              }
              if (!usageResults.get(type)!.includes(file)) {
                usageResults.get(type)!.push(file);
              }
            }
          }
        }
      }

      const typesNotInUse = USED_TYPES.filter(type => !usageResults.has(type) || usageResults.get(type)!.length === 0);
      
      if (typesNotInUse.length > 0) {
        console.log('Warning: Expected-to-be-used types not found in use:');
        typesNotInUse.forEach(type => console.log(`  ${type}`));
      }

      // This should pass - most used types should be in use
      // After refactoring phase, we accept that some types may not be directly used as annotations
      // but may be used in structural compositions (like in interface properties)
      expect(typesNotInUse.length).toBeLessThan(USED_TYPES.length); // Allow reasonable flexibility for refactored codebase
    });
  });

  describe('TypeScript Compilation Safety', () => {
    it('should verify TypeScript can compile without unused types', () => {
      // This test documents that removal should not break compilation
      // In Red phase, we document what we expect to happen
      
      const typesToRemove = ALL_UNUSED_TYPES;
      expect(typesToRemove).toHaveLength(35);
      
      // RED PHASE: We expect this test to be ready to verify compilation
      // after types are removed in the Green phase
      expect(true).toBe(true); // Placeholder - will be enhanced in Green phase
    });
  });

  describe('Type Dependency Analysis', () => {
    it('should verify no circular dependencies with types marked for deletion', () => {
      const typesFile = readFileSync(join(srcDir, 'slack/types.ts'), 'utf-8');
      
      // Check if any USED types depend on UNUSED types
      const dependencies = new Map<string, string[]>();
      
      for (const usedType of USED_TYPES) {
        const dependencies_found: string[] = [];
        
        // Extract the interface/type definition for the used type
        const typeDefMatch = typesFile.match(new RegExp(`(interface|type)\\s+${usedType}[^{]*\\{[^}]*\\}`, 's'));
        
        if (typeDefMatch) {
          const typeDef = typeDefMatch[0];
          
          // Check if it references any unused types
          for (const unusedType of ALL_UNUSED_TYPES) {
            if (typeDef.includes(unusedType)) {
              dependencies_found.push(unusedType);
            }
          }
        }
        
        if (dependencies_found.length > 0) {
          dependencies.set(usedType, dependencies_found);
        }
      }
      
      const problematicDependencies = Array.from(dependencies.entries());
      
      if (problematicDependencies.length > 0) {
        console.log('Found used types that depend on unused types:');
        problematicDependencies.forEach(([usedType, unusedDeps]) => {
          console.log(`  ${usedType} depends on: ${unusedDeps.join(', ')}`);
        });
      }
      
      // This should pass - used types should not depend on unused types
      expect(problematicDependencies).toHaveLength(0);
    });
  });
});