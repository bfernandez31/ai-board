import { ProjectCard } from './project-card';
import { EmptyProjectsState } from './empty-projects-state';
import type { ProjectWithCount } from '@/app/lib/types/project';

interface ProjectsContainerProps {
  projects: ProjectWithCount[];
}

export function ProjectsContainer({ projects }: ProjectsContainerProps) {
  if (projects.length === 0) {
    return <EmptyProjectsState />;
  }

  return (
    <div className="overflow-y-auto max-h-[calc(100vh-200px)]">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {projects.map((project) => (
          <ProjectCard key={project.id} project={project} />
        ))}
      </div>
    </div>
  );
}
