'use client';

import { useSyncExternalStore } from 'react';

const QUERY = '(hover: hover)';

function subscribe(callback: () => void) {
  const mediaQuery = window.matchMedia(QUERY);
  mediaQuery.addEventListener('change', callback);
  return () => mediaQuery.removeEventListener('change', callback);
}

function getSnapshot() {
  return window.matchMedia(QUERY).matches;
}

function getServerSnapshot() {
  return false;
}

export function useHoverCapability(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
