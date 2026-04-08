import { z } from 'zod';
import { Agent, CredentialProvider, CredentialReadiness, ProjectSetupJobStatus } from '@prisma/client';

export const setupSelectedAgentSchema = z.nativeEnum(Agent);

export const setupProviderSchema = z.nativeEnum(CredentialProvider);

export const setupReadinessSchema = z.nativeEnum(CredentialReadiness);

export const projectSetupJobStatusSchema = z.nativeEnum(ProjectSetupJobStatus);

export const onboardingArtifactKindSchema = z.enum([
  'config',
  'constitution',
  'instructions',
  'alias',
  'ignore',
  'analysis',
]);

export const onboardingArtifactStatusSchema = z.enum([
  'generated',
  'preserved',
  'updated',
  'missing',
]);

export const onboardingArtifactManifestEntrySchema = z.object({
  path: z.string().min(1),
  kind: onboardingArtifactKindSchema,
  status: onboardingArtifactStatusSchema,
  editable: z.boolean().default(true),
  summary: z.string().nullish(),
});

export const repositoryAnalysisSummarySchema = z.object({
  detectedLanguages: z.array(z.string()).default([]),
  frameworks: z.array(z.string()).default([]),
  packageManagers: z.array(z.string()).default([]),
  commands: z.record(z.string(), z.string()).default({}),
  services: z
    .array(
      z.object({
        type: z.string(),
        version: z.string().optional(),
        evidence: z.array(z.string()).default([]),
      })
    )
    .default([]),
  testingSignals: z.array(z.string()).default([]),
  architectureNotes: z.array(z.string()).default([]),
  confidence: z.record(z.string(), z.enum(['high', 'medium', 'low'])).default({}),
});

export const projectSetupStatusSchema = z.object({
  jobId: z.number().int().positive(),
  status: projectSetupJobStatusSchema,
  selectedAgent: setupSelectedAgentSchema,
  dispatchKey: z.string().nullable().optional(),
  workflowRunId: z.string().nullable().optional(),
  defaultBranch: z.string().nullable().optional(),
  startedAt: z.string().nullable(),
  completedAt: z.string().nullable(),
  elapsedSeconds: z.number().int().nonnegative().nullable(),
  commitSha: z.string().nullable(),
  error: z
    .object({
      code: z.string().nullable(),
      message: z.string().nullable(),
    })
    .nullable(),
  analysisSummary: repositoryAnalysisSummarySchema.nullable().optional(),
  artifactManifest: z.array(onboardingArtifactManifestEntrySchema).default([]),
  configPreview: z.record(z.string(), z.unknown()).nullable().optional(),
});

export const setupAgentReadinessSchema = z.object({
  agent: setupSelectedAgentSchema,
  provider: setupProviderSchema,
  ready: z.boolean(),
  credentialType: z.enum(['API_KEY', 'OAUTH_TOKEN']).nullable(),
  readinessStatus: setupReadinessSchema.nullable(),
  verificationCode: z.string().nullable(),
  verificationMessage: z.string().nullable(),
});

export const projectSetupStateSchema = z.object({
  projectId: z.number().int().positive(),
  requiresSetup: z.boolean(),
  selectedAgentDefault: setupSelectedAgentSchema,
  eligibleAgents: z.array(setupAgentReadinessSchema),
  latestSetupJob: projectSetupStatusSchema.nullable(),
  redirectTo: z.string().nullable(),
});

export const projectSetupStartSchema = z.object({
  selectedAgent: setupSelectedAgentSchema,
});

export const projectSetupDispatchResponseSchema = z.object({
  created: z.boolean(),
  duplicate: z.boolean().default(false),
  job: projectSetupStatusSchema,
});

export const projectSetupStatusUpdateSchema = z
  .object({
    jobId: z.number().int().positive(),
    status: projectSetupJobStatusSchema,
    workflowRunId: z.union([z.number().int().positive(), z.string().regex(/^\d+$/)]).optional(),
    defaultBranch: z.string().min(1).optional(),
    commitSha: z.string().regex(/^[a-f0-9]{7,40}$/i).optional(),
    analysisSummary: repositoryAnalysisSummarySchema.optional(),
    artifactManifest: z.array(onboardingArtifactManifestEntrySchema).optional(),
    configPreview: z.record(z.string(), z.unknown()).optional(),
    errorCode: z.string().min(1).optional(),
    errorMessage: z.string().min(1).optional(),
  })
  .superRefine((value, ctx) => {
    if (value.status === 'COMPLETED' && !value.commitSha) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['commitSha'],
        message: 'commitSha is required when setup completes',
      });
    }

    if (value.status === 'FAILED' && !value.errorMessage) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['errorMessage'],
        message: 'errorMessage is required when setup fails',
      });
    }
  });

export const onboardingArtifactDocumentSchema = z.object({
  path: z.string().min(1),
  kind: onboardingArtifactKindSchema,
  status: onboardingArtifactStatusSchema,
  content: z.string(),
  editable: z.boolean(),
  sha: z.string().nullable(),
});

export const onboardingArtifactUpdateSchema = z.object({
  artifacts: z.array(
    z.object({
      path: z.string().min(1),
      content: z.string(),
    })
  ),
});
