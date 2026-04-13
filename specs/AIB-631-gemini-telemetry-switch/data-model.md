# Data Model: Gemini OTLP Telemetry Mapping

This document describes how native Gemini OTLP log attributes are mapped to the `Job` model in the database.

## Entity: Job (Existing)

| Field | Source OTLP Attribute (gemini_cli.api_response) | Description |
|-------|-----------------------------------------------|-------------|
| `inputTokens` | `gemini_cli.usage.input_tokens` | Non-cached prompt tokens. |
| `outputTokens` | `gemini_cli.usage.output_tokens` | Completion tokens. |
| `thinkingTokens` | `gemini_cli.usage.thinking_tokens` | Reasoning/thinking tokens. |
| `cacheReadTokens` | `gemini_cli.usage.cache_read_tokens` | Tokens read from cache. |
| `cacheCreationTokens` | `gemini_cli.usage.cache_creation_tokens` | Tokens written to cache. |
| `durationMs` | `gemini_cli.duration_ms` | Execution time in milliseconds. |
| `model` | `gemini_cli.model` | Gemini model name (e.g., "gemini-2.5-pro"). |
| `toolsUsed` | `gemini_cli.tool_name` (from `gemini_cli.tool_call` event) | List of tools invoked. |
| `costUsd` | *Calculated* | Derived from tokens and model using `estimateGeminiCost`. |

## State Transitions

- **Ingestion**: OTLP logs are received in batches.
- **Merge Logic**: `inputTokens`, `outputTokens`, `thinkingTokens`, `cacheReadTokens`, `cacheCreationTokens`, and `durationMs` are **accumulated** (summed) by default in OTLP mode.
- **Tool Logic**: Tool names are **deduplicated** (Set union) across all events.
- **Cost Logic**: Costs are re-estimated whenever tokens or model are updated.

## Validation Rules

- **Token Counts**: Must be non-negative integers.
- **Model**: Must be a string. Known models trigger estimation; unknown models result in `costStatus='UNAVAILABLE'`.
- **Job ID**: Must be present in OTLP `resource.attributes` as `job_id`.
