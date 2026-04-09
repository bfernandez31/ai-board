# Workflow Specification: Stack Detection and Config Generation

## Purpose

Generate reusable ai-board project configuration that captures install, test, lint, and type-check commands plus test capability metadata for later generic workflows.

## Inputs

| Input | Type | Description |
|------|------|-------------|
| `target_repo_dir` | path | Checked-out repository to inspect |
| `agent` | enum | `CLAUDE` or `CODEX`, used only for generated config metadata |

## Environment Requirements

- Bash
- `jq`
- filesystem access to the checked-out target repo

## Steps

1. Inspect manifests and lockfiles to detect language, framework, package manager, and services.
2. Detect test framework signals.
3. Normalize runnable commands into config fields:
   - `commands.install`
   - `commands.lint`
   - `commands.type_check`
   - `commands.test_unit`
   - `commands.test_integration`
   - `commands.test_e2e`
4. Derive `testCapabilities.framework`, `testCapabilities.primaryCommandKey`, and `testCapabilities.hasE2E`.
5. Write `.ai-board/config.yml`.
6. Write `analysis.json` for onboarding/debugging.

## Output

- `target_repo_dir/.ai-board/config.yml`
- `target_repo_dir/analysis.json`

## Error Behavior

- Missing or ambiguous test signals do not fail detection.
- Detection writes only defensible command fields and leaves ambiguous values absent.
