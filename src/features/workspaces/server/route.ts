import { zValidator } from '@hono/zod-validator';
import { endOfMonth, startOfMonth, subMonths } from 'date-fns';
import { Hono } from 'hono';
import { z } from 'zod';

import { IMAGES_BUCKET, MEMBERS_TABLE, PROJECTS_TABLE, TASKS_TABLE, WORKSPACES_TABLE } from '@/config/db';
import { MemberRole } from '@/features/members/types';
import { getMember } from '@/features/members/utils';
import { TaskStatus } from '@/features/tasks/types';
import { createWorkspaceSchema, updateWorkspaceSchema } from '@/features/workspaces/schema';
import type { Workspace } from '@/features/workspaces/types';
import { sessionMiddleware } from '@/lib/session-middleware';
import { toDocument, toDocuments } from '@/lib/supabase';
import { generateInviteCode } from '@/lib/utils';

const getPublicImageUrl = (storage: any, imagePath?: string) => {
  if (!imagePath) return undefined;

  const { data } = storage.from(IMAGES_BUCKET).getPublicUrl(imagePath);

  return data.publicUrl;
};

const uploadImage = async (storage: any, image: File, prefix: string) => {
  const fileExt = image.name.split('.').at(-1) ?? 'png';
  const fileName = `${crypto.randomUUID()}.${fileExt}`;
  const filePath = `${prefix}/${fileName}`;

  const { error } = await storage.from(IMAGES_BUCKET).upload(filePath, image, {
    contentType: image.type,
    upsert: true,
  });

  if (error) throw error;

  return filePath;
};

