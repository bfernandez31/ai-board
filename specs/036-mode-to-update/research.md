# Research: Documentation Edit Mode

**Date**: 2025-10-18
**Feature**: Documentation inline editing with git operations
**Branch**: 036-mode-to-update

## Research Questions

1. How to perform git commit and push operations from Next.js API routes?
2. How to handle git merge conflicts when multiple users edit the same file?
3. What's the best way to validate markdown syntax before committing?
4. How to implement unsaved changes detection in React?
5. How to structure TanStack Query mutations for file editing with optimistic updates?

## Research Findings

### 1. Git Operations in Next.js API Routes

**Decision**: Use `@octokit/rest` (already installed) for GitHub API-based commits

**Rationale**:
- Already installed in project (`@octokit/rest` ^22.0.0)
- Works perfectly on Vercel serverless (no local git required)
- GitHub API handles all git operations (no credential management needed)
- Type-safe TypeScript API
- No file system dependencies (better for serverless)

**Alternatives Considered**:
- **simple-git**: Rejected because requires local git repository and credential management, harder to deploy on serverless
- **child_process with git CLI**: Rejected due to serverless incompatibility and lack of type safety
- **isomorphic-git**: Rejected as it's more complex than using GitHub API directly

**Implementation Pattern**:
```typescript
// lib/git/operations.ts
import { Octokit } from '@octokit/rest';

export async function commitAndPush(options: {
  owner: string;
  repo: string;
  branch: string;
  filePath: string;
  content: string;
  commitMessage: string;
  authorName: string;
  authorEmail: string;
}) {
  const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });

  // Get current file SHA (needed for update)
  let sha: string | undefined;
  try {
    const { data } = await octokit.repos.getContent({
      owner: options.owner,
      repo: options.repo,
      path: options.filePath,
      ref: options.branch,
    });
    if ('sha' in data) sha = data.sha;
  } catch (error) {
    // File doesn't exist yet (will create)
  }

  // Create or update file
  const { data } = await octokit.repos.createOrUpdateFileContents({
    owner: options.owner,
    repo: options.repo,
    path: options.filePath,
    message: options.commitMessage,
    content: Buffer.from(options.content).toString('base64'),
    branch: options.branch,
    sha, // Required for updates
    committer: {
      name: options.authorName,
      email: options.authorEmail,
    },
    author: {
      name: options.authorName,
      email: options.authorEmail,
    },
  });

  return { commitSha: data.commit.sha };
}
```

**Dependencies**: None (already have `@octokit/rest` ^22.0.0)

---

### 2. Handling Merge Conflicts

**Decision**: Last-write-wins strategy with error reporting (no automatic conflict resolution)

**Rationale**:
- MVP scope excludes complex conflict resolution UI
- Merge conflicts are rare in single-user documentation editing scenarios
- When conflicts occur, surfacing a clear error message allows users to handle externally

**Alternatives Considered**:
- **Automatic merge with conflict markers**: Rejected as it requires UI for conflict resolution, increasing scope significantly
- **Pessimistic locking**: Rejected as it requires real-time coordination and complicates architecture
- **Three-way merge**: Rejected as MVP, can be added in future iterations

**Error Handling Pattern**:
```typescript
try {
  await git.push('origin', branch);
} catch (error) {
  if (error.message.includes('! [rejected]') || error.message.includes('CONFLICT')) {
    throw new Error('Unable to save: another user has modified this file. Please refresh and try again.');
  }
  throw error;
}
```

---

### 3. Markdown Validation

**Decision**: Use `remark-parse` + `remark-stringify` for linting

**Rationale**:
- Part of the unified/remark ecosystem (widely adopted)
- Validates markdown AST (Abstract Syntax Tree) parsing
- Can detect malformed markdown without executing it
- Lightweight and fast (<10ms for typical documentation files)

**Alternatives Considered**:
- **markdownlint**: Rejected as it's more opinionated (style checking) rather than syntax validation
- **No validation**: Rejected as it could lead to corrupted markdown files

**Implementation Pattern**:
```typescript
import { remark } from 'remark';

export async function validateMarkdown(content: string): Promise<{ valid: boolean; error?: string }> {
  try {
    await remark().process(content);
    return { valid: true };
  } catch (error) {
    return { valid: false, error: error.message };
  }
}
```

**Dependencies**: `remark` ^15.0.1, `remark-parse` ^11.0.0

---

### 4. Unsaved Changes Detection in React

**Decision**: Use `beforeunload` event + React state tracking

**Rationale**:
- Browser `beforeunload` event is the standard way to prevent accidental navigation
- React state (`isDirty`) tracks whether content has changed from original
- Combines browser-level protection with in-app warnings (for closing modal)

