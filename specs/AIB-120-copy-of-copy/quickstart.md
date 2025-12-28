# Quickstart: React Component Testing with Testing Library

**Branch**: `AIB-120-copy-of-copy` | **Date**: 2025-12-28

## Implementation Checklist

### Phase 1: Create Claude Skill
- [ ] Create `.claude/commands/component-testing.md`
- [ ] Add YAML frontmatter with description, command, category
- [ ] Document RTL patterns and provider wrapping
- [ ] Include example test structure
- [ ] Add trigger keywords in description

### Phase 2: Create Component Tests
- [ ] Create `tests/unit/components/` directory
- [ ] Implement `comment-form.test.ts`
  - Test keyboard shortcuts (Cmd+Enter)
  - Test character limit validation
  - Test loading and error states
- [ ] Implement `new-ticket-modal.test.ts`
  - Test form validation
  - Test field error display
  - Test submit handling
- [ ] Implement `ticket-search.test.ts`
  - Test keyboard navigation
  - Test debounced input
  - Test dropdown visibility

### Phase 3: Update Documentation
- [ ] Update `.specify/memory/constitution.md`
  - Add RTL to Testing Trophy table
  - Update Test Selection Decision Tree
- [ ] Update `CLAUDE.md`
  - Add component testing to Testing Guidelines
  - Reference component-testing skill

### Phase 4: Verification
- [ ] Run `bun run test:unit` - all tests pass
- [ ] Verify each component test < 100ms execution
- [ ] Verify `/component-test` skill is invocable
- [ ] Verify documentation is reference-style (not tutorial)

## Test Execution Commands

```bash
# Run all unit tests
bun run test:unit

# Run specific component test
bun run test:unit tests/unit/components/comment-form.test.ts

# Watch mode for development
bun run test:unit:watch
```

## Key File Paths

| File | Purpose |
|------|---------|
| `.claude/commands/component-testing.md` | Claude skill for RTL guidance |
| `tests/unit/components/*.test.ts` | Component test files |
| `.specify/memory/constitution.md` | Testing Trophy documentation |
| `CLAUDE.md` | Testing guidelines reference |
| `vitest.config.mts` | Test configuration (happy-dom) |

## Success Criteria Reference

- SC-001: 3+ component tests passing
- SC-002: Skill invocable and provides guidance
- SC-003: Constitution and CLAUDE.md updated
- SC-004: Each test < 100ms
- SC-005: No regressions in existing tests
