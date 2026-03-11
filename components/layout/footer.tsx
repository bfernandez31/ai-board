import Link from 'next/link';

export function Footer() {
  return (
    <footer className="border-t border-[hsl(var(--ctp-surface-0))] py-6">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-center gap-x-6 gap-y-2 px-4 text-sm text-[hsl(var(--ctp-subtext-0))]">
        <span>&copy; {new Date().getFullYear()} AI Board</span>
        <Link href="/legal/terms" className="hover:text-white transition-colors">
          Terms of Service
        </Link>
        <Link href="/legal/privacy" className="hover:text-white transition-colors">
          Privacy Policy
        </Link>
      </div>
    </footer>
  );
}
