import { notFound } from 'next/navigation';
import Link from 'next/link';
import { getCurrentAdminOrNull } from '@/lib/auth/admin';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Admin | AI Board',
};

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}): Promise<JSX.Element> {
  const admin = await getCurrentAdminOrNull();
  if (!admin) {
    notFound();
  }

  return (
    <div className="flex min-h-[calc(100vh-4rem)]">
      <aside
        className="hidden w-56 shrink-0 border-r border-border/60 bg-card/40 md:flex md:flex-col"
        aria-label="Admin navigation"
      >
        <div className="px-4 pt-6 pb-3">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Admin
          </p>
        </div>
        <nav className="px-2">
          <Link
            href="/admin/insights"
            className="block rounded-md px-3 py-2 text-sm font-medium text-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            Insights
          </Link>
        </nav>
      </aside>
      <main className="flex-1 px-4 py-8 md:px-8">{children}</main>
    </div>
  );
}
