import type { NormalizedEvent } from './schema';

interface Pattern {
  kind: string;
  regex: RegExp;
}

const PATTERNS: Pattern[] = [
  {
    kind: 'github_token',
    regex: /\bgh[pousr]_[A-Za-z0-9_]{20,}\b/g,
  },
  {
    kind: 'github_token',
    regex: /\bgithub_pat_[A-Za-z0-9_]{22,}\b/g,
  },
  {
    kind: 'bearer',
    regex: /(?<=Authorization:\s*Bearer\s+)[A-Za-z0-9_\-.]+/gi,
  },
  {
    kind: 'private_key',
    regex:
      /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----[\s\S]*?-----END (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/g,
  },
  {
    kind: 'anthropic_key',
    regex: /\bsk-ant-[A-Za-z0-9_-]{20,}\b/g,
  },
  {
    kind: 'openai_key',
    regex: /\bsk-(?!ant-)[A-Za-z0-9_-]{20,}\b/g,
  },
  {
    kind: 'google_key',
    regex: /\bAIza[A-Za-z0-9_\-]{20,}\b/g,
  },
];

const ENV_SECRET_REGEX =
  /\b([A-Z0-9_]*?(?:TOKEN|SECRET|KEY|PASSWORD|AUTH|CREDENTIAL|URL|DSN|CONNECTION))\s*=\s*["']?[A-Za-z0-9+/=_\-:@.?&~]{12,}["']?/gi;

export function redactString(value: string): string {
  if (!value) return value;
  let result = value;
  for (const pattern of PATTERNS) {
    result = result.replace(pattern.regex, `[REDACTED:${pattern.kind}]`);
  }
  result = result.replace(
    ENV_SECRET_REGEX,
    (_match: string, key: string) => `${key}=[REDACTED:env_secret:${key}]`
  );
  return result;
}

function redactOptional(value: string | undefined): string | undefined {
  return value ? redactString(value) : value;
}

function deepRedact(value: unknown): unknown {
  if (value == null) return value;
  if (typeof value === 'string') return redactString(value);
  if (typeof value === 'number' || typeof value === 'boolean') return value;
  if (Array.isArray(value)) return value.map(deepRedact);
  if (typeof value === 'object') {
    const result: Record<string, unknown> = {};
    for (const [key, nestedValue] of Object.entries(value as Record<string, unknown>)) {
      result[key] = deepRedact(nestedValue);
    }
    return result;
  }
  return value;
}

export function redactNativeJsonl(line: string): string {
  if (!line || line.trim().length === 0) return line;
  try {
    return JSON.stringify(deepRedact(JSON.parse(line)));
  } catch {
    return redactString(line);
  }
}

export function redactEvents(events: NormalizedEvent[]): NormalizedEvent[] {
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
    }
  });
}
