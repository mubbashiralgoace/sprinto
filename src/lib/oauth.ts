'use server';

import { redirect } from 'next/navigation';
import type { Provider } from '@supabase/supabase-js';

import { createSupabaseClient } from '@/lib/supabase';

export async function onOAuth(provider: Provider) {
  const origin = process.env.NEXT_PUBLIC_APP_BASE_URL;
  const supabase = createSupabaseClient();

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider,
    options: {
      redirectTo: `${origin}/api/auth/callback`,
    },
  });

  if (error || !data.url) {
    throw error ?? new Error('OAuth redirect failed.');
  }

  return redirect(data.url);
}
