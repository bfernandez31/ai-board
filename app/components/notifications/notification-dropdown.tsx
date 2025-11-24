'use client';

// Notification dropdown content with list, navigation, and mark-as-read functionality

import { useRouter } from 'next/navigation';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { AlertCircle } from 'lucide-react';
import { useNotifications, useMarkNotificationRead, useMarkAllNotificationsRead } from './use-notifications';
import { formatNotificationTime } from '@/app/lib/utils/date-utils';

export function NotificationDropdown() {
  const router = useRouter();
  const { data, isLoading, error } = useNotifications();
  const markAsRead = useMarkNotificationRead();
  const markAllAsRead = useMarkAllNotificationsRead();

  const notifications = data?.notifications ?? [];

  const handleNotificationClick = (notification: typeof notifications[number]) => {
    // Mark as read (optimistic update)
    markAsRead.mutate(notification.id);

    // Navigate to ticket with comment anchor
    router.push(`/projects/${notification.projectId}/tickets/${notification.ticketKey}#comment-${notification.commentId}`);
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
