'use client';

import { useSyncExternalStore } from 'react';

const emptySubscribe = () => () => {};

/**
 * Hook to detect if component has mounted (client-side).
 * Uses useSyncExternalStore to avoid setState-in-effect pattern
 * while correctly handling SSR hydration.
 */
export function useHasMounted(): boolean {
  return useSyncExternalStore(emptySubscribe, () => true, () => false);
}
