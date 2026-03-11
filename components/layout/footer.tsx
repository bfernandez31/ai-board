import Link from 'next/link';
import type { JSX } from 'react';

const navLinkClassName =
  'text-sm text-[hsl(var(--ctp-subtext-0))] transition-colors hover:text-[#8B5CF6]';

export function Footer(): JSX.Element {
  return (
    <footer className="border-t border-[hsl(var(--ctp-surface-0))] bg-[#1e1e2e]">
      <div className="mx-auto max-w-7xl px-4 py-6">
        <div className="flex flex-col items-center gap-4 md:flex-row md:justify-between">
          <p className="text-sm text-[hsl(var(--ctp-subtext-0))]">
            &copy; {new Date().getFullYear()} AI Board. All rights reserved.
          </p>
          <nav className="flex flex-wrap items-center justify-center gap-4 md:justify-end md:gap-6">
            <Link href="/legal/terms" className={navLinkClassName}>
              Terms of Service
            </Link>
            <Link href="/legal/privacy" className={navLinkClassName}>
              Privacy Policy
            </Link>
            <a
              href="https://github.com/ai-board/ai-board"
              target="_blank"
              rel="noopener noreferrer"
              className={navLinkClassName}
            >
              GitHub
            </a>
          </nav>
        </div>
      </div>
    </footer>
  );
}
