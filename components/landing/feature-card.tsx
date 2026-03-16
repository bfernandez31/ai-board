import type { LucideIcon } from 'lucide-react';

interface FeatureCardProps {
  icon: LucideIcon;
  iconColorClass: string;
  title: string;
  description: string;
}

export function FeatureCard({ icon: Icon, iconColorClass, title, description }: FeatureCardProps) {
  return (
    <div
      className="p-6 rounded-lg border border-border bg-ctp-mantle hover:border-primary/50 transition-all hover:shadow-lg hover:shadow-primary/10 focus-within:outline focus-within:outline-[3px] focus-within:outline-primary focus-within:outline-offset-2"
      data-testid="feature-card"
      aria-label={title}
    >
      <div className="flex items-start gap-4">
        <div className="flex-shrink-0">
          <Icon className={`w-8 h-8 ${iconColorClass}`} aria-hidden="true" />
        </div>
        <div>
          <h3 className="text-lg font-semibold text-foreground mb-2">
            {title}
          </h3>
          <p className="text-muted-foreground">
            {description}
          </p>
        </div>
      </div>
    </div>
  );
}
