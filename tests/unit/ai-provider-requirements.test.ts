import { describe, expect, it } from 'vitest';
import { Agent } from '@prisma/client';
import { resolveWorkflowProviderRequirement } from '@/lib/services/workflow-provider-requirements';

describe('workflow-provider-requirements', () => {
  it('maps Claude workflows to Anthropic', () => {
    expect(resolveWorkflowProviderRequirement('implement', Agent.CLAUDE)).toEqual({
      command: 'implement',
      agent: Agent.CLAUDE,
      providers: ['ANTHROPIC'],
    });
  });

  it('maps Codex workflows to OpenAI', () => {
    expect(resolveWorkflowProviderRequirement('verify', Agent.CODEX)).toEqual({
      command: 'verify',
      agent: Agent.CODEX,
      providers: ['OPENAI'],
    });
  });
});
