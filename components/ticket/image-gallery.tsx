'use client';

import { useState } from 'react';
import { ChevronDown, ChevronUp, ImageIcon, Loader2, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useTicketImages } from '@/lib/hooks/use-ticket-images';
import { useImageUpload } from '@/lib/hooks/use-image-mutations';
import { ImageLightbox } from './image-lightbox';
import { ImageUpload, type ImageFile } from '@/components/ui/image-upload';
import { canEdit } from '@/components/ticket/edit-permission-guard';
import type { Stage } from '@prisma/client';

interface ImageGalleryProps {
  /** Project ID for API requests */
  projectId: number;

  /** Ticket ID for API requests */
  ticketId: number;

  /** Current ticket stage (for permission checks) */
  ticketStage: Stage;

  /** Current ticket version (for optimistic concurrency control) */
  ticketVersion: number;

  /** Number of attachments (for badge display before expansion) */
  attachmentCount: number;

  /** Callback when attachments are updated (to refresh parent ticket) */
  onAttachmentsUpdated?: () => void;
}

/**
 * ImageGallery component - Displays ticket images with lazy loading
 *
 * Features:
 * - Collapsible section (collapsed by default)
 * - Image count badge
 * - Lazy loads images only when expanded
 * - Grid layout for thumbnails
 * - Opens lightbox on thumbnail click
 *
 * @example
 * <ImageGallery
 *   projectId={1}
 *   ticketId={123}
 *   ticketStage="SPECIFY"
 *   attachmentCount={3}
 * />
 */
export function ImageGallery({
  projectId,
  ticketId,
  ticketStage,
  ticketVersion,
  attachmentCount,
  onAttachmentsUpdated,
}: ImageGalleryProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [selectedImageIndex, setSelectedImageIndex] = useState<number | null>(null);
  const [pendingImages, setPendingImages] = useState<ImageFile[]>([]);
  const [isUploading, setIsUploading] = useState(false);

  // Lazy load images only when gallery is expanded
  const { data, isLoading, error } = useTicketImages(projectId, ticketId, isExpanded);
  const images = data?.images ?? [];

  // Upload mutation
  const uploadMutation = useImageUpload();

  // Check if user can edit images
  const canEditImages = canEdit(ticketStage, 'images');

  // Handle uploading pending images to server
  const handleUploadImages = async () => {
    if (pendingImages.length === 0) return;

    setIsUploading(true);

    try {
      // Upload images sequentially to avoid race conditions with version
      for (const imageFile of pendingImages) {
        await uploadMutation.mutateAsync({
          projectId,
          ticketId,
          file: imageFile.file,
          version: ticketVersion,
        });
      }

      // Clear pending images after successful upload
      setPendingImages([]);

      // Notify parent to refresh ticket data
      if (onAttachmentsUpdated) {
        onAttachmentsUpdated();
      }
    } catch (error) {
      // Error is already handled by mutation (toast notification)
      console.error('Failed to upload images:', error);
    } finally {
      setIsUploading(false);
    }
  };

  // Don't render section if no images and can't upload
  if (attachmentCount === 0 && !canEditImages) {
    return null;
  }

  return (
    <div className="space-y-3">
      {/* Collapsible Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex items-center gap-2 w-full text-left hover:bg-base/5 rounded-md p-2 -ml-2 transition-colors"
        aria-expanded={isExpanded}
        aria-controls="image-gallery-content"
      >
        {isExpanded ? (
          <ChevronUp className="h-4 w-4 text-text/60" />
        ) : (
          <ChevronDown className="h-4 w-4 text-text/60" />
        )}
        <ImageIcon className="h-4 w-4 text-text/60" />
        <span className="font-medium text-sm text-text">Images</span>
        <Badge variant="secondary" className="ml-auto">
          {attachmentCount}
        </Badge>
      </button>

      {/* Gallery Content */}
      {isExpanded && (
        <div id="image-gallery-content" className="space-y-4">
          {/* Upload Section (only show when user can edit) */}
          {canEditImages && (
            <div className="border border-surface2 rounded-md p-4 bg-mantle">
              <h4 className="text-sm font-medium text-text mb-3">Upload New Images</h4>
              <ImageUpload
                images={pendingImages}
                onImagesChange={setPendingImages}
                maxImages={5 - attachmentCount} // Limit based on existing attachments
                maxFileSize={10 * 1024 * 1024}
                allowedTypes={['image/jpeg', 'image/png', 'image/gif', 'image/webp']}
              />
              {pendingImages.length > 0 && (
                <Button
                  onClick={handleUploadImages}
                  disabled={isUploading}
                  className="mt-3 w-full bg-lavender hover:bg-lavender/90 text-base"
                >
                  {isUploading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      Uploading {pendingImages.length} image(s)...
                    </>
                  ) : (
                    <>
                      <Upload className="h-4 w-4 mr-2" />
                      Upload {pendingImages.length} image(s)
                    </>
                  )}
                </Button>
              )}
            </div>
          )}

          {/* Loading State */}
          {isLoading && (
            <div className="flex items-center justify-center p-8 text-text/60">
              <Loader2 className="h-6 w-6 animate-spin mr-2" />
              <span className="text-sm">Loading images...</span>
            </div>
          )}

          {/* Error State */}
          {error && (
            <div className="p-4 border border-red rounded-md bg-red/10 text-red text-sm">
              <p className="font-medium">Failed to load images</p>
              <p className="text-xs mt-1 text-red/80">{error.message}</p>
            </div>
          )}

          {/* Empty State */}
          {!isLoading && !error && images.length === 0 && !canEditImages && (
            <div className="text-center p-8 text-text/60">
              <ImageIcon className="h-12 w-12 mx-auto mb-2 opacity-40" />
              <p className="text-sm">No images attached</p>
            </div>
          )}

          {/* Image Grid */}
          {!isLoading && !error && images.length > 0 && (
            <div>
              <h4 className="text-sm font-medium text-text mb-3">Attached Images</h4>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                {images.map((image) => (
                  <button
                    key={image.index}
                    onClick={() => setSelectedImageIndex(image.index)}
                    className="group relative aspect-square overflow-hidden rounded-md border border-surface2 hover:border-lavender transition-colors bg-mantle"
                    aria-label={`View ${image.filename}`}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={image.url}
                      alt={image.filename}
                      className="object-cover w-full h-full group-hover:scale-105 transition-transform duration-200"
                    />

                    {/* Overlay with filename */}
                    <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-crust/90 to-transparent p-2">
                      <p className="text-xs text-text truncate">{image.filename}</p>
                      <p className="text-xs text-subtext0">
                        {(image.sizeBytes / 1024).toFixed(1)} KB
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Image Lightbox */}
      <ImageLightbox
        images={images}
        initialIndex={selectedImageIndex ?? 0}
        open={selectedImageIndex !== null}
        onOpenChange={(open) => {
          if (!open) setSelectedImageIndex(null);
        }}
      />
    </div>
  );
}
