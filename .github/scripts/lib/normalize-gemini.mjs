#!/usr/bin/env node
// Usage: node normalize-gemini.mjs <raw-log-path>
// Reads Gemini NDJSON stdout; emits v1 NormalizedEvent NDJSON to stdout.

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

const AGENT = 'GEMINI';

function mapEvent(event) {
  if (!event || typeof event !== 'object' || !Array.isArray(event.parts)) return [];
  const role = event.role === 'user' ? 'user' : event.role === 'system' ? 'system' : 'agent';
  const out = [];
  for (const part of event.parts) {
    if (!part) continue;
    if (typeof part.text === 'string') {
      out.push(messageEvent(AGENT, role, part.text));
    } else if (part.functionCall && part.functionCall.name) {
      out.push(
        toolInvocationEvent(AGENT, part.functionCall.name, part.functionCall.name, part.functionCall.args ?? null)
      );
    } else if (part.functionResponse && part.functionResponse.name) {
      out.push(
        toolResultEvent(AGENT, part.functionResponse.name, part.functionResponse.response ?? null, false)
      );
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
  emit([ended(AGENT, process.env.CAPTURE_END_KIND || 'completed')]);
}

main();
