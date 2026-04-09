'use client';

import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';

// TODO: Update after Cloudinary upload
const VIDEO_URL = '/videos/ai-board-demo';

export function VideoSection() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(true);

  useEffect(() => {
    const video = videoRef.current;
    const container = containerRef.current;
    if (!video || !container) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (entry?.isIntersecting) {
          video.play().catch(() => {
            // Autoplay blocked — user needs to interact
          });
        } else {
          video.pause();
        }
      },
      { threshold: 0.4 }
    );

    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  const togglePlay = () => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) {
      video.play();
    } else {
      video.pause();
    }
  };

  const toggleMute = () => {
    const video = videoRef.current;
    if (!video) return;
    video.muted = !video.muted;
    setIsMuted(video.muted);
  };

  return (
    <section
      id="demo"
      className="scroll-mt-20 py-16 md:py-24"
      aria-label="Product demo video"
    >
      <div className="container mx-auto max-w-5xl px-4">
        <div className="mb-8 text-center">
          <h2 className="text-2xl font-bold text-foreground md:text-3xl">
            See it in action
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            From ticket to production in under a minute
          </p>
        </div>

        <div
          ref={containerRef}
          className="group relative overflow-hidden rounded-2xl border border-border shadow-[0_0_40px_hsl(var(--ctp-mauve)/0.12)]"
        >
          <video
            ref={videoRef}
            className="w-full"
            muted
            loop
            playsInline
            preload="metadata"
            onPlay={() => setIsPlaying(true)}
            onPause={() => setIsPlaying(false)}
          >
            <source src={`${VIDEO_URL}.mp4`} type="video/mp4" />
          </video>

          {/* Minimal controls overlay */}
          <div className="absolute bottom-4 right-4 flex gap-2 opacity-0 transition-opacity group-hover:opacity-100">
            <Button
              variant="ghost"
              size="sm"
              onClick={togglePlay}
              className="rounded-lg bg-ctp-surface0/80 text-xs text-foreground backdrop-blur-sm hover:bg-ctp-surface1/80"
              aria-label={isPlaying ? 'Pause video' : 'Play video'}
            >
              {isPlaying ? '⏸' : '▶'}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={toggleMute}
              className="rounded-lg bg-ctp-surface0/80 text-xs text-foreground backdrop-blur-sm hover:bg-ctp-surface1/80"
              aria-label={isMuted ? 'Unmute video' : 'Mute video'}
            >
              {isMuted ? '🔇' : '🔊'}
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}
