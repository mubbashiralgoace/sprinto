"use client";

import { ChevronDown, Paperclip } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { ImageLightbox } from "@/components/image-lightbox";
import { ResponsiveModal } from "@/components/responsive-modal";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { MemberAvatar } from "@/features/members/components/member-avatar";
import { useGetMembers } from "@/features/members/api/use-get-members";
import { ProjectAvatar } from "@/features/projects/components/project-avatar";
import { useGetProjects } from "@/features/projects/api/use-get-projects";
import {
  TaskPriority,
  type Task,
  type TaskComment,
  type TaskHistory,
  TASK_PRIORITY_LABELS,
  TaskStatus,
  TaskWorkType,
  TASK_STATUS_LABELS,
  TASK_WORK_TYPE_LABELS,
} from "@/features/tasks/types";

import { TaskDate } from "./task-date";
import { WorkTypeIcon } from "./work-type-icon";
import { Textarea } from "@/components/ui/textarea";
import { useGetTaskComments } from "@/features/tasks/api/use-get-task-comments";
import { useCreateTaskComment } from "@/features/tasks/api/use-create-task-comment";
import { useGetTaskHistory } from "@/features/tasks/api/use-get-task-history";
import { uploadTaskCommentAttachments } from "@/features/tasks/attachments";
import { AssigneeSelect } from "./assignee-select";
import { PrioritySelect } from "./priority-select";
import { StatusSelect } from "./status-select";
import { WorkTypeSelect } from "./worktype-select";

interface TaskDetailsModalProps {
  task: Task;
  open: boolean;
  onOpenChangeAction: (open: boolean) => void;
}

const isImage = (url: string) =>
  /\.(png|jpe?g|gif|webp|bmp|svg)(\?.*)?$/i.test(url);
const isVideo = (url: string) => /\.(mp4|webm|ogg|mov|m4v)(\?.*)?$/i.test(url);

