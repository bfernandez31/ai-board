# Quickstart: Documentation Edit Mode

**Feature**: 036-mode-to-update
**Target Audience**: Developers implementing this feature
**Estimated Reading Time**: 10 minutes

## Overview

This feature adds inline editing capabilities to the documentation viewer (feature 035), allowing users to edit spec.md, plan.md, and tasks.md files directly in the ticket modal. Changes are committed and pushed to the feature branch via API endpoints.

**Key Capabilities**:
- Edit spec.md when ticket is in SPECIFY stage
- Edit plan.md and tasks.md when ticket is in PLAN stage
- Auto-commit and push changes to feature branch
- Unsaved changes protection
- Optimistic UI updates with rollback on error

---

## Prerequisites

Before implementing this feature, ensure you have:

1. **Completed feature 035** (Documentation Viewer)
   - `components/ticket/documentation-viewer.tsx` exists and displays markdown
   - Ticket modal shows spec.md, plan.md, and tasks.md in read-only mode

2. **Development Environment Setup**:
   - Node.js 22.20.0 LTS installed
   - PostgreSQL 14+ running locally
   - Git configured with user.name and user.email
   - GitHub repository cloned and accessible

3. **Knowledge Requirements**:
   - TypeScript and React hooks
   - TanStack Query mutations and optimistic updates
   - Git operations (commit, push, checkout)
   - Next.js API routes and server actions

---

## Architecture At-a-Glance

```
User clicks "Edit" button
        ↓
 DocumentationEditor component renders
 (textarea with markdown content)
        ↓
 User modifies content, clicks "Save"
        ↓
 useEditDocumentation mutation fires
 (optimistic update to TanStack Query cache)
        ↓
 POST /api/projects/:id/docs
        ↓
 Server validates permissions & content
        ↓
 Git operations (checkout, write file, commit, push)
        ↓
 Return success response
        ↓
 TanStack Query invalidates cache
 (refetch from server to confirm)
        ↓
 UI updates to show saved content
```

---

## Implementation Steps

### Step 1: Install Dependencies & Setup Environment

```bash
npm install remark@^15.0.1 remark-parse@^11.0.0
```

**Why these dependencies?**
- `remark` + `remark-parse`: Markdown syntax validation
- `@octokit/rest`: Already installed! (Will use for GitHub API commits)

**Environment Setup**:

Add to `.env.local`:
```bash
# GitHub Personal Access Token with 'repo' scope
GITHUB_TOKEN=ghp_your_token_here
```

**Create GitHub Token**:
1. Go to GitHub Settings → Developer settings → Personal access tokens → Tokens (classic)
2. Generate new token with `repo` scope (full repository access)
3. Copy token and add to `.env.local`

---

### Step 2: Create Git Operations Module

**File**: `app/lib/git/operations.ts`

```typescript
import { Octokit } from '@octokit/rest';

export interface CommitAndPushOptions {
  owner: string;           // GitHub repo owner (e.g., 'bfernandez31')
  repo: string;            // GitHub repo name (e.g., 'ai-board')
  branch: string;          // Branch name (e.g., '036-mode-to-update')
  filePath: string;        // File path relative to repo root
  content: string;         // New file content
  commitMessage: string;   // Commit message
  authorName: string;      // Git author name
  authorEmail: string;     // Git author email
}

export async function commitAndPush(options: CommitAndPushOptions): Promise<{ commitSha: string }> {
  const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });

  // Get current file SHA (needed for updates)
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
    // File doesn't exist yet (will create new file)
  }

  // Create or update file via GitHub API
  const { data } = await octokit.repos.createOrUpdateFileContents({
    owner: options.owner,
    repo: options.repo,
    path: options.filePath,
    message: options.commitMessage,
    content: Buffer.from(options.content).toString('base64'), // GitHub API requires base64
    branch: options.branch,
    sha, // Required for updates, omit for new files
    committer: {
      name: options.authorName,
      email: options.authorEmail,
    },
    author: {
      name: options.authorName,
      email: options.authorEmail,
    },
  });

  return { commitSha: data.commit.sha || '' };
}
```

