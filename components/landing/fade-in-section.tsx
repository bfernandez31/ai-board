'use client';

import { useRef, type ReactNode } from 'react';
import { useIntersectionObserver } from '@/lib/hooks/use-intersection-observer';

interface FadeInSectionProps {
  children: ReactNode;
  className?: string;
}

export function FadeInSection({ children, className = '' }: FadeInSectionProps) {
  const ref = useRef<HTMLDivElement>(null);
  const isVisible = useIntersectionObserver(ref, { threshold: 0.1 });

  return (
    <div
      ref={ref}
      className={`landing-fade-in ${isVisible ? 'visible' : ''} ${className}`}
    >
      {children}
    </div>
  );
}
