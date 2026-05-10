# Agent Command: `claude /insights` invocation

**Branch**: `AIB-777-admin-section-with`
**Date**: 2026-05-10

The `/insights` analysis is performed by Claude Code's built-in `/insights` slash command — not a custom command file authored in this repo. There is no new `.claude/commands/*.md` to write; the workflow simply invokes the built-in command directly.

This document specifies the contract of that invocation as it relates to AIB-777: what input the workflow gives the analyzer, what output the workflow consumes, and what guarantees the analyzer must satisfy.

## Why no custom command file

Existing custom commands in `.claude/commands/` (e.g., `ai-board.specify.md`, `ai-board.plan.md`) are author-defined prompts that orchestrate Claude Code agents over a project's source tree. They consume project files and produce spec/plan/task artifacts.

The AIB-777 analysis is fundamentally different:
- Input: a directory of raw native Claude session JSONL files captured by the dependency feature (AIB-779), not project source code.
- Output: a single self-contained HTML document.
- Tooling: Claude Code's *own* analyzer, which already understands native session JSONL.

Inventing a custom command would re-implement what `/insights` already does — explicitly forbidden by FR-011 ("execute Claude Code's `/insights` analyzer over them, and capture the genuine HTML output unchanged (no re-implementation, no transformation that would alter the document's narratives, charts, friction categories, suggested CLAUDE.md lines, big wins, or horizon section)").

## Invocation contract

```
claude /insights \
  --input-dir <DIR>            # directory containing N JSONL.gz files,
                                #   one per Claude session in the analysis window
  --output-html <FILE>         # absolute path; the analyzer writes one
                                #   self-contained HTML document here
  --period-start <ISO8601>     # informational; embedded in the report
                                #   header by the analyzer (NOT used to
                                #   filter input — input is already filtered)
  --period-end   <ISO8601>     # ditto
```

### Required behaviour the analyzer satisfies (precondition for adoption)

The new feature relies on the following invariants of `/insights`:

1. **Self-contained HTML**: the output document MUST work when opened in a browser tab without external network access (chart rendering uses inline JS/SVG/CSS; data is embedded). This is what enables the sandboxed iframe rendering decision (D1 in research.md). Verified by spec's assumption: "produces a self-contained HTML document on stdout (or to a known path)".
2. **Non-interactive**: the command MUST exit non-zero on failure with a message on stderr; it MUST NOT prompt for input. The workflow runs unattended.
3. **No side effects on the input directory**: the command MUST NOT write into `--input-dir`. The directory is treated as read-only by `/insights`.
4. **Stable exit codes**: 0 on success, non-zero on any failure. The workflow uses `set -euo pipefail` so any non-zero exit triggers the FAILED branch.
5. **Bounded memory / time**: the workflow timeout is 45 minutes; in practice `/insights` should complete in single-digit minutes on a typical window. If the analyzer becomes slow enough to risk the timeout, the workflow's `timeout-minutes: 45` will kill it and step 8 will record the failure.

### Inputs the workflow guarantees the analyzer

1. `--input-dir` contains exclusively `*.jsonl.gz` files in the canonical raw-native session schema produced by AIB-779 (i.e., `raw-logs/<projectId>/<ticketId>/<jobId>.jsonl.gz` content, downloaded one-per-file).
2. **No non-Claude content**. The artifact-enumeration step on the workflow side filters by effective agent = `CLAUDE` *before* download. SC-006 is enforced at enumeration, not by the analyzer.
3. Files are downloaded via the authenticated app proxy `GET /api/projects/:projectId/tickets/:ticketId/jobs/:jobId/logs/raw-native`, so the bytes the analyzer sees are exactly the bytes that were uploaded by the dependency feature — no transformation in flight.

### Outputs the workflow consumes from the analyzer

1. The HTML at `--output-html` (must exist, must be non-empty — checked by `test -s /tmp/report.html` in step 5 of `insights-analyze.yml`).
2. The session and ticket counts the analyzer reports in its header are not consumed by the workflow as authoritative. The workflow's PATCH-COMPLETED body uses the counts from its own enumeration step (`steps.enumerate.outputs.sessionsCount`, `steps.enumerate.outputs.ticketsCount`). This guarantees FR-025 ("the pre-flight count and the workflow's analysis-input enumeration use consistent definitions") — the workflow's enumeration is the canonical truth, the analyzer's header is informational reading material.

### Failure modes the workflow must handle

| Failure | How the workflow responds |
|---------|---------------------------|
| `claude --version` non-zero (CLI not installed / unavailable in runtime) | Step 5 fires step 8 → FAILED with reason "Insights analyzer unavailable in workflow runtime" (operator action: investigate runner image / regenerate `CLAUDE_CODE_OAUTH_TOKEN`). |
| `claude /insights` exits non-zero | Step 5 fires step 8 → FAILED with reason "Insights analyzer exited non-zero (see workflow run for log)" (operator action: open the linked GitHub Actions log). |
| `/tmp/report.html` empty after success exit | Step 5's `test -s` fails → step 8 → FAILED with reason "Insights analyzer produced empty output" (operator action: rare; usually means the input directory was empty after retention pruning, but the analyzer should still produce a "no data" HTML — if not, file a bug against `/insights` itself). |
| Upload (step 6) returns 4xx/5xx | Step 8 → FAILED with reason "Failed to upload report HTML (HTTP <code>)" (operator action: check blob backend status). |

## Phase mapping back to spec's Internal Process

The agent command (this document) is *only* the realisation of spec's Phase 6 — "Insights execution: Feed the enumerated raw native session JSONL corpus into Claude Code's `/insights` analyzer and capture the produced HTML document unchanged." Every other phase is owned either by the trigger endpoint (Phases 1–3, 4 dispatch) or by the workflow file (Phases 4–5, 7–8).

This separation is deliberate: the only AI-Board-specific cognition in this feature lives in the *triggering* and *bookkeeping* code, not in the analysis itself. The analyzer remains a black box that we contract against by command-line interface, exactly as the spec intends.
