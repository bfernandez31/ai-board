import { randomUUID } from 'node:crypto';
import type {
  Agent,
  CredentialReadiness,
  CredentialType,
  Prisma,
  Project,
  ProjectSetupJob,
  ProjectSetupJobStatus,
} from '@prisma/client';
import { prisma } from '@/lib/db/client';
import { getGitHubAccessToken } from '@/lib/github/user-client';
import { getCredentialProviderForAgent, getOwnerCredential } from '@/lib/ai-credentials/workflow';
import {
  type ProjectSetupStateDto,
  type ProjectSetupStatusDto,
  type SetupAgentReadiness,
  mapSetupJobToStatusDto,
} from './types';
import { syncProjectConfig } from '@/lib/config-sync';
import { dispatchProjectOnboardingWorkflow } from '@/lib/onboarding/workflow';

function isTerminalStatus(status: ProjectSetupJobStatus): boolean {
  return status === 'COMPLETED' || status === 'FAILED' || status === 'CANCELLED';
}

function assertAllowedTransition(
  currentStatus: ProjectSetupJobStatus,
  nextStatus: ProjectSetupJobStatus
) {
  const allowed: Record<ProjectSetupJobStatus, ProjectSetupJobStatus[]> = {
    PENDING: ['PENDING', 'RUNNING', 'FAILED', 'CANCELLED'],
    RUNNING: ['RUNNING', 'COMPLETED', 'FAILED', 'CANCELLED'],
    COMPLETED: ['COMPLETED'],
    FAILED: ['FAILED'],
    CANCELLED: ['CANCELLED'],
  };

  if (!allowed[currentStatus].includes(nextStatus)) {
    const error = new Error(
      `Invalid setup job transition from ${currentStatus} to ${nextStatus}`
    );
    error.name = 'InvalidSetupStatusTransition';
    throw error;
  }
}

export async function getSetupAgentReadiness(projectId: number): Promise<SetupAgentReadiness[]> {
  const agents = (['CLAUDE', 'CODEX'] as const) satisfies readonly Agent[];

  const readinessEntries = await Promise.all(
    agents.map(async (agent) => {
      const provider = getCredentialProviderForAgent(agent);
      const credential = await getOwnerCredential(projectId, provider);

      return {
        agent,
        provider,
        ready: credential?.readinessStatus === 'READY',
        credentialType: (credential?.credentialType as CredentialType | undefined) ?? null,
        readinessStatus:
          (credential?.readinessStatus as CredentialReadiness | undefined) ?? null,
        verificationCode: credential?.verificationCode ?? null,
        verificationMessage: credential?.verificationMessage ?? null,
      };
    })
  );

  return readinessEntries;
}

async function getOwnerSetupProject(projectId: number, userId: string) {
  return prisma.project.findFirst({
    where: { id: projectId, userId },
    select: {
      id: true,
      userId: true,
      defaultAgent: true,
      config: true,
      configSyncedAt: true,
      githubOwner: true,
      githubRepo: true,
      setupJobs: {
        orderBy: { createdAt: 'desc' },
        take: 1,
      },
    },
  });
}

export async function getProjectSetupState(
  projectId: number,
  userId: string
): Promise<ProjectSetupStateDto> {
  const project = await getOwnerSetupProject(projectId, userId);
  if (!project) {
    throw new Error('Project not found');
  }

  const latestJob = project.setupJobs[0] ?? null;
  const requiresSetup = project.config == null || project.configSyncedAt == null;

  return {
    projectId: project.id,
    requiresSetup,
    selectedAgentDefault: project.defaultAgent,
    eligibleAgents: project.userId === userId ? await getSetupAgentReadiness(project.id) : [],
    latestSetupJob: latestJob ? mapSetupJobToStatusDto(latestJob) : null,
    redirectTo: requiresSetup ? null : `/projects/${project.id}/board`,
  };
}

export async function getLatestProjectSetupJob(
  projectId: number,
  userId: string
): Promise<ProjectSetupStatusDto | null> {
  const project = await getOwnerSetupProject(projectId, userId);
  if (!project) {
    throw new Error('Project not found');
  }

  const latestJob = project.setupJobs[0] ?? null;
  return latestJob ? mapSetupJobToStatusDto(latestJob) : null;
}

