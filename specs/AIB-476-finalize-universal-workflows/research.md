# Research: Finalize Universal Workflows

**Feature**: AIB-476 — run-command.sh + Conditional Services
**Date**: 2026-04-01

## Research Question 1: How should run-command.sh parse config.yml?

**Decision**: Use `yq` (already bootstrapped by setup-environment.sh) to read command values from `.ai-board/config.yml`. The script accepts a target directory and command key, constructs the yq path `.commands.<key>`, and executes the result.

**Rationale**: `yq` is already a proven dependency in the project (setup-environment.sh installs v4.44.1). Using it avoids adding another parser. It handles YAML edge cases (quoting, special characters) correctly.

**Alternatives considered**:
- `grep`/`sed` parsing: Fragile with multi-line values or special characters
- Python `pyyaml`: Adds a runtime dependency not guaranteed on all runners
- Node.js script: Slower startup, unnecessary for simple key lookup

## Research Question 2: How should GitHub Actions conditionally provision service containers?

**Decision**: Use GitHub Actions' native conditional expression syntax on service container definitions. Services are defined at the job level with `image` set conditionally: `image: ${{ inputs.needs_postgres && format('postgres:{0}', inputs.postgres_version) || '' }}`. An empty image string means the service is not provisioned.

**Rationale**: GitHub Actions skips service containers with empty image strings — this is documented behavior. No custom logic needed; the workflow YAML handles it declaratively.

**Alternatives considered**:
- Separate jobs per service combination: Excessive complexity, harder to maintain
- Docker Compose sidecar: Non-standard for Actions, loses built-in health checks
- Always provision all services: Wastes resources, slower CI

## Research Question 3: How should setup-environment.sh support phase-aware execution?

**Decision**: Add an optional second parameter `--phase <lightweight|full>` (default: `full`). Lightweight phase executes: yq bootstrap, config validation, symlink creation, runtime/package manager install. Full phase adds: dependency install, agent CLI install, env export, Prisma detection/generation, Playwright detection.

**Rationale**: This preserves the existing performance optimization where specify/plan skip heavy setup. The phase parameter makes the behavior explicit rather than relying on callers to know which steps to skip. Default `full` maintains backward compatibility.

**Alternatives considered**:
- Single unconditional call (AIB-468 approach): Already failed — broke workflows by running unnecessary steps
- Granular flags per step: Over-engineered for two clear execution tiers
- Separate scripts per phase: Code duplication, harder to maintain

## Research Question 4: How should run-command.sh handle missing config or missing keys?

**Decision**: Silent exit 0 (no-op) for both missing config file and missing command key. Error exit only for invalid YAML syntax or command execution failure.

**Rationale**: Per spec Decision 1, missing config means the repo isn't onboarded yet — failing would break backward compatibility. Missing key means the project doesn't use that command (e.g., no E2E tests) — also a valid state.

**Alternatives considered**:
- Warning message + exit 0: Noisy in logs for expected scenarios
- Fail on missing config: Breaks backward compatibility (FR-013)
- Default commands per key: Over-engineers fallback behavior

## Research Question 5: Which workflow commands should be replaced vs. kept hardcoded?

**Decision**: Per spec Decision 3:
- **Replace with run-command.sh**: `bun install --frozen-lockfile`, `bun run test:unit`, `bun run test:integration`, `bunx playwright test`, `bun run lint`, `bun run type-check`, `bun run build`
- **Keep hardcoded (infrastructure)**: `npx prisma generate`, `npx prisma migrate deploy`, `npx tsx tests/global-setup.ts`, `npx playwright install chromium --with-deps`, bun cache step

**Rationale**: Infrastructure provisioning (Prisma schema generation, browser installation) is a workflow responsibility, not a project command. These steps set up the environment that project commands then use.

**Alternatives considered**:
- Replace everything including Prisma/Playwright: Over-abstraction; these are detected automatically
- Add infrastructure keys to config.yml: Unnecessary complexity for steps guarded by HAS_PRISMA/HAS_PLAYWRIGHT

## Research Question 6: Script path convention in workflows

**Decision**: All script references use `ai-board/` workspace-root-relative paths (e.g., `ai-board/.github/scripts/run-command.sh`), NOT `../ai-board/` relative paths. This aligns with FR-010 and the multi-repo checkout layout where ai-board is checked out as a sibling.

**Rationale**: The multi-repo checkout pattern uses `actions/checkout` with `path: ai-board` and `path: target`, placing them as siblings under the workspace root. `ai-board/` prefix is cleaner and less error-prone than relative `../` paths.

**Alternatives considered**:
- `../ai-board/` relative paths: Fragile, depends on current working directory
- Absolute `$GITHUB_WORKSPACE/ai-board/`: Verbose but equivalent; the shorter form is preferred
