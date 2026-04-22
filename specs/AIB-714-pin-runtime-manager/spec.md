# Quick Implementation: Pin runtime manager version in generated config.yml during onboarding

**Feature Branch**: `AIB-714-pin-runtime-manager`
**Created**: 2026-04-22
**Mode**: Quick Implementation (bypassing formal specification)

## Description

## Problem

When a project is onboarded, ai-board generates `.ai-board/config.yml` without pinning the package-manager / runtime version. At workflow execution time, `setup-environment.sh` then installs the **latest** version of the manager, which can break builds when the target project was written against an older version.

**Concrete incident (2026-04-22):** The `death-note` Zig project failed its Implement workflow because ai-board installed Zig 0.16.0 (latest stable), but the project's `build.zig.zon` uses pre-0.14 string syntax (`.name = "death-note"`) which Zig 0.16 rejects. The project was never pinned to a compatible Zig version in its config.

This bug is not Zig-specific. The same class of failure will hit any project whose manager version matters (Rust toolchain pinned via `rust-toolchain.toml`, Python version via `.python-version`, Bun/pnpm via lockfile, Node via `.nvmrc`/`engines`, etc.).

## Expected behavior

1. During onboarding, the stack detector reads version pin files already present in the target repo and writes the resulting version into `runtime.manager_version` in the generated `config.yml`.
2. When the workflow runs, `setup-environment.sh` installs exactly the pinned version (plumbing already exists — just needs the value to be present).
3. If no pin file is found, the config.yml omits `manager_version` and falls back to "latest stable" (current behavior, preserved for unpinned projects).

## Acceptance criteria

- Onboarding a Zig project with `.minimum_zig_version` in `build.zig.zon` produces a config.yml where `runtime.manager_version` matches that value.
- Onboarding a Node/Bun project honors `.nvmrc`, `.node-version`, `package.json#engines.node`, or `packageManager` field where appropriate.
- Onboarding a Rust project honors `rust-toolchain.toml` channel.
- Onboarding a Python project honors `.python-version`.
- Onboarding a Java project honors `.java-version` / `.sdkmanrc` when present.
- A re-onboarded existing project (e.g. `death-note`) succeeds end-to-end at the Install Dependencies step with the correct manager version.
- Projects with no version pin files continue to work unchanged (no regression for unpinned repos).
- The generated `analysis.json` continues to expose the detected runtime versions for observability.

## Out of scope

- No automatic migration of existing already-onboarded projects' config.yml — owners re-run onboarding or edit manually.
- No new version pin formats invented; only parse conventions that already exist in each ecosystem.

## Implementation Notes

This feature is being implemented via quick-impl workflow, bypassing formal specification and planning phases.

**Quick-impl is suitable for**:
- Bug fixes (typos, minor logic corrections)
- UI tweaks (colors, spacing, text changes)
- Simple refactoring (renaming, file organization)
- Documentation updates

**For complex features**, use the full workflow: INBOX → SPECIFY → PLAN → BUILD

## Implementation

Implementation will be done directly by Claude Code based on the description above.
