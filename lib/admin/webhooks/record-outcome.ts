import { WebhookOutcomeStatus } from '@prisma/client';
import { prisma } from '@/lib/db/client';

export async function recordWebhookOutcome(
  eventId: string,
  eventType: string,
  status: WebhookOutcomeStatus,
  errorMessage?: string
): Promise<void> {
  try {
    await prisma.webhookOutcome.create({
      data: {
        provider: 'stripe',
        eventId,
        eventType,
        status,
        errorMessage: errorMessage ?? null,
      },
    });
  } catch (err) {
    console.error('recordWebhookOutcome failed', { provider: 'stripe', eventId, eventType }, err);
  }
}
