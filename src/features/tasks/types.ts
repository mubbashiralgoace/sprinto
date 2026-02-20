import type { BaseDocument } from "@/types/db";
import type { Member } from "@/features/members/types";
import type { Project } from "@/features/projects/types";

export enum TaskStatus {
  TODO = "TODO",
  IN_PROGRESS = "IN_PROGRESS",
  TESTING = "TESTING",
  BACKED_TODO = "BACKED_TODO",
  WAITING_FOR_BUILD = "WAITING_FOR_BUILD",
  IMPROVEMENT = "IMPROVEMENT",
  SUGGESTION = "SUGGESTION",
  INVALID = "INVALID",
  UNABLE_TO_CHANGE = "UNABLE_TO_CHANGE",
  UNABLE_TO_REPLICATE = "UNABLE_TO_REPLICATE",
  NOT_MENTIONED_BY_PM = "NOT_MENTIONED_BY_PM",
  DONE = "DONE",
}

export enum TaskWorkType {
  SUGGESTION = "SUGGESTION",
  TASK = "TASK",
  BUG = "BUG",
  STORY = "STORY",
  IMPROVEMENT = "IMPROVEMENT",
}

export enum TaskPriority {
  URGENT = "URGENT",
  HIGH = "HIGH",
  MEDIUM = "MEDIUM",
  LOW = "LOW",
}

export const TASK_WORK_TYPE_ORDER: TaskWorkType[] = [
  TaskWorkType.SUGGESTION,
  TaskWorkType.TASK,
  TaskWorkType.BUG,
  TaskWorkType.STORY,
  TaskWorkType.IMPROVEMENT,
];

export const TASK_WORK_TYPE_LABELS: Record<TaskWorkType, string> = {
  [TaskWorkType.SUGGESTION]: "Suggestions",
  [TaskWorkType.TASK]: "Task",
  [TaskWorkType.BUG]: "Bug",
  [TaskWorkType.STORY]: "Story",
  [TaskWorkType.IMPROVEMENT]: "Improvment",
};

export const TASK_PRIORITY_ORDER: TaskPriority[] = [
  TaskPriority.URGENT,
  TaskPriority.HIGH,
  TaskPriority.MEDIUM,
  TaskPriority.LOW,
];

export const TASK_PRIORITY_LABELS: Record<TaskPriority, string> = {
  [TaskPriority.URGENT]: "Urgent",
  [TaskPriority.HIGH]: "High",
  [TaskPriority.MEDIUM]: "Medium",
  [TaskPriority.LOW]: "Low",
};

export const TASK_STATUS_ORDER: TaskStatus[] = [
  TaskStatus.TODO,
  TaskStatus.IN_PROGRESS,
  TaskStatus.TESTING,
  TaskStatus.BACKED_TODO,
  TaskStatus.WAITING_FOR_BUILD,
  TaskStatus.IMPROVEMENT,
  TaskStatus.SUGGESTION,
  TaskStatus.INVALID,
  TaskStatus.UNABLE_TO_CHANGE,
  TaskStatus.UNABLE_TO_REPLICATE,
  TaskStatus.NOT_MENTIONED_BY_PM,
  TaskStatus.DONE,
];

export const TASK_STATUS_LABELS: Record<TaskStatus, string> = {
  [TaskStatus.TODO]: "TO DO",
  [TaskStatus.IN_PROGRESS]: "IN PROGRESS",
  [TaskStatus.TESTING]: "TESTING",
  [TaskStatus.BACKED_TODO]: "BACKED TODO",
  [TaskStatus.WAITING_FOR_BUILD]: "WAITING FOR BUILD",
  [TaskStatus.IMPROVEMENT]: "IMPROVEMENT",
  [TaskStatus.SUGGESTION]: "SUGGESTION",
  [TaskStatus.INVALID]: "INVALID",
  [TaskStatus.UNABLE_TO_CHANGE]: "UNABLE TO CHANGE",
  [TaskStatus.UNABLE_TO_REPLICATE]: "UNABLE TO REPLICATE",
  [TaskStatus.NOT_MENTIONED_BY_PM]: "NOT MENTION BY PM",
  [TaskStatus.DONE]: "DONE",
};

export type Task = BaseDocument & {
  name: string;
  summary: string;
  status: TaskStatus;
  workType: TaskWorkType | null;
  priority: TaskPriority | null;
  reporterId?: string | null;
  assigneeId: string;
  projectId: string;
  workspaceId: string;
  position: number;
  attachments?: string[] | null;
  description?: string;
  project?: Project | null;
  assignee?: Member | null;
  reporter?: Member | null;
};

export type TaskComment = BaseDocument & {
  taskId: string;
  memberId: string;
  body: string;
  attachments?: string[] | null;
  author?: Member | null;
};

export type TaskHistoryField =
  | "created"
  | "assigneeId"
  | "summary"
  | "description"
  | "status"
  | "priority"
  | "workType"
  | "projectId";

export type TaskHistory = BaseDocument & {
  taskId: string;
  memberId: string;
  field: TaskHistoryField;
  fromValue?: string | null;
  toValue?: string | null;
  actor?: Member | null;
};
