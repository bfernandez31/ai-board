# Data Model: Testing Trophy Component Integration

**Date**: 2025-12-26
**Branch**: `AIB-117-testing-trophy-component`

## Overview

This document defines the key entities, interfaces, and structures for the component testing infrastructure. Unlike typical data models focused on database entities, this model defines test utilities, mock data structures, and component test patterns.

---

## Test Utility Entities

### 1. CustomRenderResult

The enhanced return type from `renderWithProviders` utility.

**Interface**:
```typescript
interface CustomRenderResult extends RenderResult {
  /** Fresh QueryClient instance for this test */
  queryClient: QueryClient;
  /** Pre-configured userEvent instance */
  user: ReturnType<typeof userEvent.setup>;
}
```

**Fields**:
| Field | Type | Description |
|-------|------|-------------|
| `queryClient` | `QueryClient` | Test-configured QueryClient with no retries, zero cache times |
| `user` | `UserEvent` | Configured userEvent instance for simulating user interactions |
| (inherited) | `RenderResult` | All standard RTL render result properties (container, baseElement, debug, etc.) |

---

### 2. CustomRenderOptions

Configuration options for the `renderWithProviders` utility.

**Interface**:
```typescript
interface CustomRenderOptions extends Omit<RenderOptions, 'wrapper'> {
  /** Custom QueryClient (default: fresh createTestQueryClient()) */
  queryClient?: QueryClient;
  /** Custom router state if needed */
  initialSearchParams?: URLSearchParams;
}
```

**Fields**:
| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `queryClient` | `QueryClient?` | `createTestQueryClient()` | Override default QueryClient |
| `initialSearchParams` | `URLSearchParams?` | `undefined` | Set initial URL search params |

---

### 3. ComponentTestContext

Test context structure for component tests.

**Interface**:
```typescript
interface ComponentTestContext {
  /** Configured user event instance */
  user: ReturnType<typeof userEvent.setup>;
  /** QueryClient for cache inspection/manipulation */
  queryClient: QueryClient;
  /** Mock functions for API calls */
  mocks: {
    fetch: ReturnType<typeof vi.fn>;
    mutations: Record<string, ReturnType<typeof vi.fn>>;
  };
}
```

---

## Mock Data Entities

### 4. MockProjectMember

Mock project member for MentionInput testing.

**Interface**:
```typescript
interface MockProjectMember {
  id: number;
  userId: number;
  projectId: number;
  role: 'OWNER' | 'MEMBER';
  createdAt: Date;
  user: {
    id: number;
    email: string;
    name: string | null;
  };
}
```

**Sample Data**:
```typescript
const mockProjectMembers: MockProjectMember[] = [
  {
    id: 1,
    userId: 1,
    projectId: 1,
    role: 'OWNER',
    createdAt: new Date(),
    user: { id: 1, email: 'owner@test.com', name: 'Project Owner' },
  },
  {
    id: 2,
    userId: 2,
    projectId: 1,
    role: 'MEMBER',
    createdAt: new Date(),
    user: { id: 2, email: 'john@test.com', name: 'John Doe' },
  },
];
```

---

### 5. MockTicket

Mock ticket for TicketSearch testing.

**Interface**:
```typescript
interface MockTicket {
  id: number;
  ticketKey: string;
  title: string;
  description: string | null;
  stage: TicketStage;
  projectId: number;
  createdAt: Date;
  updatedAt: Date;
}
```

**Sample Data**:
```typescript
const mockTickets: MockTicket[] = [
  {
    id: 1,
    ticketKey: 'TEST-1',
    title: '[e2e] First test ticket',
    description: 'Description for first ticket',
    stage: 'INBOX',
    projectId: 1,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: 2,
    ticketKey: 'TEST-2',
    title: '[e2e] Second test ticket',
    description: 'Description for second ticket',
    stage: 'BUILD',
    projectId: 1,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
];
```

---

### 6. MockCreateTicketInput

Mock input for NewTicketModal testing.

**Interface**:
```typescript
interface MockCreateTicketInput {
  title: string;
  description: string;
  clarificationPolicy?: 'AUTO' | 'CONSERVATIVE' | 'PRAGMATIC';
  attachments?: File[];
}
```

**Validation Rules** (from Zod schema):
| Field | Rule | Error Message |
|-------|------|---------------|
| `title` | min: 3, max: 100 | "Title must be 3-100 characters" |
| `description` | max: 2500 | "Description must be less than 2500 characters" |
| `clarificationPolicy` | enum | N/A (optional with default) |

---

## Test State Entities

### 7. FormTestState

State structure for testing form components.

**Interface**:
```typescript
interface FormTestState {
  /** Current form field values */
  values: Record<string, string | boolean | null>;
  /** Field-specific validation errors */
  errors: Record<string, string | undefined>;
  /** Form submission status */
  isSubmitting: boolean;
  /** Form validity */
  isValid: boolean;
}
```

---

### 8. AutocompleteTestState

State structure for testing autocomplete components.

**Interface**:
```typescript
interface AutocompleteTestState {
  /** Whether dropdown is visible */
  isOpen: boolean;
  /** Current search/filter query */
  query: string;
  /** Currently highlighted option index */
  selectedIndex: number;
  /** Filtered options currently displayed */
  visibleOptions: string[];
}
```

---

### 9. SearchTestState

State structure for testing search with debounce.

**Interface**:
```typescript
interface SearchTestState {
  /** Raw input value */
  inputValue: string;
  /** Debounced search term sent to API */
  debouncedValue: string;
  /** Whether dropdown is showing */
  isOpen: boolean;
  /** Search results */
  results: MockTicket[];
  /** Loading state */
  isLoading: boolean;
}
```

---

## Component Props Summary

### NewTicketModal Props

```typescript
interface NewTicketModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onTicketCreated?: () => void;
  projectId: number;
}
```

### CommentForm Props

```typescript
interface CommentFormProps {
  projectId: number;
  ticketId: number;
  onAutocompleteOpenChange?: (isOpen: boolean) => void;
}
```

### TicketSearch Props

```typescript
interface TicketSearchProps {
  projectId: number;
}
```

### MentionInput Props

```typescript
interface MentionInputProps {
  value: string;
  onChange: (value: string) => void;
  projectMembers: ProjectMember[];
  ticketId?: number;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  onAutocompleteOpenChange?: (isOpen: boolean) => void;
}
```

---

## Test File Mapping

| Component | Test File | Primary Interactions |
|-----------|-----------|---------------------|
| NewTicketModal | `new-ticket-modal.test.tsx` | Form input, validation, submit |
| CommentForm | `comment-form.test.tsx` | Text input, Cmd+Enter, mutation |
| TicketSearch | `ticket-search.test.tsx` | Debounced input, arrow keys, Enter |
| MentionInput | `mention-input.test.tsx` | @ trigger, filtering, selection |

---

## Relationships

```
renderWithProviders
    │
    ├── Creates → QueryClient (test-configured)
    ├── Returns → UserEvent (configured)
    └── Wraps → Component under test

ComponentTestContext
    │
    ├── References → Mock fetch functions
    ├── References → Mock mutation functions
    └── Provides → QueryClient for cache inspection

MockProjectMember
    │
    └── Used by → MentionInput tests

MockTicket
    │
    └── Used by → TicketSearch tests

FormTestState
    │
    └── Tracked in → NewTicketModal tests, CommentForm tests
```

---

## Next Steps

1. Create `tests/helpers/render-with-providers.tsx` utility
2. Create mock data fixtures in `tests/fixtures/component-mocks.ts`
3. Implement test files for each component
