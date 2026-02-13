'use client';

import { useEffect, useState } from 'react';

import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger } from '@/components/ui/select';
import { useUpdateTask } from '@/features/tasks/api/use-update-task';
import { TaskStatus, TASK_STATUS_LABELS, TASK_STATUS_ORDER } from '@/features/tasks/types';
import { cn } from '@/lib/utils';

interface StatusSelectProps {
  taskId: string;
  status: TaskStatus;
  triggerClassName?: string;
}

export const StatusSelect = ({ taskId, status, triggerClassName }: StatusSelectProps) => {
  const { mutate: updateTask, isPending } = useUpdateTask();
  const [currentStatus, setCurrentStatus] = useState<TaskStatus>(status);

  useEffect(() => {
    setCurrentStatus(status);
  }, [status]);

  const handleChange = (value: string) => {
    const next = value as TaskStatus;
    setCurrentStatus(next);

    if (next === status) return;

    updateTask({
      param: { taskId },
      json: { status: next },
    });
  };

  return (
    <Select value={currentStatus} onValueChange={handleChange} disabled={isPending}>
      <SelectTrigger
        className={cn(
          'h-6 min-w-[120px] gap-x-2 border-transparent bg-transparent px-2 text-xs font-medium text-neutral-800 shadow-none hover:bg-muted/70',
          triggerClassName,
        )}
      >
        <div className="flex items-center gap-x-2">
          <Badge variant={currentStatus} className="pointer-events-none px-2 py-0.5 text-xs">
            {TASK_STATUS_LABELS[currentStatus]}
          </Badge>
        </div>
      </SelectTrigger>
      <SelectContent className="max-h-52 w-[180px]" position="popper" side="bottom" align="end" sideOffset={4}>
        {TASK_STATUS_ORDER.map((item) => (
          <SelectItem
            key={item}
            value={item}
            className="pr-7 py-1 text-xs [&>span:first-child]:right-4 [&>span:first-child]:h-3 [&>span:first-child]:w-3 [&>span:first-child_svg]:h-3 [&>span:first-child_svg]:w-3"
          >
            <Badge variant={item} className="pointer-events-none px-2 py-0.5 text-xs">
              {TASK_STATUS_LABELS[item]}
            </Badge>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
};
