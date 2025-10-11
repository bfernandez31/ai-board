export function EmptyProjectsState() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[400px] text-center">
      <h2 className="text-2xl font-semibold text-gray-700 mb-2">
        No projects available
      </h2>
      <p className="text-gray-500">
        Get started by clicking the &ldquo;Create Project&rdquo; button above
      </p>
    </div>
  );
}
