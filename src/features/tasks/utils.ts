import type { Task } from '@/features/tasks/types';

export const formatTaskTitle = (task: Pick<Task, 'name' | 'summary'>) => {
  const summary = task.summary?.trim();

  return summary ? `${task.name} ${summary}` : task.name;
};
