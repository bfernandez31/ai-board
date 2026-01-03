'use client';

// Notification dropdown content with list, navigation, and mark-as-read functionality

import { useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { AlertCircle, Loader2 } from 'lucide-react';
import { useNotifications, useMarkNotificationRead, useMarkAllNotificationsRead } from './use-notifications';
import { formatNotificationTime } from '@/app/lib/utils/date-utils';
import { createNavigationContext, parseProjectIdFromRoute } from '@/lib/utils/navigation-utils';
import type { NotificationWithNavData } from '@/lib/types/notification-navigation';
import { useToast } from '@/hooks/use-toast';

export function NotificationDropdown() {
  const router = useRouter();
  const params = useParams();
  const { data, isLoading, error } = useNotifications();
  const markAsRead = useMarkNotificationRead();
  const markAllAsRead = useMarkAllNotificationsRead();
  const { toast } = useToast();

  const notifications = data?.notifications ?? [];

  // Track which notification is being navigated to (for loading state)
  const [navigatingNotificationId, setNavigatingNotificationId] = useState<number | null>(null);

  // Extract current project ID from route params
  // The projectId param comes from the route: /projects/[projectId]/...
  const currentProjectId = parseProjectIdFromRoute(params?.projectId as string | undefined);

  const handleNotificationClick = (notification: typeof notifications[number]) => {
    // Prevent rapid clicks on the same notification (race condition prevention)
    if (navigatingNotificationId === notification.id) {
      return;
    }

    // Set loading state for visual feedback
    setNavigatingNotificationId(notification.id);

    // Mark as read (optimistic update) before navigation
    markAsRead.mutate(notification.id);

    // If we're not on a project page, always open in new tab
    // Otherwise, use navigation context to determine strategy
    if (!currentProjectId) {
      // Not on a project page - always open in new tab
      const targetUrl = `/projects/${notification.projectId}/board?ticket=${notification.ticketKey}&modal=open&tab=comments#comment-${notification.commentId}`;
      window.open(targetUrl, '_blank', 'noopener,noreferrer');
      // Reset loading state after opening new tab
      setTimeout(() => setNavigatingNotificationId(null), 500);
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
        // Reset loading state after opening new tab
        setTimeout(() => setNavigatingNotificationId(null), 500);
      } else {
        // Same-project navigation - use router.push
        router.push(context.targetUrl);
        // Reset loading state after navigation (longer timeout for same-window navigation)
        setTimeout(() => setNavigatingNotificationId(null), 1000);
      }
    } catch (error) {
      // Error handling for navigation failures
      console.error('Navigation error:', error);

      // Show error toast to user
      toast({
        title: 'Navigation failed',
        description: error instanceof Error ? error.message : 'Failed to navigate to notification',
        variant: 'destructive',
      });

      // Reset loading state
      setNavigatingNotificationId(null);

      // Fallback: try to navigate to ticket without special handling
      try {
        router.push(`/projects/${notification.projectId}/board?ticket=${notification.ticketKey}&modal=open&tab=comments#comment-${notification.commentId}`);
      } catch (fallbackError) {
        console.error('Fallback navigation error:', fallbackError);
      }
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
      <div className="max-h-[50vh] min-h-[200px] sm:max-h-[400px]">
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
              {notifications.map(notification => {
                const isNavigating = navigatingNotificationId === notification.id;
                return (
                  <div
                    key={notification.id}
                    className={`p-4 transition-colors ${
                      isNavigating
                        ? 'cursor-not-allowed opacity-60 pointer-events-none'
                        : 'cursor-pointer hover:bg-accent'
                    } ${
                      !notification.read ? 'bg-blue-50 dark:bg-blue-950' : ''
                    }`}
                    onClick={() => handleNotificationClick(notification)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        handleNotificationClick(notification);
                      }
                    }}
                    role="button"
                    tabIndex={0}
                    data-testid="notification-item"
                    aria-disabled={isNavigating}
                    aria-label={`Notification from ${notification.actorName} in ${notification.ticketKey}. ${notification.read ? 'Read' : 'Unread'}. ${notification.commentPreview}`}
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
                      <div className="flex-shrink-0 flex items-center gap-2">
                        {isNavigating && (
                          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                        )}
                        {!notification.read && !isNavigating && (
                          <div className="h-2 w-2 bg-blue-500 rounded-full" data-testid="unread-indicator" />
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
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
