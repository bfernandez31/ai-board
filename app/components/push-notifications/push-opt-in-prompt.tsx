'use client';

import { useState } from 'react';
import { useSession } from 'next-auth/react';
import { Bell, X } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { usePushNotifications } from './use-push-notifications';
import { useHasMounted } from '@/lib/hooks/use-has-mounted';

const DISMISSED_KEY = 'push-notifications-dismissed';

export function PushOptInPrompt() {
  const { data: session, status } = useSession();
  const mounted = useHasMounted();
  const [isDismissed, setIsDismissed] = useState(() => {
    if (typeof window === 'undefined') return true;
    return localStorage.getItem(DISMISSED_KEY) === 'true';
  });
  const { isSupported, isEnabled, isLoading, permission, subscribe, error } = usePushNotifications();

  const handleDismiss = () => {
    localStorage.setItem(DISMISSED_KEY, 'true');
    setIsDismissed(true);
  };

  const handleEnable = async () => {
    try {
      await subscribe();
      setIsDismissed(true);
    } catch (err) {
      console.error('[Push] Subscribe error:', err);
    }
  };

  if (!mounted || status === 'loading') {
    return null;
  }

  if (!session || !isSupported || isDismissed || isEnabled || permission === 'denied') {
    return null;
  }

  return (
    <Card className="fixed bottom-4 right-4 w-80 shadow-lg z-50 border-accent aurora-bg-dialog">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Bell className="h-5 w-5 text-primary" />
            <CardTitle className="text-sm text-foreground">Enable Notifications</CardTitle>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={handleDismiss}
            aria-label="Dismiss"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
        <CardDescription className="text-xs text-muted-foreground">
          Get notified when jobs complete or you&apos;re mentioned in comments.
        </CardDescription>
      </CardHeader>
      <CardContent className="pb-4">
        {error && (
          <p className="text-xs text-ctp-red mb-2">{error}</p>
        )}
        <div className="flex gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={handleDismiss}
            disabled={isLoading}
          >
            Not now
          </Button>
          <Button
            size="sm"
            onClick={handleEnable}
            disabled={isLoading}
          >
            {isLoading ? 'Enabling...' : 'Enable'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
