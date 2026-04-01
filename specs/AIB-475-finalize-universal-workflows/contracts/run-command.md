# Contract: run-command.sh

**Type**: Shell script interface
**Location**: `.github/scripts/run-command.sh`

---

## Synopsis

```bash
run-command.sh <target-dir> <command-key>
```

## Arguments

| Arg | Required | Description |
|-----|----------|-------------|
| `target-dir` | Yes | Absolute path to the target repository root |
| `command-key` | Yes | One of: `install`, `build`, `lint`, `type_check`, `test_unit`, `test_integration`, `test_e2e` |

## Behavior

1. **Validate arguments**: Exactly 2 args required, else exit 1 with usage message
2. **Locate config**: `<target-dir>/.ai-board/config.yml`
3. **Config missing**: Use fallback defaults (see table below)
4. **Config present, invalid YAML**: Exit 2, print parse error to stderr
5. **Config present, valid**:
   - Key found with non-empty value: `cd <target-dir> && eval "$command"`
   - Key found with empty value (`""`): Exit 0, no output
   - Key not found: Exit 0, no output
6. **Return**: Executed command's exit code

## Fallback Defaults

When `.ai-board/config.yml` is absent:

```bash
declare -A DEFAULTS=(
  [install]="bun install --frozen-lockfile"
  [build]="bun run build"
  [lint]="bun run lint"
  [type_check]="bun run type-check"
  [test_unit]="bun run test:unit"
  [test_integration]="bun run test:integration"
  [test_e2e]="bunx playwright test"
)
```

## Environment

- Requires `yq` on PATH (bootstraps itself if missing)
- Inherits caller's environment variables
- Executes commands in `<target-dir>` working directory

## Examples

```bash
# Run install from config
run-command.sh /workspace/target install

# Run unit tests (falls back to default if no config)
run-command.sh /workspace/target test_unit

# Unrecognized key — silent skip
run-command.sh /workspace/target deploy
# → exit 0, no output
```
