# Implementation Plan: Project Onboarding Hybrid Workflow With Stack Detection And Generated Guidance

**Branch**: `AIB-579-copy-of-project` | **Date**: 2026-04-08 | **Spec**: `/home/runner/work/ai-board/ai-board/target/specs/AIB-579-copy-of-project/spec.md`
**Input**: Feature specification from `/home/runner/work/ai-board/ai-board/target/specs/AIB-579-copy-of-project/spec.md`

## Summary

Replace the stub onboarding workflow with a real hybrid pipeline that performs deterministic repository analysis, generates a valid `.ai-board/config.yml`, optionally generates project-specific guidance with the selected AI agent, commits the resulting artifacts to the imported repository’s default branch in one update, and reports full success, partial success, or failure back through the existing setup-job contract.

## Technical Context

**Language/Version**: TypeScript 5.9 (strict), Node.js 22.20.0  
**Primary Dependencies**: Next.js 16 App Router, React 18, Prisma 6.x, Zod 4, Octokit 22, TanStack Query v5, YAML 2, GitHub Actions, existing Claude/Codex workflow runner  
**Storage**: PostgreSQL 14+ via Prisma; target-repository files committed to GitHub default branch  
**Testing**: Vitest unit tests, Vitest integration tests, existing setup UI RTL tests; no new E2E by default  
**Target Platform**: Next.js web application plus GitHub Actions workflow execution  
**Project Type**: Web application with workflow automation  
**Performance Goals**: Typical onboarding completes with full or partial success in under 3 minutes; deterministic analysis stays static-only and completes well under the workflow budget  
**Constraints**: Preserve app-layer setup route/auth contract; no dependency installation or service startup during onboarding; preserve existing user-authored guidance files; single repository update per successful or partial-success run; owner credential required for guidance generation  
**Scale/Scope**: Extend existing setup-job persistence and callbacks, replace one workflow, add onboarding domain modules/scripts/tests, expand config validation for additional supported stacks

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

### Pre-Design Check

| Principle | Status | Notes |
|-----------|--------|-------|
| I. TypeScript-First | PASS | Deterministic analysis and workflow wrappers will live in strict TypeScript with explicit schema types |
| II. Component-Driven | PASS | UI work is additive to existing setup components; backend work stays in `app/`, `lib/`, and workflow scripts |
| III. Test-Driven | PASS | Existing setup integration/component tests will be extended first; new unit tests only for new pure detection logic |
| IV. Security-First | PASS | Workflow auth, internal credential API, masking, and no-secret-in-config patterns are reused |
| V. Database Integrity | PASS | Setup-job creation remains transactional; callback writes remain explicit and idempotent; config sync optimistic locking remains in place |
| V. Spec Clarification | PASS | All previously open clarifications are resolved in `research.md` with explicit decisions and trade-offs |

### Post-Design Check

| Gate | Status | Evidence |
|------|--------|----------|
| No unresolved clarifications | PASS | `research.md` resolves callback, artifact preservation, and stack-support decisions |
| Stable app contract preserved | PASS | Existing setup endpoints remain; callback shape is extended only with optional fields |
| Input validation at boundaries | PASS | Zod remains the boundary for setup callbacks, internal credential queries, and generated config validation |
| DB consistency on external failure | PASS | Dispatch/report failures keep explicit setup-job terminal states; deterministic outputs are committed only after artifact assembly succeeds |
| Secrets handled securely | PASS | Workflow auth, internal credential retrieval, masking, and config stripping follow existing patterns |
| Tests follow constitution | PASS | Existing setup and config-sync tests are extended; new files are limited to the new pure analysis domain |

## Project Structure

### Documentation (this feature)

```text
/home/runner/work/ai-board/ai-board/target/specs/AIB-579-copy-of-project/
├── plan.md
├── research.md
├── data-model.md
├── contracts/
│   ├── setup-jobs-api.md
│   └── onboard-artifact-summary.md
└── workflows/
    ├── onboard-workflow.md
    ├── detect-stack-command.md
    └── generate-guidance-command.md
```

### Source Code (repository root)

