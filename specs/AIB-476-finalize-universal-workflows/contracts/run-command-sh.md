# Contract: run-command.sh

**Location**: `.github/scripts/run-command.sh`
**Type**: Shell script (bash)

## Interface

```bash
run-command.sh <target-directory> <command-key>
```

### Parameters

| # | Name | Required | Description |
|---|------|----------|-------------|
| 1 | target-directory | Yes | Absolute or relative path to the project root containing `.ai-board/config.yml` |
| 2 | command-key | Yes | One of: `install`, `build`, `lint`, `type_check`, `test_unit`, `test_integration`, `test_e2e` |

### Exit Codes

| Code | Condition |
|------|-----------|
| 0 | Config file missing (silent skip) |
| 0 | Command key not defined in config (silent skip) |
| N | Command executed and returned exit code N |
| 1 | Invalid YAML syntax in config.yml |
| 1 | Missing required argument |

### Behavior

1. If `<target-directory>/.ai-board/config.yml` does not exist → exit 0 (no output)
2. If config exists but is invalid YAML → exit 1 with error message to stderr
3. Read `.commands.<command-key>` from config
4. If key is missing or null → exit 0 (log info message)
5. Execute the command in `<target-directory>` via `eval` in a subshell
6. Return the command's exit code

### Dependencies

- `yq` v4.x (bootstrapped automatically if missing)

### Example Usage in Workflow

```yaml
- name: Install dependencies
  run: ai-board/.github/scripts/run-command.sh target install

- name: Run unit tests
  run: ai-board/.github/scripts/run-command.sh target test_unit
```
