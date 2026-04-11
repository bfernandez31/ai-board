/**
 * Unit Tests: BYOK Credential Dispatch Guards
 *
 * Verifies that workflow dispatches (stage transitions, rollback-reset,
 * health scan) are blocked when the project owner has no AI credential.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { Job, Stage, UserCredential } from '@prisma/client';
import type { HealthScanDispatchInputs } from '@/lib/health/scan-dispatch';
import type { TicketWithProject } from '@/lib/workflows/transition';

// Mock modules before importing subjects
vi.mock('@/app/lib/workflows/test-mode', () => ({
  isWorkflowTestMode: vi.fn(() => false),
}));

vi.mock('@/lib/ai-credentials/workflow', async (importOriginal) => {
  const original = await importOriginal<typeof import('@/lib/ai-credentials/workflow')>();
  return {
    ...original,
    getOwnerCredential: vi.fn(),
  };
});

vi.mock('@/lib/db/client', () => ({
  prisma: {
    project: { findUnique: vi.fn() },
    ticket: { update: vi.fn(), findUnique: vi.fn() },
    job: { create: vi.fn(), delete: vi.fn(), findFirst: vi.fn() },
    $transaction: vi.fn(),
  },
}));

vi.mock('@octokit/rest', () => ({
  Octokit: vi.fn().mockImplementation(() => ({
    actions: { createWorkflowDispatch: vi.fn() },
  })),
}));

vi.mock('@octokit/request-error', () => ({
  RequestError: class RequestError extends Error {
    status: number;
    constructor(message: string, status: number) {
      super(message);
      this.status = status;
    }
  },
}));

vi.mock('@/lib/stage-transitions', () => ({
  isValidTransition: vi.fn(() => true),
  Stage: {},
}));

import { getOwnerCredential, MISSING_CREDENTIAL_ERROR, getMissingCredentialError } from '@/lib/ai-credentials/workflow';
import { isWorkflowTestMode } from '@/app/lib/workflows/test-mode';

const mockedGetOwnerCredential = vi.mocked(getOwnerCredential);
const mockedIsWorkflowTestMode = vi.mocked(isWorkflowTestMode);

function createTestTicket(overrides: Partial<TicketWithProject> = {}): TicketWithProject {
  return {
    id: 1,
    ticketKey: 'AIB-100',
    title: 'Test ticket',
    description: '',
    stage: 'INBOX' as Stage,
    workflowType: 'FULL',
    branch: null,
    projectId: 1,
    version: 1,
    project: {
      id: 1,
      githubOwner: 'owner',
      githubRepo: 'repo',
      defaultAgent: null,
    },
    agent: null,
    ...overrides,
  } as TicketWithProject;
}

describe('BYOK Credential Dispatch Guards', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: not in test mode (so credential check runs)
    mockedIsWorkflowTestMode.mockReturnValue(false);
    process.env.GITHUB_TOKEN = 'ghp_real_token';
    process.env.GITHUB_OWNER = 'test-owner';
    process.env.GITHUB_REPO = 'test-repo';
  });

  afterEach(() => {
    delete process.env.GITHUB_TOKEN;
    delete process.env.GITHUB_OWNER;
    delete process.env.GITHUB_REPO;
  });

  describe('handleTicketTransition', () => {
    it('should return MISSING_CREDENTIAL error when owner has no credential', async () => {
      mockedGetOwnerCredential.mockResolvedValue(null);

      const { handleTicketTransition } = await import('@/lib/workflows/transition');

      const result = await handleTicketTransition(createTestTicket(), 'SPECIFY' as Stage);

      expect(result.success).toBe(false);
      expect(result.errorCode).toBe('MISSING_CREDENTIAL');
      expect(result.error).toContain('credential configured');
      expect(mockedGetOwnerCredential).toHaveBeenCalledWith(1, 'ANTHROPIC');
    });

    it('should proceed when owner has a credential', async () => {
      mockedGetOwnerCredential.mockResolvedValue({ id: 1, provider: 'ANTHROPIC' } as UserCredential);

      const { prisma } = await import('@/lib/db/client');
      const mockedPrisma = vi.mocked(prisma);

      const mockJob = { id: 42, ticketId: 1, command: 'specify', status: 'PENDING' };
      mockedPrisma.job.create.mockResolvedValue(mockJob as Job);
      mockedPrisma.job.findFirst.mockResolvedValue(null);

      const { handleTicketTransition } = await import('@/lib/workflows/transition');

      const result = await handleTicketTransition(createTestTicket(), 'SPECIFY' as Stage);

      // Should have progressed past credential check (may succeed or fail on dispatch)
      expect(mockedGetOwnerCredential).toHaveBeenCalledWith(1, 'ANTHROPIC');
    });

    it('should skip credential check in test mode', async () => {
      mockedIsWorkflowTestMode.mockReturnValue(true);
      mockedGetOwnerCredential.mockResolvedValue(null);

      const { handleTicketTransition } = await import('@/lib/workflows/transition');

      const result = await handleTicketTransition(createTestTicket(), 'SPECIFY' as Stage);

      // Credential check should not have been called
      expect(mockedGetOwnerCredential).not.toHaveBeenCalled();
      // Should NOT fail with MISSING_CREDENTIAL (test mode bypasses the check)
      expect(result.errorCode).not.toBe('MISSING_CREDENTIAL');
    });

    it('should block quick-impl transition without credential', async () => {
      mockedGetOwnerCredential.mockResolvedValue(null);

      const { handleTicketTransition } = await import('@/lib/workflows/transition');

      const result = await handleTicketTransition(createTestTicket(), 'BUILD' as Stage);

      expect(result.success).toBe(false);
      expect(result.errorCode).toBe('MISSING_CREDENTIAL');
    });
  });

  describe('dispatchRollbackResetWorkflow', () => {
    it('should throw when owner has no credential', async () => {
      mockedGetOwnerCredential.mockResolvedValue(null);

      const { dispatchRollbackResetWorkflow } = await import(
        '@/app/lib/workflows/dispatch-rollback-reset'
      );

      await expect(
        dispatchRollbackResetWorkflow({
          ticketId: 1,
          ticketKey: 'AIB-100',
          projectId: 1,
          branch: 'AIB-100-feature',
          githubOwner: 'owner',
          githubRepo: 'repo',
        })
      ).rejects.toThrow(MISSING_CREDENTIAL_ERROR);
    });

    it('should skip credential check in test mode', async () => {
      mockedIsWorkflowTestMode.mockReturnValue(true);
      mockedGetOwnerCredential.mockResolvedValue(null);

      const { prisma } = await import('@/lib/db/client');
      const mockedPrisma = vi.mocked(prisma);
      mockedPrisma.job.create.mockResolvedValue({ id: 10 } as Job);

      const { dispatchRollbackResetWorkflow } = await import(
        '@/app/lib/workflows/dispatch-rollback-reset'
      );

      const result = await dispatchRollbackResetWorkflow({
        ticketId: 1,
        ticketKey: 'AIB-100',
        projectId: 1,
        branch: 'AIB-100-feature',
        githubOwner: 'owner',
        githubRepo: 'repo',
      });

      expect(result.jobId).toBe(10);
      expect(mockedGetOwnerCredential).not.toHaveBeenCalled();
    });
  });

  describe('dispatchHealthScanWorkflow', () => {
    it('should throw when owner has no credential', async () => {
      mockedGetOwnerCredential.mockResolvedValue(null);

      const { dispatchHealthScanWorkflow } = await import('@/lib/health/scan-dispatch');

      await expect(
        dispatchHealthScanWorkflow({
          scan_id: '1',
          project_id: '1',
          scan_type: 'SECURITY' as HealthScanDispatchInputs['scan_type'],
          base_commit: '',
          head_commit: '',
          githubRepository: 'owner/repo',
        })
      ).rejects.toThrow(MISSING_CREDENTIAL_ERROR);
    });

    it('should skip credential check in test mode', async () => {
      mockedIsWorkflowTestMode.mockReturnValue(true);

      const { dispatchHealthScanWorkflow } = await import('@/lib/health/scan-dispatch');

      // Should not throw - test mode skips dispatch entirely
      await expect(
        dispatchHealthScanWorkflow({
          scan_id: '1',
          project_id: '1',
          scan_type: 'SECURITY' as HealthScanDispatchInputs['scan_type'],
          base_commit: '',
          head_commit: '',
          githubRepository: 'owner/repo',
        })
      ).resolves.not.toThrow();

      expect(mockedGetOwnerCredential).not.toHaveBeenCalled();
    });
  });

  describe('MISSING_CREDENTIAL_ERROR constant', () => {
    it('should contain actionable guidance', () => {
      expect(MISSING_CREDENTIAL_ERROR).toContain('credential configured');
      expect(MISSING_CREDENTIAL_ERROR).toContain('Settings');
      expect(MISSING_CREDENTIAL_ERROR).toContain('AI Credentials');
    });
  });

  describe('provider-aware credential dispatch', () => {
    it('should resolve OPENAI provider for Codex-agent ticket', async () => {
      mockedGetOwnerCredential.mockResolvedValue(null);

      const { handleTicketTransition } = await import('@/lib/workflows/transition');

      const codexTicket = createTestTicket({
        agent: 'CODEX' as TicketWithProject['agent'],
      });

      const result = await handleTicketTransition(codexTicket, 'SPECIFY' as Stage);

      expect(result.success).toBe(false);
      expect(result.errorCode).toBe('MISSING_CREDENTIAL');
      expect(mockedGetOwnerCredential).toHaveBeenCalledWith(1, 'OPENAI');
    });

    it('should use provider-specific error message for missing OPENAI credential', async () => {
      mockedGetOwnerCredential.mockResolvedValue(null);

      const { handleTicketTransition } = await import('@/lib/workflows/transition');

      const codexTicket = createTestTicket({
        agent: 'CODEX' as TicketWithProject['agent'],
      });

      const result = await handleTicketTransition(codexTicket, 'SPECIFY' as Stage);

      expect(result.error).toContain('OpenAI');
      expect(result.error).toContain('credential configured');
    });

    it('should resolve ANTHROPIC provider for CLAUDE-agent ticket', async () => {
      mockedGetOwnerCredential.mockResolvedValue(null);

      const { handleTicketTransition } = await import('@/lib/workflows/transition');

      const claudeTicket = createTestTicket({
        agent: 'CLAUDE' as TicketWithProject['agent'],
      });

      const result = await handleTicketTransition(claudeTicket, 'SPECIFY' as Stage);

      expect(mockedGetOwnerCredential).toHaveBeenCalledWith(1, 'ANTHROPIC');
    });

    it('should generate provider-specific error messages', () => {
      expect(getMissingCredentialError('ANTHROPIC')).toContain('Anthropic');
      expect(getMissingCredentialError('OPENAI')).toContain('OpenAI');
      expect(getMissingCredentialError('MISTRAL')).toContain('Mistral');
      expect(getMissingCredentialError('GOOGLE')).toContain('Google');
    });

    it('should resolve MISTRAL provider for Mistral-agent ticket', async () => {
      mockedGetOwnerCredential.mockResolvedValue(null);

      const { handleTicketTransition } = await import('@/lib/workflows/transition');

      const mistralTicket = createTestTicket({
        agent: 'MISTRAL' as TicketWithProject['agent'],
      });

      const result = await handleTicketTransition(mistralTicket, 'SPECIFY' as Stage);

      expect(result.success).toBe(false);
      expect(result.errorCode).toBe('MISSING_CREDENTIAL');
      expect(mockedGetOwnerCredential).toHaveBeenCalledWith(1, 'MISTRAL');
    });

    it('should use Mistral-specific error message for missing MISTRAL credential', async () => {
      mockedGetOwnerCredential.mockResolvedValue(null);

      const { handleTicketTransition } = await import('@/lib/workflows/transition');

      const mistralTicket = createTestTicket({
        agent: 'MISTRAL' as TicketWithProject['agent'],
      });

      const result = await handleTicketTransition(mistralTicket, 'SPECIFY' as Stage);

      expect(result.error).toContain('Mistral');
      expect(result.error).toContain('credential configured');
    });

    it('should resolve GOOGLE provider for GEMINI-agent ticket', async () => {
      mockedGetOwnerCredential.mockResolvedValue(null);

      const { handleTicketTransition } = await import('@/lib/workflows/transition');

      const geminiTicket = createTestTicket({
        agent: 'GEMINI' as TicketWithProject['agent'],
      });

      const result = await handleTicketTransition(geminiTicket, 'SPECIFY' as Stage);

      expect(result.success).toBe(false);
      expect(result.errorCode).toBe('MISSING_CREDENTIAL');
      expect(mockedGetOwnerCredential).toHaveBeenCalledWith(1, 'GOOGLE');
    });

    it('should use Google-specific error message for missing GOOGLE credential', async () => {
      mockedGetOwnerCredential.mockResolvedValue(null);

      const { handleTicketTransition } = await import('@/lib/workflows/transition');

      const geminiTicket = createTestTicket({
        agent: 'GEMINI' as TicketWithProject['agent'],
      });

      const result = await handleTicketTransition(geminiTicket, 'SPECIFY' as Stage);

      expect(result.error).toContain('Google');
      expect(result.error).toContain('credential configured');
    });
  });

  describe('hardcoded CLAUDE commands', () => {
    it('should always check ANTHROPIC credential for ai-board-assist regardless of ticket agent', async () => {
      mockedGetOwnerCredential.mockResolvedValue(null);

      const { dispatchAIBoardWorkflow } = await import(
        '@/app/lib/workflows/dispatch-ai-board'
      );

      await expect(
        dispatchAIBoardWorkflow({
          ticket_id: 'AIB-100',
          stage: 'BUILD',
          branch: 'test-branch',
          user_id: 'user1',
          user: 'testuser',
          comment: 'test comment',
          job_id: '1',
          project_id: '1',
          githubRepository: 'owner/repo',
          agent: 'CODEX',
        })
      ).rejects.toThrow('Anthropic');

      expect(mockedGetOwnerCredential).toHaveBeenCalledWith(1, 'ANTHROPIC');
    });
  });
});
