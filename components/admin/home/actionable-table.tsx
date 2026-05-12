'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

export interface ActionableColumn<TRow> {
  key: string;
  header: string;
  render: (row: TRow) => React.ReactNode;
  className?: string;
}

interface ActionableTableProps<TRow> {
  title: string;
  rows: TRow[];
  columns: ActionableColumn<TRow>[];
  rowKey: (row: TRow) => string | number;
  total?: number;
  emptyMessage: string;
}

export function ActionableTable<TRow>({
  title,
  rows,
  columns,
  rowKey,
  total,
  emptyMessage,
}: ActionableTableProps<TRow>) {
  return (
    <Card className="aurora-bg-subtle">
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle className="text-base text-foreground">{title}</CardTitle>
        {typeof total === 'number' && total > rows.length && (
          <Badge variant="secondary">{`${total} au total`}</Badge>
        )}
      </CardHeader>
      <CardContent>
        {rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">{emptyMessage}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs text-muted-foreground">
                  {columns.map((col) => (
                    <th key={col.key} className={cn('py-2 pr-3', col.className)}>
                      {col.header}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={rowKey(row)} className="border-b last:border-b-0">
                    {columns.map((col) => (
                      <td key={col.key} className={cn('py-2 pr-3 text-foreground', col.className)}>
                        {col.render(row)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
