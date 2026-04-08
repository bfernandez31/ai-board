import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock prisma before importing service
vi.mock('@/lib/db/client', () => ({
  prisma: {
    setupJob: {
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    project: {
      findUnique: vi.fn(),
    },
  },
}));

vi.mock('@/lib/config-sync', () => ({
  syncProjectConfig: vi.fn().mockResolvedValue({ success: true }),
}));

import { prisma } from '@/lib/db/client';
import {
  createSetupJob,
  getLatestSetupJob,
  updateSetupJobStatus,
  deleteSetupJob,
  SetupJobDuplicateError,
} from '@/lib/setup/service';

const mockSetupJob = prisma.setupJob as unknown as {
  findFirst: ReturnType<typeof vi.fn>;
  create: ReturnType<typeof vi.fn>;
  update: ReturnType<typeof vi.fn>;
  delete: ReturnType<typeof vi.fn>;
};

const mockProject = prisma.project as unknown as {
  findUnique: ReturnType<typeof vi.fn>;
};

describe('SetupJob Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('createSetupJob', () => {
    it('creates a new setup job when no active job exists', async () => {
      mockSetupJob.findFirst.mockResolvedValue(null);
      mockSetupJob.create.mockResolvedValue({
        id: 1,
        projectId: 5,
        selectedAgent: 'CLAUDE',
        status: 'PENDING',
        createdAt: new Date(),
      });

      const result = await createSetupJob({ projectId: 5, selectedAgent: 'CLAUDE' });

      expect(result.id).toBe(1);
      expect(result.status).toBe('PENDING');
      expect(mockSetupJob.findFirst).toHaveBeenCalledWith({
        where: {
          projectId: 5,
          status: { in: ['PENDING', 'RUNNING'] },
        },
      });
    });

    it('rejects when a PENDING job already exists', async () => {
      mockSetupJob.findFirst.mockResolvedValue({
        id: 1,
        projectId: 5,
        status: 'PENDING',
      });

      await expect(
        createSetupJob({ projectId: 5, selectedAgent: 'CLAUDE' })
      ).rejects.toThrow(SetupJobDuplicateError);
    });

    it('rejects when a RUNNING job already exists', async () => {
      mockSetupJob.findFirst.mockResolvedValue({
        id: 1,
        projectId: 5,
        status: 'RUNNING',
      });

      await expect(
        createSetupJob({ projectId: 5, selectedAgent: 'CODEX' })
      ).rejects.toThrow('A setup job is already pending or running');
    });

    it('allows creation when only COMPLETED/FAILED jobs exist', async () => {
      mockSetupJob.findFirst.mockResolvedValue(null); // No active jobs
      mockSetupJob.create.mockResolvedValue({
        id: 2,
        projectId: 5,
        selectedAgent: 'CODEX',
        status: 'PENDING',
      });

      const result = await createSetupJob({ projectId: 5, selectedAgent: 'CODEX' });
      expect(result.id).toBe(2);
    });
  });

  describe('getLatestSetupJob', () => {
    it('returns the latest setup job ordered by createdAt DESC', async () => {
      mockSetupJob.findFirst.mockResolvedValue({
        id: 3,
        projectId: 5,
        status: 'COMPLETED',
      });

      const result = await getLatestSetupJob(5);

      expect(result?.id).toBe(3);
      expect(mockSetupJob.findFirst).toHaveBeenCalledWith({
        where: { projectId: 5 },
        orderBy: { createdAt: 'desc' },
      });
    });

    it('returns null when no jobs exist', async () => {
      mockSetupJob.findFirst.mockResolvedValue(null);
      const result = await getLatestSetupJob(99);
      expect(result).toBeNull();
    });
  });

  describe('updateSetupJobStatus', () => {
    it('updates status to RUNNING and sets startedAt', async () => {
      mockSetupJob.update.mockResolvedValue({
        id: 1,
        projectId: 5,
        status: 'RUNNING',
        startedAt: new Date(),
      });

      const result = await updateSetupJobStatus(1, { status: 'RUNNING' });
      expect(result.status).toBe('RUNNING');

      const updateCall = mockSetupJob.update.mock.calls[0][0];
      expect(updateCall.data.status).toBe('RUNNING');
      expect(updateCall.data.startedAt).toBeInstanceOf(Date);
    });

    it('updates status to COMPLETED and sets completedAt', async () => {
      mockSetupJob.update.mockResolvedValue({
        id: 1,
        projectId: 5,
        status: 'COMPLETED',
        completedAt: new Date(),
      });
      mockProject.findUnique.mockResolvedValue({
        id: 5,
        githubOwner: 'test',
        githubRepo: 'test-repo',
        configSyncedAt: null,
      });

      const result = await updateSetupJobStatus(1, {
        status: 'COMPLETED',
        completedFiles: ['.ai-board/config.yml'],
      });

      expect(result.status).toBe('COMPLETED');
      const updateCall = mockSetupJob.update.mock.calls[0][0];
      expect(updateCall.data.completedAt).toBeInstanceOf(Date);
      expect(updateCall.data.completedFiles).toEqual(['.ai-board/config.yml']);
    });

    it('updates status to FAILED with error message', async () => {
      mockSetupJob.update.mockResolvedValue({
        id: 1,
        projectId: 5,
        status: 'FAILED',
        errorMessage: 'Workflow timed out',
      });

      const result = await updateSetupJobStatus(1, {
        status: 'FAILED',
        errorMessage: 'Workflow timed out',
      });

      expect(result.status).toBe('FAILED');
      const updateCall = mockSetupJob.update.mock.calls[0][0];
      expect(updateCall.data.errorMessage).toBe('Workflow timed out');
    });

    it('sets isPartial flag on partial completion', async () => {
      mockSetupJob.update.mockResolvedValue({
        id: 1,
        projectId: 5,
        status: 'COMPLETED',
        isPartial: true,
      });
      mockProject.findUnique.mockResolvedValue({
        id: 5,
        githubOwner: 'test',
        githubRepo: 'test-repo',
        configSyncedAt: null,
      });

      await updateSetupJobStatus(1, {
        status: 'COMPLETED',
        isPartial: true,
        completedFiles: ['.ai-board/config.yml'],
      });

      const updateCall = mockSetupJob.update.mock.calls[0][0];
      expect(updateCall.data.isPartial).toBe(true);
    });
  });

  describe('deleteSetupJob', () => {
    it('deletes a setup job by ID', async () => {
      mockSetupJob.delete.mockResolvedValue({ id: 1 });
      await deleteSetupJob(1);
      expect(mockSetupJob.delete).toHaveBeenCalledWith({ where: { id: 1 } });
    });
  });
});
