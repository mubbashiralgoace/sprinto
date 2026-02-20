"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select";
import { useUpdateTask } from "@/features/tasks/api/use-update-task";
import {
  TaskPriority,
  TASK_PRIORITY_LABELS,
  TASK_PRIORITY_ORDER,
} from "@/features/tasks/types";
import { cn } from "@/lib/utils";

interface PrioritySelectProps {
  taskId: string;
  priority?: TaskPriority | null;
  triggerClassName?: string;
}

export const PrioritySelect = ({
  taskId,
  priority,
  triggerClassName,
}: PrioritySelectProps) => {
  const { mutate: updateTask, isPending } = useUpdateTask();
  const currentPriority = priority ?? TaskPriority.MEDIUM;

  const handleChange = (value: string) => {
    const next = value as TaskPriority;

    if (next === priority) return;

    updateTask({
      param: { taskId },
      json: { priority: next },
    });
  };

  return (
    <Select
      value={currentPriority}
      onValueChange={handleChange}
      disabled={isPending}
    >
      <SelectTrigger
        className={cn(
          "h-6 min-w-[120px] border-transparent bg-transparent px-2 text-xs font-medium text-neutral-800 shadow-none hover:bg-muted/70",
          triggerClassName
        )}
      >
        <span className="text-xs">{TASK_PRIORITY_LABELS[currentPriority]}</span>
      </SelectTrigger>
      <SelectContent
        className="max-h-52 w-[160px]"
        position="popper"
        side="bottom"
        align="end"
        sideOffset={4}
      >
        {TASK_PRIORITY_ORDER.map((item) => (
          <SelectItem
            key={item}
            value={item}
            className="pr-7 py-1 text-xs [&>span:first-child]:right-4 [&>span:first-child]:h-3 [&>span:first-child]:w-3 [&>span:first-child_svg]:h-3 [&>span:first-child_svg]:w-3"
          >
            {TASK_PRIORITY_LABELS[item]}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
};
