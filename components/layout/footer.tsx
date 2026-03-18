'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

/** Routes where the footer is hidden (full-height layouts like the board). */
const HIDDEN_ROUTES = /^\/projects\/[^/]+\/board/;

export function Footer() {
  const pathname = usePathname();

  if (pathname && HIDDEN_ROUTES.test(pathname)) {
    return null;
  }

  return (
    <footer className="border-t border-border bg-background">
      <div className="mx-auto max-w-7xl px-4 py-6">
        <div className="flex flex-col items-center gap-4 md:flex-row md:justify-between">
          <p className="text-sm text-muted-foreground">
            &copy; {new Date().getFullYear()} AI Board. All rights reserved.
          </p>
          <nav className="flex gap-6">
            <Link
              href="/legal/terms"
              className="text-sm text-muted-foreground hover:text-primary transition-colors"
            >
              Terms of Service
            </Link>
            <Link
              href="/legal/privacy"
              className="text-sm text-muted-foreground hover:text-primary transition-colors"
            >
              Privacy Policy
            </Link>
          </nav>
        </div>
      </div>
    </footer>
  );
}
