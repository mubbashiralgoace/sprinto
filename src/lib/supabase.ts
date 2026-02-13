import { createClient, type SupabaseClient, type User } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import 'server-only';

import { AUTH_COOKIE, AUTH_REFRESH_COOKIE } from '@/features/auth/constants';
import { authCookieOptions } from '@/lib/auth-cookies';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export type AuthUser = {
  $id: string;
  name: string;
  email: string;
};

type DocumentRow = {
  id: string;
  created_at?: string | null;
  updated_at?: string | null;
};

export const toDocument = <T extends DocumentRow>(row: T) => {
  const { id, created_at, updated_at, ...rest } = row as DocumentRow & Record<string, unknown>;

  return {
    ...rest,
    $id: id,
    $createdAt: created_at ?? '',
    $updatedAt: updated_at ?? '',
  } as T & { $id: string; $createdAt: string; $updatedAt: string };
};

export const toDocuments = <T extends DocumentRow>(rows: T[]) => rows.map((row) => toDocument(row));

export const createSupabaseClient = (): SupabaseClient =>
  createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

export const createSupabaseAdminClient = (): SupabaseClient =>
  createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

export const mapAuthUser = (user: User): AuthUser => ({
  $id: user.id,
  name:
    user.user_metadata?.full_name ??
    user.user_metadata?.name ??
    user.email?.split('@')[0] ??
    'User',
  email: user.email ?? '',
});

export const createSessionClient = async () => {
  const cookieStore = await cookies();
  const accessToken = cookieStore.get(AUTH_COOKIE)?.value;
  const refreshToken = cookieStore.get(AUTH_REFRESH_COOKIE)?.value;

  if (!accessToken) throw new Error('Unauthorized.');

  const authClient = createSupabaseClient();
  const adminClient = createSupabaseAdminClient();

  const userResponse = await authClient.auth.getUser(accessToken);

  if (userResponse.data.user) {
    return {
      supabase: adminClient,
      storage: adminClient.storage,
      user: mapAuthUser(userResponse.data.user),
    };
  }

  if (refreshToken) {
    const refreshed = await authClient.auth.refreshSession({ refresh_token: refreshToken });

    if (refreshed.data.session?.user) {
      cookieStore.set(AUTH_COOKIE, refreshed.data.session.access_token, authCookieOptions);
      cookieStore.set(AUTH_REFRESH_COOKIE, refreshed.data.session.refresh_token, authCookieOptions);

      return {
        supabase: adminClient,
        storage: adminClient.storage,
        user: mapAuthUser(refreshed.data.session.user),
      };
    }
  }

  throw new Error('Unauthorized.');
};
