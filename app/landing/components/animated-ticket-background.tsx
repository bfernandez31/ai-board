import { type CSSProperties } from 'react';

const TICKET_COLORS = ['mauve', 'blue', 'sapphire', 'green', 'yellow'] as const;
type TicketColor = (typeof TICKET_COLORS)[number];
type TicketColorClasses = Record<TicketColor, { border: string; bg: string }>;

interface TicketCardProps {
  index: number;
  color: TicketColor;
  duration: number;
  delay: number;
  verticalPosition: number;
  rotation: number;
}

const TICKET_COLOR_CLASSES: TicketColorClasses = {
  mauve: { border: 'border-ctp-mauve/40', bg: 'bg-ctp-mauve/30' },
  blue: { border: 'border-ctp-blue/40', bg: 'bg-ctp-blue/30' },
  sapphire: { border: 'border-ctp-sapphire/40', bg: 'bg-ctp-sapphire/30' },
  green: { border: 'border-ctp-green/40', bg: 'bg-ctp-green/30' },
  yellow: { border: 'border-ctp-yellow/40', bg: 'bg-ctp-yellow/30' },
};

function getTicketProps(index: number): TicketCardProps {
  const seed = index + 1;
  const pseudoRandom = function (multiplier: number): number {
    return ((seed * multiplier) % 97) / 97;
  };

  return {
    index,
    color: TICKET_COLORS[index % TICKET_COLORS.length] as TicketColor,
    duration: 30 + pseudoRandom(13) * 20,
    delay: -(pseudoRandom(17) * 30),
    verticalPosition: pseudoRandom(23) * 100,
    rotation: -10 + pseudoRandom(31) * 20,
  };
}

function TicketCard({ color, duration, delay, verticalPosition, rotation }: TicketCardProps): React.JSX.Element {
  const style: CSSProperties = {
    animationDuration: `${duration}s`,
    animationDelay: `${delay}s`,
    top: `${verticalPosition}%`,
    transform: `translateY(-50%) rotate(${rotation}deg)`,
    willChange: 'left, transform',
  };

  const classes = TICKET_COLOR_CLASSES[color];

  return (
    <div
      className={`ticket-card pointer-events-none absolute h-16 w-24 rounded-lg border-2 ${classes.border} shadow-lg backdrop-blur-sm motion-safe:animate-ticket-drift motion-reduce:animate-none`}
      style={style}
      aria-hidden="true"
    >
      <div className="space-y-2 p-3">
        <div className={`h-1.5 w-12 rounded ${classes.bg}`} />
        <div className={`h-1.5 w-8 rounded ${classes.bg}`} />
      </div>
    </div>
  );
}

interface AnimatedTicketBackgroundProps {
  className?: string;
}

export default function AnimatedTicketBackground({
  className = '',
}: AnimatedTicketBackgroundProps): React.JSX.Element {
  const tickets = Array.from({ length: 18 }, (_, i) => getTicketProps(i));

  return (
    <div
      className={`animated-ticket-background absolute inset-0 overflow-hidden motion-reduce:hidden ${className}`}
      aria-hidden="true"
    >
      {tickets.map((props) => (
        <TicketCard key={props.index} {...props} />
      ))}
    </div>
  );
}
