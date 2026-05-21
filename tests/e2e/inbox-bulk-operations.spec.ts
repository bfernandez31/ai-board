/**
 * E2E: Multi-select INBOX bulk operations (AIB-820 US1)
 *
 * Seeds 5 INBOX tickets, selects 3 via checkboxes, deletes them via the
 * bulk-action bar's confirmation dialog, and asserts both DB state and the
 * board UI reflect the change with a single result-summary toast.
 */
import { test, expect } from '../helpers/worker-isolation';
import { cleanupDatabase, getPrismaClient } from '../helpers/db-cleanup';

test.describe('Inbox bulk operations', () => {
  test.beforeEach(async ({ page, projectId }) => {
    await cleanupDatabase(projectId);
    await page.route('**/api/sse**', async (route) => {
      await route.fulfill({ status: 200, contentType: 'text/event-stream', body: '' });
    });
  });

  test('deletes the selected INBOX tickets via the bulk action bar', async ({ page, projectId }) => {
    const prisma = getPrismaClient();
    const project = await prisma.project.findUniqueOrThrow({ where: { id: projectId } });
    let nextNumber = project.lastTicketNumber + 1;

    const created = await Promise.all(
      Array.from({ length: 5 }, async (_, i) => {
        const t = await prisma.ticket.create({
          data: {
            projectId,
            ticketNumber: nextNumber + i,
            ticketKey: `${project.key}-${nextNumber + i}`,
            title: `[e2e] bulk-delete fixture ${i}`,
            description: `bulk delete e2e ${i}`,
            stage: 'INBOX',
          },
        });
        return t;
      }),
    );
    await prisma.project.update({
      where: { id: projectId },
      data: { lastTicketNumber: project.lastTicketNumber + 5 },
    });
    const toDelete = created.slice(0, 3);

    await page.goto(`/projects/${projectId}/board`);
    await page.waitForLoadState('networkidle');

    for (const ticket of toDelete) {
      const card = page.locator(`[data-ticket-id="${ticket.id}"]`);
      await card.waitFor({ state: 'visible' });
      await card.locator('[data-testid="ticket-select-overlay"]').click();
    }

    await expect(page.getByTestId('bulk-selection-count')).toContainText('3 selected');
    await page.getByTestId('bulk-delete').click();
    await page.getByRole('button', { name: /delete 3 tickets/i }).click();

    await expect(page.getByText('3 tickets deleted')).toBeVisible({ timeout: 8_000 });

    const remaining = await prisma.ticket.findMany({
      where: { id: { in: created.map((t) => t.id) } },
    });
    expect(remaining).toHaveLength(2);
    expect(remaining.map((t) => t.id).sort()).toEqual(created.slice(3).map((t) => t.id).sort());
  });
});
