import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { verifyProjectOwnership } from '@/lib/db/auth-helpers';
import { getCalibrationDashboard } from '@/lib/calibration/queries';
import { CalibrationDashboard } from '@/components/calibration/calibration-dashboard';
import { Button } from '@/components/ui/button';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

function parseProjectId(projectIdString: string): number {
  const projectId = parseInt(projectIdString, 10);
  if (Number.isNaN(projectId) || projectId <= 0) {
    notFound();
  }
  return projectId;
}

export default async function CalibrationPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}): Promise<JSX.Element> {
  const { projectId: projectIdString } = await params;
  const projectId = parseProjectId(projectIdString);

  const project = await verifyProjectOwnership(projectId).catch((error) => {
    if (
      error instanceof Error &&
      (error.message === 'Project not found' || error.message === 'Unauthorized')
    ) {
      notFound();
    }
    throw error;
  });

  const initialData = await getCalibrationDashboard(projectId);

  return (
    <main className="container mx-auto py-10 max-w-7xl">
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-muted-foreground">{project.name}</p>
          </div>
          <Link href={`/projects/${projectId}/board`}>
            <Button variant="outline" size="sm">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Board
            </Button>
          </Link>
        </div>

        <CalibrationDashboard projectId={projectId} initialData={initialData} />
      </div>
    </main>
  );
}
