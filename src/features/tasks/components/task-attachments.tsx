import { useMemo, useState } from 'react';

import { ImageLightbox } from '@/components/image-lightbox';
import type { Task } from '@/features/tasks/types';

interface TaskAttachmentsProps {
  task: Task;
}

const isImage = (url: string) => /\.(png|jpe?g|gif|webp|bmp|svg)(\?.*)?$/i.test(url);
const isVideo = (url: string) => /\.(mp4|webm|ogg|mov|m4v)(\?.*)?$/i.test(url);

export const TaskAttachments = ({ task }: TaskAttachmentsProps) => {
  const [lightboxState, setLightboxState] = useState<{ images: string[]; index: number } | null>(null);
  const imageAttachments = useMemo(() => (task.attachments ?? []).filter((url) => isImage(url)), [task.attachments]);
  const videoAttachments = useMemo(() => (task.attachments ?? []).filter((url) => isVideo(url)), [task.attachments]);
  const otherAttachments = useMemo(
    () => (task.attachments ?? []).filter((url) => !isImage(url) && !isVideo(url)),
    [task.attachments],
  );

  const renderAttachmentPreview = (url: string, sizeClassName = 'h-36') => {
    if (isImage(url)) {
      const index = imageAttachments.indexOf(url);
      return (
        <button
          type="button"
          className="group relative w-full cursor-zoom-in"
          onClick={() => setLightboxState({ images: imageAttachments, index: Math.max(index, 0) })}
          aria-label="Open image preview"
        >
          <img src={url} alt="Attachment" className={`${sizeClassName} w-full object-cover`} />
          <span className="pointer-events-none absolute inset-0 bg-black/0 transition group-hover:bg-black/10" />
        </button>
      );
    }

    if (isVideo(url)) {
      return (
        <video className={`${sizeClassName} w-full object-cover`} controls preload="metadata">
          <source src={url} />
        </video>
      );
    }

    return (
      <a href={url} target="_blank" rel="noreferrer" className="block truncate text-xs text-blue-600 hover:underline">
        {url}
      </a>
    );
  };

  return (
    <div className="rounded-lg border p-4">
      <div className="flex items-center justify-between">
        <p className="text-lg font-semibold">Attachments</p>
      </div>

      <div className="mt-4">
        {imageAttachments.length === 0 && videoAttachments.length === 0 && otherAttachments.length === 0 ? (
          <p className="text-sm italic text-neutral-400">No attachments yet.</p>
        ) : (
          <div className="space-y-3">
            {(imageAttachments.length > 0 || videoAttachments.length > 0) && (
              <div className="grid gap-3 sm:grid-cols-2">
                {[...imageAttachments, ...videoAttachments].map((url) => (
                  <div key={url} className="overflow-hidden rounded-md border border-neutral-200">
                    {renderAttachmentPreview(url, 'h-40')}
                  </div>
                ))}
              </div>
            )}

            {otherAttachments.length > 0 && (
              <div className="space-y-2">
                {otherAttachments.map((url) => (
                  <div key={url} className="rounded-md border border-neutral-200 p-2">
                    {renderAttachmentPreview(url, 'h-28')}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      <ImageLightbox
        images={lightboxState?.images ?? []}
        startIndex={lightboxState?.index ?? 0}
        open={!!lightboxState}
        onClose={() => setLightboxState(null)}
      />
    </div>
  );
};
