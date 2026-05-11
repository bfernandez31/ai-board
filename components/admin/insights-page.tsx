import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { InsightsReport } from '@/lib/types/insights'
import AccessDenied from './access-denied'

interface InsightsPageProps {
  loading: boolean
  report: InsightsReport | null
  error: string | null
  hasAccess?: boolean
}

export default function InsightsPage({ loading, report, error, hasAccess = true }: InsightsPageProps) {
  if (!hasAccess) {
    return <AccessDenied />
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-6 w-48" />
        <Skeleton className="h-96 w-full" />
      </div>
    )
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertTitle>Error</AlertTitle>
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    )
  }

  if (!report) {
    return (
      <Alert>
        <AlertTitle>No Report Available</AlertTitle>
        <AlertDescription>No insights report found. Please run an analysis first.</AlertDescription>
      </Alert>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Claude Code Insights Report</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div>
            <h3 className="font-semibold">Analysis Type</h3>
            <p>{report.analysisType}</p>
          </div>
          <div>
            <h3 className="font-semibold">Status</h3>
            <p>{report.status}</p>
          </div>
          <div>
            <h3 className="font-semibold">Created At</h3>
            <p>{new Date(report.createdAt).toLocaleString()}</p>
          </div>
          <div>
            <h3 className="font-semibold">Metadata</h3>
            <pre className="bg-gray-100 p-4 rounded">{JSON.stringify(report.metadata, null, 2)}</pre>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
