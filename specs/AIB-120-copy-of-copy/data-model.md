# Data Model: React Component Testing with Testing Library

**Branch**: `AIB-120-copy-of-copy` | **Date**: 2025-12-28

## Overview

This feature adds testing infrastructure and documentation. No database schema changes required.

---

## Entities

### Test File Entity

**Location**: `tests/unit/components/[component-name].test.ts`

**Structure**:
```typescript
// Standard test file structure
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';

// Component under test
import { ComponentName } from '@/components/path/component-name';

describe('ComponentName', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false, gcTime: 0 },
      },
    });
    global.fetch = vi.fn();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  // Test cases
});
```

**Fields**:
| Field | Type | Description |
|-------|------|-------------|
| queryClient | QueryClient | Fresh instance per test, retry disabled |
| wrapper | ReactElement | QueryClientProvider wrapper for hooks |
| mockFetch | vi.Mock | Mocked global.fetch for API calls |

---

### Claude Skill Entity

**Location**: `.claude/commands/component-testing.md`

**Structure**:
```yaml
---
description: "Generate RTL component tests following Testing Trophy patterns"
command: "/component-test"
category: "Testing & Quality"
allowed-tools: ["Read", "Glob", "Grep", "Write"]
---

# Component Testing Skill

[Skill content with patterns, examples, and guidance]
```

**Fields**:
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| description | string | Yes | Brief skill description for discovery |
| command | string | No | Explicit command trigger |
| category | string | No | Grouping for UI |
| allowed-tools | string[] | No | Tool whitelist for safety |

---

## State Transitions

N/A - Testing infrastructure has no state machine.

---

## Validation Rules

### Test File Validation
- Must import from `@testing-library/react` (render, screen, waitFor, act)
- Must use `vi.fn()` for mocking, not jest.fn()
- Must create fresh QueryClient in beforeEach
- Must clear mocks in afterEach
- Must follow `ComponentName.test.ts` naming pattern

### Skill File Validation
- Must have YAML frontmatter with `description` field
- Must be in `.claude/commands/` directory
- Must use allowed-tools list if specified