**Test Locally**:
```bash
# Create test file: test-git-ops.ts
import { commitAndPush } from './app/lib/git/operations';

await commitAndPush({
  owner: 'bfernandez31',
  repo: 'ai-board',
  branch: '036-mode-to-update',
  filePath: 'specs/036-mode-to-update/spec.md',
  content: '# Test\n\nUpdated content',
  commitMessage: 'test: verify git operations',
  authorName: 'Test User',
  authorEmail: 'test@example.com',
});

# Run: npx tsx test-git-ops.ts
```

---

### Step 3: Create Validation Module

**File**: `app/lib/git/validate.ts`

```typescript
import { remark } from 'remark';

export async function validateMarkdown(content: string): Promise<{ valid: boolean; error?: string }> {
  try {
    await remark().process(content);
    return { valid: true };
  } catch (error) {
    return {
      valid: false,
      error: error instanceof Error ? error.message : 'Invalid markdown syntax',
    };
  }
}
```

---

### Step 4: Create Zod Schemas

**File**: `app/lib/schemas/documentation.ts`

```typescript
import { z } from 'zod';

export const editDocumentationSchema = z.object({
  ticketId: z.number().int().positive(),
  docType: z.enum(['spec', 'plan', 'tasks']),
  content: z.string().min(1).max(1048576, 'Document content exceeds 1MB limit'),
  commitMessage: z.string().max(500).optional(),
});

export type EditDocumentationRequest = z.infer<typeof editDocumentationSchema>;
```

---

### Step 5: Create API Route

**File**: `app/api/projects/[projectId]/docs/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { prisma } from '@/app/lib/prisma';
import { editDocumentationSchema } from '@/app/lib/schemas/documentation';
import { commitAndPush } from '@/app/lib/git/operations';
import { validateMarkdown } from '@/app/lib/git/validate';

export async function POST(
  request: NextRequest,
  { params }: { params: { projectId: string } }
) {
  try {
    // 1. Authenticate
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 2. Parse and validate request
    const body = await request.json();
    const parsed = editDocumentationSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation error', details: parsed.error.errors },
        { status: 400 }
      );
    }

    // 3. Authorize project access
    const projectId = parseInt(params.projectId, 10);
    const project = await prisma.project.findUnique({
      where: { id: projectId },
    });

    if (!project || project.userId !== session.user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // 4. Get ticket and check permissions
    const ticket = await prisma.ticket.findUnique({
      where: { id: parsed.data.ticketId },
    });

    if (!ticket || ticket.projectId !== projectId) {
      return NextResponse.json({ error: 'Ticket not found' }, { status: 404 });
    }

    if (!ticket.branch) {
      return NextResponse.json(
        { error: 'Branch not found for ticket', code: 'BRANCH_NOT_FOUND' },
        { status: 404 }
      );
    }

    // 5. Check stage-based permissions
    const canEdit = checkEditPermission(ticket.stage, parsed.data.docType);
    if (!canEdit) {
      return NextResponse.json(
        {
          error: `Cannot edit ${parsed.data.docType}.md in ${ticket.stage} stage`,
          code: 'PERMISSION_DENIED',
        },
        { status: 403 }
      );
    }

    // 6. Validate markdown
    const validation = await validateMarkdown(parsed.data.content);
    if (!validation.valid) {
      return NextResponse.json(
        { error: `Invalid markdown: ${validation.error}`, code: 'VALIDATION_ERROR' },
        { status: 400 }
      );
    }

    // 7. Commit and push
    const featureDir = `${ticket.id.toString().padStart(3, '0')}-${ticket.branch.split('-').slice(1).join('-')}`;
    const filePath = `specs/${featureDir}/${parsed.data.docType}.md`;
    const commitMessage = parsed.data.commitMessage || `docs: update ${parsed.data.docType}.md`;

    const result = await commitAndPush({
      repoPath: process.cwd(),
      branch: ticket.branch,
      filePath,
      content: parsed.data.content,
      commitMessage,
      authorName: session.user.name || 'Unknown',
      authorEmail: session.user.email || 'unknown@example.com',
    });

    return NextResponse.json({
      success: true,
      commitSha: result.commitSha,
      updatedAt: new Date().toISOString(),
      message: `${parsed.data.docType}.md updated successfully`,
    });
  } catch (error) {
    console.error('[docs/route] Error:', error);

    if (error instanceof Error && error.message.includes('CONFLICT')) {
      return NextResponse.json(
        {
          error: 'Unable to save: another user has modified this file. Please refresh and try again.',
          code: 'MERGE_CONFLICT',
        },
        { status: 409 }
      );
    }

    return NextResponse.json(
      { error: 'Internal server error', code: 'NETWORK_ERROR' },
      { status: 500 }
    );
  }
}

function checkEditPermission(stage: string, docType: string): boolean {
  if (stage === 'SPECIFY' && docType === 'spec') return true;
  if (stage === 'PLAN' && (docType === 'plan' || docType === 'tasks')) return true;
  return false;
}
```

