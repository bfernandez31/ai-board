/**
 * Job log normalization utilities.
 *
 * Raw agent output varies by agent (Claude Code streams JSON events, Codex
 * streams plain text with OTLP-style headers, Mistral/vibe emits its own
 * prompt/response turns, Gemini mixes prose with tool call summaries).
 * These helpers produce a single, readable normalized form that is safe to
 * store in Postgres and render in the UI.
 */

export const MAX_LOG_CONTENT_BYTES = 1_000_000;
export const MAX_SUMMARY_CHARS = 500;
const TRUNCATION_NOTE = '[… truncated, original stream exceeded 1 MB]';

export type AgentKind = 'CLAUDE' | 'CODEX' | 'MISTRAL' | 'GEMINI' | 'UNKNOWN';

export interface NormalizedLog {
  content: string;
  summary: string;
  truncated: boolean;
  byteSize: number;
  eventCount: number;
  agent: AgentKind;
}

// ANSI escape: ESC () + [ + params + final byte.
const ANSI_PATTERN = /\[[0-?]*[ -/]*[@-~]/g;
const CARRIAGE_RETURN_OVERWRITE = /\r(?!\n)/g;

function stripAnsi(input: string): string {
  return input.replace(ANSI_PATTERN, '').replace(CARRIAGE_RETURN_OVERWRITE, '\n');
}

function truncateContent(input: string): { content: string; truncated: boolean } {
  const byteLength = Buffer.byteLength(input, 'utf8');
  if (byteLength <= MAX_LOG_CONTENT_BYTES) {
    return { content: input, truncated: false };
  }
  // Keep the tail — that is usually where failures surface.
  const tail = Buffer.from(input, 'utf8').subarray(byteLength - MAX_LOG_CONTENT_BYTES);
  const decoded = tail.toString('utf8');
  return {
    content: TRUNCATION_NOTE + '\n\n' + decoded,
    truncated: true,
  };
}

function tryParseJson(line: string): Record<string, unknown> | null {
  const trimmed = line.trim();
  if (!trimmed.startsWith('{') || !trimmed.endsWith('}')) return null;
  try {
    const parsed = JSON.parse(trimmed);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
    return null;
  } catch {
    return null;
  }
}

function formatTimestamp(value: unknown): string {
  if (typeof value === 'string') {
    const d = new Date(value);
    if (!isNaN(d.getTime())) return d.toISOString();
    return value;
  }
  if (typeof value === 'number') {
    const d = new Date(value);
    if (!isNaN(d.getTime())) return d.toISOString();
  }
  return new Date().toISOString();
}

/**
 * Extract a human-readable line from a single Claude Code stream-json event.
 * Returns null if the event does not translate cleanly.
 */
function renderClaudeEvent(event: Record<string, unknown>): string | null {
  const ts = formatTimestamp(event['timestamp'] ?? event['time']);
  const type = typeof event['type'] === 'string' ? event['type'] : null;
  if (!type) return null;

  if (type === 'assistant' || type === 'message') {
    const message = event['message'] as Record<string, unknown> | undefined;
    const content = message?.['content'];
    if (Array.isArray(content)) {
      const texts: string[] = [];
      for (const block of content) {
        if (block && typeof block === 'object') {
          const b = block as Record<string, unknown>;
          if (b['type'] === 'text' && typeof b['text'] === 'string') {
            texts.push(b['text'] as string);
          }
          if (b['type'] === 'tool_use' && typeof b['name'] === 'string') {
            texts.push(`[tool] ${b['name']}`);
          }
        }
      }
      if (texts.length > 0) {
        return `[${ts}] assistant: ${texts.join(' ').trim()}`;
      }
    }
    return null;
  }

  if (type === 'tool_use') {
    const name = typeof event['name'] === 'string' ? event['name'] : 'unknown';
    return `[${ts}] tool_use: ${name}`;
  }

  if (type === 'tool_result' || type === 'user') {
    const content = typeof event['content'] === 'string' ? event['content'] : '';
    if (content) {
      const preview = content.length > 240 ? content.slice(0, 240) + '…' : content;
      return `[${ts}] tool_result: ${preview}`;
    }
    return null;
  }

  if (type === 'error') {
    const message = typeof event['message'] === 'string' ? event['message'] : JSON.stringify(event);
    return `[${ts}] ERROR: ${message}`;
  }

  return null;
}

function detectAgent(raw: string): AgentKind {
  if (/\bclaude_code\./.test(raw) || /"type":"assistant"/.test(raw)) return 'CLAUDE';
  if (/codex_cli|Codex CLI|\[codex\]/i.test(raw)) return 'CODEX';
  if (/vibe CLI|mistral|\[vibe\]|VIBE_/i.test(raw)) return 'MISTRAL';
  if (/gemini_cli|Gemini CLI|\[gemini\]/i.test(raw)) return 'GEMINI';
  return 'UNKNOWN';
}

function isValidAgent(value: unknown): value is AgentKind {
  return value === 'CLAUDE' || value === 'CODEX' || value === 'MISTRAL' || value === 'GEMINI' || value === 'UNKNOWN';
}

function buildSummary(lines: string[]): string {
  if (lines.length === 0) return '';

  // Prefer the last error line if one is present — the user cares most when something failed.
  const errorLine = [...lines].reverse().find((line) => /(^|\s)(error|failed|traceback|exception)(:|\s|$)/i.test(line));
  if (errorLine) {
    const trimmed = errorLine.trim();
    return trimmed.length > MAX_SUMMARY_CHARS ? trimmed.slice(0, MAX_SUMMARY_CHARS - 1) + '…' : trimmed;
  }

  // Otherwise, use the last few non-empty lines.
  const tail = lines.slice(-3).join(' · ').trim();
  return tail.length > MAX_SUMMARY_CHARS ? tail.slice(0, MAX_SUMMARY_CHARS - 1) + '…' : tail;
}

export function normalizeAgentLog(
  raw: string,
  options: { agent?: AgentKind | string | null | undefined } = {}
): NormalizedLog {
  const safeRaw = raw ?? '';
  const byteSize = Buffer.byteLength(safeRaw, 'utf8');
  const sanitized = stripAnsi(safeRaw);
  const lines = sanitized.split(/\r?\n/);
  const rendered: string[] = [];
  let eventCount = 0;

  for (const line of lines) {
    if (!line.trim()) continue;
    const parsed = tryParseJson(line);
    if (parsed) {
      const claudeLine = renderClaudeEvent(parsed);
      if (claudeLine) {
        rendered.push(claudeLine);
        eventCount += 1;
        continue;
      }
      // Fallback: render generic JSON objects compactly without raw dump.
      const type = typeof parsed['type'] === 'string' ? parsed['type'] : 'event';
      const summary = Object.entries(parsed)
        .filter(([k]) => k !== 'type' && k !== 'message')
        .slice(0, 4)
        .map(([k, v]) => `${k}=${typeof v === 'object' ? '…' : String(v).slice(0, 80)}`)
        .join(' ');
      rendered.push(`[event] ${type} ${summary}`.trim());
      eventCount += 1;
      continue;
    }
    rendered.push(line);
  }

  const suppliedAgent = options.agent as AgentKind | string | null | undefined;
  const agent: AgentKind = isValidAgent(suppliedAgent) ? suppliedAgent : detectAgent(safeRaw);

  const body = rendered.join('\n');
  const { content, truncated } = truncateContent(body);

  return {
    content,
    summary: buildSummary(rendered),
    truncated,
    byteSize,
    eventCount,
    agent,
  };
}
