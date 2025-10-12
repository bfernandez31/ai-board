# Research: Display Project Specifications

**Feature**: 027-display-project-specifications
**Date**: 2025-10-12
**Status**: Complete

## Overview

Research findings for implementing project-level specification viewer. All technical decisions leverage existing codebase patterns from ticket specification viewer (feature 022).

## Technical Decisions

### 1. Markdown Rendering Library

**Decision**: Reuse react-markdown (^9.0.1) + react-syntax-highlighter (^15.5.0)

**Rationale**:
- Already installed and configured in the project
- Proven pattern from `components/board/spec-viewer.tsx` (lines 1-243)
- Supports code syntax highlighting with VS Code Dark+ theme
- Custom component mapping for consistent dark theme styling
- No additional dependencies needed

**Alternatives Considered**:
- `remark-react`: More low-level, requires more configuration
- `marked`: Requires separate syntax highlighter integration
- Native markdown-to-html: Would need custom sanitization and security measures

**Implementation Reference**: `components/board/spec-viewer.tsx`

---

### 2. GitHub API Integration Pattern

**Decision**: Extend existing `lib/github/spec-fetcher.ts` with new function

**Rationale**:
- Existing `fetchSpecContent()` function provides proven GitHub API integration
- Octokit REST client already configured with authentication
- Test mode detection already implemented for E2E testing
- Error handling patterns established (rate limits, not found, etc.)
- Base64 decoding logic reusable

**Implementation Approach**:
```typescript
// New function in lib/github/spec-fetcher.ts
export async function fetchProjectSpec(params: {
  owner: string;
  repo: string;
}): Promise<string> {
  // Fetch from /specs/specifications/README.md (no branch parameter)
  // Use main branch by default
}
```

**Alternatives Considered**:
- Direct Octokit calls in API route: Would duplicate auth and error handling
- New separate fetcher module: Unnecessary code duplication

**Implementation Reference**: `lib/github/spec-fetcher.ts` (lines 1-93)

---

### 3. Routing Structure

**Decision**: Follow existing Next.js App Router pattern

**Routes**:
- Page: `/projects/[projectId]/specifications` → `app/projects/[projectId]/specifications/page.tsx`
- API: `/api/projects/[projectId]/spec` → `app/api/projects/[projectId]/spec/route.ts`

**Rationale**:
- Matches existing `/projects/[projectId]/board` pattern
- Consistent URL structure for project-scoped resources
- Server Component for page (static rendering)
- API route for data fetching (mirrors ticket spec API pattern)

**Alternatives Considered**:
- Top-level `/specifications/[projectId]`: Breaks project-centric URL structure
- Query parameter `/specifications?project=id`: Non-RESTful, harder to bookmark

**Implementation Reference**:
- `app/projects/[projectId]/board/page.tsx` (routing pattern)
- `app/api/projects/[projectId]/tickets/[id]/spec/route.ts` (API pattern)

---

### 4. Component Architecture

**Decision**: Server Component for page, Client Component for markdown rendering

**Component Breakdown**:
- `app/projects/[projectId]/specifications/page.tsx` (Server Component)
  - Validates projectId
  - Fetches project data
  - Renders static page shell
- `components/specifications/spec-page-content.tsx` (Client Component)
  - Fetches spec content from API
  - Renders markdown with react-markdown
  - Handles loading and error states
- `components/board/board-header.tsx` (Client Component)
  - Displays project name
  - Shows document icon with click handler
  - Opens new tab to specifications page

**Rationale**:
- Server Components minimize client-side JavaScript (performance)
- Client Components only where interactivity required (icon click, API calls)
- Follows Next.js 15 App Router best practices
- Matches constitutional principle II (Component-Driven Architecture)

**Alternatives Considered**:
- Full Client Component tree: Unnecessary hydration overhead
- Server-side markdown rendering: Requires streaming, more complex error handling

**Implementation Reference**:
- `components/board/spec-viewer.tsx` (Client Component pattern)
- `app/projects/[projectId]/board/page.tsx` (Server Component pattern)

---

### 5. Error Handling Strategy

**Decision**: Graceful degradation with user-friendly messages

**Error Scenarios**:
1. **Invalid projectId**: Return 404 with "Project not found"
2. **Project exists but no README.md**: Return 404 with "Specifications not available"
3. **GitHub API rate limit**: Return 429 with "Rate limit exceeded"
4. **Invalid markdown syntax**: Display error message "Unable to render specifications" (FR-012)
5. **GitHub API timeout**: Return 500 with "Failed to fetch specifications"

**Rationale**:
- Matches error handling from ticket spec API (see route.ts lines 175-196)
- Provides actionable feedback to users
- Logs errors for debugging (console.error with context)
- Follows constitutional principle IV (Security-First Design)

**Alternatives Considered**:
- Silent failure with empty page: Poor UX, hard to debug
- Generic "Error occurred": Not actionable for users
- Retry logic: Adds complexity, GitHub rate limits need backoff strategy

**Implementation Reference**: `app/api/projects/[projectId]/tickets/[id]/spec/route.ts` (lines 164-205)

---

### 6. Navigation Pattern

**Decision**: Open specifications in new tab (`target="_blank"`)

