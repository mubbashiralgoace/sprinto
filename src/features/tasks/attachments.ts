import { TASK_ATTACHMENTS_BUCKET } from '@/config/db';
import { supabaseBrowser } from '@/lib/supabase-browser';

const sanitizeFileName = (name: string) => name.replace(/\s+/g, '-').replace(/[^a-zA-Z0-9._-]/g, '');

export const uploadTaskAttachments = async ({
  files,
  workspaceId,
  projectId,
}: {
  files: File[];
  workspaceId: string;
  projectId: string;
}) => {
  if (files.length === 0) return [] as string[];

  const uploads = await Promise.all(
    files.map(async (file) => {
      const safeName = sanitizeFileName(file.name || 'attachment');
      const path = `tasks/${workspaceId}/${projectId}/${crypto.randomUUID()}-${safeName}`;

      const { error } = await supabaseBrowser.storage.from(TASK_ATTACHMENTS_BUCKET).upload(path, file, {
        upsert: false,
        contentType: file.type || undefined,
      });

      if (error) throw error;

      const { data } = supabaseBrowser.storage.from(TASK_ATTACHMENTS_BUCKET).getPublicUrl(path);
      return data.publicUrl;
    }),
  );

  return uploads;
};

export const uploadTaskCommentAttachments = async ({
  files,
  workspaceId,
  taskId,
}: {
  files: File[];
  workspaceId: string;
  taskId: string;
}) => {
  if (files.length === 0) return [] as string[];

  const uploads = await Promise.all(
    files.map(async (file) => {
      const safeName = sanitizeFileName(file.name || 'attachment');
      const path = `comments/${workspaceId}/${taskId}/${crypto.randomUUID()}-${safeName}`;

      const { error } = await supabaseBrowser.storage.from(TASK_ATTACHMENTS_BUCKET).upload(path, file, {
        upsert: false,
        contentType: file.type || undefined,
      });

      if (error) throw error;

      const { data } = supabaseBrowser.storage.from(TASK_ATTACHMENTS_BUCKET).getPublicUrl(path);
      return data.publicUrl;
    }),
  );

  return uploads;
};
