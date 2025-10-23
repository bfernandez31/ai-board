# Research: Dual Job Display

**Feature**: 046-dual-job-display
**Date**: 2025-10-23
**Status**: Complete

## Research Questions

This document consolidates research findings for technical decisions required to implement the dual job display feature.

## 1. Job Filtering Strategy

**Decision**: Implement two separate utility functions for workflow and AI-BOARD job filtering

**Rationale**:
- Spec requirements FR-003 and FR-004 specify distinct filtering logic (command NOT LIKE vs. LIKE 'comment-%')
- Separation of concerns: workflow jobs have no visibility constraints, AI-BOARD jobs require stage matching
- Enables independent testing and reusability
- TypeScript type safety with explicit WorkflowJob and AIBoardJob types

**Alternatives Considered**:
- Single unified filter function with conditional logic
  - Rejected: Mixes two distinct business rules, harder to test independently
- Array filter methods in components
  - Rejected: Violates DRY principle, duplicates logic across components

**Implementation Pattern**:
```typescript
// lib/utils/job-filtering.ts
export function getWorkflowJob(jobs: Job[]): Job | null {
  return jobs
    .filter(job => !job.command.startsWith('comment-'))
    .sort((a, b) => b.startedAt.getTime() - a.startedAt.getTime())[0] || null;
}

export function getAIBoardJob(jobs: Job[], currentStage: Stage): Job | null {
  return jobs
    .filter(job => job.command.startsWith('comment-'))
    .filter(job => matchesStage(job.command, currentStage))
    .sort((a, b) => b.startedAt.getTime() - a.startedAt.getTime())[0] || null;
}
```

**Best Practices**:
- Return `null` for no match (consistent with existing `getTicketJob` pattern in board.tsx:156)
- Sort by `startedAt DESC` to get most recent job (matches spec requirement "ORDER BY startedAt DESC LIMIT 1")
- Use TypeScript strict null checks to enforce null handling at call sites

## 2. Contextual Label Transformation

**Decision**: Create status label transformer with command-to-label mapping

**Rationale**:
- Spec requirement FR-005 defines explicit label mappings (specify/plan → WRITING, implement/quick-impl → CODING, comment-* → ASSISTING)
- RUNNING status requires transformation; other statuses (PENDING, COMPLETED, FAILED, CANCELLED) pass through unchanged
- Centralized mapping enables easy maintenance and testing
- Type-safe implementation with JobStatus enum and literal union types

**Alternatives Considered**:
- Inline transformation in component render logic
  - Rejected: Duplicates logic, harder to test, violates single responsibility
- Component-level configuration object
  - Rejected: Transformation is pure business logic, not UI concern

**Implementation Pattern**:
```typescript
// lib/utils/job-label-transformer.ts
type ContextualLabel = 'WRITING' | 'CODING' | 'ASSISTING';

export function getContextualLabel(
  command: string,
  status: JobStatus
): JobStatus | ContextualLabel {
  if (status !== 'RUNNING') {
    return status; // Pass through non-RUNNING statuses
  }

  if (command === 'specify' || command === 'plan') {
    return 'WRITING';
  }
  if (command === 'implement' || command === 'quick-impl') {
    return 'CODING';
  }
  if (command.startsWith('comment-')) {
    return 'ASSISTING';
  }

  return status; // Unknown commands keep original status
}
```

**Best Practices**:
- Use discriminated unions for type safety (JobStatus | ContextualLabel)
- Guard clause pattern for early return on non-RUNNING statuses
- Fallback to original status for unknown commands (edge case handling from spec)
- Pure function with no side effects (enables memoization if needed)

## 3. Stage Matching for AI-BOARD Jobs

**Decision**: Extract stage from command suffix and compare with current ticket stage

**Rationale**:
- Spec requirement FR-009 defines strict stage matching (e.g., "comment-specify" → SPECIFY only)
- Command structure is predictable: "comment-{stage-lowercase}"
- Case-insensitive comparison handles potential inconsistencies
- Explicit mapping to Stage enum ensures type safety

**Alternatives Considered**:
- String suffix matching without validation
  - Rejected: No validation of stage values, error-prone
- Regex-based extraction
  - Rejected: Overcomplicated for simple prefix removal

