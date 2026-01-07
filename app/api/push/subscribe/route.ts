import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/db/users';
import { upsertPushSubscription } from '@/lib/db/push-subscriptions';
import { pushSubscriptionInputSchema } from '@/app/lib/push/subscription-schema';

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const userId = await requireAuth();

    let body;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
    }

    const validationResult = pushSubscriptionInputSchema.safeParse(body);
    if (!validationResult.success) {
      return NextResponse.json(
        {
          error: 'Invalid subscription data',
          details: validationResult.error.issues.map((err) => ({
            message: err.message,
            path: err.path,
          })),
        },
        { status: 400 }
      );
    }

    const userAgent = request.headers.get('user-agent') || undefined;

    await upsertPushSubscription(userId, validationResult.data, userAgent);

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('[Push Subscribe] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
