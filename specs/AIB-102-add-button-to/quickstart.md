# Quickstart: Add Button to Consult Summary

**Feature Branch**: `AIB-102-add-button-to`
**Estimated Complexity**: Low (extends existing patterns)

## Prerequisites

- Node.js 22.20.0
- Bun package manager
- Local PostgreSQL database running
- Environment variables configured

## Development Setup

```bash
# Clone and checkout feature branch
git checkout AIB-102-add-button-to

# Install dependencies
bun install

# Start development server
bun run dev
```

## Implementation Order

### Step 1: Extend DocumentType Schema
**File**: `lib/validations/documentation.ts`

Add 'summary' to the DocumentTypeSchema enum:
```typescript
export const DocumentTypeSchema = z.enum(['spec', 'plan', 'tasks', 'summary']);
```

### Step 2: Add DocumentTypeLabel
**File**: `components/board/documentation-viewer.tsx`

Add 'summary' to DocumentTypeLabels:
```typescript
const DocumentTypeLabels: Record<DocumentType, string> = {
  spec: 'Specification',
  plan: 'Implementation Plan',
  tasks: 'Task Breakdown',
  summary: 'Implementation Summary',  // Add this
};
```

### Step 3: Create API Endpoint
**File**: `app/api/projects/[projectId]/tickets/[id]/summary/route.ts`

Copy from `spec/route.ts` and modify:
- Change job command filter from 'specify' to 'implement'
- Update error messages to reference 'Summary' instead of 'Specification'
- Update docType to 'summary'

### Step 4: Add Summary Button to Ticket Detail Modal
**File**: `components/board/ticket-detail-modal.tsx`

1. Add state for implement job check (similar to hasCompletedPlanJob)
2. Add visibility logic: `workflowType === 'FULL' && hasCompletedImplementJob`
3. Add Button component with FileOutput icon
4. Add 'summary' to docViewerType state options

### Step 5: Write Tests
**File**: `tests/e2e/summary-button.spec.ts`

Test scenarios:
- Summary button appears after implement job completes
- Summary button not visible for QUICK workflow
- Summary button opens DocumentationViewer
- Summary content displays correctly
- No edit button appears (read-only)

## Testing Commands

```bash
# Run unit tests
bun run test:unit

# Run E2E tests
bun run test:e2e

# Run specific test file
bun run test:e2e tests/e2e/summary-button.spec.ts

# Type check
bun run type-check
```

## Verification Checklist

- [ ] Summary button appears for FULL workflow tickets with completed implement job
- [ ] Summary button does NOT appear for QUICK workflow tickets
- [ ] Summary button does NOT appear before implement job completes
- [ ] Clicking Summary button opens DocumentationViewer modal
- [ ] Summary content displays correctly (markdown rendered)
- [ ] No Edit button appears (read-only enforcement)
- [ ] View History works for summary files
- [ ] Content fetches from main branch for SHIP stage tickets
- [ ] Error handling works (file not found, rate limit, etc.)
- [ ] TypeScript compiles without errors
- [ ] All existing tests still pass

## Key Files Reference

| Purpose | File |
|---------|------|
| Type definitions | `lib/validations/documentation.ts` |
| API endpoint | `app/api/projects/[projectId]/tickets/[id]/summary/route.ts` |
| Button rendering | `components/board/ticket-detail-modal.tsx` |
| Modal viewer | `components/board/documentation-viewer.tsx` |
| Permission guard | `components/ticket/edit-permission-guard.tsx` |
| Query hook | `lib/hooks/use-documentation.ts` |
| GitHub fetcher | `lib/github/doc-fetcher.ts` |
