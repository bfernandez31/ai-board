import Link from 'next/link';

const footerLinks = [
  { href: '/legal/terms', label: 'Terms of Service' },
  { href: '/legal/privacy', label: 'Privacy Policy' },
] as const;

export function Footer(): JSX.Element {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="border-t border-[hsl(var(--ctp-surface-0))] py-6">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-center gap-x-6 gap-y-2 px-4 text-sm text-[hsl(var(--ctp-subtext-0))]">
        <span>&copy; {currentYear} AI Board</span>
        {footerLinks.map(({ href, label }) => (
          <Link key={href} href={href} className="transition-colors hover:text-white">
            {label}
          </Link>
        ))}
      </div>
    </footer>
  );
}
