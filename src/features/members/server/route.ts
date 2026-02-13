import { zValidator } from '@hono/zod-validator';
import { Hono } from 'hono';
import { z } from 'zod';

import { MEMBERS_TABLE, WORKSPACES_TABLE } from '@/config/db';
import { MemberRole, type Member } from '@/features/members/types';
import { getMember } from '@/features/members/utils';
import { sessionMiddleware } from '@/lib/session-middleware';
import { toDocuments } from '@/lib/supabase';

const app = new Hono()
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
      const supabase = ctx.get('supabase');
      const user = ctx.get('user');
      const { workspaceId } = ctx.req.valid('query');

      const member = await getMember({
        supabase,
        workspaceId,
        userId: user.$id,
      });

      if (!member) {
        return ctx.json({ error: 'Unauthorized.' }, 401);
      }

      const { data: members } = await supabase.from(MEMBERS_TABLE).select('*').eq('workspaceId', workspaceId);

      const memberDocuments = toDocuments(members ?? []) as Member[];

      const populatedMembers = await Promise.all(
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

      return ctx.json({
        data: {
          documents: populatedMembers,
          total: populatedMembers.length,
        },
      });
    },
  )
  .delete('/:memberId', sessionMiddleware, async (ctx) => {
    const { memberId } = ctx.req.param();
    const user = ctx.get('user');
    const supabase = ctx.get('supabase');

    const { data: memberToDelete } = await supabase.from(MEMBERS_TABLE).select('*').eq('id', memberId).single();

    if (!memberToDelete) return ctx.json({ error: 'Member not found.' }, 404);

    const { count } = await supabase
      .from(MEMBERS_TABLE)
      .select('id', { count: 'exact', head: true })
      .eq('workspaceId', memberToDelete.workspaceId);

    if ((count ?? 0) === 1) {
      return ctx.json(
        {
          error: 'Cannot delete the only member.',
        },
        400,
      );
    }

    const member = await getMember({
      supabase,
      workspaceId: memberToDelete.workspaceId,
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

    const { data: workspace } = await supabase.from(WORKSPACES_TABLE).select('userId').eq('id', memberToDelete.workspaceId).single();

    if (!workspace) return ctx.json({ error: 'Workspace not found.' }, 404);

    const isOwner = workspace.userId === user.$id;
    const isAdmin = member.role === MemberRole.ADMIN;

    if (!isOwner && !isAdmin) {
      return ctx.json({ error: 'Unauthorized.' }, 401);
    }

    if (memberToDelete.userId === workspace.userId) {
      return ctx.json({ error: 'Cannot remove the workspace owner.' }, 400);
    }

    if (!isOwner && memberToDelete.role !== MemberRole.MEMBER) {
      return ctx.json({ error: 'Unauthorized.' }, 401);
    }

    await supabase.from(MEMBERS_TABLE).delete().eq('id', memberId);

    return ctx.json({ data: { $id: memberId, workspaceId: memberToDelete.workspaceId } });
  })
  .patch(
    '/:memberId',
    sessionMiddleware,
    zValidator(
      'json',
      z.object({
        role: z.nativeEnum(MemberRole),
      }) as unknown as Parameters<typeof zValidator>[1],
    ),
    async (ctx) => {
      const { memberId } = ctx.req.param();
      const { role } = ctx.req.valid('json');
      const user = ctx.get('user');
      const supabase = ctx.get('supabase');

      const { data: memberToUpdate } = await supabase.from(MEMBERS_TABLE).select('*').eq('id', memberId).single();

      if (!memberToUpdate) return ctx.json({ error: 'Member not found.' }, 404);

      const { count } = await supabase
        .from(MEMBERS_TABLE)
        .select('id', { count: 'exact', head: true })
        .eq('workspaceId', memberToUpdate.workspaceId);

      if ((count ?? 0) === 1) {
        return ctx.json(
          {
            error: 'Cannot downgrade the only member.',
          },
          400,
        );
      }

      const member = await getMember({
        supabase,
        workspaceId: memberToUpdate.workspaceId,
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

      const { data: workspace } = await supabase.from(WORKSPACES_TABLE).select('userId').eq('id', memberToUpdate.workspaceId).single();

      if (!workspace) return ctx.json({ error: 'Workspace not found.' }, 404);

      const isOwner = workspace.userId === user.$id;

      if (!isOwner) {
        return ctx.json({ error: 'Unauthorized.' }, 401);
      }

      if (memberToUpdate.userId === workspace.userId) {
        return ctx.json({ error: 'Cannot change the owner role.' }, 400);
      }

      await supabase.from(MEMBERS_TABLE).update({ role }).eq('id', memberId);

      return ctx.json({ data: { $id: memberId, workspaceId: memberToUpdate.workspaceId } });
    },
  );

export default app;
