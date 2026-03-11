'use client';

import { usePathname } from 'next/navigation';

const MARKETING_PREFIXES: readonly string[] = ['/landing', '/terms', '/privacy'];

interface MarketingRouteResult {
  isMarketingRoute: boolean;
}

export function useMarketingRoute(): MarketingRouteResult {
  const pathname = usePathname() ?? '';

  const isMarketingRoute = MARKETING_PREFIXES.some((prefix) => {
    return pathname === prefix || pathname.startsWith(`${prefix}/`);
  });

  return {
    isMarketingRoute,
  };
}
