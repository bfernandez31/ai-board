import Link from 'next/link';
import { Github } from 'lucide-react';

export function Footer() {
  return (
    <footer className="border-t border-[hsl(var(--ctp-surface-0))] bg-[#1e1e2e]">
      <div className="mx-auto max-w-7xl px-4 py-6">
        <div className="flex flex-col items-center gap-4 md:flex-row md:justify-between">
          <p className="text-sm text-[hsl(var(--ctp-subtext-0))]">
            &copy; {new Date().getFullYear()} AI Board. All rights reserved.
          </p>
          <nav className="flex items-center gap-6">
            <Link
              href="/legal/terms"
              className="text-sm text-[hsl(var(--ctp-subtext-0))] hover:text-[#8B5CF6] transition-colors"
            >
              Terms of Service
            </Link>
            <Link
              href="/legal/privacy"
              className="text-sm text-[hsl(var(--ctp-subtext-0))] hover:text-[#8B5CF6] transition-colors"
            >
              Privacy Policy
            </Link>
            <a
              href="https://github.com/bfernandez31/ai-board"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[hsl(var(--ctp-subtext-0))] hover:text-[#8B5CF6] transition-colors"
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
