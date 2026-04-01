# Research: Finalize Universal Workflows

**Feature Branch**: `AIB-475-finalize-universal-workflows`
**Date**: 2026-04-01

---

## Research Task 1: GitHub Actions Conditional Service Containers

**Context**: FR-006/FR-007 require service containers to start only when `needs_*` inputs are true.

**Decision**: Use conditional `image` expressions in service container definitions. When `needs_postgres` is false, the image resolves to empty string and GitHub Actions skips the container.

**Rationale**: GitHub Actions supports conditional service containers via expression syntax:
```yaml
services:
  postgres:
    image: ${{ inputs.needs_postgres == 'true' && format('postgres:{0}', inputs.postgres_version || '14') || '' }}
```
When the image string resolves to `''`, the service definition is present in YAML but no container is created. This is the documented pattern for optional services.

**Alternatives Considered**:
- Separate workflow files per service combination — rejected (combinatorial explosion)
- Reusable workflows with service inheritance — rejected (GitHub Actions does not support services in reusable workflows called with `uses:`)
- Matrix strategy — rejected (unnecessary complexity for boolean toggles)

---

## Research Task 2: AIB-468 Revert Root Causes

**Context**: Previous attempt to integrate `setup-environment.sh` was reverted (commit `6eda97d9`).

**Decision**: Address all three root causes identified in the revert:
1. **Path**: Use `ai-board/.github/scripts/` prefix (workspace-root-relative), never `../ai-board/`
2. **Phase awareness**: Pass a `mode` parameter (`lightweight` vs `full`) to `setup-environment.sh`. Specify/plan phases use `lightweight` (symlinks, runtimes, git config only). Implement/build/verify/health-scan use `full` (adds deps, Prisma, Playwright).
3. **Config fallback**: When `.ai-board/config.yml` is missing from target repo, `run-command.sh` falls back to hardcoded ai-board defaults.

**Rationale**: The revert commit message explicitly documents these three issues. Solving all three is required for successful re-integration.

**Alternatives Considered**:
- Abandoning `setup-environment.sh` and only using `run-command.sh` — rejected (setup-environment.sh handles runtime installation, symlinks, and detection which run-command.sh should not duplicate)

---

## Research Task 3: run-command.sh Design

**Context**: FR-001 through FR-005 require a centralized command dispatch script.

**Decision**: Create `.github/scripts/run-command.sh` that:
1. Accepts two args: `<target-dir>` and `<command-key>`
2. Looks for `.ai-board/config.yml` in `<target-dir>`
3. If config exists: uses `yq` to extract `commands.<command-key>`, executes it
4. If config missing: uses hardcoded fallback table
5. If key not found or empty string: exits 0 silently
6. If config has invalid YAML: fails with clear error (FR-015)
7. Returns the executed command's exit code faithfully

**Fallback defaults** (matching current ai-board hardcoded behavior):
| Key | Default Command |
|-----|----------------|
| `install` | `bun install --frozen-lockfile` |
| `build` | `bun run build` |
| `lint` | `bun run lint` |
| `type_check` | `bun run type-check` |
| `test_unit` | `bun run test:unit` |
| `test_integration` | `bun run test:integration` |
| `test_e2e` | `bunx playwright test` |

**Rationale**: Keeps the script simple and single-purpose. Config parsing with `yq` is consistent with `setup-environment.sh`. Fallback table ensures backward compatibility.

**Alternatives Considered**:
- Embedding fallbacks in each workflow YAML — rejected (duplicates logic, harder to maintain)
- Using environment variables instead of config file — rejected (config.yml is the established pattern)

---

## Research Task 4: setup-environment.sh Phase Parameter Integration

**Context**: FR-009/FR-014 require phase-aware setup boundaries.

**Decision**: Add a `--mode` flag to `setup-environment.sh`:
- `--mode lightweight`: Runs only symlinks, runtime installation (bun/node), git config, yq bootstrap
- `--mode full`: Runs everything — lightweight steps + dependency install + Prisma detect/generate/migrate + Playwright detect/install

**Phase-to-mode mapping in workflows**:
| Workflow | Command/Phase | Mode |
|----------|--------------|------|
| speckit | specify, plan | lightweight |
| speckit | implement | full |
| quick-impl | quick-impl | full |
| verify | verify | full |
| ai-board-assist | assist | lightweight (unless stage requires deps) |
| iterate | iterate | lightweight |
| health-scan | TESTS | full |
| health-scan | SECURITY, COMPLIANCE, SPEC_SYNC | lightweight |

**Rationale**: Two-tier approach matches existing conditional logic but centralizes it in the script rather than duplicating conditionals across workflows.

**Alternatives Considered**:
- Per-step granularity (symlinks-only, deps-only, etc.) — rejected (over-engineering; two tiers cover all current use cases)

---

## Research Task 5: Workflow Files Requiring Modification

**Context**: Need to identify all workflows that have hardcoded commands to replace.

**Decision**: Six workflow files need modification:

| File | Changes Needed |
|------|---------------|
| `speckit.yml` | Replace hardcoded bun install, prisma, playwright with setup-environment.sh + run-command.sh; add service inputs |
| `quick-impl.yml` | Same as speckit; add service inputs |
| `verify.yml` | Replace hardcoded test commands with run-command.sh; add service inputs |
| `health-scan.yml` | Replace hardcoded install/prisma (TESTS path) with setup-environment.sh + run-command.sh; conditional service inputs |
| `ai-board-assist.yml` | Replace hardcoded bun install/prisma/playwright with setup-environment.sh lightweight mode |
| `iterate.yml` | Minimal changes — already lightweight; ensure setup-environment.sh lightweight mode |

**No changes needed**:
- `deploy-preview.yml` — uses Vercel CLI, no project commands
- `rollback-reset.yml` — git-only operations
- `auto-ship.yml` — event-triggered, no project commands
- `nightly-health.yml` — just triggers health-scan via API

**Rationale**: Only workflows that execute project code need universal command support.

---

## Research Task 6: yq Availability and Usage

**Context**: Assumption A4 states yq is available in the workflow environment.

**Decision**: `yq` is bootstrapped by `setup-environment.sh` (lines 43-57), which downloads `yq v4.44.1` if not present. `run-command.sh` must also ensure `yq` is available — either by calling a shared bootstrap function or by sourcing `setup-environment.sh`'s yq bootstrap.

**Rationale**: `run-command.sh` may be called independently of `setup-environment.sh` in some workflow steps, so it needs its own yq guarantee.

**Alternatives Considered**:
- Requiring yq pre-installed on runners — rejected (not guaranteed on all GitHub-hosted runners)
- Using `grep`/`sed` instead of yq — rejected (fragile for YAML parsing)

---

## Research Task 7: Double-Checkout Layout Validation

**Context**: Assumption A5 describes the standard workspace layout.

**Decision**: The workspace layout is:
```
$GITHUB_WORKSPACE/
├── ai-board/          # Sparse checkout of ai-board repo (main branch)
│   ├── .claude-plugin/
│   ├── .github/scripts/
│   └── .github/workflows/
└── target/            # Full checkout of target repo (feature branch)
    ├── .ai-board/config.yml
    └── ...
```

All script references from workflows must use `ai-board/.github/scripts/` prefix. The target directory path varies by project and is available as `$GITHUB_WORKSPACE/target` or the repo name.

**Rationale**: This is the established pattern across all existing workflows, confirmed by the AIB-468 revert which specifically identified `../ai-board/` as the wrong path pattern.
