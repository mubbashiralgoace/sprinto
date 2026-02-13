'use client';

import { ChevronLeft, ChevronRight, Download, Minus, Plus, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

import { cn } from '@/lib/utils';

interface ImageLightboxProps {
  images: string[];
  startIndex?: number;
  open: boolean;
  onClose: () => void;
}

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);
const MIN_SCALE = 0;
const MAX_SCALE = 1;
const SCALE_STEP = 0.1;

const getFileName = (src: string) => {
  const clean = src.split('?')[0] ?? '';
  const name = clean.split('/').pop() ?? 'image';
  try {
    return decodeURIComponent(name);
  } catch {
    return name;
  }
};

const getFileType = (src: string) => {
  const name = getFileName(src);
  const ext = name.split('.').pop();
  if (!ext || ext === name) return 'image';
  return `${ext.toUpperCase()} image`;
};

export const ImageLightbox = ({ images, startIndex = 0, open, onClose }: ImageLightboxProps) => {
  const [currentIndex, setCurrentIndex] = useState(startIndex);
  const [scale, setScale] = useState(1);

  const currentImage = images[currentIndex];
  const hasMultiple = images.length > 1;

  useEffect(() => {
    if (!open) return;
    setCurrentIndex(startIndex);
    setScale(1);
  }, [open, startIndex]);

  useEffect(() => {
    if (!open) return;

    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
      if (event.key === 'ArrowLeft') setCurrentIndex((prev) => (prev - 1 + images.length) % images.length);
      if (event.key === 'ArrowRight') setCurrentIndex((prev) => (prev + 1) % images.length);
    };

    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [open, images.length, onClose]);

  const meta = useMemo(() => {
    if (!currentImage) return { name: 'image', type: 'image' };
    return {
      name: getFileName(currentImage),
      type: getFileType(currentImage),
    };
  }, [currentImage]);

  if (!open || !currentImage) return null;

  const isMinScale = scale <= MIN_SCALE;
  const isMaxScale = scale >= MAX_SCALE;
  const scaleClass = isMaxScale ? 'scale-100' : isMinScale ? 'scale-0' : 'scale-90';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-6" onClick={onClose}>
      <div className="relative flex h-full w-full max-w-6xl flex-col" onClick={(event) => event.stopPropagation()}>
        <div className="flex items-start justify-between text-white">
          <div className="flex flex-col text-sm">
            <span className="font-medium">{meta.name}</span>
            <span className="text-xs text-white/70">{meta.type}</span>
          </div>

          <div className="flex items-center gap-x-2">
            <a
              href={currentImage}
              download
              className="rounded-full bg-black/60 p-2 text-white transition hover:bg-black"
              aria-label="Download image"
            >
              <Download className="size-4" />
            </a>
            <button
              type="button"
              onClick={onClose}
              className="rounded-full bg-black/60 p-2 text-white transition hover:bg-black"
              aria-label="Close preview"
            >
              <X className="size-4" />
            </button>
          </div>
        </div>

        <div className="relative flex flex-1 items-center justify-center">
          {hasMultiple && (
            <button
              type="button"
              onClick={() => setCurrentIndex((prev) => (prev - 1 + images.length) % images.length)}
              className="absolute left-0 rounded-full bg-black/60 p-2 text-white transition hover:bg-black"
              aria-label="Previous image"
            >
              <ChevronLeft className="size-4" />
            </button>
          )}

          <img
            src={currentImage}
            alt={meta.name}
            className={cn('max-h-[80vh] w-full rounded-md object-contain transition-transform', scaleClass)}
          />

          {hasMultiple && (
            <button
              type="button"
              onClick={() => setCurrentIndex((prev) => (prev + 1) % images.length)}
              className="absolute right-0 rounded-full bg-black/60 p-2 text-white transition hover:bg-black"
              aria-label="Next image"
            >
              <ChevronRight className="size-4" />
            </button>
          )}
        </div>

        <div className="flex items-center justify-center gap-x-3 pb-2 pt-4 text-white">
          <button
            type="button"
            onClick={() => setScale((prev) => clamp(prev - SCALE_STEP, MIN_SCALE, MAX_SCALE))}
            className={cn(
              'rounded-full bg-black/60 p-2 text-white transition hover:bg-black',
              isMinScale && 'cursor-not-allowed opacity-40 hover:bg-black/60',
            )}
            aria-label="Zoom out"
            disabled={isMinScale}
          >
            <Minus className="size-4" />
          </button>
          <span className="text-xs text-white/80">{Math.round(scale * 100)}%</span>
          <button
            type="button"
            onClick={() => setScale((prev) => clamp(prev + SCALE_STEP, MIN_SCALE, MAX_SCALE))}
            className={cn(
              'rounded-full bg-black/60 p-2 text-white transition hover:bg-black',
              isMaxScale && 'cursor-not-allowed opacity-40 hover:bg-black/60',
            )}
            aria-label="Zoom in"
            disabled={isMaxScale}
          >
            <Plus className="size-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
