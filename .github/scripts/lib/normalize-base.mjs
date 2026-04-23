// Shared helpers for runner-side agent normalizers. Emits NDJSON events to
// stdout (NOT including the header line — the capture script owns the header).

function isoNow() {
  return new Date().toISOString();
}

function safeJson(line) {
  try {
    return JSON.parse(line);
  } catch {
    return null;
  }
}

export function readLines(raw) {
  return raw.split(/\r?\n/).filter((l) => l.length > 0);
}

export function emit(events) {
  for (const e of events) {
    process.stdout.write(JSON.stringify(e) + '\n');
  }
}

export function started(agent, ts) {
  return { ts: ts ?? isoNow(), type: 'lifecycle', agent, payload: { kind: 'started' } };
}

export function ended(agent, kind, detail, ts) {
  const payload = { kind };
  if (detail) payload.detail = detail;
  return { ts: ts ?? isoNow(), type: 'lifecycle', agent, payload };
}

export function messageEvent(agent, role, text, thinking) {
  const payload = { role, text };
  if (thinking) payload.thinking = thinking;
  return { ts: isoNow(), type: 'message', agent, payload };
}

export function toolInvocationEvent(agent, toolName, toolCallId, input) {
  return {
    ts: isoNow(),
    type: 'tool_invocation',
    agent,
    payload: { toolName, toolCallId: String(toolCallId ?? ''), input },
  };
}

export function toolResultEvent(agent, toolCallId, output, isError) {
  return {
    ts: isoNow(),
    type: 'tool_result',
    agent,
    payload: { toolCallId: String(toolCallId ?? ''), output, isError: !!isError },
  };
}

export { safeJson, isoNow };