**Implementation Pattern**:
```typescript
function DocumentationEditor({ initialContent, onSave }: Props) {
  const [content, setContent] = useState(initialContent);
  const [isDirty, setIsDirty] = useState(false);

  useEffect(() => {
    setIsDirty(content !== initialContent);
  }, [content, initialContent]);

  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isDirty) {
        e.preventDefault();
        e.returnValue = '';
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isDirty]);

  // Show confirmation dialog when closing modal if isDirty
}
```

**Alternatives Considered**:
- **Autosave**: Rejected as it doesn't match user expectations for documentation editing (explicit save desired)
- **No protection**: Rejected due to poor UX (data loss risk)

---

### 5. TanStack Query Mutation Structure

**Decision**: Follow existing patterns from feature 028 (SSE replacement) and feature 034 (state management migration)

**Rationale**:
- Consistency with codebase conventions
- Optimistic updates improve perceived performance
- Existing mutation patterns handle errors and rollback elegantly

**Implementation Pattern**:
```typescript
// lib/hooks/mutations/useEditDocumentation.ts
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/query-keys';

export function useEditDocumentation(projectId: number, ticketId: number, docType: 'spec' | 'plan' | 'tasks') {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (content: string) => {
      const response = await fetch(`/api/projects/${projectId}/docs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ticketId, docType, content }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message);
      }

      return response.json();
    },

    onMutate: async (newContent) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: queryKeys.documentation(projectId, ticketId, docType) });

      // Snapshot previous value
      const previous = queryClient.getQueryData(queryKeys.documentation(projectId, ticketId, docType));

      // Optimistically update
      queryClient.setQueryData(queryKeys.documentation(projectId, ticketId, docType), newContent);

      return { previous };
    },

    onError: (err, newContent, context) => {
      // Rollback on error
      queryClient.setQueryData(queryKeys.documentation(projectId, ticketId, docType), context?.previous);
    },

    onSuccess: () => {
      // Invalidate to refetch from server (confirm commit succeeded)
      queryClient.invalidateQueries({ queryKey: queryKeys.documentation(projectId, ticketId, docType) });
    },
  });
}
```

**Reference**: See `app/lib/hooks/mutations/use*.ts` for existing mutation patterns

---

## Implementation Checklist

- [ ] Install dependencies: `remark`, `remark-parse` (Octokit already installed)
- [ ] Add `GITHUB_TOKEN` to `.env.local` with repo write permissions
- [ ] Create `lib/git/operations.ts` with `commitAndPush` function (using Octokit)
- [ ] Create `lib/git/validate.ts` with `validateMarkdown` function
- [ ] Create `lib/hooks/mutations/useEditDocumentation.ts` TanStack Query mutation
- [ ] Create `lib/schemas/documentation.ts` Zod schemas for API validation
- [ ] Create `app/api/projects/[projectId]/docs/route.ts` API handler
- [ ] Create `components/ticket/documentation-editor.tsx` edit component
- [ ] Create `components/ticket/edit-permission-guard.tsx` permission logic
- [ ] Update `components/ticket/documentation-viewer.tsx` to integrate edit mode
- [ ] Write E2E tests in `tests/e2e/documentation-editor.spec.ts`

## Risk Mitigation

### High-Priority Risks

1. **Serverless git operations timeout** (Vercel 10s function limit)
   - Mitigation: Optimize git operations, use shallow clones if needed
   - Fallback: Queue-based background processing (out of scope for MVP)

2. **Concurrent edits causing data loss**
   - Mitigation: Clear error messages on push failures
   - Fallback: Implement optimistic locking in future iteration

3. **Large documentation files causing performance issues**
   - Mitigation: Set reasonable file size limits (e.g., 1MB max)
   - Fallback: Chunked loading/saving for very large files

### Medium-Priority Risks

1. **Git credentials management in different environments**
   - Mitigation: Use environment variables for git config
   - Testing: Verify in both local dev and Vercel preview environments

2. **Network failures during push operations**
   - Mitigation: Retry logic with exponential backoff
   - Error handling: Surface actionable error messages to user

## Performance Targets

- **Edit mode toggle**: <100ms (React state change only)
- **Markdown validation**: <50ms (remark parse)
- **Git commit + push**: <2 seconds (network-dependent)
- **API response time**: <200ms (excluding git operations which run async)

## Security Considerations

- Validate user owns project before allowing git operations (check session userId against Project.userId)
- Validate branch exists and belongs to ticket before committing
- Sanitize commit messages to prevent injection attacks
- Limit file size to prevent DoS attacks (1MB max)
- Rate limit API endpoint to prevent abuse (10 requests/minute per user)
