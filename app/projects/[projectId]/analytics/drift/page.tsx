import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { verifyProjectOwnership } from '@/lib/db/auth-helpers';
import { getDriftData } from '@/lib/drift/queries';
import { DriftDashboard } from '@/components/drift/drift-dashboard';
import { Button } from '@/components/ui/button';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function DriftPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}): Promise<JSX.Element> {
  const { projectId: projectIdStr } = await params;
  const projectId = parseInt(projectIdStr, 10);

  if (Number.isNaN(projectId) || projectId <= 0) {
    notFound();
  }

  const project = await verifyProjectOwnership(projectId).catch((error) => {
    if (error instanceof Error && error.message === 'Project not found') {
      notFound();
    }
    throw error;
  });

  const initialData = await getDriftData(projectId);

  return (
    <main className="container mx-auto py-10 max-w-7xl">
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Analysis Drift</h1>
            <p className="text-muted-foreground mt-2">
              Predicted vs actual calibration for {project.name}
            </p>
          </div>
          <Link href={`/projects/${projectId}/analytics`}>
            <Button variant="outline" size="sm">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Analytics
            </Button>
          </Link>
        </div>

        <DriftDashboard projectId={projectId} initialData={initialData} />
      </div>
    </main>
  );
}
