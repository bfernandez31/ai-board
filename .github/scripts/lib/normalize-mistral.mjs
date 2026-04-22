#!/usr/bin/env node
// Usage: node normalize-mistral.mjs <raw-log-path>
// Reads Mistral/vibe output lines; emits v1 NormalizedEvent NDJSON to stdout.

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

const AGENT = 'MISTRAL';

function mapEvent(event) {
  if (!event || typeof event !== 'object') return [];
  const out = [];
  if (event.kind === 'tool_call' && event.tool_name) {
    out.push(
      toolInvocationEvent(AGENT, event.tool_name, event.tool_call_id, event.tool_input ?? null)
    );
    return out;
  }
  if (event.kind === 'tool_result') {
    out.push(
      toolResultEvent(AGENT, event.tool_call_id, event.tool_output ?? null, !!event.is_error)
    );
    return out;
  }
  if (typeof event.text === 'string') {
    const role = event.role === 'user' ? 'user' : event.role === 'system' ? 'system' : 'agent';
    out.push(messageEvent(AGENT, role, event.text));
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
