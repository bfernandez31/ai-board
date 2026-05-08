# Contract: redactNativeJsonl

**New helper.** Added to **both** `app/lib/logs/redactor.ts` (TypeScript, server) and `.github/scripts/lib/redactor.mjs` (ESM, runner). Both copies MUST stay in sync.

## Signature

```ts
export function redactNativeJsonl(line: string): string;
```

## Semantics

- **Empty / whitespace-only input** → returned as-is.
- **Valid JSON object** → parsed, `deepRedact()` walks the tree applying `redactString()` to every string-valued field at every nesting depth, then re-serialized via `JSON.stringify` (no pretty-printing — single line).
- **Valid JSON array** → same as object: walked via `deepRedact()` and re-serialized.
- **Valid JSON scalar** (string/number/bool/null) → if string, run `redactString()`; otherwise return as-is.
- **Malformed JSON** → fallback: return `redactString(line)` to ensure no plaintext secret can survive in an unparseable payload. **MUST NOT** throw.

## Why a new helper (not `redactEvents()`)
`redactEvents()` switches on the *normalized* event type discriminator (`message`, `tool_invocation`, `tool_result`, `error`, `lifecycle`). Native Claude Code session events use entirely different shapes (`user`, `assistant`, `tool_use`, `summary`, etc.) — `redactEvents()` would silently no-op them. `redactNativeJsonl` uses the type-agnostic `deepRedact()` walker instead.

## Pattern coverage
Identical to `redactEvents()` because both delegate to `redactString()`:
- GitHub PATs (`ghp_...`, `github_pat_...`)
- OAuth bearer tokens (`Authorization: Bearer ...`)
- Private keys (RSA, EC, OpenSSH PEM blocks)
- Anthropic, OpenAI, Google, Mistral API keys
- Generic `KEY=VALUE` env-secret pairs

## Performance
Each line is parsed once and serialized once. For a 5 MB compressed (≈40 MB uncompressed) raw artifact at ≈500 bytes/event, this is ≈80k parses/serializes — comfortably within the runner's per-job budget. No batching needed.

## Caller contract (runner-side)
The runner reads `${CLAUDE_AGGREGATED}` line-by-line (existing pattern in `normalize-base.mjs`'s `readLines`), pipes each line through `redactNativeJsonl`, and writes the result to `${TMPDIR}/agent-redacted-raw-${JOB_ID}.jsonl`. Then `gzip -c` the file and PUT it.

## Caller contract (server-side)
**Not invoked server-side for capture** — the server never sees the unredacted raw stream. The TypeScript export exists solely for **unit testability** and **as a hedge against the future addition of a server-side raw transformer**. No server-side caller is added in this ticket.