```text
/home/runner/work/ai-board/ai-board/target/app/api/projects/[projectId]/setup/jobs/route.ts
/home/runner/work/ai-board/ai-board/target/app/api/projects/[projectId]/setup/jobs/[jobId]/status/route.ts
/home/runner/work/ai-board/ai-board/target/app/api/internal/credentials/route.ts
/home/runner/work/ai-board/ai-board/target/app/projects/[projectId]/setup/page.tsx
/home/runner/work/ai-board/ai-board/target/components/setup/setup-page-client.tsx
/home/runner/work/ai-board/ai-board/target/lib/workflows/dispatch-onboard.ts
/home/runner/work/ai-board/ai-board/target/lib/config-sync.ts
/home/runner/work/ai-board/ai-board/target/lib/validations/config.ts
/home/runner/work/ai-board/ai-board/target/prisma/schema.prisma
/home/runner/work/ai-board/ai-board/target/.github/workflows/onboard.yml
/home/runner/work/ai-board/ai-board/target/.github/scripts/run-agent.sh
/home/runner/work/ai-board/ai-board/target/.claude-plugin/commands/ai-board.onboard.md                # NEW
/home/runner/work/ai-board/ai-board/target/lib/onboarding/                                             # NEW domain
/home/runner/work/ai-board/ai-board/target/.github/scripts/onboard/                                     # NEW workflow wrappers
/home/runner/work/ai-board/ai-board/target/tests/integration/projects/setup-job.test.ts
/home/runner/work/ai-board/ai-board/target/tests/integration/projects/config-sync.test.ts
/home/runner/work/ai-board/ai-board/target/tests/unit/components/setup/setup-page.test.tsx
/home/runner/work/ai-board/ai-board/target/tests/unit/credential-dispatch-guard.test.ts
/home/runner/work/ai-board/ai-board/target/tests/unit/lib/onboarding/                                   # NEW pure-function tests
```

**Structure Decision**: Keep workflow orchestration thin and typed. Repository-analysis and artifact-assembly logic belongs in a new `/home/runner/work/ai-board/ai-board/target/lib/onboarding/` domain with unit tests; GitHub Actions wrappers in `/home/runner/work/ai-board/ai-board/target/.github/scripts/onboard/` should only parse inputs, call typed modules, and report results.

## Implementation Phases

### Phase 0: Research And Design Lock

1. Use `/home/runner/work/ai-board/ai-board/target/specs/AIB-579-copy-of-project/research.md` as the design baseline.
2. Preserve the existing setup routes and callback auth path from AIB-577.
3. Treat partial success as a first-class persisted outcome, not an implicit JSON convention.

### Phase 1: Data And Contract Changes

1. Extend `/home/runner/work/ai-board/ai-board/target/prisma/schema.prisma`:
   - Add `partial Boolean @default(false)` to `ProjectSetupJob`
   - Add `commitSha String? @db.VarChar(40)` to `ProjectSetupJob`
   - Add `errorCode String? @db.VarChar(100)` to `ProjectSetupJob`
   - Add `logs String?` to `ProjectSetupJob`
2. Extend `/home/runner/work/ai-board/ai-board/target/app/api/projects/[projectId]/setup/jobs/[jobId]/status/route.ts` callback schema with optional `partial`, `commitSha`, `errorCode`, and `logs`.
3. Extend `/home/runner/work/ai-board/ai-board/target/app/api/projects/[projectId]/setup/jobs/route.ts` GET response so the setup UI can display partial completion and failure categories.
4. Extend `/home/runner/work/ai-board/ai-board/target/lib/validations/config.ts` and related types/tests to admit all stacks required by FR-019, including Ruby and PHP.

### Phase 2: Onboarding Domain And Workflow Orchestration

1. Add `/home/runner/work/ai-board/ai-board/target/lib/onboarding/detect-stack.ts`:
   - Inspect manifests, lockfiles, config files, task definitions, and top-level layout only
   - Resolve one primary stack using deterministic precedence rules
   - Return typed `RepositoryAnalysisSummary`
2. Add `/home/runner/work/ai-board/ai-board/target/lib/onboarding/generate-config.ts`:
   - Convert the analysis summary into a valid `.ai-board/config.yml`
   - Validate with `/home/runner/work/ai-board/ai-board/target/lib/validations/config.ts`
