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

function makeTimestamp(): string {
  return new Date().toISOString();
}

function makeEntry(eventType: LogEventType, content: string, metadata?: Record<string, unknown>): NormalizedLogEntry {
  return { timestamp: makeTimestamp(), eventType, content, ...(metadata ? { metadata } : {}) };
}

function parseClaudeOutput(raw: string): NormalizedLogEntry[] {
  const lines = raw.split('\n');
  const entries: NormalizedLogEntry[] = [];
  let messageBuffer: string[] = [];

  function flushMessage(): void {
    if (messageBuffer.length > 0) {
      const text = messageBuffer.join('\n').trim();
      if (text) {
        entries.push(makeEntry(isErrorLine(text) ? 'error' : 'message', text));
      }
      messageBuffer = [];
    }
  }

  for (const line of lines) {
    let matched = false;
    for (const pattern of TOOL_PATTERNS_CLAUDE) {
      const match = line.match(pattern);
      if (match) {
        flushMessage();
        entries.push(makeEntry('tool_invocation', line.replace(/^>\s*/, ''), { tool: match[1] }));
        matched = true;
        break;
      }
    }
    if (!matched) {
      messageBuffer.push(line);
    }
  }
  flushMessage();
  return entries;
}

function parseCodexOutput(raw: string): NormalizedLogEntry[] {
  const lines = raw.split('\n');
  const entries: NormalizedLogEntry[] = [];
  let messageBuffer: string[] = [];

  function flushMessage(): void {
    if (messageBuffer.length > 0) {
      const text = messageBuffer.join('\n').trim();
      if (text) {
        entries.push(makeEntry(isErrorLine(text) ? 'error' : 'message', text));
      }
      messageBuffer = [];
    }
  }

  for (const line of lines) {
    let matched = false;
    for (const pattern of TOOL_PATTERNS_CODEX) {
      const match = line.match(pattern);
      if (match) {
        flushMessage();
        entries.push(makeEntry('tool_invocation', line.trim(), { detail: match[1] }));
        matched = true;
        break;
      }
    }

    if (!matched) {
      if (line.startsWith('Output:')) {
        flushMessage();
        entries.push(makeEntry('tool_result', line.replace(/^Output:\s*/, '').trim()));
      } else {
        messageBuffer.push(line);
      }
    }
  }
  flushMessage();
  return entries;
}

function parseMistralOutput(raw: string): NormalizedLogEntry[] {
  const lines = raw.split('\n');
  const entries: NormalizedLogEntry[] = [];
  let messageBuffer: string[] = [];

  function flushMessage(): void {
    if (messageBuffer.length > 0) {
      const text = messageBuffer.join('\n').trim();
      if (text) {
        entries.push(makeEntry(isErrorLine(text) ? 'error' : 'message', text));
      }
      messageBuffer = [];
    }
  }

  for (const line of lines) {
    let matched = false;
    for (const pattern of TOOL_PATTERNS_MISTRAL) {
      const match = line.match(pattern);
      if (match) {
        flushMessage();
        entries.push(makeEntry('tool_invocation', line.trim(), { tool: match[1], args: match[2] }));
        matched = true;
        break;
      }
    }

    if (!matched) {
      if (line.startsWith('Result:')) {
        flushMessage();
        entries.push(makeEntry('tool_result', line.replace(/^Result:\s*/, '').trim()));
      } else {
        messageBuffer.push(line);
      }
    }
  }
  flushMessage();
  return entries;
}

function parseGeminiOutput(raw: string): NormalizedLogEntry[] {
  const lines = raw.split('\n');
  const entries: NormalizedLogEntry[] = [];
  let messageBuffer: string[] = [];

  function flushMessage(): void {
    if (messageBuffer.length > 0) {
      const text = messageBuffer.join('\n').trim();
      if (text) {
        entries.push(makeEntry(isErrorLine(text) ? 'error' : 'message', text));
      }
      messageBuffer = [];
    }
  }

  for (const line of lines) {
    let matched = false;
    for (const pattern of TOOL_PATTERNS_GEMINI) {
      const match = line.match(pattern);
      if (match) {
        flushMessage();
        entries.push(makeEntry('tool_invocation', line.trim(), { tool: match[1] }));
        matched = true;
        break;
      }
    }

    if (!matched) {
      if (line.startsWith('Path:')) {
        const lastEntry = entries[entries.length - 1];
        if (lastEntry && lastEntry.eventType === 'tool_invocation') {
          lastEntry.metadata = {
            ...lastEntry.metadata,
            path: line.replace(/^Path:\s*/, '').trim(),
          };
        }
      } else {
        messageBuffer.push(line);
      }
    }
  }
  flushMessage();
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
