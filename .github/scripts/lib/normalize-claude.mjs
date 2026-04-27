#!/usr/bin/env node
// Reads a Claude Code session JSONL (or legacy stream-json stdout) and emits
// v1 NormalizedEvent NDJSON. Session files include synthetic CLI caveats and
// file-history snapshots that must be filtered before redaction so the
// artifact stays focused on the agent narrative.

import fs from 'node:fs';
import {
  emit,
  readLines,
  safeJson,
  messageEvent,
  started,
  ended,
} from './normalize-base.mjs';

const AGENT = 'CLAUDE';

const SKIPPED_EVENT_TYPES = new Set(['file-history-snapshot', 'system', 'summary']);

function mapBlock(block, role, ts) {
  if (!block || typeof block !== 'object') return null;
  if (block.type === 'text' && typeof block.text === 'string') {
    return { ts, type: 'message', agent: AGENT, payload: { role, text: block.text } };
  }
  if (block.type === 'thinking' && typeof block.thinking === 'string') {
    return {
      ts,
      type: 'message',
      agent: AGENT,
      payload: { role: 'agent', text: '', thinking: block.thinking },
    };
  }
  if (block.type === 'tool_use' && block.id && block.name) {
    return {
      ts,
      type: 'tool_invocation',
      agent: AGENT,
      payload: { toolName: block.name, toolCallId: String(block.id), input: block.input ?? null },
    };
  }
  if (block.type === 'tool_result' && block.tool_use_id) {
    return {
      ts,
      type: 'tool_result',
      agent: AGENT,
      payload: {
        toolCallId: String(block.tool_use_id),
        output: block.content ?? null,
        isError: !!block.is_error,
      },
    };
  }
  return null;
}

function mapEvent(event) {
  if (!event || typeof event !== 'object') return [];
  if (event.isMeta) return [];
  if (event.type && SKIPPED_EVENT_TYPES.has(event.type)) return [];

  const message = event.message;
  if (!message || typeof message !== 'object') return [];

  const role = message.role === 'user' ? 'user' : 'agent';
  const ts = typeof event.timestamp === 'string' ? event.timestamp : new Date().toISOString();
  const content = message.content;

  if (typeof content === 'string') {
    const trimmed = content.trim();
    return trimmed ? [{ ts, type: 'message', agent: AGENT, payload: { role, text: trimmed } }] : [];
  }

  if (!Array.isArray(content)) return [];

  const out = [];
  for (const block of content) {
    const ev = mapBlock(block, role, ts);
    if (ev) out.push(ev);
  }
  return out;
}

function main() {
  const raw = fs.readFileSync(process.argv[2] ?? 0, 'utf-8');
  emit([started(AGENT)]);
  for (const line of readLines(raw)) {
    const parsed = safeJson(line);
    if (!parsed) {
      emit([messageEvent(AGENT, 'agent', line)]);
      continue;
    }
    emit(mapEvent(parsed));
  }
  const endedKind = process.env.CAPTURE_END_KIND || 'completed';
  emit([ended(AGENT, endedKind)]);
}

main();
