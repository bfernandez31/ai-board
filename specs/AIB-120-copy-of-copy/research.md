# Research: React Component Testing with Testing Library

**Branch**: `AIB-120-copy-of-copy` | **Date**: 2025-12-28

## Phase 0 Research Summary

All technical clarifications resolved. No unknowns remain.

---

## 1. RTL Testing Patterns for Vitest + happy-dom

### Decision: Use existing `renderHook` + `waitFor` pattern

**Rationale**: The codebase already has established patterns in `tests/unit/useJobPolling.test.ts` that work well with happy-dom environment.

**Key Patterns**:
- `renderHook()` for custom hook testing (primary pattern)
- `render()` for component rendering with DOM assertions
- `waitFor()` for async state changes with explicit timeout
- `act()` for synchronous state updates
- Fresh `QueryClient` per test with `retry: false` and `gcTime: 0`

**Alternatives Considered**:
- jsdom environment: Rejected - happy-dom is 4-10x faster and sufficient for behavior testing
- Testing Library's user-event library: Not needed initially - can use direct fireEvent for simple interactions

---

## 2. Component Test File Location

### Decision: Place component tests in `tests/unit/components/`

**Rationale**: Following constitution's Testing Trophy strategy where component behavior tests are unit tests (fast, ~1ms). Aligns with existing `tests/unit/` structure while organizing by type.

**File Pattern**: `tests/unit/components/[component-name].test.ts`

**Alternatives Considered**:
- Colocated tests (next to component): Rejected - constitution mandates `tests/unit/` location
- `tests/integration/components/`: Rejected - RTL tests are unit tests per spec decision

---

## 3. Provider Wrapping Strategy

### Decision: Use wrapper factory pattern from existing tests

**Rationale**: Consistent with `useJobPolling.test.ts` pattern. Provides clean API for provider setup.

**Pattern**:
```typescript
const createWrapper = (queryClient: QueryClient) =>
  ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: queryClient }, children);

const { result } = renderHook(() => useMyHook(), {
  wrapper: createWrapper(queryClient),
});
```

**Alternatives Considered**:
- Global test setup with providers: Rejected - makes tests less isolated
- Custom render function: Could add later if pattern becomes repetitive

---

## 4. Fetch Mocking Approach

### Decision: Use `global.fetch = vi.fn()` pattern

**Rationale**: Already established in codebase. Works reliably with happy-dom. Supports response sequence testing for polling scenarios.

**Pattern**:
```typescript
beforeEach(() => {
  global.fetch = vi.fn(() =>
    Promise.resolve({
      ok: true,
      json: async () => ({ data: [...] }),
    } as Response)
  );
});

afterEach(() => {
  vi.clearAllMocks();
});
```

**Alternatives Considered**:
- MSW (Mock Service Worker): Rejected - overkill for unit tests, better for integration tests
- vi.mock for modules: Rejected - global fetch mocking is simpler and more flexible

---

## 5. Component Testing Candidates

### Decision: Test 3 components with diverse interaction patterns

**Selected Components** (based on spec criteria):

1. **CommentForm** (`components/comments/comment-form.tsx`)
   - TanStack Query mutation hook
   - Keyboard shortcut handling (Cmd+Enter)
   - Character limit validation
   - Loading states, error handling

2. **NewTicketModal** (`components/board/new-ticket-modal.tsx`)
   - Complex form validation with Zod
   - Multiple form states (pristine, validating, submitting)
   - Error display and field-specific validation
   - Select dropdown interactions

3. **TicketSearch** (`components/search/ticket-search.tsx`)
   - Debounced input
   - Keyboard navigation (ArrowUp/Down, Enter, Escape)
   - TanStack Query integration
   - Dynamic dropdown visibility

**Rationale**: These 3 components cover:
- User interactions (forms, keyboard, dropdowns)
- TanStack Query integration (queries and mutations)
- Conditional rendering based on state
- Async operations with loading/error states

**Alternatives Considered**:
- ImageGallery: More complex, good for second iteration
- PolicyEditDialog: Similar patterns to NewTicketModal
- StageColumn: Heavy dnd-kit integration, better for E2E

---

## 6. Claude Skill Structure

### Decision: Create skill at `.claude/commands/component-testing.md`

**Rationale**: Follows existing skill conventions. Skills are in `.claude/commands/` not `.claude/skills/`.

**Skill Format**:
```yaml
---
description: "Generate RTL component tests following Testing Trophy patterns"
command: "/component-test"
category: "Testing & Quality"
allowed-tools: ["Read", "Glob", "Grep", "Write"]
---
```

**Trigger Keywords**:
- "component test", "RTL", "React testing", "testing library"

**Alternatives Considered**:
- Separate skill per component type: Rejected - single comprehensive skill is simpler
- Inline in CLAUDE.md: Rejected - skills provide better invocability

---

## 7. Documentation Updates

### Decision: Minimal updates to constitution.md and CLAUDE.md

**Constitution Updates**:
- Add RTL to Testing Trophy table under "Unit" layer
- Add component testing to Test Selection Decision Tree

**CLAUDE.md Updates**:
- Add component testing section to Testing Guidelines
- Reference the component-testing skill

**Rationale**: Constitution VI (AI-First Development) forbids tutorial-style documentation. Updates should be reference-style, not guides.

**Alternatives Considered**:
- Create separate RTL guide: Rejected - violates AI-First Development principle
- Extensive examples in constitution: Rejected - constitution is principles, not tutorials