**Implementation Pattern**:
```typescript
// lib/utils/stage-matcher.ts
export function matchesStage(command: string, currentStage: Stage): boolean {
  if (!command.startsWith('comment-')) {
    return false; // Not an AI-BOARD job
  }

  const stageSuffix = command.replace('comment-', '').toUpperCase();
  return stageSuffix === currentStage;
}
```

**Best Practices**:
- Return false for non-comment commands (defensive programming)
- Case-insensitive comparison (toUpperCase) to handle edge cases
- Stage enum comparison ensures compile-time safety
- Simple implementation reduces cognitive load

## 4. Component Props Design

**Decision**: Update TicketCard to accept two optional job props (workflowJob and aiBoardJob)

**Rationale**:
- Separation of concerns: Board component handles fetching/filtering, TicketCard handles display
- Explicit props make dependencies clear and testable
- Backwards compatible with existing single-job pattern
- Enables independent rendering logic for each job type

**Alternatives Considered**:
- Single `jobs` array prop with filtering in TicketCard
  - Rejected: Mixes data fetching logic with presentation, harder to test
- Context-based job provision
  - Rejected: Overcomplicated for simple prop drilling, makes data flow implicit

**Implementation Pattern**:
```typescript
// components/board/ticket-card.tsx
interface DraggableTicketCardProps {
  ticket: TicketWithVersion;
  workflowJob?: Job | null;
  aiBoardJob?: Job | null;
  isDraggable?: boolean;
  onTicketClick?: (ticket: TicketWithVersion) => void;
}
```

**Best Practices**:
- Optional props with null union type (workflowJob?: Job | null)
- Maintains existing prop interface backwards compatibility
- Clear naming convention distinguishes job types
- Component decides display order and layout of dual jobs

## 5. Real-Time Update Strategy

**Decision**: Extend existing polling mechanism to fetch both job types

**Rationale**:
- Spec requirement FR-012 mandates real-time updates via existing polling
- Current polling fetches jobs by ticketId, returns full Job objects
- No API changes needed - filtering happens client-side
- 2-second polling interval already meets <2s update requirement from SC-005

**Alternatives Considered**:
- Add separate polling endpoint for dual jobs
  - Rejected: Unnecessary API duplication, adds latency
- WebSocket-based real-time updates
  - Rejected: Vercel serverless limitations (per existing documentation in CLAUDE.md)

**Implementation Pattern**:
```typescript
// components/board/board.tsx (existing getTicketJob function update)
const getTicketJobs = useCallback(
  (ticketId: number): { workflow: Job | null; aiBoard: Job | null } => {
    const allJobs = polledJobs.filter(job => job.ticketId === ticketId);
    const ticket = allTickets.find(t => t.id === ticketId);

    return {
      workflow: getWorkflowJob(allJobs),
      aiBoard: ticket ? getAIBoardJob(allJobs, ticket.stage) : null,
    };
  },
  [polledJobs, allTickets]
);
```

**Best Practices**:
- Reuse existing polling hook (useJobPolling)
- Client-side filtering preserves API efficiency
- useMemo/useCallback for performance optimization
- Structured return object (not array) for clarity

## 6. Error State Display

**Decision**: Preserve existing JobStatusIndicator error display behavior for both job types

**Rationale**:
- Spec requirement FR-011 mandates prominent error display
- Existing JobStatusIndicator already handles FAILED/CANCELLED with red colors and XCircle/Ban icons
- No changes needed - component already meets spec requirements
- Both jobs display independently, ensuring no masking

**Alternatives Considered**:
- Custom error styling for dual jobs
  - Rejected: Existing error display is already prominent and accessible

**Best Practices**:
- Reuse existing error UI components (no duplication)
- Ensure both job indicators visible simultaneously (FR-008)
- Vertical stacking or horizontal layout for dual error states (design decision in Phase 1)

## 7. Performance Optimization

**Decision**: Use existing memoization patterns and minimal re-renders

**Rationale**:
- Current board uses React.memo on TicketCard (line 22 of ticket-card.tsx)
- Job filtering is O(n) where n = jobs per ticket (typically 1-3)
- Polling already optimized with 2-second intervals
- No additional optimization needed for <100ms requirement

**Alternatives Considered**:
- Virtualization for large ticket lists
  - Not needed: Typical boards have <100 tickets
- IndexedDB caching
  - Rejected: Polling provides sufficient freshness

**Best Practices**:
- Maintain React.memo on TicketCard
- Use useCallback for job filtering functions
- Avoid unnecessary component re-renders via proper dependency arrays

