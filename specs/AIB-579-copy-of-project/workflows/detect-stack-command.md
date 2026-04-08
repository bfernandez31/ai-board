# Command Specification: Deterministic Stack Detection

## Proposed Entry Point

`/home/runner/work/ai-board/ai-board/target/.github/scripts/onboard/detect-stack.ts`

## Inputs

- `--repo-path <absolute path>`
- `--agent <CLAUDE|CODEX>` for downstream config defaults
- `--output-dir <absolute path>`

## Behavior

1. Inspect repository files only:
   - manifests (`package.json`, `pyproject.toml`, `Cargo.toml`, `pom.xml`, `build.gradle`, `Gemfile`, `composer.json`)
   - lockfiles
   - framework config files
   - CI/test config
   - top-level app/service directories
2. Resolve one primary language, package manager, framework, and service set using deterministic precedence.
3. Infer safe commands only when the repo provides strong static evidence.
4. Generate:
   - `repository-analysis.json`
   - `.ai-board/config.yml`
5. Validate generated config through `/home/runner/work/ai-board/ai-board/target/lib/validations/config.ts`.

## Output Contract

```json
{
  "analysisPath": "/abs/path/repository-analysis.json",
  "configPath": "/abs/path/.ai-board/config.yml",
  "summary": {
    "primaryLanguage": "typescript",
    "packageManager": "bun",
    "framework": "nextjs",
    "services": [{ "type": "postgres", "version": "14" }],
    "signals": ["package.json", "bun.lockb", "next.config.ts"]
  }
}
```

## Failure Rules

- Exit non-zero if no valid operational config can be produced.
- Emit only machine-readable stderr/stdout messages suitable for final callback logs.
- Do not attempt to execute project commands.
