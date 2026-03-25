import type { LucideIcon } from 'lucide-react';

interface FeatureCardProps {
  icon: LucideIcon;
  iconColorClass: string;
  title: string;
  description: string;
  featured?: boolean;
}

export function FeatureCard({ icon: Icon, iconColorClass, title, description, featured }: FeatureCardProps) {
  return (
    <div
      className={`stagger-item rounded-lg border transition-all hover:shadow-lg hover:shadow-primary/10 hover:-translate-y-1 focus-within:outline focus-within:outline-[3px] focus-within:outline-primary focus-within:outline-offset-2 ${
        featured
          ? 'p-8 border-primary/30 bg-gradient-to-br from-ctp-mantle via-ctp-mantle to-primary/5'
          : 'p-6 border-border bg-ctp-mantle hover:border-primary/50'
      }`}
      data-testid="feature-card"
      aria-label={title}
    >
      <div className={featured ? 'flex flex-col gap-4' : 'flex items-start gap-4'}>
        <div className="flex-shrink-0">
          <Icon className={`${featured ? 'w-10 h-10' : 'w-8 h-8'} ${iconColorClass}`} aria-hidden="true" />
        </div>
        <div>
          <h3 className={`font-semibold text-foreground mb-2 ${featured ? 'text-xl' : 'text-lg'}`}>
            {title}
          </h3>
          <p className={`text-muted-foreground ${featured ? 'text-base leading-relaxed' : ''}`}>
            {description}
          </p>
        </div>
      </div>
    </div>
  );
}
