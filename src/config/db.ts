export const MEMBERS_TABLE = 'members';
export const PROJECTS_TABLE = 'projects';
export const TASKS_TABLE = 'tasks';
export const TASK_COMMENTS_TABLE = 'task_comments';
export const TASK_HISTORY_TABLE = 'task_history';
export const NOTIFICATIONS_TABLE = 'notifications';
export const WORKSPACES_TABLE = 'workspaces';

export const IMAGES_BUCKET = process.env.NEXT_PUBLIC_SUPABASE_IMAGES_BUCKET ?? 'images';
export const TASK_ATTACHMENTS_BUCKET = process.env.NEXT_PUBLIC_SUPABASE_TASK_ATTACHMENTS_BUCKET ?? 'task-attachments';
