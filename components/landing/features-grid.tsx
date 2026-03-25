import { Sparkles, LayoutGrid, GitBranch, Zap, Image, RefreshCw } from 'lucide-react';
import { FeatureCard } from './feature-card';

export function FeaturesGrid() {
  const heroFeatures = [
    {
      icon: Sparkles,
      iconColorClass: 'text-ctp-mauve',
      title: 'AI-Powered Specifications',
      description: 'Automatically generate detailed specifications from tickets with intelligent clarification. The AI asks follow-up questions, resolves ambiguities, and produces complete technical specs.',
      featured: true,
    },
    {
      icon: LayoutGrid,
      iconColorClass: 'text-ctp-blue',
      title: 'Visual Kanban Board',
      description: 'Track tasks through INBOX, SPECIFY, PLAN, BUILD, VERIFY, and SHIP stages. Drag-and-drop interface with real-time status updates and workflow automation.',
      featured: true,
    },
  ];

  const standardFeatures = [
    {
      icon: GitBranch,
      iconColorClass: 'text-ctp-green',
      title: 'Git Platform Integration',
      description: 'Connect with GitHub, GitLab, or Bitbucket to sync issues and manage workflows.',
    },
    {
      icon: Zap,
      iconColorClass: 'text-ctp-yellow',
      title: 'Automated Workflows',
      description: 'Trigger automated specification, planning, and implementation tasks with your CI/CD pipeline.',
    },
    {
      icon: Image,
      iconColorClass: 'text-ctp-pink',
      title: 'Image Management',
      description: 'Upload and manage images with cloud storage integration for documentation and specifications.',
    },
    {
      icon: RefreshCw,
      iconColorClass: 'text-ctp-sky',
      title: 'Real-Time Updates',
      description: 'Get instant feedback on workflow status with live polling and job tracking.',
    },
  ];

  return (
    <section id="features" className="py-16 md:py-24 lg:py-32 bg-ctp-mantle">
      <div className="container mx-auto px-4">
        <div className="max-w-6xl mx-auto">
          <h2 className="font-display text-4xl md:text-5xl text-center text-foreground mb-4">
            Everything You Need
          </h2>
          <p className="text-xl text-muted-foreground text-center mb-12 max-w-2xl mx-auto">
            Powerful features to streamline your development workflow from idea to production.
          </p>

          {/* Hero features - 2 large cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            {heroFeatures.map((feature) => (
              <FeatureCard key={feature.title} {...feature} />
            ))}
          </div>

          {/* Standard features - 4 smaller cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {standardFeatures.map((feature) => (
              <FeatureCard key={feature.title} {...feature} />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
