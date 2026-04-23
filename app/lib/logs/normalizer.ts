import type { AgentId, ArtifactHeader, NormalizedEvent } from './schema';

export interface NormalizerInput {
  raw: string;
  jobId: number;
  startedAt: string;
  endedAt: string | null;
}

export interface NormalizerOutput {
  header: ArtifactHeader;
  events: NormalizedEvent[];
}

function safeParseJson<T>(line: string): T | null {
  try {
    return JSON.parse(line) as T;
  } catch {
    return null;
  }
}

function isoNow(): string {
  return new Date().toISOString();
}

function buildHeader(agent: AgentId, input: NormalizerInput): ArtifactHeader {
  return {
    schemaVersion: 1,
    agent,
    jobId: input.jobId,
    startedAt: input.startedAt,
    endedAt: input.endedAt,
  };
}

interface ClaudeStreamEvent {
  type?: string;
  message?: {
    role?: 'assistant' | 'user' | 'system';
    content?: Array<{
      type: string;
      text?: string;
      thinking?: string;
      name?: string;
      id?: string;
      input?: unknown;
      tool_use_id?: string;
      content?: unknown;
      is_error?: boolean;
    }>;
  };
}

function normalizeAgentStream(
  agent: AgentId,
  input: NormalizerInput,
  parseLine: (line: string, ts: string) => NormalizedEvent[]
): NormalizerOutput {
  const header = buildHeader(agent, input);
  const lines = input.raw.split(/\r?\n/).filter((l) => l.length > 0);
  const events: NormalizedEvent[] = [];
  events.push({
    ts: header.startedAt,
    type: 'lifecycle',
    agent,
    payload: { kind: 'started' },
  });
  for (const line of lines) {
    const ts = isoNow();
    try {
      const parsed = parseLine(line, ts);
      events.push(...parsed);
    } catch (error) {
      events.push({
        ts,
        type: 'error',
        agent,
        payload: {
          message: error instanceof Error ? error.message : String(error),
        },
      });
    }
  }
  const lastTs = events[events.length - 1]?.ts ?? header.startedAt;
  events.push({
    ts: header.endedAt ?? lastTs,
    type: 'lifecycle',
    agent,
    payload: { kind: header.endedAt ? 'completed' : 'cancelled' },
  });
  return { header, events };
}

export function normalizeClaude(input: NormalizerInput): NormalizerOutput {
  return normalizeAgentStream('CLAUDE', input, (line, ts) => {
    const event = safeParseJson<ClaudeStreamEvent>(line);
    if (!event) {
      return [
        {
          ts,
          type: 'message',
          agent: 'CLAUDE',
          payload: { role: 'agent', text: line },
        },
      ];
    }
    const out: NormalizedEvent[] = [];
    const content = event.message?.content ?? [];
    const role = event.message?.role === 'user' ? 'user' : 'agent';
    for (const block of content) {
      if (block.type === 'text' && typeof block.text === 'string') {
        out.push({
          ts,
          type: 'message',
          agent: 'CLAUDE',
          payload: { role, text: block.text },
        });
      } else if (block.type === 'thinking' && typeof block.thinking === 'string') {
        out.push({
          ts,
          type: 'message',
          agent: 'CLAUDE',
          payload: { role: 'agent', text: '', thinking: block.thinking },
        });
      } else if (block.type === 'tool_use' && block.name && block.id) {
        out.push({
          ts,
          type: 'tool_invocation',
          agent: 'CLAUDE',
          payload: { toolName: block.name, toolCallId: String(block.id), input: block.input },
        });
      } else if (block.type === 'tool_result' && block.tool_use_id) {
        out.push({
          ts,
          type: 'tool_result',
          agent: 'CLAUDE',
          payload: {
            toolCallId: String(block.tool_use_id),
            output: block.content,
            isError: !!block.is_error,
          },
        });
      }
    }
    return out;
  });
}

