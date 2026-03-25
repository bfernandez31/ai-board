import { type CSSProperties } from 'react';

// Catppuccin color palette for ticket borders
const TICKET_COLORS = ['mauve', 'blue', 'sapphire', 'green', 'yellow'] as const;
type TicketColor = (typeof TICKET_COLORS)[number];

type ParallaxLayer = 'back' | 'mid' | 'front';

interface TicketCardProps {
  index: number;
  color: TicketColor;
  duration: number; // seconds
  delay: number; // seconds
  verticalPosition: number; // percentage
  rotation: number; // degrees
  layer: ParallaxLayer;
}

/** Layer config: back = slow/small/blurry, front = fast/large/sharp */
const LAYER_CONFIG: Record<ParallaxLayer, {
  speed: number;   // duration multiplier (higher = slower)
  scale: number;   // size multiplier
  opacity: number; // base opacity
  blur: boolean;   // apply blur
}> = {
  back:  { speed: 1.6, scale: 0.7,  opacity: 0.3, blur: true },
  mid:   { speed: 1.0, scale: 1.0,  opacity: 0.6, blur: false },
  front: { speed: 0.7, scale: 1.25, opacity: 0.9, blur: false },
};

/** Deterministic animation properties seeded by index for consistent SSR/client rendering */
function getTicketProps(index: number): TicketCardProps {
  const seed = index + 1;
  const pseudoRandom = (multiplier: number) => ((seed * multiplier) % 97) / 97;

  // Distribute tickets across 3 layers: 6 back, 6 mid, 6 front
  const layerIndex = index % 3;
  const layer: ParallaxLayer = layerIndex === 0 ? 'back' : layerIndex === 1 ? 'mid' : 'front';
  const config = LAYER_CONFIG[layer];

  return {
    index,
    color: TICKET_COLORS[index % TICKET_COLORS.length] as TicketColor,
    duration: (30 + pseudoRandom(13) * 20) * config.speed,
    delay: -(pseudoRandom(17) * 40), // Negative delays: start mid-animation
    verticalPosition: 5 + pseudoRandom(23) * 90, // 5-95% to avoid clipping
    rotation: -8 + pseudoRandom(31) * 16, // -8 to +8 degrees
    layer,
  };
}

function TicketCard({ color, duration, delay, verticalPosition, rotation, layer }: TicketCardProps) {
  const config = LAYER_CONFIG[layer];

  const style: CSSProperties = {
    animationDuration: `${duration}s`,
    animationDelay: `${delay}s`,
    top: `${verticalPosition}%`,
    transform: `rotate(${rotation}deg) scale(${config.scale})`,
    opacity: config.opacity,
    willChange: 'left',
    filter: config.blur ? 'blur(2px)' : undefined,
  };

  // Explicit Tailwind classes required for JIT compiler
  const colorClasses: Record<TicketColor, { border: string; bg: string; glow: string }> = {
    mauve:    { border: 'border-ctp-mauve/40',    bg: 'bg-ctp-mauve/30',    glow: 'shadow-ctp-mauve/20' },
    blue:     { border: 'border-ctp-blue/40',     bg: 'bg-ctp-blue/30',     glow: 'shadow-ctp-blue/20' },
    sapphire: { border: 'border-ctp-sapphire/40', bg: 'bg-ctp-sapphire/30', glow: 'shadow-ctp-sapphire/20' },
    green:    { border: 'border-ctp-green/40',    bg: 'bg-ctp-green/30',    glow: 'shadow-ctp-green/20' },
    yellow:   { border: 'border-ctp-yellow/40',   bg: 'bg-ctp-yellow/30',   glow: 'shadow-ctp-yellow/20' },
  };

  const classes = colorClasses[color];
  const zIndex = layer === 'back' ? 'z-0' : layer === 'mid' ? 'z-[1]' : 'z-[2]';

  return (
    <div
      className={`
        ticket-card absolute w-24 h-16 rounded-lg border-2
        ${classes.border} ${classes.glow}
        ${layer === 'front' ? 'shadow-lg' : 'shadow-md'}
        backdrop-blur-sm
        pointer-events-none ${zIndex}
        motion-safe:animate-ticket-drift motion-reduce:animate-none
      `}
      style={style}
      aria-hidden="true"
    >
      <div className="p-3 space-y-2">
        <div className={`h-1.5 w-12 rounded ${classes.bg}`} />
        <div className={`h-1.5 w-8 rounded ${classes.bg}`} />
      </div>
    </div>
  );
}

export default function AnimatedTicketBackground({ className = '' }: { className?: string }) {
  const tickets = Array.from({ length: 18 }, (_, i) => getTicketProps(i));

  return (
    <div className={`animated-ticket-background absolute inset-0 ${className}`} aria-hidden="true">
      {/* Edge fade masks — tickets dissolve at left/right edges */}
      <div className="absolute inset-0 z-[3] pointer-events-none"
        style={{
          maskImage: 'linear-gradient(to right, transparent 0%, black 15%, black 85%, transparent 100%)',
          WebkitMaskImage: 'linear-gradient(to right, transparent 0%, black 15%, black 85%, transparent 100%)',
        }}
      >
        {tickets.map((props) => (
          <TicketCard key={props.index} {...props} />
        ))}
      </div>
    </div>
  );
}