export const TaskDetailsModal = ({
  task,
  open,
  onOpenChangeAction,
}: TaskDetailsModalProps) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [commentText, setCommentText] = useState("");
  const [commentFiles, setCommentFiles] = useState<File[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [lightboxState, setLightboxState] = useState<{
    images: string[];
    index: number;
  } | null>(null);
  const { data: comments } = useGetTaskComments({ taskId: task.$id });
  const { data: history } = useGetTaskHistory({ taskId: task.$id });
  const { data: members } = useGetMembers({ workspaceId: task.workspaceId });
  const { data: projects } = useGetProjects({ workspaceId: task.workspaceId });
  const { mutate: addComment, isPending } = useCreateTaskComment();

  const commentList = (comments ?? []) as TaskComment[];
  const historyList = (history ?? []) as TaskHistory[];

  const imageAttachments = useMemo(
    () => (task.attachments ?? []).filter((url) => isImage(url)),
    [task.attachments]
  );
  const videoAttachments = useMemo(
    () => (task.attachments ?? []).filter((url) => isVideo(url)),
    [task.attachments]
  );
  const otherAttachments = useMemo(
    () =>
      (task.attachments ?? []).filter((url) => !isImage(url) && !isVideo(url)),
    [task.attachments]
  );

  const membersMap = useMemo(() => {
    const entries = (members?.documents ?? []).map(
      (member) => [member.$id, member] as const
    );
    return new Map(entries);
  }, [members]);

  const projectsMap = useMemo(() => {
    const entries = (projects?.documents ?? []).map(
      (project) => [project.$id, project] as const
    );
    return new Map(entries);
  }, [projects]);

  /*
   * FIX (Bug 2): Reset lightboxState when the task detail modal closes.
   *
   * Without this, if the user closes the task modal while the lightbox is
   * open (or if both close together), lightboxState stays non-null in React
   * state. The next time the modal opens, the ImageLightbox renders immediately
   * — appearing below the modal because it was painted before the modal itself.
   *
   * By intercepting onOpenChange and resetting lightboxState on close, we
   * guarantee the lightbox is always null when the modal re-opens.
   */
  const handleModalOpenChange = (nextOpen: boolean) => {
    // Radix fires onOpenChange(false) when it detects an "outside click".
    // Because the lightbox portal lives in <body>, Radix treats any click
    // on it as outside the dialog — which would close the detail modal.
    // Fix: if the lightbox is open and Radix tries to close the modal,
    // close only the lightbox and keep the detail modal alive.
    if (!nextOpen && lightboxState) {
      setLightboxState(null);
      return;
    }
    if (!nextOpen) setLightboxState(null);
    onOpenChangeAction(nextOpen);
  };

  const formatHistoryValue = (field: string, value?: string | null) => {
    if (!value) return "None";
    if (field === "status")
      return TASK_STATUS_LABELS[value as TaskStatus] ?? value;
    if (field === "priority")
      return TASK_PRIORITY_LABELS[value as TaskPriority] ?? value;
    if (field === "workType")
      return TASK_WORK_TYPE_LABELS[value as TaskWorkType] ?? value;
    if (field === "projectId")
      return projectsMap.get(value)?.name ?? "Unknown project";
    if (field === "assigneeId")
      return membersMap.get(value)?.name ?? "Unassigned";
    return value;
  };

  const renderHistoryValue = (field: string, value?: string | null) => {
    if (field !== "assigneeId")
      return <span>{formatHistoryValue(field, value)}</span>;
    const member = value ? membersMap.get(value) : null;
    return (
      <span className="flex items-center gap-x-2">
        {member ? (
          <MemberAvatar
            name={member.name}
            className="size-5"
            fallbackClassName="text-[10px]"
          />
        ) : null}
        <span>{member?.name ?? "Unassigned"}</span>
      </span>
    );
  };

  const getHistoryAction = (field: string) => {
    switch (field) {
      case "created":
        return "created the Work item";
      case "assigneeId":
        return "changed the Assignee";
      case "summary":
        return "updated the Summary";
      case "description":
        return "updated the Description";
      case "status":
        return "changed the Status";
      case "priority":
        return "changed the Priority";
      case "workType":
        return "changed the Work Type";
      case "projectId":
        return "updated the Project";
      default:
        return "updated the Task";
    }
  };

  const renderAttachmentPreview = (
    url: string,
    sizeClassName = "h-36",
    imageList: string[] = []
  ) => {
    if (isImage(url)) {
      const index = imageList.indexOf(url);
      return (
        <button
          type="button"
          className="group relative w-full cursor-zoom-in"
          onClick={() =>
            setLightboxState({ images: imageList, index: Math.max(index, 0) })
          }
          aria-label="Open image preview"
        >
          <img
            src={url}
            alt="Attachment"
            className={`${sizeClassName} w-full object-cover`}
          />
          <span className="pointer-events-none absolute inset-0 bg-black/0 transition group-hover:bg-black/10" />
        </button>
      );
    }
    if (isVideo(url)) {
      return (
        <video
          className={`${sizeClassName} w-full object-cover`}
          controls
          preload="metadata"
        >
          <source src={url} />
        </video>
      );
    }
    return (
      <a
        href={url}
        target="_blank"
        rel="noreferrer"
        className="block truncate text-xs text-blue-600 hover:underline"
      >
        {url}
      </a>
    );
  };

  const handleCommentFiles = (files: FileList | File[]) => {
    const incoming = Array.from(files);
    const allowed = incoming.filter(
      (file) => file.type.startsWith("image/") || file.type.startsWith("video/")
    );
    if (allowed.length !== incoming.length)
      toast.error("Only images and videos are allowed.");
    setCommentFiles((prev) => [...prev, ...allowed]);
  };

  const handleSubmitComment = async () => {
    if (!commentText.trim()) {
      toast.error("Comment is required.");
      return;
    }
    setIsUploading(true);
    try {
      const uploaded = await uploadTaskCommentAttachments({
        files: commentFiles,
        workspaceId: task.workspaceId,
        taskId: task.$id,
      });
      addComment(
        {
          param: { taskId: task.$id },
          json: { body: commentText.trim(), attachments: uploaded },
        },
        {
          onSuccess: () => {
            setCommentText("");
            setCommentFiles([]);
          },
        }
      );
    } catch (error) {
      console.error("[TASK_COMMENT_UPLOAD]:", error);
      toast.error("Failed to upload comment attachments.");
    } finally {
      setIsUploading(false);
    }
  };

  const activityItems = useMemo(() => {
    const commentItems = commentList.map((comment) => ({
      type: "comment" as const,
      createdAt: comment.$createdAt,
      data: comment,
    }));
    const historyItems = historyList.map((entry) => ({
      type: "history" as const,
      createdAt: entry.$createdAt,
      data: entry,
    }));
    return [...commentItems, ...historyItems].sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }, [commentList, historyList]);

  return (
    <>
      <ResponsiveModal
        title="Task details"
        description={task.summary}
        open={open}
        onOpenChange={handleModalOpenChange}
        contentClassName="hide-scrollbar max-h-[90vh] w-full overflow-y-auto border-none p-0 sm:max-w-5xl"
      >
        <div className="flex flex-col gap-6 p-6 lg:flex-row">
          <div className="flex-1 space-y-6">
            <div className="flex items-center gap-x-2 text-sm text-neutral-500">
              <WorkTypeIcon type={task.workType ?? TaskWorkType.TASK} />
              <span className="font-medium">{task.name}</span>
            </div>

            <div className="space-y-2">
              <h2 className="text-xl font-semibold text-neutral-900">
                {task.summary}
              </h2>
            </div>

            <div className="space-y-2">
              <p className="text-sm font-semibold text-neutral-900">
                Description
              </p>
              {task.description ? (
                <p className="text-sm text-neutral-600">{task.description}</p>
              ) : (
                <p className="text-sm italic text-neutral-400">
                  No description provided.
                </p>
              )}
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-neutral-900">
                  Attachments
                </p>
                <ChevronDown className="size-4 text-neutral-400" />
              </div>
              {imageAttachments.length === 0 &&
              videoAttachments.length === 0 &&
              otherAttachments.length === 0 ? (
                <p className="text-sm italic text-neutral-400">
                  No attachments yet.
                </p>
              ) : (
                <div className="space-y-3">
                  {(imageAttachments.length > 0 ||
                    videoAttachments.length > 0) && (
                    <div className="grid gap-3 sm:grid-cols-2">
                      {[...imageAttachments, ...videoAttachments].map((url) => (
                        <div
                          key={url}
                          className="overflow-hidden rounded-md border border-neutral-200"
                        >
                          {renderAttachmentPreview(
                            url,
                            "h-36",
                            imageAttachments
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                  {otherAttachments.length > 0 && (
                    <div className="space-y-2">
                      {otherAttachments.map((url) => (
                        <div
                          key={url}
                          className="rounded-md border border-neutral-200 p-2"
                        >
                          {renderAttachmentPreview(
                            url,
                            "h-28",
                            imageAttachments
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="space-y-3">
              <p className="text-sm font-semibold text-neutral-900">Activity</p>
              <Tabs defaultValue="all" className="w-full">
                <TabsList className="w-full justify-start bg-transparent p-0">
                  <TabsTrigger className="h-8" value="all">
                    All
                  </TabsTrigger>
                  <TabsTrigger className="h-8" value="comments">
                    Comments
                  </TabsTrigger>
                  <TabsTrigger className="h-8" value="history">
                    History
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="all" className="mt-3">
                  <div className="hide-scrollbar max-h-70 space-y-4 overflow-y-auto pr-1">
                    {activityItems.length === 0 && (
                      <p className="text-sm text-neutral-500">
                        No activity yet.
                      </p>
                    )}
                    {activityItems.map((item) => {
                      if (item.type === "comment") {
                        const comment = item.data;
                        return (
                          <div key={comment.$id} className="flex gap-x-3">
                            <MemberAvatar
                              name={comment.author?.name ?? "User"}
                              fallbackClassName="text-[10px]"
                            />
                            <div className="flex-1 space-y-1">
                              <div className="flex items-center gap-x-2 text-xs text-neutral-500">
                                <span className="font-medium text-neutral-800">
                                  {comment.author?.name ?? "User"}
                                </span>
                                <TaskDate
                                  value={comment.$createdAt}
                                  className="text-xs"
                                />
                              </div>
                              <p className="text-sm text-neutral-700">
                                {comment.body}
                              </p>
                              {(comment.attachments ?? []).length > 0 && (
                                <div className="grid gap-2 sm:grid-cols-2">
                                  {comment.attachments?.map((url: string) => {
                                    const commentImages = (
                                      comment.attachments ?? []
                                    ).filter((entry: string) => isImage(entry));
                                    return (
                                      <div
                                        key={url}
                                        className="overflow-hidden rounded-md border border-neutral-200"
                                      >
                                        {renderAttachmentPreview(
                                          url,
                                          "h-32",
                                          commentImages
                                        )}
                                      </div>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      }
                      const entry = item.data;
                      const actorName = entry.actor?.name ?? "User";
                      return (
                        <div key={entry.$id} className="flex gap-x-3">
                          <MemberAvatar
                            name={actorName}
                            fallbackClassName="text-[10px]"
                          />
                          <div className="flex-1 space-y-1">
                            <div className="flex flex-col gap-y-1">
                              <p className="text-sm text-neutral-800">
                                <span className="font-medium">{actorName}</span>{" "}
                                {getHistoryAction(entry.field)}
                              </p>
                              <TaskDate
                                value={entry.$createdAt}
                                className="text-xs text-neutral-500"
                              />
                            </div>
                            {entry.field !== "created" && (
                              <div className="flex items-center gap-x-2 text-sm text-neutral-600">
                                {renderHistoryValue(
                                  entry.field,
                                  entry.fromValue
                                )}
                                <span aria-hidden="true">→</span>
                                {renderHistoryValue(entry.field, entry.toValue)}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </TabsContent>

                <TabsContent value="comments" className="mt-3">
                  <div className="space-y-3">
                    {commentList.length === 0 ? (
                      <p className="text-sm text-neutral-500">
                        No comments yet.
                      </p>
                    ) : (
                      <div className="hide-scrollbar max-h-70 space-y-4 overflow-y-auto pr-1">
                        {commentList.map((comment) => (
                          <div key={comment.$id} className="flex gap-x-3">
                            <MemberAvatar
                              name={comment.author?.name ?? "User"}
                              fallbackClassName="text-[10px]"
                            />
                            <div className="flex-1 space-y-1">
                              <div className="flex items-center gap-x-2 text-xs text-neutral-500">
                                <span className="font-medium text-neutral-800">
                                  {comment.author?.name ?? "User"}
                                </span>
                                <TaskDate
                                  value={comment.$createdAt}
                                  className="text-xs"
                                />
                              </div>
                              <p className="text-sm text-neutral-700">
                                {comment.body}
                              </p>
                              {(comment.attachments ?? []).length > 0 && (
                                <div className="grid gap-2 sm:grid-cols-2">
                                  {comment.attachments?.map((url: string) => {
                                    const commentImages = (
                                      comment.attachments ?? []
                                    ).filter((item: string) => isImage(item));
                                    return (
                                      <div
                                        key={url}
                                        className="overflow-hidden rounded-md border border-neutral-200"
                                      >
                                        {renderAttachmentPreview(
                                          url,
                                          "h-32",
                                          commentImages
                                        )}
                                      </div>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                    <div className="rounded-md border border-neutral-200 bg-white p-3">
                      <Textarea
                        placeholder="Add a comment..."
                        rows={4}
                        value={commentText}
                        onChange={(event) => setCommentText(event.target.value)}
                        disabled={isPending || isUploading}
                      />
                      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                        <input
                          ref={fileInputRef}
                          type="file"
                          multiple
                          accept="image/*,video/*"
                          aria-label="Attach files"
                          className="hidden"
                          onChange={(event) => {
                            if (!event.target.files) return;
                            handleCommentFiles(event.target.files);
                            event.target.value = "";
                          }}
                        />
                        <div className="flex items-center gap-x-2">
                          <Button
                            type="button"
                            size="sm"
                            variant="secondary"
                            onClick={() => fileInputRef.current?.click()}
                            disabled={isPending || isUploading}
                          >
                            <Paperclip className="size-4" />
                            Attach
                          </Button>
                          {commentFiles.length > 0 && (
                            <span className="text-xs text-neutral-500">
                              {commentFiles.length} files selected
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-x-2">
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => {
                              setCommentText("");
                              setCommentFiles([]);
                            }}
                            disabled={isPending || isUploading}
                          >
                            Cancel
                          </Button>
                          <Button
                            size="sm"
                            onClick={handleSubmitComment}
                            disabled={isPending || isUploading}
                          >
                            {isUploading ? "Uploading..." : "Save"}
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="history" className="mt-3">
                  {historyList.length === 0 ? (
                    <p className="text-sm text-neutral-500">No history yet.</p>
                  ) : (
                    <div className="hide-scrollbar max-h-70 space-y-4 overflow-y-auto pr-1">
                      {historyList.map((entry) => {
                        const actorName = entry.actor?.name ?? "User";
                        return (
                          <div key={entry.$id} className="flex gap-x-3">
                            <MemberAvatar
                              name={actorName}
                              fallbackClassName="text-[10px]"
                            />
                            <div className="flex-1 space-y-1">
                              <div className="flex flex-col gap-y-1">
                                <p className="text-sm text-neutral-800">
                                  <span className="font-medium">
                                    {actorName}
                                  </span>{" "}
                                  {getHistoryAction(entry.field)}
                                </p>
                                <TaskDate
                                  value={entry.$createdAt}
                                  className="text-xs text-neutral-500"
                                />
                              </div>
                              {entry.field !== "created" && (
                                <div className="flex items-center gap-x-2 text-sm text-neutral-600">
                                  {renderHistoryValue(
                                    entry.field,
                                    entry.fromValue
                                  )}
                                  <span aria-hidden="true">→</span>
                                  {renderHistoryValue(
                                    entry.field,
                                    entry.toValue
                                  )}
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </TabsContent>
              </Tabs>
            </div>
          </div>

          <aside className="w-full shrink-0 rounded-lg mt-8 border border-neutral-200 bg-white p-4 lg:w-72">
            <p className="text-sm font-semibold text-neutral-900">Details</p>
            <div className="mt-4 space-y-4 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-neutral-500">Assignee</span>
                <AssigneeSelect
                  taskId={task.$id}
                  workspaceId={task.workspaceId}
                  assigneeId={task.assigneeId}
                  assigneeName={task.assignee?.name ?? null}
                  triggerClassName="min-w-[170px] justify-between"
                />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-neutral-500">Reporter</span>
                <div className="flex items-center gap-x-2">
                  <MemberAvatar
                    name={task.reporter?.name ?? "User"}
                    fallbackClassName="text-[10px]"
                  />
                  <span className="font-medium text-neutral-800">
                    {task.reporter?.name ?? "Unknown"}
                  </span>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-neutral-500">Status</span>
                <StatusSelect
                  taskId={task.$id}
                  status={task.status}
                  triggerClassName="justify-between"
                />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-neutral-500">Priority</span>
                <PrioritySelect
                  taskId={task.$id}
                  priority={task.priority}
                  triggerClassName="justify-between"
                />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-neutral-500">Work Type</span>
                <WorkTypeSelect
                  taskId={task.$id}
                  workType={task.workType}
                  triggerClassName="justify-between"
                />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-neutral-500">Project</span>
                <div className="flex items-center gap-x-2">
                  <ProjectAvatar
                    name={task.project?.name ?? "Project"}
                    image={task.project?.imageUrl}
                    fallbackClassName="text-[10px]"
                  />
                  <span className="font-medium text-neutral-800">
                    {task.project?.name ?? "Project"}
                  </span>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-neutral-500">Created</span>
                <TaskDate value={task.$createdAt} className="text-xs" />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-neutral-500">Updated</span>
                <TaskDate value={task.$updatedAt} className="text-xs" />
              </div>
            </div>
          </aside>
        </div>
      </ResponsiveModal>

      {/*
       * FIX (Bug 2 continued): ImageLightbox moved OUTSIDE ResponsiveModal.
       *
       * Previously it was rendered as a child of ResponsiveModal. Even though
       * createPortal moves it in the real DOM, its position in the React tree
       * meant its open/close state was tied to the modal's render cycle in
       * subtle ways. Moving it outside the modal JSX + the handleModalOpenChange
       * reset above fully decouples the two lifecycles.
       */}
      <ImageLightbox
        images={lightboxState?.images ?? []}
        startIndex={lightboxState?.index ?? 0}
        open={!!lightboxState}
        onClose={() => setLightboxState(null)}
      />
    </>
  );
};
