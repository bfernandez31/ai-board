import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { getProject } from '@/lib/db/projects';
import { ClarificationPolicyCard } from '@/components/settings/clarification-policy-card';
import { AgentCard } from '@/components/settings/agent-card';
import { Button } from '@/components/ui/button';
import { ConstitutionCard } from '@/components/settings/constitution-card';

// Force dynamic rendering to ensure fresh data
export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * Project Settings Page (Server Component)
 *
 * Displays project configuration including:
 * - Default clarification policy
 * - Other project settings (future)
 */
export default async function ProjectSettingsPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId: projectIdString } = await params;

  // Parse and validate projectId
  const projectId = parseInt(projectIdString, 10);

  // Return 404 if projectId is not a valid number
  if (isNaN(projectId) || projectId <= 0) {
    notFound();
  }

  // Fetch project (with authentication check)
  const project = await getProject(projectId).catch((error) => {
    if (
      error instanceof Error &&
      (error.message === 'Project not found' || error.message === 'Unauthorized')
    ) {
      notFound();
    }
    throw error;
  });

  return (
    <main className="container mx-auto py-10 max-w-4xl">
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Project Settings</h1>
            <p className="text-muted-foreground mt-2">
              Configure default behavior for {project.name}
            </p>
          </div>
          <Link href={`/projects/${projectId}/board`}>
            <Button variant="outline" size="sm">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Board
            </Button>
          </Link>
        </div>

        <div className="space-y-6">
          <ClarificationPolicyCard
            project={{
              id: project.id,
              clarificationPolicy: project.clarificationPolicy,
            }}
          />

          <AgentCard
            project={{
              id: project.id,
              defaultAgent: project.defaultAgent,
            }}
          />

          <ConstitutionCard
            project={{
              id: project.id,
              name: project.name,
            }}
          />
        </div>
      </div>
    </main>
  );
}
