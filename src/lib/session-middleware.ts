import { getCookie, setCookie } from 'hono/cookie';
import { createMiddleware } from 'hono/factory';
import 'server-only';

import { AUTH_COOKIE, AUTH_REFRESH_COOKIE } from '@/features/auth/constants';
import { setAuthCookies } from '@/lib/auth-cookies';
import { type AuthUser, createSupabaseAdminClient, createSupabaseClient, mapAuthUser } from '@/lib/supabase';

type AdditionalContext = {
  Variables: {
    supabase: ReturnType<typeof createSupabaseAdminClient>;
    storage: ReturnType<typeof createSupabaseAdminClient>['storage'];
    user: AuthUser;
  };
};

export const sessionMiddleware = createMiddleware<AdditionalContext>(async (ctx, next) => {
  const accessToken = getCookie(ctx, AUTH_COOKIE);
  const refreshToken = getCookie(ctx, AUTH_REFRESH_COOKIE);

  if (!accessToken) return ctx.json({ error: 'Unauthorized.' }, 401);

  const authClient = createSupabaseClient();
  const userResponse = await authClient.auth.getUser(accessToken);

  let authUser = userResponse.data.user ?? null;

  if (!authUser && refreshToken) {
    const refreshed = await authClient.auth.refreshSession({ refresh_token: refreshToken });

    if (refreshed.data.session?.user) {
      setAuthCookies((name, value, options) => setCookie(ctx, name, value, options), refreshed.data.session.access_token, refreshed.data.session.refresh_token);
      authUser = refreshed.data.session.user;
    }
  }

  if (!authUser) return ctx.json({ error: 'Unauthorized.' }, 401);

  const supabase = createSupabaseAdminClient();

  ctx.set('supabase', supabase);
  ctx.set('storage', supabase.storage);
  ctx.set('user', mapAuthUser(authUser));

  await next();
});
