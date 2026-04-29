import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';

import { cn } from '@/lib/utils';

/**
 * AI-Board Badge
 * ---------------------------------------------------------------------------
 * Doctrine d'usage — un badge n'est PAS un bouton. Format compact, mono pour
 * les variantes techniques (stages, ticket IDs, scope), pas d'état hover.
 *
 *  - `default`     → Tag brand générique sur fond aurora tinted.
 *                    Ex : "Pro", "Active", "Verified".
 *
 *  - `secondary`   → Tag neutre, tinte mauve douce (PAS de gris).
 *                    Ex : "Draft", "Imported", "Archived".
 *
 *  - `destructive` → État d'échec / blocage.
 *                    Ex : "Failed", "Blocked".
 *
 *  - `outline`     → Tag technique sur bordure aurora gradient, mono-cap.
 *                    Format compact (10px tracked-out) pour ne pas être
 *                    confondu avec un BOUTON outline.
 *
 *  - `stage`       → Les 6 stages canoniques INBOX → SHIP. Toujours mono
 *                    uppercase tracked-out 0.22em, jamais recolorés.
 *                    Use stage="inbox|specify|plan|build|verify|ship"
 *
 *  - `status`      → Avec dot. status="running|ok|idle".
 *
 *  - `promo`       → "Most Popular" — aurora plein animé. UN SEUL par page.
 *
 *  - `ticket`      → Ticket ID (AIB-123). Mono, mauve teinté.
 *
 *  - `count`       → Pastille numérique (workflow column count).
 *
 *  - `attribute`   → ★ Variante CRITIQUE pour tags qualifiants
 *                    (FULL/QUICK, friction, confidence, quality). La couleur
 *                    encode le NIVEAU, pas le label.
 *                    Kinds:
 *                      - friction (3 levels): low=green, high=red (high=bad)
 *                      - confidence (3 levels): low=red, high=green (high=good)
 *                      - quality (4 levels): low=red, med=yellow, high=blue,
 *                        best=green — pour les scores 0-100 où on veut
 *                        distinguer "passing avec marge" (best ≥90) de
 *                        "passing tout juste" (high 70-89).
 *                      - scope: binary FULL/QUICK
 *                    C'est ce qui remplace les tags violets aléatoires
 *                    illisibles.
 *
 * ---------------------------------------------------------------------------
 * PRÉREQUIS : `badge-styles.css` doit être intégré dans app/globals.css.
 * ---------------------------------------------------------------------------
 */

const badgeVariants = cva('ab-badge', {
  variants: {
    variant: {
      default:     'ab-badge-default',
      secondary:   'ab-badge-secondary',
      destructive: 'ab-badge-destructive',
      outline:     'ab-badge-outline',
      stage:       'ab-badge-stage',
      status:      'ab-badge-status',
      promo:       'ab-badge-promo',
      ticket:      'ab-badge-ticket',
      count:       'ab-badge-count',
      attribute:   'ab-badge-attr',
    },
  },
  defaultVariants: { variant: 'default' },
});

type Stage  = 'inbox' | 'specify' | 'plan' | 'build' | 'verify' | 'ship';
type Status = 'running' | 'ok' | 'idle';
type Level  = 'low' | 'med' | 'high' | 'best';
type AttrKind = 'friction' | 'confidence' | 'quality' | 'scope';

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {
  /** For variant="stage" */
  stage?: Stage;
  /** For variant="status" */
  status?: Status;
  /** For variant="attribute" — encodes the level. */
  level?: Level;
  /** For variant="attribute" — `scope` switches to FULL/QUICK formatting. */
  kind?: AttrKind;
  /** For attribute scope — which side of the binary. Required if kind="scope". */
  scope?: 'full' | 'quick';
}

const Badge = React.forwardRef<HTMLSpanElement, BadgeProps>(
  ({ className, variant, stage, status, level, kind, scope, children, ...props }, ref) => {
    const classes = [badgeVariants({ variant })];

    if (variant === 'stage' && stage)   classes.push(`ab-stage-${stage}`);
    if (variant === 'status' && status) classes.push(`ab-status-${status}`);

    if (variant === 'attribute') {
      if (kind === 'confidence' && level) classes.push(`ab-level-conf-${level}`);
      else if (kind === 'quality' && level) classes.push(`ab-level-quality-${level}`);
      else if (kind === 'scope' && scope) classes.push('ab-attr-scope', `ab-level-scope-${scope}`);
      else if (level)                     classes.push(`ab-level-${level}`); // friction = default
    }

    return (
      <span ref={ref} className={cn(...classes, className)} {...props}>
        {variant === 'status' && <span className="ab-dot" aria-hidden="true" />}
        {children}
      </span>
    );
  }
);
Badge.displayName = 'Badge';

export { Badge, badgeVariants };
