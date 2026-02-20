import { Pencil } from "lucide-react";

import { DottedSeparator } from "@/components/dotted-separator";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useEditTaskModal } from "@/features/tasks/hooks/use-edit-task-modal";
import {
  type Task,
  TaskWorkType,
  TASK_STATUS_LABELS,
  TASK_WORK_TYPE_LABELS,
} from "@/features/tasks/types";

import { AssigneeSelect } from "./assignee-select";
import { OverviewProperty } from "./overview-property";
import { PrioritySelect } from "./priority-select";
import { TaskDate } from "./task-date";

interface TaskOverviewProps {
  task: Task;
}

export const TaskOverview = ({ task }: TaskOverviewProps) => {
  const { open } = useEditTaskModal();

  return (
    <div className="col-span-1 flex flex-col gap-y-4">
      <div className="rounded-lg bg-muted p-4">
        <div className="flex items-center justify-between">
          <p className="text-lg font-semibold">Overview</p>

          <Button onClick={() => open(task.$id)} size="sm" variant="secondary">
            <Pencil className="mr-2 size-4" />
            Edit
          </Button>
        </div>

        <DottedSeparator className="my-4" />

        <div className="flex flex-col gap-y-4">
          <OverviewProperty label="Summary">
            <p className="text-sm font-medium">{task.summary}</p>
          </OverviewProperty>

          <OverviewProperty label="Assignee">
            <AssigneeSelect
              taskId={task.$id}
              workspaceId={task.workspaceId}
              assigneeId={task.assigneeId}
              assigneeName={task.assignee?.name ?? null}
              triggerClassName="min-w-[180px] justify-between"
            />
          </OverviewProperty>

          <OverviewProperty label="Created At">
            <TaskDate value={task.$createdAt} className="text-sm font-medium" />
          </OverviewProperty>

          <OverviewProperty label="Updated At">
            <TaskDate value={task.$updatedAt} className="text-sm font-medium" />
          </OverviewProperty>

          <OverviewProperty label="Status">
            <Badge variant={task.status}>
              {TASK_STATUS_LABELS[task.status]}
            </Badge>
          </OverviewProperty>

          <OverviewProperty label="Priority">
            <PrioritySelect
              taskId={task.$id}
              priority={task.priority}
              triggerClassName="min-w-[120px] justify-between"
            />
          </OverviewProperty>

          <OverviewProperty label="Work Type">
            <Badge variant="secondary">
              {TASK_WORK_TYPE_LABELS[task.workType ?? TaskWorkType.TASK]}
            </Badge>
          </OverviewProperty>
        </div>
      </div>
    </div>
  );
};
