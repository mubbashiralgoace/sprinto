"use client";

import {
  ChevronLeft,
  ChevronRight,
  Download,
  Minus,
  Plus,
  X,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";

import { cn } from "@/lib/utils";

interface ImageLightboxProps {
  images: string[];
  startIndex?: number;
  open: boolean;
  onClose: () => void;
}

const clamp = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), max);
const MIN_SCALE = 0.5;
const MAX_SCALE = 3;
const SCALE_STEP = 0.25;

const getFileName = (src: string) => {
  const clean = src.split("?")[0] ?? "";
  const name = clean.split("/").pop() ?? "image";
  try {
    return decodeURIComponent(name);
  } catch {
    return name;
  }
};

const getFileType = (src: string) => {
  const name = getFileName(src);
  const ext = name.split(".").pop();
  if (!ext || ext === name) return "image";
  return `${ext.toUpperCase()} image`;
};

export const ImageLightbox = ({
  images,
  startIndex = 0,
  open,
  onClose,
}: ImageLightboxProps) => {
  const [currentIndex, setCurrentIndex] = useState(startIndex);
  const [scale, setScale] = useState(1);

  const currentImage = images[currentIndex];
  const hasMultiple = images.length > 1;

  useEffect(() => {
    if (!open) return;
    setCurrentIndex(startIndex);
    setScale(1);
  }, [open, startIndex]);

  // Lock body scroll
  useEffect(() => {
    if (!open) return;
    const bodyStyle = document.body.style;
    const htmlStyle = document.documentElement.style;
    const prevBody = bodyStyle.overflow;
    const prevHtml = htmlStyle.overflow;
    bodyStyle.overflow = "hidden";
    htmlStyle.overflow = "hidden";
    return () => {
      bodyStyle.overflow = prevBody;
      htmlStyle.overflow = prevHtml;
    };
  }, [open]);

  // Keyboard shortcuts
  useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft")
        setCurrentIndex((p) => (p - 1 + images.length) % images.length);
      if (e.key === "ArrowRight")
        setCurrentIndex((p) => (p + 1) % images.length);
      if (e.key === "+" || e.key === "=")
        setScale((p) => clamp(p + SCALE_STEP, MIN_SCALE, MAX_SCALE));
      if (e.key === "-")
        setScale((p) => clamp(p - SCALE_STEP, MIN_SCALE, MAX_SCALE));
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [open, images.length, onClose]);

  // Mouse-wheel zoom
  useEffect(() => {
    if (!open) return;
    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      const delta = e.deltaY > 0 ? -SCALE_STEP : SCALE_STEP;
      setScale((p) => clamp(p + delta, MIN_SCALE, MAX_SCALE));
    };
    window.addEventListener("wheel", handleWheel, { passive: false });
    return () => window.removeEventListener("wheel", handleWheel);
  }, [open]);

  const meta = useMemo(() => {
    if (!currentImage) return { name: "image", type: "image" };
    return { name: getFileName(currentImage), type: getFileType(currentImage) };
  }, [currentImage]);

  if (!open || !currentImage || typeof document === "undefined") return null;

  const isMinScale = scale <= MIN_SCALE;
  const isMaxScale = scale >= MAX_SCALE;

  return createPortal(
    /*
     * FIX (Bug 1): e.stopPropagation() on the root div.
     *
     * React portals bubble synthetic events through the React component tree
     * (not the real DOM tree). Without stopPropagation, a click anywhere on
     * the lightbox — including the X / close buttons — would bubble all the
     * way up to ResponsiveModal's backdrop onClick, closing BOTH modals.
     *
     * We handle close ourselves via the backdrop click below, so we stop
     * propagation here to prevent the event reaching the parent modal.
     */
    <div
      className="fixed inset-0 z-[9999] flex flex-col bg-black/90"
      onClick={(e) => {
        e.stopPropagation(); // ← prevents event reaching ResponsiveModal
        onClose();
      }}
    >
      {/* ── Top Bar ── */}
      <div
        className="flex shrink-0 items-center justify-between px-4 py-3 sm:px-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex min-w-0 flex-col">
          <span className="truncate text-sm font-medium text-white">
            {meta.name}
          </span>
          <span className="text-xs text-white/60">{meta.type}</span>
        </div>

        <div className="flex shrink-0 items-center gap-2 pl-4">
          {hasMultiple && (
            <span className="hidden text-xs text-white/60 sm:inline">
              {currentIndex + 1} / {images.length}
            </span>
          )}

          <a
            href={currentImage}
            download
            className="rounded-full bg-white/10 p-2 text-white transition hover:bg-white/25"
            aria-label="Download image"
            onClick={(e) => e.stopPropagation()}
          >
            <Download className="size-4" />
          </a>

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onClose();
            }}
            className="rounded-full bg-white/10 p-2 text-white transition hover:bg-white/25"
            aria-label="Close preview"
          >
            <X className="size-4" />
          </button>
        </div>
      </div>

      {/* ── Image Area ── */}
      <div
        className="relative flex min-h-0 flex-1 items-center justify-center overflow-auto"
        onClick={(e) => {
          e.stopPropagation();
          onClose();
        }}
      >
        {hasMultiple && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setCurrentIndex((p) => (p - 1 + images.length) % images.length);
              setScale(1);
            }}
            className="absolute left-3 z-10 rounded-full bg-black/60 p-2 text-white transition hover:bg-black sm:left-5 sm:p-3"
            aria-label="Previous image"
          >
            <ChevronLeft className="size-5" />
          </button>
        )}

        <img
          src={currentImage}
          alt={meta.name}
          className="max-h-full max-w-full rounded object-contain transition-transform duration-150"
          style={{
            transform: `scale(${scale})`,
            transformOrigin: "center center",
            cursor: scale > 1 ? "zoom-out" : "zoom-in",
          }}
          onClick={(e) => {
            e.stopPropagation();
            setScale((p) => (p > 1 ? 1 : 2));
          }}
          draggable={false}
        />

        {hasMultiple && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setCurrentIndex((p) => (p + 1) % images.length);
              setScale(1);
            }}
            className="absolute right-3 z-10 rounded-full bg-black/60 p-2 text-white transition hover:bg-black sm:right-5 sm:p-3"
            aria-label="Next image"
          >
            <ChevronRight className="size-5" />
          </button>
        )}
      </div>

      {/* ── Zoom Controls ── */}
      <div
        className="flex shrink-0 items-center justify-center gap-3 py-3"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={() =>
            setScale((p) => clamp(p - SCALE_STEP, MIN_SCALE, MAX_SCALE))
          }
          disabled={isMinScale}
          className={cn(
            "rounded-full bg-white/10 p-2 text-white transition hover:bg-white/25",
            isMinScale && "cursor-not-allowed opacity-40 hover:bg-white/10"
          )}
          aria-label="Zoom out"
        >
          <Minus className="size-4" />
        </button>

        <button
          type="button"
          onClick={() => setScale(1)}
          className="min-w-[48px] text-center text-xs text-white/70 transition hover:text-white"
          aria-label="Reset zoom"
        >
          {Math.round(scale * 100)}%
        </button>

        <button
          type="button"
          onClick={() =>
            setScale((p) => clamp(p + SCALE_STEP, MIN_SCALE, MAX_SCALE))
          }
          disabled={isMaxScale}
          className={cn(
            "rounded-full bg-white/10 p-2 text-white transition hover:bg-white/25",
            isMaxScale && "cursor-not-allowed opacity-40 hover:bg-white/10"
          )}
          aria-label="Zoom in"
        >
          <Plus className="size-4" />
        </button>

        {hasMultiple && (
          <span className="ml-4 text-xs text-white/50 sm:hidden">
            {currentIndex + 1} / {images.length}
          </span>
        )}
      </div>
    </div>,
    document.body
  );
};
