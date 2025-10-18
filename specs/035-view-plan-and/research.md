# Research Notes: View Plan and Tasks Documentation

**Feature**: 035-view-plan-and
**Date**: 2025-10-18
**Purpose**: Technical research and decision documentation for implementation planning

## Overview

This document captures research findings, technology decisions, and design patterns for adding plan.md and tasks.md viewing capabilities to the ticket detail modal.

## Research Questions & Findings

### 1. GitHub API Integration Patterns

**Question**: How should we extend the existing spec-fetcher to support multiple document types?

**Decision**: Create generic `fetchDocumentContent()` function that accepts document type parameter

**Rationale**:
- Existing `spec-fetcher.ts` hardcodes `specs/${branch}/spec.md` path
- plan.md and tasks.md are in same directory: `specs/${branch}/{spec|plan|tasks}.md`
- DRY principle: Avoid duplicating 90% of spec-fetcher logic for each doc type
- Type safety: Enum for document types ('spec' | 'plan' | 'tasks')

**Alternatives Considered**:
1. ~~Separate fetchers per document type~~ - Code duplication, harder to maintain
2. ~~Modify spec-fetcher to detect type from path~~ - Implicit behavior, less clear
3. **Generic fetcher with explicit type param** ✅ - Clear, reusable, type-safe

**Implementation Notes**:
```typescript
// lib/github/doc-fetcher.ts
export type DocumentType = 'spec' | 'plan' | 'tasks';

export async function fetchDocumentContent(params: {
  owner: string;
  repo: string;
  branch: string;
  docType: DocumentType;
}): Promise<string> {
  // Path: specs/${branch}/${docType}.md
  // Reuses Octokit setup from spec-fetcher
  // Supports TEST_MODE for E2E testing
}
```

---

### 2. Branch Selection Logic for Shipped Tickets

**Question**: How should the system determine whether to fetch from feature branch vs. main branch?

**Decision**: Check `ticket.stage === 'SHIP'` to determine branch selection

**Rationale**:
- SHIP stage represents final, deployed state
- Main branch contains merged, canonical documentation
- Feature branches contain work-in-progress documentation
- Spec requirement FR-004: "MUST fetch from main when stage is SHIP"

**Alternatives Considered**:
1. ~~Check if PR is merged~~ - Requires additional GitHub API call, rate limit concern
2. ~~Check if branch exists~~ - Branch may still exist after merge, unreliable
3. **Use ticket.stage enum** ✅ - Reliable, no external API calls, matches business logic

**Implementation Notes**:
```typescript
function getBranchForTicket(ticket: Ticket): string {
  // SHIP stage → main branch (canonical)
  // All other stages → feature branch (work-in-progress)
  return ticket.stage === 'SHIP' ? 'main' : ticket.branch;
}
```

**Edge Case Handling**:
- If `ticket.branch` is null for non-SHIP tickets → disable buttons, show "Branch not created" message
- If file not found on main branch for SHIP tickets → show "Documentation not yet merged" error

---

### 3. Button Visibility Conditions

**Question**: When should "View Plan" and "View Tasks" buttons be visible?

**Decision**: Multi-condition visibility based on workflowType, job status, and stage

**Rationale**:
- Quick-impl tickets (workflowType=QUICK) never have plan.md or tasks.md → hide buttons
- Plan button visible when: `workflowType=FULL AND hasCompletedPlanJob`
- Tasks button visible when: `workflowType=FULL AND hasCompletedPlanJob AND stage IN (BUILD, VERIFY, SHIP)`
- Spec requirement FR-001: Buttons visible "when PLAN stage job status is COMPLETED"

**Visibility Matrix**:

| Stage   | Workflow Type | Plan Job | View Spec | View Plan | View Tasks |
|---------|---------------|----------|-----------|-----------|------------|
| INBOX   | FULL          | N/A      | ❌        | ❌        | ❌         |
| SPECIFY | FULL          | N/A      | ✅        | ❌        | ❌         |
| PLAN    | FULL          | ✅ DONE  | ✅        | ✅        | ❌         |
| BUILD   | FULL          | ✅ DONE  | ✅        | ✅        | ✅         |
| VERIFY  | FULL          | ✅ DONE  | ✅        | ✅        | ✅         |
| SHIP    | FULL          | ✅ DONE  | ✅        | ✅        | ✅         |
| ANY     | QUICK         | N/A      | ✅        | ❌        | ❌         |

**Implementation Notes**:
```typescript
// In ticket-detail-modal.tsx
const hasCompletedPlanJob = useMemo(() => {
  if (!ticket?.branch || jobs.length === 0) return false;
  return jobs.some(job => job.command === 'plan' && job.status === 'COMPLETED');
}, [ticket?.branch, jobs]);

const showPlanButton = ticket?.workflowType === 'FULL' && hasCompletedPlanJob;
const showTasksButton = showPlanButton && ['BUILD', 'VERIFY', 'SHIP'].includes(ticket.stage);
```

---

### 4. Component Architecture Patterns

**Question**: Should we create a generic DocumentationViewer or duplicate SpecViewer for each doc type?

**Decision**: Create generic `DocumentationViewer` component with document type prop

**Rationale**:
- SpecViewer is 245 lines with 95% reusable logic (markdown rendering, error handling, loading states)
- Only difference: API endpoint path and modal title
- DRY principle: Single source of truth for documentation rendering
- Maintainability: Bug fixes apply to all doc types

**Alternatives Considered**:
1. ~~Duplicate SpecViewer for PlanViewer and TasksViewer~~ - Code duplication, maintenance burden
2. ~~Modify SpecViewer to detect type from URL~~ - Implicit behavior, less clear
3. **Generic component with explicit type prop** ✅ - Clear, maintainable, type-safe

**Implementation Notes**:
```typescript
// components/board/documentation-viewer.tsx
interface DocumentationViewerProps {
  ticketId: number;
  projectId: number;
  ticketTitle: string;
  docType: 'spec' | 'plan' | 'tasks';
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// API endpoint: /api/projects/${projectId}/tickets/${ticketId}/${docType}
// Modal title: "Specification" | "Implementation Plan" | "Task Breakdown"
```

**Migration Path**:
- Keep existing SpecViewer for backward compatibility
- New DocumentationViewer accepts docType='spec' for spec.md
- Future: Migrate SpecViewer usages to DocumentationViewer

---

### 5. API Endpoint Design

**Question**: Should we create separate endpoints or a single parameterized endpoint?

**Decision**: Separate endpoints per document type with shared implementation logic

**Rationale**:
- RESTful design: `/tickets/[id]/spec`, `/tickets/[id]/plan`, `/tickets/[id]/tasks`
- Type safety: Each endpoint validates its specific document type
- Flexibility: Different authorization rules per doc type (if needed in future)
- Clarity: Explicit intent in route structure

**Alternatives Considered**:
1. ~~Single endpoint with query param: `/tickets/[id]/docs?type=plan`~~ - Less RESTful, harder to cache
2. **Separate endpoints** ✅ - RESTful, cacheable, type-safe

**Implementation Notes**:
```typescript
// app/api/projects/[projectId]/tickets/[id]/plan/route.ts
export async function GET(request, context) {
  return getDocumentHandler(context, 'plan');
}

// app/api/projects/[projectId]/tickets/[id]/tasks/route.ts
export async function GET(request, context) {
  return getDocumentHandler(context, 'tasks');
}

// Shared handler in lib/api/document-handler.ts
async function getDocumentHandler(context, docType) {
  // Validates inputs, checks permissions, fetches from GitHub
  // Returns { content, metadata }
}
```

---

### 6. Error Handling Strategies

**Question**: How should the system handle file not found errors for different doc types?

**Decision**: User-friendly error messages specific to document type and stage

**Rationale**:
- Different documents are created at different workflow stages
- Users need context-specific guidance when files are missing
- Error messages should explain why file might not exist

**Error Message Matrix**:

| Doc Type | Stage     | Error Scenario        | Message                                                      |
|----------|-----------|----------------------|--------------------------------------------------------------|
| spec     | SPECIFY   | File not found       | "Specification not generated yet. Wait for specify job."     |
| plan     | PLAN      | File not found       | "Plan not generated yet. Wait for plan job."                 |
| tasks    | BUILD     | File not found       | "Tasks not generated yet. Wait for implementation to begin." |
| any      | SHIP      | Not found on main    | "Documentation not yet merged to main branch."               |
| any      | Any       | GitHub API failure   | "Failed to fetch documentation. Please try again."           |
| any      | Any       | Rate limit exceeded  | "GitHub API rate limit exceeded. Try again later."           |

**Implementation Notes**:
- Return 404 with specific error code: `FILE_NOT_FOUND`, `NOT_AVAILABLE_YET`, `NOT_MERGED`
- Frontend displays user-friendly message based on error code
- Log detailed error context for debugging

---

### 7. Performance Optimization

**Question**: How can we optimize multiple documentation file fetches without hitting rate limits?

**Decision**: Client-side caching with TanStack Query + conditional fetching

**Rationale**:
- TanStack Query provides automatic caching and stale-while-revalidate
- Only fetch when modal is open (lazy loading)
- Cache duration: 5 minutes (documentation rarely changes within single session)
- Conditional fetching: Don't fetch if button is not visible

**Alternatives Considered**:
1. ~~Server-side caching in Redis~~ - Added complexity, not needed for read-heavy workload
2. ~~Prefetch all docs on ticket detail open~~ - Wastes API calls for docs user may not view
3. **Client-side caching + lazy loading** ✅ - Simple, effective, respects GitHub rate limits

**Implementation Notes**:
```typescript
// lib/hooks/use-documentation.ts
export function useDocumentation(projectId: number, ticketId: number, docType: DocumentType) {
  return useQuery({
    queryKey: ['documentation', projectId, ticketId, docType],
    queryFn: () => fetchDocumentation(projectId, ticketId, docType),
    staleTime: 5 * 60 * 1000, // 5 minutes
    enabled: false, // Lazy: only fetch when modal opens
  });
}
```

---

### 8. Responsive Design Considerations

**Question**: How should documentation buttons be displayed on mobile screens?

**Decision**: Horizontal button group with responsive wrapping

**Rationale**:
- Desktop: 3 buttons side-by-side with adequate spacing (View Spec | View Plan | View Tasks)
- Mobile: Buttons wrap to 2 rows if needed (Spec + Plan on row 1, Tasks on row 2)
- Touch targets: Minimum 44x44px for accessibility
- Consistent with existing SpecViewer button patterns

**Implementation Notes**:
```typescript
// ticket-detail-modal.tsx
<div className="flex flex-wrap gap-2 mt-4">
  {hasCompletedSpecifyJob && (
    <Button variant="outline" onClick={() => setSpecViewerOpen(true)}>
      <FileText className="mr-2 h-4 w-4" />
      View Spec
    </Button>
  )}
  {showPlanButton && (
    <Button variant="outline" onClick={() => setDocViewerType('plan')}>
      <Settings2 className="mr-2 h-4 w-4" />
      View Plan
    </Button>
  )}
  {showTasksButton && (
    <Button variant="outline" onClick={() => setDocViewerType('tasks')}>
      <CheckSquare className="mr-2 h-4 w-4" />
      View Tasks
    </Button>
  )}
</div>
```

---

## Technology Stack Validation

