import type { LucideIcon } from 'lucide-react';

interface FeatureCardProps {
  icon: LucideIcon;
  iconClassName: string;
  title: string;
  description: string;
}

export function FeatureCard({ icon: Icon, iconClassName, title, description }: FeatureCardProps) {
  return (
    <div
      className="rounded-2xl border border-border bg-card/80 p-6 transition-colors hover:border-primary/40"
      data-testid="feature-card"
    >
      <div className="flex items-start gap-4">
        <div className="flex-shrink-0">
          <Icon className={`h-8 w-8 ${iconClassName}`} />
        </div>
        <div>
          <h3 className="mb-2 text-lg font-semibold text-foreground">{title}</h3>
          <p className="text-sm leading-6 text-muted-foreground md:text-base">{description}</p>
        </div>
      </div>
    </div>
  );
}
