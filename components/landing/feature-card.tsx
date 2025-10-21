import type { LucideIcon } from 'lucide-react';

interface FeatureCardProps {
  icon: LucideIcon;
  iconColor: string;
  title: string;
  description: string;
}

export function FeatureCard({ icon: Icon, iconColor, title, description }: FeatureCardProps) {
  return (
    <div
      className="p-6 rounded-lg border border-[hsl(var(--ctp-surface-0))] bg-[hsl(var(--ctp-mantle))] hover:border-[#8B5CF6]/50 transition-all hover:shadow-lg hover:shadow-[#8B5CF6]/10"
      data-testid="feature-card"
    >
      <div className="flex items-start gap-4">
        <div className="flex-shrink-0">
          <Icon className="w-8 h-8" style={{ color: iconColor }} />
        </div>
        <div>
          <h3 className="text-lg font-semibold text-[hsl(var(--ctp-text))] mb-2">
            {title}
          </h3>
          <p className="text-[hsl(var(--ctp-subtext-0))]">
            {description}
          </p>
        </div>
      </div>
    </div>
  );
}
