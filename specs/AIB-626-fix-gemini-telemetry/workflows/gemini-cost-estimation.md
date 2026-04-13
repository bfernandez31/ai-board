# Workflow Artifact: Gemini Cost Estimation

## Workflow Definition

### Input

- normalized Gemini job usage
- normalized Gemini model name
- Gemini pricing table

### Phases

1. Map the runtime model string to a supported Gemini pricing family.
2. Calculate category-level billable amounts for input, output, thinking, and cache usage.
3. Store total estimated cost when pricing exists.
4. Mark cost unavailable when no pricing rule exists.

## Output

- estimated `costUsd` when pricing exists
- explicit unavailable-cost state when pricing does not exist

## Error behavior

- Unknown models do not block telemetry persistence.
- Cost failures must not erase already recorded usage or tool metrics.
