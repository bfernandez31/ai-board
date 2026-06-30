# Internal Process: VERIFY Review — Layer Decomposition

Extends the existing VERIFY code-review (`.claude-plugin/commands/ai-board.code-review.md`,
run by `.github/workflows/verify.yml`) to emit a layer-decomposition artifact in addition to
the quality score. **No new workflow file** — additive steps in the existing chain.

## Inputs
- The PR's changed file set (already loaded by the review).
- The review's existing understanding of the change (same context; no extra LLM analysis cost
  beyond a small decomposition step — SC-002).

## Phases (added to the command)
1. Identify the PR's changed files (already available to the review).
2. Group related files into semantic layers (schema/contracts → business logic → call sites →
   front-end → tests).
3. Order layers by dependency (`order` 1..N).
4. Assign each layer a short `title` and one-line `summary`.
5. Emit the `LAYER_DECOMPOSITION_JSON:` line (see contract) on its own line, **before** the
   mandatory final `QUALITY_SCORE_JSON:` line.

## Output
- A `LayerDecompositionArtifact` JSON string, persisted to `Job.layerDecomposition` for the
  COMPLETED verify job (via the existing PATCH path).

## Error behavior
- If decomposition is unavailable/fails, emit **no** `LAYER_DECOMPOSITION_JSON:` line → no
  artifact stored → viewer falls back to flat Files mode (FR-014). Must never block or fail the
  review, and must never alter the `QUALITY_SCORE_JSON:` ordering.

## Command / workflow edits
- **`.claude-plugin/commands/ai-board.code-review.md`**: add a step producing the marker line;
  reaffirm `QUALITY_SCORE_JSON:` remains the absolute-last output.
- **`.github/workflows/verify.yml`** (Read Quality Score step, ~L702-729): add an independent
  grep for `LAYER_DECOMPOSITION_JSON:` (NOT `tail -1`), base64 it, expose
  `layer_decomposition_b64` + `has_layers`; include `layerDecomposition` in the COMPLETED PATCH
  payload (~L731-751).

## Reporting contract
Reported back exactly like the quality score: agent stdout marker → workflow parse → single
`PATCH /api/jobs/:id/status` (COMPLETED) → persisted nullable JSON string.