| Technology          | Current Version | Required Version | Status | Notes                                    |
|---------------------|----------------|------------------|--------|------------------------------------------|
| TypeScript          | 5.6            | 5.6              | ✅     | Strict mode enabled                      |
| Next.js             | 15             | 15               | ✅     | App Router, Server Components            |
| React               | 18             | 18               | ✅     | Hooks, Client Components                 |
| Prisma              | 6.x            | 6.x              | ✅     | Ticket, Job, Project models              |
| @octokit/rest       | 22.0           | 22.0             | ✅     | GitHub API client                        |
| shadcn/ui           | Latest         | Latest           | ✅     | Button, Dialog, ScrollArea               |
| react-markdown      | 9.0.1          | 9.0.1            | ✅     | Markdown rendering                       |
| react-syntax-highlighter | 15.5.0    | 15.5.0           | ✅     | Code syntax highlighting                 |
| TanStack Query      | 5.90.5         | 5.90.5           | ✅     | Server state management                  |
| Playwright          | Latest         | Latest           | ✅     | E2E testing                              |

**All dependencies validated** ✅ - No additional packages required

---

## Best Practices Applied

### 1. Code Reusability
- Generic `fetchDocumentContent()` reduces duplication
- Generic `DocumentationViewer` component serves 3 doc types
- Shared API handler logic for plan/tasks endpoints

### 2. Type Safety
- Explicit `DocumentType` enum prevents typos
- TypeScript interfaces for all API request/response shapes
- Zod schemas validate runtime inputs

### 3. Performance
- TanStack Query caching prevents redundant API calls
- Lazy loading: Only fetch when modal opens
- Optimized queries: Include job filtering in single DB query

### 4. User Experience
- Context-specific error messages
- Loading states with spinner
- Responsive button layout for mobile
- Consistent styling with existing SpecViewer

### 5. Maintainability
- DRY principle: Single source of truth for documentation rendering
- RESTful API design for clarity
- Comprehensive error logging for debugging

---

## Risk Assessment

| Risk                              | Likelihood | Impact | Mitigation                                                  |
|-----------------------------------|------------|--------|-------------------------------------------------------------|
| GitHub API rate limits            | Medium     | High   | TanStack Query caching, lazy loading, 5-min stale time      |
| Large documentation files (>1MB)  | Low        | Medium | File size warnings, scroll area for large content           |
| Branch selection logic bugs       | Low        | High   | Comprehensive E2E tests for SHIP vs active tickets          |
| Job status race conditions        | Low        | Low    | Poll job status same as existing spec button implementation |
| Documentation not found on main   | Medium     | Low    | User-friendly error: "Not yet merged to main branch"        |

**Overall Risk Level**: Low - Leverages proven patterns from existing SpecViewer implementation

---

## Implementation Phases

### Phase 1: Backend Infrastructure
1. Create generic `doc-fetcher.ts` with `fetchDocumentContent()`
2. Create plan and tasks API endpoints
3. Update spec endpoint to support branch selection logic
4. Add Zod validation schemas for document types

### Phase 2: Frontend Components
1. Create `DocumentationViewer` component
2. Update `TicketDetailModal` with plan/tasks buttons
3. Implement button visibility logic
4. Add TanStack Query hook for documentation fetching

### Phase 3: Testing & Validation
1. Write E2E tests for button visibility conditions
2. Write E2E tests for branch selection logic
3. Write contract tests for plan/tasks API endpoints
4. Test error scenarios (file not found, API failures)

---

## Decision Log

| Decision | Made By | Date | Rationale |
|----------|---------|------|-----------|
| Generic fetcher instead of separate fetchers | Research Phase | 2025-10-18 | Reduce code duplication, easier maintenance |
| Separate API endpoints instead of query param | Research Phase | 2025-10-18 | RESTful design, better caching, type safety |
| Generic DocumentationViewer component | Research Phase | 2025-10-18 | DRY principle, single source of truth |
| Check ticket.stage for branch selection | Research Phase | 2025-10-18 | Reliable, no external API calls needed |
| TanStack Query for caching | Research Phase | 2025-10-18 | Avoid GitHub rate limits, improve UX |

---

## References

- Existing implementation: `components/board/spec-viewer.tsx`
- Existing API: `app/api/projects/[projectId]/tickets/[id]/spec/route.ts`
- Existing GitHub integration: `lib/github/spec-fetcher.ts`
- Feature spec: `specs/035-view-plan-and/spec.md`
- Constitution: `.specify/memory/constitution.md`
