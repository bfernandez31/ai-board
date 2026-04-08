# Project Onboarding Workflow — Design Spec

**Ticket**: AIB-568
**Date**: 2026-04-08
**Status**: Draft

## Context

After importing an external GitHub repo into AI Board, projects without `.ai-board/config.yml` redirect to `/projects/{id}/setup` which currently 404s. The project needs 3 files to be operational:

1. `.ai-board/config.yml` — workflow infrastructure (stack, services, commands, agent)
2. `CLAUDE.md` + `AGENTS.md` symlink — agent runtime instructions
3. `.ai-board/memory/constitution.md` — project governance principles

The goal is a **full-workflow approach**: a dedicated GitHub Actions workflow clones the repo, runs an AI agent that analyzes the codebase and generates all 3 files automatically. The user reviews and adjusts after the fact.

## Architecture

### Flow

```
Import (existing)
  └→ POST /api/projects/import
       └→ config.yml found?
            ├─ YES → /projects/{id} (project ready)
            └─ NO  → /projects/{id}/setup
                       └→ Setup page (new)
                            1. User picks agent CLI (Claude Code / Codex)
                            2. App verifies credential exists
                            3. Dispatches onboard.yml workflow
                            4. Polls job status
                            5. On completion → redirect to board
```

### Key Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Workflow vs wizard-generated files | Dedicated workflow | Consistent with ai-board architecture (centralized workflows). Agent can do deep analysis, not just template filling. |
| Questions before workflow | Agent CLI only | Credential is a hard prerequisite. Everything else is auto-detected. |
| Job attachment | `setupStatus` on Project model | One-shot operation, not a recurring job system. Avoids modifying the ticket-bound Job model. |
| Commit strategy | Direct to default branch | Config files are tooling, not application code. PR adds unnecessary friction to onboarding. |
| CLAUDE.md if exists | Skip (idempotent) | Respect existing project setup. |
| Constitution generation | AUTO policy, stack-derived | 80% of principles derivable from stack. User adjusts after via constitution editor. |
| Multi-agent support | CLAUDE.md is source of truth, AGENTS.md symlink | Same pattern as ai-board itself. |

## Components

### 1. Prisma Schema Changes

Add to `Project` model:
- `setupStatus` — enum `SetupStatus` (PENDING, RUNNING, COMPLETED, FAILED), nullable (null = no setup needed or legacy project)
- `setupJobId` — String, nullable (GitHub Actions run ID for status tracking)

### 2. Workflow: `onboard.yml`

**Trigger**: `workflow_dispatch`

**Inputs**:
- `githubRepository` — target repo (owner/repo format)
- `projectId` — for API callback
- `agentCli` — "claude-code" or "codex"

**Steps**:
1. Checkout ai-board (sparse: `.claude-plugin/` only)
2. Checkout target repo (full clone, default branch)
3. Setup agent CLI (Claude Code or Codex, based on input)
4. Run agent: `run-agent.sh {AGENT} "ai-board.onboard" '{"projectId":X}'`
5. Commit + push generated files to default branch
6. Callback API: PATCH setup status to COMPLETED + trigger config sync

**Key difference from speckit.yml**: No setup-environment, no services, no runtime install. Read-only repo analysis + file generation.

### 3. Command: `/ai-board.onboard`

Agent command executed inside the workflow. Has the repo cloned locally.

**Phase 1 — Repo Analysis** (read-only):
- Language & framework detection via manifests (package.json, Cargo.toml, go.mod, pyproject.toml, pom.xml, build.gradle, Gemfile, composer.json, *.csproj, etc.)
- Package manager from lockfiles (bun.lockb, yarn.lock, pnpm-lock.yaml, Cargo.lock, poetry.lock, go.sum, etc.)
- Services from docker-compose.yml, ORM configs (prisma/schema.prisma, alembic, etc.), .env.example
- Commands from manifests (package.json scripts, Makefile, Taskfile, pyproject.toml scripts, etc.)
- Test frameworks from config files (vitest.config, jest.config, pytest.ini, playwright.config, *_test.go, *_spec.rb, etc.)
- Repository structure (key directories, architecture patterns)
- Existing CLAUDE.md content (if present)

**Phase 2 — Generate `config.yml`**:
Fills the existing config schema (version 1) from analysis results.

**Phase 3 — Generate `CLAUDE.md`** (if absent):
Inspired by Claude Code `/init` but deeper:
- Detected stack section
- Real project commands
- Data models (ORM reference if detected)
- Testing patterns and conventions
- Architecture / directory structure
- AI Board section (constitution reference, spec conventions)

**Phase 4 — Symlinks**:
- `AGENTS.md → CLAUDE.md`
- `.ai-board/` entries in .gitignore if needed

**Phase 5 — Generate `constitution.md`**:
Stack-derived principles using AUTO clarification policy:
- Principles mapped from detected stack (e.g., TypeScript → strict mode principle, Prisma → DB integrity, test framework → TDD)
- Universal principles (security-first, error handling)
- Standard governance template (amendments, compliance, versioning)
- Same quality standards as `/ai-board.constitution` command

**Phase 6 — Commit**:
Single commit: `chore: initialize ai-board configuration`

### 4. API: `POST /api/projects/{projectId}/onboard`

Dispatches the onboard workflow:
1. Verify user is project owner
2. Verify credential exists for chosen agent
3. Dispatch `onboard.yml` via GitHub Actions API
4. Set `setupStatus = RUNNING`, store run ID in `setupJobId`
5. Return job info for polling

**Callback endpoint** (for workflow): `PATCH /api/projects/{projectId}/onboard/status`
- Updates `setupStatus` (COMPLETED or FAILED)
- On COMPLETED: triggers `syncProjectConfig()` to store config in DB

### 5. Setup Page: `/projects/{id}/setup`

**Route**: `app/(dashboard)/projects/[projectId]/setup/page.tsx`

**States**:
1. **Init** — Agent CLI radio buttons + credential check + "Initialize Project" button
2. **Running** — Spinner + elapsed time (polls setup status)
3. **Completed** — Success message + list of committed files + "Go to Project Board" button
4. **Error** — Error message + "Retry" button

**Guards**:
- Owner-only access (reuse `verifyProjectOwnership`)
- If project already has synced config → redirect to board
- If `setupStatus === RUNNING` → show running state directly

## What Changes in Existing Code

**Modified files**:
- `prisma/schema.prisma` — Add SetupStatus enum + fields on Project
- `app/api/projects/import/route.ts` — Set `setupStatus: PENDING` when no config found

**Not modified**:
- Job model (stays ticket-bound)
- Existing workflows (speckit, quick-impl, verify)
- Import flow logic (just the redirect target now works)
- Credentials system (reused as-is)

## Verification

1. Import a repo without `.ai-board/config.yml` → lands on setup page
2. Pick agent CLI → credential verified → workflow dispatched
3. Workflow completes → 3 files committed to repo
4. Config synced to DB → redirect to project board
5. Project is operational (can create tickets, run workflows)
6. Import a repo WITH config → skips setup, lands on board directly
7. Import a repo WITH existing CLAUDE.md → onboard preserves it
8. Test with different stacks (TypeScript, Python, Rust, Go at minimum)
9. Test error state + retry
10. Test credential missing → blocked with guidance
