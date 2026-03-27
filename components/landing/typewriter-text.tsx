'use client';

import { useState, useEffect } from 'react';

interface TypewriterTextProps {
  text: string;
  className?: string;
  delay?: number;
  speed?: number;
}

export function TypewriterText({
  text,
  className = '',
  delay = 600,
  speed = 80,
}: TypewriterTextProps) {
  const [displayed, setDisplayed] = useState('');
  const [started, setStarted] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    // Check reduced motion preference
    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReduced) {
      requestAnimationFrame(() => {
        setDisplayed(text);
        setStarted(true);
        setDone(true);
      });
      return;
    }

    const startTimer = setTimeout(() => setStarted(true), delay);
    return () => clearTimeout(startTimer);
  }, [delay, text]);

  useEffect(() => {
    if (!started || done) return;

    if (displayed.length >= text.length) {
      requestAnimationFrame(() => setDone(true));
      return;
    }

    const timer = setTimeout(() => {
      setDisplayed(text.slice(0, displayed.length + 1));
    }, speed);
    return () => clearTimeout(timer);
  }, [started, displayed, text, speed, done]);

  return (
    <span className={className}>
      {started ? displayed : '\u00A0'}
      {started && !done && (
        <span
          className="inline-block w-[3px] h-[0.85em] bg-primary align-middle ml-0.5 animate-blink"
          aria-hidden="true"
        />
      )}
    </span>
  );
}
