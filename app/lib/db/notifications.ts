// Database query functions for notifications
//
// RETENTION POLICY: Notifications follow a 30-day soft delete retention policy.
// - Active notifications have deletedAt = null
// - Notifications older than 30 days should be soft-deleted via cleanup job
// - See softDeleteOldNotifications() function for cleanup implementation
// - Future: Schedule daily/weekly cron job to run cleanup

import { prisma } from '@/lib/db/client';

/**
 * Create a notification for a mention
 */
export async function createNotificationForMention(params: {
  recipientId: string;
  actorId: string;
  commentId: number;
  ticketId: number;
}) {
  return prisma.notification.create({
    data: params,
  });
}

/**
 * Get notifications for a user with full relations
 */
export async function getNotificationsForUser(userId: string, limit = 5) {
  return prisma.notification.findMany({
    where: {
      recipientId: userId,
      deletedAt: null,
    },
    include: {
      actor: {
        select: {
          id: true,
          name: true,
          email: true,
          image: true,
        },
      },
      comment: {
        select: {
          id: true,
          content: true,
          createdAt: true,
        },
      },
      ticket: {
        select: {
          id: true,
          ticketKey: true,
          title: true,
          projectId: true,
        },
      },
    },
    orderBy: {
      createdAt: 'desc',
    },
    take: limit,
  });
}

/**
 * Count unread notifications for a user
 */
export async function getUnreadCount(userId: string): Promise<number> {
  return prisma.notification.count({
    where: {
      recipientId: userId,
      read: false,
      deletedAt: null,
    },
  });
}

/**
 * Mark a single notification as read
 */
export async function markNotificationAsRead(notificationId: number, userId: string) {
  return prisma.notification.update({
    where: {
      id: notificationId,
      recipientId: userId, // Ensure user owns notification
    },
    data: {
      read: true,
      readAt: new Date(),
    },
  });
}

/**
 * Mark all unread notifications as read for a user (bulk operation)
 */
export async function markAllNotificationsAsRead(userId: string) {
  return prisma.notification.updateMany({
    where: {
      recipientId: userId,
      read: false,
      deletedAt: null,
    },
    data: {
      read: true,
      readAt: new Date(),
    },
  });
}

/**
 * Soft delete old notifications (30-day retention policy)
 * This would typically be called by a cleanup job
 */
export async function softDeleteOldNotifications() {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  return prisma.notification.updateMany({
    where: {
      createdAt: {
        lt: thirtyDaysAgo,
      },
      deletedAt: null,
    },
    data: {
      deletedAt: new Date(),
    },
  });
}
