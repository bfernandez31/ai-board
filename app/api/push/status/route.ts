import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/db/users';
import { getUserPushSubscriptions } from '@/lib/db/push-subscriptions';

export async function GET(): Promise<NextResponse> {
  try {
    const userId = await requireAuth();

    const subscriptions = await getUserPushSubscriptions(userId);

    return NextResponse.json({
      enabled: subscriptions.length > 0,
      subscriptionCount: subscriptions.length,
      subscriptions: subscriptions.map((sub) => ({
        id: sub.id,
        userAgent: sub.userAgent,
        createdAt: sub.createdAt.toISOString(),
      })),
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('[Push Status] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
