'use client';

import { useEffect, useState } from 'react';

/**
 * Custom React hook for detecting online/offline network status
 *
 * Uses the Navigator.onLine API and listens to window online/offline events
 * to provide real-time network status updates.
 *
 * @returns boolean - true if online, false if offline
 *
 * @example
 * ```tsx
 * function MyComponent() {
 *   const isOnline = useOnlineStatus();
 *
 *   if (!isOnline) {
 *     return <div>You are offline</div>;
 *   }
 *
 *   return <div>You are online</div>;
 * }
 * ```
 */
export function useOnlineStatus(): boolean {
  // Initialize with current online status (SSR-safe)
  const [isOnline, setIsOnline] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      return navigator.onLine;
    }
    return true; // Assume online during SSR
  });

  useEffect(() => {
    // Update state when online status changes
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    // Set initial state after mount
    setIsOnline(navigator.onLine);

    // Listen for online/offline events
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Cleanup event listeners on unmount
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return isOnline;
}
