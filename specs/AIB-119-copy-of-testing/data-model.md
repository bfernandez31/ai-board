# Data Model: RTL Component Testing Helpers

**Feature**: AIB-119-copy-of-testing
**Date**: 2025-12-27
**Status**: Complete

## Overview

This document defines the entities and interfaces for RTL component testing infrastructure. These are test-time utilities, not runtime data models.

---

## 1. Test Wrapper Entity

**Purpose**: Provide React context providers for component tests.

### Interface: TestWrapperProps

```typescript
interface TestWrapperProps {
  /** React children to wrap */
  children: ReactNode;
  /** Optional pre-configured QueryClient (for testing specific cache states) */
  queryClient?: QueryClient;
}
```

### Usage Context

- Wraps components requiring TanStack Query context
- Creates isolated QueryClient per test to prevent cache pollution
- Configures QueryClient with test-appropriate settings (no retries, no GC)

---

## 2. Mock Data Factory Entities

### Entity: MockTicket

**Purpose**: Type-safe factory for Ticket test data.

```typescript
interface MockTicketOptions {
  id?: number;
  ticketKey?: string;
  title?: string;
  description?: string | null;
  stage?: Stage;
  branch?: string | null;
  workflowType?: WorkflowType;
  previewUrl?: string | null;
  projectId?: number;
  version?: number;
  jobs?: Job[];
}
```

**Field Constraints**:
| Field | Type | Default | Validation |
|-------|------|---------|------------|
| id | number | 1 | Positive integer |
| ticketKey | string | 'ABC-1' | Format: `{PROJECT_KEY}-{NUMBER}` |
| title | string | 'Test Ticket' | Non-empty, max 200 chars |
| stage | Stage | 'INBOX' | Valid stage enum value |
| workflowType | WorkflowType | 'FULL' | FULL, QUICK, or CLEAN |

### Entity: MockProject

**Purpose**: Type-safe factory for Project test data.

```typescript
interface MockProjectOptions {
  id?: number;
  key?: string;
  name?: string;
  githubOwner?: string;
  githubRepo?: string;
  deploymentUrl?: string | null;
  clarificationPolicy?: ClarificationPolicy;
  userId?: string;
  ticketCount?: number;
  lastShippedTicket?: MockTicketOptions | null;
}
```

**Field Constraints**:
| Field | Type | Default | Validation |
|-------|------|---------|------------|
| id | number | 1 | Positive integer |
| key | string | 'ABC' | 3 uppercase letters |
| name | string | 'Test Project' | Non-empty |
| clarificationPolicy | ClarificationPolicy | 'AUTO' | AUTO, CONSERVATIVE, PRAGMATIC, INTERACTIVE |

### Entity: MockJob

**Purpose**: Type-safe factory for Job test data.

```typescript
interface MockJobOptions {
  id?: number;
  ticketId?: number;
  command?: JobCommand;
  status?: JobStatus;
  workflowRunId?: number | null;
  workflowToken?: string | null;
  completedAt?: Date | null;
}
```

**Field Constraints**:
| Field | Type | Default | Validation |
|-------|------|---------|------------|
| id | number | 1 | Positive integer |
| status | JobStatus | 'COMPLETED' | PENDING, RUNNING, COMPLETED, FAILED, CANCELLED |
| command | JobCommand | 'specify' | Valid command enum |

### Entity: MockComment

**Purpose**: Type-safe factory for Comment test data.

```typescript
interface MockCommentOptions {
  id?: number;
  ticketId?: number;
  content?: string;
  authorId?: string;
  createdAt?: Date;
  author?: MockUserOptions;
}
```

### Entity: MockUser

**Purpose**: Type-safe factory for User test data.

```typescript
interface MockUserOptions {
  id?: string;
  name?: string | null;
  email?: string;
  image?: string | null;
}
```

---

## 3. Render Helper Entity

### Interface: RenderWithProvidersResult

```typescript
interface RenderWithProvidersResult extends RenderResult {
  /** Access to QueryClient for cache inspection/manipulation */
  queryClient: QueryClient;
  /** Re-render with same providers */
  rerender: (ui: React.ReactElement) => void;
}
```

### Interface: RenderWithProvidersOptions

```typescript
interface RenderWithProvidersOptions {
  /** Pre-configured QueryClient */
  queryClient?: QueryClient;
  /** Initial route for Next.js navigation mock */
  route?: string;
  /** Initial search params */
  searchParams?: Record<string, string>;
}
```

---

## 4. Next.js Mock Entity

### Interface: MockRouter

**Purpose**: Mock for Next.js useRouter hook.

```typescript
interface MockRouter {
  push: MockFunction<[string], Promise<boolean>>;
  replace: MockFunction<[string], Promise<boolean>>;
  prefetch: MockFunction<[string], Promise<void>>;
  back: MockFunction<[], void>;
  forward: MockFunction<[], void>;
}
```

### State Transitions

None - these are static mocks without state machine behavior.

---

## 5. Entity Relationships

```
TestWrapper
├── provides: QueryClientProvider
│   └── contains: QueryClient (isolated per test)
└── wraps: Component Under Test

MockFactories (independent)
├── createMockTicket() → Ticket
├── createMockProject() → Project (may include MockTicket)
├── createMockJob() → Job
├── createMockComment() → Comment (includes MockUser)
└── createMockUser() → User

RenderWithProviders
├── uses: TestWrapper
├── uses: MockRouter (if navigation needed)
└── returns: RenderWithProvidersResult
```

---

## 6. File Structure

```
tests/unit/components/
├── helpers/
│   ├── test-wrapper.tsx      # TestWrapper component
│   ├── render-helpers.ts     # renderWithProviders function
│   ├── factories.ts          # Mock data factories
│   └── next-mocks.ts         # Next.js navigation mocks
├── board/
│   └── ticket-card.test.tsx
├── comments/
│   └── comment-form.test.tsx
└── projects/
    └── project-card.test.tsx
```
