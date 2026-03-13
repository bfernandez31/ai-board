import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { AiCredentialsCard } from '@/components/settings/ai-credentials-card';
import { DefaultAgentCard } from '@/components/settings/default-agent-card';
import { ClarificationPolicyCard } from '@/components/settings/clarification-policy-card';
import { ConstitutionCard } from '@/components/settings/constitution-card';
import { Button } from '@/components/ui/button';
import { getProject } from '@/lib/db/projects';
import { getCurrentUser } from '@/lib/db/users';
import { listProjectAiCredentials } from '@/lib/services/ai-credential-service';

// Force dynamic rendering to ensure fresh data
export const dynamic = 'force-dynamic';
export const revalidate = 0;

function parseProjectId(projectId: string): number {
  const parsedProjectId = Number.parseInt(projectId, 10);

  if (Number.isNaN(parsedProjectId) || parsedProjectId <= 0) {
    notFound();
  }

  return parsedProjectId;
}

export default async function ProjectSettingsPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}): Promise<JSX.Element> {
  const { projectId: projectIdString } = await params;
  const projectId = parseProjectId(projectIdString);
  const project = await getProject(projectId).catch((error) => {
    if (
      error instanceof Error &&
      (error.message === 'Project not found' || error.message === 'Unauthorized')
    ) {
      notFound();
    }
    throw error;
  });

  const currentUser = await getCurrentUser();
  const initialProviders = await listProjectAiCredentials(projectId, currentUser.id === project.userId);

  return (
    <main className="container mx-auto max-w-4xl py-10">
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Project Settings</h1>
            <p className="mt-2 text-muted-foreground">
              Configure default behavior for {project.name}
            </p>
          </div>
          <Link href={`/projects/${projectId}/board`}>
            <Button variant="outline" size="sm">
              <ArrowLeft className="mr-2 h-4 w-4" />
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

          <DefaultAgentCard
            project={{
              id: project.id,
              defaultAgent: project.defaultAgent,
            }}
          />

          <AiCredentialsCard
            projectId={project.id}
            initialProviders={initialProviders}
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
