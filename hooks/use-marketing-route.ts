'use client';

import { usePathname } from 'next/navigation';
import { useMemo } from 'react';

const MARKETING_PREFIXES = ['/landing', '/terms', '/privacy'];

export function useMarketingRoute() {
  const pathname = usePathname() ?? '';

  const isMarketingRoute = useMemo(() => {
    return MARKETING_PREFIXES.some((prefix) => {
      if (pathname === prefix) {
        return true;
      }

      return pathname.startsWith(`${prefix}/`);
    });
  }, [pathname]);

  return {
    isMarketingRoute,
  };
}
