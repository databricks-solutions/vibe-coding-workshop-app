/**
 * ImageGallery Component
 * 
 * Displays a horizontal strip of image thumbnails with:
 * - Click to open lightbox modal
 * - Left/right navigation in lightbox
 * - Upload button (config mode only)
 * - Delete button per image (config mode only)
 * - Keyboard navigation (arrow keys, ESC)
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { X, ChevronLeft, ChevronRight, Plus, Trash2, Loader2, Image as ImageIcon } from 'lucide-react';
import type { ImageMetadata } from '../api/client';

interface ImageGalleryProps {
  images: ImageMetadata[] | null | undefined;
  /** Whether to show upload/delete controls (for config mode) */
  editable?: boolean;
  /** Callback when an image is uploaded */
  onUpload?: (file: File) => Promise<void>;
  /** Callback when an image is deleted */
  onDelete?: (imageId: string) => Promise<void>;
  /** Maximum number of images allowed */
  maxImages?: number;
  /** Loading state during upload/delete */
  isLoading?: boolean;
  /** Color theme for styling */
  color?: 'emerald' | 'amber' | 'blue';
}

export function ImageGallery({
  images: imagesProp,
  editable = false,
  onUpload,
  onDelete,
  maxImages = 5,
  isLoading = false,
  color = 'emerald',
}: ImageGalleryProps) {
  // Ensure images is always an array (guard against null/undefined)
  const images = Array.isArray(imagesProp) ? imagesProp : [];
  
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Color classes based on theme
  const colorClasses = {
    emerald: {
      border: 'border-emerald-500/30',
      hoverBorder: 'hover:border-emerald-500/60',
      bg: 'bg-emerald-500/10',
      text: 'text-emerald-400',
      button: 'bg-emerald-600 hover:bg-emerald-500',
    },
    amber: {
      border: 'border-amber-500/30',
      hoverBorder: 'hover:border-amber-500/60',
      bg: 'bg-amber-500/10',
      text: 'text-amber-400',
      button: 'bg-amber-600 hover:bg-amber-500',
    },
    blue: {
      border: 'border-blue-500/30',
      hoverBorder: 'hover:border-blue-500/60',
      bg: 'bg-blue-500/10',
      text: 'text-blue-400',
      button: 'bg-blue-600 hover:bg-blue-500',
    },
  };

  const colors = colorClasses[color];

  // Handle file selection
  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !onUpload) return;

    // Reset input
    e.target.value = '';

    // Validate file type
    const allowedTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/gif', 'image/webp', 'image/svg+xml'];
    if (!allowedTypes.includes(file.type)) {
      alert('Invalid file type. Allowed: PNG, JPG, GIF, WebP, SVG');
      return;
    }

    // Validate file size (10MB)
    if (file.size > 10 * 1024 * 1024) {
      alert('File too large. Maximum size: 10MB');
      return;
    }

    setUploading(true);
    try {
      await onUpload(file);
    } catch (error) {
      console.error('Upload failed:', error);
      alert(error instanceof Error ? error.message : 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  // Handle delete
  const handleDelete = async (imageId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!onDelete) return;

    if (!confirm('Delete this image?')) return;

    setDeletingId(imageId);
    try {
      await onDelete(imageId);
    } catch (error) {
      console.error('Delete failed:', error);
      alert(error instanceof Error ? error.message : 'Delete failed');
    } finally {
      setDeletingId(null);
    }
  };

  // Navigate lightbox
  const goToPrevious = useCallback(() => {
    setCurrentIndex((i) => (i > 0 ? i - 1 : images.length - 1));
  }, [images.length]);

  const goToNext = useCallback(() => {
    setCurrentIndex((i) => (i < images.length - 1 ? i + 1 : 0));
  }, [images.length]);

  // Keyboard navigation
  useEffect(() => {
    if (!lightboxOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'Escape':
          setLightboxOpen(false);
          break;
        case 'ArrowLeft':
          goToPrevious();
          break;
        case 'ArrowRight':
          goToNext();
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [lightboxOpen, goToPrevious, goToNext]);

  // Open lightbox at specific index
  const openLightbox = (index: number) => {
    setCurrentIndex(index);
    setLightboxOpen(true);
  };

  // Don't render anything if no images and not editable
  if (images.length === 0 && !editable) {
    return null;
  }

  const canUpload = editable && images.length < maxImages && !uploading && !isLoading;

  return (
    <>
      {/* Screenshot Section */}
      <div className={`mb-4 p-3 rounded-lg border ${colors.border} ${colors.bg}`}>
        {/* Header - always visible when there are images or in edit mode */}
        <div className="flex items-center gap-2 mb-3">
          <div className={`flex items-center gap-2 px-2.5 py-1 rounded-md ${colors.bg} border ${colors.border}`}>
            <ImageIcon className={`w-4 h-4 ${colors.text}`} />
            <span className={`text-[12px] font-semibold ${colors.text} uppercase tracking-wide`}>
              📸 Reference Screenshots
            </span>
          </div>
          {images.length > 0 && (
            <span className="text-[11px] text-muted-foreground">
              ({images.length} image{images.length !== 1 ? 's' : ''} - click to enlarge)
            </span>
          )}
        </div>
        
        {/* Thumbnail Grid */}
        <div className="flex items-start gap-3 flex-wrap">
          {images.map((image, index) => (
            <div
              key={image.id}
              className={`relative group cursor-pointer rounded-lg overflow-hidden border-2 ${colors.border} ${colors.hoverBorder} transition-all hover:scale-[1.02] shadow-md hover:shadow-lg`}
              style={{ width: 160, height: 120 }}
              onClick={() => openLightbox(index)}
            >
              <img
                src={`/${image.path}`}
                alt={image.filename}
                className="w-full h-full object-cover"
                loading="lazy"
              />
              
              {/* Hover overlay with "Click to view" */}
              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                <span className="text-white text-[11px] font-medium">Click to view</span>
              </div>
              
              {/* Delete button overlay */}
              {editable && onDelete && (
                <button
                  onClick={(e) => handleDelete(image.id, e)}
                  disabled={deletingId === image.id}
                  className="absolute top-1 right-1 p-1.5 bg-red-600/90 hover:bg-red-500 rounded opacity-0 group-hover:opacity-100 transition-opacity z-10"
                  title="Delete image"
                >
                  {deletingId === image.id ? (
                    <Loader2 className="w-3.5 h-3.5 text-white animate-spin" />
                  ) : (
                    <Trash2 className="w-3.5 h-3.5 text-white" />
                  )}
                </button>
              )}
            </div>
          ))}

          {/* Upload button */}
          {canUpload && (
            <button
              onClick={() => fileInputRef.current?.click()}
              className={`flex flex-col items-center justify-center rounded-lg border-2 border-dashed ${colors.border} ${colors.hoverBorder} ${colors.bg} transition-all hover:scale-[1.02]`}
              style={{ width: 160, height: 120 }}
              title="Upload image"
            >
              {uploading ? (
                <Loader2 className={`w-6 h-6 ${colors.text} animate-spin`} />
              ) : (
                <>
                  <Plus className={`w-6 h-6 ${colors.text}`} />
                  <span className={`text-[11px] ${colors.text} mt-1 font-medium`}>Add Screenshot</span>
                </>
              )}
            </button>
          )}

          {/* Hidden file input */}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/png,image/jpeg,image/jpg,image/gif,image/webp,image/svg+xml"
            onChange={handleFileSelect}
            className="hidden"
          />

          {/* Max images reached indicator */}
          {editable && images.length >= maxImages && (
            <span className="text-[11px] text-muted-foreground ml-2 self-center">
              Max {maxImages} images
            </span>
          )}
        </div>
      </div>

      {/* Lightbox Modal */}
      {lightboxOpen && images.length > 0 && createPortal(
        <div
          className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/90 backdrop-blur-sm"
          onClick={() => setLightboxOpen(false)}
        >
          {/* Close button */}
          <button
            onClick={() => setLightboxOpen(false)}
            className="absolute top-4 right-4 p-2 bg-white/10 hover:bg-white/20 rounded-full transition-colors"
            title="Close (ESC)"
          >
            <X className="w-6 h-6 text-white" />
          </button>

          {/* Image counter */}
          <div className="absolute top-4 left-4 px-3 py-1.5 bg-black/50 rounded-full text-white text-sm">
            {currentIndex + 1} / {images.length}
          </div>

          {/* Previous button */}
          {images.length > 1 && (
            <button
              onClick={(e) => { e.stopPropagation(); goToPrevious(); }}
              className="absolute left-4 p-3 bg-white/10 hover:bg-white/20 rounded-full transition-colors"
              title="Previous (←)"
            >
              <ChevronLeft className="w-8 h-8 text-white" />
            </button>
          )}

          {/* Main image */}
          <div
            className="max-w-[90vw] max-h-[85vh] flex items-center justify-center"
            onClick={(e) => e.stopPropagation()}
          >
            <img
              src={`/${images[currentIndex].path}`}
              alt={images[currentIndex].filename}
              className="max-w-full max-h-[85vh] object-contain rounded-lg shadow-2xl"
            />
          </div>

          {/* Next button */}
          {images.length > 1 && (
            <button
              onClick={(e) => { e.stopPropagation(); goToNext(); }}
              className="absolute right-4 p-3 bg-white/10 hover:bg-white/20 rounded-full transition-colors"
              title="Next (→)"
            >
              <ChevronRight className="w-8 h-8 text-white" />
            </button>
          )}

          {/* Filename */}
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 px-4 py-2 bg-black/50 rounded-full text-white text-sm max-w-[80vw] truncate">
            {images[currentIndex].filename}
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
