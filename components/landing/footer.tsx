import Link from 'next/link';

export function Footer() {
  return (
    <footer className="border-t border-[hsl(var(--ctp-surface-0))] bg-[#1e1e2e]" data-testid="footer">
      <div className="container mx-auto px-4 py-6">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-sm text-[hsl(var(--ctp-subtext-0))]">
            &copy; {new Date().getFullYear()} AI Board. All rights reserved.
          </p>
          <div className="flex gap-6">
            <Link
              href="/terms-of-service"
              className="text-sm text-[hsl(var(--ctp-subtext-0))] hover:text-[hsl(var(--ctp-text))] transition-colors"
              data-testid="footer-terms-link"
            >
              Terms of Service
            </Link>
            <Link
              href="/privacy-policy"
              className="text-sm text-[hsl(var(--ctp-subtext-0))] hover:text-[hsl(var(--ctp-text))] transition-colors"
              data-testid="footer-privacy-link"
            >
              Privacy Policy
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
