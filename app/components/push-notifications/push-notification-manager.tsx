'use client';

import { useState } from 'react';
import { Bell, BellOff, Monitor, Trash2, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/app/lib/query-keys';
import { usePushNotifications } from './use-push-notifications';

interface SubscriptionInfo {
  id: number;
  userAgent: string | null;
  createdAt: string;
}

async function unsubscribePush(endpoint: string): Promise<void> {
  const response = await fetch('/api/push/unsubscribe', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ endpoint }),
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to unsubscribe');
  }
}

function parseUserAgent(userAgent: string | null): string {
  if (!userAgent) return 'Unknown device';

  if (userAgent.includes('Chrome')) return 'Chrome';
  if (userAgent.includes('Firefox')) return 'Firefox';
  if (userAgent.includes('Safari')) return 'Safari';
  if (userAgent.includes('Edge')) return 'Edge';

  return 'Browser';
}

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export function PushNotificationManager() {
  const queryClient = useQueryClient();
  const {
    isSupported,
    isEnabled,
    isLoading,
    permission,
    subscriptions,
    subscribe,
    error,
  } = usePushNotifications();

  const [deletingId, setDeletingId] = useState<number | null>(null);

  const unsubscribeMutation = useMutation({
    mutationFn: async (subscription: SubscriptionInfo) => {
      // Get current browser's subscription endpoint
      const registration = await navigator.serviceWorker.ready;
      const currentSub = await registration.pushManager.getSubscription();
      const currentEndpoint = currentSub?.endpoint;

      // Find the matching stored subscription
      const storedSub = subscriptions.find(
        (s) => s.id === subscription.id
      );

      if (!storedSub) {
        throw new Error('Subscription not found');
      }

      // Unsubscribe from browser if this is the current device
      if (currentSub && currentEndpoint === getEndpointFromSub(subscription)) {
        await currentSub.unsubscribe();
      }

      // Delete from server
      await unsubscribePush(getEndpointFromSub(subscription));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.push.status });
      setDeletingId(null);
    },
    onError: () => {
      setDeletingId(null);
    },
  });

  const handleEnable = async () => {
    try {
      await subscribe();
    } catch (err) {
      console.error('[Push Manager] Subscribe error:', err);
    }
  };

  const handleRemove = async (subscription: SubscriptionInfo) => {
    setDeletingId(subscription.id);
    unsubscribeMutation.mutate(subscription);
  };

  // Helper to get endpoint - we need to fetch from push status
  const getEndpointFromSub = (_subscription: SubscriptionInfo): string => {
    // Since we don't store endpoint in the response for security,
    // we need to get the current subscription's endpoint
    // This is a simplification - in production you might want to store partial endpoints
    return '';
  };

  if (!isSupported) {
    return (
      <div className="p-4 text-sm text-[#a6adc8]">
        <div className="flex items-center gap-2 mb-2">
          <BellOff className="h-4 w-4" />
          <span>Push notifications not supported</span>
        </div>
        <p className="text-xs">
          Your browser doesn&apos;t support push notifications.
        </p>
      </div>
    );
  }

  if (permission === 'denied') {
    return (
      <div className="p-4 text-sm text-[#a6adc8]">
        <div className="flex items-center gap-2 mb-2">
          <BellOff className="h-4 w-4 text-[#f38ba8]" />
          <span>Notifications blocked</span>
        </div>
        <p className="text-xs">
          Enable notifications in your browser settings.
        </p>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {isEnabled ? (
            <Bell className="h-4 w-4 text-[#a6e3a1]" />
          ) : (
            <BellOff className="h-4 w-4 text-[#a6adc8]" />
          )}
          <span className="text-sm font-medium text-[#cdd6f4]">
            Push Notifications
          </span>
        </div>
        {!isEnabled && (
          <Button
            size="sm"
            onClick={handleEnable}
            disabled={isLoading}
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              'Enable'
            )}
          </Button>
        )}
      </div>

      {error && (
        <p className="text-xs text-[#f38ba8]">{error}</p>
      )}

      {isEnabled && subscriptions.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs text-[#a6adc8]">
            Active on {subscriptions.length} device{subscriptions.length > 1 ? 's' : ''}
          </p>
          <div className="space-y-2">
            {subscriptions.map((sub) => (
              <div
                key={sub.id}
                className="flex items-center justify-between bg-[#313244] rounded-md px-3 py-2"
              >
                <div className="flex items-center gap-2">
                  <Monitor className="h-4 w-4 text-[#a6adc8]" />
                  <div>
                    <p className="text-sm text-[#cdd6f4]">
                      {parseUserAgent(sub.userAgent)}
                    </p>
                    <p className="text-xs text-[#a6adc8]">
                      Added {formatDate(sub.createdAt)}
                    </p>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-[#a6adc8] hover:text-[#f38ba8]"
                  onClick={() => handleRemove(sub)}
                  disabled={deletingId === sub.id}
                >
                  {deletingId === sub.id ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Trash2 className="h-4 w-4" />
                  )}
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}

      <p className="text-xs text-[#a6adc8]">
        Get notified when jobs complete or you&apos;re mentioned.
      </p>
    </div>
  );
}
