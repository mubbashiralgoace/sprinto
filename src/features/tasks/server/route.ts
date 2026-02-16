import { zValidator } from '@hono/zod-validator';
import { Hono } from 'hono';
import { z } from 'zod';

import { IMAGES_BUCKET, MEMBERS_TABLE, NOTIFICATIONS_TABLE, PROJECTS_TABLE, TASKS_TABLE, TASK_COMMENTS_TABLE, TASK_HISTORY_TABLE } from '@/config/db';
import { getMember } from '@/features/members/utils';
import type { Project } from '@/features/projects/types';
import { createTaskSchema } from '@/features/tasks/schema';
import { TaskStatus, type Task } from '@/features/tasks/types';
import { sessionMiddleware } from '@/lib/session-middleware';
import { toDocument, toDocuments } from '@/lib/supabase';

const getPublicImageUrl = (storage: any, imagePath?: string) => {
  if (!imagePath) return undefined;

  const { data } = storage.from(IMAGES_BUCKET).getPublicUrl(imagePath);

  return data.publicUrl;
};

const buildProjectCode = (projectName: string) => {
  const cleaned = projectName.trim().replace(/[^a-zA-Z0-9 ]+/g, '');
  const parts = cleaned.split(/\s+/).filter(Boolean);

  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }

  const single = parts[0] ?? 'TK';
  const letters = single.replace(/[^a-zA-Z]/g, '');
  const first = letters[0] ?? 'T';

  const vowels = new Set(['a', 'e', 'i', 'o', 'u']);
  const lower = letters.toLowerCase();
  const firstVowelIndex = lower.split('').findIndex((ch) => vowels.has(ch));

  const afterVowel = firstVowelIndex >= 0 ? lower.slice(firstVowelIndex + 1) : lower.slice(1);
  const consonants = afterVowel.split('').filter((ch) => /[a-z]/.test(ch) && !vowels.has(ch));
  const second = consonants[1] ?? consonants[0] ?? lower[1] ?? 'K';

  return `${first}${second}`.toUpperCase();
};

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const mentionEmailRegex = /@([\w.+-]+@[\w.-]+\.[A-Za-z]{2,})/g;

const extractMentionEmails = (text: string) => {
  const matches = text.matchAll(mentionEmailRegex);
  const emails = new Set<string>();

  for (const match of matches) {
    if (match[1]) emails.add(match[1].toLowerCase());
  }

  return [...emails];
};

const getMemberUser = async (supabase: any, memberId?: string | null) => {
  if (!memberId) return null;

  const { data: member } = await supabase.from(MEMBERS_TABLE).select('id,userId').eq('id', memberId).single();

  if (!member) return null;

  const { data: userData } = await supabase.auth.admin.getUserById(member.userId);
  const name =
    userData.user?.user_metadata?.full_name ??
    userData.user?.user_metadata?.name ??
    userData.user?.email?.split('@')[0] ??
    'User';

  return {
    memberId: member.id,
    userId: member.userId,
    name,
    email: userData.user?.email ?? '',
  };
};

const createNotification = async ({
  supabase,
  userId,
  workspaceId,
  actorId,
  taskId,
  type,
  title,
  body,
  link,
  metadata,
}: {
  supabase: any;
  userId: string;
  workspaceId: string;
  actorId?: string | null;
  taskId?: string | null;
  type: string;
  title: string;
  body: string;
  link?: string | null;
  metadata?: Record<string, unknown>;
}) => {
  await supabase.from(NOTIFICATIONS_TABLE).insert({
    userId,
    workspaceId,
    actorId,
    taskId,
    type,
    title,
    body,
    link: link ?? null,
    metadata: metadata ?? {},
  });
};

const sendNotificationEmail = async ({
  supabase,
  to,
  subject,
  html,
}: {
  supabase: any;
  to: string | null | undefined;
  subject: string;
  html: string;
}) => {
  if (!to) return;

  try {
    await supabase.functions.invoke('send-notification-email', {
      body: {
        to,
        subject,
        html,
      },
    });
  } catch (error) {
    console.error('[NOTIFICATION_EMAIL_ERROR]:', error);
  }
};

