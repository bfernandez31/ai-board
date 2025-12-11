# Research: View and Edit the Constitution

**Feature Branch**: `AIB-103-view-and-edit`
**Date**: 2025-12-11

## Research Tasks

### 1. Constitution File Location and Access Pattern

**Question**: How should we fetch the constitution file from the project's GitHub repository?

**Decision**: Use the same GitHub API pattern as `doc-fetcher.ts` but with a fixed file path

**Rationale**:
- The existing `fetchDocumentContent()` in `/lib/github/doc-fetcher.ts` fetches files from `specs/{branchName}/{docType}.md`
- Constitution lives at `.specify/memory/constitution.md` in the repository root
- Same Octokit pattern applies: get file content from default branch (main), decode base64 response

**Alternatives Considered**:
1. **Extend `doc-fetcher.ts`**: Rejected because constitution has different path structure and no ticket context
2. **Store in database**: Rejected because spec requires file to live in repository for version control
3. **Create abstract base fetcher**: Over-engineering for single additional file type

**Implementation Pattern**:
```typescript
// lib/github/constitution-fetcher.ts
export async function fetchConstitutionContent(owner: string, repo: string): Promise<string> {
  const response = await octokit.repos.getContent({
    owner,
    repo,
    path: '.specify/memory/constitution.md',
    ref: 'main'  // Always from main branch
  });
  return Buffer.from(response.data.content, 'base64').toString('utf-8');
}
```

---

### 2. Project Settings Integration Pattern

**Question**: How should the constitution button/modal integrate with existing project settings?

**Decision**: Follow the `ClarificationPolicyCard` pattern with a dedicated modal viewer

**Rationale**:
- `ClarificationPolicyCard` at `/components/settings/clarification-policy-card.tsx` establishes the settings card pattern
- Project settings page at `/app/projects/[projectId]/settings/page.tsx` expects card components
- Documentation viewer pattern at `/components/board/documentation-viewer.tsx` provides modal approach

**Implementation Pattern**:
```typescript
// components/settings/constitution-card.tsx
// Card with button that opens ConstitutionViewer modal

// components/settings/constitution-viewer.tsx
// Modal with tabs: View | Edit | History
// Reuses: react-markdown config, DocumentationEditor, CommitHistoryViewer, DiffViewer
```

---

### 3. API Route Structure

**Question**: What API routes are needed for constitution operations?

**Decision**: Create three routes mirroring the `/docs/` pattern

**Rationale**:
- Existing patterns at `/api/projects/[projectId]/docs/`, `/docs/history/`, `/docs/diff/`
- Constitution is project-level (not ticket-level), so no ticketId needed
- Same authorization via `verifyProjectAccess()`

**Routes**:
| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/projects/[projectId]/constitution` | GET | Fetch content |
| `/api/projects/[projectId]/constitution` | PUT | Update content |
| `/api/projects/[projectId]/constitution/history` | GET | Get commit history |
| `/api/projects/[projectId]/constitution/diff?sha=X` | GET | Get commit diff |

**Alternatives Considered**:
1. **Single route with actions**: Rejected for REST convention consistency
2. **Add to existing `/docs/` route**: Rejected because constitution isn't a ticket document

---

### 4. Edit Permission Model

**Question**: Who can edit the constitution and how are permissions enforced?

**Decision**: Use existing `verifyProjectAccess()` - owners and members can edit

**Rationale**:
- Spec FR-011 requires "valid project access (owner or member)"
- `verifyProjectAccess()` at `/lib/db/permissions.ts` already implements this check
- Consistent with other project settings (clarification policy)

**Implementation**:
```typescript
// In constitution route.ts
const project = await verifyProjectAccess(projectId);
// If user lacks access, verifyProjectAccess throws 403
```

---

### 5. Markdown Validation Approach

**Question**: How should we validate markdown before saving?

**Decision**: Reuse existing `validateMarkdown()` function from documentation validation

**Rationale**:
- FR-005 requires markdown syntax validation before save
- Existing validator at `/lib/validations/documentation.ts` provides `validateMarkdown()`
- Same validation rules apply to constitution as spec/plan/tasks

**Note**: Validation prevents malformed markdown but is lenient (most markdown is valid). Primary benefit is catching syntax errors in code blocks.

---

### 6. Commit Message Format

**Question**: What commit message format should be used for constitution edits?

**Decision**: Use descriptive format: "docs(constitution): Update project constitution"

**Rationale**:
- Follows conventional commit format already in codebase
- Distinguishes from ticket-specific commits
- Matches existing documentation edit pattern

**Format**: `docs(constitution): Update project constitution`

---

### 7. History and Diff Display

**Question**: How should commit history and diffs be displayed?

**Decision**: Reuse existing `CommitHistoryViewer` and `DiffViewer` components

**Rationale**:
- Components at `/components/ticket/commit-history-viewer.tsx` and `diff-viewer.tsx` already implement:
  - Commit list with author, date, message
  - Diff view with color-coded additions/deletions
- Only difference: API endpoints point to `/constitution/history` and `/constitution/diff`
- Consistent UX across all markdown file types

---

### 8. Empty Constitution Handling

**Question**: What happens when a project doesn't have a constitution file?

**Decision**: Display informative message with guidance on creating one

**Rationale**:
- FR-010 requires appropriate error messages when file doesn't exist
- GitHub API returns 404 for missing files
- User guidance should explain how to create constitution (via `/speckit.constitution` command)

**Implementation**:
```typescript
// In ConstitutionViewer
{!content && !error && (
  <div className="text-zinc-400">
    <p>No constitution file found.</p>
    <p>Create one using the /speckit.constitution command in Claude Code.</p>
  </div>
)}
```

---

## Summary

All research questions resolved. The implementation follows established patterns with minimal novel design:

| Aspect | Reuse Pattern From |
|--------|-------------------|
| GitHub file fetching | `doc-fetcher.ts` |
| Settings card | `clarification-policy-card.tsx` |
| Markdown viewer | `documentation-viewer.tsx` |
| Markdown editor | `documentation-editor.tsx` |
| Commit history | `commit-history-viewer.tsx` |
| Diff viewer | `diff-viewer.tsx` |
| Authorization | `verifyProjectAccess()` |
| Validation | `validateMarkdown()` |
| TanStack Query hooks | `use-documentation-history.ts` |

No NEEDS CLARIFICATION items remain.
