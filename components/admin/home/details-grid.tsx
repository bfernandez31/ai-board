'use client';

import { NewPayingTable } from './new-paying-table';
import { CancellationsTable } from './cancellations-table';
import { TopUsersTable } from './top-users-table';
import { TopProjectsTable } from './top-projects-table';
import { SectionPanel } from './section-panel';
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
        <SectionPanel title="New paying users (30d)">
          <NewPayingTable data={tables.newPaying} />
        </SectionPanel>
        <SectionPanel title="Recent cancellations (30d)">
          <CancellationsTable data={tables.cancellations} />
        </SectionPanel>
        <SectionPanel title="Top users this month">
          <TopUsersTable data={tables.topUsers} />
        </SectionPanel>
        <SectionPanel title="Top projects this month">
          <TopProjectsTable data={tables.topProjects} />
        </SectionPanel>
      </div>
    </section>
  );
}
