import { webpush, isPushConfigured } from './web-push-config';
import type { PushPayload, WebPushSubscription } from './subscription-schema';
import { prisma } from '@/lib/db/client';
import { deletePushSubscriptionById } from '@/lib/db/push-subscriptions';

async function sendNotification(
  subscription: WebPushSubscription,
  payload: PushPayload
): Promise<boolean> {
  if (!isPushConfigured) {
    console.warn('[Push] VAPID keys not configured, skipping notification');
    return false;
  }

  try {
    await webpush.sendNotification(subscription, JSON.stringify(payload));
    return true;
  } catch (error: unknown) {
    const statusCode = (error as { statusCode?: number }).statusCode;

    if (statusCode === 404 || statusCode === 410) {
      console.log('[Push] Subscription expired, will be cleaned up');
      return false;
    }

    if (statusCode === 429) {
      console.warn('[Push] Rate limited, will retry later');
      return false;
    }

    console.error('[Push] Failed to send notification:', error);
    return false;
  }
}

export async function sendJobCompletionNotification(
  jobId: number,
  status: 'COMPLETED' | 'FAILED' | 'CANCELLED'
): Promise<void> {
  if (!isPushConfigured) {
    return;
  }

  try {
    const job = await prisma.job.findUnique({
      where: { id: jobId },
      select: {
        id: true,
        command: true,
        ticket: {
          select: {
            ticketKey: true,
            title: true,
            project: {
              select: {
                id: true,
                userId: true,
              },
            },
          },
        },
      },
    });

    if (!job || !job.ticket) {
      console.warn('[Push] Job or ticket not found:', jobId);
      return;
    }

    const projectOwnerId = job.ticket.project.userId;
    const subscriptions = await prisma.pushSubscription.findMany({
      where: { userId: projectOwnerId },
    });

    if (subscriptions.length === 0) {
      return;
    }

    const statusText = status === 'COMPLETED' ? 'completed' : status === 'FAILED' ? 'failed' : 'cancelled';
    const icon = status === 'COMPLETED' ? '/icon-success.png' : status === 'FAILED' ? '/icon-error.png' : '/icon-warning.png';

    const payload: PushPayload = {
      title: `Job ${statusText}: ${job.ticket.ticketKey}`,
      body: `${job.command} ${statusText} for "${job.ticket.title}"`,
      icon,
      url: `/projects/${job.ticket.project.id}?ticket=${job.ticket.ticketKey}`,
      type: 'job_completion',
      ticketKey: job.ticket.ticketKey,
    };

    const results = await Promise.allSettled(
      subscriptions.map(async (sub) => {
        const webPushSub: WebPushSubscription = {
          endpoint: sub.endpoint,
          keys: {
            p256dh: sub.p256dh,
            auth: sub.auth,
          },
        };

        const success = await sendNotification(webPushSub, payload);

        if (!success) {
          try {
            await deletePushSubscriptionById(sub.id);
          } catch {
            // Ignore cleanup errors
          }
        }

        return success;
      })
    );

    const sentCount = results.filter(
      (r) => r.status === 'fulfilled' && r.value
    ).length;

    console.log(
      `[Push] Job completion notification sent to ${sentCount}/${subscriptions.length} subscriptions`
    );
  } catch (error) {
    console.error('[Push] Error sending job completion notification:', error);
  }
}

export async function sendMentionNotification(
  recipientId: string,
  actorName: string,
  ticketKey: string,
  projectId: number
): Promise<void> {
  if (!isPushConfigured) {
    return;
  }

  try {
    const subscriptions = await prisma.pushSubscription.findMany({
      where: { userId: recipientId },
    });

    if (subscriptions.length === 0) {
      return;
    }

    const payload: PushPayload = {
      title: `Mentioned in ${ticketKey}`,
      body: `${actorName} mentioned you in a comment`,
      icon: '/icon-mention.png',
      url: `/projects/${projectId}?ticket=${ticketKey}`,
      type: 'mention',
      ticketKey,
    };

    const results = await Promise.allSettled(
      subscriptions.map(async (sub) => {
        const webPushSub: WebPushSubscription = {
          endpoint: sub.endpoint,
          keys: {
            p256dh: sub.p256dh,
            auth: sub.auth,
          },
        };

        const success = await sendNotification(webPushSub, payload);

        if (!success) {
          try {
            await deletePushSubscriptionById(sub.id);
          } catch {
            // Ignore cleanup errors
          }
        }

        return success;
      })
    );

    const sentCount = results.filter(
      (r) => r.status === 'fulfilled' && r.value
    ).length;

    console.log(
      `[Push] Mention notification sent to ${sentCount}/${subscriptions.length} subscriptions`
    );
  } catch (error) {
    console.error('[Push] Error sending mention notification:', error);
  }
}
