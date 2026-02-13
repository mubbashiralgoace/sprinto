'use client';

import { useEffect, useState } from 'react';

import { Select, SelectContent, SelectItem, SelectTrigger } from '@/components/ui/select';
import { useUpdateTask } from '@/features/tasks/api/use-update-task';
import { TaskWorkType, TASK_WORK_TYPE_LABELS, TASK_WORK_TYPE_ORDER } from '@/features/tasks/types';
import { cn } from '@/lib/utils';

import { WorkTypeIcon } from './work-type-icon';

interface WorkTypeSelectProps {
  taskId: string;
  workType?: TaskWorkType | null;
  triggerClassName?: string;
}

export const WorkTypeSelect = ({ taskId, workType, triggerClassName }: WorkTypeSelectProps) => {
  const { mutate: updateTask, isPending } = useUpdateTask();
  const [currentWorkType, setCurrentWorkType] = useState<TaskWorkType>(workType ?? TaskWorkType.TASK);

  useEffect(() => {
    setCurrentWorkType(workType ?? TaskWorkType.TASK);
  }, [workType]);

  const handleChange = (value: string) => {
    const next = value as TaskWorkType;
    setCurrentWorkType(next);

    if (next === workType) return;

    updateTask({
      param: { taskId },
      json: { workType: next },
    });
  };

  return (
    <Select value={currentWorkType} onValueChange={handleChange} disabled={isPending}>
      <SelectTrigger
        className={cn(
          'h-6 min-w-[120px] gap-x-2 border-transparent bg-transparent px-2 text-xs font-medium text-neutral-800 shadow-none hover:bg-muted/70',
          triggerClassName,
        )}
      >
        <div className="flex items-center gap-x-2">
          <WorkTypeIcon type={currentWorkType} className="size-3" />
          <span className="text-xs">{TASK_WORK_TYPE_LABELS[currentWorkType]}</span>
        </div>
      </SelectTrigger>
      <SelectContent className="max-h-52 w-[180px]" position="popper" side="bottom" align="end" sideOffset={4}>
        {TASK_WORK_TYPE_ORDER.map((type) => (
          <SelectItem
            key={type}
            value={type}
            className="pr-7 py-1 text-xs [&>span:first-child]:right-5 [&>span:first-child]:h-3 [&>span:first-child]:w-3 [&>span:first-child_svg]:h-3 [&>span:first-child_svg]:w-3"
          >
            <div className="flex items-center gap-x-2">
              <WorkTypeIcon type={type} className="size-3" />
              <span className="text-xs">{TASK_WORK_TYPE_LABELS[type]}</span>
            </div>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
};
