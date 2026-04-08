import type {
  Agent,
  CredentialProvider,
  CredentialReadiness,
  CredentialType,
  ProjectSetupJob,
  ProjectSetupJobStatus,
} from '@prisma/client';

export interface OnboardingArtifactManifestEntry {
  path: string;
  kind: 'config' | 'constitution' | 'instructions' | 'alias' | 'ignore' | 'analysis';
  status: 'generated' | 'preserved' | 'updated' | 'missing';
  editable: boolean;
  summary?: string | null;
}

export interface RepositoryAnalysisSummary {
  detectedLanguages: string[];
  frameworks: string[];
  packageManagers: string[];
  commands: Record<string, string>;
  services: Array<{ type: string; version?: string; evidence: string[] }>;
  testingSignals: string[];
  architectureNotes: string[];
  confidence: Record<string, 'high' | 'medium' | 'low'>;
}

export interface SetupAgentReadiness {
  agent: Agent;
  provider: CredentialProvider;
  ready: boolean;
  credentialType: CredentialType | null;
  readinessStatus: CredentialReadiness | null;
  verificationCode: string | null;
  verificationMessage: string | null;
}

export interface ProjectSetupStatusDto {
  jobId: number;
  status: ProjectSetupJobStatus;
  selectedAgent: Agent;
  dispatchKey?: string | null;
  workflowRunId?: string | null;
  defaultBranch?: string | null;
  startedAt: string | null;
  completedAt: string | null;
  elapsedSeconds: number | null;
  commitSha: string | null;
  error: {
    code: string | null;
    message: string | null;
  } | null;
  analysisSummary?: RepositoryAnalysisSummary | null;
  artifactManifest: OnboardingArtifactManifestEntry[];
  configPreview?: Record<string, unknown> | null;
}

export interface ProjectSetupStateDto {
  projectId: number;
  requiresSetup: boolean;
  selectedAgentDefault: Agent;
  eligibleAgents: SetupAgentReadiness[];
  latestSetupJob: ProjectSetupStatusDto | null;
  redirectTo: string | null;
}

export interface OnboardingArtifactDocument {
  path: string;
  kind: OnboardingArtifactManifestEntry['kind'];
  status: OnboardingArtifactManifestEntry['status'];
  content: string;
  editable: boolean;
  sha: string | null;
}

export function mapSetupJobToStatusDto(
  job: Pick<
    ProjectSetupJob,
    | 'id'
    | 'status'
    | 'selectedAgent'
    | 'dispatchKey'
    | 'workflowRunId'
    | 'defaultBranch'
    | 'startedAt'
    | 'completedAt'
    | 'commitSha'
    | 'errorCode'
    | 'errorMessage'
    | 'analysisSummary'
    | 'artifactManifest'
    | 'configPreview'
  >
): ProjectSetupStatusDto {
  const startedAt = job.startedAt?.toISOString() ?? null;
  const completedAt = job.completedAt?.toISOString() ?? null;
  const now = Date.now();
  const elapsedSeconds = job.startedAt
    ? Math.max(
        0,
        Math.floor(((job.completedAt?.getTime() ?? now) - job.startedAt.getTime()) / 1000)
      )
    : null;

  return {
    jobId: job.id,
    status: job.status,
    selectedAgent: job.selectedAgent,
    dispatchKey: job.dispatchKey,
    workflowRunId: job.workflowRunId?.toString() ?? null,
    defaultBranch: job.defaultBranch,
    startedAt,
    completedAt,
    elapsedSeconds,
    commitSha: job.commitSha,
    error: job.errorCode || job.errorMessage
      ? {
          code: job.errorCode ?? null,
          message: job.errorMessage ?? null,
        }
      : null,
    analysisSummary: (job.analysisSummary as RepositoryAnalysisSummary | null | undefined) ?? null,
    artifactManifest:
      (job.artifactManifest as OnboardingArtifactManifestEntry[] | null | undefined) ?? [],
    configPreview: (job.configPreview as Record<string, unknown> | null | undefined) ?? null,
  };
}
