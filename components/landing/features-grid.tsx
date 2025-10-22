import { Sparkles, LayoutGrid, GitBranch, Zap, Image, RefreshCw } from 'lucide-react';
import { FeatureCard } from './feature-card';

export function FeaturesGrid() {
  const features = [
    {
      icon: Sparkles,
      iconColor: '#8B5CF6', // violet
      title: 'AI-Powered Specifications',
      description: 'Automatically generate detailed specifications from tickets with intelligent clarification.',
    },
    {
      icon: LayoutGrid,
      iconColor: '#89b4fa', // blue
      title: 'Visual Kanban Board',
      description: 'Track tasks through INBOX → SPECIFY → PLAN → BUILD → VERIFY stages with drag-and-drop interface.',
    },
    {
      icon: GitBranch,
      iconColor: '#a6e3a1', // green
      title: 'Git Platform Integration',
      description: 'Connect with GitHub, GitLab, or Bitbucket to sync issues and manage workflows.',
    },
    {
      icon: Zap,
      iconColor: '#f9e2af', // yellow
      title: 'Automated Workflows',
      description: 'Trigger automated specification, planning, and implementation tasks with your CI/CD pipeline.',
    },
    {
      icon: Image,
      iconColor: '#f5c2e7', // pink
      title: 'Image Management',
      description: 'Upload and manage images with cloud storage integration for documentation and specifications.',
    },
    {
      icon: RefreshCw,
      iconColor: '#89dceb', // cyan
      title: 'Real-Time Updates',
      description: 'Get instant feedback on workflow status with live polling and job tracking.',
    },
  ];

  return (
    <section id="features" className="py-16 md:py-24 lg:py-32 bg-[hsl(var(--ctp-mantle))]">
      <div className="container mx-auto px-4">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-4xl md:text-5xl font-bold text-center text-[hsl(var(--ctp-text))] mb-4">
            Everything You Need
          </h2>
          <p className="text-xl text-[hsl(var(--ctp-subtext-0))] text-center mb-12 max-w-2xl mx-auto">
            Powerful features to streamline your development workflow from idea to production.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((feature, index) => (
              <FeatureCard key={index} {...feature} />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
