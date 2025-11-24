// API endpoint for marking all notifications as read

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { markAllNotificationsAsRead } from '@/app/lib/db/notifications';

export async function POST(_request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized', code: 'AUTH_REQUIRED' },
        { status: 401 }
      );
    }

    const result = await markAllNotificationsAsRead(session.user.id);

    return NextResponse.json({
      success: true,
      count: result.count,
    });
  } catch (error) {
    console.error('[API] Failed to mark all notifications as read:', error);
    return NextResponse.json(
      { error: 'Failed to mark notifications as read', code: 'DATABASE_ERROR' },
      { status: 500 }
    );
  }
}
