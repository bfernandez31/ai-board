# Quickstart: Setup Wizard Implementation

**Ticket**: AIB-472
**Branch**: `AIB-472-setup-wizard-auto`

---

## What We're Building

A 4-step setup wizard at `/projects/[id]/setup` that:
1. Auto-detects a repo's tech stack via GitHub API
2. Presents a pre-filled questionnaire for the user to review/edit
3. Generates 3 config files (config.yml, CLAUDE.md, constitution.md)
4. Commits them atomically to the repo and syncs config to DB

## Key Files to Create

### Backend (API Routes)
- `app/api/projects/[projectId]/setup/detect/route.ts` — repo analysis endpoint
- `app/api/projects/[projectId]/setup/commit/route.ts` — atomic file commit endpoint

### Core Logic
- `lib/setup/detect.ts` — auto-detection logic (language, framework, services, etc.)
- `lib/setup/generate.ts` — file content generators (config.yml, CLAUDE.md, constitution.md)
- `lib/setup/commit.ts` — atomic multi-file commit via GitHub Git Data API

### Frontend (Setup Page)
- `app/projects/[projectId]/setup/page.tsx` — server component with auth guard
- `components/setup/setup-wizard.tsx` — main wizard container (client component)
- `components/setup/steps/stack-step.tsx` — Step 1: language, framework, manager
- `components/setup/steps/services-step.tsx` — Step 2: service checkboxes with versions
- `components/setup/steps/commands-step.tsx` — Step 3: command text fields
- `components/setup/steps/agent-step.tsx` — Step 4: CLI and model selection
- `components/setup/review-step.tsx` — file preview with inline editing
- `components/setup/file-preview.tsx` — syntax-highlighted code editor per file
- `components/setup/file-diff.tsx` — diff view for existing files

### Types
- `lib/setup/types.ts` — DetectionResult, SetupWizardState, GeneratedFile interfaces

## Key Patterns to Follow

### Auth Pattern (from existing routes)
```typescript
const userId = await requireAuth();
const project = await verifyProjectAccess(Number(projectId));
```

### GitHub Client Pattern (from user-client.ts)
```typescript
const octokit = await createUserGitHubClient(userId);
```

### Form Pattern (from import-project-modal.tsx)
- useState for step tracking
- useMutation for async operations
- Conditional rendering per step

### Existing Schema Reuse
- Enum values from `lib/validations/config.ts` (Language, Framework, PackageManager, etc.)
- Config validation via `validateConfig()` before commit
- Config sync via `syncProjectConfig()` after commit

## Implementation Order

1. **Types** — define all interfaces first
2. **Detection logic** — the core repo analysis
3. **Detection API** — expose via endpoint
4. **File generators** — config.yml, CLAUDE.md, constitution.md templates
5. **Commit logic** — atomic multi-file commit helper
6. **Commit API** — expose via endpoint
7. **Setup page** — server component with redirect guard
8. **Wizard steps** — 4 step forms (stack → services → commands → agent)
9. **Review step** — file preview + inline editing + diff for existing files
10. **Integration** — wire everything together, handle errors
11. **Tests** — integration tests for APIs, component tests for wizard steps
