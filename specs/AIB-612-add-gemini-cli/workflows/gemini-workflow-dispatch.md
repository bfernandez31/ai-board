# Workflow Artifact: Gemini Workflow Dispatch

## Workflow Definition

### Input

- `agent`: `GEMINI`
- `command`: one of `specify | plan | implement | quick-impl | iterate`
- `projectId`
- `ticketId` or `ticketKey`
- `githubRepository`
- Google credential payload resolved for the project owner

### Phases

1. Resolve effective ticket/project agent
2. Confirm the requested workflow supports Gemini
3. Resolve `GEMINI -> GOOGLE`
4. Fetch Google credential from internal credentials API
5. Materialize either:
   - `GEMINI_API_KEY`
   - cached auth state under `~/.gemini`
6. Install Gemini CLI
7. Execute headless prompt with structured output capture
8. Post telemetry batch
9. Report job success or failure

### Environment requirements

- `GITHUB_TOKEN`
- `WORKFLOW_API_TOKEN`
- `APP_URL`
- one of:
  - `GEMINI_API_KEY`
  - `GEMINI_OAUTH_JSON`

## Agent Command Specification

### Invocation

- Headless Gemini CLI execution using non-TTY or `-p`
- Output mode: `--output-format stream-json`

### Functional phases

1. Command file resolution
2. Prompt assembly with ticket/spec context
3. Gemini CLI invocation
4. Event stream capture
5. Failure classification and exit-code propagation

### Output format

- Workflow log stream
- structured telemetry batch derived from final `result` and tool events

## Callback / Reporting Contract

- Initial dispatch creates a `PENDING` job
- Workflow status updates continue to use existing job status callback paths
- Unsupported Gemini workflow attempts must fail before dispatch with explicit user-facing error text

