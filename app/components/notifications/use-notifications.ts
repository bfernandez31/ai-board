'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';

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

export function useNotifications() {
  return useQuery({
    queryKey: ['notifications'],
    queryFn: fetchNotifications,
    refetchInterval: (query) => {
      const data = query.state.data;
      return data && data.unreadCount > 0 ? 15000 : 30000;
    },
    refetchIntervalInBackground: true,
    staleTime: 0,
  });
}

export function useMarkNotificationRead() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (notificationId: number) => {
      const response = await fetch(`/api/notifications/${notificationId}/mark-read`, {
        method: 'PATCH',
      });
      if (!response.ok) throw new Error('Failed to mark notification as read');
      return response.json();
    },
    onMutate: async (notificationId) => {
      await queryClient.cancelQueries({ queryKey: ['notifications'] });
      const previousData = queryClient.getQueryData<NotificationsResponse>(['notifications']);

      queryClient.setQueryData<NotificationsResponse>(['notifications'], (old) => {
        if (!old) return old;

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

      return { previousData };
    },
    onError: (error, _variables, context) => {
      if (context?.previousData) {
        queryClient.setQueryData(['notifications'], context.previousData);
      }
      toast({
        title: 'Failed to mark notification as read',
        description: error instanceof Error ? error.message : 'Please try again later',
        variant: 'destructive',
      });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });
}

export function useMarkAllNotificationsRead() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async () => {
      const response = await fetch('/api/notifications/mark-all-read', {
        method: 'POST',
      });
      if (!response.ok) throw new Error('Failed to mark all notifications as read');
      return response.json();
    },
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: ['notifications'] });
      const previousData = queryClient.getQueryData<NotificationsResponse>(['notifications']);

      queryClient.setQueryData<NotificationsResponse>(['notifications'], (old) => {
        if (!old) return old;
        return {
          ...old,
          notifications: old.notifications.map(n => ({ ...n, read: true })),
          unreadCount: 0,
        };
      });

      return { previousData };
    },
    onError: (error, _variables, context) => {
      if (context?.previousData) {
        queryClient.setQueryData(['notifications'], context.previousData);
      }
      toast({
        title: 'Failed to mark all notifications as read',
        description: error instanceof Error ? error.message : 'Please try again later',
        variant: 'destructive',
      });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });
}
