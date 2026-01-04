# Research: Add Telemetry for Ticket Source on Compare

**Feature Branch**: `AIB-138-add-telemetry-for`
**Date**: 2026-01-04

## Technical Questions Resolved

### Q1: How is the source ticket identified?

**Decision**: Extract ticket key from `BRANCH` environment variable using regex `^[A-Z0-9]+-[0-9]+`

**Rationale**: The BRANCH variable is already available in the workflow and follows a predictable pattern (`{TICKET_KEY}-{description}`). This is the same approach used in `compare.md` Step 3a.

**Alternatives Considered**:
- Parse from TICKET_ID env var: Requires additional API lookup, less efficient
- Pass source ticket key explicitly as argument: Would require workflow changes

### Q2: Where should source ticket telemetry be placed in the JSON?

**Decision**: Add source ticket to `tickets` object with same key structure, plus add `sourceTicket: string` metadata field at root level

**Rationale**:
- Keeps all telemetry in one place for easy iteration
- `sourceTicket` metadata allows consumers to identify which entry is the source
- Maintains backward compatibility (existing code iterates `tickets` object)

**Alternatives Considered**:
- Separate `sourceTicket: {...}` object: Would duplicate structure and require special handling
- Array with source first: Would break existing key-based access pattern

### Q3: How should self-comparison be handled?

**Decision**: Check if source ticket key is already in the referenced tickets list and skip duplicate fetch

**Rationale**: The spec requires "Exclude duplicate, only show source once with '(source)' label". By adding source to the same `tickets` object, deduplication is automatic via object key uniqueness.

**Alternatives Considered**:
- Allow duplicate entries with different labels: Confusing, increases file size
- Error on self-comparison: Too strict, breaks valid use case

### Q4: What happens when source ticket has no completed jobs?

**Decision**: Include source ticket with `hasData: false` and zero values (same as compared tickets)

**Rationale**: Consistent handling per spec edge case: "Show hasData: false with zero values, still include in report"

**Alternatives Considered**:
- Skip source ticket entirely: Would break comparison report expectations
- Return error: Too strict for valid edge case

### Q5: Does the compare command need modification?

**Decision**: No - the compare command already has logic to identify source ticket via BRANCH (Step 3a). The telemetry context file extension is transparent to the command.

**Rationale**:
- Command reads `.telemetry-context.json` and uses entries by key
- Adding `sourceTicket` metadata is optional consumption
- Report template already shows "(source)" labels based on BRANCH extraction

**Alternatives Considered**:
- Update compare.md to read sourceTicket field: Unnecessary, BRANCH extraction is reliable

## Implementation Decisions

### Script Modification Strategy

**Location**: `.github/scripts/fetch-telemetry.sh`

**Changes Required**:
1. **Extract source ticket key** (after line 35):
   ```bash
   SOURCE_KEY=$(echo "$BRANCH" | grep -oE '^[A-Z0-9]+-[0-9]+')
   ```

2. **Add source to tickets list** (before line 48):
   ```bash
   # Add source ticket to list (if not already present)
   if ! echo "$TICKETS" | grep -q "^${SOURCE_KEY}$"; then
     TICKETS="$SOURCE_KEY $TICKETS"
   fi
   ```

3. **Track source ticket metadata** (after line 45):
   ```bash
   TELEMETRY_JSON=$(jq -n --arg ts "$(date -u +%Y-%m-%dT%H:%M:%SZ)" --arg src "$SOURCE_KEY" '{generatedAt: $ts, sourceTicket: $src, tickets: {}}')
   ```

### JSON Schema Extension

**Current Schema**:
```json
{
  "generatedAt": "2026-01-04T12:00:00Z",
  "tickets": {
    "AIB-124": { ... },
    "AIB-125": { ... }
  }
}
```

**Extended Schema**:
```json
{
  "generatedAt": "2026-01-04T12:00:00Z",
  "sourceTicket": "AIB-138",
  "tickets": {
    "AIB-138": { ... },
    "AIB-124": { ... },
    "AIB-125": { ... }
  }
}
```

### Test Updates

**File**: `tests/unit/telemetry/context-file-schema.test.ts`

**New Tests Required**:
1. Test schema validates `sourceTicket` field
2. Test source ticket appears in `tickets` object
3. Test source ticket with no data (hasData: false)
4. Test deduplication when source is in compare list

## Dependencies

| Dependency | Purpose | Version |
|------------|---------|---------|
| jq | JSON processing in bash | 1.6+ (already in workflow) |
| curl | API calls | Already in workflow |
| grep | Regex extraction | Already in workflow |

## Risk Assessment

| Risk | Severity | Mitigation |
|------|----------|------------|
| Invalid BRANCH format | Low | Regex handles gracefully, returns empty if no match |
| API failure for source ticket | Low | Same fallback as compared tickets (empty telemetry) |
| Backward compatibility | Low | Additive change only, new field is optional for consumers |

## Conclusion

The implementation is straightforward:
1. Extract source ticket key from BRANCH
2. Add to ticket list before processing loop
3. Add `sourceTicket` metadata field to JSON output
4. Update test file to validate new schema

No API changes, no database changes, no component changes required.
