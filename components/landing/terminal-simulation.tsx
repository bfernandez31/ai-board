'use client';

import { useState, useEffect, useRef } from 'react';
import { useIntersectionObserver } from '@/lib/hooks/use-intersection-observer';

interface LogLine {
  text: string;
  type: 'info' | 'success' | 'command' | 'dim';
}

const LOG_SEQUENCES: LogLine[][] = [
  // SPECIFY stage
  [
    { text: '$ ai-board specify AIB-42', type: 'command' },
    { text: 'Analyzing ticket: "Add user authentication"', type: 'info' },
    { text: 'Scanning codebase for auth patterns...', type: 'dim' },
    { text: 'Found 3 related modules: auth/, middleware/, api/users', type: 'info' },
    { text: 'Generating specification with clarifications...', type: 'dim' },
    { text: '✓ Specification generated — 12 requirements, 4 edge cases', type: 'success' },
  ],
  // PLAN stage
  [
    { text: '$ ai-board plan AIB-42', type: 'command' },
    { text: 'Reading specification: specs/AIB-42/spec.md', type: 'info' },
    { text: 'Resolving dependency graph...', type: 'dim' },
    { text: 'Architecture: NextAuth.js + Prisma sessions', type: 'info' },
    { text: 'Generating implementation plan (8 tasks)...', type: 'dim' },
    { text: '✓ Plan ready — 8 tasks, ~2h estimated', type: 'success' },
  ],
  // BUILD stage
  [
    { text: '$ ai-board implement AIB-42', type: 'command' },
    { text: 'Creating branch: feat/AIB-42-user-auth', type: 'info' },
    { text: 'Task 1/8: Setting up NextAuth provider...', type: 'dim' },
    { text: 'Task 4/8: Adding session middleware...', type: 'dim' },
    { text: 'Task 8/8: Writing integration tests...', type: 'info' },
    { text: '✓ Implementation complete — 14 files changed, PR #127 opened', type: 'success' },
  ],
  // VERIFY stage
  [
    { text: '$ ai-board verify AIB-42', type: 'command' },
    { text: 'Running test suite: 42 tests...', type: 'info' },
    { text: 'Type-check: passed | Lint: passed', type: 'dim' },
    { text: 'E2E: Login flow ✓ | Session persistence ✓ | Logout ✓', type: 'info' },
    { text: 'Deploying preview: https://preview-aib42.vercel.app', type: 'dim' },
    { text: '✓ All checks passed — ready to ship', type: 'success' },
  ],
];

const TYPE_SPEED = 25; // ms per character
const LINE_PAUSE = 400; // ms between lines
const SEQUENCE_PAUSE = 2000; // ms between sequences

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function typeColorClass(type: LogLine['type']): string {
  switch (type) {
    case 'command': return 'text-ctp-mauve';
    case 'success': return 'text-ctp-green';
    case 'dim': return 'text-muted-foreground/70';
    case 'info':
    default: return 'text-foreground/90';
  }
}

export function TerminalSimulation() {
  const containerRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const isVisible = useIntersectionObserver(containerRef, { threshold: 0.3 });
  const [lines, setLines] = useState<LogLine[]>([]);
  const [currentLine, setCurrentLine] = useState<{ text: string; type: LogLine['type'] } | null>(null);
  const hasStarted = useRef(false);
  const animationRef = useRef<{ cancel: boolean }>({ cancel: false });

  useEffect(() => {
    if (!isVisible || hasStarted.current) return;
    hasStarted.current = true;

    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReduced) {
      requestAnimationFrame(() => setLines(LOG_SEQUENCES.flat()));
      return;
    }

    const ctrl = animationRef.current;
    ctrl.cancel = false;

    async function runAnimation() {
      for (let seqIndex = 0; seqIndex < LOG_SEQUENCES.length && !ctrl.cancel; seqIndex++) {
        for (const line of LOG_SEQUENCES[seqIndex]!) {
          if (ctrl.cancel) return;

          // Type out character by character
          for (let i = 0; i <= line.text.length; i++) {
            if (ctrl.cancel) return;
            setCurrentLine({ text: line.text.slice(0, i), type: line.type });
            await sleep(TYPE_SPEED);
          }

          // Commit the finished line
          setCurrentLine(null);
          setLines((prev) => [...prev, line]);
          await sleep(LINE_PAUSE);
        }

        if (seqIndex < LOG_SEQUENCES.length - 1) {
          setLines((prev) => [...prev, { text: '', type: 'dim' }]);
          await sleep(SEQUENCE_PAUSE);
        }
      }
    }

    runAnimation().catch(() => {});

    return () => {
      ctrl.cancel = true;
    };
  }, [isVisible]);

  // Auto-scroll to bottom
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [lines, currentLine]);

  return (
    <div ref={containerRef} className="max-w-3xl mx-auto">
      <div className="rounded-xl border border-border bg-ctp-crust overflow-hidden shadow-2xl shadow-primary/5">
        {/* Title bar */}
        <div className="flex items-center gap-2 px-4 py-2.5 bg-ctp-mantle border-b border-border">
          <div className="flex gap-1.5">
            <div className="w-3 h-3 rounded-full bg-ctp-red/70" />
            <div className="w-3 h-3 rounded-full bg-ctp-yellow/70" />
            <div className="w-3 h-3 rounded-full bg-ctp-green/70" />
          </div>
          <span className="text-xs text-muted-foreground font-mono ml-2">ai-board — workflow</span>
        </div>

        {/* Terminal content */}
        <div
          ref={scrollRef}
          className="p-4 font-mono text-sm leading-relaxed h-[260px] overflow-y-auto scrollbar-thin"
        >
          {lines.map((line, i) => (
            <div key={i} className={`${typeColorClass(line.type)} ${line.text === '' ? 'h-4' : ''}`}>
              {line.text}
            </div>
          ))}
          {currentLine && (
            <div className={typeColorClass(currentLine.type)}>
              {currentLine.text}
              <span className="inline-block w-[7px] h-[14px] bg-primary/80 align-middle ml-0.5 animate-blink" aria-hidden="true" />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
