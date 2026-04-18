import { Agent } from '@prisma/client';

export const CLAUDE_MODEL_DEFAULT = 'claude-opus-4-7';

export interface ClaudeModelOption {
  id: string;
  label: string;
  description: string;
}

export const CLAUDE_MODEL_WHITELIST: ClaudeModelOption[] = [
  {
    id: 'claude-opus-4-7',
    label: 'Claude Opus 4.7',
    description: 'Most capable — best for complex reasoning',
  },
  {
    id: 'claude-opus-4-6',
    label: 'Claude Opus 4.6',
    description: 'Prior Opus generation — proven on large work',
  },
  {
    id: 'claude-sonnet-4-6',
    label: 'Claude Sonnet 4.6',
    description: 'Balanced quality and cost — good default for implementation',
  },
  {
    id: 'claude-haiku-4-5',
    label: 'Claude Haiku 4.5',
    description: 'Fastest and cheapest — good for short tasks',
  },
];

export const CLAUDE_MODEL_IDS = CLAUDE_MODEL_WHITELIST.map((m) => m.id);

export function isValidClaudeModel(value: unknown): value is string {
  return typeof value === 'string' && CLAUDE_MODEL_IDS.includes(value);
}

export function getClaudeModelLabel(modelId: string): string {
  return CLAUDE_MODEL_WHITELIST.find((m) => m.id === modelId)?.label ?? modelId;
}

export type ClaudeStageKey =
  | 'specify'
  | 'plan'
  | 'implement'
  | 'quickImpl'
  | 'verify';

export interface ClaudeStageDescriptor {
  key: ClaudeStageKey;
  label: string;
  description: string;
  /** Workflow command(s) that resolve to this stage key */
  commands: string[];
}

export const CLAUDE_STAGES: readonly ClaudeStageDescriptor[] = [
  {
    key: 'specify',
    label: 'Specify',
    description: 'Transform a ticket into a detailed feature spec.',
    commands: ['specify'],
  },
  {
    key: 'plan',
    label: 'Plan',
    description: 'Break the spec into tasks and architecture notes.',
    commands: ['plan'],
  },
  {
    key: 'implement',
    label: 'Implement',
    description: 'Full BUILD stage — writes production code from the plan.',
    commands: ['implement'],
  },
  {
    key: 'quickImpl',
    label: 'Quick-impl',
    description: 'Fast-track INBOX→BUILD for small, well-scoped tickets.',
    commands: ['quick-impl'],
  },
  {
    key: 'verify',
    label: 'Verify',
    description: 'Run tests, fix regressions, and open a PR.',
    commands: ['verify'],
  },
];

export const CLAUDE_STAGE_KEYS: ClaudeStageKey[] = CLAUDE_STAGES.map(
  (s) => s.key
);

/** Smart, cost-conscious defaults applied to newly-created projects. */
export const CLAUDE_SMART_DEFAULTS: Record<ClaudeStageKey, string> = {
  specify: 'claude-opus-4-7',
  plan: 'claude-opus-4-7',
  implement: 'claude-sonnet-4-6',
  quickImpl: 'claude-sonnet-4-6',
  verify: 'claude-sonnet-4-6',
};

/** Convert a workflow command into its stage key, if any. */
export function commandToStageKey(command: string): ClaudeStageKey | null {
  switch (command) {
    case 'specify':
      return 'specify';
    case 'plan':
      return 'plan';
    case 'implement':
      return 'implement';
    case 'quick-impl':
      return 'quickImpl';
    case 'verify':
      return 'verify';
    default:
      return null;
  }
}

export type ClaudeModelMap = { [K in ClaudeStageKey]?: string | undefined };

/**
 * Sanitize a raw JSON value into a ClaudeModelMap: drop unknown keys,
 * drop non-whitelisted models. Returns an empty object if input is bogus.
 */
export function sanitizeClaudeModelMap(input: unknown): ClaudeModelMap {
  if (!input || typeof input !== 'object') return {};
  const result: ClaudeModelMap = {};
  for (const stage of CLAUDE_STAGE_KEYS) {
    const value = (input as Record<string, unknown>)[stage];
    if (isValidClaudeModel(value)) {
      result[stage] = value;
    }
  }
  return result;
}

/**
 * Resolve the effective Claude model for a given workflow command.
 * Returns null if not applicable (agent != CLAUDE, or command not
 * a configurable stage). Falls back to Opus 4.7 otherwise.
 */
export function resolveClaudeModel(args: {
  command: string;
  effectiveAgent: Agent;
  projectClaudeModels: unknown;
  ticketClaudeModelOverrides: unknown;
}): string | null {
  if (args.effectiveAgent !== Agent.CLAUDE) return null;
  const stage = commandToStageKey(args.command);
  if (!stage) return null;

  const overrides = sanitizeClaudeModelMap(args.ticketClaudeModelOverrides);
  if (overrides[stage]) return overrides[stage]!;

  const projectDefaults = sanitizeClaudeModelMap(args.projectClaudeModels);
  if (projectDefaults[stage]) return projectDefaults[stage]!;

  return CLAUDE_MODEL_DEFAULT;
}

/**
 * Return the list of stage keys that have an explicit override on the ticket
 * (sanitized against the whitelist). Used to decide whether to show the
 * "Custom models" badge and what to list in its tooltip.
 */
export function overriddenStageKeys(input: unknown): ClaudeStageKey[] {
  const map = sanitizeClaudeModelMap(input);
  return CLAUDE_STAGE_KEYS.filter((k) => map[k] !== undefined);
}
