#!/usr/bin/env node
// Usage: node normalize-claude.mjs <raw-log-path>
// Reads Claude stream-json stdout (one JSON event per line), emits v1
// NormalizedEvent NDJSON to stdout (no header — capture script writes it).

import fs from 'node:fs';
import {
  emit,
  readLines,
  safeJson,
  messageEvent,
  toolInvocationEvent,
  toolResultEvent,
  started,
  ended,
} from './normalize-base.mjs';

const AGENT = 'CLAUDE';

function mapEvent(event) {
  if (!event || typeof event !== 'object') return [];
  const content = event.message?.content ?? [];
  const role = event.message?.role === 'user' ? 'user' : 'agent';
  const out = [];
  for (const block of content) {
    if (!block || typeof block !== 'object') continue;
    if (block.type === 'text' && typeof block.text === 'string') {
      out.push(messageEvent(AGENT, role, block.text));
    } else if (block.type === 'thinking' && typeof block.thinking === 'string') {
      out.push(messageEvent(AGENT, 'agent', '', block.thinking));
    } else if (block.type === 'tool_use' && block.id && block.name) {
      out.push(toolInvocationEvent(AGENT, block.name, block.id, block.input ?? null));
    } else if (block.type === 'tool_result' && block.tool_use_id) {
      out.push(toolResultEvent(AGENT, block.tool_use_id, block.content ?? null, !!block.is_error));
    }
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
