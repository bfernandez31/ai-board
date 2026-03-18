// API endpoint for listing notifications

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/db/users';
import { getNotificationsForUser, getUnreadCount } from '@/app/lib/db/notifications';

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized', code: 'AUTH_REQUIRED' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const limit = Math.min(parseInt(searchParams.get('limit') || '5'), 50);

    const notifications = await getNotificationsForUser(user.id, limit);
    const unreadCount = await getUnreadCount(user.id);

    const notificationsDisplay = notifications.map((n) => ({
      id: n.id,
      actorName: n.actor.name || n.actor.email,
      actorImage: n.actor.image,
      ticketKey: n.ticket.ticketKey,
      commentPreview: n.comment.content.substring(0, 80) + (n.comment.content.length > 80 ? '...' : ''),
      createdAt: n.createdAt.toISOString(),
      read: n.read,
      commentId: n.commentId,
      projectId: n.ticket.projectId,
    }));

    return NextResponse.json({
      notifications: notificationsDisplay,
      unreadCount,
      hasMore: notifications.length === limit,
    });
  } catch (error) {
    console.error('[API] Failed to fetch notifications:', error);
    return NextResponse.json(
      { error: 'Failed to fetch notifications', code: 'DATABASE_ERROR' },
      { status: 500 }
    );
  }
}
