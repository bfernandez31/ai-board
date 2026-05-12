'use client';

import { Card, CardContent } from '@/components/ui/card';

interface EmptyStateProps {
  title?: string;
  message: string;
}

export function EmptyState({ title, message }: EmptyStateProps) {
  return (
    <Card>
      <CardContent className="flex min-h-[140px] flex-col items-center justify-center gap-1 p-6 text-center">
        {title && <p className="text-sm font-medium text-foreground">{title}</p>}
        <p className="text-sm text-muted-foreground">{message}</p>
      </CardContent>
    </Card>
  );
}
