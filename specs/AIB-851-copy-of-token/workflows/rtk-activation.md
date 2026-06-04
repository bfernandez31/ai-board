# Workflow Specification: RTK Activation During Agent Run

**Triggered by**: Workflow dispatch with `token_saving: 'true'` and agent = CLAUDE

## Inputs

| Input | Source | Required |
|-------|--------|----------|
| `TOKEN_SAVING` | Workflow input `token_saving`, mapped to env var | No (default: `false`) |
| `AGENT` | Workflow input `agent` | Yes |
| `JOB_ID` | Workflow input `job_id` | Yes |
| `CALLBACK_URL` | Constructed from `AI_BOARD_URL` + `/api/jobs/${JOB_ID}/status` | Yes |

## Phases (in run-agent.sh)

### Phase 1: Guard Check
```
IF TOKEN_SAVING != "true" OR AGENT != "CLAUDE":
  STATUS = "inactive" (if setting was off) or "n/a" (if not Claude)
  SKIP remaining phases
```

### Phase 2: RTK Installation
```
Download RTK binary from official release URL
Verify checksum
Move to PATH-accessible location
IF any step fails:
  STATUS = "fallback"
  LOG warning with reason
  SKIP Phase 3
```

### Phase 3: RTK Activation
```
Create Claude Code settings override:
  Add RTK as PreToolUse hook for Bash/terminal commands
IF activation fails:
  STATUS = "fallback"
  LOG warning with reason
```

### Phase 4: Status Report
```
PATCH $CALLBACK_URL with { tokenSavingStatus: STATUS }
(best-effort, non-blocking — failure to report does not affect the run)
```

## Error Behavior

- **RTK download fails**: Run continues without compression, status = "fallback"
- **RTK binary corrupted**: Run continues without compression, status = "fallback"
- **RTK activation fails**: Run continues without compression, status = "fallback"
- **Status report fails**: Run continues normally, job record has null tokenSavingStatus
- **No failure in RTK should ever cause the agent run to fail or be degraded**

## Output

The agent run proceeds normally. The only observable difference:
- When active: Large command outputs are semantically compressed by RTK
- When inactive/fallback: Outputs are unmodified (identical to current behavior)

## Workflow Input Changes

### speckit.yml, quick-impl.yml, verify.yml, iterate.yml

Add input:
```yaml
token_saving:
  description: 'Enable RTK token saving compression for Claude runs'
  required: false
  default: 'false'
  type: string
```

Map to environment variable in the agent step:
```yaml
env:
  TOKEN_SAVING: ${{ inputs.token_saving }}
```
