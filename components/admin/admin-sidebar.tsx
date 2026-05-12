'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ArrowLeft, BarChart3, Home, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

type AdminNavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  // 'prefix' is active on `href` and any `href/*` sub-path; 'exact' only on `href`.
  match: 'exact' | 'prefix';
};

const ADMIN_NAV_ITEMS: readonly AdminNavItem[] = [
  { href: '/admin', label: 'Accueil', icon: Home, match: 'exact' },
  { href: '/admin/insights', label: 'Insights LLM', icon: BarChart3, match: 'prefix' },
];

function isItemActive(pathname: string | null, item: AdminNavItem): boolean {
  if (!pathname) return false;
  if (item.match === 'exact') return pathname === item.href;
  return pathname === item.href || pathname.startsWith(`${item.href}/`);
}

// Admin shell sidebar (AIB-799). Allowlist enforcement happens in
// `app/admin/layout.tsx`; this component is rendered only after the guard.
export function AdminSidebar() {
  const pathname = usePathname();

  return (
    <aside
      aria-label="Admin navigation"
      className="w-60 shrink-0 border-r border-border bg-card/40"
    >
      <div className="flex h-full flex-col">
        <div className="px-4 pt-5 pb-3">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Espace admin
          </p>
        </div>

        <nav className="flex-1 px-2" aria-label="Admin sections">
          <ul className="flex flex-col gap-1">
            {ADMIN_NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              const active = isItemActive(pathname, item);
              return (
                <li key={item.href} className="relative">
                  {active && (
                    <span
                      aria-hidden
                      className="absolute left-0 top-1.5 bottom-1.5 w-0.5 rounded-r bg-primary"
                    />
                  )}
                  <Link
                    href={item.href}
                    aria-current={active ? 'page' : undefined}
                    className={cn(
                      'flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                      active
                        ? 'bg-accent/60 text-accent-foreground'
                        : 'text-foreground hover:bg-accent hover:text-accent-foreground'
                    )}
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    <span className="truncate">{item.label}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="mt-2 px-2">
          <div className="border-t border-border" />
          <Link
            href="/"
            className="mt-3 mb-4 flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
            data-testid="admin-sidebar-back-to-app"
          >
            <ArrowLeft className="h-4 w-4 shrink-0" />
            <span>Retour à l&apos;app</span>
          </Link>
        </div>
      </div>
    </aside>
  );
}
