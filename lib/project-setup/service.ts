import { Agent, Prisma, type ProjectSetupAttempt } from '@prisma/client';
import { prisma } from '@/lib/db/client';
import {
  getOwnerCredentialReadiness,
  getProviderForAgent,
} from '@/lib/ai-credentials/workflow';
import { syncProjectConfigAfterSetupCompletion } from '@/lib/config-sync';
import {
  getProjectSetupContext,
  type LatestProjectSetupAttempt,
} from '@/lib/db/projects';
import {
  canTransitionSetupStatus,
  deriveProjectSetupState,
  getElapsedSeconds,
  isActiveSetupStatus,
  isSetupRequired,
} from './state';
import {
  dispatchProjectOnboardingWorkflow,
} from './workflow-dispatch';
import type {
  ProjectSetupResponse,
  SetupAttemptDto,
  SetupCallbackPayload,
  SetupCallbackResponse,
  SetupCredentialReadinessDto,
  SetupStartResponse,
} from './types';

const SELECTED_AGENT_OPTIONS = [Agent.CLAUDE, Agent.CODEX] as const;

export class ProjectSetupError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code?: string
  ) {
    super(message);
  }
}

function toProjectSetupAttempt(
  attempt: LatestProjectSetupAttempt | ProjectSetupAttempt
): ProjectSetupAttempt {
  return {
    ...attempt,
    workflowRunId:
      typeof attempt.workflowRunId === 'bigint'
        ? attempt.workflowRunId
        : attempt.workflowRunId === null
          ? null
          : BigInt(attempt.workflowRunId),
  };
}

export function serializeSetupAttempt(
  attempt: ProjectSetupAttempt | LatestProjectSetupAttempt | null
): SetupAttemptDto | null {
  if (!attempt) {
    return null;
  }

  const hydratedAttempt = toProjectSetupAttempt(attempt);

  return {
    id: hydratedAttempt.id,
    selectedAgent: hydratedAttempt.selectedAgent,
    status: hydratedAttempt.status,
    createdAt: hydratedAttempt.createdAt.toISOString(),
    startedAt: hydratedAttempt.startedAt?.toISOString() ?? null,
    completedAt: hydratedAttempt.completedAt?.toISOString() ?? null,
    elapsedSeconds: getElapsedSeconds(hydratedAttempt),
    resultMessage: hydratedAttempt.statusMessage ?? null,
    failureCode: hydratedAttempt.failureCode ?? null,
    failureMessage: hydratedAttempt.failureMessage ?? null,
    artifactSummary:
      (hydratedAttempt.artifactSummary as Prisma.JsonValue | null) ?? null,
  };
}

async function buildCredentialReadinessMap(
  projectId: number
): Promise<Record<Agent, SetupCredentialReadinessDto>> {
  const readinessResults = await Promise.all(
    SELECTED_AGENT_OPTIONS.map(async (agent) => [
      agent,
      await getOwnerCredentialReadiness(projectId, agent),
    ] as const)
  );

  return Object.fromEntries(readinessResults) as Record<
    Agent,
    SetupCredentialReadinessDto
  >;
}

export async function getProjectSetupResponse(
  projectId: number,
  viewerCanManage: boolean
): Promise<ProjectSetupResponse> {
  const project = await getProjectSetupContext(projectId);

  if (!project) {
    throw new ProjectSetupError('Project not found', 404);
  }

  const latestAttempt = project.setupAttempts[0] ?? null;
  const derivedState = deriveProjectSetupState({
    config: project.config,
    configSyncedAt: project.configSyncedAt,
    setupAttempts: latestAttempt ? [toProjectSetupAttempt(latestAttempt)] : [],
  });

  return {
    projectId,
    setupRequired: derivedState.kind !== 'not_required',
    viewerCanManage,
    selectedAgentOptions: [...SELECTED_AGENT_OPTIONS],
    credentialReadiness: await buildCredentialReadinessMap(projectId),
    latestAttempt: serializeSetupAttempt(latestAttempt),
  };
}

export async function startProjectSetupAttempt(
  projectId: number,
  selectedAgent: Agent
): Promise<SetupStartResponse> {
  const project = await getProjectSetupContext(projectId);

  if (!project) {
    throw new ProjectSetupError('Project not found', 404);
  }

  if (!isSetupRequired(project)) {
    throw new ProjectSetupError(
      'Project setup is already complete.',
      409,
      'SETUP_NOT_REQUIRED'
    );
  }

  const credentialReadiness = await getOwnerCredentialReadiness(
    projectId,
    selectedAgent
  );

  if (!credentialReadiness.ready) {
    throw new ProjectSetupError(
      credentialReadiness.message,
      422,
      'CREDENTIAL_NOT_READY'
    );
  }

  const latestAttempt = project.setupAttempts[0] ?? null;
  if (latestAttempt && isActiveSetupStatus(latestAttempt.status)) {
    throw new ProjectSetupError(
      'Setup is already in progress.',
      409,
      'ACTIVE_ATTEMPT_EXISTS'
    );
  }

  const attempt = await prisma.projectSetupAttempt.create({
    data: {
      projectId,
      selectedAgent,
      attemptNumber: (latestAttempt?.attemptNumber ?? 0) + 1,
      status: 'PENDING',
      statusMessage: `Waiting for ${selectedAgent === 'CODEX' ? 'Codex' : 'Claude'} onboarding workflow to start.`,
    },
  });

  try {
    await dispatchProjectOnboardingWorkflow({
      project_id: String(projectId),
      attempt_id: String(attempt.id),
      githubRepository: `${project.githubOwner}/${project.githubRepo}`,
      agent: selectedAgent,
    });
  } catch (error) {
    const failureMessage = 'Failed to dispatch onboarding workflow.';

    await prisma.projectSetupAttempt.update({
      where: { id: attempt.id },
      data: {
        status: 'FAILED',
        failureCode: 'WORKFLOW_DISPATCH_FAILED',
        failureMessage,
        statusMessage: failureMessage,
        completedAt: new Date(),
      },
    });

    throw new ProjectSetupError(
      failureMessage,
      502,
      'WORKFLOW_DISPATCH_FAILED'
    );
  }

  return {
    attempt: serializeSetupAttempt(attempt)!,
  };
}

