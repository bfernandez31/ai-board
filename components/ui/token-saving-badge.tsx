import { Badge } from '@/components/ui/badge';
import {
  getTokenSavingIcon,
  getTokenSavingLabel,
  getTokenSavingDescription,
} from '@/app/lib/utils/token-saving-icons';

interface TokenSavingBadgeProps {
  /** Whether the ON value comes from a ticket override (vs the inherited project default). */
  isOverride?: boolean;
  variant?: 'default' | 'secondary' | 'outline' | 'destructive';
  className?: string;
}

/**
 * TokenSavingBadge Component (AIB-849, US4)
 *
 * Compact header badge shown ONLY when token saving is effectively ON. The
 * caller is responsible for the `effectiveTokenSaving === true` guard — this
 * component always renders (mirrors PolicyBadge). Tooltip states the source
 * (inherited vs override). All Tailwind classes are full literal strings.
 */
export function TokenSavingBadge({
  isOverride = false,
  variant = 'secondary',
  className = '',
}: TokenSavingBadgeProps) {
  const icon = getTokenSavingIcon();
  const label = getTokenSavingLabel();
  const description = getTokenSavingDescription(isOverride);

  return (
    <Badge
      variant={variant}
      className={`gap-1 ${className}`}
      data-testid="token-saving-badge"
      title={description}
    >
      <span>{icon}</span>
      <span className="text-xs" data-testid="token-saving-badge-label">
        {label}
      </span>
      {isOverride && (
        <span
          className="text-xs text-muted-foreground"
          data-testid="token-saving-override-label"
        >
          (override)
        </span>
      )}
    </Badge>
  );
}
