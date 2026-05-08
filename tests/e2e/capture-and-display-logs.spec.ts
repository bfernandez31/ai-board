import { test, expect } from '../helpers/worker-isolation';
import type { PrismaClient } from '@prisma/client';
import { getPrismaClient, cleanupDatabase, getProjectKey } from '../helpers/db-cleanup';

/**
 * E2E: Capture and display agent execution logs (AIB-715)
 *
 * MVP scenario for User Story 1 — seed a FAILED job with a captured JobLog
 * fixture, open the ticket modal as a member (not owner), assert the inline
 * preview is visible on the Stats tab, click "View full logs", and assert
 * the sheet surface renders (we do not mock the Blob backend, so the viewer
 * shows the expected 502 error state — the *UI wiring* is what this test
 * verifies end-to-end).
 */
test.describe('AIB-715 capture and display logs', () => {
  let prisma: PrismaClient;
  let ticketNumber = 1;

  test.beforeAll(() => {
    prisma = getPrismaClient();
  });

  test.beforeEach(async ({ projectId }) => {
    await cleanupDatabase(projectId);
    ticketNumber = 1;
  });

  test('member sees inline preview and opens the log viewer', async ({ page, projectId }) => {
    const projectKey = getProjectKey(projectId);
    const ticket = await prisma.ticket.create({
      data: {
        ticketNumber: ticketNumber++,
        ticketKey: `${projectKey}-${ticketNumber}`,
        projectId,
        title: '[e2e] AIB-715 failure diagnosis',
        description: 'Seeded failure for log-capture E2E.',
        stage: 'VERIFY',
        updatedAt: new Date(),
      },
    });

    const job = await prisma.job.create({
      data: {
        ticketId: ticket.id,
        projectId,
        command: 'implement',
        status: 'FAILED',
        startedAt: new Date(),
        completedAt: new Date(),
        updatedAt: new Date(),
      },
    });

    await prisma.jobLog.create({
      data: {
        jobId: job.id,
        captureStatus: 'CAPTURED',
        preview: 'Bash command failed: exit 1 — missing fixture file',
        schemaVersion: 1,
        eventCount: 3,
        errorCount: 1,
        artifactKey: `logs/${projectId}/${ticket.id}/${job.id}.jsonl.gz`,
        artifactSize: 1234,
      },
    });

    // Navigate to the project board and open the ticket modal.
    await page.goto(`/projects/${projectId}/board`);
    const card = page.locator(`[data-ticket-id="${ticket.id}"]`);
    await card.waitFor({ state: 'visible', timeout: 10000 });
    await card.click();

    // Open the Stats tab where the timeline + preview live.
    const statsTab = page.getByRole('tab', { name: /stats/i });
    if (await statsTab.isVisible()) {
      await statsTab.click();
    }

    // Preview now lives inside the expanded job row — open it first.
    const jobRow = page.locator(`[data-testid="job-row-${job.id}"]`);
    await expect(jobRow).toBeVisible();
    await jobRow.click();

    // Inline preview visible inside the expanded job block.
    const preview = page.locator(`[data-testid="job-log-preview-${job.id}"]`);
    await expect(preview).toBeVisible();
    await expect(preview).toContainText('Bash command failed');

    // "View full logs" trigger present and clickable.
    const viewer = page.locator(`[data-testid="view-full-logs-${job.id}"]`);
    await expect(viewer).toBeVisible();
    await viewer.click();

    // Sheet renders; since Blob is not configured in the E2E env the
    // viewer surfaces an error state. That's the wiring we validate here.
    const sheet = page.locator('[data-testid="log-viewer-sheet"]');
    await expect(sheet).toBeVisible();
  });

  test('raw-native endpoint serves Claude raw artifacts and 404s on Codex jobs', async ({
    page,
    projectId,
  }) => {
    const projectKey = getProjectKey(projectId);

    const claudeTicket = await prisma.ticket.create({
      data: {
        ticketNumber: ticketNumber++,
        ticketKey: `${projectKey}-${ticketNumber}`,
        projectId,
        title: '[e2e] AIB-783 raw-native Claude',
        description: 'Seeded Claude job with raw artifact for raw-native E2E.',
        stage: 'VERIFY',
        agent: 'CLAUDE',
        updatedAt: new Date(),
      },
    });
    const claudeJob = await prisma.job.create({
      data: {
        ticketId: claudeTicket.id,
        projectId,
        command: 'implement',
        status: 'COMPLETED',
        startedAt: new Date(),
        completedAt: new Date(),
        updatedAt: new Date(),
      },
    });
    await prisma.jobLog.create({
      data: {
        jobId: claudeJob.id,
        captureStatus: 'CAPTURED',
        preview: 'raw-native happy path',
        schemaVersion: 1,
        eventCount: 1,
        errorCount: 0,
        artifactKey: `logs/${projectId}/${claudeTicket.id}/${claudeJob.id}.jsonl.gz`,
        artifactSize: 100,
        rawArtifactKey: `raw-logs/${projectId}/${claudeTicket.id}/${claudeJob.id}.jsonl.gz`,
        rawArtifactSize: 200,
      },
    });

    const codexTicket = await prisma.ticket.create({
      data: {
        ticketNumber: ticketNumber++,
        ticketKey: `${projectKey}-${ticketNumber}`,
        projectId,
        title: '[e2e] AIB-783 raw-native Codex',
        description: 'Seeded Codex job (no raw artifact) for raw-native E2E.',
        stage: 'VERIFY',
        agent: 'CODEX',
        updatedAt: new Date(),
      },
    });
    const codexJob = await prisma.job.create({
      data: {
        ticketId: codexTicket.id,
        projectId,
        command: 'implement',
        status: 'COMPLETED',
        startedAt: new Date(),
        completedAt: new Date(),
        updatedAt: new Date(),
      },
    });
    await prisma.jobLog.create({
      data: {
        jobId: codexJob.id,
        captureStatus: 'CAPTURED',
        preview: 'codex job no raw',
        schemaVersion: 1,
        eventCount: 1,
        errorCount: 0,
        artifactKey: `logs/${projectId}/${codexTicket.id}/${codexJob.id}.jsonl.gz`,
        artifactSize: 100,
      },
    });

    // Authenticate the request fixture by visiting any page first (sets cookies / test-user header).
    await page.goto(`/projects/${projectId}/board`);

    // Codex job has no rawArtifactKey, so the route must return 404.
    const codexRes = await page.request.get(
      `/api/projects/${projectId}/tickets/${codexTicket.id}/jobs/${codexJob.id}/logs/raw-native`,
    );
    expect(codexRes.status()).toBe(404);

    // Claude job's raw artifact exists in DB; route returns 200 (gzip) when
    // Blob is configured, 502 BLOB_UNREACHABLE otherwise. Either response
    // demonstrates the route wiring (auth, key derivation, agent gate)
    // resolved correctly past the 404 cases — same philosophy as the viewer
    // wiring assertion above.
    const claudeRes = await page.request.get(
      `/api/projects/${projectId}/tickets/${claudeTicket.id}/jobs/${claudeJob.id}/logs/raw-native`,
    );
    expect([200, 502]).toContain(claudeRes.status());
    if (claudeRes.status() === 200) {
      expect(claudeRes.headers()['content-type']).toBe('application/gzip');
    }
  });
});
