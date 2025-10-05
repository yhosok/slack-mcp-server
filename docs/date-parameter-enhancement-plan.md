# Date Parameter Enhancement Implementation Plan

## Overview
Add user-friendly date string support to time period parameters while maintaining timestamp precision for advanced use cases. This enhancement standardizes date handling across all MCP tools with a dual-support approach.

**Date Created:** 2025-10-05
**Status:** Ready for Implementation
**Breaking Changes:** Yes (parameter names changed, but no existing users)

## Background

### Current Issues
- 4 tools use Unix timestamp strings (`oldest`/`latest`, `ts_from`/`ts_to`) which are difficult for LLMs and humans to use
- LLMs frequently misinterpret timestamp values
- 6 tools already use date strings (`after`/`before`) but only for Search APIs
- Inconsistent parameter naming across tools (4 different patterns)

### Investigation Summary
**Affected Tools (5 total):**
1. `get_channel_history` - Currently: `oldest`/`latest`
2. `find_threads_in_channel` - Currently: `oldest`/`latest`
3. `get_thread_replies` - Currently: `oldest`/`latest`
4. `list_files` - Currently: `ts_from`/`ts_to`
5. `get_workspace_activity` - Currently: `start_date`/`end_date`

**Already Using Date Strings (6 tools):**
- `search_messages`, `search_threads`, `search_files`
- `get_thread_metrics`, `get_threads_by_participants`
- `find_messages_by_reactions`

## Design Decision: Dual Support Approach

### Parameter Naming Strategy

```typescript
// Date strings (recommended, user-friendly)
after_date?: string;    // YYYY-MM-DD format, inclusive (00:00:00 UTC)
before_date?: string;   // YYYY-MM-DD format, inclusive (23:59:59 UTC)

// Timestamps (advanced, precise control)
oldest_ts?: string;     // Unix timestamp in seconds (as-is, for precision)
latest_ts?: string;     // Unix timestamp in seconds (as-is, for precision)

// Mutual exclusion enforced via validation
```

### Rationale for Naming

1. **Clear Suffixes Prevent Confusion:**
   - `_date` suffix → Clearly indicates date string format
   - `_ts` suffix → Clearly indicates timestamp format
   - LLMs can easily distinguish based on naming pattern

2. **Backward Compatibility via Precision:**
   - Keep timestamp parameters for second-level precision
   - Date parameters for day-level filtering (99% of use cases)

3. **Mutual Exclusion:**
   - Cannot use `after_date` with `oldest_ts` simultaneously
   - Cannot use `before_date` with `latest_ts` simultaneously
   - Validation enforces this constraint

### Date Semantics (Inclusive Behavior)

**For History/Conversation APIs (4 new tools):**
```
after_date:  "2025-09-10" → timestamp 1725926400 (2025-09-10 00:00:00 UTC) ✅ includes this day
before_date: "2025-09-10" → timestamp 1726012799 (2025-09-10 23:59:59 UTC) ✅ includes this day
```

**Contrast with Search APIs (6 existing tools - unchanged):**
```
after:  "2025-09-10" → exclusive (does NOT include 2025-09-10, Slack API behavior)
before: "2025-09-10" → exclusive (does NOT include 2025-09-10, Slack API behavior)
```

**Important:** Different APIs have different semantics. This will be clearly documented.

## Implementation Phases (TDD: Red-Green-Refactor)

### Phase 1: Investigation & Setup ✅
- [x] Investigate current implementation (completed)
- [x] Document existing patterns
- [x] Create implementation plan
- [ ] Save plan to docs/

### Phase 2: Create Date Conversion Utility (Red → Green)

**File:** `src/utils/date-converter.ts` (new)

**Functionality:**
```typescript
/**
 * Convert YYYY-MM-DD date string to Unix timestamp
 * @param dateString - Date in YYYY-MM-DD format
 * @param endOfDay - If true, return 23:59:59, otherwise 00:00:00
 * @returns Unix timestamp string (seconds)
 */
export function convertDateToTimestamp(
  dateString: string,
  endOfDay: boolean = false
): string;

/**
 * Validate date string format (YYYY-MM-DD)
 */
export function isValidDateFormat(dateString: string): boolean;

/**
 * Check if string is a Unix timestamp
 */
export function isTimestampFormat(value: string): boolean;
```

