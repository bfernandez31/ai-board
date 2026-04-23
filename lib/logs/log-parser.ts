import type { NormalizedLogEntry, LogEventType } from './types';

const TOOL_PATTERNS_CLAUDE = [
  /^>\s*(Read|Edit|Write|Bash|Glob|Grep|Search|TodoWrite)\s*(?:file)?:?\s*(.*)/i,
  /^>\s*(Bash):\s*(.*)/i,
];

const TOOL_PATTERNS_CODEX = [
  /^(?:Running|Writing|Reading|Editing):\s*(.*)/i,
];

const TOOL_PATTERNS_MISTRAL = [
  /^Tool call:\s*(\w+)\((.*)\)/i,
];

const TOOL_PATTERNS_GEMINI = [
  /^Using tool:\s*(\w+)/i,
];

const ERROR_PATTERNS = [
  /^Error:/i,
  /^error\s*TS\d+:/i,
  /TypeError:/i,
  /ReferenceError:/i,
  /SyntaxError:/i,
  /FATAL/i,
  /FAIL/i,
  /✗|✘|❌/,
  /^fatal:/i,
];

function isErrorLine(line: string): boolean {
  return ERROR_PATTERNS.some((p) => p.test(line));
}

function makeEntry(eventType: LogEventType, content: string, metadata?: Record<string, unknown>): NormalizedLogEntry {
  return { timestamp: new Date().toISOString(), eventType, content, ...(metadata ? { metadata } : {}) };
}

function flushBuffer(buffer: string[], entries: NormalizedLogEntry[]): void {
  if (buffer.length === 0) return;
  const text = buffer.join('\n').trim();
  if (text) {
    entries.push(makeEntry(isErrorLine(text) ? 'error' : 'message', text));
  }
  buffer.length = 0;
}

function matchTool(line: string, patterns: RegExp[]): RegExpMatchArray | null {
  for (const pattern of patterns) {
    const match = line.match(pattern);
    if (match) return match;
  }
  return null;
}

function parseClaudeOutput(raw: string): NormalizedLogEntry[] {
  const entries: NormalizedLogEntry[] = [];
  const buffer: string[] = [];

  for (const line of raw.split('\n')) {
    const match = matchTool(line, TOOL_PATTERNS_CLAUDE);
    if (match) {
      flushBuffer(buffer, entries);
      entries.push(makeEntry('tool_invocation', line.replace(/^>\s*/, ''), { tool: match[1] }));
    } else {
      buffer.push(line);
    }
  }
  flushBuffer(buffer, entries);
  return entries;
}

function parseCodexOutput(raw: string): NormalizedLogEntry[] {
  const entries: NormalizedLogEntry[] = [];
  const buffer: string[] = [];

  for (const line of raw.split('\n')) {
    const match = matchTool(line, TOOL_PATTERNS_CODEX);
    if (match) {
      flushBuffer(buffer, entries);
      entries.push(makeEntry('tool_invocation', line.trim(), { detail: match[1] }));
    } else if (line.startsWith('Output:')) {
      flushBuffer(buffer, entries);
      entries.push(makeEntry('tool_result', line.replace(/^Output:\s*/, '').trim()));
    } else {
      buffer.push(line);
    }
  }
  flushBuffer(buffer, entries);
  return entries;
}

function parseMistralOutput(raw: string): NormalizedLogEntry[] {
  const entries: NormalizedLogEntry[] = [];
  const buffer: string[] = [];

  for (const line of raw.split('\n')) {
    const match = matchTool(line, TOOL_PATTERNS_MISTRAL);
    if (match) {
      flushBuffer(buffer, entries);
      entries.push(makeEntry('tool_invocation', line.trim(), { tool: match[1], args: match[2] }));
    } else if (line.startsWith('Result:')) {
      flushBuffer(buffer, entries);
      entries.push(makeEntry('tool_result', line.replace(/^Result:\s*/, '').trim()));
    } else {
      buffer.push(line);
    }
  }
  flushBuffer(buffer, entries);
  return entries;
}

function parseGeminiOutput(raw: string): NormalizedLogEntry[] {
  const entries: NormalizedLogEntry[] = [];
  const buffer: string[] = [];

  for (const line of raw.split('\n')) {
    const match = matchTool(line, TOOL_PATTERNS_GEMINI);
    if (match) {
      flushBuffer(buffer, entries);
      entries.push(makeEntry('tool_invocation', line.trim(), { tool: match[1] }));
      continue;
    }

    if (line.startsWith('Path:')) {
      const lastEntry = entries.at(-1);
      if (lastEntry && lastEntry.eventType === 'tool_invocation') {
        lastEntry.metadata = {
          ...lastEntry.metadata,
          path: line.replace(/^Path:\s*/, '').trim(),
        };
      }
    } else {
      buffer.push(line);
    }
  }
  flushBuffer(buffer, entries);
  return entries;
}

const PARSERS: Record<string, (raw: string) => NormalizedLogEntry[]> = {
  CLAUDE: parseClaudeOutput,
  CODEX: parseCodexOutput,
  MISTRAL: parseMistralOutput,
  GEMINI: parseGeminiOutput,
};

export function parseAgentOutput(rawOutput: string, agentType: string): NormalizedLogEntry[] {
  const trimmed = rawOutput.trim();
  if (!trimmed) {
    return [makeEntry('message', rawOutput || '(empty output)')];
  }

  const parser = PARSERS[agentType];
  if (!parser) {
    return [makeEntry('message', trimmed)];
  }

  try {
    const entries = parser(trimmed);
    if (entries.length === 0) {
      return [makeEntry('message', trimmed)];
    }
    return entries;
  } catch {
    return [makeEntry('message', trimmed)];
  }
}
