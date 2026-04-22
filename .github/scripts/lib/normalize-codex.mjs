#!/usr/bin/env node
// Usage: node normalize-codex.mjs <raw-log-path>
// Reads Codex NDJSON stdout; emits v1 NormalizedEvent lines to stdout.

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

const AGENT = 'CODEX';

function mapEvent(event) {
  if (!event || typeof event !== 'object') return [];
  const out = [];
  if (event.tool && event.tool.name) {
    out.push(toolInvocationEvent(AGENT, event.tool.name, event.tool.id, event.tool.input ?? null));
  }
  if (event.result) {
    out.push(
      toolResultEvent(AGENT, event.result.id, event.result.output ?? null, !!event.result.error)
    );
  }
  if (typeof event.content === 'string') {
    const role = event.role === 'user' ? 'user' : event.role === 'system' ? 'system' : 'agent';
    out.push(messageEvent(AGENT, role, event.content));
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
  emit([ended(AGENT, process.env.CAPTURE_END_KIND || 'completed')]);
}

main();
