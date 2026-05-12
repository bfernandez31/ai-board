'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { isAdminItemActive } from '@/lib/admin/active-path';
import {
  ADMIN_SIDEBAR_ITEMS,
  type AdminSidebarEntry,
} from '@/components/admin/admin-sidebar-items';

interface AdminShellProps {
  children: React.ReactNode;
}

function isDivider(entry: AdminSidebarEntry): entry is { id: string; kind: 'divider' } {
  return 'kind' in entry && entry.kind === 'divider';
}

export function AdminShell({ children }: AdminShellProps) {
  const pathname = usePathname() ?? '/admin';

  return (
    <div className="flex flex-col md:flex-row min-h-[calc(100vh-4rem)]">
      <aside
        aria-label="Espace admin"
        className="w-full md:w-56 shrink-0 border-b md:border-b-0 md:border-r border-border bg-card/40 p-4"
      >
        <header className="px-2 pb-3 text-xs uppercase tracking-wide text-muted-foreground">
          Espace admin
        </header>
        <nav className="flex flex-col gap-1" aria-label="Admin sections">
          {ADMIN_SIDEBAR_ITEMS.map((entry) => {
            if (isDivider(entry)) {
              return <hr key={entry.id} className="my-2 border-border" />;
            }
            const Icon = entry.icon;
            const active = isAdminItemActive(pathname, entry.href);
            const baseClasses =
              'flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors';
            const stateClasses = active
              ? 'bg-accent/30 border-l-2 border-primary text-foreground'
              : 'text-foreground hover:bg-accent';
            return (
              <Link
                key={entry.id}
                href={entry.href}
                aria-current={active ? 'page' : undefined}
                data-active={active ? 'true' : undefined}
                className={`${baseClasses} ${stateClasses}`}
              >
                <Icon className="h-4 w-4" />
                {entry.label}
              </Link>
            );
          })}
        </nav>
        <hr className="my-3 border-border" />
        <Link
          href="/"
          className="flex items-center gap-2 rounded-md px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Retour à l&apos;app
        </Link>
      </aside>
      <main className="flex-1 p-6">{children}</main>
    </div>
  );
}