## 8. Testing Strategy (Hybrid: Vitest + Playwright)

**Decision**: Use Vitest for unit tests, Playwright for integration and E2E tests

**Rationale**:
- Utility functions are pure (no side effects) - perfect for fast unit tests
- Vitest provides instant feedback during development (~1ms per test vs. ~500ms with Playwright)
- Playwright still used for component integration and full user flows
- Hybrid approach reduces total test suite time by 60%+ (45 tests: ~9s vs. ~22s)
- Industry-standard testing pyramid: unit → integration → e2e

**Test Structure**:
```
tests/
├── unit/                              # Vitest (fast, isolated)
│   ├── job-filtering.test.ts          # ~10ms for 20 test cases
│   ├── job-label-transformer.test.ts  # ~5ms for 15 test cases
│   └── stage-matcher.test.ts          # ~5ms for 10 test cases
├── integration/tickets/               # Playwright (medium speed)
│   └── ticket-card-job-status.spec.ts # ~500ms for 6 scenarios
└── e2e/                               # Playwright (slow, comprehensive)
    └── dual-job-display.spec.ts       # ~2s for 3 critical flows
```

**Alternatives Considered**:
- Playwright only for all tests
  - Rejected: Too slow for unit testing pure functions (500ms vs. 1ms per test)
- Jest instead of Vitest
  - Rejected: Vitest has better TypeScript support and faster execution

**Implementation Patterns**:

```typescript
// tests/unit/job-filtering.test.ts (Vitest - fast unit tests)
import { describe, it, expect } from 'vitest';
import { getWorkflowJob, getAIBoardJob } from '@/lib/utils/job-filtering';

describe('getWorkflowJob', () => {
  it('returns null for empty array', () => {
    expect(getWorkflowJob([])).toBe(null);
  });

  it('filters out comment jobs', () => {
    const jobs = [
      { id: 1, command: 'specify', startedAt: new Date('2024-01-01') },
      { id: 2, command: 'comment-plan', startedAt: new Date('2024-01-02') }
    ];
    expect(getWorkflowJob(jobs)?.command).toBe('specify');
  });

  it('returns most recent workflow job', () => {
    const jobs = [
      { id: 1, command: 'specify', startedAt: new Date('2024-01-01') },
      { id: 2, command: 'plan', startedAt: new Date('2024-01-02') }
    ];
    expect(getWorkflowJob(jobs)?.id).toBe(2);
  });
});

// tests/e2e/dual-job-display.spec.ts (Playwright - full user flows)
test('displays workflow job with WRITING label', async ({ page }) => {
  // Setup: Create ticket with specify job
  // Navigate to board
  // Assert: Job indicator shows "WRITING"
});

// tests/integration/tickets/ticket-card-job-status.spec.ts (Playwright - component behavior)
test('filters AI-BOARD job by stage', async ({ page }) => {
  // Setup: Create ticket in PLAN stage with comment-specify job
  // Assert: AI-BOARD job indicator NOT visible (stage mismatch)
});
```

**Best Practices**:
- **Unit tests (Vitest)**: Pure utility functions, edge cases, error handling
- **Integration tests (Playwright)**: Component rendering, DOM verification, user interactions
- **E2E tests (Playwright)**: Critical user journeys, real-time updates, multi-step flows
- Run unit tests on every save (watch mode), integration/E2E tests pre-commit

**Setup Requirements**:
```bash
npm install -D vitest @vitest/ui
```

**Configuration** (`vitest.config.ts`):
```typescript
import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node', // Pure functions don't need jsdom
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './'),
    },
  },
});
```

**Performance Comparison**:
- **Playwright Only**: 45 tests × ~500ms = ~22.5 seconds
- **Hybrid Approach**: 45 unit tests (~45ms) + 6 integration tests (~3s) + 3 E2E tests (~6s) = **~9 seconds** (60% faster)

## Open Questions

None - all technical decisions resolved based on spec requirements and existing codebase patterns.

## References

- Spec: `specs/046-dual-job-display/spec.md`
- Existing Job polling: `lib/hooks/useJobPolling.ts`
- Current TicketCard: `components/board/ticket-card.tsx`
- Job filtering precedent: `components/board/board.tsx:155-185`
- Constitution: `.specify/memory/constitution.md`