const getNextTaskCode = async ({
  supabase,
  projectId,
  prefix,
}: {
  supabase: any;
  projectId: string;
  prefix: string;
}) => {
  const { data: existing } = await supabase
    .from(TASKS_TABLE)
    .select('name')
    .eq('projectId', projectId)
    .ilike('name', `${prefix}-%`);

  const pattern = new RegExp(`^${escapeRegExp(prefix)}-(\\d+)$`);
  const maxIndex = (existing ?? []).reduce((acc: number, item: { name?: string }) => {
    const match = item.name?.match(pattern);
    const current = match ? Number.parseInt(match[1], 10) : 0;
    return Number.isNaN(current) ? acc : Math.max(acc, current);
  }, 0);

  const next = String(maxIndex + 1).padStart(2, '0');
  return `${prefix}-${next}`;
};

const app = new Hono()
  .get(
    '/',
    sessionMiddleware,
    zValidator(
      'query',
      z.object({
        workspaceId: z.string(),
        projectId: z.string().nullish(),
        assigneeId: z.string().nullish(),
        status: z.nativeEnum(TaskStatus).nullish(),
        search: z.string().nullish(),
      }) as unknown as Parameters<typeof zValidator>[1],
    ),
    async (ctx) => {
      const supabase = ctx.get('supabase');
      const storage = ctx.get('storage');
      const user = ctx.get('user');

      const { workspaceId, projectId, assigneeId, status, search } = ctx.req.valid('query');

      const member = await getMember({
        supabase,
        workspaceId,
        userId: user.$id,
      });

      if (!member) {
        return ctx.json({ error: 'Unauthorized.' }, 401);
      }

      let query = supabase.from(TASKS_TABLE).select('*', { count: 'exact' }).eq('workspaceId', workspaceId).order('created_at', {
        ascending: false,
      });

      if (projectId) query = query.eq('projectId', projectId);
      if (status) query = query.eq('status', status);
      if (assigneeId) query = query.eq('assigneeId', assigneeId);
      if (search) query = query.or(`summary.ilike.%${search}%,name.ilike.%${search}%`);

      const { data: tasks, count } = await query;

      const taskDocuments = toDocuments(tasks ?? []) as Task[];

      const projectIds = [...new Set(taskDocuments.map((task) => task.projectId))];
      const assigneeIds = [...new Set(taskDocuments.map((task) => task.assigneeId).filter(Boolean))] as string[];
      const reporterIds = [...new Set(taskDocuments.map((task) => task.reporterId).filter(Boolean))] as string[];

      const { data: projects } = projectIds.length
        ? await supabase.from(PROJECTS_TABLE).select('*').in('id', projectIds)
        : { data: [] };

      const memberIds = [...new Set([...assigneeIds, ...reporterIds])];

      const { data: members } = memberIds.length
        ? await supabase.from(MEMBERS_TABLE).select('*').in('id', memberIds)
        : { data: [] };

      const memberDocuments = toDocuments(members ?? []);

      const membersWithUsers = await Promise.all(
        memberDocuments.map(async (memberItem) => {
          const { data: userData } = await supabase.auth.admin.getUserById(memberItem.userId);

          return {
            ...memberItem,
            name:
              userData.user?.user_metadata?.full_name ??
              userData.user?.user_metadata?.name ??
              userData.user?.email?.split('@')[0] ??
              'User',
            email: userData.user?.email ?? '',
          };
        }),
      );

      const projectDocuments = toDocuments(projects ?? []) as Project[];

      const populatedTasks = taskDocuments.map((task) => {
        const project = projectDocuments.find((projectItem) => projectItem.$id === task.projectId);
        const assignee = membersWithUsers.find((assigneeItem) => assigneeItem.$id === task.assigneeId);
        const reporter = membersWithUsers.find((memberItem) => memberItem.$id === task.reporterId);

        return {
          ...task,
          project: project
            ? {
                ...project,
                imageUrl: getPublicImageUrl(storage, project.imageId),
              }
            : null,
          assignee,
          reporter,
        };
      });

      return ctx.json({
        data: {
          documents: populatedTasks,
          total: count ?? 0,
        },
      });
    },
  )
  .get('/:taskId', sessionMiddleware, async (ctx) => {
    const { taskId } = ctx.req.param();
    const currentUser = ctx.get('user');
    const supabase = ctx.get('supabase');

    const { data: task } = await supabase.from(TASKS_TABLE).select('*').eq('id', taskId).single();

    if (!task) return ctx.json({ error: 'Task not found.' }, 404);

    const currentMember = await getMember({
      supabase,
      workspaceId: task.workspaceId,
      userId: currentUser.$id,
    });

    if (!currentMember) {
      return ctx.json({ error: 'Unauthorized.' }, 401);
    }

    const { data: project } = await supabase.from(PROJECTS_TABLE).select('*').eq('id', task.projectId).single();

    const { data: member } = await supabase.from(MEMBERS_TABLE).select('*').eq('id', task.assigneeId).single();

    const { data: userData } = await supabase.auth.admin.getUserById(member?.userId ?? '');

    const assignee = member
      ? {
          ...toDocument(member),
          name:
            userData.user?.user_metadata?.full_name ??
            userData.user?.user_metadata?.name ??
            userData.user?.email?.split('@')[0] ??
            'User',
          email: userData.user?.email ?? '',
        }
      : null;

    const reporterMember = task.reporterId
      ? await supabase.from(MEMBERS_TABLE).select('*').eq('id', task.reporterId).single()
      : { data: null };

    const reporterUser = reporterMember.data
      ? await supabase.auth.admin.getUserById(reporterMember.data.userId)
      : { data: { user: null } };

    const reporter = reporterMember.data
      ? {
          ...toDocument(reporterMember.data),
          name:
            reporterUser.data.user?.user_metadata?.full_name ??
            reporterUser.data.user?.user_metadata?.name ??
            reporterUser.data.user?.email?.split('@')[0] ??
            'User',
          email: reporterUser.data.user?.email ?? '',
        }
      : null;

    return ctx.json({
      data: {
        ...toDocument(task),
        project: project ? toDocument(project) : null,
        assignee,
        reporter,
      },
    });
  })
  .get('/:taskId/comments', sessionMiddleware, async (ctx) => {
    const { taskId } = ctx.req.param();
    const supabase = ctx.get('supabase');
    const user = ctx.get('user');

    const { data: task } = await supabase.from(TASKS_TABLE).select('id,workspaceId').eq('id', taskId).single();
    if (!task) return ctx.json({ error: 'Task not found.' }, 404);

    const member = await getMember({
      supabase,
      workspaceId: task.workspaceId,
      userId: user.$id,
    });

    if (!member) return ctx.json({ error: 'Unauthorized.' }, 401);

    const { data: comments } = await supabase
      .from(TASK_COMMENTS_TABLE)
      .select('*')
      .eq('taskId', taskId)
      .order('created_at', { ascending: true });

    const commentDocs = toDocuments(comments ?? []);
    const memberIds = [...new Set(commentDocs.map((comment) => comment.memberId).filter(Boolean))] as string[];

    const { data: members } = memberIds.length
      ? await supabase.from(MEMBERS_TABLE).select('*').in('id', memberIds)
      : { data: [] };

    const memberDocuments = toDocuments(members ?? []);
    const membersWithUsers = await Promise.all(
      memberDocuments.map(async (memberItem) => {
        const { data: userData } = await supabase.auth.admin.getUserById(memberItem.userId);

        return {
          ...memberItem,
          name:
            userData.user?.user_metadata?.full_name ??
            userData.user?.user_metadata?.name ??
            userData.user?.email?.split('@')[0] ??
            'User',
          email: userData.user?.email ?? '',
        };
      }),
    );

    const populated = commentDocs.map((comment) => ({
      ...comment,
      author: membersWithUsers.find((memberItem) => memberItem.$id === comment.memberId) ?? null,
    }));

    return ctx.json({ data: populated });
  })
  .post(
    '/:taskId/comments',
    sessionMiddleware,
    zValidator(
      'json',
      z.object({
        body: z.string().trim().min(1, 'Comment is required.'),
        attachments: z.array(z.string().url()).optional(),
      }) as unknown as Parameters<typeof zValidator>[1],
    ),
    async (ctx) => {
      const { taskId } = ctx.req.param();
      const supabase = ctx.get('supabase');
      const user = ctx.get('user');
      const { body, attachments } = ctx.req.valid('json');

      const { data: task } = await supabase
        .from(TASKS_TABLE)
        .select('id,workspaceId,assigneeId,reporterId,name,summary,projectId')
        .eq('id', taskId)
        .single();
      if (!task) return ctx.json({ error: 'Task not found.' }, 404);

      const member = await getMember({
        supabase,
        workspaceId: task.workspaceId,
        userId: user.$id,
      });

      if (!member) return ctx.json({ error: 'Unauthorized.' }, 401);

      const { data: comment } = await supabase
        .from(TASK_COMMENTS_TABLE)
        .insert({
          taskId,
          memberId: member.$id,
          body,
          attachments: attachments ?? [],
        })
        .select('*')
        .single();

      if (!comment) return ctx.json({ error: 'Failed to create comment.' }, 400);

      try {
        const notificationLink = `/workspaces/${task.workspaceId}/tasks`;
        const actorName = user.name;
        const taskName = task.name ?? 'Task';
        const taskSummary = task.summary ?? '';

        const recipients = new Map<string, { userId: string; email: string }>();
        const mentionedRecipients = new Set<string>();

        const assigneeUser = await getMemberUser(supabase, task.assigneeId);
        const reporterUser = await getMemberUser(supabase, task.reporterId);

        if (assigneeUser && assigneeUser.userId !== user.$id) {
          recipients.set(assigneeUser.userId, { userId: assigneeUser.userId, email: assigneeUser.email });
        }

        if (reporterUser && reporterUser.userId !== user.$id) {
          recipients.set(reporterUser.userId, { userId: reporterUser.userId, email: reporterUser.email });
        }

        const mentionEmails = extractMentionEmails(body);

        if (mentionEmails.length > 0) {
          const { data: members } = await supabase.from(MEMBERS_TABLE).select('id,userId').eq('workspaceId', task.workspaceId);
          const memberDocs = toDocuments(members ?? []);

          const membersWithUsers = await Promise.all(
            memberDocs.map(async (memberItem) => {
              const { data: userData } = await supabase.auth.admin.getUserById(memberItem.userId);

              return {
                userId: memberItem.userId,
                email: userData.user?.email?.toLowerCase() ?? '',
              };
            }),
          );

          membersWithUsers.forEach((memberItem) => {
            if (!memberItem.email) return;
            if (mentionEmails.includes(memberItem.email)) {
              if (memberItem.userId !== user.$id) {
                recipients.set(memberItem.userId, { userId: memberItem.userId, email: memberItem.email });
                mentionedRecipients.add(memberItem.userId);
              }
            }
          });
        }

        for (const recipient of recipients.values()) {
          const isMention = mentionedRecipients.has(recipient.userId);
          const title = isMention ? `${actorName} mentioned you in ${taskName}` : `${actorName} commented on ${taskName}`;
          const bodyText = taskSummary ? taskSummary : 'New comment added.';

          await createNotification({
            supabase,
            userId: recipient.userId,
            workspaceId: task.workspaceId,
            actorId: member.$id,
            taskId: task.id,
            type: isMention ? 'mentioned' : 'comment_added',
            title,
            body: bodyText,
            link: notificationLink,
            metadata: {
              taskId: task.id,
              projectId: task.projectId,
            },
          });

          await sendNotificationEmail({
            supabase,
            to: recipient.email,
            subject: title,
            html: `<p>${title}</p><p>${bodyText}</p>`,
          });
        }
      } catch (error) {
        console.error('[TASK_COMMENT_NOTIFICATION_ERROR]:', error);
      }

      return ctx.json({ data: toDocument(comment) });
    },
  )
  .post('/', sessionMiddleware, zValidator('json', createTaskSchema as unknown as Parameters<typeof zValidator>[1]), async (ctx) => {
    const user = ctx.get('user');
    const supabase = ctx.get('supabase');

    const { summary, status, workType, workspaceId, projectId, assigneeId, description, attachments } = ctx.req.valid('json');

    const member = await getMember({
      supabase,
      workspaceId,
      userId: user.$id,
    });

    if (!member) {
      return ctx.json({ error: 'Unauthorized.' }, 401);
    }

    const { data: project } = await supabase.from(PROJECTS_TABLE).select('name').eq('id', projectId).single();
    const prefix = buildProjectCode(project?.name ?? 'Task');
    const name = await getNextTaskCode({ supabase, projectId, prefix });

    const { data: highestPositionTask } = await supabase
      .from(TASKS_TABLE)
      .select('position')
      .eq('status', status)
      .eq('workspaceId', workspaceId)
      .order('position', { ascending: true })
      .limit(1);

    const newPosition = highestPositionTask && highestPositionTask.length > 0 ? highestPositionTask[0].position + 1000 : 1000;

    const { data: task } = await supabase
      .from(TASKS_TABLE)
      .insert({
        name,
        summary,
        status,
        workType,
        workspaceId,
        projectId,
        reporterId: member.$id,
        assigneeId,
        position: newPosition,
        description,
        attachments: attachments ?? [],
      })
      .select('*')
      .single();

    if (!task) return ctx.json({ error: 'Failed to create task.' }, 400);

    await supabase.from(TASK_HISTORY_TABLE).insert({
      taskId: task.id,
      memberId: member.$id,
      field: 'created',
      fromValue: null,
      toValue: null,
    });

    try {
      const assigneeUser = await getMemberUser(supabase, assigneeId);

      if (assigneeUser && assigneeUser.userId !== user.$id) {
        const title = `${user.name} created ${task.name}`;
        const bodyText = task.summary ?? '';
        const notificationLink = `/workspaces/${workspaceId}/tasks`;

        await createNotification({
          supabase,
          userId: assigneeUser.userId,
          workspaceId,
          actorId: member.$id,
          taskId: task.id,
          type: 'task_created',
          title,
          body: bodyText,
          link: notificationLink,
          metadata: {
            taskId: task.id,
            projectId: task.projectId,
          },
        });

        await sendNotificationEmail({
          supabase,
          to: assigneeUser.email,
          subject: title,
          html: `<p>${title}</p><p>${bodyText}</p>`,
        });
      }
    } catch (error) {
      console.error('[TASK_CREATE_NOTIFICATION_ERROR]:', error);
    }

    return ctx.json({ data: toDocument(task) });
  })
  .patch('/:taskId', sessionMiddleware, zValidator('json', createTaskSchema.partial() as unknown as Parameters<typeof zValidator>[1]), async (ctx) => {
    const user = ctx.get('user');
    const supabase = ctx.get('supabase');

    const { summary, status, workType, description, projectId, assigneeId, attachments } = ctx.req.valid('json');
    const { taskId } = ctx.req.param();

    const { data: existingTask } = await supabase.from(TASKS_TABLE).select('*').eq('id', taskId).single();

    if (!existingTask) return ctx.json({ error: 'Task not found.' }, 404);

    const member = await getMember({
      supabase,
      workspaceId: existingTask.workspaceId,
      userId: user.$id,
    });

    if (!member) {
      return ctx.json({ error: 'Unauthorized.' }, 401);
    }

    const updates: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    const historyEntries: { field: string; fromValue: string | null; toValue: string | null }[] = [];

    if (summary !== undefined && summary !== existingTask.summary) {
      historyEntries.push({ field: 'summary', fromValue: existingTask.summary ?? null, toValue: summary ?? null });
    }

    if (status !== undefined && status !== existingTask.status) {
      historyEntries.push({ field: 'status', fromValue: existingTask.status ?? null, toValue: status ?? null });
    }

    if (workType !== undefined && workType !== existingTask.workType) {
      historyEntries.push({ field: 'workType', fromValue: existingTask.workType ?? null, toValue: workType ?? null });
    }

    if (projectId !== undefined && projectId !== existingTask.projectId) {
      historyEntries.push({ field: 'projectId', fromValue: existingTask.projectId ?? null, toValue: projectId ?? null });
    }

    if (assigneeId !== undefined && assigneeId !== existingTask.assigneeId) {
      historyEntries.push({ field: 'assigneeId', fromValue: existingTask.assigneeId ?? null, toValue: assigneeId ?? null });
    }

    if (description !== undefined && description !== existingTask.description) {
      historyEntries.push({ field: 'description', fromValue: existingTask.description ?? null, toValue: description ?? null });
    }

    if (summary !== undefined) updates.summary = summary;
    if (status !== undefined) updates.status = status;
    if (workType !== undefined) updates.workType = workType;
    if (projectId !== undefined) updates.projectId = projectId;
    if (assigneeId !== undefined) updates.assigneeId = assigneeId;
    if (description !== undefined) updates.description = description;
    if (attachments !== undefined) updates.attachments = attachments;

    const { data: task } = await supabase.from(TASKS_TABLE).update(updates).eq('id', taskId).select('*').single();

    if (!task) return ctx.json({ error: 'Task not found.' }, 404);

    if (historyEntries.length > 0) {
      await supabase.from(TASK_HISTORY_TABLE).insert(
        historyEntries.map((entry) => ({
          taskId: taskId,
          memberId: member.$id,
          field: entry.field,
          fromValue: entry.fromValue,
          toValue: entry.toValue,
        })),
      );
    }

    if (assigneeId !== undefined && assigneeId !== existingTask.assigneeId) {
      try {
        const assigneeUser = await getMemberUser(supabase, assigneeId);

        if (assigneeUser && assigneeUser.userId !== user.$id) {
          const title = `${user.name} assigned you ${task.name}`;
          const bodyText = task.summary ?? '';
          const notificationLink = `/workspaces/${task.workspaceId}/tasks`;

          await createNotification({
            supabase,
            userId: assigneeUser.userId,
            workspaceId: task.workspaceId,
            actorId: member.$id,
            taskId: task.id,
            type: 'task_assigned',
            title,
            body: bodyText,
            link: notificationLink,
            metadata: {
              taskId: task.id,
              projectId: task.projectId,
            },
          });

          await sendNotificationEmail({
            supabase,
            to: assigneeUser.email,
            subject: title,
            html: `<p>${title}</p><p>${bodyText}</p>`,
          });
        }
      } catch (error) {
        console.error('[TASK_ASSIGN_NOTIFICATION_ERROR]:', error);
      }
    }

    return ctx.json({ data: toDocument(task) });
  })
  .get('/:taskId/history', sessionMiddleware, async (ctx) => {
    const { taskId } = ctx.req.param();
    const user = ctx.get('user');
    const supabase = ctx.get('supabase');

    const { data: task } = await supabase.from(TASKS_TABLE).select('*').eq('id', taskId).single();

    if (!task) return ctx.json({ error: 'Task not found.' }, 404);

    const member = await getMember({
      supabase,
      workspaceId: task.workspaceId,
      userId: user.$id,
    });

    if (!member) return ctx.json({ error: 'Unauthorized.' }, 401);

    const { data: history } = await supabase
      .from(TASK_HISTORY_TABLE)
      .select('*')
      .eq('taskId', taskId)
      .order('created_at', { ascending: false });

    const historyDocs = toDocuments(history ?? []);
    const memberIds = [...new Set(historyDocs.map((entry) => entry.memberId).filter(Boolean))] as string[];

    const { data: members } = memberIds.length
      ? await supabase.from(MEMBERS_TABLE).select('*').in('id', memberIds)
      : { data: [] };

    const memberDocuments = toDocuments(members ?? []);

    const membersWithUsers = await Promise.all(
      memberDocuments.map(async (memberItem) => {
        const { data: userData } = await supabase.auth.admin.getUserById(memberItem.userId);

        return {
          ...memberItem,
          name:
            userData.user?.user_metadata?.full_name ??
            userData.user?.user_metadata?.name ??
            userData.user?.email?.split('@')[0] ??
            'User',
          email: userData.user?.email ?? '',
        };
      }),
    );

    const populatedHistory = historyDocs.map((entry) => ({
      ...entry,
      actor: membersWithUsers.find((memberItem) => memberItem.$id === entry.memberId) ?? null,
    }));

    return ctx.json({
      data: populatedHistory,
    });
  })
  .post(
    '/bulk-update',
    sessionMiddleware,
    zValidator(
      'json',
      z.object({
        tasks: z.array(
          z.object({
            $id: z.string(),
            status: z.nativeEnum(TaskStatus),
            position: z.number().int().positive().min(1000).max(1_00_000),
          }),
        ),
      }) as unknown as Parameters<typeof zValidator>[1],
    ),
    async (ctx) => {
      const supabase = ctx.get('supabase');
      const user = ctx.get('user');
      const { tasks } = ctx.req.valid('json') as {
        tasks: { $id: string; status: TaskStatus; position: number }[];
      };

      const taskIds = tasks.map((task) => task.$id);

      const { data: tasksToUpdate } = await supabase.from(TASKS_TABLE).select('id,workspaceId,status').in('id', taskIds);

      const workspaceIds = new Set((tasksToUpdate ?? []).map((task) => task.workspaceId));

      if (workspaceIds.size !== 1) {
        return ctx.json({ error: 'All tasks must belong to the same workspace.' }, 401);
      }

      const workspaceId = workspaceIds.values().next().value as string;

      const member = await getMember({
        supabase,
        workspaceId,
        userId: user.$id,
      });

      if (!member) {
        return ctx.json({ error: 'Unauthorized.' }, 401);
      }

      const existingStatusMap = new Map((tasksToUpdate ?? []).map((task) => [task.id, task.status] as const));

      const statusHistory = tasks
        .filter((task) => existingStatusMap.get(task.$id) !== task.status)
        .map((task) => ({
          taskId: task.$id,
          memberId: member.$id,
          field: 'status',
          fromValue: existingStatusMap.get(task.$id) ?? null,
          toValue: task.status ?? null,
        }));

      const updatedTasks = await Promise.all(
        tasks.map(async (task) => {
          const { $id, status, position } = task;

          const { data: updated } = await supabase
            .from(TASKS_TABLE)
            .update({ status, position, updated_at: new Date().toISOString() })
            .eq('id', $id)
            .select('*')
            .single();

          return updated ? toDocument(updated) : null;
        }),
      );

      if (statusHistory.length > 0) {
        await supabase.from(TASK_HISTORY_TABLE).insert(statusHistory);
      }

      return ctx.json({ data: { updatedTasks, workspaceId } });
    },
  )
  .delete('/:taskId', sessionMiddleware, async (ctx) => {
    const user = ctx.get('user');
    const supabase = ctx.get('supabase');

    const { taskId } = ctx.req.param();

    const { data: task } = await supabase.from(TASKS_TABLE).select('*').eq('id', taskId).single();

    if (!task) return ctx.json({ error: 'Task not found.' }, 404);

    const member = await getMember({
      supabase,
      workspaceId: task.workspaceId,
      userId: user.$id,
    });

    if (!member) {
      return ctx.json({ error: 'Unauthorized.' }, 401);
    }

    await supabase.from(TASKS_TABLE).delete().eq('id', taskId);

    return ctx.json({ data: toDocument(task) });
  });

export default app;
