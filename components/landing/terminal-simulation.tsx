'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
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

export function TerminalSimulation() {
  const containerRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const isVisible = useIntersectionObserver(containerRef, { threshold: 0.3 });
  const [lines, setLines] = useState<{ text: string; type: LogLine['type'] }[]>([]);
  const [currentText, setCurrentText] = useState('');
  const [currentType, setCurrentType] = useState<LogLine['type']>('info');
  const [isTyping, setIsTyping] = useState(false);
  const hasStarted = useRef(false);
  const animationRef = useRef<{ cancel: boolean }>({ cancel: false });

  const sleep = useCallback((ms: number) => {
    return new Promise<void>((resolve) => {
      setTimeout(resolve, ms);
    });
  }, []);

  useEffect(() => {
    if (!isVisible || hasStarted.current) return;
    hasStarted.current = true;

    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReduced) {
      // Show all lines immediately
      const allLines = LOG_SEQUENCES.flat().map((l) => ({ text: l.text, type: l.type }));
      setLines(allLines);
      return;
    }

    const ctrl = animationRef.current;
    ctrl.cancel = false;

    async function runAnimation() {
      let seqIndex = 0;
      // Loop through all sequences once
      while (seqIndex < LOG_SEQUENCES.length && !ctrl.cancel) {
        const sequence = LOG_SEQUENCES[seqIndex];
        if (!sequence) break;

        for (const line of sequence) {
          if (ctrl.cancel) return;

          setCurrentType(line.type);
          setIsTyping(true);

          // Type out character by character
          for (let i = 0; i <= line.text.length; i++) {
            if (ctrl.cancel) return;
            setCurrentText(line.text.slice(0, i));
            await sleep(TYPE_SPEED);
          }

          setIsTyping(false);
          // Commit the finished line
          setLines((prev) => [...prev, { text: line.text, type: line.type }]);
          setCurrentText('');
          await sleep(LINE_PAUSE);
        }

        seqIndex++;
        if (seqIndex < LOG_SEQUENCES.length) {
          // Add blank line between sequences
          setLines((prev) => [...prev, { text: '', type: 'dim' }]);
          await sleep(SEQUENCE_PAUSE);
        }
      }
    }

    runAnimation();

    return () => {
      ctrl.cancel = true;
    };
  }, [isVisible, sleep]);

  // Auto-scroll to bottom
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [lines, currentText]);

  const typeColorClass = (type: LogLine['type']) => {
    switch (type) {
      case 'command': return 'text-ctp-mauve';
      case 'success': return 'text-ctp-green';
      case 'dim': return 'text-muted-foreground/70';
      case 'info':
      default: return 'text-foreground/90';
    }
  };

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
          {/* Currently typing line */}
          {isTyping && currentText && (
            <div className={typeColorClass(currentType)}>
              {currentText}
              <span className="inline-block w-[7px] h-[14px] bg-primary/80 align-middle ml-0.5 animate-blink" aria-hidden="true" />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
