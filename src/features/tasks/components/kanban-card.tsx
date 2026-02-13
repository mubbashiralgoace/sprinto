import { useState } from 'react';

import { MemberAvatar } from '@/features/members/components/member-avatar';
import { type Task, TaskWorkType } from '@/features/tasks/types';

import { TaskDetailsModal } from './task-details-modal';
import { WorkTypeIcon } from './work-type-icon';

interface KanbanCardProps {
  task: Task;
}

export const KanbanCard = ({ task }: KanbanCardProps) => {
  const [open, setOpen] = useState(false);
  const imageAttachment = task.attachments?.find((url) => /\.(png|jpe?g|gif|webp|bmp|svg)(\?.*)?$/i.test(url));

  return (
    <>
      <div
        className="mb-2 cursor-pointer space-y-3 rounded-lg border border-neutral-200 bg-white p-3 shadow-sm transition hover:shadow-md"
        onClick={() => setOpen(true)}
      >
        {imageAttachment && (
          <div className="overflow-hidden rounded-md border border-neutral-200">
            <img src={imageAttachment} alt={task.summary} className="h-28 w-full object-cover" />
          </div>
        )}

        <div className="flex items-start justify-between gap-x-2">
          <div className="flex items-start gap-x-2">
            <p className="line-clamp-2 text-sm font-semibold text-neutral-900">{task.summary}</p>
          </div>
        </div>

        <div className="flex items-center justify-between text-xs text-neutral-600">
          <div className="flex items-center gap-x-2">
            <WorkTypeIcon type={task.workType ?? TaskWorkType.TASK} />
            <span className="text-xs font-medium text-neutral-700">{task.name}</span>
          </div>

          <MemberAvatar name={task.assignee?.name ?? 'User'} fallbackClassName="text-[10px]" />
        </div>
      </div>

      <TaskDetailsModal task={task} open={open} onOpenChangeAction={setOpen} />
    </>
  );
};
