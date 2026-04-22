# Agent Selection


### Claude Model Selection

For workflows dispatched to the Claude agent, the system resolves a specific Claude model ID per stage using a priority chain.

**Model Resolution**:
1. **Ticket override** — `ticket.{stageModel}` (set individually per stage in the override dialog)
2. **Project default** — `project.{stageModel}` (configured in the AI Models card in project settings)
3. **Global fallback** — `claude-opus-4-7` (hard-coded; ensures pre-existing projects are byte-for-byte identical to before this feature)

**Configurable stages**: SPECIFY, PLAN, IMPLEMENT, QUICK-IMPL, VERIFY.

**Non-configurable stages** (`iterate`, `comment-*`, `health-scan`, `retro-spec`, `onboard`): always use the global fallback regardless of project or ticket settings.

**Non-Claude agents**: when the effective agent is not Claude, per-stage model configuration is ignored entirely; the agent uses its own current default.

The resolved model ID is:
- Passed to the workflow as the `model` dispatch input
- Written to `Job.model` at job creation for per-stage cost analytics

**Model Whitelist** (closed set; unknown values on read fall through to the next resolution layer):
- `claude-opus-4-7` — Claude Opus 4.7 (global fallback)
- `claude-opus-4-6` — Claude Opus 4.6
- `claude-sonnet-4-6` — Claude Sonnet 4.6
- `claude-haiku-4-5-20251001` — Claude Haiku 4.5

### Per-Workflow Agent Routing

Every workflow dispatch includes the resolved agent value so each workflow invokes the correct AI CLI tool.

**Agent Resolution**:

The effective agent is determined by a priority chain:
1. **Ticket override** — `ticket.agent` (optional, per-ticket setting)
2. **Project default** — `project.defaultAgent` (required, defaults to CLAUDE)
3. **System fallback** — `CLAUDE` (defensive, only if project default is somehow unset)

**Supported Agents**:
- `CLAUDE` — Anthropic Claude CLI (default)
- `CODEX` — OpenAI Codex CLI
- `MISTRAL` — Mistral vibe CLI
- `GEMINI` — Google Gemini CLI

**Scope**:
- Core ticket workflows receive the resolved agent: SPECIFY, PLAN, BUILD, VERIFY, QUICK, iterate
- Some workflows remain explicitly agent-restricted even when ticket/project resolution returns a different default. For example, ai-board-assist code review remains Claude-only, and setup / retro-spec / health-scan may reject unsupported agents before dispatch.
- Agent selection is read-only during dispatch — it flows from the database into workflow inputs without changing ticket state
