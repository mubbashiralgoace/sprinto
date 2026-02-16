import { Bookmark, Bug, CheckSquare, Code2, StickyNote } from 'lucide-react';
import type { ElementType } from 'react';

import { TaskWorkType } from '@/features/tasks/types';
import { cn } from '@/lib/utils';

const workTypeIconMap: Record<TaskWorkType, ElementType> = {
  [TaskWorkType.SUGGESTION]: StickyNote,
  [TaskWorkType.TASK]: CheckSquare,
  [TaskWorkType.BUG]: Bug,
  [TaskWorkType.STORY]: Bookmark,
  [TaskWorkType.IMPROVEMENT]: Code2,
};

const workTypeIconClassMap: Record<TaskWorkType, string> = {
  [TaskWorkType.SUGGESTION]: 'text-purple-500',
  [TaskWorkType.TASK]: 'text-blue-500',
  [TaskWorkType.BUG]: 'text-red-500',
  [TaskWorkType.STORY]: 'text-green-500',
  [TaskWorkType.IMPROVEMENT]: 'text-sky-500',
};

interface WorkTypeIconProps {
  type: TaskWorkType;
  className?: string;
}

export const WorkTypeIcon = ({ type, className }: WorkTypeIconProps) => {
  const Icon = workTypeIconMap[type];

  return <Icon className={cn('size-4 shrink-0', workTypeIconClassMap[type], className)} />;
};
