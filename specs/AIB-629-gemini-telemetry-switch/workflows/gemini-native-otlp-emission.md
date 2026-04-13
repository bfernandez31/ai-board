# Workflow Artifact: Gemini Native OTLP Emission

**Replaces**: `specs/AIB-626-fix-gemini-telemetry/workflows/gemini-native-telemetry-emission.md`

## Workflow Definition

### Input

- `JOB_ID`: Job identifier for telemetry correlation
- Selected Gemini command and prompt
- Gemini auth material (`GEMINI_API_KEY` or `GEMINI_OAUTH_JSON`)
- Standard OTEL environment variables (already configured in workflow YAML)

### Environment Requirements

Pre-configured in workflow YAML files (no changes needed):
```yaml
OTEL_LOGS_EXPORTER: "otlp"
OTEL_EXPORTER_OTLP_PROTOCOL: "http/json"
OTEL_EXPORTER_OTLP_ENDPOINT: ${{ vars.APP_URL }}/api/telemetry
OTEL_EXPORTER_OTLP_HEADERS: "Authorization=Bearer ${{ secrets.WORKFLOW_API_TOKEN }}"
OTEL_RESOURCE_ATTRIBUTES: "job_id=${{ inputs.job_id }}"
OTEL_LOGS_EXPORT_INTERVAL: "60000"
OTEL_BLRP_SCHEDULE_DELAY: "60000"
```

### Phases

1. **Install & authenticate** Gemini CLI (unchanged from current).
2. **Invoke Gemini CLI** in standard mode — **NO** `--output-format stream-json`. Gemini CLI runs with default output and emits OTLP events natively via the configured OTEL environment variables.
3. **Gemini CLI emits** `gemini_cli.*` OTLP log records to the telemetry endpoint during execution.
4. **Return exit code** from Gemini CLI directly — no post-execution telemetry collection step.

### Key Changes from Previous (AIB-626) Workflow

| Aspect | Before (AIB-626) | After (AIB-629) |
|--------|-------------------|------------------|
| Output format | `--output-format stream-json` | Default (no flag) |
| Telemetry source | Post-execution jq scraping of stream file | Native OTLP emission during execution |
| Post-execution step | `collect_gemini_telemetry()` parses stream file | None — OTLP handles it |
| Merge mode | CUMULATIVE (final snapshot) | DELTA (incremental batches) |

## Error Behavior

- CLI/auth/install failures fail the workflow step (unchanged).
- If OTLP emission fails silently (e.g., endpoint unreachable), the job execution continues. The telemetry endpoint never receives events, so the job retains null/zero metrics — surfaced as missing-telemetry in the UI.
- Job success/failure is determined by the Gemini CLI exit code, independent of telemetry completeness.

## Agent Script Changes (`run-agent.sh`)

### Remove

- `collect_gemini_telemetry()` function (lines 729-791)
- `--output-format stream-json` flag from `invoke_gemini()` (line 721)
- `GEMINI_STREAM_FILE` export (line 723)
- `collect_gemini_telemetry` call from GEMINI dispatch block (line 822)

### Modify

`invoke_gemini()` becomes:
```bash
invoke_gemini() {
  local command_file
  command_file=$(resolve_command_file "$COMMAND") || exit 1

  local prompt
  prompt="$(build_non_claude_prompt "$command_file")"

  local prompt_file
  prompt_file="$(mktemp /tmp/gemini-prompt-XXXXXX.md)"
  printf '%s' "$prompt" > "$prompt_file"

  log_info "Invoking Gemini with command file: $command_file"
  log_info "Prompt file: $prompt_file ($(wc -c < "$prompt_file") bytes)"

  gemini "--prompt=$(cat "$prompt_file")" --approval-mode=yolo 2>&1 || true
  local exit_code=${PIPESTATUS[0]}

  rm -f "$prompt_file"
  return $exit_code
}
```

GEMINI dispatch block becomes:
```bash
GEMINI)
  validate_auth
  install_gemini
  auth_gemini
  invoke_gemini
  ;;
```
