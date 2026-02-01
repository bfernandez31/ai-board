---
name: testing
description: "Use when writing, updating, or checking tests. Provides Testing Trophy patterns (unit/component/integration/E2E), decision trees for test type selection, and project conventions. Keywords: test, vitest, playwright, coverage."
---

# ai-board Testing Skill

Testing Trophy architecture for ai-board. This skill helps choose the right test type
and provides project-specific patterns.

## Decision Tree

Ask these questions IN ORDER:

```
1. Is it a pure function with no React/API dependencies?
   YES → Unit test (tests/unit/)

2. Is it a React component with simple props/state?
   YES → Component test (tests/unit/components/) - mock hooks

3. Is it a React component that calls APIs (non-critical flow)?
   YES → Frontend Integration (tests/integration/frontend/) - use MSW

4. Is it an API endpoint or database operation?
   YES → Backend Integration (tests/integration/[domain]/)

5. Does it REQUIRE a real browser?
   - OAuth/Auth redirects
   - Drag-and-drop (DnD Kit)
   - Keyboard navigation
   - Viewport/responsive behavior
   YES → E2E test (tests/e2e/)

6. Still unsure?
   → Default to Backend Integration (fastest feedback for full-stack)
```

## Test Types Overview

| Type | Location | Tool | Speed | Use For |
|------|----------|------|-------|---------|
| Unit | `tests/unit/` | Vitest | ~1ms | Pure functions, utils, validators |
| Component | `tests/unit/components/` | Vitest + RTL | ~10ms | UI rendering, mocked hooks |
| Frontend Integration | `tests/integration/frontend/` | Vitest + RTL + MSW | ~50ms | Component + Hook + API (mocked) |
| Backend Integration | `tests/integration/[domain]/` | Vitest + Prisma | ~50ms | API routes + real database |
| E2E | `tests/e2e/` | Playwright | ~5s | Browser-required ONLY |

## Commands

```bash
bun run test:unit         # Unit + Component tests
bun run test:integration  # Backend integration tests
bun run test:e2e          # Playwright browser tests
bun run test              # All tests
```

## Critical Rules

1. **ALWAYS search for existing tests** before creating new files
2. **Extend existing test files** rather than creating duplicates
3. **E2E is expensive** - only for browser-required features
4. **Mock hooks BEFORE import** in component tests
5. **Use worker isolation** in E2E (import from `tests/helpers/worker-isolation`)
6. **Project 3 is RESERVED** for development - E2E uses [1,2,4,5,6,7]

## Pattern Files

Detailed patterns for each test type:

- [Unit Tests](patterns/unit.md) - Pure functions
- [Component Tests](patterns/component.md) - React + RTL + mocked hooks
- [Frontend Integration](patterns/frontend-integration.md) - Component + MSW
- [Backend Integration](patterns/backend-integration.md) - API + Prisma
- [E2E Tests](patterns/e2e.md) - Playwright + worker isolation