**Implementation Details:**
- Parse YYYY-MM-DD to Date object
- Set time to 00:00:00 or 23:59:59 UTC
- Convert to Unix timestamp (seconds)
- Return as string for Slack API compatibility

**Tests to Write:**
- Valid date conversion (start of day)
- Valid date conversion (end of day)
- Invalid date format rejection
- Timestamp format detection
- Edge cases (leap years, month boundaries)

### Phase 3: Update Validation Schemas (Red → Green)

**File:** `src/utils/validation.ts`

**Schemas to Update:**
1. `GetChannelHistorySchema` (lines 80-114)
2. `FindThreadsInChannelSchema` (lines 160-199)
3. `GetThreadRepliesSchema` (lines 201-246)
4. `ListFilesSchema` (lines 626-662)
5. `GetWorkspaceActivitySchema` (lines 926-963)

**Changes for Each Schema:**

```typescript
// Before
export const GetChannelHistorySchema = z.object({
  channel: z.string(),
  oldest: z.string().optional().describe('Start of time range (timestamp)'),
  latest: z.string().optional().describe('End of time range (timestamp)'),
  // ... other fields
});

// After
export const GetChannelHistorySchema = z.object({
  channel: z.string(),

  // Date range (recommended)
  after_date: z.string().optional()
    .describe('Start date (YYYY-MM-DD, inclusive, 00:00:00 UTC). Recommended for day-level filtering. Example: "2025-09-10". Cannot be used with oldest_ts.'),
  before_date: z.string().optional()
    .describe('End date (YYYY-MM-DD, inclusive, 23:59:59 UTC). Recommended for day-level filtering. Example: "2025-09-30". Cannot be used with latest_ts.'),

  // Timestamp range (advanced)
  oldest_ts: z.string().optional()
    .describe('Start Unix timestamp in seconds. For precise second-level control. Cannot be used with after_date.'),
  latest_ts: z.string().optional()
    .describe('End Unix timestamp in seconds. For precise second-level control. Cannot be used with before_date.'),

  // ... other fields
}).refine(
  (data) => !(data.after_date && data.oldest_ts),
  { message: 'Cannot specify both after_date and oldest_ts. Use date strings OR timestamps, not both.' }
).refine(
  (data) => !(data.before_date && data.latest_ts),
  { message: 'Cannot specify both before_date and latest_ts. Use date strings OR timestamps, not both.' }
);
```

**Validation Logic:**
- Add `.refine()` for mutual exclusion
- Add date format validation using `isValidDateFormat()`
- Ensure clear error messages

### Phase 4: Update MCP Tool Definitions (Red → Green)

**File:** `src/mcp/tools.ts`

**Tools to Update:**
- `GET_CHANNEL_HISTORY`
- `FIND_THREADS_IN_CHANNEL`
- `GET_THREAD_REPLIES`
- `LIST_FILES`
- `GET_WORKSPACE_ACTIVITY`

**Changes:**
- Tool definitions auto-generate from Zod schemas
- No manual changes needed (schema-converter handles it)
- Verify generated JSON schema includes new parameters

### Phase 5: Update Service Implementations (Red → Green)

#### 5.1 MessageService

**File:** `src/slack/services/messages/message-service.ts`

**Method:** `getChannelHistory()` (around line 150)

