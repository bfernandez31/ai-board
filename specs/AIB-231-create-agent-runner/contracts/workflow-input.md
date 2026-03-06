# Contract: Workflow `agent` Input Parameter

## Definition (all 6 workflows)

```yaml
inputs:
  agent:
    description: 'AI agent to use for execution'
    required: true
    type: string
    default: 'CLAUDE'
```

## Accepted Values

| Value | Description |
|-------|-------------|
| `CLAUDE` | Use Claude Code CLI (@anthropic-ai/claude-code) |
| `CODEX` | Use OpenAI Codex CLI (@openai/codex) |

## Workflow-Specific Notes

### speckit.yml
- Already has `agent` input (line 64-68, default `'CLAUDE'`)
- Needs: pass `agent` to `run-agent.sh` invocations

### quick-impl.yml
- **Missing** `agent` input — must be added
- Default: `'CLAUDE'` for backward compatibility

### verify.yml
- Already has `agent` input (line 37-40, required)
- Needs: pass `agent` to `run-agent.sh` invocations

### cleanup.yml
- Already has `agent` input (line 29-32, required)
- Needs: pass `agent` to `run-agent.sh` invocations

### ai-board-assist.yml
- Already has `agent` input (line 52-55, required)
- Already forwards to iterate.yml dispatch
- Needs: pass `agent` to `run-agent.sh` invocations

### iterate.yml
- Already has `agent` input (line 37-40, required)
- Needs: pass `agent` to `run-agent.sh` invocations

## Dispatch Integration

When ai-board dispatches workflows from the web app, the `agent` value comes from `project.agent` or defaults to `CLAUDE`.
