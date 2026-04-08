# Onboarding Command Specification

## Purpose

Specify the hybrid repository initialization command invoked by the onboarding workflow after target repository checkout.

## Proposed command surface

- Claude command path: `/home/runner/work/ai-board/ai-board/target/.claude/commands/ai-board.onboard.md`
- Shared execution script path: `/home/runner/work/ai-board/ai-board/target/.github/scripts/run-project-onboarding.sh`

The workflow may use one shell wrapper plus an agent-specific command prompt, but the logical phases below are mandatory.

## Arguments

| Argument | Required | Description |
|------|------|------|
| `--project-id` | yes | AI Board project id |
| `--selected-agent` | yes | `CLAUDE` or `CODEX` |
| `--default-branch` | yes | target repository branch to update |
| `--analysis-summary-path` | yes | JSON output path for deterministic detection |
| `--artifact-manifest-path` | yes | JSON output path for final artifact manifest |
| `--repo-root` | yes | checked-out target repository path |

## Functional phases

### Phase A: Detect repository shape

- Read package manifests, language/tool lockfiles, framework config, CI hints, test config, and service clues.
- Produce:
  - `.ai-board/config.yml`
  - analysis summary JSON

### Phase B: Discover existing guidance assets

- Check for existing primary instruction files such as `CLAUDE.md` and `AGENTS.md`.
- Check for current governance/constitution files and `.gitignore` rules.
- Decide which files are `preserved`, `generated`, or `updated`.

### Phase C: Generate missing guidance

- Use the selected agent plus analysis summary to draft repository-specific:
  - governance file
  - primary instruction file only if absent
  - linked alias file
  - optional analysis snapshot under `.ai-board/onboarding/`

### Phase D: Validate and summarize

- Validate generated config against the app config schema.
- Confirm preserved primary instruction files were not modified.
- Write artifact manifest JSON with:
  - `path`
  - `kind`
  - `status`
  - `notes`

## Output contract

The command must emit machine-readable JSON or files that the workflow can relay in the callback payload:

```json
{
  "analysisSummaryPath": ".ai-board/onboarding/analysis-summary.json",
  "artifactManifestPath": ".ai-board/onboarding/artifact-manifest.json",
  "generatedConfigPath": ".ai-board/config.yml"
}
```

## Non-goals

- No environment bootstrapping beyond artifact generation
- No branch creation
- No ticket creation
- No preview deployment
- No speculative code changes outside the onboarding artifact set
