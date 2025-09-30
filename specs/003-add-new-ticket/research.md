# Research: Ticket Creation Modal

**Feature**: 003-add-new-ticket
**Date**: 2025-09-30
**Status**: Complete

## Overview
This document consolidates research findings for implementing the ticket creation modal feature. All technical context has been clarified from the existing codebase analysis.

## Technology Decisions

### 1. Modal Component Library

**Decision**: Use shadcn/ui Dialog component

**Rationale**:
- Already using shadcn/ui in the project (see components.json, existing Button/Card/Badge components)
- Dialog component provides accessible modal foundation with proper ARIA attributes
- Radix UI primitives (shadcn/ui's foundation) handle focus management, escape key, click-outside automatically
- Composable API allows custom styling with TailwindCSS
- Constitutional requirement: "Use shadcn/ui components exclusively for UI primitives"

**Alternatives Considered**:
- Headless UI: Not chosen because shadcn/ui is already established
- Custom modal: Rejected per constitution - "never create UI primitives from scratch"
- react-modal: Not chosen because shadcn/ui provides better TypeScript + accessibility support

**Implementation Notes**:
- Need to install: `npx shadcn@latest add dialog input textarea label`
- Dialog components: DialogTrigger, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter
- Already have Button component from shadcn/ui

### 2. Form Validation

**Decision**: Zod 4.x for schema validation (both client and server)

**Rationale**:
- Already installed in package.json (`"zod": "^4.1.11"`)
- TypeScript-first validation with type inference
- Constitutional requirement: "Validate ALL user inputs before processing (use Zod schemas)"
- Single source of truth: same schema on client and server
- Real-time validation support for user feedback

**Alternatives Considered**:
- Yup: Not chosen because Zod is already in the project
- React Hook Form + built-in validation: Not chosen because Zod provides stronger type safety
- Manual validation: Rejected per constitution security requirements

**Implementation Notes**:
- Create `/lib/validations/ticket.ts` with Zod schema
- Schema rules: title (required, 1-100 chars, alphanumeric + basic punctuation), description (required, 1-1000 chars, same pattern)
- Pattern: `/^[a-zA-Z0-9\s.,?!\-]+$/` for alphanumeric + basic punctuation

### 3. Database Schema Changes

**Decision**: Prisma migration to update Ticket model

**Rationale**:
- Constitutional requirement: "All schema changes via prisma migrate dev"
- Current schema has `description String?` (nullable) - must change to required
- Current title is varchar(500) - must change to varchar(100)
- Description needs max length enforcement at DB level

**Alternatives Considered**:
- Manual SQL: Rejected per constitution - "Never manually alter production database schema"
- Only client validation: Rejected - defense in depth requires DB constraints

**Implementation Notes**:
```prisma
model Ticket {
  id          Int      @id @default(autoincrement())
  title       String   @db.VarChar(100)        // Change from 500 to 100
  description String   @db.VarChar(1000)       // Change from Text? to VarChar(1000)
  stage       Stage    @default(IDLE)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  @@index([stage])
  @@index([updatedAt])
}
```
- Run `npx prisma migrate dev --name make-description-required-and-limit-lengths`

### 4. API Validation

**Decision**: Update POST /api/tickets with Zod validation

**Rationale**:
- Existing endpoint at `/app/api/tickets/route.ts` needs validation updates
- Constitutional requirement: "Validate ALL user inputs before processing"
- Currently no validation - security vulnerability
- Return structured errors for client error handling

**Implementation Notes**:
- Import Zod schema from `/lib/validations/ticket.ts`
- Validate request body: `const result = ticketSchema.safeParse(await req.json())`
- Return 400 with Zod errors if validation fails
- Return 201 with created ticket if successful
- Add timeout handling (15 second limit per spec)

### 5. Client State Management

**Decision**: React useState for modal open/close and form state

**Rationale**:
- Constitutional requirement: "No state management libraries (Redux, MobX, etc.)—use React hooks only"
- Simple local state (modal open, form values, errors, loading state)
- No shared state needed beyond modal component
- Server state handled by React Server Components + fetch

**Alternatives Considered**:
- useReducer: Not needed - state logic is simple (open/close, field changes)
- Context API: Not needed - no shared state beyond modal component
- React Hook Form: Not needed for this simple form, adds unnecessary dependency

**Implementation Notes**:
- Modal open state: `const [open, setOpen] = useState(false)`
- Form fields: `const [title, setTitle] = useState("")` and `const [description, setDescription] = useState("")`
- Validation errors: `const [errors, setErrors] = useState<{ title?: string; description?: string }>({})`
- Loading state: `const [isSubmitting, setIsSubmitting] = useState(false)`

### 6. Testing Strategy

**Decision**: Playwright E2E test with MCP support

**Rationale**:
- Constitutional requirement: "Critical user flows require Playwright E2E tests before implementation"
- Constitutional requirement: "TDD - tests must fail initially (Red), then pass (Green)"
- Existing Playwright setup in project (playwright.config.ts, test script in package.json)
- MCP support for advanced testing scenarios

**Test Scenarios**:
1. Happy path: Open modal, fill valid data, submit, see new ticket
2. Validation: Empty fields disable Create button
3. Validation: Exceeding char limits shows error
4. Validation: Special characters show error
5. Error handling: Network failure shows user-friendly error
6. Cancel: Modal closes without creating ticket

**Implementation Notes**:
- Create `/tests/ticket-creation.spec.ts`
- Use data-testid attributes for reliable selectors
- Test must fail initially (no modal implementation yet)
- Run `npx playwright test` to verify Red state

### 7. Performance Considerations

**Decision**: Client Component with optimistic UI updates

**Rationale**:
- Modal requires interactivity → must be Client Component (`"use client"`)
- Constitutional requirement: "Server Components by default; Client Components only when interactivity requires it"
- Performance goals: Modal open <100ms, real-time validation
- Optimistic update: Add ticket to UI immediately, revalidate server state

**Implementation Notes**:
- Mark `new-ticket-modal.tsx` with `"use client"`
- Use React.startTransition for non-urgent state updates
- Use server action or client fetch for form submission
- Use Next.js revalidatePath or router.refresh after successful creation

## Open Questions & Resolutions

**Q1: Should we use React Hook Form?**
**Resolution**: No - constitutional preference for simple React hooks, no additional state management libraries. Form is simple enough (2 fields) that useState is sufficient.

**Q2: Should we use server actions or client fetch for form submission?**
**Resolution**: Client fetch - more explicit error handling for network failures, easier timeout implementation (15s requirement), existing pattern in codebase uses fetch.

**Q3: Should modal component be separate from button component?**
**Resolution**: Yes - separation of concerns. NewTicketButton manages trigger, NewTicketModal manages dialog content and form logic. Easier to test independently.

**Q4: How to handle database migration in development vs. production?**
**Resolution**: Follow constitutional workflow - `prisma migrate dev` locally, `prisma migrate deploy` in CI/CD (automated). Always run migrations before deploying code changes.

**Q5: Should we add form field character counter UI?**
**Resolution**: Not in spec requirements - focus on validation error messages only. Can be added in future enhancement if needed.

## Dependencies & Installation

**Already Installed**:
- Next.js 15, React 18, TypeScript 5.6
- Prisma 6.x, @prisma/client
- Zod 4.x
- TailwindCSS 3.4
- Playwright

**Need to Install** (shadcn/ui components):
```bash
npx shadcn@latest add dialog
npx shadcn@latest add input
npx shadcn@latest add textarea
npx shadcn@latest add label
```

**No New npm Dependencies Required** - all primitives available via shadcn/ui CLI

## Best Practices Applied

### TypeScript
- All component props explicitly typed
- No `any` types
- Zod schema infers types: `type TicketInput = z.infer<typeof ticketSchema>`
- API response types match Prisma models

### Security
- Input validation at all layers: client Zod, server Zod, database constraints
- No SQL injection risk (Prisma parameterized queries)
- No XSS risk (React auto-escapes, input pattern restricts special chars)
- Error messages don't expose internal details

### Accessibility
- shadcn/ui Dialog uses proper ARIA attributes
- Form labels associated with inputs
- Error messages announced to screen readers
- Keyboard navigation (Tab, Escape, Enter)

### Error Handling
- Try-catch blocks in API route
- Structured error responses: `{ error: string, code?: string }`
- User-friendly messages for network failures
- Timeout handling (15 second limit)
- Loading states prevent double-submission

## Implementation Checklist

- [x] All NEEDS CLARIFICATION items resolved
- [x] Technology decisions documented with rationale
- [x] Alternatives considered and rejected
- [x] Dependencies identified
- [x] Best practices aligned with constitution
- [x] No unknown or ambiguous technical requirements

## Next Steps

Ready for **Phase 1: Design & Contracts**
- Create data model documentation
- Generate API contracts (OpenAPI schema)
- Create contract tests
- Extract test scenarios for quickstart
- Update agent context file