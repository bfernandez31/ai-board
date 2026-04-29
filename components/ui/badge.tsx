import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { Zap } from 'lucide-react';

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
 *  - `count`       → Pastille numérique soft tinted (workflow column count,
 *                    ambiant). Pour une notif isolée attention-grabbing,
 *                    voir `count-notification`.
 *
 *  - `count-notification` → Pastille aurora plein. Notif unread count sur
 *                    une cloche, pour attirer l'œil. UN par contexte de
 *                    notification.
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
 *                      - scope: binary FULL/QUICK (FULL=blue posé,
 *                        QUICK=mauve énergique avec icône éclair auto).
 *                    C'est ce qui remplace les tags violets aléatoires
 *                    illisibles.
 *
 *  - `attribute-tc` → Version compacte de `attribute` pour ticket cards
 *                    (kanban). Pas de fond, pas de bordure, juste la couleur
 *                    de texte sémantique + icône optionnelle. Mêmes kinds
 *                    et levels que `attribute`.
 *
 * ---------------------------------------------------------------------------
 * PRÉREQUIS : `badge-styles.css` doit être intégré dans app/globals.css.
 * ---------------------------------------------------------------------------
 */

const badgeVariants = cva('ab-badge', {
  variants: {
    variant: {
      default:              'ab-badge-default',
      secondary:            'ab-badge-secondary',
      destructive:          'ab-badge-destructive',
      outline:              'ab-badge-outline',
      stage:                'ab-badge-stage',
      status:               'ab-badge-status',
      promo:                'ab-badge-promo',
      ticket:               'ab-badge-ticket',
      count:                'ab-badge-count',
      'count-notification': 'ab-badge-count-notification',
      attribute:            'ab-badge-attr',
      'attribute-tc':       'ab-badge-attr-tc',
    },
  },
  defaultVariants: { variant: 'default' },
});

type Stage  = 'inbox' | 'specify' | 'plan' | 'build' | 'verify' | 'ship';
type Status = 'running' | 'ok' | 'idle';
type Level  = 'low' | 'med' | 'high' | 'best';
type AttrKind = 'friction' | 'confidence' | 'quality' | 'scope';

// IMPORTANT: full literal class strings — Tailwind's purger cannot detect
// dynamic template literals like `ab-stage-${stage}`. Maps below MUST list
// every class verbatim or the rules get tree-shaken in production builds.
const STAGE_CLASS: Record<Stage, string> = {
  inbox:   'ab-stage-inbox',
  specify: 'ab-stage-specify',
  plan:    'ab-stage-plan',
  build:   'ab-stage-build',
  verify:  'ab-stage-verify',
  ship:    'ab-stage-ship',
};

const STATUS_CLASS: Record<Status, string> = {
  running: 'ab-status-running',
  ok:      'ab-status-ok',
  idle:    'ab-status-idle',
};

const LEVEL_FRICTION_CLASS: Record<Level, string> = {
  low:  'ab-level-low',
  med:  'ab-level-med',
  high: 'ab-level-high',
  best: 'ab-level-low', // friction has no "best" — fold to low (no friction = good)
};

const LEVEL_CONFIDENCE_CLASS: Record<Level, string> = {
  low:  'ab-level-conf-low',
  med:  'ab-level-conf-med',
  high: 'ab-level-conf-high',
  best: 'ab-level-conf-high', // confidence is 3-tier — best folds to high
};

const LEVEL_QUALITY_CLASS: Record<Level, string> = {
  low:  'ab-level-quality-low',
  med:  'ab-level-quality-med',
  high: 'ab-level-quality-high',
  best: 'ab-level-quality-best',
};

const LEVEL_SCOPE_CLASS: Record<'full' | 'quick', string> = {
  full:  'ab-level-scope-full',
  quick: 'ab-level-scope-quick',
};

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
  (
    { className, variant, stage, status, level, kind, scope, children, ...props },
    ref
  ): React.ReactElement => {
    const classes: string[] = [badgeVariants({ variant })];

    if (variant === 'stage' && stage)   classes.push(STAGE_CLASS[stage]);
    if (variant === 'status' && status) classes.push(STATUS_CLASS[status]);

    const isAttribute = variant === 'attribute' || variant === 'attribute-tc';
    if (isAttribute) {
      if (kind === 'confidence' && level) classes.push(LEVEL_CONFIDENCE_CLASS[level]);
      else if (kind === 'quality' && level) classes.push(LEVEL_QUALITY_CLASS[level]);
      else if (kind === 'scope' && scope) classes.push('ab-attr-scope', LEVEL_SCOPE_CLASS[scope]);
      else if (level)                     classes.push(LEVEL_FRICTION_CLASS[level]); // friction = default
    }

    const showQuickIcon = isAttribute && kind === 'scope' && scope === 'quick';

    return (
      <span ref={ref} className={cn(...classes, className)} {...props}>
        {variant === 'status' && <span className="ab-dot" aria-hidden="true" />}
        {showQuickIcon && <Zap className="ab-scope-icon" aria-hidden="true" />}
        {children}
      </span>
    );
  }
);
Badge.displayName = 'Badge';

export { Badge, badgeVariants };