**Implementation:**
```typescript
async getChannelHistory(args: unknown): Promise<ServiceResult<ChannelHistoryOutput>> {
  try {
    const input = validateInput(GetChannelHistorySchema, args);

    // Convert date parameters to timestamps
    let oldest: string | undefined;
    let latest: string | undefined;

    if (input.after_date) {
      oldest = convertDateToTimestamp(input.after_date, false); // 00:00:00
    } else if (input.oldest_ts) {
      oldest = input.oldest_ts;
    }

    if (input.before_date) {
      latest = convertDateToTimestamp(input.before_date, true); // 23:59:59
    } else if (input.latest_ts) {
      latest = input.latest_ts;
    }

    // Call Slack API with converted timestamps
    const result = await client.conversations.history({
      channel: input.channel,
      oldest,
      latest,
      // ... other params
    });

    // ... rest of implementation
  }
}
```

#### 5.2 ThreadService

**File:** `src/slack/services/threads/thread-service.ts`

**Methods to Update:**
- `findThreadsInChannel()` (around line 50)
- `getThreadReplies()` (around line 150)

**Implementation Pattern:** Same as MessageService

#### 5.3 FileService

**File:** `src/slack/services/files/file-service.ts`

**Method:** `listFiles()` (around line 50)

**Changes:**
- Replace `ts_from`/`ts_to` with `after_date`/`before_date` + `oldest_ts`/`latest_ts`
- Convert dates to timestamps
- Pass to `files.list` API

#### 5.4 WorkspaceService

**File:** `src/slack/services/workspace/workspace-service.ts`

**Method:** `getWorkspaceActivity()` (around line 400)

**Changes:**
- Replace `start_date`/`end_date` with `after_date`/`before_date`
- Already has conversion logic - refactor to use new utility
- Add timestamp parameter support

### Phase 6: Write Comprehensive Tests (TDD: Red Phase First!)

**Test Files to Create/Update:**

1. **`src/__tests__/date-converter.test.ts`** (new)
   - Unit tests for date conversion utility
   - ~100 lines of test coverage

2. **`src/__tests__/get-channel-history.test.ts`** (update)
   - Test `after_date`/`before_date` parameters
   - Test `oldest_ts`/`latest_ts` parameters
   - Test mutual exclusion validation
   - Test conversion to correct timestamps
   - ~150 lines

3. **`src/__tests__/thread-operations.test.ts`** (update)
   - Test date parameters in `findThreadsInChannel`
   - Test date parameters in `getThreadReplies`
   - ~150 lines

4. **`src/__tests__/file-operations.test.ts`** (update)
   - Test date parameters in `listFiles`
   - ~100 lines

5. **`src/__tests__/workspace.test.ts`** (update)
   - Test updated `getWorkspaceActivity`
   - ~100 lines

**Test Coverage Requirements:**
- ✅ Valid date string conversion (start of day)
- ✅ Valid date string conversion (end of day)
- ✅ Valid timestamp pass-through
- ✅ Mutual exclusion errors
- ✅ Invalid date format errors
- ✅ Edge cases (leap years, timezone handling)
- ✅ Integration with Slack API mocks

### Phase 7: Update Documentation

**File:** `CLAUDE.md`

**Sections to Update:**

1. **Environment Configuration section:**
   - Document new date parameter format

2. **Add new section: "Date and Time Parameters"**
   ```markdown
   ## Date and Time Parameters

   ### Dual Support: Date Strings and Timestamps

   Most tools support both user-friendly date strings and precise Unix timestamps for time filtering:

   #### Date Strings (Recommended)
   - **Format:** YYYY-MM-DD
   - **Parameters:** `after_date`, `before_date`
   - **Behavior:** Inclusive (includes the specified day)
   - **Time Defaults:**
     - `after_date`: Start of day (00:00:00 UTC)
     - `before_date`: End of day (23:59:59 UTC)
   - **Example:**
     ```javascript
     { after_date: "2025-09-10", before_date: "2025-09-30" }
     // Includes all messages from 2025-09-10 00:00:00 to 2025-09-30 23:59:59
     ```

   #### Timestamps (Advanced)
   - **Format:** Unix timestamp in seconds (string)
   - **Parameters:** `oldest_ts`, `latest_ts`
   - **Behavior:** As-is, precise second-level control
   - **Example:**
     ```javascript
     { oldest_ts: "1725926400", latest_ts: "1726531199" }
     ```

   #### Important Notes
   - Cannot mix date strings with timestamps (mutual exclusion)
   - History APIs (get_channel_history, etc.): Date strings are **inclusive**
   - Search APIs (search_messages, etc.): Date parameters are **exclusive** (Slack API behavior)
   ```

