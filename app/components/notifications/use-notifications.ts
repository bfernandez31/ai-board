'use client';

// TanStack Query hooks for notification management

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

export interface NotificationDisplay {
  id: number;
  actorName: string;
  actorImage: string | null;
  ticketKey: string;
  commentPreview: string;
  createdAt: string;
  read: boolean;
  commentId: number;
  projectId: number;
}

export interface NotificationsResponse {
  notifications: NotificationDisplay[];
  unreadCount: number;
  hasMore: boolean;
}

async function fetchNotifications(): Promise<NotificationsResponse> {
  const response = await fetch('/api/notifications?limit=5');
  if (!response.ok) throw new Error('Failed to fetch notifications');
  return response.json();
}

/**
 * Hook to fetch and poll notifications
 * - Polls every 15s when there are unread notifications
 * - Polls every 30s when all notifications are read (for efficiency)
 * - Continues polling in background when tab is inactive
 */
export function useNotifications() {
  return useQuery({
    queryKey: ['notifications'],
    queryFn: fetchNotifications,
    refetchInterval: (query) => {
      const data = query.state.data;
      const hasUnread = data && data.unreadCount > 0;
      return hasUnread ? 15000 : 30000; // 15s with unread, 30s when all read
    },
    refetchIntervalInBackground: true,
    staleTime: 0, // Always fetch fresh data
  });
}

/**
 * Hook to mark a single notification as read
 * - Optimistic update: marks notification as read immediately in UI
 * - Automatic rollback on error
 * - Refetches after mutation completes to ensure sync
 */
export function useMarkNotificationRead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (notificationId: number) => {
      const response = await fetch(`/api/notifications/${notificationId}/mark-read`, {
        method: 'PATCH',
      });
      if (!response.ok) throw new Error('Failed to mark notification as read');
      return response.json();
    },
    onMutate: async (notificationId) => {
      // Cancel outgoing queries to avoid overwriting optimistic update
      await queryClient.cancelQueries({ queryKey: ['notifications'] });

      // Snapshot previous value for rollback
      const previousData = queryClient.getQueryData<NotificationsResponse>(['notifications']);

      // Optimistically update UI
      queryClient.setQueryData<NotificationsResponse>(['notifications'], (old) => {
        if (!old) return old;

        // Find if notification is currently unread
        const notification = old.notifications.find(n => n.id === notificationId);
        const wasUnread = notification && !notification.read;

        return {
          ...old,
          notifications: old.notifications.map(n =>
            n.id === notificationId ? { ...n, read: true } : n
          ),
          unreadCount: wasUnread ? Math.max(0, old.unreadCount - 1) : old.unreadCount,
        };
      });

      return { previousData }; // Context for rollback
    },
    onError: (_error, _variables, context) => {
      // Rollback on error
      if (context?.previousData) {
        queryClient.setQueryData(['notifications'], context.previousData);
      }
    },
    onSettled: () => {
      // Always refetch to ensure server sync
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });
}

/**
 * Hook to mark all notifications as read
 * - Optimistic update: marks all notifications as read immediately in UI
 * - Automatic rollback on error
 * - Refetches after mutation completes to ensure sync
 */
export function useMarkAllNotificationsRead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const response = await fetch('/api/notifications/mark-all-read', {
        method: 'POST',
      });
      if (!response.ok) throw new Error('Failed to mark all notifications as read');
      return response.json();
    },
    onMutate: async () => {
      // Cancel outgoing queries to avoid overwriting optimistic update
      await queryClient.cancelQueries({ queryKey: ['notifications'] });

      // Snapshot previous value for rollback
      const previousData = queryClient.getQueryData<NotificationsResponse>(['notifications']);

      // Optimistically update UI
      queryClient.setQueryData<NotificationsResponse>(['notifications'], (old) => {
        if (!old) return old;
        return {
          ...old,
          notifications: old.notifications.map(n => ({ ...n, read: true })),
          unreadCount: 0,
        };
      });

      return { previousData }; // Context for rollback
    },
    onError: (_error, _variables, context) => {
      // Rollback on error
      if (context?.previousData) {
        queryClient.setQueryData(['notifications'], context.previousData);
      }
    },
    onSettled: () => {
      // Always refetch to ensure server sync
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });
}
