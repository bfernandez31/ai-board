import { Agent } from '@prisma/client';
import type { NextRequest } from 'next/server';
import { prisma } from './client';
import { requireAuth } from './users';
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

const PROJECT_API_KEYS_PREVIEW_SELECT = {
  anthropicApiKeyPreview: true,
  openaiApiKeyPreview: true,
} as const;

const PROJECT_API_KEYS_ENCRYPTED_SELECT = {
  anthropicApiKeyEncrypted: true,
  openaiApiKeyEncrypted: true,
} as const;

function getProviderFields(provider: ProjectApiKeyProvider): {
  encrypted: 'anthropicApiKeyEncrypted' | 'openaiApiKeyEncrypted';
  preview: 'anthropicApiKeyPreview' | 'openaiApiKeyPreview';
} {
  switch (provider) {
    case 'anthropic':
      return {
        encrypted: 'anthropicApiKeyEncrypted',
        preview: 'anthropicApiKeyPreview',
      };
    case 'openai':
      return {
        encrypted: 'openaiApiKeyEncrypted',
        preview: 'openaiApiKeyPreview',
      };
  }
}

async function verifyProjectOwnership(
  projectId: number,
  request?: NextRequest
): Promise<{
  id: number;
  anthropicApiKeyPreview: string | null;
  openaiApiKeyPreview: string | null;
}> {
  const userId = await requireAuth(request);

  const project = await prisma.project.findFirst({
    where: {
      id: projectId,
      userId,
    },
    select: {
      id: true,
      ...PROJECT_API_KEYS_PREVIEW_SELECT,
    },
  });

  if (!project) {
    throw new Error('Project not found');
  }

  return project;
}

function getEncryptedProjectApiKey(
  project: {
    anthropicApiKeyEncrypted: string | null;
    openaiApiKeyEncrypted: string | null;
  },
  provider: ProjectApiKeyProvider
): string | null {
  switch (provider) {
    case 'anthropic':
      return project.anthropicApiKeyEncrypted;
    case 'openai':
      return project.openaiApiKeyEncrypted;
  }
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
    select: PROJECT_API_KEYS_PREVIEW_SELECT,
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
    select: PROJECT_API_KEYS_PREVIEW_SELECT,
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
    select: PROJECT_API_KEYS_PREVIEW_SELECT,
  });

  return buildProjectApiKeysState(updatedProject);
}

export async function getDecryptedProjectApiKey(
  projectId: number,
  provider: ProjectApiKeyProvider
): Promise<string | null> {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: PROJECT_API_KEYS_ENCRYPTED_SELECT,
  });

  if (!project) {
    return null;
  }

  const encryptedValue = getEncryptedProjectApiKey(project, provider);

  if (!encryptedValue) {
    return null;
  }

  return decryptProjectApiKey(encryptedValue);
}

export function projectHasApiKeyForAgent(project: {
  anthropicApiKeyEncrypted: string | null;
  openaiApiKeyEncrypted: string | null;
}, agent: Agent): boolean {
  return Boolean(getEncryptedProjectApiKey(project, getProviderForAgent(agent)));
}

export async function assertProjectApiKeyForAgent(projectId: number, agent: Agent): Promise<void> {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: PROJECT_API_KEYS_ENCRYPTED_SELECT,
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
