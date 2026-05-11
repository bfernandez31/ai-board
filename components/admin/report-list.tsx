import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { InsightsReport } from '@/lib/types/insights'

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
          <p className="text-gray-500">No reports available</p>
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
          {reports.map((report) => (
            <div
              key={report.id}
              onClick={() => onSelectReport(report.id)}
              className={`p-3 rounded cursor-pointer hover:bg-accent ${
                selectedReportId === report.id ? 'bg-accent' : ''
              }`}
            >
              <div className="flex justify-between items-center">
                <div>
                  <p className="font-medium">{report.analysisType}</p>
                  <p className="text-sm text-gray-500">
                    {new Date(report.createdAt).toLocaleDateString()}
                  </p>
                </div>
                <Badge variant={report.status === 'COMPLETED' ? 'default' : 'secondary'}>
                  {report.status}
                </Badge>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
