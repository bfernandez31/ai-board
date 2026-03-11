import Link from 'next/link';
import { marketingContent } from '@/lib/marketing/pricing-content';

export function Footer() {
  return (
    <footer
      data-testid="marketing-footer"
      className="border-t border-[hsl(var(--ctp-surface-0))] bg-[#1e1e2e]"
    >
      <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-6 text-center text-sm text-[hsl(var(--ctp-subtext-0))] md:flex-row md:items-center md:justify-between md:text-left">
        <p>&copy; {new Date().getFullYear()} ai-board, Inc. All rights reserved.</p>
        <nav className="flex flex-wrap items-center justify-center gap-4 md:justify-end">
          {marketingContent.footerLinks.map((link) => {
            const newTabProps = link.opensInNewTab
              ? { target: '_blank', rel: 'noopener noreferrer' }
              : {};

            return (
              <Link
                key={link.id}
                href={link.href}
                aria-label={link.ariaLabel ?? link.label}
                className="text-sm text-[hsl(var(--ctp-subtext-0))] transition-colors hover:text-[#8B5CF6]"
                data-analytics-id={link.analyticsId}
                {...newTabProps}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </footer>
  );
}
