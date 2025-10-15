import { Badge } from '@/components/ui/badge';
import { ClarificationPolicy } from '@prisma/client';
import { getPolicyIcon, getPolicyLabel } from '@/app/lib/utils/policy-icons';

interface PolicyBadgeProps {
  policy: ClarificationPolicy;
  isOverride?: boolean; // Show "(override)" suffix
  variant?: 'default' | 'secondary' | 'outline' | 'destructive';
  className?: string;
}

/**
 * PolicyBadge Component
 *
 * Displays a badge with the policy icon and label
 * Used across board view, ticket detail view, and settings
 *
 * @param policy - The clarification policy to display
 * @param isOverride - Whether this is a ticket override (vs project default)
 * @param variant - Badge variant (default: 'secondary')
 * @param className - Additional CSS classes
 */
export function PolicyBadge({
  policy,
  isOverride = false,
  variant = 'secondary',
  className = '',
}: PolicyBadgeProps) {
  const icon = getPolicyIcon(policy);
  const label = getPolicyLabel(policy);

  return (
    <Badge
      variant={variant}
      className={`gap-1 ${className}`}
      data-testid="policy-badge"
    >
      <span>{icon}</span>
      <span className="text-xs" data-testid="policy-label">
        {label}
      </span>
      {isOverride && (
        <span
          className="text-xs text-muted-foreground"
          data-testid="policy-override-label"
        >
          (override)
        </span>
      )}
    </Badge>
  );
}
