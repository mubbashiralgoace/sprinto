import { zValidator } from '@hono/zod-validator';
import { Hono } from 'hono';
import { z } from 'zod';

import { NOTIFICATIONS_TABLE } from '@/config/db';
import { sessionMiddleware } from '@/lib/session-middleware';
import { toDocument, toDocuments } from '@/lib/supabase';

const app = new Hono()
  .get(
    '/',
    sessionMiddleware,
    zValidator(
      'query',
      z.object({
        workspaceId: z.string().optional(),
        limit: z.coerce.number().int().min(1).max(50).optional(),
      }) as unknown as Parameters<typeof zValidator>[1],
    ),
    async (ctx) => {
      const supabase = ctx.get('supabase');
      const user = ctx.get('user');
      const { workspaceId, limit } = ctx.req.valid('query');

      let query = supabase.from(NOTIFICATIONS_TABLE).select('*').eq('userId', user.$id).order('created_at', { ascending: false });

      if (workspaceId) query = query.eq('workspaceId', workspaceId);
      if (limit) query = query.limit(limit);

      const { data: notifications } = await query;
      const documents = toDocuments(notifications ?? []);

      const unreadCount = documents.filter((notification) => !notification.read_at).length;

      return ctx.json({
        data: {
          documents,
          unreadCount,
        },
      });
    },
  )
  .patch(
    '/read',
    sessionMiddleware,
    zValidator(
      'json',
      z.object({
        workspaceId: z.string().optional(),
      }) as unknown as Parameters<typeof zValidator>[1],
    ),
    async (ctx) => {
      const supabase = ctx.get('supabase');
      const user = ctx.get('user');
      const { workspaceId } = ctx.req.valid('json');

      let query = supabase.from(NOTIFICATIONS_TABLE).update({ read_at: new Date().toISOString() }).eq('userId', user.$id).is('read_at', null);

      if (workspaceId) query = query.eq('workspaceId', workspaceId);

      const { data: notifications } = await query.select('*');

      return ctx.json({ data: toDocuments(notifications ?? []) });
    },
  )
  .patch(
    '/:notificationId/read',
    sessionMiddleware,
    async (ctx) => {
      const { notificationId } = ctx.req.param();
      const supabase = ctx.get('supabase');
      const user = ctx.get('user');

      const { data: notification } = await supabase
        .from(NOTIFICATIONS_TABLE)
        .update({ read_at: new Date().toISOString() })
        .eq('id', notificationId)
        .eq('userId', user.$id)
        .select('*')
        .single();

      if (!notification) return ctx.json({ error: 'Notification not found.' }, 404);

      return ctx.json({ data: toDocument(notification) });
    },
  );

export default app;
