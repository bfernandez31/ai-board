import Link from 'next/link';
import { ExternalLink } from 'lucide-react';
import { PUBLIC_FOOTER_LINKS } from '@/lib/config/public-site';

export function Footer(): JSX.Element {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="border-t border-[hsl(var(--ctp-surface-0))] bg-[#1e1e2e]">
      <div className="mx-auto max-w-7xl px-4 py-6">
        <div className="flex flex-col items-center gap-4 md:flex-row md:justify-between">
          <p className="text-sm text-[hsl(var(--ctp-subtext-0))]">
            &copy; {currentYear} AI Board. All rights reserved.
          </p>
          <nav className="flex flex-wrap items-center justify-center gap-x-6 gap-y-3">
            {PUBLIC_FOOTER_LINKS.map((link) => (
              <Link
                key={link.label}
                href={link.href}
                className="inline-flex items-center gap-1.5 text-sm text-[hsl(var(--ctp-subtext-0))] transition-colors hover:text-[#8B5CF6]"
                target={link.external ? '_blank' : undefined}
                rel={link.external ? 'noreferrer noopener' : undefined}
              >
                <span>{link.label}</span>
                {link.external && (
                  <>
                    <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                    <span className="sr-only">(opens in a new tab)</span>
                  </>
                )}
              </Link>
            ))}
          </nav>
        </div>
      </div>
    </footer>
  );
}
