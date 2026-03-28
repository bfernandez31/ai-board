'use client';

import * as React from 'react';
import Image from 'next/image';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { X, Upload, Image as ImageIcon } from 'lucide-react';

export interface ImageFile {
  file: File;
  preview: string;
}

interface ImageUploadProps {
  /** Current uploaded images */
  images: ImageFile[];
  /** Callback when images are added */
  onImagesChange: (images: ImageFile[]) => void;
  /** Maximum number of images allowed */
  maxImages?: number;
  /** Maximum file size in bytes */
  maxFileSize?: number;
  /** Allowed MIME types */
  allowedTypes?: string[];
  /** Show validation errors */
  error?: string | undefined;
}

/**
 * ImageUpload Component
 *
 * Reusable image upload component with:
 * - Drag-and-drop support
 * - File picker button
 * - Clipboard paste handler
 * - Image previews with remove buttons
 * - Validation (size, type, count)
 *
 * Uses shadcn/ui primitives (Card, Button)
 */
export function ImageUpload({
  images,
  onImagesChange,
  maxImages = 5,
  maxFileSize = 10 * 1024 * 1024, // 10MB
  allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml'],
  error,
}: ImageUploadProps) {
  const [isDragging, setIsDragging] = React.useState(false);
  const [validationError, setValidationError] = React.useState<string | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const dropZoneRef = React.useRef<HTMLDivElement>(null);

  // Validate and add images
  const addImages = React.useCallback(
    (files: File[]) => {
      setValidationError(null);

      // Check max images limit
      if (images.length + files.length > maxImages) {
        setValidationError(`Maximum ${maxImages} images allowed`);
        return;
      }

      const validFiles: ImageFile[] = [];
      let hasError = false;

      for (const file of files) {
        // Check file type
        if (!allowedTypes.includes(file.type)) {
          setValidationError(
            `Invalid file type: ${file.name}. Allowed types: JPEG, PNG, GIF, WebP, SVG`
          );
          hasError = true;
          break;
        }

        // Check file size
        if (file.size > maxFileSize) {
          const maxSizeMB = maxFileSize / (1024 * 1024);
          setValidationError(
            `File too large: ${file.name}. Maximum size: ${maxSizeMB}MB`
          );
          hasError = true;
          break;
        }

        // Create preview URL
        const preview = URL.createObjectURL(file);
        validFiles.push({ file, preview });
      }

      if (!hasError && validFiles.length > 0) {
        onImagesChange([...images, ...validFiles]);
      }
    },
    [images, onImagesChange, maxImages, maxFileSize, allowedTypes]
  );

  // Remove image
  const removeImage = React.useCallback(
    (index: number) => {
      // Revoke object URL to prevent memory leaks
      const imageToRemove = images[index];
      if (imageToRemove) {
        URL.revokeObjectURL(imageToRemove.preview);
      }
      const newImages = images.filter((_, i) => i !== index);
      onImagesChange(newImages);
      setValidationError(null);
    },
    [images, onImagesChange]
  );

  // Drag and drop handlers
  const handleDragEnter = React.useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragOver = React.useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDragLeave = React.useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDrop = React.useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(false);

      const files = Array.from(e.dataTransfer.files);
      addImages(files);
    },
    [addImages]
  );

  // File picker handler
  const handleFileSelect = React.useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(e.target.files || []);
      addImages(files);

      // Reset input so same file can be selected again
      e.target.value = '';
    },
    [addImages]
  );

  // Clipboard paste handler
  React.useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      // Only handle paste when component is in focus tree
      if (!dropZoneRef.current || !document.activeElement || !dropZoneRef.current.contains(document.activeElement)) {
        return;
      }

      if (!e.clipboardData) {
        return;
      }

      const items = Array.from(e.clipboardData.items || []);
      const imageItems = items.filter((item) => item.type.startsWith('image/'));

      if (imageItems.length === 0) {
        return;
      }

      e.preventDefault();

      const files: File[] = [];
      for (const item of imageItems) {
        const file = item.getAsFile();
        if (file) {
          // Generate filename for pasted image
          const timestamp = new Date().toISOString();
          const extension = file.type.split('/')[1] || 'png';
          const renamedFile = new File(
            [file],
            `pasted-image-${timestamp}.${extension}`,
            { type: file.type }
          );
          files.push(renamedFile);
        }
      }

      addImages(files);
    };

    document.addEventListener('paste', handlePaste);
    return () => document.removeEventListener('paste', handlePaste);
  }, [addImages]);

  // Cleanup object URLs on unmount
  React.useEffect(() => {
    return () => {
      images.forEach((img) => URL.revokeObjectURL(img.preview));
    };
  }, [images]);

  const displayError = error || validationError;

  return (
    <div className="space-y-4">
      {/* Drop zone */}
      <div
        ref={dropZoneRef}
        onDragEnter={handleDragEnter}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`
          border-2 border-dashed rounded-lg text-center transition-colors
          ${images.length > 0 ? 'p-3' : 'p-4'}
          ${
            isDragging
              ? 'border-primary bg-primary/10'
              : 'border-muted-foreground/25 hover:border-muted-foreground/50'
          }
          ${images.length >= maxImages ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
        `}
        onClick={() => {
          if (images.length < maxImages) {
            fileInputRef.current?.click();
          }
        }}
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            if (images.length < maxImages) {
              fileInputRef.current?.click();
            }
          }
        }}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept={allowedTypes.join(',')}
          multiple
          onChange={handleFileSelect}
          className="hidden"
          disabled={images.length >= maxImages}
        />

        <div className={`flex ${images.length > 0 ? 'flex-row' : 'flex-col'} items-center gap-2`}>
          <Upload className={`${images.length > 0 ? 'h-5 w-5' : 'h-6 w-6'} text-muted-foreground`} />
          <div className="flex flex-col items-center gap-1">
            <div className="text-sm font-medium">
              {isDragging ? 'Drop images here' : images.length > 0 ? 'Add more images' : 'Drag and drop images here'}
            </div>
            <div className="text-xs text-muted-foreground">
              or click to browse • Max {maxImages} images • {maxFileSize / (1024 * 1024)}MB each
            </div>
            {images.length === 0 && (
              <div className="text-xs text-muted-foreground">
                Tip: You can also paste screenshots (Ctrl+V / Cmd+V)
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Validation error */}
      {displayError && (
        <div className="text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-md p-3">
          {displayError}
        </div>
      )}

      {/* Image previews */}
      {images.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
          {images.map((img, index) => (
            <Card key={img.preview} className="relative group overflow-hidden bg-card">
              <div className="aspect-square relative">
                <Image
                  src={img.preview}
                  alt={img.file.name}
                  fill
                  className="object-cover"
                  unoptimized
                />

                {/* Remove button overlay */}
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/50 transition-colors flex items-center justify-center">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={(e) => {
                      e.stopPropagation();
                      removeImage(index);
                    }}
                    className="opacity-0 group-hover:opacity-100 transition-opacity bg-white/90 hover:bg-white text-black"
                  >
                    <X className="h-4 w-4" />
                    <span className="sr-only">Remove image</span>
                  </Button>
                </div>
              </div>

              {/* Image info */}
              <div className="p-2 bg-muted">
                <div className="text-xs font-medium truncate" title={img.file.name}>
                  {img.file.name}
                </div>
                <div className="text-xs text-muted-foreground">
                  {(img.file.size / 1024).toFixed(1)} KB
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Image count indicator */}
      {images.length > 0 && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <ImageIcon className="h-4 w-4" />
          <span>
            {images.length} / {maxImages} images
          </span>
        </div>
      )}
    </div>
  );
}