const app = new Hono()
  .get('/', sessionMiddleware, async (ctx) => {
    const supabase = ctx.get('supabase');
    const user = ctx.get('user');
    const storage = ctx.get('storage');

    const { data: members } = await supabase.from(MEMBERS_TABLE).select('*').eq('userId', user.$id);

    if (!members || members.length === 0) return ctx.json({ data: { documents: [], total: 0 } });

    const workspaceIds = members.map((member: { workspaceId: string }) => member.workspaceId);

    const { data: workspaces, count } = await supabase
      .from(WORKSPACES_TABLE)
      .select('*', { count: 'exact' })
      .in('id', workspaceIds)
      .order('created_at', { ascending: false });

    const workspacesWithImages: Workspace[] = await Promise.all(
      toDocuments(workspaces ?? []).map(async (workspace) => ({
        ...workspace,
        imageUrl: getPublicImageUrl(storage, workspace.imageId),
      })),
    );

    return ctx.json({
      data: {
        documents: workspacesWithImages,
        total: count ?? 0,
      },
    });
  })
  .post('/', zValidator('form', createWorkspaceSchema as unknown as Parameters<typeof zValidator>[1]), sessionMiddleware, async (ctx) => {
    const supabase = ctx.get('supabase');
    const storage = ctx.get('storage');
    const user = ctx.get('user');

    const { name, image } = ctx.req.valid('form');

    let uploadedImageId: string | undefined = undefined;

    if (image instanceof File) {
      uploadedImageId = await uploadImage(storage, image, 'workspaces');
    } else {
      uploadedImageId = image;
    }

    const { data: workspace, error } = await supabase
      .from(WORKSPACES_TABLE)
      .insert({
        name,
        userId: user.$id,
        imageId: uploadedImageId,
        inviteCode: generateInviteCode(6),
      })
      .select('*')
      .single();

    if (error || !workspace) return ctx.json({ error: 'Failed to create workspace.' }, 400);

    await supabase.from(MEMBERS_TABLE).insert({
      userId: user.$id,
      workspaceId: workspace.id,
      role: MemberRole.ADMIN,
    });

    return ctx.json({ data: toDocument(workspace) });
  })
  .get('/:workspaceId', sessionMiddleware, async (ctx) => {
    const user = ctx.get('user');
    const supabase = ctx.get('supabase');
    const storage = ctx.get('storage');
    const { workspaceId } = ctx.req.param();

    const member = await getMember({
      supabase,
      workspaceId,
      userId: user.$id,
    });

    if (!member) {
      return ctx.json(
        {
          error: 'Unauthorized.',
        },
        401,
      );
    }

    const { data: workspace } = await supabase.from(WORKSPACES_TABLE).select('*').eq('id', workspaceId).single();

    if (!workspace) return ctx.json({ error: 'Workspace not found.' }, 404);

    const workspaceDoc = toDocument(workspace) as Workspace;

    return ctx.json({
      data: {
        ...workspaceDoc,
        imageUrl: getPublicImageUrl(storage, workspaceDoc.imageId),
      },
    });
  })
  .get('/:workspaceId/info', sessionMiddleware, async (ctx) => {
    const supabase = ctx.get('supabase');
    const { workspaceId } = ctx.req.param();

    const { data: workspace } = await supabase.from(WORKSPACES_TABLE).select('id,name').eq('id', workspaceId).single();

    if (!workspace) return ctx.json({ error: 'Workspace not found.' }, 404);

    return ctx.json({
      data: {
        $id: workspace.id,
        name: workspace.name,
      },
    });
  })
  .patch('/:workspaceId', sessionMiddleware, zValidator('form', updateWorkspaceSchema as unknown as Parameters<typeof zValidator>[1]), async (ctx) => {
    const supabase = ctx.get('supabase');
    const storage = ctx.get('storage');
    const user = ctx.get('user');

    const { workspaceId } = ctx.req.param();
    const { name, image } = ctx.req.valid('form');

    const { data: existingWorkspace } = await supabase.from(WORKSPACES_TABLE).select('*').eq('id', workspaceId).single();

    if (!existingWorkspace) return ctx.json({ error: 'Workspace not found.' }, 404);

    const member = await getMember({
      supabase,
      workspaceId,
      userId: user.$id,
    });

    if (!member || member.role !== MemberRole.ADMIN) {
      return ctx.json(
        {
          error: 'Unauthorized.',
        },
        401,
      );
    }

    let uploadedImageId: string | undefined = undefined;

    if (image instanceof File) {
      uploadedImageId = await uploadImage(storage, image, 'workspaces');

      if (existingWorkspace.imageId) {
        await storage.from(IMAGES_BUCKET).remove([existingWorkspace.imageId]);
      }
    }

    const updates: Record<string, unknown> = {};

    if (name) updates.name = name;
    if (uploadedImageId !== undefined) updates.imageId = uploadedImageId;

    const { data: workspace } = await supabase.from(WORKSPACES_TABLE).update(updates).eq('id', workspaceId).select('*').single();

    if (!workspace) return ctx.json({ error: 'Workspace not found.' }, 404);

    return ctx.json({ data: toDocument(workspace) });
  })
  .delete('/:workspaceId', sessionMiddleware, async (ctx) => {
    const supabase = ctx.get('supabase');
    const storage = ctx.get('storage');
    const user = ctx.get('user');

    const { workspaceId } = ctx.req.param();

    const member = await getMember({
      supabase,
      workspaceId,
      userId: user.$id,
    });

    const { data: workspace } = await supabase.from(WORKSPACES_TABLE).select('userId').eq('id', workspaceId).single();

    if (!workspace) return ctx.json({ error: 'Workspace not found.' }, 404);

    if (!member || workspace.userId !== user.$id) {
      return ctx.json({ error: 'Unauthorized.' }, 401);
    }

    const { data: existingWorkspace } = await supabase.from(WORKSPACES_TABLE).select('*').eq('id', workspaceId).single();

    if (!existingWorkspace) return ctx.json({ error: 'Workspace not found.' }, 404);

    const { data: projects } = await supabase.from(PROJECTS_TABLE).select('imageId').eq('workspaceId', workspaceId);

    const projectImages = (projects ?? []).map((project: { imageId?: string | null }) => project.imageId).filter(Boolean) as string[];

    if (projectImages.length > 0) {
      await storage.from(IMAGES_BUCKET).remove(projectImages);
    }

    if (existingWorkspace.imageId) {
      await storage.from(IMAGES_BUCKET).remove([existingWorkspace.imageId]);
    }

    await supabase.from(TASKS_TABLE).delete().eq('workspaceId', workspaceId);
    await supabase.from(PROJECTS_TABLE).delete().eq('workspaceId', workspaceId);
    await supabase.from(MEMBERS_TABLE).delete().eq('workspaceId', workspaceId);
    await supabase.from(WORKSPACES_TABLE).delete().eq('id', workspaceId);

    return ctx.json({ data: { $id: workspaceId } });
  })
  .post('/:workspaceId/resetInviteCode', sessionMiddleware, async (ctx) => {
    const supabase = ctx.get('supabase');
    const user = ctx.get('user');

    const { workspaceId } = ctx.req.param();

    const member = await getMember({
      supabase,
      workspaceId,
      userId: user.$id,
    });

    if (!member || member.role !== MemberRole.ADMIN) {
      return ctx.json({ error: 'Unauthorized.' }, 401);
    }

    const { data: updatedWorkspace } = await supabase
      .from(WORKSPACES_TABLE)
      .update({ inviteCode: generateInviteCode(6) })
      .eq('id', workspaceId)
      .select('*')
      .single();

    if (!updatedWorkspace) return ctx.json({ error: 'Workspace not found.' }, 404);

    return ctx.json({ data: toDocument(updatedWorkspace) });
  })
  .post(
    '/:workspaceId/join',
    sessionMiddleware,
    zValidator(
      'json',
      z.object({
        code: z.string(),
      }) as unknown as Parameters<typeof zValidator>[1],
    ),
    async (ctx) => {
      const { workspaceId } = ctx.req.param();
      const { code } = ctx.req.valid('json');

      const supabase = ctx.get('supabase');
      const user = ctx.get('user');

      const member = await getMember({
        supabase,
        workspaceId,
        userId: user.$id,
      });

      if (member) {
        return ctx.json({ error: 'Already a member.' }, 400);
      }

      const { data: workspace } = await supabase.from(WORKSPACES_TABLE).select('*').eq('id', workspaceId).single();

      if (!workspace) return ctx.json({ error: 'Workspace not found.' }, 404);

      if (workspace.inviteCode !== code) {
        return ctx.json({ error: 'Invalid invite code.' }, 400);
      }

      await supabase.from(MEMBERS_TABLE).insert({
        workspaceId,
        userId: user.$id,
        role: MemberRole.MEMBER,
      });

      return ctx.json({ data: toDocument(workspace) });
    },
  )
  .get('/:workspaceId/analytics', sessionMiddleware, async (ctx) => {
    const supabase = ctx.get('supabase');
    const user = ctx.get('user');
    const { workspaceId } = ctx.req.param();

    const member = await getMember({
      supabase,
      workspaceId,
      userId: user.$id,
    });

    if (!member) {
      return ctx.json({ error: 'Unauthorized.' }, 401);
    }

    const now = new Date();
    const thisMonthStart = startOfMonth(now);
    const thisMonthEnd = endOfMonth(now);
    const lastMonthStart = startOfMonth(subMonths(now, 1));
    const lastMonthEnd = endOfMonth(subMonths(now, 1));

    const { count: thisMonthTasks } = await supabase
      .from(TASKS_TABLE)
      .select('id', { count: 'exact', head: true })
      .eq('workspaceId', workspaceId)
      .gte('created_at', thisMonthStart.toISOString())
      .lte('created_at', thisMonthEnd.toISOString());

    const { count: lastMonthTasks } = await supabase
      .from(TASKS_TABLE)
      .select('id', { count: 'exact', head: true })
      .eq('workspaceId', workspaceId)
      .gte('created_at', lastMonthStart.toISOString())
      .lte('created_at', lastMonthEnd.toISOString());

    const taskCount = thisMonthTasks ?? 0;
    const taskDifference = taskCount - (lastMonthTasks ?? 0);

    const { count: thisMonthAssignedTasks } = await supabase
      .from(TASKS_TABLE)
      .select('id', { count: 'exact', head: true })
      .eq('workspaceId', workspaceId)
      .eq('assigneeId', member.$id)
      .gte('created_at', thisMonthStart.toISOString())
      .lte('created_at', thisMonthEnd.toISOString());

    const { count: lastMonthAssignedTasks } = await supabase
      .from(TASKS_TABLE)
      .select('id', { count: 'exact', head: true })
      .eq('workspaceId', workspaceId)
      .eq('assigneeId', member.$id)
      .gte('created_at', lastMonthStart.toISOString())
      .lte('created_at', lastMonthEnd.toISOString());

    const assignedTaskCount = thisMonthAssignedTasks ?? 0;
    const assignedTaskDifference = assignedTaskCount - (lastMonthAssignedTasks ?? 0);

    const { count: thisMonthIncompleteTasks } = await supabase
      .from(TASKS_TABLE)
      .select('id', { count: 'exact', head: true })
      .eq('workspaceId', workspaceId)
      .neq('status', TaskStatus.DONE)
      .gte('created_at', thisMonthStart.toISOString())
      .lte('created_at', thisMonthEnd.toISOString());

    const { count: lastMonthIncompleteTasks } = await supabase
      .from(TASKS_TABLE)
      .select('id', { count: 'exact', head: true })
      .eq('workspaceId', workspaceId)
      .neq('status', TaskStatus.DONE)
      .gte('created_at', lastMonthStart.toISOString())
      .lte('created_at', lastMonthEnd.toISOString());

    const incompleteTaskCount = thisMonthIncompleteTasks ?? 0;
    const incompleteTaskDifference = incompleteTaskCount - (lastMonthIncompleteTasks ?? 0);

    const { count: thisMonthCompletedTasks } = await supabase
      .from(TASKS_TABLE)
      .select('id', { count: 'exact', head: true })
      .eq('workspaceId', workspaceId)
      .eq('status', TaskStatus.DONE)
      .gte('created_at', thisMonthStart.toISOString())
      .lte('created_at', thisMonthEnd.toISOString());

    const { count: lastMonthCompletedTasks } = await supabase
      .from(TASKS_TABLE)
      .select('id', { count: 'exact', head: true })
      .eq('workspaceId', workspaceId)
      .eq('status', TaskStatus.DONE)
      .gte('created_at', lastMonthStart.toISOString())
      .lte('created_at', lastMonthEnd.toISOString());

    const completedTaskCount = thisMonthCompletedTasks ?? 0;
    const completedTaskDifference = completedTaskCount - (lastMonthCompletedTasks ?? 0);

    const overdueTaskCount = 0;
    const overdueTaskDifference = 0;

    return ctx.json({
      data: {
        taskCount,
        taskDifference,
        assignedTaskCount,
        assignedTaskDifference,
        completedTaskCount,
        completedTaskDifference,
        incompleteTaskCount,
        incompleteTaskDifference,
        overdueTaskCount,
        overdueTaskDifference,
      },
    });
  })
  .get('/:workspaceId/tasks', sessionMiddleware, async (ctx) => {
    const supabase = ctx.get('supabase');
    const user = ctx.get('user');
    const { workspaceId } = ctx.req.param();

    const member = await getMember({
      supabase,
      workspaceId,
      userId: user.$id,
    });

    if (!member) {
      return ctx.json({ error: 'Unauthorized.' }, 401);
    }

    const { data: tasks, count } = await supabase
      .from(TASKS_TABLE)
      .select('*', { count: 'exact' })
      .eq('workspaceId', workspaceId);

    return ctx.json({ data: { documents: toDocuments(tasks ?? []), total: count ?? 0 } });
  });

export default app;
