'use client';

import { useState, useEffect, useCallback } from 'react';
import { X, ChevronLeft, ChevronRight, ZoomIn, Maximize } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { VisuallyHidden } from '@radix-ui/react-visually-hidden';
import type { TicketImageWithIndex } from '@/lib/hooks/use-ticket-images';

interface ImageLightboxProps {
  /** Array of images to display */
  images: TicketImageWithIndex[];

  /** Index of initially selected image */
  initialIndex: number;

  /** Whether lightbox is open */
  open: boolean;

  /** Callback when lightbox open state changes */
  onOpenChange: (open: boolean) => void;
}

/**
 * Zoom levels for image viewer
 */
type ZoomLevel = 'fit' | 100 | 200;

/**
 * ImageLightbox component - Full-size image viewer with navigation and zoom
 *
 * Features:
 * - Full-size image display
 * - Previous/Next navigation (keyboard: arrow keys)
 * - Zoom controls (Fit to screen, 100%, 200%)
 * - Close on ESC key or click outside
 * - Displays image metadata (filename, size, upload date)
 *
 * Built with shadcn/ui Dialog for accessibility and keyboard navigation.
 *
 * @example
 * <ImageLightbox
 *   images={images}
 *   initialIndex={0}
 *   open={isOpen}
 *   onOpenChange={setIsOpen}
 * />
 */
export function ImageLightbox({ images, initialIndex, open, onOpenChange }: ImageLightboxProps) {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [zoomLevel, setZoomLevel] = useState<ZoomLevel>('fit');

  // Navigation functions (stable references via useCallback)
  const handlePrevious = useCallback(() => {
    setCurrentIndex((prev) => (prev > 0 ? prev - 1 : images.length - 1));
    setZoomLevel('fit'); // Reset zoom on navigation
  }, [images.length]);

  const handleNext = useCallback(() => {
    setCurrentIndex((prev) => (prev < images.length - 1 ? prev + 1 : 0));
    setZoomLevel('fit'); // Reset zoom on navigation
  }, [images.length]);

  // Reset zoom level when opening lightbox
  useEffect(() => {
    if (open) {
      setZoomLevel('fit');
      setCurrentIndex(initialIndex);
    }
  }, [open, initialIndex]);

  // Keyboard navigation (arrow keys)
  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'ArrowLeft') {
        handlePrevious();
      } else if (event.key === 'ArrowRight') {
        handleNext();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, handlePrevious, handleNext]);

  const currentImage = images[currentIndex];

  // Don't render if no images
  if (!currentImage) {
    return null;
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[95vw] max-h-[95vh] p-0 bg-crust border-surface2">
        {/* Accessibility labels */}
        <VisuallyHidden>
          <DialogTitle>Image Viewer</DialogTitle>
          <DialogDescription>
            Viewing {currentImage.filename} ({currentIndex + 1} of {images.length})
          </DialogDescription>
        </VisuallyHidden>

        {/* Header with metadata */}
        <div className="flex items-center justify-between p-4 border-b border-surface2 bg-mantle">
          <div className="flex-1 min-w-0">
            <p className="font-medium text-sm text-text truncate">{currentImage.filename}</p>
            <p className="text-xs text-subtext0">
              {(currentImage.sizeBytes / 1024).toFixed(1)} KB •{' '}
              {new Date(currentImage.uploadedAt).toLocaleDateString()} •{' '}
              {currentIndex + 1} of {images.length}
            </p>
          </div>

          {/* Zoom Controls */}
          <div className="flex items-center gap-2 ml-4">
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setZoomLevel('fit')}
              className={zoomLevel === 'fit' ? 'bg-surface0' : ''}
              title="Fit to screen"
            >
              <Maximize className="h-4 w-4" />
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setZoomLevel(100)}
              className={zoomLevel === 100 ? 'bg-surface0' : ''}
              title="100%"
            >
              100%
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setZoomLevel(200)}
              className={zoomLevel === 200 ? 'bg-surface0' : ''}
              title="200%"
            >
              <ZoomIn className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Image Container */}
        <div className="relative flex-1 overflow-auto bg-base">
          <div className="flex items-center justify-center min-h-[60vh] p-4">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={currentImage.url}
              alt={currentImage.filename}
              className={`max-w-full ${
                zoomLevel === 'fit'
                  ? 'max-h-[70vh] object-contain'
                  : zoomLevel === 100
                  ? 'w-auto'
                  : 'w-auto scale-200'
              }`}
              style={
                zoomLevel === 200
                  ? { transform: 'scale(2)', transformOrigin: 'center center' }
                  : undefined
              }
            />
          </div>
        </div>

        {/* Navigation Footer */}
        {images.length > 1 && (
          <div className="flex items-center justify-center gap-4 p-4 border-t border-surface2 bg-mantle">
            <Button
              variant="outline"
              size="sm"
              onClick={handlePrevious}
              disabled={false} // Allow wrapping to last image
              title="Previous (Left arrow)"
            >
              <ChevronLeft className="h-4 w-4 mr-1" />
              Previous
            </Button>

            <span className="text-sm text-subtext0">
              {currentIndex + 1} / {images.length}
            </span>

            <Button
              variant="outline"
              size="sm"
              onClick={handleNext}
              disabled={false} // Allow wrapping to first image
              title="Next (Right arrow)"
            >
              Next
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </div>
        )}

        {/* Close Button (absolute positioned in top-right) */}
        <Button
          variant="ghost"
          size="icon"
          onClick={() => onOpenChange(false)}
          className="absolute top-4 right-4 bg-mantle/90 hover:bg-surface0"
          title="Close (ESC)"
        >
          <X className="h-4 w-4" />
        </Button>
      </DialogContent>
    </Dialog>
  );
}
