import { zValidator } from '@hono/zod-validator';
import { createServerClient } from '@supabase/ssr';
import { Hono } from 'hono';
import { deleteCookie, getCookie, setCookie } from 'hono/cookie';
import { z } from 'zod';

import { AUTH_COOKIE, AUTH_REFRESH_COOKIE } from '@/features/auth/constants';
import { signInFormSchema, signUpFormSchema } from '@/features/auth/schema';
import { setAuthCookies } from '@/lib/auth-cookies';
import { sessionMiddleware } from '@/lib/session-middleware';
import { createSupabaseClient } from '@/lib/supabase';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const app = new Hono()
  .get(
    '/callback',
    zValidator(
      'query',
      z.object({
        code: z.string().trim().min(1),
      }) as unknown as Parameters<typeof zValidator>[1],
    ),
    async (ctx) => {
      const { code } = ctx.req.valid('query');

      const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
        cookies: {
          getAll: () => {
            const all = getCookie(ctx);
            return Object.entries(all ?? {}).map(([name, value]) => ({ name, value }));
          },
          setAll: (cookies) => {
            cookies.forEach(({ name, value, options }) => {
              setCookie(ctx, name, value, options as Parameters<typeof setCookie>[3]);
            });
          },
        },
      });

      const { data, error } = await supabase.auth.exchangeCodeForSession(code);

      if (error || !data.session) {
        return ctx.redirect(`${process.env.NEXT_PUBLIC_APP_BASE_URL}/sign-in`);
      }

      setAuthCookies((name, value, options) => setCookie(ctx, name, value, options), data.session.access_token, data.session.refresh_token);

      return ctx.redirect(process.env.NEXT_PUBLIC_APP_BASE_URL);
    },
  )
  .get('/current', sessionMiddleware, (ctx) => {
    const user = ctx.get('user');

    return ctx.json({ data: user });
  })
  .post('/login', zValidator('json', signInFormSchema as unknown as Parameters<typeof zValidator>[1]), async (ctx) => {
    const { email, password } = ctx.req.valid('json');

    const supabase = createSupabaseClient();

    const { data, error } = await supabase.auth.signInWithPassword({ email, password });

    if (error || !data.session) {
      return ctx.json({ error: 'Invalid credentials.' }, 401);
    }

    setAuthCookies((name, value, options) => setCookie(ctx, name, value, options), data.session.access_token, data.session.refresh_token);

    return ctx.json({ success: true });
  })
  .post(
    '/session',
    zValidator(
      'json',
      z.object({
        accessToken: z.string().trim().min(1),
        refreshToken: z.string().trim().min(1),
      }) as unknown as Parameters<typeof zValidator>[1],
    ),
    async (ctx) => {
      const { accessToken, refreshToken } = ctx.req.valid('json');

      setAuthCookies((name, value, options) => setCookie(ctx, name, value, options), accessToken, refreshToken);

      return ctx.json({ success: true });
    },
  )
  .post('/register', zValidator('json', signUpFormSchema as unknown as Parameters<typeof zValidator>[1]), async (ctx) => {
    const { name, email, password } = ctx.req.valid('json');

    const supabase = createSupabaseClient();

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: name,
        },
      },
    });

    if (error) {
      return ctx.json({ error: error.message ?? 'Failed to register.' }, 400);
    }

    if (data.session) {
      setAuthCookies((name, value, options) => setCookie(ctx, name, value, options), data.session.access_token, data.session.refresh_token);
    }

    return ctx.json({ success: true, needsConfirmation: !data.session });
  })
  .post('/logout', sessionMiddleware, async (ctx) => {
    deleteCookie(ctx, AUTH_COOKIE);
    deleteCookie(ctx, AUTH_REFRESH_COOKIE);

    return ctx.json({ success: true });
  });

export default app;
