import type { PrismaClient } from '@prisma/client';

const JOB_POLL_ATTEMPTS = 10;
const JOB_POLL_DELAY_MS = 100;

export async function waitForLatestJobId(
  prisma: PrismaClient,
  ticketId: number,
  orderBy: 'id' | 'createdAt' = 'id'
): Promise<number> {
  for (let attempt = 0; attempt < JOB_POLL_ATTEMPTS; attempt += 1) {
    const ticket = await prisma.ticket.findUnique({
      where: { id: ticketId },
      include: { jobs: { orderBy: { [orderBy]: 'desc' } } },
    });

    const latestJobId = ticket?.jobs[0]?.id;
    if (latestJobId) {
      return latestJobId;
    }

    await new Promise((resolve) => setTimeout(resolve, JOB_POLL_DELAY_MS));
  }

  throw new Error(`Timed out waiting for a job on ticket ${ticketId}`);
}
