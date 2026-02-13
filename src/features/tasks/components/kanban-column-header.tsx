import { Circle, CircleCheck, CircleDashed, CircleDot, CircleDotDashed, Plus } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { useCreateTaskModal } from '@/features/tasks/hooks/use-create-task-modal';
import { TaskStatus, TASK_STATUS_LABELS } from '@/features/tasks/types';

interface KanbanColumnHeaderProps {
  board: TaskStatus;
  taskCount: number;
}

const statusIconMap: Record<TaskStatus, React.ReactNode> = {
  [TaskStatus.TODO]: <Circle className="size-[18px] text-red-400" />,
  [TaskStatus.IN_PROGRESS]: <CircleDotDashed className="size-[18px] text-yellow-400" />,
  [TaskStatus.TESTING]: <CircleDot className="size-[18px] text-blue-400" />,
  [TaskStatus.BACKED_TODO]: <CircleDashed className="size-[18px] text-slate-400" />,
  [TaskStatus.WAITING_FOR_BUILD]: <CircleDashed className="size-[18px] text-violet-400" />,
  [TaskStatus.IMPROVEMENT]: <CircleDot className="size-[18px] text-emerald-400" />,
  [TaskStatus.SUGGESTION]: <Circle className="size-[18px] text-sky-400" />,
  [TaskStatus.INVALID]: <CircleDashed className="size-[18px] text-neutral-400" />,
  [TaskStatus.UNABLE_TO_CHANGE]: <CircleDotDashed className="size-[18px] text-orange-400" />,
  [TaskStatus.UNABLE_TO_REPLICATE]: <CircleDashed className="size-[18px] text-zinc-400" />,
  [TaskStatus.NOT_MENTIONED_BY_PM]: <Circle className="size-[18px] text-fuchsia-400" />,
  [TaskStatus.DONE]: <CircleCheck className="size-[18px] text-emerald-500" />,
};

export const KanbanColumnHeader = ({ board, taskCount }: KanbanColumnHeaderProps) => {
  const { open } = useCreateTaskModal();
  const icon = statusIconMap[board];

  return (
    <div className="flex items-center justify-between px-2 py-1.5">
      <div className="flex items-center gap-x-2">
        {icon}
        <h2 className="text-sm font-medium">{TASK_STATUS_LABELS[board]}</h2>

        <div className="flex size-5 items-center justify-center rounded-md bg-neutral-200 text-xs font-medium text-neutral-700">
          {taskCount}
        </div>
      </div>

      <Button
        onClick={() => open(board)}
        variant="ghost"
        size="icon"
        className="size-5"
        title={`Create ${TASK_STATUS_LABELS[board]} task`}
      >
        <Plus className="size-4 text-neutral-500" />
      </Button>
    </div>
  );
};