3. **Update tool descriptions:**
   - Update all 5 affected tools with new parameter info
   - Add examples showing both date and timestamp usage

### Phase 8: Code Quality & Refactoring

**Tasks:**
- [ ] Remove code duplication
- [ ] Add JSDoc comments to new utilities
- [ ] Ensure TypeScript types are correct
- [ ] Run linter: `npm run lint`
- [ ] Fix any linting issues: `npm run lint:fix`
- [ ] Format code: `npm run format`

### Phase 9: Final Validation

**Checklist:**
- [ ] All tests pass: `npm test`
- [ ] Linting passes: `npm run lint`
- [ ] Build succeeds: `npm run build`
- [ ] Manual testing with date parameters
- [ ] Manual testing with timestamp parameters
- [ ] Manual testing with mutual exclusion errors
- [ ] Documentation is complete and accurate

## Files Modified Summary

### New Files (1)
- `src/utils/date-converter.ts` - Date/timestamp conversion utilities

### Modified Files (10)
1. `src/utils/validation.ts` - Update 5 schemas
2. `src/mcp/tools.ts` - Auto-updated via schema converter
3. `src/slack/services/messages/message-service.ts` - Update getChannelHistory
4. `src/slack/services/threads/thread-service.ts` - Update 2 methods
5. `src/slack/services/files/file-service.ts` - Update listFiles
6. `src/slack/services/workspace/workspace-service.ts` - Update getWorkspaceActivity
7. `CLAUDE.md` - Documentation updates
8. `src/__tests__/date-converter.test.ts` (new test file)
9. `src/__tests__/get-channel-history.test.ts` (update)
10. `src/__tests__/thread-operations.test.ts` (update)
11. `src/__tests__/file-operations.test.ts` (update)
12. `src/__tests__/workspace.test.ts` (update)

### Documentation Files (2)
- `CLAUDE.md` - Updated parameter documentation
- `docs/date-parameter-enhancement-plan.md` - This file

## Estimated Effort

- **New Utility Code:** ~80 lines
- **Schema Updates:** ~120 lines
- **Service Implementation Updates:** ~150 lines
- **Test Coverage:** ~500 lines
- **Documentation:** ~150 lines
- **Total:** ~1000 lines of changes

## Risk Assessment

### Low Risk ✅
- Existing Search API tools unchanged (6 tools)
- Timestamp parameters preserved for precision needs
- Comprehensive test coverage planned
- No external users (no backward compatibility needed)

### Medium Risk ⚠️
- Parameter name changes require updates to any existing scripts
- Two parameter sets might cause initial LLM confusion
  - Mitigated by: Clear naming, detailed descriptions, validation errors

### High Risk ❌
- None identified

## Success Criteria

1. ✅ All 5 tools support dual date/timestamp parameters
2. ✅ Date strings use inclusive semantics (00:00:00 to 23:59:59)
3. ✅ Timestamps maintain second-level precision
4. ✅ Mutual exclusion properly enforced
5. ✅ 100% test coverage for new functionality
6. ✅ All tests pass
7. ✅ All linting passes
8. ✅ Documentation is complete and clear
9. ✅ LLMs can easily understand which parameter to use

## Future Enhancements (Out of Scope)

- ISO 8601 timestamp support (e.g., "2025-09-10T14:30:00Z")
- Relative date strings (e.g., "today", "yesterday", "last_week")
- Timezone-aware date conversion
- Standardize Search API behavior to match History API (requires Slack API changes)

## References

- Investigation Report: Agent output from implementation-explorer
- Existing Implementation: `src/slack/services/workspace/workspace-service.ts` (lines 427-433)
- Date Validation: `src/utils/date-validation.ts`
- Schema Converter: `src/mcp/schema-converter.ts`
