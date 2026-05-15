'use client';

import { NewPayingTable } from './new-paying-table';
import { CancellationsTable } from './cancellations-table';
import { TopUsersTable } from './top-users-table';
import { TopProjectsTable } from './top-projects-table';
import { Card, CardContent } from '@/components/ui/card';
import type { TablesSnapshot } from '@/lib/admin/home/types';

interface DetailsGridProps {
  tables: TablesSnapshot;
}

export function DetailsGrid({ tables }: DetailsGridProps) {
  return (
    <section aria-label="Détails actionnables">
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
        Détails actionnables
      </h2>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Card className="bg-card">
          <CardContent className="p-4">
            <h3 className="mb-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              New paying users (30d)
            </h3>
            <NewPayingTable data={tables.newPaying} />
          </CardContent>
        </Card>
        <Card className="bg-card">
          <CardContent className="p-4">
            <h3 className="mb-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              Recent cancellations (30d)
            </h3>
            <CancellationsTable data={tables.cancellations} />
          </CardContent>
        </Card>
        <Card className="bg-card">
          <CardContent className="p-4">
            <h3 className="mb-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              Top users this month
            </h3>
            <TopUsersTable data={tables.topUsers} />
          </CardContent>
        </Card>
        <Card className="bg-card">
          <CardContent className="p-4">
            <h3 className="mb-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              Top projects this month
            </h3>
            <TopProjectsTable data={tables.topProjects} />
          </CardContent>
        </Card>
      </div>
    </section>
  );
}
