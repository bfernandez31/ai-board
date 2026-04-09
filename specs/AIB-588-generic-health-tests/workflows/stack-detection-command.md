# Command Specification: detect-stack.sh

## File

`.github/scripts/detect-stack.sh`

## Arguments

| Argument | Required | Description |
|---------|----------|-------------|
| `<target_repo_dir>` | Yes | Repository directory to inspect |
| `[agent]` | No | Agent type used when writing config metadata |

## Functional Phases

1. Repository signal discovery
2. Framework and service detection
3. Command normalization
4. Config generation
5. Analysis artifact generation

## Output Format

- Writes files directly to the target repo
- Prints a short summary line to stdout
- Exit code `0` on successful detection even if some optional capabilities remain absent

## Reporting Contract

- The generated config is the durable workflow contract.
- `analysis.json` is a diagnostic/build artifact and not required by later health scans.
