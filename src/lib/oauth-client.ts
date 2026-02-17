'use client';

import type { Provider } from '@supabase/supabase-js';

import { supabaseBrowser } from '@/lib/supabase-browser';

export async function onOAuth(provider: Provider) {
  // const origin = process.env.NEXT_PUBLIC_APP_BASE_URL ?? window.location.origin;

  const { data, error } = await supabaseBrowser.auth.signInWithOAuth({
    provider,
    options: {
      redirectTo: `${process.env.NEXT_PUBLIC_APP_BASE_URL}/api/auth/callback`,
    },
  });

  if (error) {
    throw error ?? new Error('OAuth redirect failed.');
  }
}