---

### Step 6: Create TanStack Query Mutation Hook

**File**: `app/lib/hooks/mutations/useEditDocumentation.ts`

```typescript
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/app/lib/query-keys';

interface EditDocumentationParams {
  projectId: number;
  ticketId: number;
  docType: 'spec' | 'plan' | 'tasks';
  content: string;
}

export function useEditDocumentation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: EditDocumentationParams) => {
      const response = await fetch(`/api/projects/${params.projectId}/docs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ticketId: params.ticketId,
          docType: params.docType,
          content: params.content,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to save documentation');
      }

      return response.json();
    },

    onMutate: async (params) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({
        queryKey: queryKeys.documentation(params.projectId, params.ticketId, params.docType),
      });

      // Snapshot previous value
      const previous = queryClient.getQueryData(
        queryKeys.documentation(params.projectId, params.ticketId, params.docType)
      );

      // Optimistically update
      queryClient.setQueryData(
        queryKeys.documentation(params.projectId, params.ticketId, params.docType),
        params.content
      );

      return { previous };
    },

    onError: (err, params, context) => {
      // Rollback on error
      if (context?.previous !== undefined) {
        queryClient.setQueryData(
          queryKeys.documentation(params.projectId, params.ticketId, params.docType),
          context.previous
        );
      }
    },

    onSuccess: (data, params) => {
      // Invalidate to refetch from server
      queryClient.invalidateQueries({
        queryKey: queryKeys.documentation(params.projectId, params.ticketId, params.docType),
      });
    },
  });
}
```

---

### Step 7: Create Documentation Editor Component

**File**: `components/ticket/documentation-editor.tsx`

```typescript
'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useEditDocumentation } from '@/app/lib/hooks/mutations/useEditDocumentation';

interface DocumentationEditorProps {
  projectId: number;
  ticketId: number;
  docType: 'spec' | 'plan' | 'tasks';
  initialContent: string;
  onCancel: () => void;
}

export function DocumentationEditor({
  projectId,
  ticketId,
  docType,
  initialContent,
  onCancel,
}: DocumentationEditorProps) {
  const [content, setContent] = useState(initialContent);
  const [isDirty, setIsDirty] = useState(false);
  const mutation = useEditDocumentation();

  useEffect(() => {
    setIsDirty(content !== initialContent);
  }, [content, initialContent]);

  // Unsaved changes warning
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

  const handleSave = async () => {
    await mutation.mutateAsync({ projectId, ticketId, docType, content });
    onCancel(); // Close editor after successful save
  };

  const handleCancel = () => {
    if (isDirty) {
      const confirmed = window.confirm('You have unsaved changes. Are you sure you want to cancel?');
      if (!confirmed) return;
    }
    onCancel();
  };

  return (
    <div className="space-y-4">
      <Textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        className="min-h-[400px] font-mono text-sm"
        placeholder="Enter markdown content..."
      />

      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={handleCancel} disabled={mutation.isPending}>
          Cancel
        </Button>
        <Button onClick={handleSave} disabled={!isDirty || mutation.isPending}>
          {mutation.isPending ? 'Saving...' : 'Save'}
        </Button>
      </div>

      {mutation.isError && (
        <div className="text-sm text-red-600">
          Error: {mutation.error instanceof Error ? mutation.error.message : 'Failed to save'}
        </div>
      )}
    </div>
  );
}
```

---

### Step 8: Update Documentation Viewer

**File**: `components/ticket/documentation-viewer.tsx` (update existing)

```typescript
'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { DocumentationEditor } from './documentation-editor';

