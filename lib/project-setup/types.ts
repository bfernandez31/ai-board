import type {
  Agent,
  CredentialProvider,
  ProjectSetupAttempt,
  ProjectSetupStatus,
  Prisma,
} from '@prisma/client';

export type SetupArtifactSummary = Prisma.JsonValue;

export interface SetupAttemptDto {
  id: number;
  selectedAgent: Agent;
  status: ProjectSetupStatus;
  createdAt: string;
  startedAt: string | null;
  completedAt: string | null;
  elapsedSeconds: number | null;
  resultMessage: string | null;
  failureCode: string | null;
  failureMessage: string | null;
  artifactSummary: SetupArtifactSummary | null;
}

export interface SetupCredentialReadinessDto {
  provider: CredentialProvider;
  ready: boolean;
  readinessStatus: 'MISSING' | 'PENDING_VERIFICATION' | 'READY' | 'ACTION_REQUIRED';
  message: string;
}

export interface ProjectSetupResponse {
  projectId: number;
  setupRequired: boolean;
  viewerCanManage: boolean;
  selectedAgentOptions: Agent[];
  credentialReadiness: Record<Agent, SetupCredentialReadinessDto>;
  latestAttempt: SetupAttemptDto | null;
}

export interface SetupStartResponse {
  attempt: SetupAttemptDto;
}

export interface SetupCallbackResponse {
  attemptId: number;
  status: ProjectSetupStatus;
  completedAt: string | null;
  setupRequired: boolean;
}

export interface SetupCallbackPayload {
  status: ProjectSetupStatus;
  workflowRunId?: number | null;
  message?: string | null;
  failureCode?: string | null;
  failureMessage?: string | null;
  artifactSummary?: SetupArtifactSummary | null;
}

export type DerivedProjectSetupState =
  | { kind: 'not_required'; latestAttempt: ProjectSetupAttempt | null }
  | { kind: 'ready_to_start'; latestAttempt: ProjectSetupAttempt | null }
  | { kind: 'pending'; latestAttempt: ProjectSetupAttempt }
  | { kind: 'running'; latestAttempt: ProjectSetupAttempt; elapsedSeconds: number }
  | { kind: 'failed'; latestAttempt: ProjectSetupAttempt }
  | { kind: 'completed'; latestAttempt: ProjectSetupAttempt };
