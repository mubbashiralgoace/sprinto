import type { BaseDocument } from '@/types/db';

export type NotificationType = 'task_assigned' | 'task_created' | 'comment_added' | 'mentioned';

export type Notification = BaseDocument & {
  userId: string;
  workspaceId: string;
  actorId?: string | null;
  taskId?: string | null;
  type: NotificationType;
  title: string;
  body: string;
  link?: string | null;
  metadata?: Record<string, unknown>;
  read_at?: string | null;
};
