import { type CSSProperties } from 'react';

// Catppuccin color palette for ticket borders
const TICKET_COLORS = ['mauve', 'blue', 'sapphire', 'green', 'yellow'] as const;
type TicketColor = (typeof TICKET_COLORS)[number];

interface TicketCardProps {
  index: number;
  color: TicketColor;
  duration: number; // seconds
  delay: number; // seconds
  verticalPosition: number; // percentage
  rotation: number; // degrees
}

/**
 * Generates deterministic animation properties based on ticket index
 * Uses seeded pseudo-random values to ensure consistent rendering across server/client
 */
function getTicketProps(index: number): TicketCardProps {
  // Use simple deterministic randomization based on index
  const seed = index + 1;
  const pseudoRandom = (multiplier: number) => ((seed * multiplier) % 97) / 97;

  return {
    index,
    color: TICKET_COLORS[index % TICKET_COLORS.length] as TicketColor,
    duration: 40 + pseudoRandom(13) * 20, // 40-60s
    delay: pseudoRandom(17) * 60, // 0-60s
    verticalPosition: pseudoRandom(23) * 100, // 0-100%
    rotation: -10 + pseudoRandom(31) * 20, // -10 to +10 degrees
  };
}

/**
 * Individual animated ticket card component
 */
function TicketCard({ color, duration, delay, verticalPosition, rotation }: TicketCardProps) {
  const style: CSSProperties = {
    animationDuration: `${duration}s`,
    animationDelay: `${delay}s`,
    top: `${verticalPosition}%`,
    transform: `rotate(${rotation}deg)`,
    willChange: 'transform',
  };

  // Map colors to explicit Tailwind classes (required for JIT compiler)
  const colorClasses = {
    mauve: {
      border: 'border-ctp-mauve/10',
      bg1: 'bg-ctp-mauve/20',
      bg2: 'bg-ctp-mauve/20',
    },
    blue: {
      border: 'border-ctp-blue/10',
      bg1: 'bg-ctp-blue/20',
      bg2: 'bg-ctp-blue/20',
    },
    sapphire: {
      border: 'border-ctp-sapphire/10',
      bg1: 'bg-ctp-sapphire/20',
      bg2: 'bg-ctp-sapphire/20',
    },
    green: {
      border: 'border-ctp-green/10',
      bg1: 'bg-ctp-green/20',
      bg2: 'bg-ctp-green/20',
    },
    yellow: {
      border: 'border-ctp-yellow/10',
      bg1: 'bg-ctp-yellow/20',
      bg2: 'bg-ctp-yellow/20',
    },
  };

  const classes = colorClasses[color];

  return (
    <div
      className={`
        ticket-card absolute w-16 h-10 rounded border-2
        ${classes.border} backdrop-blur-sm
        pointer-events-none
        motion-safe:animate-ticket-drift motion-reduce:animate-none
      `}
      style={style}
      aria-hidden="true"
    >
      {/* Decorative content (simulated ticket text lines) */}
      <div className="p-2 space-y-1">
        <div className={`h-1 w-8 rounded ${classes.bg1}`} />
        <div className={`h-1 w-6 rounded ${classes.bg2}`} />
      </div>
    </div>
  );
}

/**
 * Animated ticket background component for landing page hero section
 * Renders 18 floating ticket cards with responsive visibility
 */
export default function AnimatedTicketBackground({ className = '' }: { className?: string }) {
  const tickets = Array.from({ length: 18 }, (_, i) => getTicketProps(i));

  return (
    <div className={`animated-ticket-background absolute inset-0 overflow-hidden ${className}`}>
      {tickets.map((props) => (
        <TicketCard key={props.index} {...props} />
      ))}
    </div>
  );
}
