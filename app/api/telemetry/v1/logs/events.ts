/**
 * Multi-agent OTLP event name constants.
 *
 * Claude Code and Codex emit different event names but carry compatible
 * attribute schemas, so we simply widen the event-name filter sets.
 */

/** Events that carry API-request metrics (tokens, cost, model, duration). */
export const API_REQUEST_EVENTS: ReadonlyArray<string> = [
  'claude_code.api_request',
  'codex.api_request',
];

/** Events that carry tool-usage information. */
export const TOOL_EVENTS: ReadonlyArray<string> = [
  'claude_code.tool_result',
  'claude_code.tool_decision',
  'codex.tool.call',
];
