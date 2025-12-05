'use client';

import { useOnlineStatus } from '@/hooks/use-online-status';
import { WifiOff } from 'lucide-react';

/**
 * OfflineIndicator Component
 *
 * Displays a banner when the user is offline
 * Uses the useOnlineStatus hook to detect network status
 */
export const OfflineIndicator = () => {
  const isOnline = useOnlineStatus();

  if (isOnline) {
    return null;
  }

  return (
    <div
      data-testid="offline-indicator"
      className="fixed top-0 left-0 right-0 z-50 bg-yellow-600 text-yellow-50 px-4 py-3 shadow-lg"
      role="alert"
      aria-live="polite"
    >
      <div className="container mx-auto flex items-center justify-center gap-3">
        <WifiOff className="w-5 h-5" />
        <span className="font-medium">
          You are offline. Drag-and-drop is disabled.
        </span>
      </div>
    </div>
  );
};
