// API endpoint for marking a notification as read

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { markNotificationAsRead } from '@/app/lib/db/notifications';
import { prisma } from '@/lib/db/client';

export async function PATCH(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized', code: 'AUTH_REQUIRED' },
        { status: 401 }
      );
    }

    const notificationId = parseInt(params.id);
    if (isNaN(notificationId)) {
      return NextResponse.json(
        { error: 'Invalid notification ID', code: 'INVALID_ID' },
        { status: 400 }
      );
    }

    const notification = await prisma.notification.findUnique({
      where: { id: notificationId },
    });

    if (!notification) {
      return NextResponse.json(
        { error: 'Notification not found', code: 'NOT_FOUND' },
        { status: 404 }
      );
    }

    if (notification.recipientId !== session.user.id) {
      return NextResponse.json(
        { error: 'Cannot mark notification belonging to another user', code: 'FORBIDDEN' },
        { status: 403 }
      );
    }

    await markNotificationAsRead(notificationId, session.user.id);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[API] Failed to mark notification as read:', error);
    return NextResponse.json(
      { error: 'Failed to update notification', code: 'DATABASE_ERROR' },
      { status: 500 }
    );
  }
}
