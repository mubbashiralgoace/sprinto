"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import { DottedSeparator } from "@/components/dotted-separator";
import { ImageLightbox } from "@/components/image-lightbox";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { MemberAvatar } from "@/features/members/components/member-avatar";
import { ProjectAvatar } from "@/features/projects/components/project-avatar";
import { useUpdateTask } from "@/features/tasks/api/use-update-task";
import { uploadTaskAttachments } from "@/features/tasks/attachments";
import { createTaskSchema } from "@/features/tasks/schema";
import {
  TaskPriority,
  type Task,
  TaskStatus,
  TaskWorkType,
  TASK_PRIORITY_LABELS,
  TASK_PRIORITY_ORDER,
  TASK_STATUS_LABELS,
  TASK_STATUS_ORDER,
  TASK_WORK_TYPE_LABELS,
  TASK_WORK_TYPE_ORDER,
} from "@/features/tasks/types";
import { cn } from "@/lib/utils";

import { WorkTypeIcon } from "./work-type-icon";

const isImage = (url: string) =>
  /\.(png|jpe?g|gif|webp|bmp|svg)(\?.*)?$/i.test(url);
const isVideo = (url: string) => /\.(mp4|webm|ogg|mov|m4v)(\?.*)?$/i.test(url);

interface EditTaskFormProps {
  onCancel?: () => void;
  projectOptions: { id: string; name: string; imageUrl?: string }[];
  memberOptions: { id: string; name: string }[];
  initialValues: Task;
}