3. Add `/home/runner/work/ai-board/ai-board/target/lib/onboarding/artifacts.ts`:
   - Merge deterministic and guidance artifacts
   - Preserve protected existing guidance files
   - Build created/preserved/missing artifact summary
4. Add `/home/runner/work/ai-board/ai-board/target/.github/scripts/onboard/` helpers:
   - `report-status.ts` or `.js` wrapper for PATCH callbacks
   - `detect-stack.ts` CLI wrapper
   - `assemble-artifacts.ts` CLI wrapper
   - optional `commit-artifacts.sh` for a single atomic repo update
5. Replace the stub in `/home/runner/work/ai-board/ai-board/target/.github/workflows/onboard.yml`:
   - Checkout `ai-board` tools and the target repository default branch
   - Send RUNNING callback
   - Fetch the owner credential through `/api/internal/credentials`
   - Run deterministic analysis and config generation
   - Run guidance generation through `/home/runner/work/ai-board/ai-board/target/.github/scripts/run-agent.sh` using a new `/home/runner/work/ai-board/ai-board/target/.claude-plugin/commands/ai-board.onboard.md`
   - Commit deterministic-only artifacts on guidance failure and report `partial: true`
   - Report `CONFIGURATION_GENERATION_FAILED`, `GUIDANCE_GENERATION_FAILED`, or `COMMIT_FAILED` explicitly

### Phase 3: App Integration

1. Extend `/home/runner/work/ai-board/ai-board/target/lib/workflows/dispatch-onboard.ts` only as needed for any new stable workflow inputs; keep current auth and target-repo input format.
2. Extend `/home/runner/work/ai-board/ai-board/target/components/setup/setup-page-client.tsx`:
   - Show partial success distinctly from full success
   - Render created/preserved/missing artifact groups
   - Surface failure category and commit reference when present
3. Keep `/home/runner/work/ai-board/ai-board/target/app/projects/[projectId]/setup/page.tsx` owner/redirect behavior, but pass along any richer job data needed for initial render.

### Phase 4: Verification

1. Extend `/home/runner/work/ai-board/ai-board/target/tests/integration/projects/setup-job.test.ts` with:
   - deterministic success callback with `commitSha`
   - guidance failure reported as `COMPLETED` plus `partial: true`
   - configuration generation failure reported as `FAILED` plus `errorCode`
   - commit failure reported as `FAILED` and no success semantics
   - additive callback fields returned by GET polling
2. Extend `/home/runner/work/ai-board/ai-board/target/tests/unit/components/setup/setup-page.test.tsx` with partial-success and artifact-summary states.
3. Extend `/home/runner/work/ai-board/ai-board/target/tests/integration/projects/config-sync.test.ts` with config compatibility cases for newly supported languages/managers.
4. Extend `/home/runner/work/ai-board/ai-board/target/tests/unit/credential-dispatch-guard.test.ts` for onboarding-specific missing-credential behavior if coverage is incomplete.
5. Add new unit tests under `/home/runner/work/ai-board/ai-board/target/tests/unit/lib/onboarding/` for deterministic precedence and config generation because no existing pure-function suite covers that domain.

## Testing Strategy

- Extend `/home/runner/work/ai-board/ai-board/target/tests/integration/projects/setup-job.test.ts` first. This is the primary behavior contract for setup job creation, callback transitions, artifact summaries, partial completion, and failure categorization.
- Extend `/home/runner/work/ai-board/ai-board/target/tests/unit/components/setup/setup-page.test.tsx` for the UI states that render the new callback fields.
- Extend `/home/runner/work/ai-board/ai-board/target/tests/integration/projects/config-sync.test.ts` for generated-config validation and stripping behavior, instead of creating an onboarding-specific config-sync suite.
- Extend `/home/runner/work/ai-board/ai-board/target/tests/unit/credential-dispatch-guard.test.ts` for any onboarding dispatch guard gap.
- Create new tests only for the new pure analysis domain under `/home/runner/work/ai-board/ai-board/target/tests/unit/lib/onboarding/`, because no existing file currently covers deterministic stack detection or artifact assembly.

## Complexity Tracking

No constitution violations are required for this design. The only notable complexity is the additive `ProjectSetupJob` terminal-state expansion, which is necessary to satisfy the spec’s partial-success and failure-category reporting requirements without breaking the existing setup contract.
