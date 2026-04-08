# Contract: Onboarding Artifact Summary

This document defines the machine-readable summary returned by the onboarding workflow and persisted on `ProjectSetupJob.artifactSummary`.

## Shape

```json
{
  "created": [
    { "path": ".ai-board/config.yml", "kind": "config" }
  ],
  "preserved": [
    { "path": "CLAUDE.md", "kind": "guidance", "reason": "existing file preserved" }
  ],
  "missing": [
    { "path": ".ai-board/memory/constitution.md", "kind": "constitution", "reason": "guidance generation failed" }
  ],
  "analysisPath": ".ai-board/onboarding/repository-analysis.json",
  "partialReason": "Guidance generation failed after deterministic outputs succeeded"
}
```

## Rules

- `created`, `preserved`, and `missing` are always arrays when the summary is present.
- `created` contains files written in the final committed repository update.
- `preserved` contains protected files intentionally left unchanged.
- `missing` contains expected artifacts that were not produced in this run.
- `partialReason` is present only when setup finished with `partial = true`.
- Paths are repository-relative.

## Artifact Kinds

- `config`
- `guidance`
- `constitution`
- `agent-entry`
- `command`
- `script`
- `analysis`

## Protected Files

The workflow must preserve existing copies of:

- `CLAUDE.md`
- `AGENTS.md`
- `.ai-board/memory/constitution.md`

Machine-managed artifacts such as `.ai-board/config.yml` and generated onboarding command/script bundles may be created or refreshed by the workflow.
