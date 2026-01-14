# Tests Context

## Use the Testing Skill

When writing, updating, or modifying tests, **always invoke the testing skill first**:

```
/testing
```

The skill provides:
- Decision tree for choosing test type
- Project-specific patterns and conventions
- Code templates for each test type

## Quick Reference

| Type | Location | When to Use |
|------|----------|-------------|
| Unit | `unit/` | Pure functions, utilities |
| Component | `unit/components/` | React UI with mocked hooks |
| Integration | `integration/` | API endpoints, database ops |
| E2E | `e2e/` | Browser-required ONLY (drag-drop, OAuth) |

## Critical Rules

1. **Search existing tests first** - extend, don't duplicate
2. **E2E is expensive** - prefer integration tests
3. **Projects 1-2** are test fixtures (auto-cleaned)
4. **Project 3+** are preserved - never delete in tests
5. **`[e2e]` prefix** required for all test data

## Commands

```bash
bun run test              # All tests
bun run test:unit         # Fast unit tests
bun run test:integration  # API + DB tests
bun run test:e2e          # Browser tests (slow)
```
