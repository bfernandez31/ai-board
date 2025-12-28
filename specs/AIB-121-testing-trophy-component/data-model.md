# Data Model: RTL Component Testing

**Feature**: Testing Trophy Component Testing with React Testing Library
**Date**: 2025-12-28
**Status**: Complete

## Overview

This feature does not introduce database entities. It defines test infrastructure abstractions and documentation patterns.

## Key Abstractions

### 1. TestQueryClient

A pre-configured TanStack Query client for component tests.

| Property | Type | Description |
|----------|------|-------------|
| retry | `false` | Disable retries to prevent test timeouts |
| gcTime | `0` | Disable garbage collection for predictable tests |

**Usage**: Created fresh for each test to ensure isolation.

### 2. ComponentTestContext

The wrapper context for rendering components in tests.

| Provider | Purpose |
|----------|---------|
| QueryClientProvider | TanStack Query context for data fetching hooks |

**Note**: Additional providers (auth, theme) can be added as needed.

### 3. Test File Organization

| Location | Purpose | Example |
|----------|---------|---------|
| `tests/unit/components/` | RTL component tests | `new-ticket-modal.test.tsx` |
| `tests/utils/component-test-utils.tsx` | Shared test utilities | `renderWithProviders()` |

## Validation Rules

### Component Test Requirements

1. **Query Priority**: Use `getByRole` → `getByLabelText` → `getByText` → `getByTestId` (last resort)
2. **User Interaction**: Use `userEvent` over `fireEvent` for realistic simulations
3. **Behavior Focus**: Test user-visible behavior, not implementation details
4. **Provider Setup**: Always wrap components that use TanStack Query

### File Naming Convention

- Component tests: `{component-name}.test.tsx`
- Located in: `tests/unit/components/`
- Uses: Vitest + happy-dom + @testing-library/react

## State Transitions

N/A - This feature adds testing infrastructure, no runtime state machines.

## Relationships

```
tests/unit/components/*.test.tsx
    └── imports → tests/utils/component-test-utils.tsx
                      └── provides → renderWithProviders()
                      └── provides → createTestQueryClient()
                      └── re-exports → @testing-library/react
```

## Documentation Entities

### Constitution Updates

| Section | Change |
|---------|--------|
| Testing Trophy Table | Add "Component" layer with RTL |
| Test Selection Decision Tree | Add component test criteria |

### CLAUDE.md Updates

| Section | Change |
|---------|--------|
| Testing Guidelines | Add RTL component test type |
| Test Pattern Examples | Add RTL integration test pattern |
