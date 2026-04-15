import { ProjectCard } from './project-card';
import { EmptyProjectsState } from './empty-projects-state';
import { ProjectsActivityHeatmap } from './projects-activity-heatmap';
import type {
  ProjectWithCount,
  ProjectsActivityHeatmapResponse,
} from '@/app/lib/types/project';

interface ProjectsContainerProps {
  projects: ProjectWithCount[];
  activityHeatmap: ProjectsActivityHeatmapResponse;
}

export function ProjectsContainer({ projects, activityHeatmap }: ProjectsContainerProps) {
  if (projects.length === 0) {
    return <EmptyProjectsState />;
  }

  return (
    <div className="space-y-8">
      <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
        {projects.map((project) => (
          <ProjectCard key={project.id} project={project} />
        ))}
      </div>
      <ProjectsActivityHeatmap initialData={activityHeatmap} />
    </div>
  );
}
