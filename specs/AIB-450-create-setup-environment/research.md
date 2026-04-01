# Research: setup-environment.sh

**Feature**: AIB-450 — Create setup-environment.sh Script
**Date**: 2026-04-01

## R1: YAML Parsing in Bash on GitHub Actions Runners

**Decision**: Use `yq` v4 (mikefarah/yq) for all YAML parsing.

**Rationale**:
- `yq` is pre-installed on GitHub Actions Ubuntu runners (ubuntu-22.04 and ubuntu-24.04)
- Lightweight, single binary, no runtime dependencies
- Supports `.field.subfield` dot-notation queries: `yq '.runtime.manager' config.yml`
- Handles missing fields gracefully (returns empty string, not error)
- Widely used in CI/CD pipelines across the industry

**Alternatives Considered**:
- `python3 -c "import yaml; ..."` — Available but adds Python dependency, slower startup, more verbose
- `shyaml` — Not pre-installed, requires pip install
- Manual `grep`/`sed` parsing — Fragile, breaks on multi-line values, nested structures
- `dasel` — Not pre-installed, less community adoption

**Verification**: Run `which yq` and `yq --version` as first validation step in script. If missing, exit with install instructions.

## R2: Package Manager Installation Best Practices

### Bun
**Decision**: Install via `curl -fsSL https://bun.sh/install | bash` with version pinning via `BUN_INSTALL` env var.
**Rationale**: Official installer, supports version pinning. In GitHub Actions, the `oven-sh/setup-bun@v1` action handles this, but for standalone script use, the curl installer is the canonical approach.
**Version pinning**: `curl -fsSL https://bun.sh/install | bash -s "bun-v${version}"` where version comes from `runtime.manager_version`.

### npm
**Decision**: No separate installation needed — npm ships with Node.js.
**Rationale**: npm is always available when Node.js is installed. Version can be upgraded via `npm install -g npm@${version}` if `runtime.manager_version` is specified.

### Yarn (v4/Berry)
**Decision**: Use `corepack enable && corepack prepare yarn@${version} --activate`.
**Rationale**: Corepack is the Node.js-blessed package manager manager (ships with Node 16+). Yarn 4 (Berry) is the modern version and corepack is the recommended installation path.

### pnpm
**Decision**: Use `corepack enable && corepack prepare pnpm@${version} --activate`.
**Rationale**: Same as Yarn — corepack is the standard path for pnpm versioning.

**Alternatives Considered**:
- Direct `npm install -g yarn/pnpm` — Works but bypasses corepack version management
- `volta` — Extra tool to install, not standard on runners

## R3: Node.js Version Management in CI

**Decision**: In GitHub Actions, rely on the pre-installed Node.js or the `actions/setup-node@v4` action having already run. For standalone use, check `node --version` and warn if it doesn't match `runtime.node`.

**Rationale**:
- GitHub Actions workflows already use `actions/setup-node@v4` as a step — the setup script should validate but not re-install Node.js (that's the workflow's responsibility via the action)
- The script's role is to read `runtime.node` from config and verify the installed version matches, warning if mismatched
- Direct `nvm` usage in CI is fragile (requires sourcing nvm.sh, not always available)

**Impact**: The script assumes Node.js is already installed at the correct version. It validates and warns but does not install. This keeps the script simple and avoids conflicting with GitHub Actions' node setup.

## R4: Environment Variable Export Across Workflow Steps

**Decision**: Use `$GITHUB_ENV` file for persistence across steps; fall back to `export` for local testing.

**Rationale**:
- In GitHub Actions, `echo "KEY=VALUE" >> $GITHUB_ENV` makes env vars available to all subsequent steps in the job
- Plain `export` only persists within the current shell process
- Detection: `if [ -n "$GITHUB_ENV" ]; then ... fi`
- For local testing, `export` + `source` is sufficient

**Edge case**: Multi-line values need `<<EOF` delimiter syntax in `$GITHUB_ENV`.

## R5: Idempotent Symlink Strategy

**Decision**: `ln -sfn` (force, no-dereference) for replacing existing symlinks. Check with `[ -L path ]` for symlinks vs `[ -d path ]` for real directories.

**Rationale**:
- `ln -sfn` replaces existing symlinks atomically
- `-n` flag prevents following existing symlinks (treats symlink itself as target)
- Real directory detection: `[ -d path ] && [ ! -L path ]` identifies a real dir that is NOT a symlink
- If real directory found → error with actionable message

**Implementation**:
```bash
create_symlink() {
  local target="$1" link="$2"
  if [ -d "$link" ] && [ ! -L "$link" ]; then
    error "Real directory exists at $link — remove or rename it before running setup"
  fi
  ln -sfn "$target" "$link"
}
```

## R6: Agent CLI Installation

**Decision**: Install via npm global packages.

| Agent | Install Command | Binary |
|-------|----------------|--------|
| claude-code | `npm install -g @anthropic-ai/claude-code` | `claude` |
| codex | `npm install -g @openai/codex` | `codex` |

**Rationale**: Both CLIs are published as npm packages. Global install puts them on PATH. Using `npm` rather than `bun` for global installs because npm's global bin linking is more reliable across environments.

**Validation**: After install, verify binary exists: `command -v claude` or `command -v codex`.

## R7: GitHub Actions Logging Best Practices

**Decision**: Use `::group::` / `::endgroup::` for collapsible log sections; `::error::` for failures; `::warning::` for non-fatal issues.

**Rationale**: GitHub Actions workflow commands provide structured logging that renders well in the Actions UI. Makes debugging setup failures much easier.

**Pattern**:
```bash
log_step() {
  echo "::group::✅ $1"
}
end_step() {
  echo "::endgroup::"
}
log_error() {
  echo "::error::$1"
}
log_warn() {
  echo "::warning::$1"
}
```

## R8: Unsupported Runtime Warning (Python/Go/Rust/Java)

**Decision**: Parse `runtime.manager` and if it's `pip`, `poetry`, `cargo`, or another unsupported value, log a warning with the specific unsupported manager and exit with code 1.

**Rationale**: Per spec Decision 2, Python runtimes are acknowledged but not supported in soft launch. The script should not silently fail or skip — it should clearly communicate the limitation.

**Message format**: `"Unsupported package manager: '${manager}'. Supported managers: bun, npm, yarn, pnpm. Python/Go/Rust support coming soon."`
