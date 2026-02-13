import { zValidator } from '@hono/zod-validator';
import { endOfMonth, startOfMonth, subMonths } from 'date-fns';
import { Hono } from 'hono';
import { z } from 'zod';

import { IMAGES_BUCKET, PROJECTS_TABLE, TASKS_TABLE } from '@/config/db';
import { getMember } from '@/features/members/utils';
import { createProjectSchema, updateProjectSchema } from '@/features/projects/schema';
import type { Project } from '@/features/projects/types';
import { TaskStatus } from '@/features/tasks/types';
import { sessionMiddleware } from '@/lib/session-middleware';
import { toDocument, toDocuments } from '@/lib/supabase';

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
  .post('/', sessionMiddleware, zValidator('form', createProjectSchema as unknown as Parameters<typeof zValidator>[1]), async (ctx) => {
    const supabase = ctx.get('supabase');
    const storage = ctx.get('storage');
    const user = ctx.get('user');

    const { name, image, workspaceId } = ctx.req.valid('form');

    const member = await getMember({
      supabase,
      workspaceId,
      userId: user.$id,
    });

    if (!member) {
      return ctx.json({ error: 'Unauthorized.' }, 401);
    }

    let uploadedImageId: string | undefined = undefined;

    if (image instanceof File) {
      uploadedImageId = await uploadImage(storage, image, 'projects');
    } else {
      uploadedImageId = image;
    }

    const { data: project, error } = await supabase
      .from(PROJECTS_TABLE)
      .insert({
        name,
        imageId: uploadedImageId,
        workspaceId,
      })
      .select('*')
      .single();

    if (error || !project) return ctx.json({ error: 'Failed to create project.' }, 400);

    return ctx.json({ data: toDocument(project) });
  })
  .get(
    '/',
    sessionMiddleware,
    zValidator(
      'query',
      z.object({
        workspaceId: z.string(),
      }) as unknown as Parameters<typeof zValidator>[1],
    ),
    async (ctx) => {
      const user = ctx.get('user');
      const supabase = ctx.get('supabase');
      const storage = ctx.get('storage');

      const { workspaceId } = ctx.req.valid('query');

      const member = await getMember({
        supabase,
        workspaceId,
        userId: user.$id,
      });

      if (!member) {
        return ctx.json({ error: 'Unauthorized.' }, 401);
      }

      const { data: projects, count } = await supabase
        .from(PROJECTS_TABLE)
        .select('*', { count: 'exact' })
        .eq('workspaceId', workspaceId)
        .order('created_at', { ascending: false });

      const projectsWithImages: Project[] = await Promise.all(
        toDocuments(projects ?? []).map(async (project) => ({
          ...project,
          imageUrl: getPublicImageUrl(storage, project.imageId),
        })),
      );

      return ctx.json({
        data: {
          documents: projectsWithImages,
          total: count ?? 0,
        },
      });
    },
  )
  .get('/:projectId', sessionMiddleware, async (ctx) => {
    const user = ctx.get('user');
    const supabase = ctx.get('supabase');
    const storage = ctx.get('storage');

    const { projectId } = ctx.req.param();

    const { data: project } = await supabase.from(PROJECTS_TABLE).select('*').eq('id', projectId).single();

    if (!project) return ctx.json({ error: 'Project not found.' }, 404);

    const member = await getMember({
      supabase,
      workspaceId: project.workspaceId,
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

    const projectDoc = toDocument(project) as Project;

    return ctx.json({
      data: {
        ...projectDoc,
        imageUrl: getPublicImageUrl(storage, projectDoc.imageId),
      },
    });
  })
  .patch('/:projectId', sessionMiddleware, zValidator('form', updateProjectSchema as unknown as Parameters<typeof zValidator>[1]), async (ctx) => {
    const supabase = ctx.get('supabase');
    const storage = ctx.get('storage');
    const user = ctx.get('user');

    const { projectId } = ctx.req.param();
    const { name, image } = ctx.req.valid('form');

    const { data: existingProject } = await supabase.from(PROJECTS_TABLE).select('*').eq('id', projectId).single();

    if (!existingProject) return ctx.json({ error: 'Project not found.' }, 404);

    const member = await getMember({
      supabase,
      workspaceId: existingProject.workspaceId,
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

    let uploadedImageId: string | undefined = undefined;

    if (image instanceof File) {
      uploadedImageId = await uploadImage(storage, image, 'projects');

      if (existingProject.imageId) await storage.from(IMAGES_BUCKET).remove([existingProject.imageId]);
    }

    const updates: Record<string, unknown> = {};

    if (name) updates.name = name;
    if (uploadedImageId !== undefined) updates.imageId = uploadedImageId;

    const { data: project } = await supabase.from(PROJECTS_TABLE).update(updates).eq('id', projectId).select('*').single();

    if (!project) return ctx.json({ error: 'Project not found.' }, 404);

    return ctx.json({ data: toDocument(project) });
  })
  .delete('/:projectId', sessionMiddleware, async (ctx) => {
    const supabase = ctx.get('supabase');
    const storage = ctx.get('storage');
    const user = ctx.get('user');

    const { projectId } = ctx.req.param();

    const { data: existingProject } = await supabase.from(PROJECTS_TABLE).select('*').eq('id', projectId).single();

    if (!existingProject) return ctx.json({ error: 'Project not found.' }, 404);

    const member = await getMember({
      supabase,
      workspaceId: existingProject.workspaceId,
      userId: user.$id,
    });

    if (!member) {
      return ctx.json({ error: 'Unauthorized.' }, 401);
    }

    await supabase.from(TASKS_TABLE).delete().eq('projectId', projectId);

    if (existingProject.imageId) await storage.from(IMAGES_BUCKET).remove([existingProject.imageId]);

    await supabase.from(PROJECTS_TABLE).delete().eq('id', projectId);

    return ctx.json({ data: { $id: existingProject.id, workspaceId: existingProject.workspaceId } });
  })
  .get('/:projectId/analytics', sessionMiddleware, async (ctx) => {
    const supabase = ctx.get('supabase');
    const user = ctx.get('user');
    const { projectId } = ctx.req.param();

    const { data: project } = await supabase.from(PROJECTS_TABLE).select('*').eq('id', projectId).single();

    if (!project) return ctx.json({ error: 'Project not found.' }, 404);

    const member = await getMember({
      supabase,
      workspaceId: project.workspaceId,
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
      .eq('projectId', projectId)
      .gte('created_at', thisMonthStart.toISOString())
      .lte('created_at', thisMonthEnd.toISOString());

    const { count: lastMonthTasks } = await supabase
      .from(TASKS_TABLE)
      .select('id', { count: 'exact', head: true })
      .eq('projectId', projectId)
      .gte('created_at', lastMonthStart.toISOString())
      .lte('created_at', lastMonthEnd.toISOString());

    const taskCount = thisMonthTasks ?? 0;
    const taskDifference = taskCount - (lastMonthTasks ?? 0);

    const { count: thisMonthAssignedTasks } = await supabase
      .from(TASKS_TABLE)
      .select('id', { count: 'exact', head: true })
      .eq('projectId', projectId)
      .eq('assigneeId', member.$id)
      .gte('created_at', thisMonthStart.toISOString())
      .lte('created_at', thisMonthEnd.toISOString());

    const { count: lastMonthAssignedTasks } = await supabase
      .from(TASKS_TABLE)
      .select('id', { count: 'exact', head: true })
      .eq('projectId', projectId)
      .eq('assigneeId', member.$id)
      .gte('created_at', lastMonthStart.toISOString())
      .lte('created_at', lastMonthEnd.toISOString());

    const assignedTaskCount = thisMonthAssignedTasks ?? 0;
    const assignedTaskDifference = assignedTaskCount - (lastMonthAssignedTasks ?? 0);

    const { count: thisMonthIncompleteTasks } = await supabase
      .from(TASKS_TABLE)
      .select('id', { count: 'exact', head: true })
      .eq('projectId', projectId)
      .neq('status', TaskStatus.DONE)
      .gte('created_at', thisMonthStart.toISOString())
      .lte('created_at', thisMonthEnd.toISOString());

    const { count: lastMonthIncompleteTasks } = await supabase
      .from(TASKS_TABLE)
      .select('id', { count: 'exact', head: true })
      .eq('projectId', projectId)
      .neq('status', TaskStatus.DONE)
      .gte('created_at', lastMonthStart.toISOString())
      .lte('created_at', lastMonthEnd.toISOString());

    const incompleteTaskCount = thisMonthIncompleteTasks ?? 0;
    const incompleteTaskDifference = incompleteTaskCount - (lastMonthIncompleteTasks ?? 0);

    const { count: thisMonthCompletedTasks } = await supabase
      .from(TASKS_TABLE)
      .select('id', { count: 'exact', head: true })
      .eq('projectId', projectId)
      .eq('status', TaskStatus.DONE)
      .gte('created_at', thisMonthStart.toISOString())
      .lte('created_at', thisMonthEnd.toISOString());

    const { count: lastMonthCompletedTasks } = await supabase
      .from(TASKS_TABLE)
      .select('id', { count: 'exact', head: true })
      .eq('projectId', projectId)
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
  });

export default app;
