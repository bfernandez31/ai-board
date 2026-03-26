import { test, expect } from '../helpers/worker-isolation';
import type { APIRequestContext } from '@playwright/test';
import { ensureProjectExists, cleanupDatabase } from '../helpers/db-cleanup';

const BASE_URL = 'http://localhost:3000';

async function createTicket(
  request: APIRequestContext,
  projectId: number,
  title: string
) {
  const response = await request.post(`${BASE_URL}/api/projects/${projectId}/tickets`, {
    data: {
      title,
      description: `${title} description`,
    },
  });

  if (!response.ok()) {
    throw new Error(`Failed to create ticket: ${response.status()}`);
  }

  return response.json() as Promise<{ ticketKey: string }>;
}

test.describe('Project Navigation Shell Desktop', () => {
  test.use({ viewport: { width: 1280, height: 900 } });

  test.beforeEach(async ({ projectId }) => {
    await cleanupDatabase(projectId);
    await ensureProjectExists(projectId);
  });

  test('shows the desktop rail, navigates across views, and opens the command palette', async ({
    page,
    request,
    projectId,
  }) => {
    test.setTimeout(45_000);
    const ticket = await createTicket(request, projectId, '[e2e] Palette Desktop Ticket');

    await page.goto(`/projects/${projectId}/board`);
    await page.waitForLoadState('networkidle');

    await expect(page.getByTestId('desktop-project-rail')).toBeVisible();
    await expect(page.getByTestId('command-palette-trigger')).toBeVisible();

    await page.getByLabel('Activity').click();
    await expect(page).toHaveURL(`/projects/${projectId}/activity`);

    await page.keyboard.press('Control+k');
    await expect(page.getByRole('dialog')).toBeVisible();

    await page.getByLabel('Search destinations and tickets').fill(ticket.ticketKey);
    const ticketOption = page.getByRole('option', { name: new RegExp(ticket.ticketKey) });
    await expect(ticketOption).toBeVisible();
    await ticketOption.click();

    await expect(page).toHaveURL(new RegExp(`/projects/${projectId}/board\\?ticket=${ticket.ticketKey}&modal=open`));
  });
});

test.describe('Project Navigation Shell Mobile', () => {
  test.use({ viewport: { width: 375, height: 667 } });

  test.beforeEach(async ({ projectId }) => {
    await cleanupDatabase(projectId);
    await ensureProjectExists(projectId);
  });

  test('hides the rail on mobile and keeps hamburger navigation available', async ({
    page,
    projectId,
  }) => {
    await page.goto(`/projects/${projectId}/board`);
    await page.waitForLoadState('networkidle');

    await expect(page.getByTestId('desktop-project-rail')).toBeHidden();
    await expect(page.getByRole('button', { name: 'Toggle menu' })).toBeVisible();
  });
});