export async function startProjectSetup(
  projectId: number,
  userId: string,
  selectedAgent: Agent
): Promise<{ created: boolean; duplicate: boolean; job: ProjectSetupStatusDto }> {
  const project = await getOwnerSetupProject(projectId, userId);

  if (!project) {
    throw new Error('Project not found');
  }

  if (project.config != null && project.configSyncedAt != null) {
    const error = new Error('Project setup is no longer required');
    error.name = 'SetupNotRequired';
    throw error;
  }

  const readiness = await getSetupAgentReadiness(projectId);
  const selectedReadiness = readiness.find((entry) => entry.agent === selectedAgent);
  if (!selectedReadiness?.ready) {
    const providerLabel = selectedReadiness?.provider === 'OPENAI' ? 'OpenAI' : 'Anthropic';
    const error = new Error(
      selectedReadiness?.verificationMessage ||
        `${providerLabel} credential is not ready for ${selectedAgent} onboarding`
    );
    error.name = 'CredentialNotReady';
    throw error;
  }

  const activeJob = await prisma.projectSetupJob.findFirst({
    where: {
      projectId,
      status: { in: ['PENDING', 'RUNNING'] },
    },
    orderBy: { createdAt: 'desc' },
  });

  if (activeJob) {
    return {
      created: false,
      duplicate: true,
      job: mapSetupJobToStatusDto(activeJob),
    };
  }

  const dispatchKey = randomUUID();
  const job = await prisma.projectSetupJob.create({
    data: {
      projectId,
      selectedAgent,
      status: 'PENDING',
      dispatchKey,
    },
  });

  try {
    await dispatchProjectOnboardingWorkflow({
      projectId,
      jobId: job.id,
      githubRepository: `${project.githubOwner}/${project.githubRepo}`,
      agent: selectedAgent,
    });
  } catch (error) {
    const failedJob = await prisma.projectSetupJob.update({
      where: { id: job.id },
      data: {
        status: 'FAILED',
        errorCode: 'DISPATCH_FAILED',
        errorMessage: error instanceof Error ? error.message : 'Failed to dispatch project onboarding workflow',
        completedAt: new Date(),
      },
    });

    return {
      created: true,
      duplicate: false,
      job: mapSetupJobToStatusDto(failedJob),
    };
  }

  return {
    created: true,
    duplicate: false,
    job: mapSetupJobToStatusDto(job),
  };
}

export async function updateProjectSetupStatus(params: {
  projectId: number;
  jobId: number;
  status: ProjectSetupJobStatus;
  workflowRunId?: bigint;
  defaultBranch?: string;
  commitSha?: string;
  analysisSummary?: Record<string, unknown>;
  artifactManifest?: unknown[];
  configPreview?: Record<string, unknown>;
  errorCode?: string;
  errorMessage?: string;
}): Promise<ProjectSetupStatusDto> {
  const job = await prisma.projectSetupJob.findFirst({
    where: {
      id: params.jobId,
      projectId: params.projectId,
    },
    include: {
      project: {
        select: {
          id: true,
          userId: true,
          githubOwner: true,
          githubRepo: true,
          configSyncedAt: true,
        },
      },
    },
  });

  if (!job) {
    throw new Error('Setup job not found');
  }

  const latestActiveOrTerminalJob = await prisma.projectSetupJob.findFirst({
    where: { projectId: params.projectId },
    orderBy: { createdAt: 'desc' },
    select: { id: true, status: true },
  });

  if (!latestActiveOrTerminalJob || latestActiveOrTerminalJob.id !== job.id) {
    const error = new Error('Setup job is no longer authoritative');
    error.name = 'StaleSetupJob';
    throw error;
  }

  assertAllowedTransition(job.status, params.status);

  const updateData: Prisma.ProjectSetupJobUpdateInput = {
    status: params.status,
  };

  if (params.status === 'RUNNING' && !job.startedAt) {
    updateData.startedAt = new Date();
  }
  if (params.workflowRunId && !job.workflowRunId) {
    updateData.workflowRunId = params.workflowRunId;
  }
  if (params.defaultBranch) updateData.defaultBranch = params.defaultBranch;
  if (params.commitSha) updateData.commitSha = params.commitSha;
  if (params.analysisSummary) {
    updateData.analysisSummary = params.analysisSummary as Prisma.InputJsonValue;
  }
  if (params.artifactManifest) {
    updateData.artifactManifest = params.artifactManifest as Prisma.InputJsonValue;
  }
  if (params.configPreview) {
    updateData.configPreview = params.configPreview as Prisma.InputJsonValue;
  }
  if (params.errorCode) updateData.errorCode = params.errorCode;
  if (params.errorMessage) updateData.errorMessage = params.errorMessage;
  if (params.status === 'RUNNING' || params.status === 'COMPLETED') {
    updateData.errorCode = null;
    updateData.errorMessage = null;
  }
  if (isTerminalStatus(params.status)) {
    updateData.completedAt = new Date();
  }

  const updated = await prisma.projectSetupJob.update({
    where: { id: job.id },
    data: updateData,
  });

  if (params.status === 'COMPLETED' && params.commitSha) {
    const token = await getGitHubAccessToken(job.project.userId);
    await syncProjectConfig(
      {
        id: job.project.id,
        githubOwner: job.project.githubOwner,
        githubRepo: job.project.githubRepo,
        configSyncedAt: job.project.configSyncedAt,
      },
      token ?? undefined
    );
  }

  return mapSetupJobToStatusDto(updated);
}

export type SetupProjectRef = Pick<
  Project,
  'id' | 'userId' | 'defaultAgent' | 'config' | 'configSyncedAt' | 'githubOwner' | 'githubRepo'
>;

export type SetupJobRecord = ProjectSetupJob;
