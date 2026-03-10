import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/db/users';
import { getUserSubscription } from '@/lib/billing/subscription';

export async function GET() {
  try {
    const userId = await requireAuth();
    const subscription = await getUserSubscription(userId);
    return NextResponse.json(subscription);
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Failed to fetch subscription:', error);
    return NextResponse.json(
      { error: 'Failed to fetch subscription' },
      { status: 500 }
    );
  }
}
