'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { ConfusionMatrix } from '@/lib/calibration/types';

interface ConfusionMatrixTableProps {
  matrix: ConfusionMatrix;
}

function formatPercent(value: number, total: number): string {
  if (total === 0) return '0%';
  return `${Math.round((value / total) * 100)}%`;
}

function formatRate(rate: number | null): string {
  if (rate === null) return 'n/a';
  return `${(rate * 100).toFixed(1)}%`;
}

export function ConfusionMatrixTable({ matrix }: ConfusionMatrixTableProps) {
  const { truePositive, trueNegative, falsePositive, falseNegative, total } =
    matrix;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Friction confusion matrix</CardTitle>
        <p className="text-xs text-muted-foreground">
          Predicted &quot;low risk&quot; vs. actual &quot;friction-free&quot; outcomes.
        </p>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table
            role="table"
            className="w-full border-collapse text-sm"
            aria-label="Friction confusion matrix"
          >
            <thead>
              <tr>
                <td
                  aria-hidden="true"
                  className="border border-border bg-muted/50 p-2 text-left text-xs font-medium text-muted-foreground"
                >
                  Predicted ↓ / Actual →
                </td>
                <th
                  scope="col"
                  className="border border-border bg-muted/50 p-2 text-left text-xs font-medium text-muted-foreground"
                >
                  Actual: friction-free
                </th>
                <th
                  scope="col"
                  className="border border-border bg-muted/50 p-2 text-left text-xs font-medium text-muted-foreground"
                >
                  Actual: not friction-free
                </th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <th
                  scope="row"
                  className="border border-border bg-muted/30 p-2 text-left font-medium"
                >
                  Predicted: low risk
                </th>
                <td className="border border-border p-2">
                  <div className="font-semibold">TP {truePositive}</div>
                  <div className="text-xs text-muted-foreground">
                    {formatPercent(truePositive, total)}
                  </div>
                </td>
                <td className="border border-border p-2">
                  <div className="font-semibold">FP {falsePositive}</div>
                  <div className="text-xs text-muted-foreground">
                    {formatPercent(falsePositive, total)}
                  </div>
                </td>
              </tr>
              <tr>
                <th
                  scope="row"
                  className="border border-border bg-muted/30 p-2 text-left font-medium"
                >
                  Predicted: friction
                </th>
                <td className="border border-border p-2">
                  <div className="font-semibold">FN {falseNegative}</div>
                  <div className="text-xs text-muted-foreground">
                    {formatPercent(falseNegative, total)}
                  </div>
                </td>
                <td className="border border-border p-2">
                  <div className="font-semibold">TN {trueNegative}</div>
                  <div className="text-xs text-muted-foreground">
                    {formatPercent(trueNegative, total)}
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <dl className="mt-4 grid grid-cols-2 gap-4 text-sm">
          <div>
            <dt className="text-xs text-muted-foreground">
              Precision (low risk)
            </dt>
            <dd className="text-lg font-semibold">
              {formatRate(matrix.precisionLowRisk)}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">
              Recall (low risk)
            </dt>
            <dd className="text-lg font-semibold">
              {formatRate(matrix.recallLowRisk)}
            </dd>
          </div>
        </dl>
      </CardContent>
    </Card>
  );
}
