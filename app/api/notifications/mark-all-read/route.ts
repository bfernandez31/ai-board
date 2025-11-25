// API endpoint for marking all notifications as read

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/db/users';
import { markAllNotificationsAsRead } from '@/app/lib/db/notifications';

export async function POST(_request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized', code: 'AUTH_REQUIRED' },
        { status: 401 }
      );
    }

    const result = await markAllNotificationsAsRead(user.id);

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
