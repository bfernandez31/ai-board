import { Agent } from '@prisma/client';
import { prisma } from './client';
import { requireAuth } from './users';
import type { NextRequest } from 'next/server';
import {
  buildProjectApiKeysState,
  decryptProjectApiKey,
  encryptProjectApiKey,
  getMissingProjectApiKeyMessage,
  getProjectApiKeyPreview,
  getProviderForAgent,
  type ProjectApiKeyProvider,
  type ProjectApiKeysState,
} from '@/lib/project-api-keys';

function getProviderFields(provider: ProjectApiKeyProvider): {
  encrypted: 'anthropicApiKeyEncrypted' | 'openaiApiKeyEncrypted';
  preview: 'anthropicApiKeyPreview' | 'openaiApiKeyPreview';
} {
  return provider === 'anthropic'
    ? {
        encrypted: 'anthropicApiKeyEncrypted',
        preview: 'anthropicApiKeyPreview',
      }
    : {
        encrypted: 'openaiApiKeyEncrypted',
        preview: 'openaiApiKeyPreview',
      };
}

async function verifyProjectOwnership(projectId: number, request?: NextRequest) {
  const userId = await requireAuth(request);

  const project = await prisma.project.findFirst({
    where: {
      id: projectId,
      userId,
    },
    select: {
      id: true,
      anthropicApiKeyPreview: true,
      openaiApiKeyPreview: true,
    },
  });

  if (!project) {
    throw new Error('Project not found');
  }

  return project;
}

export async function getProjectApiKeysState(
  projectId: number,
  request?: NextRequest
): Promise<ProjectApiKeysState> {
  const userId = await requireAuth(request);
  const project = await prisma.project.findFirst({
    where: {
      id: projectId,
      OR: [{ userId }, { members: { some: { userId } } }],
    },
    select: {
      anthropicApiKeyPreview: true,
      openaiApiKeyPreview: true,
    },
  });

  if (!project) {
    throw new Error('Project not found');
  }

  return buildProjectApiKeysState(project);
}

export async function setProjectApiKey(
  projectId: number,
  provider: ProjectApiKeyProvider,
  apiKey: string,
  request?: NextRequest
): Promise<ProjectApiKeysState> {
  await verifyProjectOwnership(projectId, request);

  const fields = getProviderFields(provider);
  const encrypted = encryptProjectApiKey(apiKey);
  const preview = getProjectApiKeyPreview(apiKey);

  const updatedProject = await prisma.project.update({
    where: { id: projectId },
    data: {
      [fields.encrypted]: encrypted,
      [fields.preview]: preview,
    },
    select: {
      anthropicApiKeyPreview: true,
      openaiApiKeyPreview: true,
    },
  });

  return buildProjectApiKeysState(updatedProject);
}

export async function deleteProjectApiKey(
  projectId: number,
  provider: ProjectApiKeyProvider,
  request?: NextRequest
): Promise<ProjectApiKeysState> {
  await verifyProjectOwnership(projectId, request);

  const fields = getProviderFields(provider);
  const updatedProject = await prisma.project.update({
    where: { id: projectId },
    data: {
      [fields.encrypted]: null,
      [fields.preview]: null,
    },
    select: {
      anthropicApiKeyPreview: true,
      openaiApiKeyPreview: true,
    },
  });

  return buildProjectApiKeysState(updatedProject);
}

export async function getDecryptedProjectApiKey(
  projectId: number,
  provider: ProjectApiKeyProvider
): Promise<string | null> {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: {
      anthropicApiKeyEncrypted: true,
      openaiApiKeyEncrypted: true,
    },
  });

  const encryptedValue =
    provider === 'anthropic'
      ? project?.anthropicApiKeyEncrypted
      : project?.openaiApiKeyEncrypted;

  if (!encryptedValue) {
    return null;
  }

  return decryptProjectApiKey(encryptedValue);
}

export function projectHasApiKeyForAgent(project: {
  anthropicApiKeyEncrypted: string | null;
  openaiApiKeyEncrypted: string | null;
}, agent: Agent): boolean {
  return agent === Agent.CODEX
    ? Boolean(project.openaiApiKeyEncrypted)
    : Boolean(project.anthropicApiKeyEncrypted);
}

export async function assertProjectApiKeyForAgent(projectId: number, agent: Agent): Promise<void> {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: {
      anthropicApiKeyEncrypted: true,
      openaiApiKeyEncrypted: true,
    },
  });

  if (!project) {
    throw new Error('Project not found');
  }

  if (!projectHasApiKeyForAgent(project, agent)) {
    throw new Error(getMissingProjectApiKeyMessage(agent));
  }
}

export async function getWorkflowAgentCredential(
  projectId: number,
  agent: Agent
): Promise<{ provider: ProjectApiKeyProvider; apiKey: string } | null> {
  const provider = getProviderForAgent(agent);
  const apiKey = await getDecryptedProjectApiKey(projectId, provider);

  if (!apiKey) {
    return null;
  }

  return { provider, apiKey };
}
