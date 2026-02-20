import { z } from "zod";

import { TaskPriority, TaskStatus, TaskWorkType } from "./types";

export const createTaskSchema = z.object({
  summary: z.string().trim().min(1, "Summary is required."),
  status: z.nativeEnum(TaskStatus, {
    message: "Task status is required.",
  }),
  workType: z.nativeEnum(TaskWorkType, {
    message: "Work type is required.",
  }),
  priority: z.nativeEnum(TaskPriority, {
    message: "Priority is required.",
  }),
  workspaceId: z.string().trim().min(1, "Workspace id is required."),
  projectId: z.string().trim().min(1, "Project id is required."),
  assigneeId: z.string().trim().min(1, "Assignee id is required."),
  description: z.string().optional(),
  attachments: z.array(z.string().url()).optional(),
});
