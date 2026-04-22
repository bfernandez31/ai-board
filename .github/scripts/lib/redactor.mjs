// ESM sibling of app/lib/logs/redactor.ts. Runs on Ubuntu GitHub Actions
// runners before any artifact leaves the machine. Patterns MUST stay in sync
// with the TypeScript module — keep both lists identical.

const PATTERNS = [
  { kind: 'github_token', regex: /\bgh[pousr]_[A-Za-z0-9_]{20,}\b/g },
  { kind: 'github_token', regex: /\bgithub_pat_[A-Za-z0-9_]{22,}\b/g },
  { kind: 'bearer', regex: /(?<=Authorization:\s*Bearer\s+)[A-Za-z0-9_\-.]+/gi },
  {
    kind: 'private_key',
    regex:
      /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----[\s\S]*?-----END (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/g,
  },
  { kind: 'anthropic_key', regex: /\bsk-ant-[A-Za-z0-9_-]{20,}\b/g },
  { kind: 'openai_key', regex: /\bsk-(?!ant-)[A-Za-z0-9_-]{20,}\b/g },
  { kind: 'google_key', regex: /\bAIza[A-Za-z0-9_\-]{20,}\b/g },
  { kind: 'mistral_key', regex: /\b[A-Za-z0-9]{32}\b(?=\s*(?:#|\/\/|$))/g },
];

const ENV_SECRET_REGEX =
  /\b([A-Z0-9_]*?(?:TOKEN|SECRET|KEY|PASSWORD|AUTH|CREDENTIAL))\s*=\s*["']?[A-Za-z0-9+/=_\-]{32,}["']?/gi;

export function redactString(value) {
  if (!value) return value;
  let result = value;
  for (const pattern of PATTERNS) {
    result = result.replace(pattern.regex, `[REDACTED:${pattern.kind}]`);
  }
  result = result.replace(
    ENV_SECRET_REGEX,
    (_match, key) => `${key}=[REDACTED:env_secret:${key}]`
  );
  return result;
}

function redactOptional(value) {
  return value ? redactString(value) : value;
}

function deepRedact(value) {
  if (value == null) return value;
  if (typeof value === 'string') return redactString(value);
  if (typeof value === 'number' || typeof value === 'boolean') return value;
  if (Array.isArray(value)) return value.map(deepRedact);
  if (typeof value === 'object') {
    const result = {};
    for (const [k, v] of Object.entries(value)) {
      result[k] = deepRedact(v);
    }
    return result;
  }
  return value;
}

export function redactEvents(events) {
  return events.map((event) => {
    switch (event.type) {
      case 'message':
        return {
          ...event,
          payload: {
            ...event.payload,
            text: redactString(event.payload.text),
            thinking: redactOptional(event.payload.thinking),
          },
        };
      case 'tool_invocation':
        return {
          ...event,
          payload: { ...event.payload, input: deepRedact(event.payload.input) },
        };
      case 'tool_result':
        return {
          ...event,
          payload: { ...event.payload, output: deepRedact(event.payload.output) },
        };
      case 'error':
        return {
          ...event,
          payload: {
            ...event.payload,
            message: redactString(event.payload.message),
            stack: redactOptional(event.payload.stack),
          },
        };
      case 'lifecycle':
        return {
          ...event,
          payload: { ...event.payload, detail: redactOptional(event.payload.detail) },
        };
      default:
        return event;
    }
  });
}
