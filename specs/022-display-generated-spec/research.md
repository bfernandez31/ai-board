# Research: Display Generated Spec.md

**Feature**: 022-display-generated-spec
**Date**: 2025-10-11
**Phase**: Phase 0 - Research & Technical Decisions

## Technical Decisions

### 1. Markdown Rendering Library

**Decision**: Use `react-markdown` with `react-syntax-highlighter`

**Rationale**:
- `react-markdown` is the most popular React markdown renderer (8M+ weekly downloads)
- Supports CommonMark spec with plugin system for extensions
- Already used in similar features across Next.js ecosystem
- Works seamlessly with Server and Client Components
- `react-syntax-highlighter` provides syntax highlighting for code blocks
- Both libraries are well-maintained and TypeScript-friendly

**Alternatives Considered**:
- **marked + DOMPurify**: Lower-level approach requiring manual sanitization
- **remark-react**: More complex plugin architecture, steeper learning curve
- **MDX**: Overkill for display-only use case (spec.md files don't need JSX)

**Dependencies to Add**:
```json
{
  "react-markdown": "^9.0.1",
  "react-syntax-highlighter": "^15.5.0",
  "@types/react-syntax-highlighter": "^15.5.11"
}
```

### 2. GitHub API Integration Pattern

**Decision**: Use existing Octokit pattern from transition.ts with test mode detection

**Rationale**:
- Project already uses `@octokit/rest` (v22.0.0) for GitHub integration
- Existing pattern in `lib/workflows/transition.ts` provides proven test mode detection
- Consistent error handling and authentication approach
- No additional dependencies needed

**Implementation Pattern** (from transition.ts:129):
```typescript
const githubToken = process.env.GITHUB_TOKEN;
const isTestMode = !githubToken ||
                   githubToken.includes('test') ||
                   githubToken.includes('placeholder');

if (isTestMode) {
  // Return mock data
  return { content: '[Test Mode] Mock spec.md content' };
}

const octokit = new Octokit({ auth: githubToken });
const response = await octokit.repos.getContent({
  owner: project.githubOwner,
  repo: project.githubRepo,
  path: `specs/${ticket.branch}/spec.md`,
  ref: ticket.branch,
});

// Decode base64 content
const content = Buffer.from(response.data.content, 'base64').toString('utf-8');
```

**Alternatives Considered**:
- **Direct GitHub REST API**: More code, less type safety
- **GitHub GraphQL API**: Overkill for single file retrieval
- **Git CLI via child_process**: Unreliable in serverless environments

### 3. API Route Structure

**Decision**: Follow project's nested route pattern with project-scoped validation

**Route**: `GET /api/projects/[projectId]/tickets/[id]/spec`

**Rationale**:
- Consistent with existing API structure (see `app/api/projects/[projectId]/tickets/[id]/route.ts`)
- Project-scoped validation prevents cross-project data leaks
- RESTful design: resource hierarchy reflects data relationships
- Follows Next.js App Router conventions

**Validation Pattern** (from existing routes):
1. Parse and validate projectId (Zod schema)
2. Parse and validate ticketId (numeric check)
3. Verify project exists (404 if not found)
4. Verify ticket exists with project FK check (403 if wrong project, 404 if not exists)
5. Perform business logic (check for completed specify job)
6. Return data or appropriate error

**Error Codes**:
- 400: Invalid project/ticket ID format
- 403: Ticket belongs to different project
- 404: Project not found OR ticket not found OR spec file not found
- 500: GitHub API errors, unexpected server errors

### 4. Job Status Query Pattern

**Decision**: Query jobs via Prisma include pattern with filtering

**Rationale**:
- Existing schema already has Job relation on Ticket model
- Prisma provides type-safe query builder
- Can filter by command and status in single query
- Consistent with project's data access patterns

**Query Pattern**:
```typescript
const ticket = await prisma.ticket.findFirst({
  where: {
    id: ticketId,
    projectId: projectId,
  },
  include: {
    jobs: {
      where: {
        command: 'specify',
        status: 'COMPLETED',
      },
      orderBy: {
        completedAt: 'desc',
      },
      take: 1,
    },
    project: true, // For GitHub API params
  },
});

const hasCompletedSpecifyJob = ticket && ticket.jobs.length > 0;
```

**Alternatives Considered**:
- **Separate query for jobs**: N+1 query problem
- **Raw SQL**: Less type safety, harder to maintain
- **Count query**: Less efficient, requires second query

### 5. Frontend Component Architecture

**Decision**: New SpecViewer component with shadcn/ui Dialog primitive

**Components**:
- **SpecViewer** (`components/board/spec-viewer.tsx`): Modal dialog using shadcn/ui Dialog
- **TicketDetailModal** (existing): Add button when conditions met

**Rationale**:
- Project uses shadcn/ui exclusively for UI primitives (Constitution II)
- Existing Dialog component pattern in TicketDetailModal
- Separation of concerns: modal logic separate from ticket details
- Reusable if spec viewing needed elsewhere

**Component Structure**:
```
SpecViewer
├── Dialog (shadcn/ui)
│   ├── DialogContent (responsive, scrollable)
│   ├── DialogHeader (ticket ID + title)
│   └── DialogBody (markdown content)
├── ReactMarkdown (content renderer)
└── ReactSyntaxHighlighter (code blocks)
```

**Alternatives Considered**:
- **Embed in TicketDetailModal**: Violates single responsibility principle
- **Separate page route**: Unnecessary navigation, breaks UX flow
- **Drawer component**: Dialog is more appropriate for document viewing

### 6. Loading and Error State Management

**Decision**: Use React state hooks with toast notifications

**Rationale**:
- Project already uses `@radix-ui/react-toast` for notifications
- Consistent with existing error handling patterns
- Simple state management sufficient for single component
- No need for complex state management library (Constitution: React hooks only)

**State Management Pattern**:
```typescript
const [isLoading, setIsLoading] = useState(false);
const [error, setError] = useState<string | null>(null);
const [content, setContent] = useState<string | null>(null);

const handleViewSpec = async () => {
  setIsLoading(true);
  setError(null);

  try {
    const response = await fetch(`/api/projects/${projectId}/tickets/${ticketId}/spec`);
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to fetch specification');
    }
    const data = await response.json();
    setContent(data.content);
  } catch (err) {
    setError(err.message);
    toast({ variant: 'destructive', title: 'Error', description: err.message });
  } finally {
    setIsLoading(false);
  }
};
```

**Alternatives Considered**:
- **SWR/React Query**: Overkill for one-time fetch, adds dependency
- **Server Component**: Can't use for interactive modal dialog
- **Context API**: Unnecessary complexity for local state

### 7. Test Strategy

**Decision**: Playwright E2E tests with mocked GitHub API responses

**Test Scope**:
1. **Button Visibility Tests**: Verify button shows/hides based on ticket state
2. **Content Display Tests**: Verify markdown renders correctly
3. **Error Handling Tests**: Verify error messages display properly
4. **Loading State Tests**: Verify loading indicator appears
5. **Modal Interaction Tests**: Verify close button and ESC key work

**Mock Strategy**:
- Use Playwright's route interception to mock GitHub API
- Return actual spec.md content from test fixtures
- Test mode in API route bypasses real GitHub calls

**Test File Structure**:
```
tests/
├── e2e/
│   └── spec-viewer.spec.ts     # Main E2E tests
└── fixtures/
    └── mock-spec.md            # Sample spec content for tests
```

**Rationale**:
- Constitution III mandates TDD with Playwright for critical flows
- Mocking prevents external API dependencies in tests
- Test mode detection already exists in codebase
- E2E tests verify full user journey (button → modal → content)

**Alternatives Considered**:
- **Unit tests only**: Don't verify integration with GitHub API
- **Real GitHub API calls**: Flaky tests, requires test repository setup
- **Jest with React Testing Library**: Doesn't test full browser behavior

### 8. Performance Considerations

**Decision**: Client-side markdown rendering with lazy loading

**Rationale**:
- Markdown files are typically <100KB, acceptable for client-side rendering
- react-markdown is optimized for performance
- Modal dialog naturally implements code splitting via dynamic import
- No server-side rendering needed for on-demand content

**Optimization Strategies**:
- Lazy load SpecViewer component (Next.js dynamic import)
- Cache markdown content in component state (don't re-fetch)
- Use ScrollArea component for large specs (already available via shadcn/ui)

**Performance Metrics**:
- Time to Interactive: <200ms for modal open
- Markdown render time: <100ms for typical specs
- Bundle size impact: ~50KB (react-markdown + syntax highlighter)

**Alternatives Considered**:
- **Server-side markdown rendering**: Unnecessary complexity, modal is client component
- **Pre-render all specs**: Wasteful, most specs never viewed
- **Stream content**: Overkill for <100KB files

## Technology Stack Summary

**No Changes to Existing Stack**:
- TypeScript 5.6 (strict mode) ✓
- Next.js 15 (App Router) ✓
- React 18 ✓
- Prisma 6.x ✓
- PostgreSQL 14+ ✓
- shadcn/ui ✓
- Playwright ✓

**New Dependencies**:
- `react-markdown` ^9.0.1
- `react-syntax-highlighter` ^15.5.0
- `@types/react-syntax-highlighter` ^15.5.11 (dev)

**Existing Dependencies to Use**:
- `@octokit/rest` (already installed)
- `@radix-ui/react-dialog` (already installed via shadcn/ui)
- `@radix-ui/react-scroll-area` (already installed via shadcn/ui)
- `@radix-ui/react-toast` (already installed)
- `zod` (already installed for validation)

## Risks and Mitigations

### Risk 1: GitHub API Rate Limits
**Mitigation**:
- Test mode bypasses GitHub API
- Production usage expected to be low (users don't constantly view specs)
- Consider caching in future if needed

### Risk 2: Large Markdown Files (>1MB)
**Mitigation**:
- ScrollArea component handles large content
- react-markdown handles large files efficiently
- File size warning in documentation

### Risk 3: Markdown XSS Vulnerabilities
**Mitigation**:
- react-markdown sanitizes by default
- Spec files come from trusted source (our own GitHub repo)
- No user-generated markdown in this feature

### Risk 4: Test Mode Detection Bypass
**Mitigation**:
- Consistent pattern with existing code (transition.ts)
- Multiple detection methods (missing token, placeholder strings)
- E2E tests verify test mode behavior

## Implementation Priority

1. **Phase 1** (High Priority):
   - Install dependencies
   - Create API route with test mode support
   - Add button to TicketDetailModal
   - Create basic SpecViewer component

2. **Phase 2** (Medium Priority):
   - Add markdown rendering
   - Implement loading and error states
   - Style component for dark theme

3. **Phase 3** (Medium Priority):
   - Write E2E tests
   - Add syntax highlighting
   - Polish responsive design

4. **Phase 4** (Low Priority):
   - Performance optimization
   - Add caching if needed
   - Additional error handling edge cases

## Next Steps

Phase 0 research complete. Ready for Phase 1 (Design & Contracts):
1. Define API contract (request/response schemas)
2. Create data model documentation (no schema changes needed)
3. Write contract tests
4. Generate quickstart.md
5. Update CLAUDE.md

---
*Research complete. No NEEDS CLARIFICATION markers remain.*
