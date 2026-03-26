import type { LucideIcon } from 'lucide-react';

interface FeatureCardProps {
  icon: LucideIcon;
  iconColorClass: string;
  title: string;
  description: string;
  featured?: boolean;
}

const VARIANTS = {
  featured: {
    wrapper: 'p-8 border-primary/30 bg-gradient-to-br from-ctp-mantle via-ctp-mantle to-primary/5',
    layout: 'flex flex-col gap-4',
    icon: 'w-10 h-10',
    title: 'text-xl',
    description: 'text-base leading-relaxed',
  },
  standard: {
    wrapper: 'p-6 border-border bg-ctp-mantle hover:border-primary/50',
    layout: 'flex items-start gap-4',
    icon: 'w-8 h-8',
    title: 'text-lg',
    description: '',
  },
} as const;

export function FeatureCard({ icon: Icon, iconColorClass, title, description, featured }: FeatureCardProps) {
  const v = featured ? VARIANTS.featured : VARIANTS.standard;

  return (
    <div
      className={`stagger-item rounded-lg border transition-all hover:shadow-lg hover:shadow-primary/10 hover:-translate-y-1 focus-within:outline focus-within:outline-[3px] focus-within:outline-primary focus-within:outline-offset-2 ${v.wrapper}`}
      data-testid="feature-card"
      aria-label={title}
    >
      <div className={v.layout}>
        <div className="flex-shrink-0">
          <Icon className={`${v.icon} ${iconColorClass}`} aria-hidden="true" />
        </div>
        <div>
          <h3 className={`font-semibold text-foreground mb-2 ${v.title}`}>
            {title}
          </h3>
          <p className={`text-muted-foreground ${v.description}`}>
            {description}
          </p>
        </div>
      </div>
    </div>
  );
}
