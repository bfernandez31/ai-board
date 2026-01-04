# Quickstart: Add Telemetry for Ticket Source on Compare

**Feature Branch**: `AIB-138-add-telemetry-for`
**Date**: 2026-01-04

## Implementation Summary

Modify `.github/scripts/fetch-telemetry.sh` to include the source ticket's telemetry in the comparison context file.

## Files to Modify

| File | Action | Scope |
|------|--------|-------|
| `.github/scripts/fetch-telemetry.sh` | MODIFY | Add source ticket extraction and telemetry fetch |
| `tests/unit/telemetry/context-file-schema.test.ts` | MODIFY | Add tests for sourceTicket field |

## Implementation Steps

### Step 1: Extract Source Ticket Key

**File**: `.github/scripts/fetch-telemetry.sh`
**Location**: After line 35 (after TICKETS extraction)

```bash
# Extract source ticket key from BRANCH
# Pattern: AIB-138-add-telemetry-for -> AIB-138
SOURCE_KEY=$(echo "$BRANCH" | grep -oE '^[A-Z0-9]+-[0-9]+')

if [ -z "$SOURCE_KEY" ]; then
  echo "⚠️ Could not extract source ticket key from BRANCH: $BRANCH"
else
  echo "📌 Source ticket: $SOURCE_KEY"
fi
```

### Step 2: Add Source to Ticket List

**File**: `.github/scripts/fetch-telemetry.sh`
**Location**: After extracting SOURCE_KEY, before processing loop

```bash
# Add source ticket to list if not already present
if [ -n "$SOURCE_KEY" ]; then
  if ! echo "$TICKETS" | grep -qw "$SOURCE_KEY"; then
    TICKETS="$SOURCE_KEY $TICKETS"
    echo "📊 Added source ticket to telemetry list"
  else
    echo "📊 Source ticket already in compare list"
  fi
fi
```

### Step 3: Add sourceTicket Metadata

**File**: `.github/scripts/fetch-telemetry.sh`
**Location**: Modify line 45 (TELEMETRY_JSON initialization)

**Before**:
```bash
TELEMETRY_JSON=$(jq -n --arg ts "$(date -u +%Y-%m-%dT%H:%M:%SZ)" '{generatedAt: $ts, tickets: {}}')
```

**After**:
```bash
TELEMETRY_JSON=$(jq -n \
  --arg ts "$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
  --arg src "${SOURCE_KEY:-}" \
  '{generatedAt: $ts, sourceTicket: $src, tickets: {}}')
```

### Step 4: Update Test File

**File**: `tests/unit/telemetry/context-file-schema.test.ts`

Add interface extension and new tests:

```typescript
// Update TelemetryContextFile interface
interface TelemetryContextFile {
  generatedAt: string;
  sourceTicket: string;  // NEW
  tickets: Record<string, TicketTelemetry>;
}

// Add new test
it('should validate sourceTicket field', () => {
  const context: TelemetryContextFile = {
    generatedAt: new Date().toISOString(),
    sourceTicket: 'AIB-138',
    tickets: {
      'AIB-138': { /* source telemetry */ },
      'AIB-124': { /* compared telemetry */ },
    },
  };

  expect(context.sourceTicket).toBe('AIB-138');
  expect(context.tickets[context.sourceTicket]).toBeDefined();
});
```

## Verification

Run tests after implementation:

```bash
bun run test:unit tests/unit/telemetry/context-file-schema.test.ts
```

## Expected Output

After running a `/compare` command, the `.telemetry-context.json` file should include:

```json
{
  "generatedAt": "2026-01-04T12:00:00.000Z",
  "sourceTicket": "AIB-138",
  "tickets": {
    "AIB-138": { "ticketKey": "AIB-138", ... },
    "AIB-124": { "ticketKey": "AIB-124", ... }
  }
}
```
