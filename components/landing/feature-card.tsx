import type { LucideIcon } from 'lucide-react';

interface FeatureCardProps {
  icon: LucideIcon;
  iconClassName: string;
  bgClassName: string;
  title: string;
  description: string;
}

export function FeatureCard({ icon: Icon, iconClassName, bgClassName, title, description }: FeatureCardProps) {
  return (
    <div
      className="group p-6 rounded-xl border border-border bg-background hover:border-primary/40 transition-all duration-300 hover:shadow-lg hover:shadow-primary/5"
      data-testid="feature-card"
    >
      <div className="flex items-start gap-4">
        <div
          className={`flex-shrink-0 flex items-center justify-center w-12 h-12 rounded-lg ${bgClassName} transition-transform duration-300 group-hover:scale-110`}
          aria-hidden="true"
        >
          <Icon className={`w-6 h-6 ${iconClassName}`} />
        </div>
        <div>
          <h3 className="text-lg font-semibold text-foreground mb-2">
            {title}
          </h3>
          <p className="text-muted-foreground text-sm leading-relaxed">
            {description}
          </p>
        </div>
      </div>
    </div>
  );
}
