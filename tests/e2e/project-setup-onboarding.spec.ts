import { test, expect } from '../helpers/worker-isolation';
import { ensureProjectExists, getPrismaClient } from '../helpers/db-cleanup';
import { encryptCredential } from '@/lib/ai-credentials/crypto';

test.describe('Project setup onboarding', () => {
  test.beforeEach(async ({ projectId }) => {
    const prisma = getPrismaClient();
    await ensureProjectExists(projectId);
    await prisma.userCredential.deleteMany({
      where: {
        user: { email: 'test@e2e.local' },
      },
    });
    await prisma.project.update({
      where: { id: projectId },
      data: {
        config: null,
        configSyncedAt: null,
        defaultAgent: 'CLAUDE',
      },
    });
    await prisma.projectSetupJob.deleteMany({
      where: { projectId },
    });
  });

  test('redirects imported projects without config to setup and shows credential guidance', async ({
    page,
    projectId,
  }) => {
    await page.goto(`/projects/${projectId}`);
    await page.waitForURL(`**/projects/${projectId}/setup`);

    await expect(page.getByText(/Initialize /i)).toBeVisible();
  });

  test('resumes a running setup job after refresh', async ({ page, projectId }) => {
    const prisma = getPrismaClient();
    const anthropic = encryptCredential('sk-ant-api03-' + 'a'.repeat(80));

    await prisma.userCredential.create({
      data: {
        userId: 'test-user-id',
        provider: 'ANTHROPIC',
        credentialType: 'API_KEY',
        label: '[e2e] Setup Claude',
        encryptedValue: anthropic.encryptedValue,
        iv: anthropic.iv,
        authTag: anthropic.authTag,
        preview: anthropic.preview,
        readinessStatus: 'READY',
      },
    });

    await prisma.projectSetupJob.create({
      data: {
        projectId,
        selectedAgent: 'CLAUDE',
        status: 'RUNNING',
        dispatchKey: `e2e-${projectId}`,
        startedAt: new Date(Date.now() - 15_000),
      },
    });

    await page.goto(`/projects/${projectId}/setup`);
    await expect(page.getByText(/Onboarding already running/i)).toBeVisible();
    await expect(page.getByText(/Status: RUNNING/i)).toBeVisible();

    await page.reload();

    await expect(page.getByText(/Onboarding already running/i)).toBeVisible();
    await expect(page.getByRole('button', { name: 'Start onboarding' })).toBeDisabled();
  });
});