export const EditTaskForm = ({
  onCancel,
  memberOptions,
  projectOptions,
  initialValues,
}: EditTaskFormProps) => {
  const { mutate: createTask, isPending } = useUpdateTask();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [attachments, setAttachments] = useState<File[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [existingAttachments, setExistingAttachments] = useState<string[]>(
    initialValues.attachments ?? []
  );
  const [lightboxState, setLightboxState] = useState<{
    images: string[];
    index: number;
  } | null>(null);

  const editTaskSchema = createTaskSchema.omit({ workspaceId: true });
  type EditTaskFormValues = z.infer<typeof editTaskSchema>;

  const editTaskForm = useForm<EditTaskFormValues>({
    resolver: zodResolver(
      editTaskSchema as unknown as Parameters<typeof zodResolver>[0]
    ),
    defaultValues: {
      summary: initialValues.summary,
      status: initialValues.status,
      workType: initialValues.workType ?? TaskWorkType.TASK,
      priority: initialValues.priority ?? TaskPriority.MEDIUM,
      projectId: initialValues.projectId,
      assigneeId: initialValues.assigneeId,
      description: initialValues.description ?? "",
      attachments: initialValues.attachments ?? [],
    },
  });

  const handleFiles = (files: FileList | File[]) => {
    const incoming = Array.from(files);
    const allowed = incoming.filter(
      (file) => file.type.startsWith("image/") || file.type.startsWith("video/")
    );

    if (allowed.length !== incoming.length) {
      toast.error("Only images and videos are allowed.");
    }

    setAttachments((prev) => [...prev, ...allowed]);
  };

  const onSubmit = async (values: EditTaskFormValues) => {
    if (!values.projectId) {
      toast.error("Project is required.");
      return;
    }

    setIsUploading(true);

    try {
      const uploaded = await uploadTaskAttachments({
        files: attachments,
        workspaceId: initialValues.workspaceId,
        projectId: values.projectId,
      });

      createTask(
        {
          json: {
            ...values,
            attachments: [...existingAttachments, ...uploaded],
          },
          param: { taskId: initialValues.$id },
        },
        {
          onSuccess: () => {
            setAttachments([]);
            onCancel?.();
          },
        }
      );
    } catch (error) {
      console.error("[TASK_ATTACHMENTS_UPLOAD]:", error);
      toast.error("Failed to upload attachments.");
    } finally {
      setIsUploading(false);
    }
  };

  const renderExistingAttachmentPreview = (url: string) => {
    if (isImage(url)) {
      const imageAttachments = existingAttachments.filter((item) =>
        isImage(item)
      );
      const index = imageAttachments.indexOf(url);
      return (
        <button
          type="button"
          className="group relative w-full cursor-zoom-in"
          onClick={() =>
            setLightboxState({
              images: imageAttachments,
              index: Math.max(index, 0),
            })
          }
          aria-label="Open image preview"
        >
          <img
            src={url}
            alt="Attachment"
            className="h-36 w-full object-cover"
          />
          <span className="pointer-events-none absolute inset-0 bg-black/0 transition group-hover:bg-black/10" />
        </button>
      );
    }

    if (isVideo(url)) {
      return (
        <video className="h-36 w-full object-cover" controls preload="metadata">
          <source src={url} />
        </video>
      );
    }

    return (
      <div className="p-3 text-xs text-muted-foreground">
        No preview available.
      </div>
    );
  };

  return (
    <Card className="size-full border-none shadow-none">
      <CardHeader className="flex p-7">
        <CardTitle className="text-xl font-bold">Edit a task</CardTitle>
      </CardHeader>

      <div className="px-7">
        <DottedSeparator />
      </div>

      <CardContent className="p-7">
        <Form {...editTaskForm}>
          <form onSubmit={editTaskForm.handleSubmit(onSubmit)}>
            <div className="flex flex-col gap-y-4">
              <FormField
                disabled={isPending}
                control={editTaskForm.control}
                name="summary"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Summary</FormLabel>

                    <FormControl>
                      <Input
                        {...field}
                        type="text"
                        placeholder="Write a short summary"
                      />
                    </FormControl>

                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                disabled={isPending}
                control={editTaskForm.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description</FormLabel>

                    <FormControl>
                      <Textarea
                        {...field}
                        placeholder="Add a detailed description"
                        rows={5}
                      />
                    </FormControl>

                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                disabled={isPending}
                control={editTaskForm.control}
                name="assigneeId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Assignee</FormLabel>

                    <Select
                      disabled={isPending}
                      defaultValue={field.value}
                      value={field.value}
                      onValueChange={field.onChange}
                    >
                      <FormControl>
                        <SelectTrigger>
                          {field.value ? (
                            <SelectValue placeholder="Select assignee" />
                          ) : (
                            "Select assignee"
                          )}
                        </SelectTrigger>
                      </FormControl>

                      <FormMessage />

                      <SelectContent>
                        {memberOptions.map((member) => (
                          <SelectItem key={member.id} value={member.id}>
                            <div className="flex items-center gap-x-2">
                              <MemberAvatar
                                className="size-6"
                                name={member.name}
                              />
                              {member.name}
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </FormItem>
                )}
              />

              <FormField
                disabled={isPending}
                control={editTaskForm.control}
                name="status"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Status</FormLabel>

                    <Select
                      disabled={isPending}
                      defaultValue={field.value}
                      value={field.value}
                      onValueChange={field.onChange}
                    >
                      <FormControl>
                        <SelectTrigger>
                          {field.value ? (
                            <SelectValue placeholder="Select status" />
                          ) : (
                            "Select status"
                          )}
                        </SelectTrigger>
                      </FormControl>

                      <FormMessage />

                      <SelectContent>
                        {TASK_STATUS_ORDER.map((status) => (
                          <SelectItem key={status} value={status}>
                            {TASK_STATUS_LABELS[status]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </FormItem>
                )}
              />

              <FormField
                disabled={isPending}
                control={editTaskForm.control}
                name="workType"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Work Type</FormLabel>

                    <Select
                      disabled={isPending}
                      defaultValue={field.value ?? TaskWorkType.TASK}
                      value={field.value ?? TaskWorkType.TASK}
                      onValueChange={field.onChange}
                    >
                      <FormControl>
                        <SelectTrigger>
                          {field.value ? (
                            <SelectValue placeholder="Select work type" />
                          ) : (
                            "Select work type"
                          )}
                        </SelectTrigger>
                      </FormControl>

                      <FormMessage />

                      <SelectContent>
                        {TASK_WORK_TYPE_ORDER.map((workType) => (
                          <SelectItem key={workType} value={workType}>
                            <div className="flex items-center gap-x-2">
                              <WorkTypeIcon type={workType} />
                              <span>{TASK_WORK_TYPE_LABELS[workType]}</span>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </FormItem>
                )}
              />

              <FormField
                disabled={isPending}
                control={editTaskForm.control}
                name="priority"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Priority</FormLabel>

                    <Select
                      disabled={isPending}
                      defaultValue={field.value}
                      value={field.value}
                      onValueChange={field.onChange}
                    >
                      <FormControl>
                        <SelectTrigger>
                          {field.value ? (
                            <SelectValue placeholder="Select priority" />
                          ) : (
                            "Select priority"
                          )}
                        </SelectTrigger>
                      </FormControl>

                      <FormMessage />

                      <SelectContent>
                        {TASK_PRIORITY_ORDER.map((priority) => (
                          <SelectItem key={priority} value={priority}>
                            {TASK_PRIORITY_LABELS[priority]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </FormItem>
                )}
              />

              <FormField
                disabled={isPending}
                control={editTaskForm.control}
                name="projectId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Project</FormLabel>

                    <Select
                      disabled={isPending}
                      defaultValue={field.value}
                      value={field.value}
                      onValueChange={field.onChange}
                    >
                      <FormControl>
                        <SelectTrigger>
                          {field.value ? (
                            <SelectValue placeholder="Select project" />
                          ) : (
                            "Select project"
                          )}
                        </SelectTrigger>
                      </FormControl>

                      <FormMessage />

                      <SelectContent>
                        {projectOptions.map((project) => (
                          <SelectItem key={project.id} value={project.id}>
                            <div className="flex items-center gap-x-2">
                              <ProjectAvatar
                                className="size-6"
                                name={project.name}
                                image={project.imageUrl}
                              />
                              {project.name}
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </FormItem>
                )}
              />

              <div className="flex flex-col gap-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium">Attachments</p>
                  <Button
                    type="button"
                    size="xs"
                    variant="secondary"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isPending || isUploading}
                  >
                    Browse
                  </Button>
                </div>

                <div
                  className={cn(
                    "flex min-h-24 flex-col items-center justify-center rounded-md border border-dashed border-input bg-muted/40 px-4 py-3 text-sm text-muted-foreground",
                    (isPending || isUploading) && "opacity-60"
                  )}
                  onDragOver={(event) => event.preventDefault()}
                  onDrop={(event) => {
                    event.preventDefault();
                    if (isPending || isUploading) return;
                    handleFiles(event.dataTransfer.files);
                  }}
                >
                  <p>Drop files to attach or browse</p>
                  <p className="text-xs">Images and videos only</p>
                </div>

                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  accept="image/*,video/*"
                  aria-label="Attach files"
                  className="hidden"
                  onChange={(event) => {
                    if (!event.target.files) return;
                    handleFiles(event.target.files);
                    event.target.value = "";
                  }}
                />

                {existingAttachments.length > 0 && (
                  <div className="grid gap-3 sm:grid-cols-2">
                    {existingAttachments.map((url) => (
                      <div
                        key={url}
                        className="overflow-hidden rounded-md border border-input bg-white"
                      >
                        {renderExistingAttachmentPreview(url)}
                        <div className="flex items-center justify-between gap-x-2 border-t border-input p-2 text-xs">
                          <a
                            className="truncate text-blue-600 hover:underline"
                            href={url}
                            target="_blank"
                            rel="noreferrer"
                          >
                            Open
                          </a>
                          <Button
                            type="button"
                            size="xs"
                            variant="ghost"
                            onClick={() =>
                              setExistingAttachments((prev) =>
                                prev.filter((item) => item !== url)
                              )
                            }
                          >
                            Remove
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {attachments.length > 0 && (
                  <div className="flex flex-col gap-y-2 rounded-md border border-input bg-white p-2">
                    {attachments.map((file, index) => (
                      <div
                        key={`${file.name}-${index}`}
                        className="flex items-center justify-between text-xs"
                      >
                        <span className="truncate">{file.name}</span>
                        <Button
                          type="button"
                          size="xs"
                          variant="ghost"
                          onClick={() =>
                            setAttachments((prev) =>
                              prev.filter((_, itemIndex) => itemIndex !== index)
                            )
                          }
                        >
                          Remove
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
                <ImageLightbox
                  images={lightboxState?.images ?? []}
                  startIndex={lightboxState?.index ?? 0}
                  open={!!lightboxState}
                  onClose={() => setLightboxState(null)}
                />
              </div>
            </div>

            <DottedSeparator className="py-7" />

            <div className="flex items-center justify-between">
              <Button
                disabled={isPending}
                type="button"
                size="lg"
                variant="secondary"
                onClick={onCancel}
                className={cn(!onCancel && "invisible")}
              >
                Cancel
              </Button>

              <Button
                disabled={isPending || isUploading}
                type="submit"
                size="lg"
              >
                {isUploading ? "Uploading..." : "Save Changes"}
              </Button>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
};