export async function updateProjectSetupAttemptStatus(
  projectId: number,
  attemptId: number,
  payload: SetupCallbackPayload
): Promise<SetupCallbackResponse> {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: {
      id: true,
      githubOwner: true,
      githubRepo: true,
      config: true,
      configSyncedAt: true,
      setupAttempts: {
        orderBy: { attemptNumber: 'desc' },
        take: 1,
        select: {
          id: true,
          attemptNumber: true,
        },
      },
    },
  });

  if (!project) {
    throw new ProjectSetupError('Project not found', 404);
  }

  const attempt = await prisma.projectSetupAttempt.findFirst({
    where: { id: attemptId, projectId },
  });

  if (!attempt) {
    throw new ProjectSetupError('Setup attempt not found', 404);
  }

  const latestAttempt = project.setupAttempts[0] ?? null;
  if (latestAttempt && latestAttempt.id !== attemptId) {
    throw new ProjectSetupError('Stale callback', 409, 'STALE_ATTEMPT');
  }

  if (!canTransitionSetupStatus(attempt.status, payload.status)) {
    throw new ProjectSetupError(
      `Invalid transition from ${attempt.status} to ${payload.status}`,
      400
    );
  }

  if (attempt.status === payload.status && attempt.completedAt) {
    return {
      attemptId,
      status: attempt.status,
      completedAt: attempt.completedAt.toISOString(),
      setupRequired: isSetupRequired(project),
    };
  }

  const workflowRunId =
    payload.workflowRunId != null ? BigInt(payload.workflowRunId) : undefined;
  const now = new Date();

  const baseUpdateData: Prisma.ProjectSetupAttemptUpdateInput = {
    statusMessage: payload.message ?? attempt.statusMessage,
    failureCode: payload.failureCode ?? null,
    failureMessage: payload.failureMessage ?? null,
  };

  if (payload.artifactSummary !== undefined) {
    baseUpdateData.artifactSummary =
      payload.artifactSummary === null
        ? Prisma.JsonNull
        : (payload.artifactSummary as Prisma.InputJsonValue);
  }

  if (workflowRunId !== undefined && !attempt.workflowRunId) {
    baseUpdateData.workflowRunId = workflowRunId;
  }

  if (payload.status === 'RUNNING' && !attempt.startedAt) {
    baseUpdateData.startedAt = now;
  }

  if (payload.status === 'FAILED') {
    const failedAttempt = await prisma.projectSetupAttempt.update({
      where: { id: attemptId },
      data: {
        ...baseUpdateData,
        status: 'FAILED',
        completedAt: now,
      },
    });

    return {
      attemptId,
      status: failedAttempt.status,
      completedAt: failedAttempt.completedAt?.toISOString() ?? null,
      setupRequired: true,
    };
  }

  if (payload.status === 'COMPLETED') {
    const syncResult = await syncProjectConfigAfterSetupCompletion({
      id: project.id,
      githubOwner: project.githubOwner,
      githubRepo: project.githubRepo,
      configSyncedAt: project.configSyncedAt,
    });

    if (!syncResult.success) {
      await prisma.projectSetupAttempt.update({
        where: { id: attemptId },
        data: {
          ...baseUpdateData,
          status: 'FAILED',
          failureCode: 'CONFIG_SYNC_FAILED',
          failureMessage: syncResult.error,
          completedAt: now,
        },
      });

      throw new ProjectSetupError(
        'Setup completed but configuration sync failed.',
        502,
        'CONFIG_SYNC_FAILED'
      );
    }

    const completedAttempt = await prisma.projectSetupAttempt.update({
      where: { id: attemptId },
      data: {
        ...baseUpdateData,
        status: 'COMPLETED',
        startedAt: attempt.startedAt ?? now,
        completedAt: now,
      },
    });

    return {
      attemptId,
      status: completedAttempt.status,
      completedAt: completedAttempt.completedAt?.toISOString() ?? null,
      setupRequired: false,
    };
  }

  const updatedAttempt = await prisma.projectSetupAttempt.update({
    where: { id: attemptId },
    data: {
      ...baseUpdateData,
      status: payload.status,
    },
  });

  return {
    attemptId,
    status: updatedAttempt.status,
    completedAt: updatedAttempt.completedAt?.toISOString() ?? null,
    setupRequired: isSetupRequired(project),
  };
}

export function getProviderForSetupAgent(agent: Agent) {
  return getProviderForAgent(agent);
}
