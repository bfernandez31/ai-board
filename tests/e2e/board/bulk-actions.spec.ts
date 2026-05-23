import { test, expect } from '../../helpers/worker-isolation';
import type { APIRequestContext } from '@playwright/test';
import { getPrismaClient, cleanupDatabase } from '../../helpers/db-cleanup';

test.describe('Board bulk actions', () => {
  const BASE_URL = 'http://localhost:3000';
  const prisma = getPrismaClient();

  test.beforeEach(async ({ projectId }) => {
    await cleanupDatabase(projectId);
  });

  const createTicket = async (
    request: APIRequestContext,
    projectId: number,
    title: string,
    description: string
  ) => {
    const response = await request.post(`${BASE_URL}/api/projects/${projectId}/tickets`, {
      data: { title, description },
    });
    expect(response.ok()).toBe(true);
    return response.json() as Promise<{ id: number; ticketKey: string }>;
  };

  test('supports desktop multi-select and bulk delete', async ({ page, request, projectId }) => {
    const first = await createTicket(request, projectId, '[e2e] Bulk desktop 1', 'First');
    const second = await createTicket(request, projectId, '[e2e] Bulk desktop 2', 'Second');

    await page.goto(`${BASE_URL}/projects/${projectId}/board`);
    await page.getByRole('button', { name: `Select ${first.ticketKey}` }).click();
    await page.getByRole('button', { name: `Select ${second.ticketKey}` }).click({ modifiers: ['Shift'] });
    await expect(page.getByText('2 selected')).toBeVisible();

    await page.getByRole('button', { name: 'Delete selected tickets' }).click();
    await page.getByRole('button', { name: 'Delete tickets' }).click();
    await expect(page.getByText('2 selected')).not.toBeVisible();
  });

  test('supports mobile bulk agent/model updates and merge blocking feedback', async ({ page, request, projectId }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    const first = await createTicket(request, projectId, '[e2e] Bulk mobile 1', 'First');
    const second = await createTicket(request, projectId, '[e2e] Bulk mobile 2', 'Second');

    await prisma.ticket.update({
      where: { id: second.id },
      data: { stage: 'VERIFY' },
    });

    await page.goto(`${BASE_URL}/projects/${projectId}/board`);
    await page.getByRole('button', { name: `Select ${first.ticketKey}` }).click();
    await page.getByRole('button', { name: `Select ${second.ticketKey}` }).click();
    await page.getByRole('button', { name: 'Change agent for selected tickets' }).click();
    await page.getByRole('button', { name: 'Apply agent change' }).click();
    await expect(page.getByText(/bulk agent update failed/i)).toBeVisible();
  });
});
