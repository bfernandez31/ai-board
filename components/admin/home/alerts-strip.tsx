'use client';

import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AlertTriangle } from 'lucide-react';
import type { AlertCard } from '@/app/lib/admin/home/types';
import { formatPercent } from '@/app/lib/admin/home/formatters';

interface AlertsStripProps {
  alerts: AlertCard[];
}

function formatAlertMessage(alert: AlertCard): string {
  switch (alert.payload.kind) {
    case 'job-success':
      return `Taux de succès des jobs (7j) à ${formatPercent(
        alert.payload.successRatePct
      )} — ${alert.payload.failedCount} jobs échoués/annulés.`;
    case 'stripe-webhook':
      return `${alert.payload.transitionsInWindow} transition(s) d'abonnement payant en ${alert.payload.windowHours}h sans événement Stripe correspondant.`;
    case 'cron': {
      const wf = alert.payload.workflowName;
      const hours = alert.payload.hoursSinceLastSuccess;
      if (hours === null) {
        return `Cron critique « ${wf} » n'a jamais signalé de succès.`;
      }
      return `Cron critique « ${wf} » sans succès depuis ${hours}h.`;
    }
  }
}

function isExternalHref(href: string): boolean {
  return /^https?:\/\//.test(href);
}

export function AlertsStrip({ alerts }: AlertsStripProps) {
  if (alerts.length === 0) return null;

  return (
    <Card
      className="border-destructive/40 bg-destructive/5"
      role="region"
      aria-label="Alertes plateforme"
    >
      <CardContent className="space-y-2 p-4">
        {alerts.map((alert) => {
          const external = isExternalHref(alert.actionHref);
          return (
            <div
              key={alert.id}
              className="flex items-start justify-between gap-4"
              data-alert-kind={alert.kind}
            >
              <div className="flex items-start gap-2">
                <AlertTriangle className="mt-0.5 h-4 w-4 text-destructive" aria-hidden="true" />
                <p className="text-sm text-foreground">{formatAlertMessage(alert)}</p>
              </div>
              <Button asChild variant="outline" size="sm">
                {external ? (
                  <a href={alert.actionHref} target="_blank" rel="noreferrer noopener">
                    {alert.actionLabel}
                  </a>
                ) : (
                  <a href={alert.actionHref}>{alert.actionLabel}</a>
                )}
              </Button>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