// Add edit mode state
const [isEditing, setIsEditing] = useState(false);

// Add edit button (only show if user can edit)
{canEdit(ticket.stage, docType) && !isEditing && (
  <Button onClick={() => setIsEditing(true)}>Edit</Button>
)}

// Conditionally render editor or viewer
{isEditing ? (
  <DocumentationEditor
    projectId={projectId}
    ticketId={ticketId}
    docType={docType}
    initialContent={content}
    onCancel={() => setIsEditing(false)}
  />
) : (
  <ReactMarkdown>{content}</ReactMarkdown>
)}
```

---

### Step 9: Write E2E Tests

**File**: `tests/e2e/documentation-editor.spec.ts`

```typescript
import { test, expect } from '@playwright/test';
import { prisma } from '@/app/lib/prisma';

test.describe('Documentation Editor', () => {
  test('edits spec.md in SPECIFY stage', async ({ page }) => {
    // Setup: Create ticket in SPECIFY stage
    await prisma.ticket.update({
      where: { id: 1 },
      data: { stage: 'SPECIFY', branch: '036-mode-to-update' },
    });

    // Navigate to ticket
    await page.goto('http://localhost:3000/projects/3/board');
    await page.click('[data-testid="ticket-1"]');

    // Click Edit button
    await page.click('button:has-text("Edit")');

    // Modify content
    await page.fill('textarea', '# Updated Spec\n\nNew content here');

    // Save
    await page.click('button:has-text("Save")');

    // Verify success
    await expect(page.locator('[data-testid="spec-content"]')).toContainText('Updated Spec');
  });

  test('prevents editing spec in PLAN stage', async ({ page }) => {
    await prisma.ticket.update({
      where: { id: 1 },
      data: { stage: 'PLAN' },
    });

    await page.goto('http://localhost:3000/projects/3/board');
    await page.click('[data-testid="ticket-1"]');

    // Edit button should not be visible for spec.md
    await expect(page.locator('button:has-text("Edit")')).not.toBeVisible();
  });
});
```

---

## Testing Checklist

- [ ] Git operations work locally (commit, push succeed)
- [ ] Markdown validation rejects invalid syntax
- [ ] API returns 403 for unauthorized users
- [ ] API returns 403 for wrong stage permissions
- [ ] API returns 409 for merge conflicts
- [ ] TanStack Query optimistic updates work
- [ ] Unsaved changes warning appears on navigation
- [ ] E2E tests pass for all scenarios

---

## Troubleshooting

### Git Push Fails with "Permission Denied"

**Solution**: Ensure git credentials are configured
```bash
git config user.name "Your Name"
git config user.email "your@email.com"
```

### "Branch not found" Error

**Solution**: Verify ticket has branch field populated
```sql
SELECT id, branch FROM "Ticket" WHERE id = <ticket-id>;
```

### Optimistic Update Doesn't Rollback on Error

**Solution**: Check TanStack Query cache keys match exactly
```typescript
// Must be identical in both places
queryKeys.documentation(projectId, ticketId, docType)
```

---

## Next Steps

After implementing this feature:

1. Run full test suite: `npm test`
2. Test in local development environment
3. Deploy to Vercel preview environment
4. Verify git operations work in serverless context
5. Monitor error logs for git operation failures

---

## Additional Resources

- [simple-git documentation](https://github.com/steveukx/git-js)
- [TanStack Query mutations guide](https://tanstack.com/query/latest/docs/react/guides/mutations)
- [Remark documentation](https://github.com/remarkjs/remark)
- [Feature 035: Documentation Viewer](../035-view-plan-and/spec.md)
