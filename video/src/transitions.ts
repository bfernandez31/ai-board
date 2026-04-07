import { interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';

export function useZoomIn(delay = 0) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const scale = spring({ frame: frame - delay, fps, config: { damping: 100, stiffness: 200, mass: 0.5 }, durationInFrames: 20 });
  const opacity = interpolate(frame - delay, [0, 10], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  return { scale: interpolate(scale, [0, 1], [0.85, 1]), opacity };
}

export function usePerspectiveShift(delay = 0, direction: 'left' | 'right' = 'left') {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const progress = spring({ frame: frame - delay, fps, config: { damping: 80, stiffness: 150, mass: 0.8 }, durationInFrames: 25 });
  const rotateY = interpolate(progress, [0, 1], [direction === 'left' ? -8 : 8, 0]);
  const translateX = interpolate(progress, [0, 1], [direction === 'left' ? -60 : 60, 0]);
  const opacity = interpolate(progress, [0, 0.3, 1], [0, 1, 1]);
  return { transform: `perspective(1200px) rotateY(${rotateY}deg) translateX(${translateX}px)`, opacity };
}

export function useBlurIn(delay = 0) {
  const frame = useCurrentFrame();
  const blur = interpolate(frame - delay, [0, 18], [12, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  return { filter: `blur(${blur}px)` };
}

export function useStagger(index: number, baseDelay = 0, staggerDelay = 4) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const delay = baseDelay + index * staggerDelay;
  const progress = spring({ frame: frame - delay, fps, config: { damping: 80, stiffness: 200, mass: 0.5 }, durationInFrames: 15 });
  return { opacity: progress, transform: `translateY(${interpolate(progress, [0, 1], [20, 0])}px)` };
}

export function useSlideIn(delay = 0, direction: 'left' | 'right' | 'up' | 'down' = 'left') {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const progress = spring({ frame: frame - delay, fps, config: { damping: 80, stiffness: 180, mass: 0.6 }, durationInFrames: 20 });
  const axis = direction === 'left' || direction === 'right' ? 'X' : 'Y';
  const sign = direction === 'left' || direction === 'up' ? -1 : 1;
  const distance = interpolate(progress, [0, 1], [80 * sign, 0]);
  return { transform: `translate${axis}(${distance}px)`, opacity: progress };
}

export function useCounter(target: number, delay = 0, duration = 30) {
  const frame = useCurrentFrame();
  const value = interpolate(frame - delay, [0, duration], [0, target], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  return Math.round(value);
}
