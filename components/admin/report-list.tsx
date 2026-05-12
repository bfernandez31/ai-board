'use client'

import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { InsightsReport } from '@/lib/types/insights'
import { cn } from '@/lib/utils'

interface ReportListProps {
  reports: InsightsReport[]
  selectedReportId: string | null
  onSelectReport: (reportId: string) => void
}

export default function ReportList({ reports, selectedReportId, onSelectReport }: ReportListProps) {
  if (reports.length === 0) {
    return (
      <Card>
        <CardContent className="text-center py-8">
          <p className="text-muted-foreground">No reports available</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Past Reports</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {reports.map((report) => {
            const isSelected = selectedReportId === report.id
            return (
              <Button
                key={report.id}
                type="button"
                variant="ghost"
                onClick={() => onSelectReport(report.id)}
                aria-pressed={isSelected}
                className={cn(
                  'h-auto w-full justify-between p-3 text-left',
                  isSelected && 'bg-accent text-accent-foreground'
                )}
              >
                <div className="flex w-full items-center justify-between gap-3">
                  <div className="flex flex-col items-start">
                    <span className="font-medium">{report.analysisType}</span>
                    <span className="text-sm text-muted-foreground">
                      {new Date(report.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                  <Badge variant={report.status === 'COMPLETED' ? 'default' : 'secondary'}>
                    {report.status}
                  </Badge>
                </div>
              </Button>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}
