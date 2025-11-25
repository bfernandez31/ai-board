'use client';

// Notification dropdown content with list, navigation, and mark-as-read functionality

import { useRouter, useParams } from 'next/navigation';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { AlertCircle } from 'lucide-react';
import { useNotifications, useMarkNotificationRead, useMarkAllNotificationsRead } from './use-notifications';
import { formatNotificationTime } from '@/app/lib/utils/date-utils';
import { createNavigationContext, parseProjectIdFromRoute } from '@/lib/utils/navigation-utils';
import type { NotificationWithNavData } from '@/lib/types/notification-navigation';

export function NotificationDropdown() {
  const router = useRouter();
  const params = useParams();
  const { data, isLoading, error } = useNotifications();
  const markAsRead = useMarkNotificationRead();
  const markAllAsRead = useMarkAllNotificationsRead();

  const notifications = data?.notifications ?? [];

  // Extract current project ID from route params
  // The projectId param comes from the route: /projects/[projectId]/...
  const currentProjectId = parseProjectIdFromRoute(params?.projectId as string | undefined);

  const handleNotificationClick = (notification: typeof notifications[number]) => {
    // Mark as read (optimistic update) before navigation
    markAsRead.mutate(notification.id);

    // If we're not on a project page, always open in new tab
    // Otherwise, use navigation context to determine strategy
    if (!currentProjectId) {
      // Not on a project page - always open in new tab
      const targetUrl = `/projects/${notification.projectId}/tickets/${notification.ticketKey}?modal=open&tab=comments#comment-${notification.commentId}`;
      window.open(targetUrl, '_blank', 'noopener,noreferrer');
      return;
    }

    // Create navigation context to determine same-project vs cross-project
    const notificationWithNavData: NotificationWithNavData = {
      id: notification.id,
      recipientId: '', // Not needed for navigation
      actorId: '', // Not needed for navigation
      commentId: notification.commentId,
      ticketId: 0, // Not needed for navigation
      read: notification.read,
      readAt: null,
      createdAt: new Date(notification.createdAt),
      deletedAt: null,
      projectId: notification.projectId,
      ticketKey: notification.ticketKey,
      actorName: notification.actorName,
      actorImage: notification.actorImage,
      commentPreview: notification.commentPreview,
    };

    try {
      const context = createNavigationContext(notificationWithNavData, currentProjectId);

      if (context.shouldOpenNewTab) {
        // Cross-project navigation - open in new tab
        window.open(context.targetUrl, '_blank', 'noopener,noreferrer');
      } else {
        // Same-project navigation - use router.push
        router.push(context.targetUrl);
      }
    } catch (error) {
      // Fallback: navigate to ticket without special handling
      console.error('Navigation error:', error);
      router.push(`/projects/${notification.projectId}/tickets/${notification.ticketKey}#comment-${notification.commentId}`);
    }
  };

  return (
    <div className="flex flex-col" data-testid="notification-dropdown">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b">
        <h3 className="font-semibold">Notifications</h3>
        {data && data.unreadCount > 0 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => markAllAsRead.mutate()}
            disabled={markAllAsRead.isPending}
          >
            Mark all as read
          </Button>
        )}
      </div>

      {/* Content */}
      <div className="max-h-[400px]">
        <ScrollArea className="h-full">
          {error ? (
            <div className="p-4 flex flex-col items-center gap-2 text-center">
              <AlertCircle className="h-8 w-8 text-destructive" />
              <div className="text-sm font-medium">Failed to load notifications</div>
              <div className="text-xs text-muted-foreground">
                {error instanceof Error ? error.message : 'Please try again later'}
              </div>
            </div>
          ) : isLoading ? (
            <div className="p-4 text-sm text-muted-foreground">Loading...</div>
          ) : notifications.length === 0 ? (
            <div className="p-4 text-sm text-muted-foreground">No notifications</div>
          ) : (
            <div className="divide-y">
              {notifications.map(notification => (
                <div
                  key={notification.id}
                  className={`p-4 cursor-pointer hover:bg-accent transition-colors ${
                    !notification.read ? 'bg-blue-50 dark:bg-blue-950' : ''
                  }`}
                  onClick={() => handleNotificationClick(notification)}
                  data-testid="notification-item"
                >
                  <div className="flex gap-3">
                    <Avatar className="h-10 w-10">
                      <AvatarImage src={notification.actorImage || undefined} />
                      <AvatarFallback>{notification.actorName[0]}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm">
                        <span className="font-medium">{notification.actorName}</span>
                        {' mentioned you in '}
                        <span className="font-medium">{notification.ticketKey}</span>
                      </div>
                      <div className="text-sm text-muted-foreground line-clamp-2 mt-1">
                        {notification.commentPreview}
                      </div>
                      <div className="text-xs text-muted-foreground mt-1">
                        {formatNotificationTime(notification.createdAt)}
                      </div>
                    </div>
                    {!notification.read && (
                      <div className="flex-shrink-0">
                        <div className="h-2 w-2 bg-blue-500 rounded-full" data-testid="unread-indicator" />
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </div>

      {/* Footer */}
      {data && data.hasMore && (
        <div className="p-2 border-t">
          <Button variant="ghost" size="sm" className="w-full">
            View all
          </Button>
        </div>
      )}
    </div>
  );
}