**Implementation**:
```typescript
// In board-header.tsx
<a
  href={`/projects/${projectId}/specifications`}
  target="_blank"
  rel="noopener noreferrer"
  className="..."
>
  <FileTextIcon /> {/* lucide-react icon */}
</a>
```

**Rationale**:
- Matches FR-003 requirement (open new tab)
- Preserves board context (user doesn't lose place)
- Standard web pattern for documentation/reference links
- `rel="noopener noreferrer"` for security (prevents window.opener access)

**Alternatives Considered**:
- Modal dialog (like ticket spec viewer): User requested new tab explicitly
- Client-side router push: Would navigate away from board
- Iframe embed: Security issues, complex responsive handling

---

### 7. Styling and Dark Theme

**Decision**: Reuse dark theme styling from spec-viewer.tsx

**Theme Colors**:
- Background: `bg-zinc-950` (page), `bg-zinc-900` (content)
- Text: `text-zinc-50` (headers), `text-zinc-200` (body)
- Code blocks: VS Code Dark+ theme via syntax highlighter
- Borders: `border-zinc-700`

**Rationale**:
- Consistent with existing board UI
- Matches ticket spec viewer appearance
- High contrast for readability
- Follows Tailwind CSS utility-first approach

**Alternatives Considered**:
- Light theme: Inconsistent with board dark theme
- Custom CSS: Violates constitutional principle II (use shadcn/ui components)

**Implementation Reference**: `components/board/spec-viewer.tsx` (lines 120-235)

---

### 8. Performance Considerations

**Decision**: No file size limits, lazy loading for large files

**Performance Strategy**:
- Server-side: Stream GitHub API response (no buffer limit)
- Client-side: Progressive rendering with ScrollArea component
- Caching: Browser cache for markdown content (Cache-Control headers)
- No pagination: Specification files typically <200KB

**Rationale**:
- Matches FR-013 (no file size limits)
- Markdown rendering is efficient (react-markdown uses virtual DOM)
- shadcn/ui ScrollArea component handles large content smoothly
- Real-world specs rarely exceed 200KB

**Performance Targets**:
- API response: <100ms for typical file
- Page load: <200ms FCP
- Markdown render: <50ms for 100KB file

**Alternatives Considered**:
- Pagination by headings: Complex state management, breaks Ctrl+F
- Virtual scrolling: Overkill for typical markdown file sizes
- File size limit (5MB): Rejected per FR-013 clarification

---

## Integration Points

### Existing Systems

1. **Project Model** (`lib/db/projects.ts`)
   - `getProjectById(id)`: Fetch project with githubOwner/githubRepo
   - No database changes needed

2. **GitHub API** (`lib/github/spec-fetcher.ts`)
   - Extend with `fetchProjectSpec()` function
   - Reuse Octokit client and authentication

3. **Markdown Rendering** (`components/board/spec-viewer.tsx`)
   - Extract markdown rendering logic into reusable component (optional)
   - Or duplicate configuration (acceptable given single use case)

### New Dependencies

**None** - All required libraries already installed:
- react-markdown (^9.0.1)
- react-syntax-highlighter (^15.5.0)
- @octokit/rest (^22.0.0)
- lucide-react (^0.544.0) for FileText icon

---

## Testing Strategy

### E2E Tests (Playwright)

**Test Scenarios**:
1. Navigate to board → click doc icon → new tab opens with spec page
2. Direct navigation to `/projects/:id/specifications` → renders spec
3. Invalid projectId → 404 error page
4. Project without README.md → error message displayed
5. Large markdown file (>100KB) → renders without performance issues
6. Markdown with code blocks → syntax highlighting works

**Test File**: `tests/e2e/project-specifications.spec.ts`

### API Contract Tests

**Contract Validation**:
- GET `/api/projects/:projectId/spec` returns correct schema
- Error responses match OpenAPI spec
- GitHub API errors properly handled

**Test File**: `tests/e2e/project-spec-api-contract.spec.ts`

---

## Security Considerations

### Input Validation

- projectId: Validate as positive integer via Zod schema
- No user-supplied file paths (fixed path: /specs/specifications/README.md)
- GitHub token stored in environment variable only

### GitHub API Security

- Use Octokit authentication (process.env.GITHUB_TOKEN)
- No token exposed in client-side code
- Rate limit handling prevents abuse

### Content Security

- Markdown content from trusted source (project's own Git repo)
- react-markdown automatically sanitizes HTML
- No eval() or dangerouslySetInnerHTML usage

---

## Deployment Considerations

### Environment Variables

**Required**:
- `GITHUB_TOKEN`: GitHub personal access token with repo scope
- Already configured for ticket spec feature

### Vercel Deployment

- No additional configuration needed
- Static page optimization via Server Components
- API route deployed as serverless function

---

## Open Questions

**None** - All ambiguities resolved via /clarify session:
- ✅ File location: /specs/specifications/README.md
- ✅ Missing file behavior: Assume file exists (show icon always)
- ✅ Navigation: New tab, no back button
- ✅ Error handling: Show error message
- ✅ File size limits: None

---

## Next Steps

Proceed to **Phase 1: Design & Contracts** to generate:
1. data-model.md (entities and relationships)
2. contracts/get-project-spec.yaml (OpenAPI spec)
3. quickstart.md (user testing scenarios)
4. Update CLAUDE.md with feature context
