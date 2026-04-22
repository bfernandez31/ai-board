# Project Onboarding Workflow


The `onboard.yml` workflow runs once per project during the initial setup phase. It is dispatched when the project owner clicks "Initialize Project" on the setup page.

### Two-Phase Execution

**Phase 1 — Stack Detection (deterministic)**:

`.github/scripts/detect-stack.sh` scans the target repository and produces validated outputs:

- Detects primary language from manifest files: `package.json` (TypeScript/JavaScript), `Cargo.toml` (Rust), `go.mod` (Go), `pyproject.toml` (Python), `pom.xml`/`build.gradle` (Java/Kotlin), `Gemfile` (Ruby), `composer.json` (PHP), `build.zig`/`build.zig.zon` (Zig)
- Detects package manager from lockfiles (`bun.lockb`, `yarn.lock`, `pnpm-lock.yaml`, `Cargo.lock`, `poetry.lock`, `Gemfile.lock`, `composer.lock`, etc.)
- Detects test framework from dependency declarations and writes `testing.framework` (vitest, jest, pytest, cargo-test, go-test, rspec, phpunit, zig-test) and `testing.e2e` / `testing.e2e_framework` (Playwright, Cypress, Selenium) to `config.yml`
- Detects test commands per language/package manager (e.g., `bun run test`, `pytest`, `cargo test`, `go test ./...`, `zig build test --summary all`) and writes `commands.test` to `config.yml`; supports granular `commands.test_unit`, `commands.test_integration`, `commands.test_e2e` when distinct scripts are found
- Detects type-check and lint commands (e.g., `bun run type-check`, `cargo clippy`, `go vet`) and writes `commands.type_check` and `commands.lint` to `config.yml`; missing fields are omitted (not set to null)
- Detects runtime version pins from ecosystem-specific files and writes them to `config.yml`: `.nvmrc` / `.node-version` / `package.json#engines.node` → `runtime.node`; `.python-version` → `runtime.python`; `rust-toolchain.toml` channel → `runtime.rust`; `go.mod` → `runtime.go`; `.java-version` / `.sdkmanrc` → `runtime.java`; `.minimum_zig_version` in `build.zig.zon` → `runtime.manager_version` (zig toolchain); `packageManager` field in `package.json` → `runtime.manager_version` (when the field's manager name matches the detected manager, integrity hash suffixes stripped). Missing pins are omitted and the workflow falls back to the latest stable version at install time.
- Detects services from `docker-compose.yml` service definitions and ORM configuration (e.g., Prisma schema referencing PostgreSQL)
- Produces `.ai-board/config.yml` (validated against the project config schema) and `analysis.json` summarizing all detection results
- Always overwrites an existing `config.yml` — deterministic and reflects current repo state

**Phase 2 — LLM Content Generation**:

`run-agent.sh` invokes the `ai-board.onboard` command with the agent selected by the project owner:

- Reads `analysis.json` and browses the actual codebase to understand architecture, patterns, and conventions
- Generates `CLAUDE.md` with project-specific tech stack details, commands, data models, testing patterns, and architecture description — content derived from actual code analysis, not generic templates
- Generates `.ai-board/memory/constitution.md` with principles derived from observed code patterns plus universal governance standards
- Creates `AGENTS.md` as a symlink to `CLAUDE.md`
- Skips `CLAUDE.md` generation if the file already exists (preserves user customizations)

**Repository Authentication**: The workflow fetches the project owner's GitHub OAuth token (via `GET /api/internal/github-token`) to clone and push to the target repository. This ensures the workflow can write to repos owned by any user, not just the ai-board service account. The token is stored as a GitHub Actions step output (not an environment variable) so it is never exposed to the LLM agent running in Phase 2. After cloning, credentials are stripped from the git remote URL and only re-injected momentarily for the push operation. Falls back to the `GH_PAT` secret if the owner token is unavailable.

**Commit**: All generated files are committed in a single atomic commit (`chore: initialize ai-board configuration`) to the target repository's default branch.

### Partial Success

If Phase 2 fails (LLM timeout, credential issue, model error), the workflow commits only the Phase 1 outputs and reports COMPLETED with `partial: true` in the artifact summary. The project becomes minimally functional (config synced) even if the guidance files were not generated. The setup page displays which files were created and which are missing.

### Error Codes

| Code | Phase | Cause |
|------|-------|-------|
| `DISPATCH_FAILED` | Setup | Target repository could not be cloned |
| `CONFIG_GENERATION_FAILED` | Phase 1 | Detection script exited with an error — no files committed |
| `GUIDANCE_GENERATION_FAILED` | Phase 2 | LLM agent failed — triggers partial success path |
| `COMMIT_FAILED` | Commit | Git push failed (e.g., branch protection rules active on the repo) |

### Idempotency

Re-triggering onboarding on an already-onboarded repository behaves predictably:

- `config.yml` is always regenerated from current repo state (deterministic)
- Existing `CLAUDE.md` is preserved unchanged — Phase 2 is skipped for this file
- `constitution.md` is always regenerated fresh
- Artifact summary reflects preserved files separately from created files