export function normalizeCodex(input: NormalizerInput): NormalizerOutput {
  return normalizeAgentStream('CODEX', input, (line, ts) => {
    const event = safeParseJson<{
      type?: string;
      role?: string;
      content?: string;
      tool?: { name?: string; id?: string; input?: unknown };
      result?: { id?: string; output?: unknown; error?: boolean };
    }>(line);
    if (!event) {
      return [
        { ts, type: 'message', agent: 'CODEX', payload: { role: 'agent', text: line } },
      ];
    }
    if (event.tool?.name) {
      return [
        {
          ts,
          type: 'tool_invocation',
          agent: 'CODEX',
          payload: {
            toolName: event.tool.name,
            toolCallId: String(event.tool.id ?? ''),
            input: event.tool.input,
          },
        },
      ];
    }
    if (event.result) {
      return [
        {
          ts,
          type: 'tool_result',
          agent: 'CODEX',
          payload: {
            toolCallId: String(event.result.id ?? ''),
            output: event.result.output,
            isError: !!event.result.error,
          },
        },
      ];
    }
    if (typeof event.content === 'string') {
      const role = event.role === 'user' ? 'user' : event.role === 'system' ? 'system' : 'agent';
      return [
        { ts, type: 'message', agent: 'CODEX', payload: { role, text: event.content } },
      ];
    }
    return [];
  });
}

export function normalizeMistral(input: NormalizerInput): NormalizerOutput {
  return normalizeAgentStream('MISTRAL', input, (line, ts) => {
    const event = safeParseJson<{
      kind?: string;
      role?: string;
      text?: string;
      tool_name?: string;
      tool_call_id?: string;
      tool_input?: unknown;
      tool_output?: unknown;
      is_error?: boolean;
    }>(line);
    if (!event) {
      return [
        { ts, type: 'message', agent: 'MISTRAL', payload: { role: 'agent', text: line } },
      ];
    }
    if (event.kind === 'tool_call' && event.tool_name) {
      return [
        {
          ts,
          type: 'tool_invocation',
          agent: 'MISTRAL',
          payload: {
            toolName: event.tool_name,
            toolCallId: String(event.tool_call_id ?? ''),
            input: event.tool_input,
          },
        },
      ];
    }
    if (event.kind === 'tool_result') {
      return [
        {
          ts,
          type: 'tool_result',
          agent: 'MISTRAL',
          payload: {
            toolCallId: String(event.tool_call_id ?? ''),
            output: event.tool_output,
            isError: !!event.is_error,
          },
        },
      ];
    }
    if (typeof event.text === 'string') {
      const role = event.role === 'user' ? 'user' : event.role === 'system' ? 'system' : 'agent';
      return [
        { ts, type: 'message', agent: 'MISTRAL', payload: { role, text: event.text } },
      ];
    }
    return [];
  });
}

export function normalizeGemini(input: NormalizerInput): NormalizerOutput {
  return normalizeAgentStream('GEMINI', input, (line, ts) => {
    const event = safeParseJson<{
      role?: string;
      parts?: Array<{
        text?: string;
        functionCall?: { name?: string; args?: unknown };
        functionResponse?: { name?: string; response?: unknown };
      }>;
    }>(line);
    if (!event) {
      return [
        { ts, type: 'message', agent: 'GEMINI', payload: { role: 'agent', text: line } },
      ];
    }
    const out: NormalizedEvent[] = [];
    const role = event.role === 'user' ? 'user' : event.role === 'system' ? 'system' : 'agent';
    for (const part of event.parts ?? []) {
      if (typeof part.text === 'string') {
        out.push({ ts, type: 'message', agent: 'GEMINI', payload: { role, text: part.text } });
      } else if (part.functionCall?.name) {
        out.push({
          ts,
          type: 'tool_invocation',
          agent: 'GEMINI',
          payload: {
            toolName: part.functionCall.name,
            toolCallId: part.functionCall.name,
            input: part.functionCall.args,
          },
        });
      } else if (part.functionResponse?.name) {
        out.push({
          ts,
          type: 'tool_result',
          agent: 'GEMINI',
          payload: {
            toolCallId: part.functionResponse.name,
            output: part.functionResponse.response,
            isError: false,
          },
        });
      }
    }
    return out;
  });
}
