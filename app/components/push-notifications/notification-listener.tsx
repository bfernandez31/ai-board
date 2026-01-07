'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

interface NotificationMessage {
  type: 'NOTIFICATION_CLICK';
  url: string;
}

export function NotificationListener() {
  const router = useRouter();

  useEffect(() => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
      return;
    }

    const handleMessage = (event: MessageEvent<NotificationMessage>) => {
      if (event.data?.type === 'NOTIFICATION_CLICK' && event.data.url) {
        router.push(event.data.url);
      }
    };

    navigator.serviceWorker.addEventListener('message', handleMessage);

    return () => {
      navigator.serviceWorker.removeEventListener('message', handleMessage);
    };
  }, [router]);

  return null;
}
