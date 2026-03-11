import Link from 'next/link';
import { Github } from 'lucide-react';

const legalLinkClass =
  'text-sm text-[hsl(var(--ctp-subtext-0))] hover:text-[#8B5CF6] transition-colors';
const iconLinkClass =
  'text-[hsl(var(--ctp-subtext-0))] hover:text-[#8B5CF6] transition-colors';

export function Footer(): JSX.Element {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="border-t border-[hsl(var(--ctp-surface-0))] bg-[#1e1e2e]">
      <div className="mx-auto max-w-7xl px-4 py-6">
        <div className="flex flex-col items-center gap-4 md:flex-row md:justify-between">
          <p className="text-sm text-[hsl(var(--ctp-subtext-0))]">
            &copy; {currentYear} AI Board. All rights reserved.
          </p>
          <nav className="flex items-center gap-6">
            <Link href="/legal/terms" className={legalLinkClass}>
              Terms of Service
            </Link>
            <Link href="/legal/privacy" className={legalLinkClass}>
              Privacy Policy
            </Link>
            <a
              href="https://github.com/bfernandez31/ai-board"
              target="_blank"
              rel="noopener noreferrer"
              className={iconLinkClass}
              aria-label="GitHub"
            >
              <Github className="h-4 w-4" />
            </a>
          </nav>
        </div>
      </div>
    </footer>
  );
}
