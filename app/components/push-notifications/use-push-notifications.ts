'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/app/lib/query-keys';
import { useCallback, useState, useEffect } from 'react';

interface PushSubscriptionInfo {
  id: number;
  userAgent: string | null;
  createdAt: string;
}

interface PushStatusResponse {
  enabled: boolean;
  subscriptionCount: number;
  subscriptions: PushSubscriptionInfo[];
}

async function fetchPushStatus(): Promise<PushStatusResponse> {
  const response = await fetch('/api/push/status');
  if (!response.ok) {
    throw new Error('Failed to fetch push status');
  }
  return response.json();
}

async function subscribePush(subscription: PushSubscriptionJSON): Promise<void> {
  const response = await fetch('/api/push/subscribe', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(subscription),
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to subscribe');
  }
}

export function usePushStatus() {
  return useQuery({
    queryKey: queryKeys.push.status,
    queryFn: fetchPushStatus,
    staleTime: 60000, // 1 minute
  });
}

export function usePushSubscribe() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: subscribePush,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.push.status });
    },
  });
}

export function usePushNotifications() {
  const [isSupported, setIsSupported] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission>('default');
  const [registration, setRegistration] = useState<ServiceWorkerRegistration | null>(null);

  const { data: status, isLoading: isStatusLoading } = usePushStatus();
  const subscribeMutation = usePushSubscribe();

  useEffect(() => {
    const checkSupport = async () => {
      const supported =
        typeof window !== 'undefined' &&
        'serviceWorker' in navigator &&
        'PushManager' in window &&
        'Notification' in window;

      setIsSupported(supported);

      if (supported) {
        setPermission(Notification.permission);

        try {
          const reg = await navigator.serviceWorker.register('/sw.js');
          setRegistration(reg);
        } catch (err) {
          console.error('[Push] Service worker registration failed:', err);
        }
      }
    };

    checkSupport();
  }, []);

  const subscribe = useCallback(async () => {
    if (!registration || !isSupported) {
      throw new Error('Push notifications not supported');
    }

    const permissionResult = await Notification.requestPermission();
    setPermission(permissionResult);

    if (permissionResult !== 'granted') {
      throw new Error('Permission denied');
    }

    const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
    if (!vapidKey) {
      throw new Error('VAPID key not configured');
    }

    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapidKey),
    });

    const subscriptionJSON = subscription.toJSON();
    if (!subscriptionJSON.endpoint || !subscriptionJSON.keys) {
      throw new Error('Invalid subscription');
    }

    await subscribeMutation.mutateAsync(subscriptionJSON);
  }, [registration, isSupported, subscribeMutation]);

  return {
    isSupported,
    isEnabled: status?.enabled ?? false,
    isLoading: isStatusLoading || subscribeMutation.isPending,
    permission,
    subscriptionCount: status?.subscriptionCount ?? 0,
    subscriptions: status?.subscriptions ?? [],
    subscribe,
    error: subscribeMutation.error?.message,
  };
}

function urlBase64ToUint8Array(base64String: string): Uint8Array<ArrayBuffer> {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const buffer = new ArrayBuffer(rawData.length);
  const outputArray = new Uint8Array(buffer);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}
